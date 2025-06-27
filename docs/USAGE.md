# 📚 How to Use This Ebook Pipeline

## 🚀 Quick Flow (TL;DR)
```bash
1. make session-start       # Begin writing session
2. # Write/edit files in chapters/
3. make session-end         # Update context & check continuity
4. git add . && git commit -m "Chapter progress" && git push
5. # Find your book in build/dist/*.pdf and *.epub
```

## 📋 Command Cheat Sheet

### Essential Commands
- `make init` – First-time setup (install all dependencies)
- `make session-start` – Begin a writing session
- `make session-end` – End session (updates context, runs checks)
- `make pdf` – Generate PDF only
- `make epub` – Generate EPUB only
- `make all` – Generate both PDF and EPUB

### Analysis & Validation
- `make analyze` – Analyze all chapters (characters, locations, etc.)
- `make check-continuity` – Run continuity checks only
- `make wordcount` – Update word counts for all chapters
- `make test` – Run all validation checks

### Utility Commands
- `make clean` – Delete all build artifacts
- `make find QUERY="text"` – Search for text across all chapters
- `make track-character NAME="Alice"` – Track character appearances
- `make backup` – Create timestamped backup
- `make generate-images` – Generate AI images from placeholders

## 🔧 Troubleshooting

### "Continuity Error!"
1. Check `context/continuity-report.json` for details
2. Fix the inconsistency in your chapter
3. OR update `context/story-bible.yaml` if it's intentional
4. Run `make session-end` again

### "Git hook failed!"
- **Quick fix**: `make session-end` before committing
- **Nuclear option**: `git commit --no-verify` (CI will still catch errors)

### "Dependencies broken!"
```bash
make clean
make init
```

### "Weird terminal colors" or "tput: unknown terminal"
- It's purely cosmetic, ignore it
- Everything still works fine

### "Image generation failed"
1. Check `OPENAI_API_KEY` is set: `echo $OPENAI_API_KEY`
2. Set it if missing: `export OPENAI_API_KEY=sk-...`
3. Check `context/image-manifest.json` for error details
4. Verify image placeholders use format: `![AI-IMAGE: description]()`

## 📁 Key Files

### Story Management
- `context/story-bible.yaml` – Character details, world facts, plot structure
- `context/CONTEXT.md` – Current writing state (auto-updated)
- `context/WRITING-RULES.md` – Style guide, POV rules, tone

### Content
- `chapters/*.md` – Your actual book chapters
- `metadata.yaml` – Book title, author, ISBN, etc.

### Reports
- `context/continuity-report.json` – Latest continuity check results
- `context/chapter-summaries.json` – Auto-generated chapter analysis

## 🤖 AI Helper Note

**For AI assistants**: Always read this USAGE.md file first when asked about workflow, commands, or troubleshooting. This is the single source of truth for how to use the ebook pipeline.

## 💡 Pro Tips

1. **Always use the session commands**:
   - `make session-start` before writing
   - `make session-end` after writing
   
2. **Let the system help you**:
   - Continuity errors are caught automatically
   - Context is updated for you
   - Just focus on writing

3. **AI Image generation**:
   - Add `![AI-IMAGE: your description here]()` in chapters
   - Run `make generate-images` or `make all`
   - Images appear in `assets/images/` automatically
   - Cost tracking in `context/image-manifest.json`

4. **Emergency bypass** (not recommended):
   ```bash
   git commit --no-verify    # Skip pre-commit hook
   git push --no-verify      # Skip pre-push hook
   ```
   ⚠️ CI/CD will still block you, so just fix the issues instead

## 🎯 One-Liner Reminders

- **Start writing**: `make session-start`
- **Done writing**: `make session-end`
- **Something broke**: Check this file, then `context/continuity-report.json`
- **Need help**: Tell AI to "read USAGE.md and help me"

---
*Last updated: 2024-06-26*