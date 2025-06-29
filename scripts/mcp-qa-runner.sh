#!/bin/bash

# MCP QA Runner - Visual assertions with literal "eyes on the page"
# Exit 0 only when ALL checks pass

set -e

# Input files
PDF="${1:-build/dist/ebook.pdf}"
HTML="${2:-build/tmp/ebook.html}"
REPORT_DIR="qa"
SCREENSHOT_DIR="$REPORT_DIR/screens"
REPORT_FILE="$REPORT_DIR/last_fail.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$REPORT_DIR" "$SCREENSHOT_DIR"

echo -e "${BLUE}🔍 MCP Visual QA Runner${NC}"
echo -e "${BLUE}PDF: $PDF${NC}"
echo -e "${BLUE}HTML: $HTML${NC}"
echo ""

# Initialize report
echo '{
  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "pdf": "'$PDF'",
  "html": "'$HTML'",
  "checks": [],
  "failures": [],
  "screenshots": []
}' > "$REPORT_FILE"

# Start MCP browser session
echo -e "${YELLOW}Starting MCP browser session...${NC}"
mcp start --session qa-run --browser chromium --headless || {
    echo -e "${RED}Failed to start MCP session${NC}"
    exit 1
}

# Function to add check result to report
add_check() {
    local check_name="$1"
    local passed="$2"
    local details="$3"
    
    # Update report using jq or simple sed
    if command -v jq &> /dev/null; then
        jq --arg name "$check_name" \
           --arg passed "$passed" \
           --arg details "$details" \
           '.checks += [{"name": $name, "passed": ($passed == "true"), "details": $details}]' \
           "$REPORT_FILE" > "$REPORT_FILE.tmp" && mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    fi
}

# Track overall status
FAILED=0

echo -e "\n${BLUE}=== Phase 1: HTML DOM Checks (Fast) ===${NC}"

# Navigate to HTML
echo "Loading HTML for DOM inspection..."
mcp qa-run navigate "file://$PWD/$HTML" || {
    echo -e "${RED}Failed to load HTML${NC}"
    FAILED=1
}

# Typography checks
echo -n "Checking font sizes (11.5pt - 14pt)... "
if mcp qa-run assert font-size between 11.5pt 14pt 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "font-size" "true" "Font sizes within range"
else
    echo -e "${RED}FAIL${NC}"
    add_check "font-size" "false" "Font sizes out of range"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-font-size-$(date +%s).png"
    FAILED=1
fi

echo -n "Checking line height (1.3 - 1.6)... "
if mcp qa-run assert line-height between 1.3 1.6 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "line-height" "true" "Line height within range"
else
    echo -e "${RED}FAIL${NC}"
    add_check "line-height" "false" "Line height out of range"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-line-height-$(date +%s).png"
    FAILED=1
fi

echo -n "Checking contrast ratio (min 4.5:1)... "
if mcp qa-run assert contrast-ratio min 4.5 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "contrast-ratio" "true" "Contrast meets WCAG AA"
else
    echo -e "${RED}FAIL${NC}"
    add_check "contrast-ratio" "false" "Contrast below WCAG AA"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-contrast-$(date +%s).png"
    FAILED=1
fi

# Layout checks
echo -n "Checking blank page percentage (<50%)... "
if mcp qa-run assert max-blank-page-percent 50 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "blank-pages" "true" "Blank space acceptable"
else
    echo -e "${RED}FAIL${NC}"
    add_check "blank-pages" "false" "Too much blank space"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-blank-pages-$(date +%s).png"
    FAILED=1
fi

echo -n "Checking widows/orphans (max 2 lines)... "
if mcp qa-run assert widows-orphans max 2 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "widows-orphans" "true" "No bad breaks"
else
    echo -e "${RED}FAIL${NC}"
    add_check "widows-orphans" "false" "Bad line breaks detected"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-widows-$(date +%s).png"
    FAILED=1
fi

echo -e "\n${BLUE}=== Phase 2: PDF Print Geometry ===${NC}"

# Navigate to PDF
echo "Loading PDF for print checks..."
mcp qa-run navigate "file://$PWD/$PDF" || {
    echo -e "${RED}Failed to load PDF${NC}"
    FAILED=1
}

# PDF-specific checks
echo -n "Checking page bleed (within 3mm)... "
if mcp qa-run assert page-bleed within 3mm 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    add_check "page-bleed" "true" "Bleed within tolerance"
else
    echo -e "${RED}FAIL${NC}"
    add_check "page-bleed" "false" "Bleed out of tolerance"
    mcp qa-run screenshot save "$SCREENSHOT_DIR/fail-bleed-$(date +%s).png"
    FAILED=1
fi

# Check expected page count if available
if [ -f "meta/expected_pages.txt" ]; then
    EXPECTED_PAGES=$(cat meta/expected_pages.txt)
    echo -n "Checking page count (expected: $EXPECTED_PAGES)... "
    if mcp qa-run assert page-count equals "$EXPECTED_PAGES" 2>/dev/null; then
        echo -e "${GREEN}PASS${NC}"
        add_check "page-count" "true" "Page count matches"
    else
        echo -e "${RED}FAIL${NC}"
        add_check "page-count" "false" "Page count mismatch"
        FAILED=1
    fi
fi

# Export final report
echo -e "\n${BLUE}Generating QA report...${NC}"
mcp qa-run export-report "$REPORT_FILE" 2>/dev/null || true

# Stop MCP session
echo "Stopping MCP session..."
mcp stop qa-run

# Summary
echo -e "\n${BLUE}=== QA Summary ===${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    
    # Update report with success
    if command -v jq &> /dev/null; then
        jq '.status = "passed" | .exit_code = 0' "$REPORT_FILE" > "$REPORT_FILE.tmp" && \
        mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    fi
else
    echo -e "${RED}❌ QA FAILED${NC}"
    echo -e "${YELLOW}Check screenshots in: $SCREENSHOT_DIR${NC}"
    echo -e "${YELLOW}Full report: $REPORT_FILE${NC}"
    
    # Update report with failure
    if command -v jq &> /dev/null; then
        jq '.status = "failed" | .exit_code = 1' "$REPORT_FILE" > "$REPORT_FILE.tmp" && \
        mv "$REPORT_FILE.tmp" "$REPORT_FILE"
    fi
fi

exit $FAILED