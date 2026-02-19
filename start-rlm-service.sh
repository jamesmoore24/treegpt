#!/bin/bash
# Starts the RLM FastAPI service.
# Run this once on the EC2 instance alongside pm2 (Next.js).
#
# Usage:
#   chmod +x start-rlm-service.sh
#   ./start-rlm-service.sh
#
# Or via pm2 so it restarts automatically:
#   pm2 start start-rlm-service.sh --name rlm-service --interpreter bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load env vars from Next.js .env / .env.local so the service shares the same API keys
for envfile in .env .env.local; do
  if [ -f "$envfile" ]; then
    set -a
    source "$envfile"
    set +a
    echo "[rlm-service] loaded $envfile"
  fi
done

# Install deps if needed
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "[rlm-service] installing Python dependencies..."
  pip3 install -r requirements-rlm.txt
fi

echo "[rlm-service] starting on port ${RLM_PORT:-8000}..."
exec python3 -m uvicorn rlm_service:app \
  --host 0.0.0.0 \
  --port "${RLM_PORT:-8000}" \
  --workers 1 \
  --log-level info
