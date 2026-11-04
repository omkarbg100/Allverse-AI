#!/usr/bin/env bash
#
# One-time (idempotent) bootstrap of the AWS resources required by the
# Allverse AI ECS deployment.
#
# Creates:
#   - ECR repositories: redis, mongodb, qdrant, litellm, ollama
#   - CloudWatch log groups
#   - EFS file system, mount targets and access points
#   - Security groups for internal services and EFS
#   - IAM roles for ECS task execution and tasks
#   - Secrets Manager secret for LiteLLM / provider API keys
#   - Cloud Map private DNS namespace and services
#
# Usage:
#   cp deploy/aws/aws-state.env.example deploy/aws/aws-state.env   # optional
#   export AWS_REGION=ap-south-1
#   export VPC_ID=vpc-xxxxxxxx
#   export PRIVATE_SUBNET_IDS=subnet-aaa,subnet-bbb
#   export ECS_CLUSTER=allverse-cluster
#   export APP_SECURITY_GROUP_ID=sg-xxxxxxxx   # SG used by the 5 app services
#   bash deploy/aws/bootstrap.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="${PROJECT_NAME:-allverse}"
AWS_REGION="${AWS_REGION:?AWS_REGION is required}"
VPC_ID="${VPC_ID:?VPC_ID is required}"
PRIVATE_SUBNET_IDS="${PRIVATE_SUBNET_IDS:?PRIVATE_SUBNET_IDS is required (comma separated)}"
ECS_CLUSTER="${ECS_CLUSTER:?ECS_CLUSTER is required}"
APP_SECURITY_GROUP_ID="${APP_SECURITY_GROUP_ID:-}"
S3_BUCKET_NAME="${S3_BUCKET_NAME:-}"
CLOUDMAP_NAMESPACE="${CLOUDMAP_NAMESPACE:-allverse.local}"
LITELLM_SECRET_NAME="${LITELLM_SECRET_NAME:-${PROJECT_NAME}/litellm}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-30}"
STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/aws-state.env}"

export AWS_REGION

# On Git Bash/Cygwin, aws.exe emits CRLF which breaks shell comparisons.
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  aws() { command aws "$@" | tr -d ''; }
fi

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }

AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
if [[ -z "$AWS_ACCOUNT_ID" || "$AWS_ACCOUNT_ID" == "None" ]]; then
  echo "Unable to resolve AWS account id (set AWS_ACCOUNT_ID)." >&2
  exit 1
fi

SUBNETS_CSV="$(printf '%s' "$PRIVATE_SUBNET_IDS" | tr -d ' ')"
if [[ -z "$SUBNETS_CSV" ]]; then
  echo "PRIVATE_SUBNET_IDS must not be empty." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------------------
# ECR repositories
# ---------------------------------------------------------------------------
log "ECR repositories"
for repo in redis mongodb qdrant litellm ollama; do
  if aws ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
    echo "  exists: $repo"
  else
    aws ecr create-repository \
      --repository-name "$repo" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 >/dev/null
    echo "  created: $repo"
  fi
done

# ---------------------------------------------------------------------------
# CloudWatch log groups
# ---------------------------------------------------------------------------
log "CloudWatch log groups"
for service in redis mongodb qdrant litellm ollama; do
  group="/ecs/${PROJECT_NAME}-${service}"
  if aws logs describe-log-groups --log-group-name-prefix "$group" \
    --query "logGroups[?logGroupName=='${group}'].logGroupName | [0]" \
    --output text 2>/dev/null | grep -qx "$group"; then
    echo "  exists: $group"
  else
    aws logs create-log-group --log-group-name "$group"
    echo "  created: $group"
  fi
  aws logs put-retention-policy \
    --log-group-name "$group" \
    --retention-in-days "$LOG_RETENTION_DAYS" >/dev/null 2>&1 || true
done

# ---------------------------------------------------------------------------
# Security groups
# ---------------------------------------------------------------------------
log "Security groups"
find_sg() {
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true
}

create_sg() {
  local name="$1" description="$2"
  local existing
  existing="$(find_sg "$name")"
  if [[ -n "$existing" && "$existing" != "None" ]]; then
    printf '%s' "$existing"
    return
  fi
  aws ec2 create-security-group \
    --group-name "$name" \
    --description "$description" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=$name},{Key=Project,Value=$PROJECT_NAME}]" \
    --query 'GroupId' \
    --output text
}

