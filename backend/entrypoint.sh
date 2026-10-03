#!/bin/sh
set -e

echo "==> [Catana 2.0 Backend] Inicializando..."

# Garantir diretorios de media e staticfiles
mkdir -p /app/staticfiles /app/media

# Migracoes do banco de dados
echo "==> Executando migracoes do banco..."
python manage.py migrate --noinput

# Coleta de estaticos (DRF, Admin)
echo "==> Coletando arquivos estaticos..."
python manage.py collectstatic --noinput

# Iniciar servidor WSGI Gunicorn
echo "==> Iniciando Gunicorn na porta 8000..."
exec gunicorn catana_back.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
