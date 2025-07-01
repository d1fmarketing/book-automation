#!/bin/bash
echo "📚 GERANDO E-BOOK COM QA VISUAL VIA MCP"
echo "======================================="

# 1. Verificar capítulos
if [ -z "$(ls chapters/*.md 2>/dev/null)" ]; then
    echo "❌ Crie capítulos primeiro!"
    exit 1
fi

# 2. Criar capa se não existir
mkdir -p assets/images
if [ ! -f assets/images/cover.jpg ]; then
    convert -size 1600x2400 xc:navy -fill white -pointsize 100 \
        -gravity center -annotate +0+0 "E-BOOK" \
        assets/images/cover.jpg 2>/dev/null || \
        echo "placeholder" > assets/images/cover.jpg
fi

# 3. Gerar PDF/EPUB
echo "🔨 Construindo PDF..."
npm run build:pdf

# 4. Verificar resultado
if [ -f build/dist/ebook.pdf ]; then
    echo "✅ PDF gerado!"
    echo ""
    echo "🤖 CLAUDE: Use MCP para QA visual:"
    echo "   1. Navegue para: file://$(pwd)/build/tmp/ebook.html"
    echo "   2. Verifique fonte, margens, contraste"
    echo "   3. Se falhar: execute make rebuild"
    echo "   4. Repita até passar"
else
    echo "❌ Erro ao gerar PDF"
    exit 1
fi