add_ingress() {
  local group_id="$1" port="$2" source_sg="$3"
  local output
  if ! output="$(aws ec2 authorize-security-group-ingress \
    --group-id "$group_id" \
    --protocol tcp \
    --port "$port" \
    --source-group "$source_sg" 2>&1)"; then
    if [[ "$output" != *"InvalidPermission.Duplicate"* ]]; then
      printf '%s\n' "$output" >&2
      return 1
    fi
  fi
}

INFRA_SG_ID="$(create_sg "${PROJECT_NAME}-infra-sg" "Allverse AI internal services")"
EFS_SG_ID="$(create_sg "${PROJECT_NAME}-efs-sg" "Allverse AI EFS mount targets")"
echo "  infra: $INFRA_SG_ID"
echo "  efs:   $EFS_SG_ID"

INFRA_PORTS="27017 6379 6333 6334 4000 11434"
for port in $INFRA_PORTS; do
  add_ingress "$INFRA_SG_ID" "$port" "$INFRA_SG_ID"
  if [[ -n "$APP_SECURITY_GROUP_ID" ]]; then
    add_ingress "$INFRA_SG_ID" "$port" "$APP_SECURITY_GROUP_ID"
  fi
done

if [[ -n "$APP_SECURITY_GROUP_ID" ]]; then
  add_ingress "$EFS_SG_ID" 2049 "$APP_SECURITY_GROUP_ID"
else
  warn "APP_SECURITY_GROUP_ID not set; remember to allow NFS/2049 from the application security group to $EFS_SG_ID and the service ports from that group to $INFRA_SG_ID."
fi
add_ingress "$EFS_SG_ID" 2049 "$INFRA_SG_ID"

# ---------------------------------------------------------------------------
# EFS
# ---------------------------------------------------------------------------
log "EFS"
EFS_ID="$(aws efs describe-file-systems \
  --creation-token "${PROJECT_NAME}-efs" \
  --query 'FileSystems[0].FileSystemId' \
  --output text 2>/dev/null || true)"

if [[ -z "$EFS_ID" || "$EFS_ID" == "None" ]]; then
  EFS_ID="$(aws efs create-file-system \
    --creation-token "${PROJECT_NAME}-efs" \
    --encrypted \
    --performance-mode generalPurpose \
    --throughput-mode "${EFS_THROUGHPUT_MODE:-bursting}" \
    --tags "Key=Name,Value=${PROJECT_NAME}-efs" "Key=Project,Value=$PROJECT_NAME" \
    --query 'FileSystemId' \
    --output text)"
  echo "  created: $EFS_ID"
else
  echo "  exists: $EFS_ID"
fi

