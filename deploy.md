# deploy.md - Allverse AI AWS Deployment (Console-First, Single IAM User)

This guide deploys Allverse AI to AWS using the AWS Console. It uses ONE IAM user for everything and ONE IAM role shared by ECS tasks. It is aligned with `.github/workflows/deploy.yml`.

---

## 0. What You Are Deploying

- **ECS Fargate (containers):** gateway, auth, chat, agent, billing, litellm, redis
- **Managed services (no EC2):** MongoDB Atlas, Qdrant Cloud, Groq (LLM via LiteLLM)
- **Storage/CDN:** S3 (frontend + agent files), CloudFront
- **Network:** VPC, subnets, security groups, ALB

No EC2, no EFS, no GPU.

---

## 1. Prerequisites

1. AWS account with billing enabled.
2. A MongoDB Atlas cluster (free M0 is fine). Copy the connection string.
3. A Qdrant Cloud cluster. Copy the cluster URL and API key.
4. A Groq API key (https://console.groq.com).
5. A domain (optional, for HTTPS via ACM).

---

## 2. IAM - One User + One Role

### 2.1 Create IAM user (allverse-admin)

1. AWS Console -> IAM -> Users -> Create user.
2. Name: `allverse-admin`.
3. Enable console access, set a password.
4. Attach policy: `AdministratorAccess`.
5. Enable MFA.
6. Create access key (save for GitHub secrets `AWS_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY`).

### 2.2 Create IAM role (allverse-all-role)

1. IAM -> Roles -> Create role -> AWS service -> Elastic Container Service -> ECS Task.
2. Name: `allverse-all-role`.
3. Attach policy: `AdministratorAccess`.
4. Create role.

Use `allverse-all-role` as BOTH the task execution role and task role in every task definition. No separate roles, no OIDC.

---

## 3. ECR Repositories

1. ECR -> Private repositories -> Create repository (Private, scan on push).
2. Create these 7 repositories:
   - `litellm`
   - `gateway`
   - `auth-service`
   - `chat-service`
   - `agent-service`
   - `billing-service`
   (redis uses the public `redis:7` image; mongodb/qdrant are managed in the cloud.)

---

## 4. VPC and Security Groups

## 4. VPC and Security Groups

You cannot fully skip these — ECS Fargate tasks always run inside a VPC and need a security group. But you can use the **defaults** to keep it simple.

### 4.1 Simple option (recommended for getting started)

1. Use the **default VPC** (already exists in your account) with its default subnets.
2. Use the **default security group** for both the ALB and ECS tasks.
   - Default SG allows all inbound from itself and all outbound, so services can talk to each other.
   - For the ALB, add an inbound rule: TCP 443 (and 80) from 0.0.0.0/0.

### 4.2 Production option (better isolation)

1. Create a VPC with at least 2 subnets (public + private) in 2 AZs.
2. Create two security groups:
   - `allverse-alb-sg`: inbound 443 (and 80) from 0.0.0.0/0; outbound all.
   - `allverse-ecs-sg`: inbound from `allverse-alb-sg` on app ports (8000-8004, 4000, 6379); outbound all.

Either way, every ECS service and the ALB must reference a VPC + subnets + security group.

---

## 5. ECS Cluster

1. ECS -> Clusters -> Create cluster.
2. Name: `allverse-cluster`.
3. Infrastructure: AWS Fargate only (no EC2).
4. VPC: your VPC, private subnets.

Enable Service Connect on the cluster. You will set client aliases per service (auth, chat, agent, billing, gateway, litellm, redis).

---

## 6. Task Definitions (Fargate)

ECS -> Task definitions -> Create new task definition (Fargate, Linux/X86_64). Use `allverse-all-role` for both execution role and task role.

### 6.1 Application task definitions

| Task | Image | Port | vCPU | Mem |
|---|---|---|---|---|
| gateway-task | gateway:latest | 8000 | 0.25 | 0.5 GB |
| auth-task | auth-service:latest | 8001 | 0.25 | 0.5 GB |
| chat-task | chat-service:latest | 8002 | 0.25 | 0.5 GB |
| agent-task | agent-service:latest | 8003 | 0.5 | 1 GB |
| billing-task | billing-service:latest | 8004 | 0.25 | 0.5 GB |

### 6.2 Infrastructure task definitions

| Task | Image | Port | Volume |
|---|---|---|---|
| redis-task | redis:7 | 6379 | none (ephemeral) |
| litellm-task | litellm:latest | 4000 | none |

### 6.3 Environment variables

**Agent task (agent-task):**
- `PORT=8003`
- `LITELLM_URL=http://litellm:4000`
- `LITELLM_API_KEY=<strong key>` (same as LITELLM_MASTER_KEY)
- `USE_LITELLM=true`
- `GROQ_API_KEY=<groq key>`
- `GROQ_CHAT_MODEL=openai/gpt-oss-120b` (optional)
- `GROQ_VISION_MODEL=qwen/qwen3.6-27b` (optional)
- `REDIS_URL=redis://redis:6379`
- `MONGODB_URI=<Atlas connection string>`
- `AUTH_SERVICE=http://auth:8001`
- `CHAT_SERVICE=http://chat:8002`
- `QDRANT_URL=https://<qdrant-cluster-endpoint>`
- `QDRANT_API_KEY=<qdrant api key>`
- `AWS_BUCKET_NAME=<backend bucket>`
- `AWS_REGION=ap-south-1`
- `TAVILY_API_KEY=...`

**Gateway task (gateway-task):**
- `PORT=8000`
- `FRONTEND_URL=<CloudFront URL>`
- `AUTH_SERVICE=http://auth:8001`
- `CHAT_SERVICE=http://chat:8002`
- `AGENT_SERVICE=http://agent:8003`
- `BILLING_SERVICE=http://billing:8004`
- `REDIS_URL=redis://redis:6379`

**LiteLLM task (litellm-task):**
- `GROQ_API_KEY=<groq key>`
- `LITELLM_MASTER_KEY=<strong key>`

**Auth / Chat / Billing tasks:** set `PORT`, `MONGODB_URI`, `REDIS_URL` as appropriate (MONGODB_URI = Atlas connection string).

Enable awslogs to CloudWatch log group `/ecs/<service>` on every task.

---

## 7. ECS Services

ECS -> Cluster -> Services -> Create (Fargate) for each:

`gateway-service`, `auth-service`, `chat-service`, `agent-service`, `billing-service`, `litellm-service`, `redis-service`

Settings for each:
- Desired tasks: 1.
- VPC: allverse-vpc, private subnets, SG allverse-ecs-sg, public IP disabled.
- Service Connect: enable, client alias = service name (auth, chat, agent, billing, gateway, litellm, redis).
- Gateway: attach to ALB target group `allverse-gateway-tg`.

---

## 8. Application Load Balancer

1. EC2 -> Load Balancers -> Create -> Application Load Balancer.
2. Name: `allverse-alb`, Internet-facing, IPv4.
3. VPC allverse-vpc, both public subnets, SG allverse-alb-sg.
4. Listener HTTPS 443 requires an ACM certificate (Certificate Manager, DNS validation).
5. Target group `allverse-gateway-tg`, type IP, HTTP, port 8000, health check `/`.
6. Attach target group to gateway service.

---

## 9. S3 Buckets

1. Backend bucket `allverse-agent-files-prod` (private). Used by agent; access via allverse-all-role (no static keys).
2. Frontend bucket `allverse-frontend-prod` (private, OAC for CloudFront). Bucket policy allowing CloudFront service principal:

```
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::<BUCKET>/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>"
      }
    }
  }]
}
```

---

## 10. CloudFront

1. CloudFront -> Create distribution.
2. Origin: frontend S3 bucket via OAC.
3. Viewer protocol: Redirect HTTP to HTTPS.
4. Default root object: `index.html`.
5. Error pages: 403/404 -> `/index.html` with 200.
6. Save distribution ID for GitHub secret and bucket policy.

---

## 11. GitHub Secrets and Variables

**Secrets:**
- `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY` (from allverse-admin)
- `AWS_REGION`, `AWS_ACCOUNT_ID`
- `ECS_CLUSTER=allverse-cluster`
- `GATEWAY_SERVICE=gateway-service`, `AUTH_SERVICE=auth-service`, `CHAT_SERVICE=chat-service`, `AGENT_SERVICE=agent-service`, `BILLING_SERVICE=billing-service`
- `S3_BUCKET=<frontend bucket>`
- `CLOUDFRONT_DISTRIBUTION_ID=<dist id>`

**Variables:**
- `GATEWAY_PUBLIC_URL=<https endpoint>`
- `FIREBASE_API_KEY`, `RAZORPAY_KEY_ID`
- Optional: `LITELLM_UPSTREAM_TAG`

---

## 12. Testing Checklist

- Gateway: `https://<domain>/`
- Agent health via internal test.
- Groq: agent LLM calls succeed (LiteLLM proxies to Groq).
- Qdrant Cloud dashboard (private).
- User flows: register/login, chat, coding, search, PDF upload + RAG, generate PDF/PPT, download presigned S3 links, billing test.

---

## 13. Cost and Cleanup

ALB incurs charges. Monitor Billing dashboard. To remove all: delete ECS services, cluster, ALB, CloudFront, S3, ECR, VPC.

---

## 14. Troubleshooting

- Task stops immediately: check CloudWatch logs, env, image pull.
- Cannot pull image: execution role missing ECR permissions (allverse-all-role has admin).
- Agent S3 403: task role not attached or wrong bucket.
- Service Connect alias not resolving: check client alias names match env vars.
- LLM errors: verify `GROQ_API_KEY` is set and model names are valid.
- Frontend 404 on refresh: CloudFront error pages to `/index.html` 200.
- CORS: gateway `FRONTEND_URL` must equal CloudFront domain.
- MongoDB connection: verify Atlas connection string and IP allowlist (0.0.0.0/0 for Fargate).
- Qdrant connection: verify Qdrant Cloud URL and API key.
