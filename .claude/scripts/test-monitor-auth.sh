#!/bin/bash

echo "🔧 Testing MCP Monitor WebSocket Authentication"
echo "============================================="

# Kill any existing monitor
echo "Cleaning up existing processes..."
pkill -f mcp-pipeline-monitor 2>/dev/null
sleep 1

# Start monitor with auth token
echo -e "\nStarting monitor with authentication..."
MCP_MONITOR_TOKEN=test123 node .claude/scripts/mcp-pipeline-monitor.js > .claude/logs/monitor-test.log 2>&1 &
MONITOR_PID=$!

echo "Monitor PID: $MONITOR_PID"
echo "Waiting for monitor to start..."
sleep 3

# Check if monitor is running
if ! ps -p $MONITOR_PID > /dev/null; then
    echo "❌ Monitor failed to start. Check logs:"
    tail -20 .claude/logs/monitor-test.log
    exit 1
fi

# Run authentication tests
echo -e "\nRunning authentication tests..."
node .claude/scripts/test-ws-auth.js

# Kill monitor
echo -e "\nStopping monitor..."
kill $MONITOR_PID 2>/dev/null

echo -e "\n✅ Test completed!"