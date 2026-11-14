# EC2 Deployment — Allverse AI

Single-host deployment using Docker Compose on an EC2 instance, fronted by nginx.

## Steps
1. Launch an EC2 instance (Ubuntu 22.04, t3.medium+), open ports 22, 80, 443.
2. Run `deploy/ec2/bootstrap.sh` on the instance.
3. Clone this repo to `/opt/allverse-ai`.
4. Copy `.env.ec2.example` to `.env` and fill values.
5. Run `docker compose -f docker-compose.yml -f docker-compose.ec2.yml up -d --build`.
6. Enable auto-start: `sudo cp deploy/ec2/allverse.service /etc/systemd/system/ && sudo systemctl enable --now allverse`.
7. Verify with `deploy/ec2/healthcheck.sh`.

## CI/CD
Push to `EC2-deployment` triggers `.github/workflows/deploy_ec2.yml` (SSH deploy).
