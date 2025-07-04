#!/bin/bash

# Engenheiro Bravo Pipeline Launcher
# Zero tolerance, fool-proof ebook generation

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔥 ENGENHEIRO BRAVO PIPELINE${NC}"
echo "================================"
echo "Zero tolerance mode activated!"
echo ""

# Check if topic provided
TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
    echo -e "${YELLOW}No topic provided. Researching trending topics...${NC}"
    TOPIC=$(node -e "require('./scripts/research-topics')().then(t => console.log(t[0]?.title || ''))" 2>/dev/null || "")
    
    if [ -z "$TOPIC" ]; then
        echo -e "${RED}❌ No topics found. Please provide a topic:${NC}"
        echo "Usage: $0 \"Your Ebook Topic\""
        exit 1
    fi
    
    echo -e "${GREEN}✅ Selected topic: $TOPIC${NC}"
fi

# Check environment
echo -e "\n${YELLOW}Checking environment...${NC}"
if ! npm run check-env > /dev/null 2>&1; then
    echo -e "${RED}❌ Environment check failed!${NC}"
    echo "Run: npm run check-env"
    exit 1
fi
echo -e "${GREEN}✅ Environment ready${NC}"

# Clean previous runs
echo -e "\n${YELLOW}Cleaning previous builds...${NC}"
rm -rf build/run-manifest.json build/logs/* build/ebooks/* 2>/dev/null || true
echo -e "${GREEN}✅ Clean workspace${NC}"

# Start watchdog in background
echo -e "\n${YELLOW}Starting watchdog service...${NC}"
node agents/watchdog.js "$TOPIC" > build/logs/watchdog.log 2>&1 &
WATCHDOG_PID=$!
echo -e "${GREEN}✅ Watchdog started (PID: $WATCHDOG_PID)${NC}"

# Trap to kill watchdog on exit
trap "kill $WATCHDOG_PID 2>/dev/null || true" EXIT

# Monitor pipeline
echo -e "\n${YELLOW}Pipeline running...${NC}"
echo "Monitor progress: tail -f build/logs/watchdog.log"
echo ""

# Wait for completion or failure
while true; do
    if [ -f build/run-manifest.json ]; then
        FINAL=$(jq -r '.final' build/run-manifest.json 2>/dev/null || echo "false")
        if [ "$FINAL" = "true" ]; then
            echo -e "\n${GREEN}✅ PIPELINE COMPLETED SUCCESSFULLY!${NC}"
            
            # Show summary
            echo -e "\n${YELLOW}Summary:${NC}"
            jq -r '
                "Topic: " + .topic + "\n" +
                "Steps: " + (.steps | length | tostring) + "/9\n" +
                "QA Score: " + ((.qa.lighthouse * 100) | tostring) + "/100\n" +
                "Errors: " + (.errors | length | tostring)
            ' build/run-manifest.json
            
            # Find output directory
            BOOK_DIR=$(find build/ebooks -name "index.html" -type f | head -1 | xargs dirname 2>/dev/null || echo "")
            if [ -n "$BOOK_DIR" ]; then
                echo -e "\n${GREEN}📚 Ebook ready at: $BOOK_DIR${NC}"
            fi
            
            break
        fi
    fi
    
    # Check if watchdog died
    if ! kill -0 $WATCHDOG_PID 2>/dev/null; then
        echo -e "\n${RED}❌ Pipeline failed! Check logs:${NC}"
        echo "  build/logs/watchdog.log"
        echo "  build/logs/orchestrator-out.log"
        exit 1
    fi
    
    sleep 5
done

echo -e "\n${GREEN}🎉 Success! Your ebook is ready for deployment.${NC}"
echo ""
echo "Next steps:"
echo "1. Review: open $BOOK_DIR/index.html"
echo "2. Deploy: npm run deploy:hostinger"
echo "3. Publish: npm run money:publish"