for subnet in ${SUBNETS_CSV//,/ }; do
  target="$(aws efs describe-mount-targets \
    --file-system-id "$EFS_ID" \
    --query "MountTargets[?SubnetId=='${subnet}'].MountTargetId | [0]" \
    --output text 2>/dev/null || true)"
  if [[ -z "$target" || "$target" == "None" ]]; then
    aws efs create-mount-target \
      --file-system-id "$EFS_ID" \
      --subnet-id "$subnet" \
      --security-groups "$EFS_SG_ID" >/dev/null
    echo "  mount target created in $subnet"
  else
    echo "  mount target exists in $subnet"
  fi
done

create_access_point() {
  local name="$1" path="$2" uid="$3" gid="$4" permissions="$5"
  local tag_name="${PROJECT_NAME}-efs-${name}"
  local access_point
  access_point="$(aws efs describe-access-points \
    --file-system-id "$EFS_ID" \
    --query "AccessPoints[?Tags[?Key=='Name' && Value=='${tag_name}']].AccessPointId | [0]" \
    --output text 2>/dev/null || true)"
  if [[ -z "$access_point" || "$access_point" == "None" ]]; then
    access_point="$(aws efs create-access-point \
      --file-system-id "$EFS_ID" \
      --posix-user "Uid=${uid},Gid=${gid}" \
      --root-directory "Path=${path},CreationInfo={OwnerUid=${uid},OwnerGid=${gid},Permissions=${permissions}}" \
      --tags "Key=Name,Value=${tag_name}" "Key=Project,Value=$PROJECT_NAME" \
      --query 'AccessPointId' \
      --output text)"
    echo "  access point created: $name ($access_point)" >&2
  else
    echo "  access point exists: $name ($access_point)" >&2
  fi
  printf '%s' "$access_point"
}

EFS_AP_MONGODB="$(create_access_point mongodb /mongodb 999 999 0755)"
EFS_AP_REDIS="$(create_access_point redis /redis 999 999 0755)"
EFS_AP_QDRANT="$(create_access_point qdrant /qdrant 1000 1000 0755)"
EFS_AP_OLLAMA="$(create_access_point ollama /ollama 0 0 0755)"

# ---------------------------------------------------------------------------
# IAM roles
# ---------------------------------------------------------------------------
log "IAM roles"
cat > "$TMP_DIR/ecs-trust.json" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

EFS_ARN="arn:aws:elasticfilesystem:${AWS_REGION}:${AWS_ACCOUNT_ID}:file-system/${EFS_ID}"
EFS_ACCESS_POINT_ARN="arn:aws:elasticfilesystem:${AWS_REGION}:${AWS_ACCOUNT_ID}:access-point/*"
SECRETS_ARN="arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}/*"

cat > "$TMP_DIR/execution-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite",
        "elasticfilesystem:ClientRootAccess",
        "elasticfilesystem:DescribeMountTargets",
        "elasticfilesystem:DescribeFileSystems"
      ],
      "Resource": ["${EFS_ARN}", "${EFS_ACCESS_POINT_ARN}"]
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "${SECRETS_ARN}"
    }
  ]
}
JSON

cat > "$TMP_DIR/task-policy.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "elasticfilesystem:ClientMount",
        "elasticfilesystem:ClientWrite",
        "elasticfilesystem:ClientRootAccess",
        "elasticfilesystem:DescribeMountTargets",
        "elasticfilesystem:DescribeFileSystems"
      ],
      "Resource": ["${EFS_ARN}", "${EFS_ACCESS_POINT_ARN}"]
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "${SECRETS_ARN}"
    }
  ]
}
JSON

if [[ -n "$S3_BUCKET_NAME" ]]; then
  python3 - "$TMP_DIR/task-policy.json" "$S3_BUCKET_NAME" <<'PY'
import json
import sys

path, bucket = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as handle:
    policy = json.load(handle)
policy["Statement"].append(
    {
        "Effect": "Allow",
        "Action": [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
        ],
        "Resource": f"arn:aws:s3:::{bucket}/*",
    }
)
policy["Statement"].append(
    {
        "Effect": "Allow",
        "Action": ["s3:ListBucket"],
        "Resource": f"arn:aws:s3:::{bucket}",
    }
)
with open(path, "w", encoding="utf-8") as handle:
    json.dump(policy, handle, indent=2)
PY
else
  warn "S3_BUCKET_NAME not set; the task role will not have S3 access. Re-run with S3_BUCKET_NAME set after creating the agent bucket."
fi

create_role() {
  local role_name="$1" trust_file="$2"
  local arn
  arn="$(aws iam get-role --role-name "$role_name" --query 'Role.Arn' --output text 2>/dev/null || true)"
  if [[ -z "$arn" || "$arn" == "None" ]]; then
    arn="$(aws iam create-role \
      --role-name "$role_name" \
      --assume-role-policy-document "file://${trust_file}" \
      --query 'Role.Arn' \
      --output text)"
    echo "  created role: $role_name" >&2
  else
    echo "  exists role: $role_name" >&2
  fi
  printf '%s' "$arn"
}

EXEC_ROLE_NAME="${PROJECT_NAME}-ecs-task-execution"
TASK_ROLE_NAME="${PROJECT_NAME}-task-role"
EXEC_ROLE_ARN="$(create_role "$EXEC_ROLE_NAME" "$TMP_DIR/ecs-trust.json")"
TASK_ROLE_ARN="$(create_role "$TASK_ROLE_NAME" "$TMP_DIR/ecs-trust.json")"

aws iam attach-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null 2>&1 || true
aws iam put-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-name "${PROJECT_NAME}-efs-secrets" \
  --policy-document "file://${TMP_DIR}/execution-policy.json"
