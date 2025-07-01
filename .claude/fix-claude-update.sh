#!/bin/bash

# Fix Claude Code CLI update issue
# Run this script with: bash .claude/fix-claude-update.sh

echo "🔧 Fixing Claude Code CLI update..."

# Option 1: Try updating via brew's npm
echo "Attempting to update via Homebrew's npm..."
/opt/homebrew/bin/npm update -g @anthropic-ai/claude-code

# Option 2: If that fails, reinstall
if [ $? -ne 0 ]; then
    echo "Update failed. Trying reinstall..."
    /opt/homebrew/bin/npm uninstall -g @anthropic-ai/claude-code
    /opt/homebrew/bin/npm install -g @anthropic-ai/claude-code
fi

# Option 3: Manual fix
if [ $? -ne 0 ]; then
    echo "Auto-fix failed. Manual steps:"
    echo "1. Run: sudo /opt/homebrew/bin/npm update -g @anthropic-ai/claude-code"
    echo "2. Or reinstall Claude from https://claude.ai/download"
fi

echo "✅ Done. Try running 'claude' again."