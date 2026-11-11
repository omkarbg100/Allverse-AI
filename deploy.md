# deploy.md - Allverse AI AWS Deployment (Console-First, Single IAM User)

This guide deploys Allverse AI to AWS using the AWS Console. It uses ONE IAM user for everything and ONE IAM role shared by ECS tasks. It is aligned with `.github/workflows/deploy.yml`.

## 0. Alignment with deploy.yml

The workflow assumes AWS infrastructure already exists; it only builds/pushes images and updates services.

Pipeline jobs:
1. deploy-infrastructure - builds/pushes redis, mongodb, qdrant, ollama, litellm to ECR. Does NOT redeploy those ECS services.
2. deploy-backend - builds/pushes gateway, auth-service, chat-service, agent-service, billing-service as latest, force-redeploys the 5 app ECS services.
3. deploy-frontend - builds Vite with VITE_SERVER_URL, VITE_ALLOW_DEV_LOGIN, VITE_FIREBASE_API_KEY, VITE_RAZORPAY_KEY_ID, syncs frontend/dist to S3_BUCKET, invalidates CloudFront.

ECR repos (exact): redis, mongodb, qdrant, ollama, litellm, gateway, auth-service, chat-service, agent-service, billing-service.

ECS services (names must equal GitHub secret values): GATEWAY_SERVICE, AUTH_SERVICE, CHAT_SERVICE, AGENT_SERVICE, BILLING_SERVICE (plus infra services).

GitHub secrets: AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_ACCOUNT_ID, ECS_CLUSTER, GATEWAY_SERVICE, AUTH_SERVICE, CHAT_SERVICE, AGENT_SERVICE, BILLING_SERVICE, S3_BUCKET, CLOUDFRONT_DISTRIBUTION_ID.

GitHub variables: GATEWAY_PUBLIC_URL (required), FIREBASE_API_KEY, RAZORPAY_KEY_ID, optional image tags.

Region example: ap-south-1.

---

## 1. IAM - Single User + Single Role

### 1.1 Create one IAM user (used for everything)

AWS Console -> IAM -> Users -> Create user.
- Name: allverse-admin.
- Console access: yes, set password.
- Attach policy: AdministratorAccess.
- Enable MFA.
- Create access key (for GitHub secrets AWS_ACCESS_KEY / AWS_SECRET_ACCESS_KEY).

This one user handles console, CLI, and GitHub Actions.

### 1.2 Create one IAM role (shared by all ECS tasks)

IAM -> Roles -> Create role -> AWS service -> Elastic Container Service -> ECS Task.
- Name: allverse-all-role.
- Attach policy: AdministratorAccess (single permission set for all).
- Create role.

Use allverse-all-role as BOTH the task execution role and task role in every ECS task definition. No separate roles.

No OIDC provider is needed.

---

## 2. ECR Repositories

ECR -> Private repositories -> Create repository (Private, scan on push).

Create these 10: redis, mongodb, qdrant, ollama, litellm, gateway, auth-service, chat-service, agent-service, billing-service.

---

## 3. ECS Cluster

ECS -> Clusters -> Create cluster.
- Name: allverse-cluster, infrastructure AWS Fargate (and EC2 for GPU later).

Use the default VPC if available; otherwise create a VPC with at least 2 subnets. Security groups still required.

