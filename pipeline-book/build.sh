#!/bin/bash

# Build script for The Claude Elite Pipeline ebook

echo "🚀 Building The Claude Elite Pipeline ebook..."

# Change to the pipeline-book directory
cd "$(dirname "$0")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Build PDF using dedicated script
echo -e "${BLUE}📚 Building PDF...${NC}"

# Run the dedicated pipeline PDF generator
node generate-pipeline-pdf.js

# Check if PDF was created
if [ -f "the-claude-elite-pipeline.pdf" ]; then
    echo -e "${GREEN}✅ PDF created successfully!${NC}"
    echo -e "📖 Your ebook is at: ${BLUE}$(pwd)/the-claude-elite-pipeline.pdf${NC}"
    
    # Show file info
    FILE_SIZE=$(ls -lh the-claude-elite-pipeline.pdf | awk '{print $5}')
    echo -e "📊 File size: ${FILE_SIZE}"
else
    echo -e "${YELLOW}⚠️  PDF creation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✨ Build process complete!${NC}"