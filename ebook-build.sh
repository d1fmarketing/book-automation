#!/bin/bash

# Unified eBook Build Pipeline
# Consolidates functionality from all previous pipeline scripts

set -e  # Exit on error

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERBOSE=false
QA_MODE=false
OUTPUT_DIR=""
RENAME_PDF=false
SIMPLE_MODE=false
TIMESTAMP_OUTPUT=false

# Function to show help
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Unified eBook build pipeline with configurable options.

Options:
  -v, --verbose         Show detailed output
  -q, --qa              Run visual QA loop after build
  -o, --output DIR      Custom output directory
  -r, --rename          Rename PDF based on metadata title
  -s, --simple          Simple mode (minimal output)
  -t, --timestamp       Create timestamped output directory
  -h, --help            Show this help message

Examples:
  $0                    # Basic build
  $0 -q                 # Build with QA loop
  $0 -o mybook/v1      # Custom output directory
  $0 -v -q -r          # Verbose QA with rename
  $0 -t -q             # Timestamped output with QA

EOF
}

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--qa)
            QA_MODE=true
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -r|--rename)
            RENAME_PDF=true
            shift
            ;;
        -s|--simple)
            SIMPLE_MODE=true
            shift
            ;;
        -t|--timestamp)
            TIMESTAMP_OUTPUT=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_message "$RED" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Header
if [ "$SIMPLE_MODE" = false ]; then
    print_message "$BLUE" "┌─────────────────────────────────────┐"
    print_message "$BLUE" "│     📚 eBook Build Pipeline 📚      │"
    print_message "$BLUE" "└─────────────────────────────────────┘"
    echo
fi

# Check for required files
print_message "$YELLOW" "🔍 Checking project structure..."

if [ ! -f "metadata.yaml" ]; then
    print_message "$RED" "❌ Error: metadata.yaml not found!"
    exit 1
fi

if [ ! -d "chapters" ]; then
    print_message "$RED" "❌ Error: chapters/ directory not found!"
    exit 1
fi

# Count chapters
CHAPTER_COUNT=$(ls -1 chapters/chapter-*.md 2>/dev/null | wc -l)
if [ "$CHAPTER_COUNT" -eq 0 ]; then
    print_message "$RED" "❌ Error: No chapters found in chapters/ directory!"
    exit 1
fi

if [ "$VERBOSE" = true ]; then
    print_message "$GREEN" "✅ Found $CHAPTER_COUNT chapters"
fi

# Check for cover image
if [ ! -f "assets/images/cover.jpg" ] && [ ! -f "assets/images/cover.png" ]; then
    print_message "$YELLOW" "⚠️  No cover image found. Creating placeholder..."
    mkdir -p assets/images
    
    # Create a simple placeholder cover using ImageMagick if available
    if command -v convert &> /dev/null; then
        convert -size 1600x2400 xc:lightblue \
                -gravity center -pointsize 60 -fill black \
                -annotate +0+0 "Book Cover\n(Placeholder)" \
                assets/images/cover.jpg
        print_message "$GREEN" "✅ Placeholder cover created"
    else
        # Create empty file as last resort
        touch assets/images/cover.jpg
        print_message "$YELLOW" "⚠️  Created empty cover file (install ImageMagick for better placeholder)"
    fi
fi

