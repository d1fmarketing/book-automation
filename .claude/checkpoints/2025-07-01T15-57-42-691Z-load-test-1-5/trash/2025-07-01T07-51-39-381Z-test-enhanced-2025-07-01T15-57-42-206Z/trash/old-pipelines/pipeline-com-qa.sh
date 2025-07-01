#!/bin/bash
# Pipeline com QA Visual via Puppeteer (Loop Infinito)

set -e

echo "📚 PIPELINE COM QA VISUAL REAL"
echo "=============================="

# 1. Verificar capítulos
if [ -z "$(ls chapters/*.md 2>/dev/null)" ]; then
    echo "❌ Nenhum capítulo encontrado"
    exit 1
fi

# 2. Criar capa se não existir
if [ ! -f "assets/images/cover.jpg" ]; then
    mkdir -p assets/images
    touch assets/images/cover.jpg
fi

# 3. Build inicial
echo "🔨 Construindo PDF/EPUB..."
npm run build:pdf

# 4. QA Visual com Loop Infinito
echo "👁️  Iniciando QA Visual com Loop..."
node scripts/qa-visual-loop.js

# 5. Sucesso
echo ""
echo "🎉 PIPELINE COMPLETO!"
echo "📄 PDF perfeito em: build/dist/ebook.pdf"
