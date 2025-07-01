#!/bin/bash

echo "🔍 Verifying Claude Elite Environment..."
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node version
echo -n "Checking Node.js version... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    MIN_VERSION="18.0.0"
    
    if [[ "$(printf '%s\n' "$MIN_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$MIN_VERSION" ]]; then
        echo -e "${GREEN}✅ v$NODE_VERSION${NC}"
    else
        echo -e "${RED}❌ v$NODE_VERSION (requires >= v$MIN_VERSION)${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Not installed${NC}"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✅ v$NPM_VERSION${NC}"
else
    echo -e "${RED}❌ Not installed${NC}"
    exit 1
fi

# Check git
echo -n "Checking git... "
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | awk '{print $3}')
    echo -e "${GREEN}✅ v$GIT_VERSION${NC}"
else
    echo -e "${RED}❌ Not installed${NC}"
    exit 1
fi

# Check Python (for book automation scripts)
echo -n "Checking Python... "
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}✅ v$PYTHON_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Not installed (optional)${NC}"
fi

# Check Claude CLI installation
echo -n "Checking Claude Elite CLI... "
if [ -f ".claude/cli-headless.js" ]; then
    echo -e "${GREEN}✅ Installed${NC}"
else
    echo -e "${RED}❌ Not found${NC}"
    echo "  Run: npm install to set up Claude Elite"
fi

# Check MCP configuration
echo -n "Checking MCP configuration... "
if [ -f ".claude/mcp-configs/stack.json" ]; then
    echo -e "${GREEN}✅ Configured${NC}"
else
    echo -e "${YELLOW}⚠️  Not configured${NC}"
fi

# Check environment variables
echo ""
echo "Checking environment variables..."

check_env() {
    if [ -n "${!1}" ]; then
        echo -e "  $1: ${GREEN}✅ Set${NC}"
    else
        echo -e "  $1: ${YELLOW}⚠️  Not set${NC}"
    fi
}

# Check common MCP env vars
check_env "SUPABASE_URL"
check_env "SUPABASE_SERVICE_KEY"
check_env "BRIGHTDATA_API_KEY"
check_env "UPSTASH_REDIS_REST_URL"
check_env "UPSTASH_REDIS_REST_TOKEN"

# Check project structure
echo ""
echo "Checking project structure..."

check_dir() {
    if [ -d "$1" ]; then
        echo -e "  $1: ${GREEN}✅${NC}"
    else
        echo -e "  $1: ${YELLOW}⚠️  Missing${NC}"
    fi
}

check_file() {
    if [ -f "$1" ]; then
        echo -e "  $1: ${GREEN}✅${NC}"
    else
        echo -e "  $1: ${YELLOW}⚠️  Missing${NC}"
    fi
}

check_dir ".claude"
check_dir ".claude/commands"
check_dir ".claude/mcp-configs"
check_dir ".claude/scripts"
check_dir ".claude/templates"
check_file "package.json"
check_file "CLAUDE.md"

# Summary
echo ""
echo "======================================="
echo -e "${GREEN}✅ Environment verification complete!${NC}"
echo ""

# Add to PATH reminder
if ! echo "$PATH" | grep -q ".claude"; then
    echo -e "${YELLOW}💡 TIP: Add Claude Elite to your PATH:${NC}"
    echo "   export PATH=\"\$PATH:$(pwd)/.claude\""
    echo "   Or run: npm link"
fi