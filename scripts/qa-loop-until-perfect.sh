#!/bin/bash
ATTEMPT=1

while true; do
    echo "🔄 Tentativa $ATTEMPT"
    
    # Gerar PDF
    npm run build:pdf:professional
    
    # QA Visual
    timeout 60s node scripts/qa-visual-puppeteer-real.js
    
    echo "Problemas encontrados? (s/n)"
    read -r ANSWER
    
    if [ "$ANSWER" = "n" ]; then
        echo "✅ PDF PERFEITO!"
        break
    fi
    
    echo "Qual correção aplicar?"
    read -r CORRECTION
    
    # Aplicar correção (manual por enquanto)
    echo "Aplique a correção: $CORRECTION"
    echo "Pressione Enter quando pronto"
    read -r
    
    ATTEMPT=$((ATTEMPT + 1))
done