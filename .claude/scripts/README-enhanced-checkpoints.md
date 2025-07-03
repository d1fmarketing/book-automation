# Enhanced Checkpoint System

## Overview

The enhanced checkpoint system provides comprehensive backup and restore capabilities for the book automation pipeline. It now includes logs, trash, and selective restoration options.

## Key Features

### 1. **Comprehensive Checkpoints**

- **State Data**: Pipeline state, phase progress, metrics
- **Files**: Chapters, assets, context files
- **Logs**: Pipeline logs with smart filtering
- **Trash**: Recently deleted files for recovery
- **Manifests**: Detailed metadata about checkpoint contents

### 2. **Smart Inclusion Rules**

#### Log Files

```yaml
logs:
  max_file_size_mb: 50    # Skip large logs
  include_patterns:
    - "*.log"
    - "*.json"
  exclude_patterns:
    - "*.log.old"         # Skip rotated logs
    - "debug-*.log"       # Skip debug logs
```

#### Trash Files

```yaml
trash:
  max_age_days: 7         # Only recent deletions
  compress: true          # Compress for space
```

### 3. **Selective Restoration**

Restore only what you need:

- `--state-only`: Just the pipeline state
- `--files-only`: Chapters and assets
- `--logs-only`: Log files
- `--dry-run`: Preview changes without restoring

### 4. **Smart Pruning**

Intelligent checkpoint retention:

- Keep phase completion checkpoints
- Respect age limits
- Maintain minimum checkpoint count
- Automatic cleanup of old checkpoints

## Usage

### Creating Checkpoints

```bash
# Manual checkpoint with label
node .claude/scripts/pipeline-state-manager.js checkpoint "before-major-change"

# Automatic checkpoints created:
# - Before each phase (if auto_checkpoint enabled)
# - After phase completion
# - Before restore operations
```

### Listing Checkpoints

```bash
node .claude/scripts/pipeline-state-manager.js checkpoint-list

# Output:
# === Available Checkpoints ===
# 
# 2025-07-01T07-51-39-381Z-test-enhanced
#   Created: 5m ago
#   Label: test-enhanced
#   Size: 1.3MB
```

### Checkpoint Information

```bash
node .claude/scripts/pipeline-state-manager.js checkpoint-info <checkpoint-id>

# Shows:
# - Creation time and label
# - Current phase when created
# - All included components
# - File counts and sizes
```

### Restoring from Checkpoint

#### Full Restore

```bash
node .claude/scripts/pipeline-state-manager.js restore <checkpoint-id>
```

#### Preview Changes (Dry Run)

```bash
node .claude/scripts/pipeline-state-manager.js restore <checkpoint-id> --dry-run
```

#### Selective Restore

```bash
# Restore only state
node .claude/scripts/pipeline-state-manager.js restore <checkpoint-id> --state-only

# Restore only files (chapters/assets)
node .claude/scripts/pipeline-state-manager.js restore <checkpoint-id> --files-only

# Restore only logs
node .claude/scripts/pipeline-state-manager.js restore <checkpoint-id> --logs-only
```

### Checkpoint Cleanup

```bash
# Remove old checkpoints based on retention policy
node .claude/scripts/pipeline-state-manager.js checkpoint-cleanup
```

## Configuration

Edit `.claude/workflow-rules.yaml`:

```yaml
checkpoints:
  auto_create: true
  retention_policy:
    max_checkpoints: 20
    max_age_days: 7
    keep_minimum: 5
    keep_phase_completions: true
  
  checkpoint_includes:
    - "chapters/"
    - "assets/"
    - "context/"
    - "pipeline-state.json"
    - ".claude/todos.json"
    - ".claude/logs/"
    - "trash/"
  
  inclusion_rules:
    logs:
      max_file_size_mb: 50
      include_patterns: ["*.log", "*.json"]
      exclude_patterns: ["*.log.old", "debug-*.log"]
    trash:
      max_age_days: 7
      compress: true
```

## Restore Options

### Conflict Resolution

When restoring, you can choose how to handle existing files:

- `backup` (default): Move existing files to trash before restoring
- `overwrite`: Replace existing files without backup
- `skip`: Only restore files that don't exist

### Restore Report

After each restore, a detailed report is saved:

```json
{
  "checkpoint": "2025-07-01T07-51-39-381Z",
  "timestamp": "2025-07-01T08:00:00.000Z",
  "components": ["state", "files", "logs"],
  "results": {
    "chapters/": {
      "success": true,
      "type": "files",
      "files": 7
    },
    ".claude/logs/": {
      "success": true,
      "type": "logs",
      "files": 3
    }
  }
}
```

## Best Practices

1. **Label Important Checkpoints**

   ```bash
   node .claude/scripts/pipeline-state-manager.js checkpoint "before-publisher-phase"
   ```

2. **Use Dry Run First**
   Always preview what will be restored:

   ```bash
   node .claude/scripts/pipeline-state-manager.js restore <id> --dry-run
   ```

3. **Regular Cleanup**
   Keep checkpoint storage manageable:

   ```bash
   node .claude/scripts/pipeline-state-manager.js checkpoint-cleanup
   ```

4. **Selective Restoration**
   Don't restore everything if you only need specific components

## Troubleshooting

### Large Checkpoints

- Adjust `max_file_size_mb` for logs
- Reduce `max_age_days` for trash
- Run cleanup more frequently

### Missing Files in Checkpoint

- Check inclusion rules
- Verify file patterns match
- Look for exclusion patterns

### Restore Failures

- Check file permissions
- Ensure sufficient disk space
- Review restore report for specific errors

## Integration with Pipeline

The checkpoint system integrates seamlessly with the pipeline:

1. **Automatic Checkpoints**: Created before risky operations
2. **Phase Boundaries**: Checkpoints at phase completion
3. **Error Recovery**: Automatic restore on phase failure
4. **Rollback Support**: Easy rollback to any checkpoint

This enhanced checkpoint system ensures you never lose work and can always recover from errors or unwanted changes.
