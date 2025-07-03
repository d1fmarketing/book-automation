#!/bin/bash

# Start Template Builder

echo "🎨 Starting Money Machine Template Builder..."
echo ""

# Simple HTTP server for template builder
cd "$(dirname "$0")"

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "🚀 Starting server on port 3006..."
    echo ""
    echo "✅ Template Builder is running!"
    echo ""
    echo "🎨 Open in browser: http://localhost:3006"
    echo ""
    echo "Features:"
    echo "  • Drag-and-drop template building"
    echo "  • Pre-built template library"
    echo "  • Real-time preview"
    echo "  • Export to HTML/CSS/JSON"
    echo "  • Visual property editing"
    echo ""
    echo "Press Ctrl+C to stop the server"
    
    # Open in browser
    sleep 1
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "http://localhost:3006"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "http://localhost:3006"
    fi
    
    # Start server
    python3 -m http.server 3006
elif command -v python &> /dev/null; then
    echo "🚀 Starting server on port 3006..."
    python -m SimpleHTTPServer 3006
else
    echo "❌ Python not found. Please install Python to run the template builder."
    exit 1
fi