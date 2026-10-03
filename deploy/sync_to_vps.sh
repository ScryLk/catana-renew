#!/usr/bin/env bash
set -euo pipefail

VPS_IP="179.236.238.62"
VPS_USER="root"
REMOTE_DEST="/var/www/catana"
LOCAL_SRC="/Users/lucas/Documents/catanarepo/catana-renew/"

echo "=========================================================="
echo "    🚀 CATANA 2.0 — DEPLOY PRODUCAO VIA DOCKER COMPOSE"
echo "=========================================================="
echo "📡 [1/3] Sincronizando arquivos para a VPS (${VPS_USER}@${VPS_IP}:${REMOTE_DEST})..."

rsync -avz --progress \
    --exclude="node_modules" \
    --exclude="*/node_modules" \
    --exclude="venv" \
    --exclude="*/venv" \
    --exclude=".git" \
    --exclude="__pycache__" \
    --exclude="*.pyc" \
    --exclude=".DS_Store" \
    "${LOCAL_SRC}" "${VPS_USER}@${VPS_IP}:${REMOTE_DEST}/"

echo "🔐 [2/3] Ajustando permissoes em ${REMOTE_DEST}..."
ssh "${VPS_USER}@${VPS_IP}" "
    mkdir -p ${REMOTE_DEST}/backend/media ${REMOTE_DEST}/backend/staticfiles
    chmod -R 777 ${REMOTE_DEST}/backend/media ${REMOTE_DEST}/backend/staticfiles
    if [ -f ${REMOTE_DEST}/backend/db.sqlite3 ]; then
        chmod 666 ${REMOTE_DEST}/backend/db.sqlite3
    fi
    chmod 777 ${REMOTE_DEST}/backend
"

echo "🐳 [3/3] Subindo containers Docker na VPS..."
ssh "${VPS_USER}@${VPS_IP}" "
    cd ${REMOTE_DEST}
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
    docker compose -f docker-compose.prod.yml ps
"

echo "=========================================================="
echo "    ✅ CATANA 2.0 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "    🌐 URL: http://${VPS_IP}"
echo "=========================================================="
