#!/bin/sh
set -eu

: "${OLLAMA_API_BASE:=http://ollama.allverse.local:11434}"
: "${OLLAMA_MODEL:=llama3.2:3b}"
: "${LITELLM_PORT:=4000}"
: "${LITELLM_NUM_WORKERS:=1}"

export OLLAMA_API_BASE
export OLLAMA_MODEL

/app/.venv/bin/python - <<'PY'
import os
import pathlib
import string

template = pathlib.Path("/app/config.template.yaml").read_text(encoding="utf-8")
rendered = string.Template(template).safe_substitute(
    OLLAMA_API_BASE=os.environ["OLLAMA_API_BASE"],
    OLLAMA_MODEL=os.environ["OLLAMA_MODEL"],
)
pathlib.Path("/tmp/config.yaml").write_text(rendered, encoding="utf-8")
PY

exec litellm \
  --config /tmp/config.yaml \
  --port "${LITELLM_PORT}" \
  --num_workers "${LITELLM_NUM_WORKERS}"
