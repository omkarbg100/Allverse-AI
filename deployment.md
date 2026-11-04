# Allverse AI — AWS Deployment Guide

## Architecture

```
                          ┌─────────────────────────────┐
                          │        CloudFront (CDN)      │
                          │   (frontend SPA + caching)   │
                          └──────────────┬──────────────┘
                                         │
                          ┌──────────────▼──────────────┐
                          │   S3 (frontend static site)  │
                          └─────────────────────────────┘

                          ┌─────────────────────────────┐
                          │   Application Load Balancer  │
                          │        (internet-facing)     │
                          └──────────────┬──────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
  ┌─────▼─────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐
  │  Gateway  │  │  Auth   │  │  Chat   │  │  Agent  │  │   Billing   │
  │  (ECS)    │  │  (ECS)  │  │  (ECS)  │  │  (ECS)  │  │   (ECS)     │
  └─────┬─────┘  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘
        │             │            │            │               │
        └─────────────┴────────────┴────────────┴───────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐      ┌───────▼───────┐    ┌──────▼──────┐
              │   Redis   │      │   MongoDB     │    │   Qdrant    │
              │  (ECS)    │      │   (ECS)       │    │   (ECS)     │
              └───────────┘      └───────────────┘    └─────────────┘
                    │                    │                    │
                    └────────────────────┴────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
              ┌─────▼─────┐      ┌───────▼───────┐
              │  LiteLLM  │      │    Ollama     │
              │  (ECS)    │      │  (ECS on GPU) │
              └───────────┘      └───────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │              EFS (persistence)         │
                    │  /redis /mongodb /qdrant /ollama        │
                    └────────────────────────────────────────┘

                    ┌────────────────────────────────────────┐
                    │     S3 (agent artifact bucket, private) │
                    └────────────────────────────────────────┘

                    Cloud Map private DNS: *.allverse.local
```

## Services

### Application services (5) — Fargate, updated by CI
| Service | Container | Port | Notes |
|---|---|---|---|
| gateway | gateway | 8000 | Express reverse proxy, internet-facing via ALB |
| auth-service | auth | 8001 | Auth + JWT |
| chat-service | chat | 8002 | Chat + WebSocket |
| agent-service | agent | 8003 | FastAPI + LangGraph, uses S3/EFS |
| billing-service | billing | 8004 | Razorpay billing |

### Infrastructure services (5) — ECS, idempotently deployed by CI
| Service | Image source | Port | Persistence |
|---|---|---|---|
| redis-service | images/redis (wraps redis:7) | 6379 | EFS /redis (uid 999) |
| mongodb-service | images/mongodb (wraps mongo:7) | 27017 | EFS /mongodb (uid 999) |
| qdrant-service | images/qdrant (wraps qdrant) | 6333 | EFS /qdrant (uid 1000) |
| litellm-service | images/litellm (custom wrapper) | 4000 | stateless |
| ollama-service | images/ollama (wraps ollama) | 11434 | EFS /ollama (uid 0), runs on GPU EC2 |

All infrastructure services register in Cloud Map namespace `allverse.local`, so
app services reach them via `redis.allverse.local:6379`, etc.

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/deploy.yml`

Three jobs:

1. **deploy-infrastructure** — builds the 5 infra Docker images (content-hash
   tagged), pushes to ECR only if the hash is new, registers a new task
   definition revision only if it changed, updates the ECS service only if the
   task def changed, then waits for stability.

2. **deploy-backend** — builds and pushes the 5 application images to ECR,
   then force-new-deployment on the 5 app ECS services.

3. **deploy-frontend** — builds the Vite bundle, syncs to S3, invalidates
   CloudFront.

The infra job is idempotent: unchanged images/task-defs/services are skipped.

## Required GitHub Secrets

| Secret | Purpose |
|---|---|
| `AWS_REGION` | AWS region |
| `AWS_ACCOUNT_ID` | AWS account id |
| `AWS_ACCESS_KEY` | Deploy IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Deploy IAM secret key |
| `ECS_CLUSTER` | ECS cluster name |
| `GATEWAY_SERVICE`, `AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`, `BILLING_SERVICE` | App ECS service names |
| `S3_BUCKET` | Frontend static-site bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | Frontend CDN distribution |

## Required GitHub Variables

| Variable | Purpose |
|---|---|
| `PRIVATE_SUBNET_IDS` | VPC private subnets |
| `INFRA_SECURITY_GROUP_ID` | SG for infra services |
| `EFS_FILE_SYSTEM_ID` | EFS file system id |
| `EFS_AP_REDIS`, `EFS_AP_MONGODB`, `EFS_AP_QDRANT`, `EFS_AP_OLLAMA` | EFS access point ids |
| `ECS_EXECUTION_ROLE_ARN` | ECS task execution role |
| `ECS_TASK_ROLE_ARN` | ECS task role (S3/EFS access) |
| `LITELLM_SECRET_ARN` | Secrets Manager secret ARN |
| `SERVICE_DISCOVERY_*_ARN` | Cloud Map service ARNs (redis, mongodb, qdrant, litellm, ollama) |
| `GATEWAY_PUBLIC_URL` | Public gateway URL for frontend build |
| `FIREBASE_API_KEY`, `RAZORPAY_KEY_ID` | Frontend config |
| `OLLAMA_MODEL` | Model name (default `llama3.2:3b`) |
| `OLLAMA_GPU_COUNT` | GPU count (default 1) |
| `REDIS_IMAGE_TAG`, `MONGODB_IMAGE_TAG`, `QDRANT_IMAGE_TAG`, `OLLAMA_IMAGE_TAG`, `LITELLM_UPSTREAM_TAG` | Optional pinned upstream tags |

## Manual steps that cannot be automated

1. **VPC DNS**: enable DNS resolution and DNS hostnames on the VPC.
2. **NAT / VPC endpoints**: private-subnet tasks need ECR, S3, CloudWatch Logs,
   Secrets Manager, EFS, SSM, STS access.
3. **GPU quota**: request a G-instance vCPU quota increase for Ollama.
4. **S3 bucket**: create the agent artifact bucket; leave Block Public Access on.
5. **Secrets**: populate provider keys in Secrets Manager (`allverse/litellm`):
   `GROQ_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `TAVILY_API_KEY`.
6. **Ollama model**: pull the model once into the shared EFS volume.
7. **App security group**: ensure the SG attached to app tasks is allowed to reach
   the infra SG on ports 6379, 27017, 6333, 4000, 11434.

## Persistence

- Redis, MongoDB, Qdrant, Ollama store data on EFS via access points with
  specific UIDs (999, 999, 1000, 0 respectively).
- EFS access point ownership must match the container's runtime UID.
- Task definitions set `maximumPercent=100, minimumHealthyPercent=0` for
  stateful services to avoid concurrent EFS mounts.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Ollama "model not found" | Pull the model into the shared EFS volume; check `ollama list`; confirm `OLLAMA_MODEL` matches LiteLLM. |
| Infra service stuck in PROVISIONING | Check GPU quota (Ollama), EFS mount targets, security groups. |
| Task def registration fails | Ensure execution role can read Secrets Manager and EFS. |
| Empty env vars ignored by ECS | Removed from app task defs; agent defaults to empty strings. |
| Frontend shows wrong API URL | Set `GATEWAY_PUBLIC_URL` variable and rebuild. |
YAML
echo "created"