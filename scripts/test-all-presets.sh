#!/bin/bash

# Test all PDF presets
# This script runs each preset and checks if the output files are created

echo "🧪 Testing all PDF presets..."
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Function to test a preset
test_preset() {
    local preset=$1
    local expected_file=$2
    
    echo -n "Testing $preset preset... "
    
    # Run the generator
    if node scripts/generate-pdf-unified.js --preset=$preset --quiet 2>/dev/null; then
        # Check if file exists
        if [ -f "build/dist/$expected_file" ]; then
            echo -e "${GREEN}✓ PASSED${NC}"
            ((PASSED++))
        else
            echo -e "${RED}✗ FAILED (file not created)${NC}"
            ((FAILED++))
        fi
    else
        echo -e "${RED}✗ FAILED (script error)${NC}"
        ((FAILED++))
    fi
}

# Clean build directory
echo "Cleaning build directory..."
rm -rf build/dist/*

# Test each preset
echo ""
echo "Running tests:"
echo "--------------"

test_preset "main" "*.pdf"  # Filename depends on metadata
test_preset "clean" "ebook-clean.pdf"
test_preset "colorful" "tdah-descomplicado-colorful.pdf"
test_preset "full-page" "ebook-full-page.pdf"
test_preset "professional" "tdah-descomplicado.pdf"
test_preset "readable" "tdah-descomplicado-readable.pdf"

# Summary
echo ""
echo "=============================="
echo "Test Summary:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi