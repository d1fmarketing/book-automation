#!/bin/bash

# Test Live Preview System
# This script demonstrates the complete live preview functionality

echo "🚀 Testing Live Preview System"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Clean up any existing preview files
echo "🧹 Cleaning up old preview files..."
rm -rf preview-system/previews/*
rm -rf build/dist/test-preview*.pdf

echo ""
echo -e "${YELLOW}📚 Starting PDF generation with live preview...${NC}"
echo ""

# Run the preview
echo "You can view the live preview at:"
echo -e "${GREEN}http://localhost:3001${NC}"
echo ""
echo "Features to try:"
echo "  • Watch pages appear in real-time"
echo "  • Click on page thumbnails to navigate"
echo "  • Use arrow keys for navigation"
echo "  • Zoom in/out with +/- keys"
echo "  • Download the final PDF when complete"
echo ""
echo "Press Ctrl+C to stop the preview server"
echo ""

# Start the preview
npm run preview

echo ""
echo "✅ Preview test completed!"