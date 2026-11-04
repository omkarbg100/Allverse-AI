#!/usr/bin/env bash
#
# Deploy the Allverse AI infrastructure services to ECS.
#
# Services:
#   redis-service     Fargate + EFS
#   mongodb-service   Fargate + EFS
#   qdrant-service    Fargate + EFS
#   litellm-service   Fargate
#   ollama-service    EC2 (GPU) + EFS
#
# The script is idempotent:
#   - official images are only pulled/pushed when the requested tag is absent
#   - the LiteLLM wrapper image is tagged with a content hash
#   - task definitions are only registered when their content changed
#   - ECS services are created when missing, otherwise updated in place
#
# Usage:
#   source deploy/aws/aws-state.env   # or export the variables yourself
#   bash deploy/aws/deploy-infra.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="${PROJECT_NAME:-allverse}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

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
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:?AWS_ACCOUNT_ID is required}"
ECS_CLUSTER="${ECS_CLUSTER:?ECS_CLUSTER is required}"
PRIVATE_SUBNET_IDS="${PRIVATE_SUBNET_IDS:?PRIVATE_SUBNET_IDS is required}"
INFRA_SECURITY_GROUP_ID="${INFRA_SECURITY_GROUP_ID:?INFRA_SECURITY_GROUP_ID is required}"
EFS_FILE_SYSTEM_ID="${EFS_FILE_SYSTEM_ID:?EFS_FILE_SYSTEM_ID is required}"
EFS_AP_REDIS="${EFS_AP_REDIS:?EFS_AP_REDIS is required}"
EFS_AP_MONGODB="${EFS_AP_MONGODB:?EFS_AP_MONGODB is required}"
EFS_AP_QDRANT="${EFS_AP_QDRANT:?EFS_AP_QDRANT is required}"
EFS_AP_OLLAMA="${EFS_AP_OLLAMA:?EFS_AP_OLLAMA is required}"
EXECUTION_ROLE_ARN="${ECS_EXECUTION_ROLE_ARN:?ECS_EXECUTION_ROLE_ARN is required}"
TASK_ROLE_ARN="${ECS_TASK_ROLE_ARN:?ECS_TASK_ROLE_ARN is required}"
LITELLM_SECRET_ARN="${LITELLM_SECRET_ARN:?LITELLM_SECRET_ARN is required}"
SERVICE_DISCOVERY_REDIS_ARN="${SERVICE_DISCOVERY_REDIS_ARN:?SERVICE_DISCOVERY_REDIS_ARN is required}"
SERVICE_DISCOVERY_MONGODB_ARN="${SERVICE_DISCOVERY_MONGODB_ARN:?SERVICE_DISCOVERY_MONGODB_ARN is required}"
SERVICE_DISCOVERY_QDRANT_ARN="${SERVICE_DISCOVERY_QDRANT_ARN:?SERVICE_DISCOVERY_QDRANT_ARN is required}"
SERVICE_DISCOVERY_LITELLM_ARN="${SERVICE_DISCOVERY_LITELLM_ARN:?SERVICE_DISCOVERY_LITELLM_ARN is required}"
SERVICE_DISCOVERY_OLLAMA_ARN="${SERVICE_DISCOVERY_OLLAMA_ARN:?SERVICE_DISCOVERY_OLLAMA_ARN is required}"

CLOUDMAP_NAMESPACE="${CLOUDMAP_NAMESPACE:-allverse.local}"
REDIS_SERVICE="${REDIS_SERVICE:-redis-service}"
MONGODB_SERVICE="${MONGODB_SERVICE:-mongodb-service}"
QDRANT_SERVICE="${QDRANT_SERVICE:-qdrant-service}"
LITELLM_SERVICE="${LITELLM_SERVICE:-litellm-service}"
OLLAMA_SERVICE="${OLLAMA_SERVICE:-ollama-service}"

