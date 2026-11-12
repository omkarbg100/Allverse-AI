# deploy.md - Allverse AI AWS Deployment (Console-First, Single IAM User)

This guide deploys Allverse AI to AWS using the AWS Console. It uses ONE IAM user for everything and ONE IAM role shared by ECS tasks. It is aligned with `.github/workflows/deploy.yml`.

## 0. Alignment with deploy.yml

The workflow assumes AWS infrastructure already exists; it only builds/pushes images and updates services.

Pipeline jobs:
1. deploy-backend - builds/pushes gateway, auth-service, chat-service, agent-service, billing-service as latest, force-redeploys the 5 app ECS services.
2. deploy-frontend - builds Vite with VITE_SERVER_URL, VITE_ALLOW_DEV_LOGIN, VITE_FIREBASE_API_KEY, VITE_RAZORPAY_KEY_ID, syncs frontend/dist to S3_BUCKET, invalidates CloudFront.

ECR repos (exact): gateway, auth-service, chat-service, agent-service, billing-service. (redis/mongodb/qdrant only if self-hosting infra; ollama and litellm no longer used.)

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

Create these 8: redis, mongodb, qdrant, gateway, auth-service, chat-service, agent-service, billing-service. (ollama and litellm no longer needed.)

---

## 3. ECS Cluster

ECS -> Clusters -> Create cluster.
- Name: allverse-cluster, infrastructure AWS Fargate (plus EC2 for stateful services and GPU).

Use the default VPC if available; otherwise create a VPC with at least 2 subnets. Security groups still required.

Use ECS Service Connect for internal communication. Enable it on each service and set client aliases (auth, chat, agent, billing, gateway, redis, mongodb, qdrant, litellm, ollama). Then use those aliases in env vars (e.g. http://auth:8001).

## 3.1 Persistent Data on EC2 (EBS volumes) / Managed tiers

Stateful services (mongodb, redis, qdrant) run on EC2 instances with EBS volumes or managed tiers (MongoDB Atlas, Upstash Redis, Qdrant Cloud). Launch EC2 instances, attach EBS volumes, mount them, and run the containers with bind mounts:
- mongodb: /data/db (skip if using Atlas)
- redis: /data (skip if using Upstash)
- qdrant: /qdrant/storage (skip if using Qdrant Cloud)

No GPU instance is needed; LLM inference uses the Groq API. Expose ports 27017, 6379, 6333 only to allverse-ecs-sg so Fargate tasks reach them via the EC2 private IPs.

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
- GROQ_API_KEY=<groq key>
- GROQ_CHAT_MODEL=openai/gpt-oss-120b (optional)
- GROQ_VISION_MODEL=qwen/qwen3.6-27b (optional)
- REDIS_URL=redis://<redis host>:6379 (or EC2 IP)
- MONGODB_URI=mongodb+srv://... (Atlas) or mongodb://<host>:27017/allverse_ai
- AUTH_SERVICE=http://auth:8001
- CHAT_SERVICE=http://chat:8002
- QDRANT_URL=https://<qdrant-cluster-endpoint>
- QDRANT_API_KEY=<qdrant api key>
- AWS_BUCKET_NAME=<backend bucket>
- AWS_REGION=ap-south-1
- TAVILY_API_KEY=...

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

No Fargate infra task definitions are needed: LLM uses Groq API, and Redis/MongoDB/Qdrant run on EC2 (or managed tiers). Only the 5 app task definitions (section 4) plus optional litellm (not used) remain.

## 5. ECS Services

ECS -> Cluster -> Services -> Create (Fargate) for each:
gateway-service, auth-service, chat-service, agent-service, billing-service.
- Desired tasks: 1.
- VPC allverse-vpc, private subnets, SG allverse-ecs-sg, public IP disabled.
- Service Connect: enable, and set the client alias to the service name (auth, chat, agent, billing, gateway).
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

## 7. Infrastructure Services on EC2 + Groq API

No Ollama/GPU EC2 and no LiteLLM Fargate service are needed. LLM inference uses the Groq API (set GROQ_API_KEY on the agent). Redis, MongoDB, and Qdrant run on EC2 with EBS volumes (or use managed tiers/Atlas). Expose ports 6379, 27017, 6333 only to allverse-ecs-sg and use the EC2 private IPs in env vars (REDIS_URL, MONGODB_URI, QDRANT_URL).

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
- Groq: agent LLM calls succeed.
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
- LLM errors: verify GROQ_API_KEY is set and model names are valid.
- Frontend 404 on refresh: CloudFront error pages to /index.html 200.
- CORS: gateway FRONTEND_URL must equal CloudFront domain.