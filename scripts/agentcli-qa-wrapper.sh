#!/bin/bash

# Agent CLI QA Wrapper - Integrates MCP visual validation
# This wraps the mcp-qa-runner.sh for use with agentcli

set -e

# Default paths
PDF_PATH="build/dist/ebook.pdf"
HTML_PATH="build/tmp/ebook.html"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --pdf)
            PDF_PATH="$2"
            shift 2
            ;;
        --epub)
            # EPUB path provided but we focus on PDF for now
            EPUB_PATH="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Ensure script directory is in PATH for mcp-qa-runner.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔍 Agent CLI QA (MCP Visual Validation)"
echo "PDF: $PDF_PATH"
echo "HTML: $HTML_PATH"

# Check if files exist
if [ ! -f "$PDF_PATH" ]; then
    echo "❌ PDF not found: $PDF_PATH"
    exit 1
fi

if [ ! -f "$HTML_PATH" ]; then
    echo "⚠️  HTML not found: $HTML_PATH"
    echo "Attempting to generate HTML from PDF metadata..."
    
    # In a real implementation, we'd call the builder to regenerate
    # For now, we'll fail if HTML is missing
    echo "❌ HTML required for visual QA. Ensure builder exports HTML."
    exit 1
fi

# Run MCP QA validation
echo "Starting MCP visual validation..."
"$SCRIPT_DIR/mcp-qa-runner.sh" "$PDF_PATH" "$HTML_PATH"

# Exit with same code as MCP runner
exit $?