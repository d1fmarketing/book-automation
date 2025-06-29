#!/bin/bash

# Agent CLI Builder Wrapper - Always emits both PDF and HTML for MCP QA
# Usage: agentcli-builder-wrapper.sh [--tweak next]

set -e

# Default parameters
MD_DIR="chapters/"
IMG_DIR="assets/images/"
OUT_DIR="build/dist/"
TMP_DIR="build/tmp/"
CSS_TEMPLATE="templates/pdf-standard.css"

# Parse arguments
TWEAK_MODE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --tweak)
            TWEAK_MODE="$2"
            shift 2
            ;;
        --md)
            MD_DIR="$2"
            shift 2
            ;;
        --img)
            IMG_DIR="$2"
            shift 2
            ;;
        --css)
            CSS_TEMPLATE="$2"
            shift 2
            ;;
        --out)
            OUT_DIR="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Ensure directories exist
mkdir -p "$OUT_DIR" "$TMP_DIR"

echo "🔨 Agent CLI Builder (with HTML export for MCP)"
echo "Markdown: $MD_DIR"
echo "Images: $IMG_DIR"
echo "CSS: $CSS_TEMPLATE"
echo "Output: $OUT_DIR"

# If tweak mode, read current preset and increment
if [ "$TWEAK_MODE" == "next" ]; then
    PRESET_FILE="build/.current-preset"
    CURRENT_PRESET=0
    
    if [ -f "$PRESET_FILE" ]; then
        CURRENT_PRESET=$(cat "$PRESET_FILE")
    fi
    
    # Increment preset
    NEXT_PRESET=$((CURRENT_PRESET + 1))
    
    # Load preset configuration
    if [ -f "presets/layout-presets.yaml" ]; then
        # Get preset count (simplified - in real implementation use yq or similar)
        PRESET_COUNT=$(grep -c "^- pass:" presets/layout-presets.yaml || echo 8)
        
        # Wrap around if needed
        if [ $NEXT_PRESET -gt $PRESET_COUNT ]; then
            NEXT_PRESET=1
        fi
        
        echo "Applying layout preset #$NEXT_PRESET"
        
        # In real implementation, parse the YAML and extract CSS template
        # For now, cycle through known templates
        case $NEXT_PRESET in
            1|4|6)
                CSS_TEMPLATE="templates/pdf-standard.css"
                ;;
            2|5)
                CSS_TEMPLATE="templates/pdf-tight.css"
                ;;
            3|7|8)
                CSS_TEMPLATE="templates/pdf-loose.css"
                ;;
        esac
        
        # Save current preset
        echo $NEXT_PRESET > "$PRESET_FILE"
    fi
fi

# Call the actual builder via Agent CLI
echo "Building PDF and EPUB..."
agentcli call builder \
    --md "$MD_DIR" \
    --img "$IMG_DIR" \
    --css "$CSS_TEMPLATE" \
    --out "$OUT_DIR"

# CRITICAL: Also generate HTML for MCP visual QA
echo "Generating HTML for visual QA..."

# The builder should have created an HTML as part of the process
# If not, we need to ensure it does
HTML_FILE="$TMP_DIR/ebook.html"

# Check if builder created HTML in temp
if [ ! -f "$HTML_FILE" ]; then
    echo "⚠️  HTML not found, requesting HTML export..."
    
    # Call builder again with HTML export flag
    agentcli call builder \
        --md "$MD_DIR" \
        --img "$IMG_DIR" \
        --css "$CSS_TEMPLATE" \
        --out "$OUT_DIR" \
        --save-html "$HTML_FILE"
fi

# Verify outputs exist
if [ ! -f "$OUT_DIR/ebook.pdf" ]; then
    echo "❌ PDF generation failed"
    exit 1
fi

if [ ! -f "$HTML_FILE" ]; then
    echo "❌ HTML generation failed (required for MCP QA)"
    exit 1
fi

echo "✅ Build complete:"
echo "  PDF: $OUT_DIR/ebook.pdf"
echo "  EPUB: $OUT_DIR/ebook.epub"
echo "  HTML: $HTML_FILE"

# If in tweak mode, show which preset was used
if [ -n "$TWEAK_MODE" ]; then
    echo "  Preset: #$NEXT_PRESET ($CSS_TEMPLATE)"
fi