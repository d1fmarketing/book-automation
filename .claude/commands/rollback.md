# Emergency Rollback Command

Quick rollback for when things go wrong. Safety first!

## Usage:
```
claude /rollback [level]
```

## Rollback Levels:

### 1. Last Commit (default)
```
claude /rollback
claude /rollback last
```
Actions:
- `git revert HEAD --no-edit`
- `claude /clear`
- Show what was reverted

### 2. To Last Working State
```
claude /rollback working
```
Actions:
- Find last commit with "working state" in message
- `git reset --hard [commit]`
- `claude /clear`
- Restore from stash if available

### 3. To Main Branch
```
claude /rollback main
```
Actions:
- Confirm current branch != main
- `git reset --hard origin/main`
- `claude /clear`
- Show diff of what was lost

### 4. Emergency Stop
```
claude /rollback emergency
```
Actions:
- Kill all running processes
- Revert last 3 commits
- Clear all contexts
- Create emergency backup

## Safety Features:

1. **Pre-rollback backup**
   ```bash
   git stash save "backup-before-rollback-$(date +%s)"
   ```

2. **Confirmation required for destructive actions**
   - Level 2 and above require confirmation
   - Shows what will be lost

3. **Rollback log**
   - All rollbacks logged to `.claude/rollback.log`
   - Includes timestamp, level, and reason

## Recovery:

After rollback, to recover work:
```bash
# View stashes
git stash list

# Recover specific stash
git stash apply stash@{n}
```

## Examples:

Quick revert after bad commit:
```
claude /rollback
```

Major issue, need clean slate:
```
claude /rollback main
```

Everything is on fire:
```
claude /rollback emergency
```

## Best Practices:

1. Use level 1 for simple mistakes
2. Use level 2 when tests are failing
3. Use level 3 when branch is corrupted
4. Use emergency only as last resort
5. Always check `git status` after rollback