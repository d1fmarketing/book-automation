#!/bin/bash

# Test Pipeline Script - Executa o pipeline com validações

set -euo pipefail

echo "🚀 TESTANDO PIPELINE DE EBOOKS"
echo "============================="
echo ""

# Export environment variables
export STRICT_QA=true
export DEBUG_PIPE=true

# Clean previous builds
echo "🧹 Limpando builds anteriores..."
rm -rf build/ebooks/*
rm -f build/run-manifest.json

# Topic
TOPIC="What's One Brutal Truth You Learned After Starting Your Business?"

# Run orchestrator
echo "🤖 Executando orchestrator..."
echo ""

if node scripts/orchestrator.js "$TOPIC"; then
    echo ""
    echo "✅ Orchestrator completado!"
    
    # Check manifest
    if [ -f "build/run-manifest.json" ]; then
        echo ""
        echo "📊 Verificando manifest..."
        cat build/run-manifest.json | jq '.qa'
    fi
    
    # Find generated HTML
    BOOK_DIR=$(find build/ebooks -name "*.html" -type f | head -1 | xargs dirname)
    HTML_FILE=$(find build/ebooks -name "index.html" -type f | head -1)
    
    if [ -n "$HTML_FILE" ]; then
        echo ""
        echo "📄 HTML encontrado: $HTML_FILE"
        echo "📁 Diretório: $BOOK_DIR"
        
        # Basic validation
        echo ""
        echo "🔍 Validações básicas:"
        
        # Check for [object Object]
        if grep -q "\[object Object\]" "$HTML_FILE"; then
            echo "   ❌ ERRO: [object Object] encontrado!"
            exit 1
        else
            echo "   ✅ Sem [object Object]"
        fi
        
        # Check for hundefined
        if grep -q "<hundefined" "$HTML_FILE"; then
            echo "   ❌ ERRO: <hundefined> encontrado!"
            exit 1
        else
            echo "   ✅ Sem <hundefined>"
        fi
        
        # Check for images
        if grep -q "class=\"cover-image\"" "$HTML_FILE"; then
            echo "   ✅ Imagem de capa presente"
        else
            echo "   ❌ ERRO: Sem imagem de capa!"
            exit 1
        fi
        
        # Check TOC
        if grep -q "class=\"toc\"" "$HTML_FILE"; then
            echo "   ✅ TOC presente"
        else
            echo "   ❌ ERRO: Sem TOC!"
            exit 1
        fi
        
        echo ""
        echo "✅✅✅ PIPELINE PASSOU!"
        echo ""
        echo "Para abrir no browser:"
        echo "open \"$HTML_FILE\""
        
    else
        echo ""
        echo "❌ ERRO: HTML não encontrado!"
        exit 1
    fi
else
    echo ""
    echo "❌ ERRO: Orchestrator falhou!"
    exit 1
fi