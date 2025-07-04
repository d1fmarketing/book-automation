#!/bin/bash

# VERIFY AND FIX LOOP - Zero tolerância para falhas
# Executa o pipeline até funcionar 100%

set -euo pipefail

echo "🚨 ENGENHEIRO BRAVO - VERIFY & FIX LOOP"
echo "======================================="
echo ""

# Config
export STRICT_QA=true
export IDEO_API_KEY=${IDEO_KEY:-${IDEOGRAM_API_KEY:-}}
export PERPLEXITY_KEY=${PP_KEY:-${PERPLEXITY_API_KEY:-}}
export DEBUG_PIPE=true

# Limits
MAX_ATTEMPTS=5
ATTEMPT=0

# Topic
TOPIC=${1:-"What's One Brutal Truth You Learned After Starting Your Business?"}

echo "📚 Topic: $TOPIC"
echo "🔧 Max attempts: $MAX_ATTEMPTS"
echo ""

# Clean start
echo "🧹 Cleaning previous builds..."
rm -rf build/ebooks/*
rm -f build/run-manifest.json

# Main loop
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo ""
    echo "════════════════════════════════════════"
    echo "🔄 ATTEMPT $ATTEMPT/$MAX_ATTEMPTS"
    echo "════════════════════════════════════════"
    echo ""
    
    # Run orchestrator
    echo "🚀 Running orchestrator..."
    if node scripts/orchestrator.js "$TOPIC"; then
        echo "✅ Orchestrator completed!"
        
        # Find the generated HTML
        BOOK_DIR=$(ls -d build/ebooks/*/ | head -1)
        HTML_PATH="${BOOK_DIR}html/index.html"
        
        if [ ! -f "$HTML_PATH" ]; then
            echo "❌ HTML not found at: $HTML_PATH"
            continue
        fi
        
        # Run visual QA
        echo ""
        echo "🔍 Running Visual QA..."
        if node qa/qa-html-mcp.js --input "$HTML_PATH" --lighthouse 90; then
            echo ""
            echo "✅✅✅ PIPELINE PASSOU! QA VISUAL APROVADO!"
            echo ""
            echo "📁 Book directory: $BOOK_DIR"
            echo "📄 HTML: $HTML_PATH"
            echo ""
            
            # Open in browser
            if command -v open >/dev/null 2>&1; then
                echo "🌐 Opening in browser..."
                open "$HTML_PATH"
            fi
            
            exit 0
        else
            echo "❌ Visual QA failed, retrying..."
        fi
    else
        echo "❌ Orchestrator failed, retrying..."
    fi
    
    # Wait before retry
    if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
        echo "⏳ Waiting 10 seconds before retry..."
        sleep 10
    fi
done

echo ""
echo "❌❌❌ FAILED AFTER $MAX_ATTEMPTS ATTEMPTS!"
echo ""
echo "Debug tips:"
echo "1. Check build/logs/ for detailed errors"
echo "2. Run with DEBUG=* for more output"
echo "3. Verify API keys are set correctly"
echo ""

exit 1