#!/bin/bash

# Emergency Rollback Script for Claude Elite
# Provides quick recovery options for various failure scenarios

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ROLLBACK_LOG=".claude/rollback.log"
BACKUP_DIR=".claude/backups"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Logging function
log_rollback() {
    local action=$1
    local reason=$2
    echo "$(date '+%Y-%m-%d %H:%M:%S') | $action | $reason" >> "$ROLLBACK_LOG"
}

# Show usage
usage() {
    cat << EOF
🚨 Claude Elite Emergency Rollback

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  last-commit     Undo the last commit (keeps changes)
  last-n [N]      Undo the last N commits
  to-tag [TAG]    Reset to a specific tag/commit
  build-failure   Recover from build failures
  hooks-bypass    Temporarily disable git hooks
  full-reset      Complete reset to remote state
  backup          Create emergency backup
  restore [FILE]  Restore from backup

Options:
  --hard          Use hard reset (DESTRUCTIVE)
  --force         Skip confirmations
  --dry-run       Show what would be done

Examples:
  $0 last-commit                    # Undo last commit, keep changes
  $0 last-n 3 --hard               # Remove last 3 commits completely
  $0 to-tag v1.0.0                 # Reset to specific version
  $0 build-failure                 # Quick fix for build issues

EOF
}

# Confirmation prompt
confirm() {
    local message=$1
    if [[ "${FORCE:-false}" == "true" ]]; then
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  $message${NC}"
    echo -n "Are you sure? (y/N): "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            echo "Aborted."
            exit 1
            ;;
    esac
}

# Create backup
create_backup() {
    local backup_name="emergency-$(date +%s)"
    local backup_file="$BACKUP_DIR/$backup_name.tar.gz"
    
    echo -e "${BLUE}📦 Creating backup...${NC}"
    
    # Create backup of current state
    tar -czf "$backup_file" \
        --exclude=node_modules \
        --exclude=build \
        --exclude=.git \
        --exclude=venv \
        --exclude=__pycache__ \
        .
    
    echo -e "${GREEN}✓ Backup created: $backup_file${NC}"
    log_rollback "BACKUP" "Created backup $backup_name"
    
    # Clean old backups (keep last 5)
    ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
}

# Rollback last commit
rollback_last_commit() {
    local mode=${1:-soft}
    
    echo -e "${YELLOW}⏮️  Rolling back last commit...${NC}"
    
    # Get current commit info
    local last_commit=$(git log -1 --pretty=format:"%h - %s")
    echo "Last commit: $last_commit"
    
    if [[ "$mode" == "hard" ]]; then
        confirm "This will DELETE all changes from the last commit"
        git reset --hard HEAD~1
    else
        git reset --soft HEAD~1
        echo -e "${GREEN}✓ Changes preserved in working directory${NC}"
    fi
    
    log_rollback "ROLLBACK_COMMIT" "Rolled back: $last_commit (mode: $mode)"
}

# Rollback last N commits
rollback_last_n() {
    local n=$1
    local mode=${2:-soft}
    
    echo -e "${YELLOW}⏮️  Rolling back last $n commits...${NC}"
    
    # Show commits to be rolled back
    echo "Commits to be rolled back:"
    git log --oneline -n "$n"
    
    confirm "This will rollback $n commits"
    
    if [[ "$mode" == "hard" ]]; then
        git reset --hard "HEAD~$n"
    else
        git reset --soft "HEAD~$n"
        echo -e "${GREEN}✓ Changes preserved in working directory${NC}"
    fi
    
    log_rollback "ROLLBACK_N" "Rolled back $n commits (mode: $mode)"
}

# Reset to specific tag/commit
rollback_to_tag() {
    local target=$1
    local mode=${2:-soft}
    
    echo -e "${YELLOW}⏮️  Rolling back to $target...${NC}"
    
    # Verify target exists
    if ! git rev-parse "$target" >/dev/null 2>&1; then
        echo -e "${RED}❌ Target '$target' not found${NC}"
        exit 1
    fi
    
    # Show current position and target
    echo "Current: $(git log -1 --pretty=format:'%h - %s')"
    echo "Target:  $(git log -1 --pretty=format:'%h - %s' "$target")"
    
    confirm "This will reset to $target"
    
    if [[ "$mode" == "hard" ]]; then
        git reset --hard "$target"
    else
        git reset --soft "$target"
    fi
    
    log_rollback "ROLLBACK_TO" "Reset to $target (mode: $mode)"
}

