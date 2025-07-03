#!/bin/bash

# GitHub Authentication Helper - Never fail auth again!
# This script ensures GitHub auth always works

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# API Vault location
API_VAULT="/Users/d1f/Desktop/.api-vault/api-manager.sh"

# Function to test GitHub token
test_github_token() {
    local token=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: token $token" \
        https://api.github.com/user)
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Function to get token from various sources
get_github_token() {
    echo -e "${YELLOW}🔍 Searching for valid GitHub token...${NC}"
    
    # 1. Try environment variable first
    if [ ! -z "$GITHUB_TOKEN" ]; then
        echo "   Checking GITHUB_TOKEN env var..."
        if test_github_token "$GITHUB_TOKEN"; then
            echo -e "${GREEN}✅ Using token from environment${NC}"
            return 0
        fi
    fi
    
    # 2. Try .env.local
    if [ -f ".env.local" ]; then
        echo "   Checking .env.local..."
        local token=$(grep "^GITHUB_TOKEN=" .env.local | cut -d= -f2 | tr -d '"')
        if [ ! -z "$token" ] && test_github_token "$token"; then
            echo -e "${GREEN}✅ Using token from .env.local${NC}"
            export GITHUB_TOKEN="$token"
            return 0
        fi
    fi
    
    # 3. Try API Vault
    if [ -f "$API_VAULT" ]; then
        echo "   Checking API Vault..."
        local token=$($API_VAULT get github token 2>/dev/null)
        if [ ! -z "$token" ] && test_github_token "$token"; then
            echo -e "${GREEN}✅ Using token from API Vault${NC}"
            export GITHUB_TOKEN="$token"
            
            # Save to .env.local for persistence
            if [ -f ".env.local" ]; then
                if grep -q "^GITHUB_TOKEN=" .env.local; then
                    sed -i.bak "s/^GITHUB_TOKEN=.*/GITHUB_TOKEN=$token/" .env.local
                else
                    echo "GITHUB_TOKEN=$token" >> .env.local
                fi
            fi
            return 0
        fi
    fi
    
    # 4. Try gh auth token
    echo "   Checking gh CLI auth..."
    local token=$(gh auth token 2>/dev/null)
    if [ ! -z "$token" ] && test_github_token "$token"; then
        echo -e "${GREEN}✅ Using token from gh CLI${NC}"
        export GITHUB_TOKEN="$token"
        
        # Save to API Vault
        if [ -f "$API_VAULT" ]; then
            $API_VAULT save github token "$token" book-automation
        fi
        
        # Save to .env.local
        if [ -f ".env.local" ]; then
            if grep -q "^GITHUB_TOKEN=" .env.local; then
                sed -i.bak "s/^GITHUB_TOKEN=.*/GITHUB_TOKEN=$token/" .env.local
            else
                echo "GITHUB_TOKEN=$token" >> .env.local
            fi
        fi
        return 0
    fi
    
    # No valid token found
    echo -e "${RED}❌ No valid GitHub token found!${NC}"
    return 1
}

# Function to setup GitHub auth
setup_github_auth() {
    echo -e "${YELLOW}🔧 Setting up GitHub authentication...${NC}\n"
    
    # Get valid token
    if ! get_github_token; then
        echo -e "${RED}Failed to find valid token${NC}"
        echo ""
        echo "Please provide a GitHub Personal Access Token:"
        echo "1. Go to https://github.com/settings/tokens"
        echo "2. Generate a new token with 'repo' scope"
        echo "3. Paste the token here:"
        read -s token
        echo ""
        
        if test_github_token "$token"; then
            echo -e "${GREEN}✅ Token is valid!${NC}"
            export GITHUB_TOKEN="$token"
            
            # Save everywhere
            if [ -f "$API_VAULT" ]; then
                $API_VAULT save github token "$token" book-automation
            fi
            
            if [ -f ".env.local" ]; then
                if grep -q "^GITHUB_TOKEN=" .env.local; then
                    sed -i.bak "s/^GITHUB_TOKEN=.*/GITHUB_TOKEN=$token/" .env.local
                else
                    echo "GITHUB_TOKEN=$token" >> .env.local
                fi
            else
                echo "GITHUB_TOKEN=$token" > .env.local
            fi
            
            # Configure gh CLI
            echo "$token" | gh auth login --with-token 2>/dev/null || true
        else
            echo -e "${RED}❌ Invalid token${NC}"
            return 1
        fi
    fi
    
    # Test gh CLI
    echo -e "\n${YELLOW}Testing GitHub CLI...${NC}"
    if gh auth status >/dev/null 2>&1; then
        echo -e "${GREEN}✅ GitHub CLI authenticated${NC}"
    else
        # Configure gh CLI with token
        echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
    fi
    
    # Show status
    echo -e "\n${GREEN}✅ GitHub authentication configured!${NC}"
    echo -e "   Token saved in:"
    echo -e "   - Environment variable: GITHUB_TOKEN"
    [ -f ".env.local" ] && echo -e "   - Local file: .env.local"
    [ -f "$API_VAULT" ] && echo -e "   - API Vault: secure storage"
    echo ""
    
    return 0
}

# Function to create PR with automatic auth
create_pr_with_auth() {
    # Ensure auth is setup
    if ! get_github_token; then
        echo -e "${YELLOW}Setting up GitHub auth first...${NC}"
        setup_github_auth || return 1
    fi
    
    # Now create PR
    echo -e "${YELLOW}Creating PR...${NC}"
    gh pr create "$@"
}

# Main command handler
case "${1:-help}" in
    test)
        if get_github_token; then
            echo -e "\n${GREEN}✅ GitHub auth is working!${NC}"
            gh auth status
        else
            echo -e "\n${RED}❌ GitHub auth not configured${NC}"
            exit 1
        fi
        ;;
    
    setup)
        setup_github_auth
        ;;
    
    pr)
        shift
        create_pr_with_auth "$@"
        ;;
    
    fix)
        # Quick fix - try to restore auth
        echo -e "${YELLOW}🔧 Attempting to fix GitHub auth...${NC}"
        setup_github_auth
        ;;
    
    help|--help|-h|*)
        cat << EOF
${GREEN}GitHub Authentication Helper${NC}

Never fail GitHub auth again! This script manages GitHub tokens across
multiple storage locations and ensures auth always works.

${YELLOW}Commands:${NC}
  test     Test if GitHub auth is working
  setup    Setup or fix GitHub authentication
  pr       Create a PR (handles auth automatically)
  fix      Quick fix for auth issues
  help     Show this help

${YELLOW}Examples:${NC}
  $0 test                    # Check if auth is working
  $0 setup                   # Setup GitHub auth
  $0 pr --title "Fix" ...    # Create PR with auto-auth

${GREEN}Storage Locations:${NC}
  1. Environment variable (GITHUB_TOKEN)
  2. Local .env.local file
  3. API Vault (secure central storage)
  4. GitHub CLI credentials

The script automatically syncs tokens between all locations.
EOF
        ;;
esac