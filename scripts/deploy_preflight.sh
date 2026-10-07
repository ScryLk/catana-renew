#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PYTHON_BIN="$(which python3 || which python || echo python)"
if [ -f "$(pwd)/backend/venv/bin/python" ]; then
  PYTHON_BIN="$(pwd)/backend/venv/bin/python"
fi

export AUTH_PROVIDER="${AUTH_PROVIDER:?Set AUTH_PROVIDER explicitly to clerk or legacy}"
export ENVIRONMENT="${ENVIRONMENT:-production}"
export DEBUG="${DEBUG:-False}"
export ALLOWED_HOSTS="${ALLOWED_HOSTS:-usecatana.com.br,www.usecatana.com.br,179.236.238.62,srv2029979.hstgr.cloud,localhost,127.0.0.1}"

node scripts/deploy_preflight.mjs
node scripts/check_coop_config.mjs
"${PYTHON_BIN}" scripts/deploy_preflight.py
(cd backend && "${PYTHON_BIN}" manage.py check --deploy --tag security --fail-level WARNING)