# Recover from build failures
fix_build_failure() {
    echo -e "${BLUE}🔧 Attempting to fix build issues...${NC}"
    
    # Clean build artifacts
    echo "→ Cleaning build artifacts..."
    rm -rf build/
    rm -rf node_modules/.cache
    
    # Reset package-lock if corrupted
    if [ -f "package-lock.json" ]; then
        echo "→ Refreshing package-lock.json..."
        rm package-lock.json
        npm install
    fi
    
    # Clear Python cache
    echo "→ Clearing Python cache..."
    find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -delete 2>/dev/null || true
    
    # Fix permissions
    echo "→ Fixing script permissions..."
    find .claude/scripts -name "*.sh" -exec chmod +x {} \;
    find scripts -name "*.sh" -exec chmod +x {} \;
    
    echo -e "${GREEN}✓ Build environment cleaned${NC}"
    log_rollback "BUILD_FIX" "Cleaned build environment"
}

# Temporarily disable hooks
disable_hooks() {
    local duration=${1:-300}  # Default 5 minutes
    
    echo -e "${YELLOW}🔇 Disabling Git hooks for $duration seconds...${NC}"
    
    # Backup current hooks
    if [ -d ".git/hooks" ]; then
        mv .git/hooks .git/hooks.backup
        mkdir .git/hooks
        
        # Create timer to restore
        (
            sleep "$duration"
            rm -rf .git/hooks
            mv .git/hooks.backup .git/hooks
            echo -e "${GREEN}✓ Git hooks re-enabled${NC}"
        ) &
        
        echo -e "${GREEN}✓ Hooks disabled. Will re-enable in $duration seconds${NC}"
        echo "  To re-enable manually: mv .git/hooks.backup .git/hooks"
        
        log_rollback "HOOKS_DISABLED" "Disabled for $duration seconds"
    fi
}

# Full reset to remote
full_reset() {
    local branch=$(git branch --show-current)
    local remote=${1:-origin}
    
    echo -e "${RED}🚨 FULL RESET TO REMOTE STATE${NC}"
    echo "This will:"
    echo "  - Delete ALL local changes"
    echo "  - Reset to $remote/$branch"
    echo "  - Clean all untracked files"
    
    confirm "This is DESTRUCTIVE and cannot be undone"
    
    # Create backup first
    create_backup
    
    # Perform reset
    git fetch "$remote"
    git reset --hard "$remote/$branch"
    git clean -fdx
    
    echo -e "${GREEN}✓ Reset to remote state complete${NC}"
    log_rollback "FULL_RESET" "Reset to $remote/$branch"
}

# Restore from backup
restore_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}❌ Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    confirm "This will restore from backup: $backup_file"
    
    # Extract backup
    tar -xzf "$backup_file"
    
    echo -e "${GREEN}✓ Restored from backup${NC}"
    log_rollback "RESTORE" "Restored from $backup_file"
}

# Main script logic
main() {
    local command=${1:-}
    shift || true
    
    case "$command" in
        last-commit)
            rollback_last_commit "$@"
            ;;
        last-n)
            rollback_last_n "$@"
            ;;
        to-tag)
            rollback_to_tag "$@"
            ;;
        build-failure)
            fix_build_failure
            ;;
        hooks-bypass)
            disable_hooks "$@"
            ;;
        full-reset)
            full_reset "$@"
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup "$@"
            ;;
        *)
            usage
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${BLUE}💡 Tip: Check $ROLLBACK_LOG for rollback history${NC}"
}

# Parse global options
while [[ $# -gt 0 ]]; do
    case $1 in
        --hard)
            MODE="hard"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            break
            ;;
    esac
done

# Run main function
main "$@"