# Enhanced Trash Commands

## Overview

The SafeTrash system now includes enhanced commands for searching, restoring, and managing deleted files. These commands make it easy to recover accidentally deleted files and manage trash storage.

## New Commands

### 1. **Find/Search Items**

Search for files in trash by name:

```bash
node .claude/scripts/safe-trash.js find <query>

# Examples:
node .claude/scripts/safe-trash.js find "chapter-05"
node .claude/scripts/safe-trash.js find ".md"
node .claude/scripts/safe-trash.js find "test"
```

Output shows:

- Full trash path
- Original location
- Deletion date/time
- Deletion reason
- File size

### 2. **Get Item Information**

Get detailed information about a specific trash item:

```bash
node .claude/scripts/safe-trash.js info <path>

# Examples:
node .claude/scripts/safe-trash.js info trash/2025/07/01/documents/chapter-05.md
node .claude/scripts/safe-trash.js info "2025/07/01/documents/test.txt"
```

Shows:

- File type and size
- Creation and modification dates
- Complete metadata
- Original path and deletion details

### 3. **Smart Restore**

Restore files with intelligent path matching:

```bash
node .claude/scripts/safe-trash.js restore <item> [target-path]

# Restore by exact match:
node .claude/scripts/safe-trash.js restore chapter-05.md

# Restore with specific target:
node .claude/scripts/safe-trash.js restore chapter-05.md chapters/restored.md

# Restore from full path:
node .claude/scripts/safe-trash.js restore trash/2025/07/01/documents/file.txt
```

Features:

- Searches by filename if not a full path
- Shows error if multiple matches found
- Restores to original location by default
- Allows custom restore location

### 4. **Enhanced Clean**

Clean old items with more control:

```bash
node .claude/scripts/safe-trash.js clean [options]

Options:
  --dry-run     Preview what would be deleted
  --force       Skip confirmation prompt
  --days=N      Delete items older than N days (default: 30)

# Examples:
node .claude/scripts/safe-trash.js clean --dry-run
node .claude/scripts/safe-trash.js clean --days=7 --force
node .claude/scripts/safe-trash.js clean --dry-run --days=0  # See all items
```

## Bash Helper Functions

Add these to your `.bashrc` or `.zshrc`:

```bash
# Get helper functions
node .claude/scripts/safe-trash.js helpers >> ~/.bashrc

# Then you can use:
trash file.txt "reason"       # Move to trash
trash-list                    # List trash contents
trash-find "query"           # Search trash
trash-restore file.txt       # Restore from trash
trash-info path              # Get item info
trash-clean                  # Clean old items
trash-stats                  # Show statistics
```

## Trash Organization

Files are organized by:

```
trash/
├── 2025/
│   └── 07/
│       └── 01/
│           ├── documents/     # Text files, PDFs, etc.
│           ├── images/        # PNG, JPG, etc.
│           ├── code/          # JS, PY, etc.
│           ├── config/        # JSON, YAML, etc.
│           ├── archives/      # ZIP, TAR, etc.
│           └── directories/   # Deleted folders
└── .trash-config.json        # Trash configuration
```

## Best Practices

1. **Regular Cleanup**

   ```bash
   # Check what would be cleaned
   node .claude/scripts/safe-trash.js clean --dry-run
   
   # Clean items older than 7 days
   node .claude/scripts/safe-trash.js clean --days=7
   ```

2. **Search Before Delete**

   ```bash
   # Check if file exists in trash before permanently deleting
   node .claude/scripts/safe-trash.js find "important-file"
   ```

3. **Use Metadata**
   Always provide a reason when deleting:

   ```bash
   node .claude/scripts/safe-trash.js trash file.txt "Replaced with updated version"
   ```

4. **Monitor Trash Size**

   ```bash
   node .claude/scripts/safe-trash.js stats
   ```

## Integration with Pipeline

The trash system integrates with the pipeline checkpoints:

1. **Checkpoint Integration**: Trash contents are included in checkpoints
2. **Selective Restore**: Can restore only trash from checkpoints
3. **Auto-cleanup**: Respects pipeline cleanup policies

## Troubleshooting

### "No items found" when searching

- Check if searching in the right date folder
- Try partial filename matches
- Use `list` command to see all items

### Restore fails

- Check if target location already exists
- Ensure you have write permissions
- Verify the trash item still exists

### Large trash size

- Run cleanup more frequently
- Reduce retention days
- Consider excluding large files from trash

## Safety Features

- **No Overwrites**: Won't overwrite existing files during restore
- **Metadata Preservation**: All file attributes preserved
- **Atomic Operations**: Safe concurrent access
- **Confirmation Prompts**: Requires confirmation for destructive operations
- **Dry Run Mode**: Preview changes before applying
