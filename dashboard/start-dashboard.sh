#!/bin/bash

# Start Money Machine Dashboard

echo "💰 Starting Money Machine Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if Redis is running (optional)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running (optional for dashboard)"
    fi
fi

# Kill any existing dashboard servers
echo "🔄 Checking for existing dashboard processes..."
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Start the dashboard server
echo "🚀 Starting dashboard server on port 3002..."
node dashboard/server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Open dashboard in browser
echo "🌐 Opening dashboard in browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3002"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:3002"
else
    echo "Please open http://localhost:3002 in your browser"
fi

echo ""
echo "✅ Dashboard is running!"
echo "📊 View at: http://localhost:3002"
echo "🔌 WebSocket: ws://localhost:3002"
echo ""
echo "Press Ctrl+C to stop the dashboard"

# Keep script running and handle shutdown
trap "echo ''; echo '🛑 Stopping dashboard...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

# Wait for the server process
wait $SERVER_PID