#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci --prefix frontend --cache "${NPM_CONFIG_CACHE:-${TMPDIR:-/tmp}/catana-npm-cache}" --no-audit --no-fund
node scripts/frontend_build_config.mjs
npm run build --prefix frontend
node scripts/frontend_build_config.mjs --metadata