aws iam put-role-policy \
  --role-name "$TASK_ROLE_NAME" \
  --policy-name "${PROJECT_NAME}-task-policy" \
  --policy-document "file://${TMP_DIR}/task-policy.json"

# ---------------------------------------------------------------------------
# Secrets Manager
# ---------------------------------------------------------------------------
log "Secrets Manager"
SECRET_ARN="$(aws secretsmanager describe-secret \
  --secret-id "$LITELLM_SECRET_NAME" \
  --query 'ARN' \
  --output text 2>/dev/null || true)"

if [[ -z "$SECRET_ARN" || "$SECRET_ARN" == "None" ]]; then
  MASTER_KEY="sk-$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
  python3 - "$LITELLM_SECRET_NAME" "$MASTER_KEY" > "$TMP_DIR/secret.json" <<'PY'
import json
import sys

name, master_key = sys.argv[1], sys.argv[2]
print(json.dumps({
    "Name": name,
    "Description": "Allverse AI LiteLLM master key and provider API keys",
    "SecretString": json.dumps({
        "LITELLM_MASTER_KEY": master_key,
        "GROQ_API_KEY": "",
        "OPENAI_API_KEY": "",
        "ANTHROPIC_API_KEY": "",
        "TAVILY_API_KEY": "",
    }),
}))
PY
  SECRET_ARN="$(aws secretsmanager create-secret \
    --cli-input-json "file://${TMP_DIR}/secret.json" \
    --query 'ARN' \
    --output text)"
  echo "  created: $SECRET_ARN"
  echo "  Populate GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / TAVILY_API_KEY with:"
  echo "    aws secretsmanager put-secret-value --secret-id $LITELLM_SECRET_NAME --secret-string file://secrets.json"
else
  echo "  exists: $SECRET_ARN"
fi

# ---------------------------------------------------------------------------
# Cloud Map private DNS namespace
# ---------------------------------------------------------------------------
log "Cloud Map namespace ${CLOUDMAP_NAMESPACE}"
NAMESPACE_ID="$(aws servicediscovery list-namespaces \
  --query "Namespaces[?Name=='${CLOUDMAP_NAMESPACE}'].Id | [0]" \
  --output text 2>/dev/null || true)"

if [[ -z "$NAMESPACE_ID" || "$NAMESPACE_ID" == "None" ]]; then
  aws servicediscovery create-private-dns-namespace \
    --name "$CLOUDMAP_NAMESPACE" \
    --vpc "$VPC_ID" >/dev/null
  for _ in $(seq 1 30); do
    NAMESPACE_ID="$(aws servicediscovery list-namespaces \
      --query "Namespaces[?Name=='${CLOUDMAP_NAMESPACE}'].Id | [0]" \
      --output text 2>/dev/null || true)"
    if [[ -n "$NAMESPACE_ID" && "$NAMESPACE_ID" != "None" ]]; then
      break
    fi
    sleep 5
  done
  echo "  created: $NAMESPACE_ID"
else
  echo "  exists: $NAMESPACE_ID"
fi

if [[ -z "$NAMESPACE_ID" || "$NAMESPACE_ID" == "None" ]]; then
  echo "Cloud Map namespace was not created; check permissions and retry." >&2
  exit 1
fi

create_cloudmap_service() {
  local name="$1"
  local service_id
  service_id="$(aws servicediscovery list-services \
    --filters "Name=NAMESPACE_ID,Values=${NAMESPACE_ID},Condition=EQ" \
    --query "Services[?Name=='${name}'].Id | [0]" \
    --output text 2>/dev/null || true)"
  if [[ -z "$service_id" || "$service_id" == "None" ]]; then
    service_id="$(aws servicediscovery create-service \
      --name "$name" \
      --namespace-id "$NAMESPACE_ID" \
      --dns-config '{"RoutingPolicy":"MULTIVALUE","DnsRecords":[{"Type":"A","TTL":10}]}' \
      --query 'Service.Id' \
      --output text)"
    echo "  created service: $name" >&2
  else
    echo "  exists service: $name" >&2
  fi
  aws servicediscovery get-service \
    --id "$service_id" \
    --query 'Service.Arn' \
    --output text
}

