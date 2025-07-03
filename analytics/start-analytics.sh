#!/bin/bash

# Start Analytics Dashboard

echo "📊 Starting Money Machine Analytics Dashboard..."
echo ""

# Check if node_modules exists
if [ ! -d "../node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd .. && npm install && cd analytics
fi

# Kill any existing analytics servers
echo "🔄 Checking for existing analytics processes..."
lsof -ti:3004 | xargs kill -9 2>/dev/null || true

# Check environment
if [ -z "$ANALYTICS_PORT" ]; then
    export ANALYTICS_PORT=3004
fi

# Enable demo mode if no sales data exists
if [ ! -f "analytics-data.json" ]; then
    echo "📈 No existing data found, enabling demo mode..."
    export DEMO_MODE=true
fi

# Start the analytics server
echo "🚀 Starting analytics server on port $ANALYTICS_PORT..."
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Test server health
echo "🏥 Checking server health..."
if curl -s http://localhost:$ANALYTICS_PORT/api/health > /dev/null; then
    echo "✅ Server is healthy"
else
    echo "❌ Server health check failed"
fi

# Open analytics dashboard in browser
echo "🌐 Opening analytics dashboard..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:$ANALYTICS_PORT"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:$ANALYTICS_PORT"
else
    echo "Please open http://localhost:$ANALYTICS_PORT in your browser"
fi

echo ""
echo "✅ Analytics Dashboard is running!"
echo ""
echo "📊 Dashboard: http://localhost:$ANALYTICS_PORT"
echo "🔌 WebSocket: ws://localhost:$ANALYTICS_PORT/ws"
echo "📡 API: http://localhost:$ANALYTICS_PORT/api"
echo ""
echo "Webhook URLs for payment platforms:"
echo "  Gumroad: http://localhost:$ANALYTICS_PORT/api/webhooks/gumroad"
echo "  Stripe:  http://localhost:$ANALYTICS_PORT/api/webhooks/stripe"
echo "  PayPal:  http://localhost:$ANALYTICS_PORT/api/webhooks/paypal"
echo ""
echo "Press Ctrl+C to stop the analytics dashboard"

# Keep script running and handle shutdown
trap "echo ''; echo '🛑 Stopping analytics...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

# Wait for the server process
wait $SERVER_PID