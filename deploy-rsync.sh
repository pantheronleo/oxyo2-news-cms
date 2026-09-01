#!/usr/bin/env bash
set -Eeuo pipefail

# The production host is a 2 GB t2.small. Running `pnpm build` there exhausted
# its memory on 2026-09-01: the kernel had no swap, thrashed on executable page
# cache, and the box stopped answering SSH and HTTP entirely until it was
# rebooted through the EC2 API. The build now runs on the developer machine and
# only the resulting artefacts are shipped. Do not move the build back onto the
# server.

CMS_HOST="${CMS_HOST:-ubuntu@13.213.46.63}"
CMS_KEY="${CMS_KEY:-$HOME/.ssh/oxyo2-key.pem}"
CMS_DIR="${CMS_DIR:-/home/ubuntu/apps/cms}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/ready}"
SKIP_BUILD="${SKIP_BUILD:-0}"

command -v rsync >/dev/null || { echo "rsync is required"; exit 1; }
command -v pnpm  >/dev/null || { echo "pnpm is required locally: the build runs here now, not on the server"; exit 1; }
test -f "$CMS_KEY" || { echo "SSH key not found: $CMS_KEY"; exit 1; }

# rsync -e takes one string; a direct ssh call needs separate argv words.
RSYNC_RSH="ssh -i $CMS_KEY"
SSH=(ssh -i "$CMS_KEY")

# Artefacts the server needs. api/database are consumed by PM2; admin/news are
# served straight off disk by nginx as document roots.
SERVER_DIST=(apps/api/dist packages/database/dist)
WEB_DIST=(apps/admin/dist apps/news/dist)

# --- 1. Build locally -------------------------------------------------------
if [[ "$SKIP_BUILD" == "1" ]]; then
  echo "SKIP_BUILD=1 - reusing the existing local dist output"
else
  echo "Building locally"
  pnpm install --frozen-lockfile
  pnpm db:generate
  pnpm build
fi

# Refuse to ship a partial build: with --delete on the server-side artefacts, an
# empty dist would wipe the running application.
for d in "${SERVER_DIST[@]}" "${WEB_DIST[@]}"; do
  test -d "$d" || { echo "Build artefact missing: $d (run without SKIP_BUILD=1)"; exit 1; }
  test -n "$(ls -A "$d")" || { echo "Build artefact is empty: $d"; exit 1; }
done
test -f apps/api/dist/server.js || { echo "apps/api/dist/server.js is missing; refusing to deploy"; exit 1; }
test -f apps/admin/dist/index.html || { echo "apps/admin/dist/index.html is missing; refusing to deploy"; exit 1; }
test -f apps/news/dist/index.html || { echo "apps/news/dist/index.html is missing; refusing to deploy"; exit 1; }
echo "Build artefacts verified"

# --- 2. Ship source ---------------------------------------------------------
# dist is excluded here and synced separately below; excluded paths are also
# protected from --delete. .deploy-lock-hash is server-side bookkeeping, and
# analysis/ holds gitignored Search Console export data generated on the server.
echo "Syncing source to ${CMS_HOST}:${CMS_DIR}"
rsync -az --delete --checksum \
  --exclude node_modules --exclude .pnpm-store --exclude .git --exclude .turbo --exclude dist \
  --exclude .claude \
  --exclude .env --exclude '.env.*' --exclude uploads --exclude shared \
  --exclude .deploy-lock-hash --exclude analysis \
  -e "$RSYNC_RSH" ./ "$CMS_HOST:$CMS_DIR/"

# --- 3. Ship build artefacts ------------------------------------------------
# Server-side artefacts are pruned with --delete: nothing serves them directly,
# and PM2 is reloaded afterwards.
for d in "${SERVER_DIST[@]}"; do
  echo "Syncing $d"
  rsync -az --delete --checksum -e "$RSYNC_RSH" "./$d/" "$CMS_HOST:$CMS_DIR/$d/"
done

# nginx serves these two live. --delay-updates stages every file and swaps them
# in at the end, and --delete is deliberately omitted so that in-flight readers
# holding an old index.html can still fetch its hashed chunks. Vite filenames
# are content-hashed, so leftovers are inert rather than stale.
for d in "${WEB_DIST[@]}"; do
  echo "Syncing $d (live document root)"
  rsync -az --checksum --delay-updates -e "$RSYNC_RSH" "./$d/" "$CMS_HOST:$CMS_DIR/$d/"
done

# --- 4. Activate on the server ----------------------------------------------
"${SSH[@]}" "$CMS_HOST" "CMS_DIR='$CMS_DIR' HEALTH_URL='$HEALTH_URL' bash -s" <<'REMOTE'
set -Eeuo pipefail
cd "$CMS_DIR"
source "$HOME/.bashrc" || true
command -v pnpm >/dev/null || { echo 'pnpm is required; run deploy/bootstrap-ubuntu.sh first'; exit 1; }
command -v pm2 >/dev/null || { echo 'pm2 is required; run deploy/bootstrap-ubuntu.sh first'; exit 1; }
test -f .env.production || { echo '.env.production is missing on the server'; exit 1; }
# Keep production secrets server-only. As in GRV3, refresh the runtime .env on
# every deploy so Node tooling and PM2 receive the same production values.
cp .env.production .env
echo 'Using .env.production as the deployment and runtime environment.'
set -a; source .env; set +a
export UPLOAD_DIR="${UPLOAD_DIR:-$CMS_DIR/shared/uploads}"
mkdir -p "$UPLOAD_DIR"

# No build step here on purpose: see the header of deploy-rsync.sh.
# Installing is the heaviest thing left, so only do it when the lockfile moved.
lock_now="$(sha256sum pnpm-lock.yaml | cut -d' ' -f1)"
if [[ ! -d node_modules ]] || [[ "$(cat .deploy-lock-hash 2>/dev/null || true)" != "$lock_now" ]]; then
  echo 'Lockfile changed (or node_modules missing): installing dependencies'
  pnpm install --frozen-lockfile
  printf '%s' "$lock_now" > .deploy-lock-hash
else
  echo 'Lockfile unchanged: skipping install'
fi

# The Prisma query engine is a platform-specific binary, so the client has to be
# generated on the server rather than shipped from the developer machine.
pnpm db:generate
pnpm --filter @cms/database migrate:deploy

# Fail before process reload when a required production environment value is invalid.
node -e "import('./apps/api/dist/config.js')"

# Reload only after every install, migration, and validation step succeeds.
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

for service in cms-api cms-news-bot-worker; do
  pid="$(pm2 pid "$service" | tr -d '[:space:]')"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || { echo "$service did not start successfully (PM2 pid: ${pid:-none})"; pm2 logs "$service" --lines 100 --nostream; exit 1; }
done
pm2 status cms-api cms-news-bot-worker

for attempt in {1..15}; do
  curl --fail --silent "$HEALTH_URL" >/dev/null && { echo 'Deployment healthy'; exit 0; }
  sleep 2
done
echo 'Readiness check failed. Inspect: pm2 logs cms-api --lines 100 and pm2 logs cms-news-bot-worker --lines 100'
exit 1
REMOTE
