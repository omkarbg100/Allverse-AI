# Allverse AI — AWS ECS infrastructure deployment

This directory extends the existing AWS deployment with the infrastructure
services that used to run in `docker-compose.yml`:

| Service | ECS service | Launch type | Persistence |
|---|---|---|---|
| Redis | `redis-service` | Fargate | EFS (`/redis`) |
| MongoDB | `mongodb-service` | Fargate | EFS (`/mongodb`) |
| Qdrant | `qdrant-service` | Fargate | EFS (`/qdrant`) |
| LiteLLM | `litellm-service` | Fargate | stateless |
| Ollama | `ollama-service` | EC2 + GPU | EFS (`/ollama`) |

The existing application services (`gateway`, `auth`, `chat`, `agent`,
`billing`) and the S3/CloudFront frontend deployment are preserved.

---

## 1. Architecture

```text
Browser
  │
  ├── CloudFront ──► S3 bucket (frontend/dist)          [existing]
  │
  └── ALB ──► gateway-service (ECS)                     [existing]
                 │
                 ├── auth-service ──────┐
                 ├── chat-service ──────┤
                 ├── billing-service ───┤
                 └── agent-service ─────┤
                                        │
             Cloud Map private DNS      │
             (allverse.local)           │
                                        ▼
   redis.allverse.local:6379      ◄── auth / chat / billing / gateway
   mongodb.allverse.local:27017   ◄── auth / chat / billing / agent
   qdrant.allverse.local:6333     ◄── agent
   litellm.allverse.local:4000    ◄── agent
   ollama.allverse.local:11434    ◄── litellm (and agent fallback)
                                        │
                                        ▼
                              ECS service connect via Cloud Map
                                        │
                      ┌─────────────────┴─────────────────┐
                      ▼                                   ▼
              Fargate: redis/mongo/qdrant/litellm    EC2 GPU: ollama
                      │                                   │
                      └──────────► EFS ◄──────────────────┘
                                   (data + models)

agent-service ──► S3 bucket (presigned artifact URLs) via ECS Task Role
```

No S3 ECS service is created. The agent keeps using the AWS SDK; in ECS the
credentials come from the task role instead of static environment variables.

### Why this shape

- **Fargate** is used for Redis, MongoDB, Qdrant and LiteLLM because they do
  not need GPUs and Fargate removes instance management.
- **Ollama** must run on **EC2 with a GPU**. Fargate has no GPU support. A
  `g4dn.xlarge` (1 × T4, 4 vCPU, 16 GiB) is a practical starting point.
- **EFS** is the only persistent volume available to Fargate tasks. Redis,
  MongoDB and Qdrant each get a dedicated EFS access point with UID/GID
  ownership that matches the official image user. Ollama gets a separate EFS
  access point for the shared model cache.
- **Cloud Map private DNS** (`allverse.local`) is used instead of Docker
  Compose hostnames or `localhost`. The existing app task definitions do not
  need a sidecar or Service Connect proxy; they simply receive DNS names.
- **LiteLLM** is built as a tiny wrapper around the official image so the
  Ollama URL and model name are rendered from environment variables at
  container start. The official image remains the base; no fork is maintained.

> EFS performance note: MongoDB and Redis on EFS are suitable for this
> project's small workloads, but they are not the fastest production storage.
> If write latency becomes a problem, move those two services to EC2 launch
> type with EBS volumes (and task placement constraints) or use a managed
> database service. The current implementation deliberately follows the
> "no managed DB" constraint and keeps everything on ECS + EFS.

---

## 2. Files

