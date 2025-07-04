#!/bin/bash

# FAST VERIFY AND FIX LOOP
# Uses the optimized pipeline for quick iterations

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 FAST VERIFY & FIX LOOP${NC}"
echo "======================================="
echo ""

# Config
export STRICT_QA=true
export IDEO_API_KEY=${IDEO_KEY:-${IDEOGRAM_API_KEY:-}}
export PERPLEXITY_KEY=${PP_KEY:-${PERPLEXITY_API_KEY:-}}
export DEBUG_PIPE=true

# Limits
MAX_ATTEMPTS=3  # Fewer attempts needed with fast pipeline
ATTEMPT=0

# Topic
TOPIC=${1:-"What's One Brutal Truth You Learned After Starting Your Business?"}

echo -e "📚 Topic: ${YELLOW}$TOPIC${NC}"
echo -e "🔧 Max attempts: $MAX_ATTEMPTS"
echo -e "⚡ Using FAST pipeline with caching"
echo ""

# Pre-flight validation
echo -e "${YELLOW}📋 Running pre-flight validation...${NC}"
if ! node scripts/fast-validate.js; then
    echo -e "${RED}❌ Pre-flight validation failed!${NC}"
    echo "Fix the errors above before running the pipeline."
    exit 1
fi
echo -e "${GREEN}✅ Validation passed!${NC}\n"

# Install dependencies if needed
if [ ! -d "node_modules/chokidar" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Clean start (but keep cache)
echo -e "${BLUE}🧹 Cleaning previous builds (keeping cache)...${NC}"
rm -rf build/ebooks/*
rm -f build/run-manifest.json
# Keep build/.cache for fast rebuilds

# Track timing
TOTAL_START=$(date +%s)

# Main loop
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo ""
    echo "════════════════════════════════════════"
    echo -e "${YELLOW}🔄 ATTEMPT $ATTEMPT/$MAX_ATTEMPTS${NC}"
    echo "════════════════════════════════════════"
    echo ""
    
    LOOP_START=$(date +%s)
    
    # Run fast orchestrator
    echo -e "${BLUE}🚀 Running fast orchestrator...${NC}"
    if node scripts/orchestrator-fast.js "$TOPIC"; then
        echo -e "${GREEN}✅ Fast orchestrator completed!${NC}"
        
        # Find the generated HTML
        BOOK_DIR=$(ls -d build/ebooks/*/ 2>/dev/null | head -1)
        HTML_PATH="${BOOK_DIR}html/index.html"
        
        if [ ! -f "$HTML_PATH" ]; then
            echo -e "${RED}❌ HTML not found at: $HTML_PATH${NC}"
            continue
        fi
        
        # Quick HTML validation
        echo ""
        echo -e "${BLUE}🔍 Running quick HTML validation...${NC}"
        
        # Check for common issues
        if grep -q '\[object Object\]' "$HTML_PATH"; then
            echo -e "${RED}❌ Found [object Object] in HTML${NC}"
            continue
        fi
        
        if grep -q '<hundefined' "$HTML_PATH"; then
            echo -e "${RED}❌ Found <hundefined> tags in HTML${NC}"
            continue
        fi
        
        # Run visual QA
        echo -e "${BLUE}🔍 Running Visual QA...${NC}"
        if node qa/qa-html-mcp.js --input "$HTML_PATH" --lighthouse 90; then
            LOOP_END=$(date +%s)
            LOOP_TIME=$((LOOP_END - LOOP_START))
            TOTAL_END=$(date +%s)
            TOTAL_TIME=$((TOTAL_END - TOTAL_START))
            
            echo ""
            echo -e "${GREEN}✅✅✅ PIPELINE PASSOU! QA VISUAL APROVADO!${NC}"
            echo ""
            echo -e "📁 Book directory: ${YELLOW}$BOOK_DIR${NC}"
            echo -e "📄 HTML: ${YELLOW}$HTML_PATH${NC}"
            echo ""
            echo -e "⏱️  Loop time: ${GREEN}${LOOP_TIME}s${NC}"
            echo -e "⏱️  Total time: ${GREEN}${TOTAL_TIME}s${NC}"
            echo ""
            
            # Suggest watch mode
            echo -e "${YELLOW}💡 Start watch mode for live editing:${NC}"
            echo -e "   ${BLUE}npm run money:bravo:watch $BOOK_DIR${NC}"
            echo ""
            
            # Open in browser
            if command -v open >/dev/null 2>&1; then
                echo -e "${BLUE}🌐 Opening in browser...${NC}"
                open "$HTML_PATH"
            fi
            
            exit 0
        else
            echo -e "${RED}❌ Visual QA failed${NC}"
        fi
    else
        echo -e "${RED}❌ Fast orchestrator failed${NC}"
    fi
    
    LOOP_END=$(date +%s)
    LOOP_TIME=$((LOOP_END - LOOP_START))
    echo -e "⏱️  Attempt took: ${YELLOW}${LOOP_TIME}s${NC}"
    
    # Wait before retry (shorter wait for fast pipeline)
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        echo -e "${YELLOW}⏳ Waiting 5 seconds before retry...${NC}"
        sleep 5
    fi
done

TOTAL_END=$(date +%s)
TOTAL_TIME=$((TOTAL_END - TOTAL_START))

echo ""
echo -e "${RED}❌❌❌ FAILED AFTER $MAX_ATTEMPTS ATTEMPTS!${NC}"
echo -e "Total time wasted: ${RED}${TOTAL_TIME}s${NC}"
echo ""
echo -e "${YELLOW}Debug tips:${NC}"
echo "1. Check build/logs/ for performance reports"
echo "2. Look for timeout errors in the logs"
echo "3. Try clearing cache: rm -rf build/.cache"
echo "4. Run validation: npm run money:bravo:validate"
echo ""

exit 1