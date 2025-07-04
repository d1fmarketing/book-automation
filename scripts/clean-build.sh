#!/usr/bin/env bash
set -e

# Colors for output
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to show usage
usage() {
    echo "Usage: $0 [-y|--yes] [-d|--dry-run]"
    echo "  -y, --yes      Auto-confirm deletion (skip prompt)"
    echo "  -d, --dry-run  Show what would be deleted without deleting"
    echo "  -h, --help     Show this help message"
    exit 0
}

# Parse arguments
AUTO_YES=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -y|--yes)
            AUTO_YES=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

echo -e "${BLUE}🧹 Book Automation - Safe Build Cleanup${NC}"
echo -e "${BLUE}======================================${NC}\n"

# Define safe directories to clean
SAFE_DIRS=(
    "build"
    "dist"
    "release"
    "output"
    "test-output"
    "qa-reports"
    "demo-book/build"
    ".build-cache"
)

# Define file patterns to remove
FILE_PATTERNS=(
    "*.pdf"
    "*.epub"
    "*.mobi"
    "*.azw3"
    "*.kpf"
    "*.test.pdf"
    "*.demo.html"
    "*.demo.epub"
    "*.tmp.md"
    "*.backup"
)

# Define specific files in root to clean
ROOT_FILES=(
    "test.pdf"
    "demo.pdf"
    "output.html"
    "test.html"
)

# Create temp file for list
TEMP_LIST="/tmp/clean_build_list_$$.txt"
> "$TEMP_LIST"

echo -e "${YELLOW}🔍 Scanning for files to clean...${NC}\n"

# Find files in safe directories
for dir in "${SAFE_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "Checking ${BLUE}$dir/${NC}..."
        for pattern in "${FILE_PATTERNS[@]}"; do
            find "$dir" -type f -name "$pattern" 2>/dev/null >> "$TEMP_LIST" || true
        done
        # Also find HTML files in build directories (but not in protected areas)
        find "$dir" -type f -name "*.html" 2>/dev/null | grep -v "templates/" >> "$TEMP_LIST" || true
        # Find PNG files in build directories
        find "$dir" -type f -name "*.png" 2>/dev/null >> "$TEMP_LIST" || true
    fi
done

# Check for specific root files
for file in "${ROOT_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "$file" >> "$TEMP_LIST"
    fi
done

# Sort and remove duplicates
sort -u "$TEMP_LIST" -o "$TEMP_LIST"

# Count files
FILE_COUNT=$(wc -l < "$TEMP_LIST" | tr -d ' ')

if [ "$FILE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ No files to clean. Already clean!${NC}"
    rm -f "$TEMP_LIST"
    exit 0
fi

# Show what will be deleted
echo -e "${YELLOW}Found $FILE_COUNT files to clean:${NC}\n"
cat "$TEMP_LIST" | while read -r file; do
    size=$(du -h "$file" 2>/dev/null | cut -f1)
    echo -e "  ${RED}×${NC} $file ${BLUE}($size)${NC}"
done

# Calculate total size
TOTAL_SIZE=$(du -ch $(cat "$TEMP_LIST") 2>/dev/null | grep total | cut -f1)
echo -e "\n${YELLOW}Total space to recover: ${TOTAL_SIZE}${NC}"

# Safety check - ensure we're not deleting important files
PROTECTED_PATTERNS=(
    "agents/"
    "templates/"
    "docs/"
    "scripts/"
    "src/"
    "chapters/"
    ".claude/"
    "node_modules/"
)

PROTECTED_FOUND=false
for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if grep -q "$pattern" "$TEMP_LIST"; then
        echo -e "\n${RED}❌ ERROR: Found protected files matching '$pattern'${NC}"
        PROTECTED_FOUND=true
    fi
done

if [ "$PROTECTED_FOUND" = true ]; then
    echo -e "${RED}Aborting to protect important files!${NC}"
    rm -f "$TEMP_LIST"
    exit 1
fi

# Dry run mode
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}DRY RUN: No files were deleted${NC}"
    rm -f "$TEMP_LIST"
    exit 0
fi

# Confirm deletion
if [ "$AUTO_YES" = false ]; then
    echo -e "\n${YELLOW}⚠️  This will permanently delete these files!${NC}"
    echo -e "${YELLOW}Type YES (uppercase) to confirm deletion:${NC}"
    read -r CONFIRM
    
    if [[ "$CONFIRM" != "YES" ]]; then
        echo -e "${YELLOW}❌ Cancelled. No files were deleted.${NC}"
        rm -f "$TEMP_LIST"
        exit 0
    fi
fi

# Perform deletion
echo -e "\n${YELLOW}🗑️  Deleting files...${NC}"
while IFS= read -r file; do
    if [ -f "$file" ]; then
        rm -v "$file"
    fi
done < "$TEMP_LIST"

# Remove empty directories in safe locations
echo -e "\n${YELLOW}📁 Removing empty directories...${NC}"
for dir in "${SAFE_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        find "$dir" -type d -empty -delete 2>/dev/null || true
    fi
done

# Final report
echo -e "\n${GREEN}✅ Cleanup complete!${NC}"
echo -e "${GREEN}   Removed $FILE_COUNT files${NC}"
echo -e "${GREEN}   Recovered approximately $TOTAL_SIZE of space${NC}"

# Cleanup temp file
rm -f "$TEMP_LIST"

# Suggest next steps
echo -e "\n${BLUE}Next steps:${NC}"
echo -e "  1. Run ${YELLOW}npm run build:all${NC} to test fresh builds"
echo -e "  2. Run ${YELLOW}git status${NC} to verify cleanup"
echo -e "  3. Ready for production builds!"