| File | Purpose |
|---|---|
| `bootstrap.sh` | One-time, idempotent creation of ECR repos, EFS, IAM, Cloud Map, security groups, log groups and Secrets Manager secret. |
| `deploy-infra.sh` | Mirrors official images to ECR, builds/tag the LiteLLM wrapper, registers task definitions and creates/updates the five ECS services. |
| `deploy_app_services.py` | Patches the five existing application task definitions with private DNS endpoints, secrets and the S3 task role, then rolls them out. |
| `gpu-capacity.sh` | Creates the GPU security group, EC2 instance role/profile, launch template and Auto Scaling group for Ollama. |
| `pull-ollama-model.sh` | Pulls an Ollama model once through SSM (no automatic model download on every start). |
| `render.py` | Renders `__PLACEHOLDER__` values in task-definition templates. |
| `taskdef_diff.py` | Avoids registering an unchanged task definition. |
| `taskdefs/*.json` | ECS task definition templates. |
| `images/litellm/` | Minimal LiteLLM wrapper image (official image + env-driven config). |
| `app-env.json` | Production environment overrides for the five application services. |
| `aws-state.env.example` | Template for the generated local state file. |

---

## 3. Prerequisites

1. An existing ECS cluster (`ECS_CLUSTER`) with the five application services
   running.
2. A VPC with:
   - at least two **private** subnets in different AZs,
   - DNS resolution and DNS hostnames enabled,
   - a NAT gateway **or** VPC endpoints for ECR, S3, CloudWatch Logs,
     Secrets Manager, EFS, SSM and STS (tasks must pull images and write logs),
   - the existing application tasks running in those private subnets.
3. An existing S3 bucket for agent artifacts (private, Block Public Access on).
4. AWS CLI v2, Docker, `bash` 4+ and Python 3.9+ on the machine running the
   scripts. GitHub-hosted `ubuntu-latest` runners satisfy this.
5. An IAM principal for bootstrap with permissions for ECR, EFS, EC2
   (security groups), IAM, Cloud Map, Secrets Manager, CloudWatch Logs and
   ECS. The GitHub Actions deploy principal needs ECR, ECS, IAM PassRole,
   CloudWatch Logs, Secrets Manager read and EFS describe permissions.
6. For Ollama: a **G-instance vCPU service quota** in the target region
   (Service Quotas → EC2 → "All G and VT Spot Instance Requests" or the
   on-demand G-instance quota).

---

## 4. Bootstrap AWS resources

Run once from the repository root. The script is idempotent and can be
re-run safely.

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=123456789012          # optional, resolved via STS if omitted
export VPC_ID=vpc-xxxxxxxxxxxxxxxxx
export PRIVATE_SUBNET_IDS=subnet-aaaaaaaaaaaaaaaaa,subnet-bbbbbbbbbbbbbbbbb
export ECS_CLUSTER=allverse-cluster
export APP_SECURITY_GROUP_ID=sg-xxxxxxxxxxxxxxxxx   # SG attached to the 5 app tasks
export S3_BUCKET_NAME=allverse-agent-files-123456789012
bash deploy/aws/bootstrap.sh
```

Notes:

- `APP_SECURITY_GROUP_ID` must be the security group attached to the **ECS
  tasks**, not the ALB security group. The script opens only the internal
  ports from that group to the infrastructure security group.
- If you omit `APP_SECURITY_GROUP_ID`, the script prints the rules you must
  add manually.
- `S3_BUCKET_NAME` is used only to build the task-role policy. It does not
  create a bucket.
- The script writes `deploy/aws/aws-state.env` (git-ignored) and prints the
  values to add as GitHub Actions repository variables.

The script creates:

- ECR repositories `redis`, `mongodb`, `qdrant`, `litellm`, `ollama`
- CloudWatch log groups `/ecs/allverse-{redis,mongodb,qdrant,litellm,ollama}`
- EFS file system `allverse-efs` with access points:
  - `mongodb` → UID/GID `999:999`
  - `redis` → UID/GID `999:999`
  - `qdrant` → UID/GID `1000:1000`
  - `ollama` → UID/GID `0:0`
- Security groups `allverse-infra-sg`, `allverse-efs-sg`
- IAM roles `allverse-ecs-task-execution` and `allverse-task-role`
- Secrets Manager secret `allverse/litellm` with a generated master key
- Cloud Map private namespace `allverse.local` and services `redis`,
  `mongodb`, `qdrant`, `litellm`, `ollama`

If any official image runs with a different UID/GID in the future, update the
access point ownership or the image version tag before deploying.

---

## 5. Configure secrets

`bootstrap.sh` creates the secret with a generated `LITELLM_MASTER_KEY` and
empty provider keys. Populate the provider keys without rotating the master
key:

```bash
aws secretsmanager get-secret-value \
  --secret-id allverse/litellm \
  --query SecretString \
  --output text > /tmp/allverse-secrets.json

