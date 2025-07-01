#!/bin/bash
# Pipeline Completo - FUNCIONAL
# Sem agentcli, sem mcp externo, só o que funciona

set -e

echo "📚 PIPELINE DE E-BOOK - VERSÃO FUNCIONAL"
echo "========================================"

# 1. VERIFICAR CAPÍTULOS
echo ""
echo "📝 Passo 1: Verificando capítulos..."
CHAPTER_COUNT=$(ls chapters/*.md 2>/dev/null | wc -l)

if [ $CHAPTER_COUNT -eq 0 ]; then
    echo "❌ ERRO: Nenhum capítulo encontrado em chapters/"
    echo ""
    echo "Para criar capítulos:"
    echo "1. Crie arquivos .md em chapters/"
    echo "2. Ou peça para o Claude criar usando filesystem:write_file"
    echo ""
    echo "Exemplo de capítulo:"
    echo "---"
    echo "chap: 01"
    echo "title: \"Introdução\""
    echo "words: 500"
    echo "---"
    echo ""
    echo "# Capítulo 1: Introdução"
    echo "Conteúdo do capítulo aqui..."
    exit 1
fi

echo "✅ $CHAPTER_COUNT capítulos encontrados:"
ls chapters/*.md | head -5
[ $CHAPTER_COUNT -gt 5 ] && echo "   ... e mais $(($CHAPTER_COUNT - 5))"

# 2. CRIAR IMAGEM DE CAPA
echo ""
echo "🎨 Passo 2: Verificando imagem de capa..."
COVER_PATH="assets/images/cover.jpg"

if [ ! -f "$COVER_PATH" ]; then
    echo "Criando capa placeholder..."
    mkdir -p assets/images
    
    # Tentar criar com ImageMagick
    if command -v convert &> /dev/null; then
        convert -size 1600x2400 \
            -background '#1e3a8a' \
            -fill white \
            -font Arial-Bold \
            -pointsize 120 \
            -gravity center \
            -annotate +0-200 "E-BOOK" \
            -pointsize 60 \
            -annotate +0+100 "$(date +%Y)" \
            "$COVER_PATH" 2>/dev/null && \
            echo "✅ Capa criada com ImageMagick" || \
            echo "⚠️  ImageMagick falhou"
    fi
    
    # Se não conseguiu criar, fazer placeholder vazio
    if [ ! -f "$COVER_PATH" ]; then
        touch "$COVER_PATH"
        echo "⚠️  Criado cover.jpg vazio (substitua por uma imagem real)"
    fi
else
    echo "✅ Capa já existe"
fi

# 3. CONSTRUIR PDF E EPUB
echo ""
echo "📄 Passo 3: Gerando PDF e EPUB..."

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ ERRO: npm não encontrado. Instale Node.js primeiro."
    exit 1
fi

# Verificar se dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

# Gerar PDF/EPUB
echo "Executando build..."
if npm run build:pdf; then
    echo "✅ Build executado com sucesso"
else
    echo "❌ ERRO no build"
    echo "Verifique os logs acima"
    exit 1
fi

# 4. VERIFICAR RESULTADOS
echo ""
echo "🔍 Passo 4: Verificando arquivos gerados..."

PDF_FILE="build/dist/ebook.pdf"
EPUB_FILE="build/dist/ebook.epub"
SUCCESS=true

if [ -f "$PDF_FILE" ] && [ -s "$PDF_FILE" ]; then
    PDF_SIZE=$(ls -lh "$PDF_FILE" | awk '{print $5}')
    echo "✅ PDF gerado: $PDF_FILE ($PDF_SIZE)"
else
    echo "❌ PDF não encontrado ou vazio"
    SUCCESS=false
fi

if [ -f "$EPUB_FILE" ] && [ -s "$EPUB_FILE" ]; then
    EPUB_SIZE=$(ls -lh "$EPUB_FILE" | awk '{print $5}')
    echo "✅ EPUB gerado: $EPUB_FILE ($EPUB_SIZE)"
else
    echo "⚠️  EPUB não encontrado (não crítico)"
fi

# 5. ORGANIZAR OUTPUT
if [ "$SUCCESS" = true ]; then
    echo ""
    echo "📦 Passo 5: Organizando arquivos..."
    
    # Criar pasta com timestamp
    OUTPUT_DIR="output/ebook-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$OUTPUT_DIR"
    
    # Copiar arquivos
    cp "$PDF_FILE" "$OUTPUT_DIR/" 2>/dev/null || true
    [ -f "$EPUB_FILE" ] && cp "$EPUB_FILE" "$OUTPUT_DIR/"
    
    # Criar README
    cat > "$OUTPUT_DIR/README.txt" << EOF
E-book gerado em: $(date)
Capítulos: $CHAPTER_COUNT
Pipeline: book-automation v1.0

Arquivos:
- ebook.pdf: Versão para impressão (6x9")
- ebook.epub: Versão para e-readers

Para visualizar:
- Mac: open ebook.pdf
- Linux: xdg-open ebook.pdf
- Windows: start ebook.pdf
EOF
    
    echo "✅ Arquivos organizados em: $OUTPUT_DIR"
    
    # SUCESSO FINAL
    echo ""
    echo "🎉 ============================== 🎉"
    echo "   PIPELINE CONCLUÍDO COM SUCESSO!"
    echo "🎉 ============================== 🎉"
    echo ""
    echo "📚 Seu e-book está pronto em:"
    echo "   $OUTPUT_DIR/ebook.pdf"
    echo ""
    echo "Para abrir:"
    echo "   open $OUTPUT_DIR/ebook.pdf"
else
    echo ""
    echo "❌ PIPELINE FALHOU"
    echo "Verifique os erros acima e tente novamente"
    exit 1
fi
