#!/bin/bash

# Start Control Panel

echo "🎛️  Starting Money Machine Control Panel..."
echo ""

# Check if node_modules exists
if [ ! -d "../node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd .. && npm install && cd control-panel
fi

# Kill any existing control panel servers
echo "🔄 Checking for existing control panel processes..."
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

# Check environment
if [ -z "$CONTROL_PORT" ]; then
    export CONTROL_PORT=3005
fi

# Enable demo mode if requested
if [ "$1" == "--demo" ]; then
    echo "🎭 Demo mode enabled..."
    export DEMO_MODE=true
fi

# Start the control panel server
echo "🚀 Starting control panel server on port $CONTROL_PORT..."
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Test server health
echo "🏥 Checking server health..."
if curl -s http://localhost:$CONTROL_PORT/api/health > /dev/null; then
    echo "✅ Server is healthy"
else
    echo "❌ Server health check failed"
fi

# Open control panel in browser
echo "🌐 Opening control panel..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:$CONTROL_PORT"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:$CONTROL_PORT"
else
    echo "Please open http://localhost:$CONTROL_PORT in your browser"
fi

echo ""
echo "✅ Control Panel is running!"
echo ""
echo "🎛️  Dashboard: http://localhost:$CONTROL_PORT"
echo "🔌 WebSocket: ws://localhost:$CONTROL_PORT/ws"
echo "📡 API: http://localhost:$CONTROL_PORT/api"
echo ""
echo "Features:"
echo "  • Real-time pipeline monitoring"
echo "  • Phase control and configuration"
echo "  • Job queue management"
echo "  • API usage tracking"
echo "  • Performance analytics"
echo "  • System logs viewer"
echo ""
echo "Press Ctrl+C to stop the control panel"

# Keep script running and handle shutdown
trap "echo ''; echo '🛑 Stopping control panel...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

# Wait for the server process
wait $SERVER_PID