Use ECS Service Connect for internal communication. Enable it on each service and set client aliases (auth, chat, agent, billing, gateway, redis, mongodb, qdrant, litellm, ollama). Then use those aliases in env vars (e.g. http://auth:8001).

## 3.1 EFS for Persistent Data (Fargate stateful services)

EFS -> Create file system (encrypted). Create mount targets in your subnets with the ECS security group. Create access points:
- mongodb: /mongodb, UID/GID 999
- redis: /redis, UID/GID 999
- qdrant: /qdrant, UID/GID 1000

Ollama models: use a GPU EC2 instance with EBS (Fargate has no GPU).

---

## 4. Task Definitions (Fargate)

ECS -> Task definitions -> Create (Fargate, Linux/X86_64).

Execution role and task role: allverse-all-role (both).

| Task | Image | Port | vCPU | Mem |
|---|---|---|---|---|
| gateway-task | gateway:latest | 8000 | 0.25 | 0.5 GB |
| auth-task | auth-service:latest | 8001 | 0.25 | 0.5 GB |
| chat-task | chat-service:latest | 8002 | 0.25 | 0.5 GB |
| agent-task | agent-service:latest | 8003 | 0.5 | 1 GB |
| billing-task | billing-service:latest | 8004 | 0.25 | 0.5 GB |

Agent env (production):
- PORT=8003
- LITELLM_URL=http://litellm:4000
- LITELLM_API_KEY=<strong key>
- USE_LITELLM=true
- OLLAMA_HOST=http://<ollama-private-ip>:11434
- REDIS_URL=redis://redis:6379 (or EC2 IP)
- MONGODB_URI=mongodb://mongodb:27017/allverse_ai (or EC2 IP)
- AUTH_SERVICE=http://auth:8001
- CHAT_SERVICE=http://chat:8002
- QDRANT_URL=http://qdrant:6333 (or EC2 IP)
- AWS_BUCKET_NAME=<backend bucket>
- AWS_REGION=ap-south-1
- MINIO_ENDPOINT= (empty)
- S3_PUBLIC_ENDPOINT= (empty)
- AWS_ACCESS_KEY_ID= (empty)
- AWS_SECRET_KEY= (empty)
- TAVILY_API_KEY=...
- GROQ_API_KEY=...

Gateway env:
- PORT=8000
- FRONTEND_URL=<CloudFront URL>
- AUTH_SERVICE=http://auth:8001
- CHAT_SERVICE=http://chat:8002
- AGENT_SERVICE=http://agent:8003
- BILLING_SERVICE=http://billing:8004
- REDIS_URL=...

Enable awslogs to CloudWatch log group /ecs/<service>.

---

## 4.1 Infrastructure Task Definitions (Fargate)

Create these additional Fargate task definitions (execution role + task role: allverse-all-role):

| Task | Image | Port | Volume |
|---|---|---|---|
| redis-task | redis:latest | 6379 | EFS /redis |
| mongodb-task | mongodb:latest | 27017 | EFS /mongodb |
| qdrant-task | qdrant:latest | 6333 | EFS /qdrant |
| litellm-task | litellm:latest | 4000 | none |

Mount EFS access points as volumes in each task definition. Set env vars:
- Redis: none special.
- MongoDB: none special.
- Qdrant: none special.
- LiteLLM: LITELLM_MASTER_KEY=<strong key>.

## 5. ECS Services

ECS -> Cluster -> Services -> Create (Fargate) for each:
gateway-service, auth-service, chat-service, agent-service, billing-service, redis-service, mongodb-service, qdrant-service, litellm-service.
- Desired tasks: 1.
- VPC allverse-vpc, private subnets, SG allverse-ecs-sg, public IP disabled.
- Service Connect: enable, and set the client alias to the service name (auth, chat, agent, billing, gateway, redis, mongodb, qdrant, litellm).
- Gateway: attach to ALB target group.

---

## 6. Application Load Balancer

EC2 -> Load Balancers -> Create -> Application Load Balancer.
- Name allverse-alb, Internet-facing, IPv4.
- VPC allverse-vpc, both public subnets, SG allverse-alb-sg.
- Listener HTTPS 443 requires ACM certificate (Certificate Manager, DNS validation).
- Target group allverse-gateway-tg, type IP, HTTP, port 8000, health check /.

Attach target group to gateway service.

---

## 7. Infrastructure Services on Fargate + Ollama on GPU EC2

Create ECS services for redis, mongodb, qdrant, litellm (Fargate) in addition to the 5 app services. Enable Service Connect aliases: redis, mongodb, qdrant, litellm.

Ollama cannot run on Fargate with GPU. Launch a GPU EC2 instance (g4dn/g5/g6), install NVIDIA drivers + Docker, pull the ollama image, mount EBS for models, run `ollama pull llama3.2:3b`. Allow only allverse-ecs-sg on 11434. Use its private IP in OLLAMA_HOST.

## 8. S3 Buckets

Backend bucket allverse-agent-files-prod (private). Used by agent; access via allverse-all-role (no static keys).

Frontend bucket allverse-frontend-prod (private, OAC for CloudFront). Bucket policy allowing CloudFront service principal (replace placeholders):

Version 2012-10-17. Statement: Allow cloudfront.amazonaws.com s3:GetObject on arn:aws:s3:::<BUCKET>/* when AWS:SourceArn equals arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>.

---

## 9. CloudFront

CloudFront -> Create distribution.
- Origin: frontend S3 bucket via OAC.
- Viewer protocol: Redirect HTTP to HTTPS.
- Default root object: index.html.
- Error pages: 403/404 -> /index.html with 200.

Save distribution ID for GitHub secret and bucket policy.

---

## 10. GitHub Secrets and Variables

Secrets:
- AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY (from allverse-admin)
- AWS_REGION, AWS_ACCOUNT_ID
- ECS_CLUSTER=allverse-cluster
- GATEWAY_SERVICE=gateway-service, AUTH_SERVICE=auth-service, CHAT_SERVICE=chat-service, AGENT_SERVICE=agent-service, BILLING_SERVICE=billing-service
- S3_BUCKET=<frontend bucket>
- CLOUDFRONT_DISTRIBUTION_ID=<dist id>

Variables:
- GATEWAY_PUBLIC_URL=<https endpoint>
- FIREBASE_API_KEY, RAZORPAY_KEY_ID
- Optional: REDIS_IMAGE_TAG, MONGODB_IMAGE_TAG, QDRANT_IMAGE_TAG, OLLAMA_IMAGE_TAG, LITELLM_UPSTREAM_TAG

---

## 11. Testing Checklist

- Gateway: https://<domain>/
- Agent health via internal test.
- LiteLLM readiness: /health/readiness.
- Ollama: /api/tags (private).
- Qdrant dashboard (private).
- User flows: register/login, chat, coding, search, PDF upload + RAG, generate PDF/PPT, download presigned S3 links, billing test.

---

## 12. Cost and Cleanup

GPU EC2 and ALB incur charges. Stop GPU instance when not testing. Monitor Billing dashboard. To remove all: delete ECS services, cluster, EBS, EC2/ASG, ALB, CloudFront, S3, ECR, VPC.

---

## 13. Troubleshooting

- Task stops immediately: check CloudWatch logs, env, image pull.
- Cannot pull image: execution role missing ECR permissions (allverse-all-role has admin).
- Agent S3 403: task role not attached or wrong bucket.
- Service Connect alias not resolving: check client alias names match env vars.
- Ollama GPU unavailable: wrong AMI or missing GPU support.
- Frontend 404 on refresh: CloudFront error pages to /index.html 200.
- CORS: gateway FRONTEND_URL must equal CloudFront domain.