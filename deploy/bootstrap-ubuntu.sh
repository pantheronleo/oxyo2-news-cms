#!/usr/bin/env bash
set -Eeuo pipefail
sudo apt-get update
sudo apt-get install -y nginx postgresql postgresql-contrib rsync curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
sudo npm install -g pm2
sudo mkdir -p /home/ubuntu/apps/cms/shared/uploads
sudo chown -R ubuntu:ubuntu /home/ubuntu/apps/cms
echo "Create the PostgreSQL database/user and .env.production before deploying. See README.md."
