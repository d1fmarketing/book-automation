#!/bin/bash
# Sistema para gerenciar múltiplos livros

set -e

# Comando principal
COMMAND="$1"
BOOK_NAME="$2"

# Função para criar novo projeto de livro
create_new_book() {
    local name="$1"
    if [ -z "$name" ]; then
        echo "Uso: ./livros.sh novo 'Nome do Livro'"
        exit 1
    fi
    
    # Criar slug do nome
    local slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
    local book_dir="livros/$slug"
    
    if [ -d "$book_dir" ]; then
        echo "❌ Livro '$name' já existe em $book_dir"
        exit 1
    fi
    
    echo "📚 Criando novo livro: $name"
    echo "📁 Diretório: $book_dir"
    
    # Criar estrutura
    mkdir -p "$book_dir"/{chapters,assets/images,context,templates,build}
    
    # Copiar templates e configurações
    cp -r templates/* "$book_dir/templates/" 2>/dev/null || true
    cp package.json "$book_dir/"
    cp -r scripts "$book_dir/"
    
    # Criar metadata
    cat > "$book_dir/metadata.yaml" << EOF
title: "$name"
author: "Seu Nome"
isbn: "978-0-000000-00-0"
language: pt-BR
created: $(date +%Y-%m-%d)
chapters_planned: 10
status: draft
EOF
    
    # Criar outline inicial
    cat > "$book_dir/outline.yaml" << EOF
title: "$name"
author: "Seu Nome"
chapters:
  - number: 1
    title: "Introdução"
    topics:
      - "Apresentação"
      - "Objetivos"
    words_target: 2000
    
  - number: 2
    title: "Desenvolvimento"
    topics:
      - "Conceitos principais"
      - "Exemplos práticos"
    words_target: 3000
    
  - number: 3
    title: "Conclusão"
    topics:
      - "Resumo"
      - "Próximos passos"
    words_target: 1500
EOF
    
    # Criar capítulo exemplo
    cat > "$book_dir/chapters/chapter-01-introducao.md" << 'EOF'
---
chap: 01
title: "Introdução"
words_target: 2000
words: 0
status: draft
---

# Capítulo 1: Introdução

[Escreva o conteúdo do primeiro capítulo aqui]

![AI-IMAGE: Uma imagem inspiradora relacionada ao tema do livro]()

## Seção 1.1

Conteúdo da primeira seção...

## Seção 1.2

Conteúdo da segunda seção...
EOF
    
    # Criar script de build local
    cat > "$book_dir/build.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "🔨 Construindo livro..."
npm install --silent
npm run build:pdf
echo "✅ PDF gerado em build/dist/ebook.pdf"
EOF
    chmod +x "$book_dir/build.sh"
    
    echo ""
    echo "✅ Livro '$name' criado com sucesso!"
    echo ""
    echo "📝 Próximos passos:"
    echo "1. cd $book_dir"
    echo "2. Edite os capítulos em chapters/"
    echo "3. Execute ./build.sh para gerar o PDF"
    echo ""
}

# Função para listar livros
list_books() {
    echo "📚 Livros existentes:"
    echo ""
    
    if [ ! -d "livros" ] || [ -z "$(ls -A livros 2>/dev/null)" ]; then
        echo "Nenhum livro encontrado."
        echo "Use: ./livros.sh novo 'Nome do Livro'"
        return
    fi
    
    for book_dir in livros/*/; do
        if [ -f "$book_dir/metadata.yaml" ]; then
            local title=$(grep "^title:" "$book_dir/metadata.yaml" | cut -d'"' -f2)
            local status=$(grep "^status:" "$book_dir/metadata.yaml" | cut -d' ' -f2)
            local chapters=$(ls "$book_dir/chapters/"*.md 2>/dev/null | wc -l)
            local pdf_exists="❌"
            [ -f "$book_dir/build/dist/ebook.pdf" ] && pdf_exists="✅"
            
            echo "📖 $title"
            echo "   📁 Pasta: $(basename "$book_dir")"
            echo "   📊 Status: $status"
            echo "   📝 Capítulos: $chapters"
            echo "   📄 PDF: $pdf_exists"
            echo ""
        fi
    done
}

# Função para construir livro
build_book() {
    local slug="$1"
    if [ -z "$slug" ]; then
        echo "Uso: ./livros.sh build nome-do-livro"
        exit 1
    fi
    
    local book_dir="livros/$slug"
    
    if [ ! -d "$book_dir" ]; then
        echo "❌ Livro não encontrado: $book_dir"
        echo "Use: ./livros.sh listar"
        exit 1
    fi
    
    echo "🔨 Construindo livro em $book_dir..."
    cd "$book_dir"
    
    # Instalar dependências se necessário
    if [ ! -d "node_modules" ]; then
        echo "Instalando dependências..."
        npm install --silent
    fi
    
    # Executar build
    npm run build:pdf
    
    if [ -f "build/dist/ebook.pdf" ]; then
        echo "✅ PDF gerado com sucesso!"
        echo "📄 Arquivo: $book_dir/build/dist/ebook.pdf"
    else
        echo "❌ Erro ao gerar PDF"
        exit 1
    fi
}

# Menu principal
case "$COMMAND" in
    novo|new)
        create_new_book "$BOOK_NAME"
        ;;
    listar|list)
        list_books
        ;;
    build|construir)
        build_book "$BOOK_NAME"
        ;;
    *)
        echo "📚 Sistema de Gerenciamento de E-books"
        echo ""
        echo "Comandos disponíveis:"
        echo "  ./livros.sh novo 'Nome do Livro'    - Criar novo projeto de livro"
        echo "  ./livros.sh listar                  - Listar todos os livros"
        echo "  ./livros.sh build nome-do-livro     - Construir PDF do livro"
        echo ""
        echo "Exemplo:"
        echo "  ./livros.sh novo 'Meu Primeiro Livro'"
        echo "  ./livros.sh build meu-primeiro-livro"
        ;;
esac
