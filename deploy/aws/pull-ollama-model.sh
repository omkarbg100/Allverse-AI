#!/usr/bin/env bash
#
# Pull an Ollama model once into the shared EFS model store.
#
# This intentionally does NOT run on every container start. The Ollama
# container only runs `ollama serve`; model downloads are explicit and
# idempotent (Ollama skips layers that already exist).
#
# Usage:
#   source deploy/aws/aws-state.env
#   bash deploy/aws/pull-ollama-model.sh
#
# Optional:
#   export OLLAMA_EC2_INSTANCE_ID=i-0123456789abcdef0
#   export OLLAMA_MODEL=qwen2.5:7b
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

# On Git Bash/Cygwin, aws.exe emits CRLF which breaks shell comparisons.
if [[ "${OSTYPE:-}" == msys* || "${OSTYPE:-}" == cygwin* ]]; then
  aws() { command aws "$@" | tr -d '\r'; }
fi
ECS_CLUSTER="${ECS_CLUSTER:?ECS_CLUSTER is required}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"

if [[ ! "$OLLAMA_MODEL" =~ ^[A-Za-z0-9._:/-]+$ ]]; then
  echo "OLLAMA_MODEL contains unexpected characters: $OLLAMA_MODEL" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

INSTANCE_ID="${OLLAMA_EC2_INSTANCE_ID:-}"
if [[ -z "$INSTANCE_ID" ]]; then
  INSTANCE_ID="$(aws ec2 describe-instances \
    --filters \
      "Name=tag:Name,Values=${PROJECT_NAME}-ollama-gpu" \
      "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].InstanceId | [0]' \
    --output text)"
fi

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
  echo "No running GPU instance found. Run deploy/aws/gpu-capacity.sh first or set OLLAMA_EC2_INSTANCE_ID." >&2
  exit 1
fi

echo "Pulling ${OLLAMA_MODEL} on ${INSTANCE_ID}..."

python - "$TMP_DIR/request.json" "$INSTANCE_ID" "$OLLAMA_MODEL" <<'PY'
import json
import sys

path, instance_id, model = sys.argv[1:4]
commands = [
    "set -e",
    'CONTAINER_ID=$(sudo docker ps -q --filter "name=ollama" | head -n 1)',
    'if [ -z "$CONTAINER_ID" ]; then',
    '  echo "Ollama container not found on this instance"; exit 1',
    "fi",
    f'sudo docker exec "$CONTAINER_ID" ollama pull "{model}"',
    'sudo docker exec "$CONTAINER_ID" ollama list',
]
payload = {
    "InstanceIds": [instance_id],
    "DocumentName": "AWS-RunShellScript",
    "Comment": "Pull Ollama model into shared EFS store",
    "Parameters": {"commands": commands},
    "TimeoutSeconds": 3600,
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2)
PY

COMMAND_ID="$(aws ssm send-command \
  --cli-input-json "file://${TMP_DIR}/request.json" \
  --query 'Command.CommandId' \
  --output text)"

echo "SSM command: ${COMMAND_ID}"

for _ in $(seq 1 120); do
  STATUS="$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query 'Status' \
    --output text 2>/dev/null || echo Pending)"
  case "$STATUS" in
    Success)
      echo
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query 'StandardOutputContent' \
        --output text
      echo
      echo "Model ${OLLAMA_MODEL} is available."
      exit 0
      ;;
    Cancelled|Failed|TimedOut)
      echo "SSM command ended with status ${STATUS}." >&2
      aws ssm get-command-invocation \
        --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" \
        --query 'StandardErrorContent' \
        --output text >&2 || true
      exit 1
      ;;
    *)
      printf '.'
      sleep 10
      ;;
  esac
done

echo
echo "Timed out waiting for the model pull. Check CloudWatch/SSM command ${COMMAND_ID}." >&2
exit 1
