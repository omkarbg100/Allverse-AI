#!/usr/bin/env bash
#
# Create the GPU-backed EC2 capacity used by the Ollama ECS service.
#
# Fargate does not expose GPUs. This script creates:
#   - a security group for the GPU instances
#   - an ECS container instance IAM role/profile (plus SSM for model pulls)
#   - a launch template based on the ECS-optimized GPU AMI
#   - an Auto Scaling group that registers the instance into ECS_CLUSTER
#
# Usage:
#   source deploy/aws/aws-state.env
#   export GPU_SUBNET_IDS=subnet-aaa,subnet-bbb   # optional, defaults to PRIVATE_SUBNET_IDS
#   bash deploy/aws/gpu-capacity.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="${PROJECT_NAME:-allverse}"

STATE_FILE="${STATE_FILE:-${SCRIPT_DIR}/aws-state.env}"
if [[ -f "$STATE_FILE" ]]; then
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    if [[ -z "${!key:-}" ]]; then
      export "$key=$value"
    fi
  done < <(grep -vE '^[[:space:]]*(#|$)' "$STATE_FILE")
fi

AWS_REGION="${AWS_REGION:?AWS_REGION is required}"
ECS_CLUSTER="${ECS_CLUSTER:?ECS_CLUSTER is required}"
VPC_ID="${VPC_ID:?VPC_ID is required}"
GPU_SUBNET_IDS="${GPU_SUBNET_IDS:-${PRIVATE_SUBNET_IDS:?GPU_SUBNET_IDS or PRIVATE_SUBNET_IDS is required}}"
INFRA_SECURITY_GROUP_ID="${INFRA_SECURITY_GROUP_ID:?INFRA_SECURITY_GROUP_ID is required}"
APP_SECURITY_GROUP_ID="${APP_SECURITY_GROUP_ID:-}"
EFS_SECURITY_GROUP_ID="${EFS_SECURITY_GROUP_ID:-}"

GPU_INSTANCE_TYPE="${GPU_INSTANCE_TYPE:-g4dn.xlarge}"
GPU_MIN_SIZE="${GPU_MIN_SIZE:-1}"
GPU_MAX_SIZE="${GPU_MAX_SIZE:-2}"
GPU_DESIRED_CAPACITY="${GPU_DESIRED_CAPACITY:-1}"
GPU_AMI_SSM_PARAM="${GPU_AMI_SSM_PARAM:-/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id}"

export AWS_REGION

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }

SUBNETS_CSV="$(printf '%s' "$GPU_SUBNET_IDS" | tr -d ' ')"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# ---------------------------------------------------------------------------
# Security groups
# ---------------------------------------------------------------------------
log "GPU security group"
find_sg() {
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true
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

GPU_SG_ID="$(find_sg "${PROJECT_NAME}-gpu-sg")"
if [[ -z "$GPU_SG_ID" || "$GPU_SG_ID" == "None" ]]; then
  GPU_SG_ID="$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-gpu-sg" \
    --description "Allverse AI Ollama GPU instances" \
    --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Name,Value=${PROJECT_NAME}-gpu-sg},{Key=Project,Value=$PROJECT_NAME}]" \
    --query 'GroupId' \
    --output text)"
  echo "  created: $GPU_SG_ID"
else
  echo "  exists: $GPU_SG_ID"
fi

add_ingress "$GPU_SG_ID" 11434 "$INFRA_SECURITY_GROUP_ID"
if [[ -n "$APP_SECURITY_GROUP_ID" ]]; then
  add_ingress "$GPU_SG_ID" 11434 "$APP_SECURITY_GROUP_ID"
else
  warn "APP_SECURITY_GROUP_ID not set; allow TCP/11434 from the agent service security group to $GPU_SG_ID."
fi

if [[ -n "$EFS_SECURITY_GROUP_ID" ]]; then
  add_ingress "$EFS_SECURITY_GROUP_ID" 2049 "$GPU_SG_ID"
else
  warn "EFS_SECURITY_GROUP_ID not set; allow NFS/2049 from $GPU_SG_ID to the EFS mount target security group."
fi

# ---------------------------------------------------------------------------
# IAM instance role
# ---------------------------------------------------------------------------
log "EC2 instance role"
ROLE_NAME="${PROJECT_NAME}-ecs-instance-role"
PROFILE_NAME="${PROJECT_NAME}-ecs-instance-profile"

cat > "$TMP_DIR/ec2-trust.json" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

ROLE_ARN="$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || true)"
if [[ -z "$ROLE_ARN" || "$ROLE_ARN" == "None" ]]; then
  ROLE_ARN="$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "file://${TMP_DIR}/ec2-trust.json" \
    --query 'Role.Arn' \
    --output text)"
  echo "  created role: $ROLE_NAME"
else
  echo "  exists role: $ROLE_NAME"
fi

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role >/dev/null 2>&1 || true
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore >/dev/null 2>&1 || true

if ! aws iam get-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$PROFILE_NAME" >/dev/null
  echo "  created instance profile: $PROFILE_NAME"
fi
if ! aws iam get-instance-profile \
  --instance-profile-name "$PROFILE_NAME" \
  --query "InstanceProfile.Roles[?RoleName=='${ROLE_NAME}'].RoleName | [0]" \
  --output text 2>/dev/null | grep -qx "$ROLE_NAME"; then
  aws iam add-role-to-instance-profile \
    --instance-profile-name "$PROFILE_NAME" \
    --role-name "$ROLE_NAME" >/dev/null
  echo "  added $ROLE_NAME to $PROFILE_NAME"
fi

