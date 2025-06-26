#!/bin/bash
set -euo pipefail

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}   🚀 Bootstrap do Pipeline de eBook${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

# Detectar sistema operacional
OS=""
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

echo -e "${YELLOW}Sistema detectado:${NC} $OS"

# Função para verificar comando
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 não encontrado${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 instalado${NC}"
        return 0
    fi
}

# Verificar dependências
echo -e "\n${BLUE}Verificando dependências...${NC}"

MISSING_DEPS=0

# Node.js
if ! check_command node; then
    MISSING_DEPS=1
    if [[ "$OS" == "macos" ]]; then
        echo "  Instale com: brew install node"
    elif [[ "$OS" == "linux" ]]; then
        echo "  Instale com: sudo apt install nodejs npm"
    fi
fi

# Python
if ! check_command python3; then
    MISSING_DEPS=1
    if [[ "$OS" == "macos" ]]; then
        echo "  Instale com: brew install python@3.11"
    elif [[ "$OS" == "linux" ]]; then
        echo "  Instale com: sudo apt install python3.11 python3-pip"
    fi
fi

# Pandoc
if ! check_command pandoc; then
    MISSING_DEPS=1
    echo -e "${YELLOW}⚠️  Pandoc não encontrado (opcional mas recomendado)${NC}"
    if [[ "$OS" == "macos" ]]; then
        echo "  Instale com: brew install pandoc"
    elif [[ "$OS" == "linux" ]]; then
        echo "  Instale com: sudo apt install pandoc"
    fi
fi

# Git
if ! check_command git; then
    MISSING_DEPS=1
    echo -e "${RED}Git é necessário!${NC}"
    exit 1
fi

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "\n${YELLOW}Instale as dependências faltantes e execute novamente.${NC}"
    exit 1
fi

# Configurar Git LFS
echo -e "\n${BLUE}Configurando Git LFS...${NC}"
if command -v git-lfs &> /dev/null; then
    git lfs install
    echo -e "${GREEN}✓ Git LFS configurado${NC}"
else
    echo -e "${YELLOW}⚠️  Git LFS não instalado (opcional)${NC}"
fi

# Criar estrutura de pastas
echo -e "\n${BLUE}Criando estrutura de diretórios...${NC}"
mkdir -p chapters
mkdir -p assets/{css,fonts,images}
mkdir -p scripts/phases
mkdir -p build/{temp,dist,reports}
mkdir -p .github/workflows

# Criar arquivo de exemplo se não existir
if [ ! -f "chapters/chapter-01-introducao.md" ]; then
    echo -e "${BLUE}Criando capítulo de exemplo...${NC}"
    cat > chapters/chapter-01-introducao.md << 'EOF'
---
chap: 01
title: "Introdução"
words_target: 2000
words: 0
status: draft
---

# Capítulo 1: Introdução

Este é um capítulo de exemplo. Substitua este conteúdo com sua introdução.

## Seção 1.1

Conteúdo da primeira seção...

## Seção 1.2

Conteúdo da segunda seção...
EOF
fi

echo -e "\n${GREEN}✨ Bootstrap concluído com sucesso!${NC}"
echo -e "${BLUE}Próximos passos:${NC}"
echo "1. Execute: ${YELLOW}make init${NC} para instalar as dependências"
echo "2. Adicione seus capítulos em ${YELLOW}chapters/${NC}"
echo "3. Execute: ${YELLOW}make all${NC} para gerar PDF e EPUB"