# Edit the JSON, then:
aws secretsmanager put-secret-value \
  --secret-id allverse/litellm \
  --secret-string file:///tmp/allverse-secrets.json

rm -f /tmp/allverse-secrets.json
```

Expected JSON keys:

```json
{
  "LITELLM_MASTER_KEY": "sk-...",
  "GROQ_API_KEY": "",
  "OPENAI_API_KEY": "",
  "ANTHROPIC_API_KEY": "",
  "TAVILY_API_KEY": ""
}
```

The agent task definition references `LITELLM_API_KEY`, `GROQ_API_KEY` and
`TAVILY_API_KEY` from this secret. LiteLLM references the master key and
provider keys from the same secret. No API keys are placed in task
definitions, workflow files or the repository.

---

## 6. Create GPU capacity for Ollama

```bash
source deploy/aws/aws-state.env

export GPU_SUBNET_IDS=subnet-aaaaaaaaaaaaaaaaa,subnet-bbbbbbbbbbbbbbbbb  # optional
export GPU_INSTANCE_TYPE=g4dn.xlarge                                    # optional
export GPU_MIN_SIZE=1 GPU_MAX_SIZE=2 GPU_DESIRED_CAPACITY=1             # optional
bash deploy/aws/gpu-capacity.sh
```

This creates:

- `allverse-gpu-sg` (allows `11434` from the app and infrastructure SGs)
- `allverse-ecs-instance-role` and `allverse-ecs-instance-profile`
  (ECS container instance + SSM core policies)
- launch template `allverse-ollama-gpu` from the ECS-optimized GPU AMI
- Auto Scaling group `allverse-ollama-gpu` that registers the instance into
  `ECS_CLUSTER`

Verify the instance registered:

```bash
aws ecs list-container-instances --cluster "$ECS_CLUSTER"
aws ecs describe-container-instances \
  --cluster "$ECS_CLUSTER" \
  --container-instances <container-instance-arn> \
  --query 'containerInstances[0].attributes[?name==`ecs.instance-type`]'
```

GPU service quotas must be approved before the instance can launch. Without
GPU capacity the `ollama-service` task stays in `PROVISIONING`/`PENDING`; the
deploy script will time out waiting for it to stabilize. Create the GPU ASG
before the first infrastructure deployment, or set `WAIT_FOR_STABLE=false`.

For CPU-only testing (not recommended for real inference), set
`OLLAMA_GPU_COUNT=0` when running `deploy-infra.sh`; the task definition then
has an empty GPU requirement. You still need EC2 container instances.

---

## 7. Deploy the infrastructure

```bash
source deploy/aws/aws-state.env
export AGENT_S3_BUCKET=allverse-agent-files-123456789012   # optional for this step

# Mirrors images, registers task definitions, creates/updates ECS services
bash deploy/aws/deploy-infra.sh

