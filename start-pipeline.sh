#!/bin/bash

# Start Pipeline with API Keys
# Carrega as API keys do .env e inicia o pipeline

echo "🚀 Starting Ebook Pipeline with API Keys"
echo "======================================="

# Carregar variáveis do .env
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Loaded API keys from .env"
else
    echo "❌ .env file not found!"
    exit 1
fi

# Verificar APIs configuradas
echo ""
echo "📊 API Status:"
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "  ✅ Anthropic API key configured"
else
    echo "  ❌ Anthropic API key missing"
fi

if [ -n "$GEMINI_API_KEY" ] || [ -n "$GOOGLE_API_KEY" ]; then
    echo "  ✅ Gemini API key configured"
else
    echo "  ❌ Gemini API key missing"
fi

# Função para verificar se um processo está rodando
check_process() {
    if pgrep -f "$1" > /dev/null; then
        echo "  ✅ $2 is running"
        return 0
    else
        echo "  ❌ $2 is not running"
        return 1
    fi
}

echo ""
echo "📊 Service Status:"

# Verificar Redis
if redis-cli ping > /dev/null 2>&1; then
    echo "  ✅ Redis is running"
else
    echo "  ❌ Redis is not running"
    echo ""
    echo "Starting Redis..."
    redis-server --daemonize yes
    sleep 2
    if redis-cli ping > /dev/null 2>&1; then
        echo "  ✅ Redis started successfully"
    else
        echo "  ❌ Failed to start Redis"
        exit 1
    fi
fi

# Verificar Workers
if ! check_process "start-workers-simple.js" "Workers"; then
    echo ""
    echo "Starting Workers..."
    nohup node scripts/start-workers-simple.js > logs/workers.log 2>&1 &
    sleep 3
    if check_process "start-workers-simple.js" "Workers"; then
        echo "  ✅ Workers started successfully"
    fi
fi

# Verificar Admin
if ! check_process "admin/server.js" "Admin Dashboard"; then
    echo ""
    echo "Starting Admin Dashboard..."
    cd admin
    nohup npm start > ../logs/admin.log 2>&1 &
    cd ..
    sleep 5
    if check_process "admin/server.js" "Admin Dashboard"; then
        echo "  ✅ Admin Dashboard started successfully"
    fi
fi

echo ""
echo "🎯 All services are running!"
echo ""
echo "📋 Quick Actions:"
echo "  1. Open Admin Dashboard: http://localhost:3001"
echo "  2. Create new pipeline via dashboard"
echo "  3. Monitor logs:"
echo "     - Workers: tail -f logs/workers.log"
echo "     - Admin: tail -f logs/admin.log"
echo ""
echo "📚 Example Pipeline via CLI:"
echo "  node scripts/orchestrator-hybrid.js \"Your Book Topic\" --chapters 10"
echo ""
echo "🛑 To stop all services:"
echo "  ./stop-pipeline.sh"