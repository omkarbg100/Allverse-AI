# Deployment Guide — Allverse AI

This document covers every deployment path for Allverse AI, the AWS services used in production, and related operational details.

## Deployment Options

| Option | How | Best for |
|---|---|---|
| Local Docker Compose | `docker compose up -d --build` | Development / single host |
| Remote Docker host (SSH) | GitHub Actions `deployment_docker.yml` | Self-hosted VM |
| AWS ECS (Fargate) | GitHub Actions `deploy.yml` | Production |

---

## 1. Local Docker Compose

Full stack defined in `docker-compose.yml`:

- Databases/infra: MongoDB, Redis, Qdrant, S3 Mock (Adobe s3mock)
- Node services: gateway, auth, chat, billing
- Python agent service
- React frontend (Vite dev server)

LLM inference goes through the Groq API (set `GROQ_API_KEY`).

```bash
cp .env.example .env
docker compose up -d --build
```

Service ports: frontend 5173, gateway 8000, auth 8001, chat 8002, agent 8003, billing 8004, Qdrant 6333, S3 Mock 9000, MongoDB 27017, Redis 6379.

---

## 2. Remote Docker Host (SSH)

Workflow: `.github/workflows/deployment_docker.yml` (triggers on push to `main` or manual).

- Syncs source to a remote host via `rsync` (excluding `.git`, `node_modules`, `.env`, etc.)
- Requires env files to already exist on the host
- Runs `docker compose build --pull` and `docker compose up -d --remove-orphans`
- Health-checks the gateway on `http://localhost:8000/`

Required secrets: `DOCKER_HOST`, `DOCKER_USER`, `DOCKER_PORT`, `DOCKER_SSH_KEY`, `DEPLOY_PATH`.

---

## 3. AWS ECS Production

Workflow: `.github/workflows/deploy.yml` (triggers on push to `main` or manual).

### Architecture

- Application services (gateway, auth, chat, agent, billing) run on **ECS Fargate**.
- **LiteLLM is no longer used**; the agent calls the **Groq API** directly.
- **Redis, MongoDB, Qdrant run on EC2** with EBS volumes (persistent data). MongoDB can instead use **Atlas**.
- **S3 access** is granted through the **ECS task role** (no static AWS keys).
- Frontend is built and synced to **S3**, then invalidated via **CloudFront**.

### AWS Services Used

| Service | Purpose |
|---|---|
| Amazon ECR | Container image registry for all services (gateway, auth, chat, agent, billing) |
| Amazon ECS (Fargate) | Runs stateless app services |
| Amazon EC2 | Runs Redis, MongoDB, Qdrant (EBS volumes); or use managed tiers/Atlas |
| Amazon S3 | Frontend static assets (via CloudFront) and generated agent files (`agent-files` bucket) |
| Amazon CloudFront | CDN + HTTPS for the frontend; invalidation on deploy |
| AWS Cloud Map | Private service discovery (`allverse.local`) |
| IAM (ECS task role) | Grants S3 access to agent tasks without static credentials |
| Amazon VPC / subnets / security groups | Network isolation (implied by ECS/EC2) |

### CI/CD Pipeline Jobs

1. `deploy-backend` — builds & pushes app images (gateway, auth, chat, agent, billing), force-redeploys ECS services, waits for stability.
2. `deploy-frontend` — builds Vite frontend with `VITE_SERVER_URL`, syncs `dist/` to S3, invalidates CloudFront.

### Required GitHub Secrets / Variables

Secrets:
- `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ACCOUNT_ID`
- `ECS_CLUSTER`, `GATEWAY_SERVICE`, `AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`, `BILLING_SERVICE`
- `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`
- `DOCKER_*` (only for SSH docker deploy)

Variables:
- `GATEWAY_PUBLIC_URL` (required for production frontend build)
- `FIREBASE_API_KEY`, `RAZORPAY_KEY_ID`

### S3 Access Pattern

- Local: MinIO/S3Mock with explicit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_KEY` (`minioadmin`).
- AWS: credentials are left unset; boto3 picks up the ECS task role automatically (`s3_client.py`).

### LLM via Groq API

No local model or GPU instance is needed. Set `GROQ_API_KEY` (and optionally `GROQ_CHAT_MODEL` / `GROQ_VISION_MODEL`) on the agent service. The agent calls Groq directly.

---

## Environment Files

The stack reads multiple `.env` files:

- Root `.env` — Docker Compose variables
- `backend/gateway/.env`
- `backend/services/auth/.env`
- `backend/services/chat/.env`
- `backend/services/billing/.env`
- `backend/services/agent/.env`

For purely local setups, defaults suffice. Optional integrations: `TAVILY_API_KEY`, `GROQ_API_KEY`, `RAZORPAY_KEY_ID/SECRET`, Firebase credentials, `ALLOW_DEV_LOGIN`.

---

## Health Checks

```bash
docker compose ps
curl http://localhost:8000/        # gateway
curl http://localhost:8001/        # auth
curl http://localhost:8002/        # chat
curl http://localhost:8004/        # billing
curl http://localhost:8003/health  # agent
```

---

## Volumes / Persistent Data

Docker named volumes: `mongo-data`, `redis-data`, `qdrant-data`, `fastembed-cache`.
AWS: EC2 EBS volumes for Redis, Qdrant (and MongoDB if not using Atlas). No EFS, no Ollama.

---

## Notes

- Presigned S3 links use `http://localhost:9000` locally and expire after 10 minutes.
- Frontend dev server runs inside the container on port 5173.
- Agent service runs Uvicorn on 8003.
- S3 Mock runs on container port 9090 exposed as 9000.