# Patches the five application task definitions and rolls them out
python3 deploy/aws/deploy_app_services.py
```

What `deploy-infra.sh` does:

- Skips an official image if the requested tag already exists in ECR.
- Builds the LiteLLM wrapper image with a content-hash tag. It only rebuilds
  when `deploy/aws/images/litellm/` or the upstream tag changes.
- Renders task definitions and registers a new revision only if the
  normalized content changed.
- Creates missing ECS services or updates existing ones in place.
- Waits for changed services to stabilize (disable with
  `WAIT_FOR_STABLE=false`).
- Deploys stateful services (`redis`, `mongodb`, `qdrant`, `ollama`) with
  `maximumPercent=100, minimumHealthyPercent=0` so two writers never mount
  the same EFS directory during a rollout. Expect a brief restart.
- Deploys LiteLLM with a normal rolling deployment (`200/100`).

What `deploy_app_services.py` does:

- Reads the current task definition of each application ECS service.
- Merges the production endpoints from `app-env.json` (Redis, MongoDB,
  Qdrant, LiteLLM, Ollama, S3 region/bucket).
- Clears `MINIO_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_KEY` so the agent falls back to the ECS task role.
- Adds `LITELLM_API_KEY`, `GROQ_API_KEY` and `TAVILY_API_KEY` from Secrets
  Manager.
- Sets the agent task role to `ECS_TASK_ROLE_ARN` so it can use S3/EFS.
- Registers a new revision only if it changed, then forces a new deployment
  (preserving the previous workflow behaviour for refreshed `:latest` app
  images).

### Application environment after the rollout

| Service | Variable | Value |
|---|---|---|
| auth, chat, billing | `MONGODB_URI` | `mongodb://mongodb.allverse.local:27017/allverse_ai` |
| auth, chat, billing, gateway | `REDIS_URL` | `redis://redis.allverse.local:6379` |
| agent | `QDRANT_URL` | `http://qdrant.allverse.local:6333` |
| agent | `LITELLM_URL` | `http://litellm.allverse.local:4000` |
| agent | `OLLAMA_HOST` | `http://ollama.allverse.local:11434` |
| agent | `OLLAMA_*_MODEL` | value of `OLLAMA_MODEL` |
| agent | `AWS_BUCKET_NAME` | existing bucket (or unchanged if `AGENT_S3_BUCKET` is empty) |
| agent | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_KEY`, `MINIO_ENDPOINT`, `S3_PUBLIC_ENDPOINT` | empty (task role + real S3) |

The script intentionally does **not** change `AUTH_SERVICE`, `CHAT_SERVICE`,
`GATEWAY_PUBLIC_URL`, CORS or Razorpay variables. If your existing task
definitions still use Docker Compose hostnames such as `http://auth:8001` for
service-to-service calls, update those to your current internal ALB/Cloud Map
endpoints as a separate change.

---

## 8. Pull the Ollama model once

Models live on EFS and are **not** downloaded at container start.

```bash
source deploy/aws/aws-state.env
export OLLAMA_MODEL=llama3.2:3b
bash deploy/aws/pull-ollama-model.sh
```

The script uses SSM `AWS-RunShellScript` on the GPU instance and runs:

```text
docker exec <ollama-container> ollama pull <model>
```

It is idempotent; re-running only downloads missing layers. If you run multiple
GPU instances, set `OLLAMA_EC2_INSTANCE_ID` explicitly to pull through one
instance (the model cache is shared through EFS).

---

## 9. GitHub Actions

`.github/workflows/deploy.yml` now has three jobs:

1. `deploy-infrastructure` — runs `deploy/aws/deploy-infra.sh`.
2. `deploy-backend` — builds/pushes the five application images (unchanged),
   then runs `deploy/aws/deploy_app_services.py`.
3. `deploy-frontend` — builds the Vite bundle, syncs to S3 and invalidates
   CloudFront (unchanged).

`deploy-backend` runs only when `deploy-infrastructure` succeeds or is skipped.
Set the repository variable `SKIP_INFRA_DEPLOY=true` to bypass the
infrastructure job entirely (for example, while you are still bootstrapping).

### Existing repository secrets (keep these)

| Secret | Purpose |
|---|---|
| `AWS_REGION` | AWS region |
| `AWS_ACCOUNT_ID` | AWS account id |
| `AWS_ACCESS_KEY` | Deploy IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Deploy IAM secret key |
| `ECS_CLUSTER` | Existing ECS cluster name |
| `GATEWAY_SERVICE`, `AUTH_SERVICE`, `CHAT_SERVICE`, `AGENT_SERVICE`, `BILLING_SERVICE` | Existing ECS service names |
| `S3_BUCKET` | Frontend static-site bucket |
| `CLOUDFRONT_DISTRIBUTION_ID` | Frontend CDN distribution |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Billing (if used in workflow) |

