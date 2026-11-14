#!/usr/bin/env bash
# Deploy/update Allverse AI on an EC2 host.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/allverse-ai}"
cd "$APP_DIR"

git pull --ff-only
cp -n .env.ec2.example .env 2>/dev/null || true

docker compose -f docker-compose.yml -f docker-compose.ec2.yml build
docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --remove-orphans

echo "Deploy complete. Check: curl http://localhost/api/health 2>/dev/null || curl http://localhost:8000/"
