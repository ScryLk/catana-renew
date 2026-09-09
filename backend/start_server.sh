#!/bin/bash

echo "🚀 Iniciando servidor Django..."
echo ""

# Matar processos antigos se existirem
if [ -f /tmp/django.pid ]; then
    OLD_PID=$(cat /tmp/django.pid)
    kill $OLD_PID 2>/dev/null
    sleep 2
fi

# Verificar porta disponível
PORT=8001
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Porta $PORT em uso, tentando 8002..."
    PORT=8002
fi

echo "Porta selecionada: $PORT"
echo ""

# Iniciar servidor
python3 manage.py runserver 0.0.0.0:$PORT > /tmp/django.log 2>&1 &
DJANGO_PID=$!
echo $DJANGO_PID > /tmp/django.pid

# Aguardar inicialização
sleep 5

# Verificar se está rodando
if ps -p $DJANGO_PID > /dev/null 2>&1; then
    echo "✅ Servidor Django iniciado com sucesso!"
    echo "   PID: $DJANGO_PID"
    echo "   URL: http://localhost:$PORT"
    echo ""
    echo "=== Últimas linhas do log ==="
    tail -10 /tmp/django.log
    echo ""
    echo "=== Testando API ==="
    curl -s http://localhost:$PORT/api/ 2>&1 | head -3
    echo ""
    echo ""
    echo "✅ Servidor pronto para uso!"
    echo "   Logs: tail -f /tmp/django.log"
else
    echo "❌ Erro ao iniciar servidor"
    echo ""
    cat /tmp/django.log
    exit 1
fi