### New repository variables

Created by `bootstrap.sh`:

| Variable | Source |
|---|---|
| `PRIVATE_SUBNET_IDS` | VPC private subnets |
| `INFRA_SECURITY_GROUP_ID` | `bootstrap.sh` output |
| `EFS_FILE_SYSTEM_ID` | `bootstrap.sh` output |
| `EFS_AP_REDIS`, `EFS_AP_MONGODB`, `EFS_AP_QDRANT`, `EFS_AP_OLLAMA` | `bootstrap.sh` output |
| `ECS_EXECUTION_ROLE_ARN` | `bootstrap.sh` output |
| `ECS_TASK_ROLE_ARN` | `bootstrap.sh` output |
| `LITELLM_SECRET_ARN` | `bootstrap.sh` output |
| `SERVICE_DISCOVERY_REDIS_ARN`, `SERVICE_DISCOVERY_MONGODB_ARN`, `SERVICE_DISCOVERY_QDRANT_ARN`, `SERVICE_DISCOVERY_LITELLM_ARN`, `SERVICE_DISCOVERY_OLLAMA_ARN` | `bootstrap.sh` output |
| `CLOUDMAP_NAMESPACE` | Optional; default `allverse.local` |

Application / optional variables:

| Variable | Purpose |
|---|---|
| `AGENT_S3_BUCKET` | Agent artifact bucket name (S3, not EFS) |
| `GATEWAY_PUBLIC_URL` | Public gateway URL compiled into the frontend |
| `FIREBASE_API_KEY` | Frontend Firebase config |
| `RAZORPAY_KEY_ID` | Frontend checkout config |
| `REDIS_IMAGE_TAG`, `MONGODB_IMAGE_TAG`, `QDRANT_IMAGE_TAG`, `OLLAMA_IMAGE_TAG`, `LITELLM_UPSTREAM_TAG` | Optional pinned image tags |
| `OLLAMA_MODEL` | Model name for LiteLLM and the agent (default `llama3.2:3b`) |
| `OLLAMA_KEEP_ALIVE` | Ollama keep-alive (default `30m`) |
| `OLLAMA_GPU_COUNT` | `1` by default; `0` for CPU testing |
| `OLLAMA_PLACEMENT_EXPRESSION` | ECS placement constraint (default `attribute:ecs.instance-type =~ g[456].*`) |
| `WAIT_FOR_STABLE` | Waits for ECS services to stabilize (default `true`) |
| `SKIP_INFRA_DEPLOY` | Set to `true` to skip the infrastructure job |

> The workflow uses `secrets.AWS_ACCESS_KEY` / `secrets.AWS_SECRET_ACCESS_KEY`
> because that is what the existing workflow already used. Prefer GitHub OIDC
> (`role-to-assume`) if you migrate to it; no code change is required beyond
> the credentials step.

---

## 10. Manual steps that cannot be automated safely

1. **VPC DNS**: enable DNS resolution and DNS hostnames on the VPC. Cloud Map
   private DNS and EFS do not work reliably without them.
2. **NAT / VPC endpoints**: private-subnet tasks must reach ECR, S3,
   CloudWatch Logs, Secrets Manager, EFS, SSM and STS. Create a NAT gateway or
   the corresponding interface/gateway endpoints before the first deployment.
3. **GPU quota**: request a G-instance vCPU quota increase in the target
   region. This is an account-level approval.
4. **VPC/subnet choice**: use the same VPC and private subnets as the existing
   five application services, or add routing/peering so Cloud Map names
   resolve and security-group references work.
5. **App security group**: confirm the SG attached to the app tasks (not the
   ALB) is the one passed to `bootstrap.sh`. If the app tasks use more than
   one SG, add the extra rules manually.
6. **S3 bucket**: create the agent artifact bucket if it does not exist and
   leave Block Public Access enabled. Presigned URLs are used for downloads.
