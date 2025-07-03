#!/bin/bash
# Start the real WebSocket server with dashboard

echo "🚀 Starting WebSocket Server with Dashboard..."
echo "================================================"

# Navigate to project root
cd "$(dirname "$0")/../.."

# Run the WebSocket server
python -m ebook_pipeline.websocket_server_real

# Note: The server will create a dashboard.html file in the current directory
# Open it in your browser to see the real-time pipeline status