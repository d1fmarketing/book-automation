#!/bin/bash
# MCP QA Runner - VERSÃO CORRIGIDA
# Remove todas as chamadas para "mcp" inexistente

set -e

# Input files
PDF="${1:-build/dist/ebook.pdf}"
HTML="${2:-build/tmp/ebook.html}"
REPORT_DIR="qa"
REPORT_FILE="$REPORT_DIR/last_fail.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔍 QA Visual Check${NC}"
echo -e "${BLUE}PDF: $PDF${NC}"
echo -e "${BLUE}HTML: $HTML${NC}"

# Initialize report
echo '{
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "pdf": "'$PDF'",
  "html": "'$HTML'",
  "checks": [],
  "status": "checking"
}' > "$REPORT_FILE"

FAILED=0

# Check if PDF exists and has size
echo -n "Checking PDF file... "
if [ -f "$PDF" ] && [ -s "$PDF" ]; then
    SIZE=$(ls -lh "$PDF" | awk '{print $5}')
    echo -e "${GREEN}PASS${NC} (Size: $SIZE)"
else
    echo -e "${RED}FAIL${NC}"
    FAILED=1
fi

# Check if HTML exists
echo -n "Checking HTML file... "
if [ -f "$HTML" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARNING${NC} - HTML not found (not critical)"
fi

# Check if EPUB exists
EPUB="${PDF%.pdf}.epub"
echo -n "Checking EPUB file... "
if [ -f "$EPUB" ] && [ -s "$EPUB" ]; then
    SIZE=$(ls -lh "$EPUB" | awk '{print $5}')
    echo -e "${GREEN}PASS${NC} (Size: $SIZE)"
else
    echo -e "${YELLOW}WARNING${NC} - EPUB not found"
fi

# Simple content checks (without browser)
if [ -f "$HTML" ]; then
    echo -e "\n${BLUE}Content Checks:${NC}"
    
    # Check if HTML has content
    LINES=$(wc -l < "$HTML")
    echo -n "HTML content check... "
    if [ $LINES -gt 10 ]; then
        echo -e "${GREEN}PASS${NC} ($LINES lines)"
    else
        echo -e "${RED}FAIL${NC} (too short)"
        FAILED=1
    fi
fi

# Update final report
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ QA PASSED${NC}"
    echo '{"status": "passed", "exit_code": 0}' > "$REPORT_FILE"
else
    echo -e "\n${RED}❌ QA FAILED${NC}"
    echo '{"status": "failed", "exit_code": 1}' > "$REPORT_FILE"
fi

exit $FAILED
