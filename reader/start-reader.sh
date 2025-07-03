#!/bin/bash

# Start Enhanced Ebook Reader

echo "📚 Starting Enhanced Ebook Reader..."
echo ""

# Check if node_modules exists
if [ ! -d "../node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd .. && npm install && cd reader
fi

# Kill any existing reader servers
echo "🔄 Checking for existing reader processes..."
lsof -ti:3003 | xargs kill -9 2>/dev/null || true

# Check for available ebooks
echo "📖 Checking for available ebooks..."
if [ -d "../build/ebooks" ]; then
    ebook_count=$(find ../build/ebooks -name "ebook.html" | wc -l)
    echo "Found $ebook_count ebooks"
else
    echo "No ebooks found. Generate one with: npm run money:generate"
fi

# Start the reader server
echo "🚀 Starting reader server on port 3003..."
node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Open reader in browser
echo "🌐 Opening reader in browser..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "http://localhost:3003"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "http://localhost:3003"
else
    echo "Please open http://localhost:3003 in your browser"
fi

echo ""
echo "✅ Reader is running!"
echo "📚 View at: http://localhost:3003"
echo "📊 Analytics: http://localhost:3003/api/analytics"
echo ""
echo "Available ebooks:"
curl -s http://localhost:3003/api/ebooks | python3 -m json.tool 2>/dev/null || echo "Fetching ebook list..."
echo ""
echo "Press Ctrl+C to stop the reader"

# Keep script running and handle shutdown
trap "echo ''; echo '🛑 Stopping reader...'; kill $SERVER_PID 2>/dev/null; exit" INT TERM

# Wait for the server process
wait $SERVER_PID