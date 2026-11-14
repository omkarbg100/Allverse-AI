#!/usr/bin/env bash
# Bootstrap an Ubuntu/Amazon Linux EC2 instance for Allverse AI.
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y docker.io docker-compose-plugin git curl
elif command -v yum >/dev/null 2>&1; then
  sudo yum update -y
  sudo yum install -y docker git
  sudo systemctl enable --now docker
  sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
else
  echo "Unsupported OS" >&2
  exit 1
fi

sudo systemctl enable --now docker
sudo usermod -aG docker "${USER}" || true
echo "Bootstrap complete. Re-login so docker group applies."