# Set up output directory
if [ "$TIMESTAMP_OUTPUT" = true ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BASE_OUTPUT_DIR="${OUTPUT_DIR:-build/output/${TIMESTAMP}}"
else
    BASE_OUTPUT_DIR="${OUTPUT_DIR:-build/dist}"
fi

mkdir -p "$BASE_OUTPUT_DIR"

# Build the PDF
print_message "$YELLOW" "🔨 Building PDF..."

if [ "$VERBOSE" = true ]; then
    npm run build:pdf
else
    npm run build:pdf > /dev/null 2>&1
fi

# Check if PDF was created
if [ ! -f "build/dist/ebook.pdf" ]; then
    print_message "$RED" "❌ Error: PDF generation failed!"
    exit 1
fi

# Handle PDF renaming if requested
if [ "$RENAME_PDF" = true ]; then
    # Extract title from metadata
    TITLE=$(grep "^title:" metadata.yaml | cut -d'"' -f2 | sed 's/[^a-zA-Z0-9-]/_/g')
    if [ -n "$TITLE" ]; then
        PDF_NAME="${TITLE}.pdf"
    else
        PDF_NAME="ebook.pdf"
    fi
else
    PDF_NAME="ebook.pdf"
fi

# Move PDF to output directory
mv build/dist/ebook.pdf "$BASE_OUTPUT_DIR/$PDF_NAME"

# Get file size
PDF_SIZE=$(ls -lh "$BASE_OUTPUT_DIR/$PDF_NAME" | awk '{print $5}')

print_message "$GREEN" "✅ PDF generated successfully!"
print_message "$GREEN" "   📄 Output: $BASE_OUTPUT_DIR/$PDF_NAME"
print_message "$GREEN" "   📊 Size: $PDF_SIZE"

# Build EPUB if script exists
if [ -f "scripts/build-epub.js" ]; then
    print_message "$YELLOW" "🔨 Building EPUB..."
    
    if [ "$VERBOSE" = true ]; then
        npm run build:epub
    else
        npm run build:epub > /dev/null 2>&1
    fi
    
    if [ -f "build/dist/ebook.epub" ]; then
        mv build/dist/ebook.epub "$BASE_OUTPUT_DIR/"
        EPUB_SIZE=$(ls -lh "$BASE_OUTPUT_DIR/ebook.epub" | awk '{print $5}')
        print_message "$GREEN" "✅ EPUB generated successfully!"
        print_message "$GREEN" "   📱 Output: $BASE_OUTPUT_DIR/ebook.epub"
        print_message "$GREEN" "   📊 Size: $EPUB_SIZE"
    fi
fi

# Run QA if requested
if [ "$QA_MODE" = true ]; then
    print_message "$YELLOW" "🔍 Running Visual QA..."
    
    if [ -f "scripts/qa-visual-loop.js" ]; then
        node scripts/qa-visual-loop.js "$BASE_OUTPUT_DIR/$PDF_NAME"
    else
        print_message "$YELLOW" "⚠️  QA script not found. Please ask Claude to verify the PDF using MCP:"
        echo
        print_message "$BLUE" "\"Claude, please use MCP to verify the PDF at $BASE_OUTPUT_DIR/$PDF_NAME\""
        echo
    fi
fi

# Create README if timestamped output
if [ "$TIMESTAMP_OUTPUT" = true ]; then
    cat > "$BASE_OUTPUT_DIR/README.md" << EOF
# eBook Build - $TIMESTAMP

## Files Generated
- **PDF**: $PDF_NAME${PDF_SIZE:+ ($PDF_SIZE)}
${EPUB_SIZE:+- **EPUB**: ebook.epub ($EPUB_SIZE)}

## Build Info
- Chapters: $CHAPTER_COUNT
- Timestamp: $(date '+%Y-%m-%d %H:%M:%S')
- Options: ${VERBOSE:+verbose }${QA_MODE:+qa }${RENAME_PDF:+rename}

## Verification
To verify the PDF with Claude's MCP tools, use:
\`\`\`
"Claude, please verify the PDF at $BASE_OUTPUT_DIR/$PDF_NAME"
\`\`\`
EOF
    
    print_message "$GREEN" "📝 Created README.md in output directory"
fi

# Summary
if [ "$SIMPLE_MODE" = false ]; then
    echo
    print_message "$BLUE" "┌─────────────────────────────────────┐"
    print_message "$BLUE" "│        ✨ Build Complete! ✨        │"
    print_message "$BLUE" "└─────────────────────────────────────┘"
    echo
    print_message "$GREEN" "📁 Output Directory: $BASE_OUTPUT_DIR"
    
    # List all files in output directory
    echo
    print_message "$YELLOW" "📋 Generated files:"
    ls -la "$BASE_OUTPUT_DIR" | grep -E "\.(pdf|epub|md)$" | awk '{print "   • " $9 " (" $5 ")"}'
fi

# Exit successfully
exit 0