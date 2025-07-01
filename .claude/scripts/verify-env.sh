#!/bin/bash

# verify-env.sh - Verifica pré-requisitos do ambiente Claude Code CLI Elite
# Gate de Qualidade: Checklist commit ✅

set -euo pipefail

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verificando ambiente Claude Code CLI Elite..."
echo "=============================================="

# Contador de erros
ERRORS=0

# Função helper para verificar comandos
check_command() {
    local cmd=$1
    local min_version=$2
    local install_hint=$3
    
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $cmd instalado"
        if [ ! -z "$min_version" ]; then
            version=$($cmd --version 2>&1 | head -n1)
            echo "  Versão: $version"
        fi
    else
        echo -e "${RED}✗${NC} $cmd não encontrado"
        echo -e "  ${YELLOW}Instale com: $install_hint${NC}"
        ((ERRORS++))
    fi
}

# 1. Verificar Git
check_command "git" "2.0" "brew install git (macOS) ou sudo apt install git (Ubuntu)"

# 2. Verificar Node.js
check_command "node" "20.0" "https://nodejs.org/ ou nvm install 20"

# 3. Verificar npm/pnpm
check_command "npm" "" "vem com Node.js"

# 4. Verificar GitHub CLI
check_command "gh" "" "brew install gh (macOS) ou sudo apt install gh (Ubuntu)"

# 5. Verificar Python (para scripts auxiliares)
check_command "python3" "3.8" "brew install python3 ou sudo apt install python3"

# 6. Verificar se está em um repo Git
echo ""
echo "📁 Verificando repositório Git..."
if [ -d .git ]; then
    echo -e "${GREEN}✓${NC} Repositório Git detectado"
    
    # Verificar branch atual
    branch=$(git branch --show-current)
    echo "  Branch atual: $branch"
    
    # Verificar se há mudanças não commitadas
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "  ${YELLOW}⚠${NC} Existem mudanças não commitadas"
    fi
else
    echo -e "${RED}✗${NC} Não está em um repositório Git"
    echo -e "  ${YELLOW}Execute: git init${NC}"
    ((ERRORS++))
fi

# 7. Verificar autenticação GitHub
echo ""
echo "🔐 Verificando autenticação GitHub..."
if gh auth status &> /dev/null; then
    echo -e "${GREEN}✓${NC} GitHub CLI autenticado"
else
    echo -e "${YELLOW}⚠${NC} GitHub CLI não autenticado (opcional para MCP)"
    echo -e "  ${YELLOW}Para usar recursos do GitHub, execute: gh auth login${NC}"
    # Não contar como erro crítico para instalação MCP
    # ((ERRORS++))
fi

# 8. Verificar estrutura de diretórios
echo ""
echo "📂 Verificando estrutura de diretórios..."
REQUIRED_DIRS=(
    ".claude"
    ".claude/commands"
    ".claude/mcp-configs"
    ".claude/scripts"
    ".claude/templates"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir existe"
    else
        echo -e "${YELLOW}!${NC} $dir não existe (será criado)"
        mkdir -p "$dir"
    fi
done

# 9. Verificar arquivos de configuração
echo ""
echo "📄 Verificando arquivos de configuração..."
if [ -f "claude.md" ]; then
    echo -e "${GREEN}✓${NC} claude.md existe"
else
    echo -e "${YELLOW}!${NC} claude.md não existe (será criado)"
fi

# 10. Verificar variáveis de ambiente (opcional)
echo ""
echo "🔑 Verificando variáveis de ambiente..."
ENV_VARS=(
    "CLAUDE_API_KEY"
    "NODE_ENV"
)

for var in "${ENV_VARS[@]}"; do
    if [ ! -z "${!var:-}" ]; then
        echo -e "${GREEN}✓${NC} $var está definida"
    else
        echo -e "${YELLOW}!${NC} $var não está definida (opcional)"
    fi
done

# Resultado final
echo ""
echo "=============================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Ambiente pronto para Claude Code CLI Elite!${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS problemas encontrados${NC}"
    echo -e "${YELLOW}Por favor, resolva os problemas acima antes de continuar${NC}"
    exit 1
fi