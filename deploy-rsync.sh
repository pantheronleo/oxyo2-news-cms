#!/usr/bin/env bash
set -Eeuo pipefail

: "${CMS_HOST:?Set CMS_HOST, e.g. ubuntu@example.com}"
CMS_KEY="${CMS_KEY:-$HOME/.ssh/id_ed25519}"
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
test -f .env.production || { echo '.env.production is missing on the server'; exit 1; }
set -a; source .env.production; set +a
export UPLOAD_DIR="${UPLOAD_DIR:-$CMS_DIR/shared/uploads}"
mkdir -p "$UPLOAD_DIR"

pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @cms/database migrate:deploy
pnpm build

# Reload only after every install, migration, and build step succeeds.
if pnpm pm2 describe cms-api >/dev/null 2>&1; then
  pnpm pm2 reload ecosystem.config.cjs --update-env
else
  pnpm pm2 start ecosystem.config.cjs
fi
pnpm pm2 save

for attempt in {1..15}; do
  curl --fail --silent "$HEALTH_URL" >/dev/null && { echo 'Deployment healthy'; exit 0; }
  sleep 2
done
echo 'Readiness check failed. Inspect: pnpm pm2 logs cms-api'
exit 1
REMOTE