REDIS_IMAGE_TAG="${REDIS_IMAGE_TAG:-7}"
MONGODB_IMAGE_TAG="${MONGODB_IMAGE_TAG:-7}"
QDRANT_IMAGE_TAG="${QDRANT_IMAGE_TAG:-latest}"
OLLAMA_IMAGE_TAG="${OLLAMA_IMAGE_TAG:-latest}"
LITELLM_UPSTREAM_TAG="${LITELLM_UPSTREAM_TAG:-main-latest}"

OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
OLLAMA_KEEP_ALIVE="${OLLAMA_KEEP_ALIVE:-30m}"
OLLAMA_GPU_COUNT="${OLLAMA_GPU_COUNT:-1}"
if (( OLLAMA_GPU_COUNT > 0 )); then
  OLLAMA_RESOURCE_REQUIREMENTS="[{\"type\":\"GPU\",\"value\":\"${OLLAMA_GPU_COUNT}\"}]"
else
  OLLAMA_RESOURCE_REQUIREMENTS="[]"
fi
OLLAMA_PLACEMENT_EXPRESSION="${OLLAMA_PLACEMENT_EXPRESSION-attribute:ecs.instance-type =~ g[456].*}"

WAIT_FOR_STABLE="${WAIT_FOR_STABLE:-true}"
FORCE_IMAGE_PULL="${FORCE_IMAGE_PULL:-false}"

export AWS_REGION AWS_ACCOUNT_ID

# On Git Bash/Cygwin, aws.exe emits CRLF which breaks shell comparisons.
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  aws() { command aws "$@" | tr -d '\r'; }
fi
export EXECUTION_ROLE_ARN TASK_ROLE_ARN
export EFS_FILE_SYSTEM_ID EFS_AP_REDIS EFS_AP_MONGODB EFS_AP_QDRANT EFS_AP_OLLAMA
export OLLAMA_MODEL OLLAMA_KEEP_ALIVE OLLAMA_RESOURCE_REQUIREMENTS
export OLLAMA_API_BASE="http://ollama.${CLOUDMAP_NAMESPACE}:11434"
export LOG_GROUP_REDIS="/ecs/${PROJECT_NAME}-redis"
export LOG_GROUP_MONGODB="/ecs/${PROJECT_NAME}-mongodb"
export LOG_GROUP_QDRANT="/ecs/${PROJECT_NAME}-qdrant"
export LOG_GROUP_LITELLM="/ecs/${PROJECT_NAME}-litellm"
export LOG_GROUP_OLLAMA="/ecs/${PROJECT_NAME}-ollama"
export SECRET_LITELLM_MASTER_KEY="${LITELLM_SECRET_ARN}:LITELLM_MASTER_KEY::"
export SECRET_GROQ_API_KEY="${LITELLM_SECRET_ARN}:GROQ_API_KEY::"
export SECRET_OPENAI_API_KEY="${LITELLM_SECRET_ARN}:OPENAI_API_KEY::"
export SECRET_ANTHROPIC_API_KEY="${LITELLM_SECRET_ARN}:ANTHROPIC_API_KEY::"

ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
SUBNETS_CSV="$(printf '%s' "$PRIVATE_SUBNET_IDS" | tr -d ' ')"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() { printf '\n==> %s\n' "$*"; }

ensure_repo() {
  if ! aws ecr describe-repositories --repository-names "$1" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws ecr create-repository \
      --repository-name "$1" \
      --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 \
      --region "$AWS_REGION" >/dev/null
  fi
}

image_exists() {
  aws ecr describe-images \
    --repository-name "$1" \
    --image-ids imageTag="$2" \
    --region "$AWS_REGION" >/dev/null 2>&1
}

mirror_image() {
  local source="$1" repo="$2" tag="$3"
  ensure_repo "$repo"
  if [[ "$FORCE_IMAGE_PULL" != "true" ]] && image_exists "$repo" "$tag"; then
    echo "  skip ${repo}:${tag} (already present in ECR)"
    return
  fi
  echo "  pull ${source}:${tag}"
  docker pull "${source}:${tag}"
  docker tag "${source}:${tag}" "${ECR_REGISTRY}/${repo}:${tag}"
  echo "  push ${ECR_REGISTRY}/${repo}:${tag}"
  docker push "${ECR_REGISTRY}/${repo}:${tag}"
}

