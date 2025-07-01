#!/bin/bash

# Safe Trash Helper Functions
# Source this file to use trash functions in your scripts

TRASH_SCRIPT="$(dirname "$0")/safe-trash.js"

# Safe delete function - moves to trash instead of deleting
trash() {
    local file="$1"
    local reason="${2:-manual}"
    
    if [ -z "$file" ]; then
        echo "Usage: trash <file/directory> [reason]"
        return 1
    fi
    
    node "$TRASH_SCRIPT" trash "$file" "$reason"
}

# List trash contents
trash_list() {
    node "$TRASH_SCRIPT" list "$@"
}

# Restore from trash
trash_restore() {
    local trash_path="$1"
    local target_path="$2"
    
    if [ -z "$trash_path" ]; then
        echo "Usage: trash_restore <trash-path> [target-path]"
        return 1
    fi
    
    node "$TRASH_SCRIPT" restore "$trash_path" "$target_path"
}

# Clean old trash items
trash_clean() {
    node "$TRASH_SCRIPT" clean "$@"
}

# Show trash statistics
trash_stats() {
    node "$TRASH_SCRIPT" stats
}

# Safe rm replacement
safe_rm() {
    echo "⚠️  Using safe trash instead of rm"
    trash "$@" "rm-replacement"
}

# Export functions for use in subshells
export -f trash
export -f trash_list
export -f trash_restore
export -f trash_clean
export -f trash_stats
export -f safe_rm

# Optional: Alias rm to safe_rm (uncomment to enable)
# alias rm='safe_rm'

echo "✅ Safe trash functions loaded. Use 'trash' instead of 'rm' for safety."