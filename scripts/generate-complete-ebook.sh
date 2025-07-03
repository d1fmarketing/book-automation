#!/bin/bash
# Pipeline Completa de Ebook Digital
# Última atualização: 2025-07-03

set -e  # Parar se houver erro

echo "🚀 Pipeline Completa de Ebook Digital"
echo "====================================="
echo ""

# Verificar se há capítulos
if [ ! -d "chapters" ] || [ -z "$(ls -A chapters/*.md 2>/dev/null)" ]; then
    echo "❌ Erro: Nenhum capítulo encontrado em chapters/"
    echo "   Crie arquivos .md na pasta chapters/ primeiro"
    exit 1
fi

# 1. Gerar capa (opcional)
if [ -n "$GENERATE_COVER" ]; then
    echo "🎨 Gerando capa com Ideogram..."
    node gerar-capa-ideogram.js || {
        echo "⚠️  Aviso: Falha ao gerar capa (continuando sem capa)"
    }
    echo ""
fi

# 2. Gerar HTML responsivo
echo "📄 Gerando HTML responsivo..."
npm run build:html:digital
echo ""

# 3. Verificar overflows
echo "🔍 Verificando DOM para overflows..."
npm run qa:dom:digital || {
    echo "⚠️  Aviso: Detectados overflows no HTML"
    echo "   Verifique os logs acima"
}
echo ""

# 4. Gerar PDF digital
echo "📕 Gerando PDF digital..."
npm run build:pdf:digital || {
    echo "❌ Erro ao gerar PDF"
    exit 1
}
echo ""

# 5. Gerar EPUB (opcional)
if [ -n "$GENERATE_EPUB" ]; then
    echo "📘 Gerando EPUB..."
    npm run build:epub || {
        echo "⚠️  Aviso: Falha ao gerar EPUB"
    }
    echo ""
fi

# 6. Validar PDF com testes de compatibilidade
echo "🔍 Validando PDF para Adobe Acrobat..."
# Usar o PDF digital se existir
if [ -f "build/dist/ebook-digital-final.pdf" ]; then
    PDF_TO_CHECK="build/dist/ebook-digital-final.pdf"
else
    PDF_TO_CHECK="build/dist/ebook.pdf"
fi

# Validações básicas
echo "📊 Validando estrutura do PDF..."
qpdf --check "$PDF_TO_CHECK" 2>&1 | grep -E "error|warning|No syntax" || true
pdfinfo "$PDF_TO_CHECK" 2>/dev/null | grep -E "Pages:|Page size:|Producer:" || true
echo ""

# 7. Gerar preview da primeira página
echo "📸 Gerando preview..."
mkdir -p build/preview
pdftoppm -png -f 1 -l 1 build/dist/ebook-digital-with-cover.pdf build/preview/cover 2>/dev/null || {
    pdftoppm -png -f 1 -l 1 build/dist/ebook.pdf build/preview/cover 2>/dev/null || {
        echo "⚠️  Aviso: Não foi possível gerar preview"
    }
}

# 8. Relatório final
echo ""
echo "✅ Pipeline completa!"
echo "===================="
echo ""
echo "📁 Arquivos gerados:"
ls -lah build/dist/*.pdf 2>/dev/null | tail -5
echo ""
echo "📊 Estatísticas:"
if [ -f "build/dist/ebook.pdf" ] || [ -f "build/dist/ebook-digital-with-cover.pdf" ]; then
    PDF_FILE=$(ls -t build/dist/*.pdf | head -1)
    echo "   PDF: $(basename $PDF_FILE)"
    pdfinfo "$PDF_FILE" 2>/dev/null | grep -E "Pages:|File size:" || echo "   (pdfinfo não disponível)"
fi
echo ""
echo "🚀 Próximos passos:"
echo "   1. Revisar o PDF gerado"
echo "   2. Testar em diferentes dispositivos"
echo "   3. Publicar com: npm run publish:kdp"
echo ""
echo "💡 Dica: Use variáveis de ambiente:"
echo "   GENERATE_COVER=1 ./scripts/generate-complete-ebook.sh  # Gerar capa"
echo "   GENERATE_EPUB=1 ./scripts/generate-complete-ebook.sh   # Gerar EPUB também"