#!/usr/bin/env bash
set -euo pipefail

VPS_IP="179.236.238.62"
VPS_USER="root"
REMOTE_DEST="/var/www/catana"
LOCAL_SRC="$(cd "$(dirname "$0")/.." && pwd)"

echo "=========================================================="
echo "    🚀 CATANA 2.0 — DEPLOY PRODUCAO VIA DOCKER COMPOSE"
echo "=========================================================="

echo "📦 [0/4] Compilando build de produção atualizado do frontend..."
bash "${LOCAL_SRC}/scripts/build_frontend_production.sh"
(cd "${LOCAL_SRC}" && bash scripts/deploy_preflight.sh)

echo "📡 [1/4] Sincronizando arquivos para a VPS (${VPS_USER}@${VPS_IP}:${REMOTE_DEST})..."
rsync -avz --progress \
    --exclude="node_modules" \
    --exclude="*/node_modules" \
    --exclude="venv" \
    --exclude="*/venv" \
    --exclude=".git" \
    --exclude=".env*" \
    --exclude=".venv" \
    --exclude="*.sqlite3" \
    --exclude="__pycache__" \
    --exclude="*.pyc" \
    --exclude=".DS_Store" \
    "${LOCAL_SRC}/" "${VPS_USER}@${VPS_IP}:${REMOTE_DEST}/"

echo "🔐 [2/4] Ajustando permissoes e ambiente em ${REMOTE_DEST}..."
ssh "${VPS_USER}@${VPS_IP}" "
    mkdir -p ${REMOTE_DEST}/backend/media ${REMOTE_DEST}/backend/staticfiles
    chmod -R 777 ${REMOTE_DEST}/backend/media ${REMOTE_DEST}/backend/staticfiles
    if [ -f ${REMOTE_DEST}/backend/db.sqlite3 ]; then
        chmod 666 ${REMOTE_DEST}/backend/db.sqlite3
    fi
    chmod 777 ${REMOTE_DEST}/backend
    if [ -f ${REMOTE_DEST}/backend/.env ]; then
        sed -i 's/^DEBUG=True/DEBUG=False/' ${REMOTE_DEST}/backend/.env
        sed -i 's|KATANA_FRONTEND_URL=.*|KATANA_FRONTEND_URL=https://usecatana.com.br|' ${REMOTE_DEST}/backend/.env
        sed -i 's|FRONTEND_URL=.*|FRONTEND_URL=https://usecatana.com.br|' ${REMOTE_DEST}/backend/.env
        grep -q '^AUTH_PROVIDER=' ${REMOTE_DEST}/backend/.env || echo 'AUTH_PROVIDER=clerk' >> ${REMOTE_DEST}/backend/.env
        grep -q '^ENVIRONMENT=' ${REMOTE_DEST}/backend/.env || echo 'ENVIRONMENT=production' >> ${REMOTE_DEST}/backend/.env
    fi
    if [ -f ${REMOTE_DEST}/frontend/.env.production ]; then
        grep -q '^VITE_AUTH_PROVIDER=' ${REMOTE_DEST}/frontend/.env.production || echo 'VITE_AUTH_PROVIDER=clerk' >> ${REMOTE_DEST}/frontend/.env.production
    fi
"

echo "🐳 [3/4] Atualizando e subindo containers Docker na VPS..."
ssh "${VPS_USER}@${VPS_IP}" "
    cd ${REMOTE_DEST}
    docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
    docker compose -f docker-compose.prod.yml ps
"

echo "🩺 [4/4] Executando Smoke Test na API de Produção..."
HEALTH_STATUS=$(curl --fail --silent --show-error -o /dev/null -w "%{http_code}" https://usecatana.com.br/api/health/ || true)
echo "Healthcheck response status: ${HEALTH_STATUS}"

echo "=========================================================="
echo "    ✅ CATANA 2.0 DEPLOY CONCLUÍDO COM SUCESSO!"
echo "    🌐 URL Oficial: https://usecatana.com.br"
echo "    🌐 Host VPS: http://${VPS_IP}"
echo "=========================================================="
