#!/bin/bash

echo "🗑️  Testing Enhanced Trash Commands"
echo "===================================="

# Create test files
echo -e "\n1. Creating test files..."
mkdir -p test-trash-dir
echo "Test content 1" > test-trash-1.txt
echo "Test content 2" > test-trash-2.txt
echo "Chapter 5 content" > test-chapter-05.md
echo "Important file" > test-trash-dir/important.txt

# Trash the files
echo -e "\n2. Moving files to trash..."
node .claude/scripts/safe-trash.js trash test-trash-1.txt "Testing trash commands"
node .claude/scripts/safe-trash.js trash test-trash-2.txt "Also testing"
node .claude/scripts/safe-trash.js trash test-chapter-05.md "Chapter test"
node .claude/scripts/safe-trash.js trash test-trash-dir "Directory test"

# Search in trash
echo -e "\n3. Searching for items in trash..."
echo "Searching for 'chapter':"
node .claude/scripts/safe-trash.js find chapter

echo -e "\nSearching for 'test':"
node .claude/scripts/safe-trash.js find test | head -20

# Get info about a specific item
echo -e "\n4. Getting info about trash item..."
TRASH_ITEM=$(node .claude/scripts/safe-trash.js find chapter 2>/dev/null | grep -oE 'trash/[^ ]+' | head -1)
if [ -n "$TRASH_ITEM" ]; then
    node .claude/scripts/safe-trash.js info "$TRASH_ITEM"
fi

# Test restore
echo -e "\n5. Testing restore..."
# First, make sure the file doesn't exist
rm -f restored-chapter.md

# Restore by search
echo "Restoring chapter file..."
node .claude/scripts/safe-trash.js restore test-chapter-05 restored-chapter.md

if [ -f restored-chapter.md ]; then
    echo "✅ File restored successfully!"
    echo "Content: $(cat restored-chapter.md)"
    rm -f restored-chapter.md
else
    echo "❌ Restore failed"
fi

# List trash stats
echo -e "\n6. Trash statistics..."
node .claude/scripts/safe-trash.js stats

# Test clean with dry-run
echo -e "\n7. Testing clean (dry-run)..."
node .claude/scripts/safe-trash.js clean --dry-run --days=0

echo -e "\n✅ Enhanced trash commands testing complete!"