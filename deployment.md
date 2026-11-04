# Deployment Guide — Allverse AI

This document covers every deployment path for Allverse AI, the AWS services used in production, and related operational details.

## Deployment Options

| Option | How | Best for |
|---|---|---|
| Local Docker Compose | `docker compose up -d --build` | Development / single host |
| Remote Docker host (SSH) | GitHub Actions `deployment_docker.yml` | Self-hosted VM |
| AWS ECS (Fargate + EC2 GPU) | GitHub Actions `deploy.yml` | Production |

---

## 1. Local Docker Compose

Full stack defined in `docker-compose.yml`:

- Databases/infra: MongoDB, Redis, Qdrant, S3 Mock (Adobe s3mock)
- LiteLLM gateway
- Node services: gateway, auth, chat, billing
- Python agent service
- React frontend (Vite dev server)

Ollama runs on the host machine and is reached via `host.docker.internal:11434`.

```bash
cp .env.example .env
docker compose up -d --build
```

Service ports: frontend 5173, gateway 8000, auth 8001, chat 8002, agent 8003, billing 8004, LiteLLM 4001, Qdrant 6333, S3 Mock 9000, MongoDB 27017, Redis 6379.

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
- Stateful/infra services (redis, mongodb, qdrant, litellm) run on **ECS Fargate**.
- **Ollama runs on GPU-backed EC2** (Fargate has no GPU support).
- **EFS access points** provide persistent storage for MongoDB, Redis, Qdrant, and Ollama models.
- **Cloud Map** private DNS namespace `allverse.local` for internal service-to-service traffic.
- **S3 access** is granted through the **ECS task role** (no static AWS keys).
- Frontend is built and synced to **S3**, then invalidated via **CloudFront**.

### AWS Services Used

| Service | Purpose |
|---|---|
| Amazon ECR | Container image registry for all services (gateway, auth, chat, agent, billing, redis, mongodb, qdrant, ollama, litellm) |
| Amazon ECS (Fargate) | Runs stateless app services and stateful infra services |
| Amazon EC2 (GPU) | Runs Ollama with GPU for model inference |
| Amazon EFS | Persistent volumes for MongoDB, Redis, Qdrant, Ollama model cache |
| Amazon S3 | Frontend static assets (via CloudFront) and generated agent files (`agent-files` bucket) |
| Amazon CloudFront | CDN + HTTPS for the frontend; invalidation on deploy |
| AWS Cloud Map | Private service discovery (`allverse.local`) |
| IAM (ECS task role) | Grants S3 access to agent tasks without static credentials |
| Amazon VPC / subnets / security groups | Network isolation (implied by ECS/EC2) |

### CI/CD Pipeline Jobs

1. `deploy-infrastructure` — builds & pushes infra images (redis, mongodb, qdrant, ollama, litellm) to ECR, skipping unchanged images via content hash.
2. `deploy-backend` — builds & pushes app images (gateway, auth, chat, agent, billing), force-redeploys ECS services, waits for stability.
3. `deploy-frontend` — builds Vite frontend with `VITE_SERVER_URL`, syncs `dist/` to S3, invalidates CloudFront.

### Required GitHub Secrets / Variables

Secrets:
- `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_ACCOUNT_ID`
- `ECS_CLUSTER`, `GATEWAY_SERVICE`, `AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`, `BILLING_SERVICE`
- `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`
- `DOCKER_*` (only for SSH docker deploy)

Variables:
- `GATEWAY_PUBLIC_URL` (required for production frontend build)
- `FIREBASE_API_KEY`, `RAZORPAY_KEY_ID`
- `REDIS_IMAGE_TAG`, `MONGODB_IMAGE_TAG`, `QDRANT_IMAGE_TAG`, `OLLAMA_IMAGE_TAG`, `LITELLM_UPSTREAM_TAG` (optional, with defaults)

### S3 Access Pattern

- Local: MinIO/S3Mock with explicit `AWS_ACCESS_KEY_ID` / `AWS_SECRET_KEY` (`minioadmin`).
- AWS: credentials are left unset; boto3 picks up the ECS task role automatically (`s3_client.py`).

### Ollama on GPU EC2

Fargate has no GPU, so Ollama is scheduled on a GPU EC2 instance registered to the ECS cluster. Model files persist on EFS so re-pulls are avoided across restarts.

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
curl http://localhost:4001/health/readiness  # LiteLLM
curl http://localhost:11434/api/tags         # Ollama
```

---

## Volumes / Persistent Data

Docker named volumes: `mongo-data`, `redis-data`, `qdrant-data`, `fastembed-cache`.
AWS: EFS access points for MongoDB, Redis, Qdrant, Ollama.

---

## Notes

- Presigned S3 links use `http://localhost:9000` locally and expire after 10 minutes.
- Frontend dev server runs inside the container on port 5173.
- Agent service runs Uvicorn on 8003; LiteLLM on container port 4000 exposed as 4001.
- S3 Mock runs on container port 9090 exposed as 9000.
