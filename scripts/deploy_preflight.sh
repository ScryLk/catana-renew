#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/deploy_preflight.mjs
python scripts/deploy_preflight.py
(cd backend && python manage.py check --deploy --tag security --fail-level WARNING)