CM_REDIS_ARN="$(create_cloudmap_service redis)"
CM_MONGODB_ARN="$(create_cloudmap_service mongodb)"
CM_QDRANT_ARN="$(create_cloudmap_service qdrant)"
CM_LITELLM_ARN="$(create_cloudmap_service litellm)"
CM_OLLAMA_ARN="$(create_cloudmap_service ollama)"

# ---------------------------------------------------------------------------
# Summary / state file
# ---------------------------------------------------------------------------
log "Writing $STATE_FILE"
cat > "$STATE_FILE" <<EOF
# Generated by deploy/aws/bootstrap.sh. Do not commit this file.
AWS_REGION=${AWS_REGION}
AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID}
ECS_CLUSTER=${ECS_CLUSTER}
VPC_ID=${VPC_ID}
PRIVATE_SUBNET_IDS=${SUBNETS_CSV}
APP_SECURITY_GROUP_ID=${APP_SECURITY_GROUP_ID}
INFRA_SECURITY_GROUP_ID=${INFRA_SG_ID}
EFS_SECURITY_GROUP_ID=${EFS_SG_ID}
EFS_FILE_SYSTEM_ID=${EFS_ID}
EFS_AP_MONGODB=${EFS_AP_MONGODB}
EFS_AP_REDIS=${EFS_AP_REDIS}
EFS_AP_QDRANT=${EFS_AP_QDRANT}
EFS_AP_OLLAMA=${EFS_AP_OLLAMA}
ECS_EXECUTION_ROLE_ARN=${EXEC_ROLE_ARN}
ECS_TASK_ROLE_ARN=${TASK_ROLE_ARN}
LITELLM_SECRET_ARN=${SECRET_ARN}
CLOUDMAP_NAMESPACE=${CLOUDMAP_NAMESPACE}
CLOUDMAP_NAMESPACE_ID=${NAMESPACE_ID}
SERVICE_DISCOVERY_REDIS_ARN=${CM_REDIS_ARN}
SERVICE_DISCOVERY_MONGODB_ARN=${CM_MONGODB_ARN}
SERVICE_DISCOVERY_QDRANT_ARN=${CM_QDRANT_ARN}
SERVICE_DISCOVERY_LITELLM_ARN=${CM_LITELLM_ARN}
SERVICE_DISCOVERY_OLLAMA_ARN=${CM_OLLAMA_ARN}
EOF

cat <<EOF

Bootstrap complete.

State file: ${STATE_FILE}

Add these as GitHub Actions repository variables (Settings -> Secrets and variables -> Actions -> Variables):

  PRIVATE_SUBNET_IDS=${SUBNETS_CSV}
  INFRA_SECURITY_GROUP_ID=${INFRA_SG_ID}
  EFS_FILE_SYSTEM_ID=${EFS_ID}
  EFS_AP_MONGODB=${EFS_AP_MONGODB}
  EFS_AP_REDIS=${EFS_AP_REDIS}
  EFS_AP_QDRANT=${EFS_AP_QDRANT}
  EFS_AP_OLLAMA=${EFS_AP_OLLAMA}
  ECS_EXECUTION_ROLE_ARN=${EXEC_ROLE_ARN}
  ECS_TASK_ROLE_ARN=${TASK_ROLE_ARN}
  LITELLM_SECRET_ARN=${SECRET_ARN}
  SERVICE_DISCOVERY_REDIS_ARN=${CM_REDIS_ARN}
  SERVICE_DISCOVERY_MONGODB_ARN=${CM_MONGODB_ARN}
  SERVICE_DISCOVERY_QDRANT_ARN=${CM_QDRANT_ARN}
  SERVICE_DISCOVERY_LITELLM_ARN=${CM_LITELLM_ARN}
  SERVICE_DISCOVERY_OLLAMA_ARN=${CM_OLLAMA_ARN}

Next steps:
  1. Populate provider keys in ${LITELLM_SECRET_NAME}.
  2. Create the GPU capacity for Ollama: bash deploy/aws/gpu-capacity.sh
  3. Pull the Ollama model once: bash deploy/aws/pull-ollama-model.sh
  4. Deploy: bash deploy/aws/deploy-infra.sh && python3 deploy/aws/deploy_app_services.py

EOF