7. **Secrets**: populate provider keys in Secrets Manager. The bootstrap
   script can create the secret, but it cannot obtain your API keys.
8. **GPU model pull**: run `pull-ollama-model.sh` once, and again whenever you
   change `OLLAMA_MODEL`.
9. **Existing app service URLs**: if the existing gateway/agent task
   definitions still point at Docker Compose hostnames for the other app
   services, update those to your internal ALB/Cloud Map endpoints. The patch
   script deliberately leaves them untouched.
10. **EFS performance**: for heavy MongoDB/Redis workloads, review EFS
    throughput mode and consider EC2 + EBS for those two stateful services.
11. **MongoDB/Redis authentication**: the official images are started without
    auth because the current app URIs do not include credentials. Access is
    restricted by security groups only. If you enable auth, update the secret
    and `MONGODB_URI`/`REDIS_URL` in `app-env.json` and for LiteLLM/agent as
    needed.

---

## 11. Local Docker Compose compatibility

The local workflow is unchanged:

```bash
docker compose up -d --build
```

- `docker-compose.yml` was not modified.
- Local service names (`redis`, `mongodb`, `qdrant`, `litellm`, `agent`) still
  work through Docker's internal DNS.
- The agent's S3 client still uses `MINIO_ENDPOINT` and local credentials when
  set, and falls back to the ECS task role when they are empty.
- `deploy/aws/*` scripts are production-only and are not invoked by Compose.

---

## 12. Troubleshooting

| Symptom | Check |
|---|---|
| Task cannot pull the image | NAT gateway or ECR VPC endpoints; task execution role has `AmazonECSTaskExecutionRolePolicy`; ECR repo exists in the same region. |
| EFS mount fails / permission denied | Mount target exists in the task's AZ; SG allows TCP/2049 from `allverse-infra-sg`; access point UID/GID matches the image user; execution/task role has `elasticfilesystem:ClientMount/ClientWrite`. |
| MongoDB or Redis loses data | The container must mount the EFS volume at `/data/db` / `/data`; check the task definition revision actually deployed. |
| `ollama-service` stays PENDING | No EC2 container instances, GPU quota, placement constraint mismatch, or the instance type is not `g4dn/g5/g6`. Check `aws ecs describe-services` events. |
| Ollama returns "model not found" | Run `pull-ollama-model.sh`; check `ollama list` inside the container; confirm `OLLAMA_MODEL` matches LiteLLM's model. |
| LiteLLM returns 401 | `LITELLM_API_KEY` in the agent must equal `LITELLM_MASTER_KEY` in Secrets Manager. The patch script wires both to the same secret key. |
| Cloud Map name does not resolve | VPC has DNS support/hostnames enabled; namespace is associated with the VPC; task is registered in the Cloud Map service; the client task is in the same VPC. |
| App services cannot reach infrastructure | `allverse-infra-sg` must allow the app task SG; app task SG egress must be allowed (usually the default allow-all egress). |
| `deploy-infra.sh` cannot compare task defs | `python3` is required; on Windows use `PYTHON_BIN=python bash deploy/aws/deploy-infra.sh`. |
| GitHub Actions fails on missing variables | Run `bootstrap.sh` and add all printed repository variables; or set `SKIP_INFRA_DEPLOY=true` temporarily. |

---

## 13. Security notes

- Infrastructure ECS services use `assignPublicIp=DISABLED` and private
  subnets. No database, Qdrant, LiteLLM or Ollama port is exposed publicly.
- Security groups only allow the needed internal ports from the application
  security group and from the infrastructure services themselves.
- No AWS credentials are stored in task definitions or the repository. The
  agent uses its ECS task role for S3.
- API keys live in Secrets Manager and are injected with the task definition
  `secrets` block.
- EFS is encrypted at rest; ECR scan-on-push is enabled.
- ECS task definitions use CloudWatch logging with a configurable retention
  period.
- The deploy IAM principal is separate from the runtime task roles.
