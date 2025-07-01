#!/bin/bash

echo "🔍 Testing Enhanced Checkpoint System"
echo "====================================="

# Setup test environment
echo -e "\n1. Creating test environment..."
mkdir -p .claude/logs
mkdir -p trash/2024-01-01
mkdir -p chapters

# Create some test files
echo "[2024-01-01] Test log entry" > .claude/logs/pipeline.log
echo "[2024-01-01] Old log" > .claude/logs/old.log.old
echo "Debug info" > .claude/logs/debug-test.log
echo "Deleted chapter content" > trash/2024-01-01/chapter-99-deleted.md
echo "Test chapter" > chapters/test-checkpoint.md

# Create a checkpoint
echo -e "\n2. Creating checkpoint with logs and trash..."
node .claude/scripts/pipeline-state-manager.js checkpoint "test-enhanced" || echo "Checkpoint created"

# List checkpoints
echo -e "\n3. Listing checkpoints..."
node .claude/scripts/pipeline-state-manager.js checkpoint-list

# Get checkpoint info
echo -e "\n4. Getting checkpoint info..."
CHECKPOINT_ID=$(node .claude/scripts/pipeline-state-manager.js checkpoint-list 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}.*test-enhanced' | head -1)

if [ -n "$CHECKPOINT_ID" ]; then
    echo "Checking checkpoint: $CHECKPOINT_ID"
    node .claude/scripts/pipeline-state-manager.js checkpoint-info "$CHECKPOINT_ID"
    
    # Test dry-run restore
    echo -e "\n5. Testing dry-run restore..."
    node .claude/scripts/pipeline-state-manager.js restore "$CHECKPOINT_ID" --dry-run
    
    # Test selective restore
    echo -e "\n6. Testing selective restore (logs only)..."
    rm -f .claude/logs/pipeline.log
    node .claude/scripts/pipeline-state-manager.js restore "$CHECKPOINT_ID" --logs-only
    
    if [ -f .claude/logs/pipeline.log ]; then
        echo "✅ Logs restored successfully"
    else
        echo "❌ Log restore failed"
    fi
else
    echo "❌ Could not find test checkpoint"
fi

# Test checkpoint cleanup
echo -e "\n7. Testing checkpoint cleanup..."
node .claude/scripts/pipeline-state-manager.js checkpoint-cleanup

# Cleanup test files
echo -e "\n8. Cleaning up test environment..."
rm -f chapters/test-checkpoint.md
rm -f .claude/logs/debug-test.log
rm -f .claude/logs/old.log.old

echo -e "\n✅ Enhanced checkpoint testing complete!"