# ---------------------------------------------------------------------------
# AMI
# ---------------------------------------------------------------------------
log "ECS-optimized GPU AMI"
AMI_ID="$(aws ssm get-parameter \
  --name "$GPU_AMI_SSM_PARAM" \
  --query 'Parameter.Value' \
  --output text | python -c 'import json,sys; print(json.load(sys.stdin)["image_id"])')"
echo "  $AMI_ID ($GPU_AMI_SSM_PARAM)"

# ---------------------------------------------------------------------------
# Launch template
# ---------------------------------------------------------------------------
log "Launch template"
LAUNCH_TEMPLATE_NAME="${PROJECT_NAME}-ollama-gpu"

USER_DATA="$(cat <<EOF
#!/bin/bash
cat >> /etc/ecs/ecs.config <<'ECS'
ECS_CLUSTER=${ECS_CLUSTER}
ECS_ENABLE_GPU_SUPPORT=true
ECS_ENABLE_CONTAINER_METADATA=true
ECS
systemctl restart ecs
EOF
)"
USER_DATA_B64="$(printf '%s' "$USER_DATA" | base64 | tr -d '\r\n')"

python - "$TMP_DIR/launch-template.json" "$AMI_ID" "$GPU_INSTANCE_TYPE" "$PROFILE_NAME" "$GPU_SG_ID" "$USER_DATA_B64" "$PROJECT_NAME" <<'PY'
import json
import sys

path, ami, instance_type, profile, sg, user_data, project = sys.argv[1:8]
payload = {
    "ImageId": ami,
    "InstanceType": instance_type,
    "IamInstanceProfile": {"Name": profile},
    "SecurityGroupIds": [sg],
    "UserData": user_data,
    "MetadataOptions": {
        "HttpEndpoint": "enabled",
        "HttpTokens": "required",
    },
    "TagSpecifications": [
        {
            "ResourceType": "instance",
            "Tags": [
                {"Key": "Name", "Value": f"{project}-ollama-gpu"},
                {"Key": "Project", "Value": project},
            ],
        }
    ],
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
PY

if aws ec2 describe-launch-templates \
  --launch-template-names "$LAUNCH_TEMPLATE_NAME" >/dev/null 2>&1; then
  VERSION="$(aws ec2 create-launch-template-version \
    --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
    --source-version '$Latest' \
    --launch-template-data "file://${TMP_DIR}/launch-template.json" \
    --query 'LaunchTemplateVersion.VersionNumber' \
    --output text)"
  aws ec2 modify-launch-template \
    --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
    --default-version "$VERSION" >/dev/null
  echo "  new version: $VERSION"
else
  VERSION="$(aws ec2 create-launch-template \
    --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
    --launch-template-data "file://${TMP_DIR}/launch-template.json" \
    --query 'LaunchTemplate.LatestVersionNumber' \
    --output text)"
  echo "  created: $LAUNCH_TEMPLATE_NAME (version $VERSION)"
fi

# ---------------------------------------------------------------------------
# Auto Scaling group
# ---------------------------------------------------------------------------
log "Auto Scaling group"
ASG_NAME="${PROJECT_NAME}-ollama-gpu"

if aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names "$ASG_NAME" \
  --query 'AutoScalingGroups[0].AutoScalingGroupName' \
  --output text 2>/dev/null | grep -qx "$ASG_NAME"; then

  aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$ASG_NAME" \
    --launch-template "LaunchTemplateName=${LAUNCH_TEMPLATE_NAME},Version=\$Latest" \
    --min-size "$GPU_MIN_SIZE" \
    --max-size "$GPU_MAX_SIZE" \
    --vpc-zone-identifier "$SUBNETS_CSV" >/dev/null
  aws autoscaling set-desired-capacity \
    --auto-scaling-group-name "$ASG_NAME" \
    --desired-capacity "$GPU_DESIRED_CAPACITY" >/dev/null
  echo "  updated: $ASG_NAME"
else
  aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name "$ASG_NAME" \
    --launch-template "LaunchTemplateName=${LAUNCH_TEMPLATE_NAME},Version=\$Latest" \
    --min-size "$GPU_MIN_SIZE" \
    --max-size "$GPU_MAX_SIZE" \
    --desired-capacity "$GPU_DESIRED_CAPACITY" \
    --vpc-zone-identifier "$SUBNETS_CSV" \
    --new-instances-protected-from-scale-in \
    --tags "Key=Name,Value=${ASG_NAME},PropagateAtLaunch=true" "Key=Project,Value=${PROJECT_NAME},PropagateAtLaunch=true" >/dev/null
  echo "  created: $ASG_NAME"
fi

cat <<EOF

GPU capacity requested.

  instance type : ${GPU_INSTANCE_TYPE}
  AMI           : ${AMI_ID}
  launch tpl    : ${LAUNCH_TEMPLATE_NAME}
  ASG           : ${ASG_NAME} (min ${GPU_MIN_SIZE}, max ${GPU_MAX_SIZE}, desired ${GPU_DESIRED_CAPACITY})
  security group: ${GPU_SG_ID}

The instance registers itself into ECS cluster ${ECS_CLUSTER}. Verify with:

  aws ecs list-container-instances --cluster ${ECS_CLUSTER}
  aws ecs describe-container-instances --cluster ${ECS_CLUSTER} \\
    --container-instances <arn> \\
    --query 'containerInstances[0].attributes[?name==\`ecs.instance-type\`]'

Then pull the model once:

  source deploy/aws/aws-state.env
  bash deploy/aws/pull-ollama-model.sh

Request a GPU service quota increase first if the instance launch fails with
a vCPU or G-instance quota error.
EOF
