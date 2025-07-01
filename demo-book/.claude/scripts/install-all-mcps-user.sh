#!/bin/bash

# Install All Desktop MCPs for User
# This script installs all MCPs found on Desktop with user scope
# Making them available in ALL projects

set -uo pipefail  # Temporarily remove -e for debugging

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Installing ALL Desktop MCPs with User Scope${NC}"
echo "================================================"
echo "This will make all MCPs available in every project!"
echo ""

# Load environment variables if available
if [ -f ".env.local" ]; then
    echo "Loading environment variables..."
    set -a
    # Use grep to filter out empty lines and comments
    while IFS='=' read -r key value; do
        if [[ -n "$key" && ! "$key" =~ ^# ]]; then
            export "$key=$value"
        fi
    done < <(grep -v '^#' .env.local | grep -v '^$')
    set +a
    echo "Environment loaded"
fi

# Counter for tracking
TOTAL=0
SUCCESS=0
FAILED=0

# Function to install MCP
install_mcp() {
    local name=$1
    local command=$2
    local extra_args=${3:-""}
    
    ((TOTAL++))
    echo -e "\n${BLUE}[$TOTAL] Installing $name...${NC}"
    
    # Check if already installed
    set +e  # Temporarily disable error exit
    claude mcp list 2>/dev/null | grep -q "^$name:"
    local is_installed=$?
    set -e  # Re-enable error exit
    
    if [ $is_installed -eq 0 ]; then
        echo -e "${YELLOW}⚠ $name already installed, skipping${NC}"
        ((SUCCESS++))
        return
    fi
    
    if claude mcp add "$name" "$command" -s user $extra_args; then
        echo -e "${GREEN}✓ $name installed successfully${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}✗ Failed to install $name${NC}"
        ((FAILED++))
    fi
}

echo -e "${YELLOW}📦 Installing TypeScript/JavaScript MCPs...${NC}"

# Core filesystem and tools
echo "DEBUG: About to install filesystem"
install_mcp "filesystem" "npx @modelcontextprotocol/server-filesystem"
echo "DEBUG: About to install memory"
install_mcp "memory" "npx @modelcontextprotocol/server-memory"
echo "DEBUG: About to install sequential"
install_mcp "sequential" "npx @modelcontextprotocol/server-sequentialthinking"

# Version control
install_mcp "github" "npx @modelcontextprotocol/server-github" "-e GITHUB_TOKEN='${GITHUB_TOKEN:-}'"
install_mcp "gitlab" "npx @modelcontextprotocol/server-gitlab"

# Cloud storage
install_mcp "gdrive" "npx @modelcontextprotocol/server-gdrive"

# Databases
install_mcp "postgres" "npx @modelcontextprotocol/server-postgres"
install_mcp "redis-mcp" "npx @modelcontextprotocol/server-redis"

# APIs and integrations
install_mcp "slack" "npx @modelcontextprotocol/server-slack"
install_mcp "google-maps" "npx @modelcontextprotocol/server-google-maps"
install_mcp "brave-search" "npx @modelcontextprotocol/server-brave-search"

# Special purpose
install_mcp "everart" "npx @modelcontextprotocol/server-everart"
install_mcp "everything" "npx @modelcontextprotocol/server-everything"
install_mcp "aws-kb" "npx @modelcontextprotocol/server-aws-kb-retrieval"

echo -e "\n${YELLOW}🐍 Installing Python MCPs...${NC}"

# Python MCPs
install_mcp "fetch" "uvx mcp-server-fetch"
install_mcp "git-mcp" "uvx mcp-server-git"
install_mcp "sentry" "uvx mcp-server-sentry"
install_mcp "sqlite" "uvx mcp-server-sqlite"
install_mcp "time-mcp" "uvx mcp-server-time"

echo -e "\n${YELLOW}🔧 Installing Third-party MCPs...${NC}"

# Third-party MCPs
install_mcp "browser-tools" "npx @agentdeskai/browser-tools-mcp"

# Check if local MCPs are built
echo -e "\n${YELLOW}🏗️ Checking local MCPs...${NC}"

# Shopify MCP
if [ -f "/Users/d1f/Desktop/Claude/shopify-mcp-server/build/index.js" ]; then
    install_mcp "shopify-local" "node /Users/d1f/Desktop/Claude/shopify-mcp-server/build/index.js"
else
    echo -e "${YELLOW}⚠ Shopify MCP not built. Build it first with:${NC}"
    echo "cd /Users/d1f/Desktop/Claude/shopify-mcp-server && npm install && npm run build"
fi

# Notion MCP
if [ -f "/Users/d1f/Desktop/AngelicalNumbers.ai/mcp-notion-server/notion/build/index.js" ]; then
    install_mcp "notion-local" "node /Users/d1f/Desktop/AngelicalNumbers.ai/mcp-notion-server/notion/build/index.js"
else
    echo -e "${YELLOW}⚠ Notion MCP not built. Build it first with:${NC}"
    echo "cd /Users/d1f/Desktop/AngelicalNumbers.ai/mcp-notion-server/notion && npm install && npm run build"
fi

# Oxylabs MCP (Python)
if [ -d "/Users/d1f/Desktop/AngelicalNumbers.ai/oxylabs-mcp/.venv" ]; then
    install_mcp "oxylabs" "cd /Users/d1f/Desktop/AngelicalNumbers.ai/oxylabs-mcp && uv run oxylabs-mcp"
else
    echo -e "${YELLOW}⚠ Oxylabs MCP not set up. Set it up with:${NC}"
    echo "cd /Users/d1f/Desktop/AngelicalNumbers.ai/oxylabs-mcp && uv sync"
fi

# Final report
echo ""
echo "================================================"
echo -e "${BLUE}📊 Installation Summary${NC}"
echo "================================================"
echo -e "Total MCPs: $TOTAL"
echo -e "${GREEN}✓ Successful: $SUCCESS${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}✗ Failed: $FAILED${NC}"
fi

echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. Run 'claude mcp list' to see all installed MCPs"
echo "2. Some MCPs need API keys. Add them to your .env.local:"
echo "   - GITHUB_TOKEN (already set)"
echo "   - GITLAB_TOKEN"
echo "   - GOOGLE_MAPS_API_KEY"
echo "   - SLACK_TOKEN"
echo "   - POSTGRES_URL"
echo "   - etc."
echo ""
echo "3. Use the MCPs in any project with Claude!"
echo ""
echo -e "${GREEN}✨ All MCPs are now available globally for user!${NC}"