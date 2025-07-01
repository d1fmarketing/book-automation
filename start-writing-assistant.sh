#!/bin/bash

# Start AI Writing Assistant Server

echo "🚀 Starting AI Writing Assistant..."

# Start the server
cd writing-assistant-server
npm start &
SERVER_PID=$!

echo "✅ Server started (PID: $SERVER_PID)"
echo "📝 Open http://localhost:3002 in your browser"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
trap "echo ''; echo 'Shutting down...'; kill $SERVER_PID; exit 0" INT
wait $SERVER_PID
