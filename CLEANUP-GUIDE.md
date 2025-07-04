# 🧹 Safe Cleanup Guide

## Overview

This guide explains how to safely clean build artifacts and test files without risking important code, agents, templates, or documentation.

## Quick Commands

```bash
# Interactive cleanup (asks for confirmation)
make clean-interactive

# Automatic cleanup (no confirmation)
make clean

# Dry run (shows what would be deleted)
make clean-dry
```

## What Gets Cleaned

### ✅ Safe to Delete
- `build/` - All build outputs
- `dist/` - Distribution files  
- `release/` - Release packages
- `*.pdf`, `*.epub`, `*.mobi` - Generated ebooks
- `*.png` in build directories - Screenshots
- `*.html` in build directories - Generated HTML
- Test artifacts (`*.test.pdf`, `*.demo.html`)
- Temporary files (`*.tmp.md`, `*.backup`)

### ❌ Protected (Never Deleted)
- `/agents` - Pipeline agents
- `/templates` - Ebook templates
- `/docs` - Documentation
- `/scripts` - System scripts
- `/src` - Source code
- `/chapters` - Book content
- `/.claude` - Claude configuration
- `/assets` - Permanent assets

## Using the Cleanup Script

### 1. Interactive Mode (Recommended)
```bash
./scripts/clean-build.sh
```
- Shows list of files to delete
- Shows total space to recover
- Requires typing "YES" to confirm

### 2. Automatic Mode
```bash
./scripts/clean-build.sh -y
# or
make clean
```
- Skips confirmation
- Good for CI/CD pipelines

### 3. Dry Run Mode
```bash
./scripts/clean-build.sh -d
# or
make clean-dry
```
- Shows what would be deleted
- Doesn't delete anything
- Safe way to preview

## Complete Workflow

### Before Starting New Project

1. **Commit any pending work**
   ```bash
   git add .
   git commit -m "wip: save work"
   ```

2. **Run cleanup**
   ```bash
   make clean
   ```

3. **Verify environment**
   ```bash
   npm run check:env
   ```

4. **Start fresh build**
   ```bash
   npm run build:all
   ```

## Git Ignore Updates

The `.gitignore` has been updated to prevent test artifacts from being committed:

```gitignore
# Build artifacts
build/
dist/
release/
*.pdf
*.epub
*.mobi

# Test artifacts  
*.test.pdf
*.demo.html
test-output/

# Screenshots (except in assets/)
*.png
!assets/**/*.png
!templates/**/*.png
```

## Tips

1. **Always commit before cleaning** - Safety net if something goes wrong
2. **Use dry run first** - Preview what will be deleted
3. **Check git status after** - Ensure no tracked files were deleted
4. **Regular cleanup** - Run after each project to save space

## Troubleshooting

### "Protected files found" error
The script detected files in protected directories. This is a safety feature. Check the file list and report if legitimate.

### Space not recovered
Empty directories are also removed. If space isn't freed, check for hidden files or processes holding files open.

### Need to clean more aggressively
For a complete reset (⚠️ dangerous):
```bash
git clean -xfd  # Removes ALL untracked files
```

## Integration

### GitHub Actions
```yaml
- name: Clean artifacts
  run: make clean
```

### Pre-build Hook
Add to your build scripts:
```bash
make clean && npm run build
```

## Summary

The cleanup system is designed to be safe by default:
- Protects important directories
- Shows preview before deleting
- Requires explicit confirmation
- Logs all deletions

Never worry about accidentally deleting agents or templates again! 🎉