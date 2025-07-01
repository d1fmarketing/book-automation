#!/bin/bash
# Pipeline simples e funcional

echo "📚 Pipeline de E-book"
echo "===================="

# 1. Verificar capítulos
CHAPTERS=$(ls chapters/*.md 2>/dev/null | wc -l)
if [ $CHAPTERS -eq 0 ]; then
    echo "❌ Erro: Nenhum capítulo encontrado em chapters/"
    echo "Crie arquivos .md com o conteúdo dos capítulos"
    exit 1
fi
echo "✅ $CHAPTERS capítulos encontrados"

# 2. Criar imagem de capa se não existir
if [ ! -f "assets/images/cover.jpg" ]; then
    echo "🎨 Criando capa placeholder..."
    mkdir -p assets/images
    # Tenta criar com ImageMagick, senão cria arquivo vazio
    convert -size 1600x2400 xc:navy -fill white -pointsize 100 \
        -gravity center -annotate +0+0 "E-BOOK" \
        assets/images/cover.jpg 2>/dev/null || touch assets/images/cover.jpg
fi

# 3. Gerar PDF e EPUB
echo "📄 Gerando PDF e EPUB..."
npm run build:pdf

# 4. Verificar resultado
if [ -f "build/dist/ebook.pdf" ]; then
    echo ""
    echo "✅ SUCESSO!"
    echo "📁 Arquivos gerados:"
    ls -la build/dist/
else
    echo "❌ Erro ao gerar PDF"
    exit 1
fi
