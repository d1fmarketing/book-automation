#!/bin/bash

# Start Admin Dashboard

echo "🚀 Starting Admin Dashboard..."

# Kill any existing processes
pkill -f "node.*admin/server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null

# Wait a moment
sleep 1

# Start backend server
echo "📡 Starting backend server on port 4000..."
cd /Users/d1f/Desktop/Ebooks/book-automation/admin
node server.js &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo "🎨 Starting frontend on port 3000..."
cd /Users/d1f/Desktop/Ebooks/book-automation/admin/client
npm run dev &
FRONTEND_PID=$!

echo "✅ Admin Dashboard is starting..."
echo "   Backend: http://localhost:4000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait