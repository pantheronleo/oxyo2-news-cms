#!/usr/bin/env bash
set -Eeuo pipefail

CMS_HOST="${CMS_HOST:-ubuntu@13.213.46.63}"
CMS_KEY="${CMS_KEY:-$HOME/.ssh/oxyo2-key.pem}"
CMS_DIR="${CMS_DIR:-/home/ubuntu/apps/cms}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/ready}"

command -v rsync >/dev/null || { echo "rsync is required"; exit 1; }
test -f "$CMS_KEY" || { echo "SSH key not found: $CMS_KEY"; exit 1; }

echo "Syncing application to ${CMS_HOST}:${CMS_DIR}"
rsync -az --delete --checksum \
  --exclude node_modules --exclude .git --exclude .turbo --exclude dist \
  --exclude .env --exclude '.env.*' --exclude uploads --exclude shared \
  -e "ssh -i $CMS_KEY" ./ "$CMS_HOST:$CMS_DIR/"

ssh -i "$CMS_KEY" "$CMS_HOST" "CMS_DIR='$CMS_DIR' HEALTH_URL='$HEALTH_URL' bash -s" <<'REMOTE'
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

pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @cms/database migrate:deploy
pnpm build
# Fail before process reload when a required production environment value is invalid.
node -e "import('./apps/api/dist/config.js')"

# Reload only after every install, migration, and build step succeeds.
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
