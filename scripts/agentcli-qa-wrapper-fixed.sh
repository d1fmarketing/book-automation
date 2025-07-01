#!/bin/bash
# QA Wrapper - VERSÃO CORRIGIDA
# Remove dependência de agentcli

set -e

# Parse arguments
PDF=""
EPUB=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --pdf)
            PDF="$2"
            shift 2
            ;;
        --epub)
            EPUB="$2"
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

# Set defaults if not provided
PDF="${PDF:-build/dist/ebook.pdf}"
EPUB="${EPUB:-build/dist/ebook.epub}"
HTML="build/tmp/ebook.html"

echo "👁️  QA Visual Check (Corrigido)"
echo "PDF: $PDF"
echo "EPUB: $EPUB"

# Usar o script QA corrigido
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/mcp-qa-runner-fixed.sh" ]; then
    # Usar versão corrigida
    bash "$SCRIPT_DIR/mcp-qa-runner-fixed.sh" "$PDF" "$HTML"
    exit $?
elif [ -f "$SCRIPT_DIR/mcp-qa-runner.sh" ]; then
    # Fallback para original (mas provavelmente quebrado)
    bash "$SCRIPT_DIR/mcp-qa-runner.sh" "$PDF" "$HTML"
    exit $?
else
    # QA super simples
    if [ -f "$PDF" ] && [ -s "$PDF" ]; then
        echo "✅ PDF existe e tem conteúdo"
        exit 0
    else
        echo "❌ PDF não encontrado ou vazio"
        exit 1
    fi
fi
