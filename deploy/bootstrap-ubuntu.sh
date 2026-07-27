#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != "Linux" ]] || ! command -v apt-get >/dev/null; then
  echo 'This bootstrap script must run on an Ubuntu/Debian server with apt-get, not on your local machine.' >&2
  echo 'Example: ssh -i "$HOME/.ssh/oxyo2-key.pem" ubuntu@13.213.46.63 "bash -s" < deploy/bootstrap-ubuntu.sh' >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y nginx postgresql postgresql-contrib rsync curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo npm install -g pm2
DEPLOY_USER="${SUDO_USER:-$USER}"
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
sudo env PATH="$PATH" pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME"
sudo mkdir -p /home/ubuntu/apps/cms/shared/uploads
sudo chown -R ubuntu:ubuntu /home/ubuntu/apps/cms
echo "Create the PostgreSQL database/user and .env.production before deploying. PM2 startup is configured; the first deployment will save cms-api and cms-news-bot-worker. See README.md."
