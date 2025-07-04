#!/bin/bash

# Stop Pipeline Services
# Para todos os serviços do pipeline

echo "🛑 Stopping Ebook Pipeline Services"
echo "===================================="

# Função para parar processo
stop_process() {
    if pgrep -f "$1" > /dev/null; then
        echo "Stopping $2..."
        pkill -f "$1"
        sleep 1
        if pgrep -f "$1" > /dev/null; then
            echo "  ⚠️  Force stopping $2..."
            pkill -9 -f "$1"
        fi
        echo "  ✅ $2 stopped"
    else
        echo "  ℹ️  $2 was not running"
    fi
}

# Parar serviços
stop_process "admin/server.js" "Admin Dashboard"
stop_process "start-workers-simple.js" "Workers"
stop_process "start-workers-gemini.js" "Gemini Workers"

# Parar Redis (opcional)
read -p "Stop Redis server? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping Redis..."
    redis-cli shutdown
    echo "  ✅ Redis stopped"
fi

echo ""
echo "✅ All services stopped"