#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../backend"
python manage.py check
python manage.py test --noinput
