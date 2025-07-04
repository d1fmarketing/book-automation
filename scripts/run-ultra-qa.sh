#!/bin/bash

# Ultra-QA Test Runner
# Runs comprehensive quality tests on ebook output

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BOOK_DIR="${1:-build/test-book}"
OUTPUT_DIR="${2:-test-results/ultra-qa}"
SUITES="${3:-html,pdf,content}"

echo -e "${BLUE}🚀 Ultra-QA Test Runner${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Book Directory: $BOOK_DIR"
echo "Output Directory: $OUTPUT_DIR"
echo "Test Suites: $SUITES"
echo ""

# Check if book directory exists
if [ ! -d "$BOOK_DIR" ]; then
    echo -e "${RED}❌ Error: Book directory not found: $BOOK_DIR${NC}"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Install dependencies if needed
if [ ! -d "tests/ultra-qa/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing test dependencies...${NC}"
    cd tests/ultra-qa
    npm install --silent
    cd ../..
fi

# Run the tests
echo -e "${BLUE}🧪 Running Ultra-QA tests...${NC}"
echo ""

node tests/ultra-qa/index.js "$BOOK_DIR" \
    --suites "$SUITES" \
    --output "$OUTPUT_DIR" \
    --verbose

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All tests passed!${NC}"
    
    # Show report location
    echo ""
    echo "📊 Reports generated:"
    echo "   - HTML: $OUTPUT_DIR/report.html"
    echo "   - JSON: $OUTPUT_DIR/results.json"
    echo "   - JUnit: $OUTPUT_DIR/junit.xml"
    
    exit 0
else
    echo ""
    echo -e "${RED}❌ Tests failed!${NC}"
    
    # Show failure summary
    if [ -f "$OUTPUT_DIR/results.json" ]; then
        echo ""
        echo "📋 Failure Summary:"
        node -e "
            const results = require('./$OUTPUT_DIR/results.json');
            const failures = [];
            Object.entries(results.suites).forEach(([suite, data]) => {
                if (data.failures) {
                    data.failures.forEach(f => {
                        failures.push(\`  • \${suite}/\${f.test}: \${f.message}\`);
                    });
                }
            });
            console.log(failures.slice(0, 5).join('\\n'));
            if (failures.length > 5) {
                console.log(\`  ... and \${failures.length - 5} more failures\`);
            }
        " 2>/dev/null || true
    fi
    
    exit 1
fi