ensure_log_group() {
  local group="$1"
  if ! aws logs describe-log-groups \
    --log-group-name-prefix "$group" \
    --region "$AWS_REGION" \
    --query "logGroups[?logGroupName=='${group}'].logGroupName | [0]" \
    --output text 2>/dev/null | grep -qx "$group"; then
    aws logs create-log-group --log-group-name "$group" --region "$AWS_REGION"
  fi
}

register_taskdef() {
  local family="$1" rendered="$2"
  local current_arn current_json
  current_arn="$(aws ecs describe-task-definition \
    --task-definition "$family" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text 2>/dev/null || true)"

  if [[ -n "$current_arn" && "$current_arn" != "None" ]]; then
    current_json="$TMP_DIR/${family}-current.json"
    aws ecs describe-task-definition \
      --task-definition "$family" \
      --region "$AWS_REGION" \
      --query 'taskDefinition' \
      --output json > "$current_json"

    set +e
    "$PYTHON_BIN" "$SCRIPT_DIR/taskdef_diff.py" "$current_json" "$rendered" >/dev/null 2>&1
    local diff_status=$?
    set -e
    if [[ $diff_status -eq 0 ]]; then
      echo "  unchanged: $family" >&2
      printf '%s unchanged\n' "$current_arn"
      return
    elif [[ $diff_status -ne 1 ]]; then
      echo "  task definition comparison failed for $family" >&2
      exit 1
    fi
    echo "  changed: $family" >&2
  fi

  local new_arn
  new_arn="$(aws ecs register-task-definition \
    --cli-input-json "file://${rendered}" \
    --tags "key=Project,value=${PROJECT_NAME}" "key=ManagedBy,value=ecs-deploy" \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)"
  printf '%s changed\n' "$new_arn"
}

deploy_service() {
  local name="$1" task_definition="$2" launch_type="$3" container="$4" port="$5" registry="$6" max_percent="$7" min_percent="$8"
  local status

  status="$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$name" \
    --region "$AWS_REGION" \
    --query 'services[0].status' \
    --output text 2>/dev/null || true)"

  local network_config="awsvpcConfiguration={subnets=[${SUBNETS_CSV}],securityGroups=[${INFRA_SECURITY_GROUP_ID}],assignPublicIp=DISABLED}"
  local registry_config="registryArn=${registry},containerName=${container},containerPort=${port}"
  local deployment_config="maximumPercent=${max_percent},minimumHealthyPercent=${min_percent}"

  if [[ "$status" == "ACTIVE" ]]; then
    echo "  updating service: $name"
    local current_registry registry_args=()
    current_registry="$(aws ecs describe-services \
      --cluster "$ECS_CLUSTER" \
      --services "$name" \
      --region "$AWS_REGION" \
      --query 'services[0].serviceRegistries[0].registryArn' \
      --output text 2>/dev/null || true)"
    if [[ "$current_registry" != "$registry" ]]; then
      registry_args=(--service-registries "$registry_config")
    fi
    aws ecs update-service \
      --cluster "$ECS_CLUSTER" \
      --service "$name" \
      --task-definition "$task_definition" \
      --network-configuration "$network_config" \
      "${registry_args[@]}" \
      --deployment-configuration "$deployment_config" \
      --health-check-grace-period-seconds 60 \
      --region "$AWS_REGION" >/dev/null
  elif [[ -n "$status" && "$status" != "None" && "$status" != "INACTIVE" ]]; then
    echo "  service $name exists with status $status; refusing to recreate it" >&2
    exit 1
  else
    echo "  creating service: $name"
    local platform_args=()
    local placement_args=()
    if [[ "$launch_type" == "FARGATE" ]]; then
      platform_args=(--platform-version LATEST)
    fi
    if [[ "$name" == "$OLLAMA_SERVICE" && -n "$OLLAMA_PLACEMENT_EXPRESSION" ]]; then
      placement_args=(--placement-constraints "type=memberOf,expression=${OLLAMA_PLACEMENT_EXPRESSION}")
    fi

    aws ecs create-service \
      --cluster "$ECS_CLUSTER" \
      --service "$name" \
      --task-definition "$task_definition" \
      --desired-count 1 \
      --launch-type "$launch_type" \
      "${platform_args[@]}" \
      --network-configuration "$network_config" \
      --service-registries "$registry_config" \
      --deployment-configuration "$deployment_config" \
      --health-check-grace-period-seconds 60 \
      "${placement_args[@]}" \
      --tags "key=Project,value=${PROJECT_NAME}" "key=ManagedBy,value=ecs-deploy" \
      --region "$AWS_REGION" >/dev/null
  fi
}

# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------
log "Mirroring official images to ECR"
mirror_image docker.io/library/redis "redis" "$REDIS_IMAGE_TAG"
mirror_image docker.io/library/mongo "mongodb" "$MONGODB_IMAGE_TAG"
mirror_image docker.io/qdrant/qdrant "qdrant" "$QDRANT_IMAGE_TAG"
mirror_image docker.io/ollama/ollama "ollama" "$OLLAMA_IMAGE_TAG"

log "Building LiteLLM wrapper image"
ensure_repo litellm
if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD="sha256sum"
else
  HASH_CMD="shasum -a 256"
fi
LITELLM_IMAGE_TAG="$(
  cd "$REPO_ROOT"
  {
    find deploy/aws/images/litellm -type f -print0 | sort -z | xargs -0 $HASH_CMD
    printf 'base=%s\n' "$LITELLM_UPSTREAM_TAG"
  } | $HASH_CMD | awk '{print substr($1, 1, 16)}'
)"
if image_exists litellm "$LITELLM_IMAGE_TAG"; then
  echo "  skip litellm:${LITELLM_IMAGE_TAG} (already present in ECR)"
else
  docker build \
    --build-arg "LITELLM_BASE_IMAGE=ghcr.io/berriai/litellm:${LITELLM_UPSTREAM_TAG}" \
    -f "$REPO_ROOT/deploy/aws/images/litellm/Dockerfile" \
    -t "${ECR_REGISTRY}/litellm:${LITELLM_IMAGE_TAG}" \
    "$REPO_ROOT/deploy/aws/images/litellm"
  docker push "${ECR_REGISTRY}/litellm:${LITELLM_IMAGE_TAG}"
fi

export IMAGE_REDIS="${ECR_REGISTRY}/redis:${REDIS_IMAGE_TAG}"
export IMAGE_MONGODB="${ECR_REGISTRY}/mongodb:${MONGODB_IMAGE_TAG}"
export IMAGE_QDRANT="${ECR_REGISTRY}/qdrant:${QDRANT_IMAGE_TAG}"
export IMAGE_OLLAMA="${ECR_REGISTRY}/ollama:${OLLAMA_IMAGE_TAG}"
export IMAGE_LITELLM="${ECR_REGISTRY}/litellm:${LITELLM_IMAGE_TAG}"

# ---------------------------------------------------------------------------
# Log groups
# ---------------------------------------------------------------------------
log "Ensuring CloudWatch log groups"
for group in "$LOG_GROUP_REDIS" "$LOG_GROUP_MONGODB" "$LOG_GROUP_QDRANT" "$LOG_GROUP_LITELLM" "$LOG_GROUP_OLLAMA"; do
  ensure_log_group "$group"
done

# ---------------------------------------------------------------------------
# Task definitions
# ---------------------------------------------------------------------------
log "Registering task definitions"
declare -A TASK_DEFS
declare -A TASK_STATUS

