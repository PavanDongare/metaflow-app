#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$HERE/.." && pwd)"

if [[ ! -f "$APP_ROOT/.env.local" ]]; then
  echo "Missing $APP_ROOT/.env.local" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$APP_ROOT/.env.local"
set +a

if [[ -z "${GLM_API_KEY:-}" ]]; then
  echo "GLM_API_KEY is not set in $APP_ROOT/.env.local" >&2
  exit 1
fi

MODEL="${GLM_MODEL:-glm-5}"
BASE_URL="${GLM_BASE_URL:-https://api.z.ai/api/paas/v4/chat/completions}"

HTTP_CODE=$(curl -sS -o /tmp/glm_chat.json -w "%{http_code}" \
  "$BASE_URL" \
  -H "Authorization: Bearer $GLM_API_KEY" \
  -H "Content-Type: application/json" \
  --data-raw "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}")

echo "HTTP $HTTP_CODE"
cat /tmp/glm_chat.json
