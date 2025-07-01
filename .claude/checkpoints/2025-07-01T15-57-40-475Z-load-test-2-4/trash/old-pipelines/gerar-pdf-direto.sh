#!/bin/bash
# Gerar PDF diretamente e renomear para ebook.pdf

echo "📚 Gerando PDF real..."

# Gerar PDF
npm run build:pdf

# Renomear para ebook.pdf
if [ -f "build/dist/título-do-seu-livro.pdf" ]; then
    mv "build/dist/título-do-seu-livro.pdf" "build/dist/ebook.pdf"
    echo "✅ PDF renomeado para ebook.pdf"
fi

# Verificar se gerou corretamente
if [ -f "build/dist/ebook.pdf" ]; then
    SIZE=$(stat -f%z "build/dist/ebook.pdf" 2>/dev/null || stat -c%s "build/dist/ebook.pdf")
    if [ $SIZE -gt 1000 ]; then
        echo "✅ PDF gerado com sucesso: $SIZE bytes"
        echo "📍 Localização: build/dist/ebook.pdf"
    else
        echo "❌ PDF muito pequeno: $SIZE bytes"
        exit 1
    fi
else
    echo "❌ PDF não foi gerado"
    exit 1
fi