render_and_register() {
  local name="$1" template="$2"
  local rendered="$TMP_DIR/${name}.json"
  "$PYTHON_BIN" "$SCRIPT_DIR/render.py" "$SCRIPT_DIR/taskdefs/${template}" > "$rendered"
  local result task_arn task_status
  result="$(register_taskdef "allverse-${name}" "$rendered")"
  task_arn="${result% *}"
  task_status="${result##* }"
  TASK_DEFS["$name"]="$task_arn"
  TASK_STATUS["$name"]="$task_status"
  echo "  $name -> $task_arn ($task_status)"
}

render_and_register redis redis.json
render_and_register mongodb mongodb.json
render_and_register qdrant qdrant.json
render_and_register litellm litellm.json
render_and_register ollama ollama.json

# ---------------------------------------------------------------------------
# ECS services
# ---------------------------------------------------------------------------
log "Deploying ECS services"
deploy_service "$REDIS_SERVICE" "${TASK_DEFS[redis]}" FARGATE redis 6379 "$SERVICE_DISCOVERY_REDIS_ARN" 100 0
deploy_service "$MONGODB_SERVICE" "${TASK_DEFS[mongodb]}" FARGATE mongodb 27017 "$SERVICE_DISCOVERY_MONGODB_ARN" 100 0
deploy_service "$QDRANT_SERVICE" "${TASK_DEFS[qdrant]}" FARGATE qdrant 6333 "$SERVICE_DISCOVERY_QDRANT_ARN" 100 0
deploy_service "$LITELLM_SERVICE" "${TASK_DEFS[litellm]}" FARGATE litellm 4000 "$SERVICE_DISCOVERY_LITELLM_ARN" 200 100
deploy_service "$OLLAMA_SERVICE" "${TASK_DEFS[ollama]}" EC2 ollama 11434 "$SERVICE_DISCOVERY_OLLAMA_ARN" 100 0

CHANGED_SERVICES=()
[[ "${TASK_STATUS[redis]}" == "changed" ]] && CHANGED_SERVICES+=("$REDIS_SERVICE")
[[ "${TASK_STATUS[mongodb]}" == "changed" ]] && CHANGED_SERVICES+=("$MONGODB_SERVICE")
[[ "${TASK_STATUS[qdrant]}" == "changed" ]] && CHANGED_SERVICES+=("$QDRANT_SERVICE")
[[ "${TASK_STATUS[litellm]}" == "changed" ]] && CHANGED_SERVICES+=("$LITELLM_SERVICE")
[[ "${TASK_STATUS[ollama]}" == "changed" ]] && CHANGED_SERVICES+=("$OLLAMA_SERVICE")

if [[ "$WAIT_FOR_STABLE" == "true" && ${#CHANGED_SERVICES[@]} -gt 0 ]]; then
  log "Waiting for ${CHANGED_SERVICES[*]} to stabilize"
  aws ecs wait services-stable \
    --cluster "$ECS_CLUSTER" \
    --services "${CHANGED_SERVICES[@]}" \
    --region "$AWS_REGION"
  echo "  all changed services are stable"
fi

log "Infrastructure deployment complete"
cat <<EOF

Internal DNS names (Cloud Map ${CLOUDMAP_NAMESPACE}):
  redis.${CLOUDMAP_NAMESPACE}:6379
  mongodb.${CLOUDMAP_NAMESPACE}:27017
  qdrant.${CLOUDMAP_NAMESPACE}:6333
  litellm.${CLOUDMAP_NAMESPACE}:4000
  ollama.${CLOUDMAP_NAMESPACE}:11434

Images:
  ${IMAGE_REDIS}
  ${IMAGE_MONGODB}
  ${IMAGE_QDRANT}
  ${IMAGE_LITELLM}
  ${IMAGE_OLLAMA}

Next:
  - Ensure the Ollama GPU ASG exists: bash deploy/aws/gpu-capacity.sh
  - Pull the model once: bash deploy/aws/pull-ollama-model.sh
  - Roll out application env: python3 deploy/aws/deploy_app_services.py
EOF
