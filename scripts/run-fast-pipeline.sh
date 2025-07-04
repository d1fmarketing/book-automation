#!/bin/bash

# Fast Pipeline Runner
# Run the optimized pipeline with pre-validation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 FAST PIPELINE RUNNER${NC}"
echo "================================"

# Check if topic is provided
if [ -z "$1" ]; then
    echo -e "${RED}Error: No topic specified${NC}"
    echo "Usage: $0 \"Your Book Topic\""
    exit 1
fi

TOPIC="$1"
echo -e "Topic: ${YELLOW}$TOPIC${NC}\n"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run fast validation first
echo -e "${YELLOW}📋 Running pre-flight validation...${NC}"
if ! node scripts/fast-validate.js; then
    echo -e "${RED}❌ Validation failed! Fix errors before continuing.${NC}"
    exit 1
fi

echo -e "\n${GREEN}✅ Validation passed!${NC}\n"

# Install dependencies if needed
if [ ! -d "node_modules/chokidar" ]; then
    echo -e "${YELLOW}📦 Installing missing dependencies...${NC}"
    npm install
fi

# Run the fast pipeline
echo -e "${YELLOW}🚀 Starting fast pipeline...${NC}\n"
node scripts/orchestrator-fast.js "$TOPIC"

# Check if successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Pipeline completed successfully!${NC}"
    
    # Find the generated book directory
    BOOK_DIR=$(find build/ebooks -maxdepth 1 -type d -mtime -1 | sort -r | head -1)
    
    if [ -n "$BOOK_DIR" ]; then
        echo -e "\n${YELLOW}📚 Book generated at: $BOOK_DIR${NC}"
        echo -e "\n${YELLOW}Want to start watch mode for this book?${NC}"
        echo -e "Run: ${GREEN}npm run money:bravo:watch $BOOK_DIR${NC}"
    fi
else
    echo -e "\n${RED}❌ Pipeline failed!${NC}"
    echo -e "Check the logs in build/logs/ for details"
    exit 1
fi