#!/bin/bash

# Quick Fix Script - Common emergency procedures

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚑 Claude Elite Quick Fix Menu"
echo "=============================="
echo ""
echo "1) 🔧 Fix failing build"
echo "2) 🔄 Undo last commit (keep changes)"
echo "3) 💣 Undo last commit (discard changes)"
echo "4) 🔇 Disable hooks temporarily (5 min)"
echo "5) 📦 Create emergency backup"
echo "6) 🧹 Clean everything and rebuild"
echo "7) 🚨 Reset to remote (DANGEROUS)"
echo "8) 📝 Show recent git history"
echo "9) 🔍 Check what's broken"
echo "0) ❌ Exit"
echo ""
echo -n "Select option: "

read -r choice

case $choice in
    1)
        echo -e "${YELLOW}Fixing build issues...${NC}"
        make clean
        rm -rf node_modules package-lock.json
        npm install
        npm run build
        ;;
    2)
        echo -e "${YELLOW}Undoing last commit (keeping changes)...${NC}"
        git reset --soft HEAD~1
        echo -e "${GREEN}✓ Last commit undone, changes preserved${NC}"
        ;;
    3)
        echo -e "${RED}Undoing last commit (discarding changes)...${NC}"
        git reset --hard HEAD~1
        echo -e "${GREEN}✓ Last commit and changes removed${NC}"
        ;;
    4)
        echo -e "${YELLOW}Disabling hooks for 5 minutes...${NC}"
        .claude/scripts/emergency-rollback.sh hooks-bypass
        ;;
    5)
        echo -e "${YELLOW}Creating emergency backup...${NC}"
        .claude/scripts/emergency-rollback.sh backup
        ;;
    6)
        echo -e "${YELLOW}Deep cleaning and rebuilding...${NC}"
        git clean -fdx -e .env -e .claude/backups
        npm install
        make init
        ;;
    7)
        echo -e "${RED}⚠️  WARNING: This will destroy all local changes!${NC}"
        echo -n "Type 'RESET' to confirm: "
        read -r confirm
        if [ "$confirm" = "RESET" ]; then
            .claude/scripts/emergency-rollback.sh full-reset
        else
            echo "Aborted."
        fi
        ;;
    8)
        echo -e "${YELLOW}Recent git history:${NC}"
        git log --oneline -10
        ;;
    9)
        echo -e "${YELLOW}Running diagnostics...${NC}"
        echo ""
        echo "Git status:"
        git status --short
        echo ""
        echo "Last commit:"
        git log -1 --oneline
        echo ""
        echo "Hook status:"
        ls -la .git/hooks/ 2>/dev/null | grep -E "pre-commit|pre-push" || echo "No hooks found"
        echo ""
        echo "Build status:"
        [ -d "build" ] && echo "Build directory exists" || echo "No build directory"
        [ -d "node_modules" ] && echo "Node modules installed" || echo "Node modules missing"
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✓ Done!${NC}"