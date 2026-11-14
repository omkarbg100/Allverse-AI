#!/usr/bin/env bash
set -euo pipefail

check() { curl -fsS "$1" >/dev/null && echo "OK  $1" || { echo "FAIL $1"; exit 1; }; }

check "http://localhost:8000/"
check "http://localhost:8001/"
check "http://localhost:8002/"
check "http://localhost:8003/health"
check "http://localhost:8004/"
echo "All services healthy."
