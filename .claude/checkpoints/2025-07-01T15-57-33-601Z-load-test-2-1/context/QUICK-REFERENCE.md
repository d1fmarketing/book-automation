# 🚀 Quick Reference - Context Guardian

## Essential Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `make session-start` | Load all context | Before any writing |
| `make session-end` | Save context updates | After writing session |
| `make find QUERY="text"` | Search all chapters | Check if something exists |
| `make track-character NAME="Name"` | Character timeline | Review character details |
| `make check-continuity` | Validate consistency | After major changes |

## Common Scenarios

### 📝 Starting a New Chapter
```bash
make session-start
# Read context/CONTEXT.md
# Check next chapter goals
# Write following the guidelines
```

### 🔍 Checking a Fact
```bash
make find QUERY="blue dress"
# Returns all mentions with chapter/line numbers
```

### 👤 Character Consistency
```bash
make track-character NAME="Alice"
# Shows full character journey
```

### ✅ Before Committing
```bash
make session-end
# This runs ALL checks and updates context
git add .
git commit -m "feat: complete chapter X"
```

## ⚠️ Troubleshooting

### "Context not updated" error
→ Run `make session-end` before committing

### "Continuity errors found"
→ Check `context/continuity-report.json` for details
→ Fix issues and run `make session-end` again

### "Character not found"
→ Add character to `context/story-bible.yaml` first

### Python script errors
→ Ensure virtual environment is activated
→ Run `pip install -r requirements.txt`

## 📋 Pre-flight Checklist

Before writing:
- [ ] `make session-start` executed
- [ ] `context/CONTEXT.md` reviewed
- [ ] `context/story-bible.yaml` checked for character details
- [ ] `context/WRITING-RULES.md` fresh in mind

After writing:
- [ ] `make check-continuity` shows no errors
- [ ] `make session-end` completed successfully
- [ ] Context files are staged for commit

## 🎯 Quick Context Locations

- **Current state**: `context/CONTEXT.md`
- **Character info**: `context/story-bible.yaml`
- **Style rules**: `context/WRITING-RULES.md`
- **Chapter summaries**: `context/chapter-summaries.json`
- **Continuity report**: `context/continuity-report.json`

## 💡 Pro Tips

1. **Split screen**: Keep CONTEXT.md open while writing
2. **Frequent checks**: Run `make find` often to avoid repetition
3. **Character voice**: Review dialogue samples with `track-character`
4. **Backup often**: `make context-backup` before major changes
5. **CI will catch errors**: But fix locally first!