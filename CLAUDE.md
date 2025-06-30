# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚀 Project Overview

This is a professional eBook automation pipeline that generates high-quality PDF and EPUB files from Markdown chapters. The system includes automated builds, validation, word counting, and CI/CD integration.

### Key Features

- **Automated PDF generation** (6×9" professional book format)
- **EPUB creation** with validation
- **Word count tracking** with progress monitoring
- **CI/CD pipeline** with GitHub Actions
- **Git hooks** for quality control
- **Markdown linting** and validation
- **Image optimization** for web and print
- **MCP Visual QA** using Claude's browser tools

## 🤖 MCP (Model Context Protocol) - IMPORTANTE!

### O que é MCP neste projeto
MCP são as ferramentas que EU (Claude) uso para interagir com seu sistema:
- **Browser Control**: Posso navegar, ver páginas/PDFs, executar JavaScript
- **File System**: Posso ler, criar e editar arquivos
- **Bash**: Posso executar comandos

### Como usar MCP para QA Visual
```bash
# 1. Você gera o PDF
npm run build:pdf

# 2. Me pede para verificar
"Claude, verifique o PDF em build/dist/ebook.pdf"

# 3. EU uso MCP para:
- Navegar até o arquivo
- Ver o conteúdo
- Executar verificações
- Reportar problemas
```

### ⚠️ ATENÇÃO: MCP não é um comando!
- ❌ ERRADO: `mcp start --browser`
- ✅ CERTO: Pedir para o Claude usar suas ferramentas

## 📁 Project Structure

```text
ebook-project/
├── chapters/          # Markdown files for book chapters
├── assets/           # Resources (CSS, fonts, images)
│   ├── css/         # Stylesheets for EPUB
│   ├── fonts/       # Custom fonts
│   └── images/      # Book images and cover
├── scripts/         # Automation scripts
│   └── phases/      # Phase-specific scripts
├── build/           # Generated files (git-ignored)
│   ├── temp/        # Temporary build files
│   ├── dist/        # Final PDF/EPUB output
│   └── reports/     # Build reports
├── config/          # Configuration files
├── .github/         # GitHub Actions workflows
│   └── workflows/
├── .husky/          # Git hooks
├── metadata.yaml    # Book metadata and settings
├── package.json     # Node.js dependencies
├── requirements.txt # Python dependencies
└── Makefile        # Build commands
```

## 🛠️ Common Development Tasks

### Initial Setup

```bash
make init          # Install all dependencies and configure environment
```

### Building the Book

```bash
make pdf           # Generate PDF (6×9" format)
make epub          # Generate EPUB with validation
make all           # Generate all formats
make clean         # Clean build artifacts
```

### Development Workflow

```bash
make wordcount     # Update word count in chapter frontmatter
make test          # Run linting and validation
make serve         # Start local preview server
npm run lint       # Fix markdown issues automatically
```

### Advanced Commands

```bash
make stats         # Generate readability statistics (if implemented)
make preview       # Live preview with hot reload (if implemented)
make backup        # Create backup (if implemented)
make publish       # Publish to platforms (if implemented)
```

## 📝 Chapter Format

Each chapter should be placed in the `chapters/` directory with this format:

```markdown
---
chap: 01
title: "Chapter Title"
words_target: 2000
words: 0
status: draft
---

# Chapter 1: Title

Chapter content goes here...

## Section 1.1

Section content...
```

### Frontmatter Fields

- `chap`: Chapter number (for ordering)
- `title`: Chapter title
- `words_target`: Target word count
- `words`: Current word count (auto-updated)
- `status`: draft | review | final

## 🔧 Configuration Files

### metadata.yaml

Contains book metadata and build settings:

- Title, author, ISBN, publisher info
- PDF settings (page size, margins, fonts)
- EPUB settings (cover image, stylesheet)
- Build options (TOC, page numbers, etc.)

### package.json Scripts

- `prepare`: Setup Husky hooks
- `lint`: Auto-fix markdown issues
- `lint:check`: Check markdown without fixing
- `wordcount`: Update chapter word counts
- `optimize:images`: Compress images
- `build:epub`: Generate EPUB
- `validate:epub`: Validate EPUB format
- `build:pdf`: Generate PDF with Puppeteer
- `build`: Build all formats
- `test`: Run all validations

## 🏗️ Architecture Details

### PDF Generation (Puppeteer)

- Uses `scripts/generate-pdf-puppeteer.js`
- Converts Markdown → HTML → PDF
- Professional 6×9" book format
- Configurable margins and typography
- Automatic page numbering
- Chapter start formatting

### EPUB Generation

- Uses `scripts/build-epub.js`
- Creates valid EPUB 2.0 format
- Includes TOC (toc.ncx)
- Proper content.opf manifest
- CSS styling support
- Image embedding

### Word Count System

- Python script: `scripts/wordcount.py`
- Updates frontmatter automatically
- Excludes Markdown syntax from count
- Shows progress against targets
- Rich terminal output with tables

### CI/CD Pipeline

- GitHub Actions workflow in `.github/workflows/build-ebook.yml`
- Triggers on push to main/develop
- Runs tests and validations
- Builds all formats
- Creates releases automatically
- Uploads artifacts

## 🚀 Advanced Features

### Available Enhancements

1. **Docker Support**: Containerized build environment
2. **Live Preview**: Hot-reload development server
3. **Grammar Check**: LanguageTool integration
4. **Publishing**: KDP, Apple Books, Google Play integration
5. **Advanced Stats**: Readability scores, sentiment analysis
6. **Collaboration**: Multi-author support
7. **Templates**: Fiction/non-fiction presets
8. **Marketing**: Auto-generate promotional materials

### Git Hooks (Husky)

- **pre-commit**: Runs linting and word count
- **pre-push**: Ensures builds are updated
- **commit-msg**: Validates conventional commits

## 📋 Important Notes

### File Naming Convention

- Chapters: `chapter-XX-slug.md` (e.g., `chapter-01-introduction.md`)
- Images: Descriptive names in `assets/images/`
- Keep filenames URL-safe (no spaces, special chars)

### Image Guidelines

- Cover: 1600×2400px minimum for `cover.jpg`
- Interior images: Max 1600px width
- Use `npm run optimize:images` before building
- Supported formats: JPG, PNG

### Markdown Best Practices

- Use ATX headers (`#` style)
- Indent paragraphs will be added by CSS
- Scene breaks: Use `---` or `* * *`
- Emphasis: Use `*italic*` and `**bold**`
- Keep line length readable (80-100 chars)

### Build Performance

- First build may be slow (Puppeteer setup)
- Subsequent builds use cached dependencies
- Clean builds with `make clean` if issues arise
- Docker option available for consistency

## 🐛 Troubleshooting

### Common Issues

1. **PDF generation fails**: Check Node.js version (20+)
2. **EPUB validation errors**: Run `npm run validate:epub`
3. **Word count not updating**: Check Python installation
4. **Git hooks not running**: Run `npx husky install`
5. **Images too large**: Use `npm run optimize:images`

### Debug Mode

```bash
DEBUG=1 npm run build:pdf    # Saves debug HTML
```

## 🔗 External Resources

- Pandoc documentation (if using Pandoc workflow)
- Puppeteer API for PDF customization
- EPUB specification for format details
- GitHub Actions for CI/CD configuration

## 💡 Development Tips

1. **Commit frequently** with conventional commit messages
2. **Run tests** before pushing changes
3. **Update word counts** regularly to track progress
4. **Use branches** for major edits (develop branch)
5. **Tag releases** for version tracking

## 📚 Context Management System

This project includes a comprehensive context management system to maintain consistency and prevent errors across chapters.

### Key Context Files

- **`context/story-bible.yaml`** - Master reference for characters, world, plot
- **`context/CONTEXT.md`** - Current writing state (ALWAYS read before writing)
- **`context/WRITING-RULES.md`** - Your specific style guidelines
- **`context/chapter-summaries.json`** - Auto-generated chapter summaries
- **`context/continuity-report.json`** - Continuity check results

### Essential Context Commands

#### Before Writing Session

```bash
make session-start    # Updates context and prepares for writing
```

#### During Writing

```bash
make find QUERY="blue dress"         # Search for specific references
make track-character NAME="Alice"     # Track character journey
make check-continuity                 # Check for inconsistencies
```

#### After Writing Session

```bash
make session-end      # Analyzes changes and updates all context
```

### Context Management Workflow

1. **Start Session**: Run `make session-start`
2. **Read Context**: Always read `context/CONTEXT.md`
3. **Check Bible**: Review `context/story-bible.yaml` for details
4. **Write Chapter**: Follow guidelines in `context/WRITING-RULES.md`
5. **Verify**: Run `make check-continuity` periodically
6. **End Session**: Run `make session-end` to save context

### Advanced Context Tools

- **`make analyze`** - Deep analysis of all chapters
- **`make track-all-characters`** - Complete character tracking
- **`make context-update`** - Full context regeneration
- **`make context-backup`** - Backup context files

### Context Scripts

- **`scripts/analyze-chapters.py`** - Extracts key information from chapters
- **`scripts/continuity-check.py`** - Identifies continuity errors
- **`scripts/generate-context.py`** - Updates CONTEXT.md
- **`scripts/find-references.py`** - Search across all chapters
- **`scripts/character-tracker.py`** - Track character development

### Tips for Context-Aware Writing

1. **Always run `make session-start`** before writing
2. **Keep CONTEXT.md open** in a split screen while writing
3. **Update story-bible.yaml** when adding new elements
4. **Run continuity checks** after major plot points
5. **Use find-references** to avoid repetition

## 🤖 Context Guardian Agent

This project includes an AI agent directive system to ensure perfect consistency throughout your book.

### Agent System Prompt

The complete Context Guardian prompt is available at:

- **`context/AGENT-DIRECTIVE.md`** - Full system prompt for AI agents

### How to Use with AI Assistants

1. **Copy the entire content** of `context/AGENT-DIRECTIVE.md`
2. **Paste as system prompt** when starting a new AI session
3. **The agent will automatically**:
   - Run `make session-start` before writing
   - Check continuity during writing
   - Enforce all rules from WRITING-RULES.md
   - Prevent contradictions and inconsistencies

### Agent Configuration

- **`context/agent-config.yaml`** - Operational parameters
- **`context/QUICK-REFERENCE.md`** - Command cheat sheet

### Enforcement Mechanisms

#### Git Hooks 🔒

- Pre-commit hook blocks commits without context updates
- Automatically runs continuity checks
- Forces `make session-end` after chapter changes

⚠️ **Note**: Developers can bypass hooks with `git commit --no-verify`. While this bypasses local checks, CI/CD will still catch errors. Always review PRs carefully and ensure all checks pass before merging.

#### CI/CD Integration 🚨

- GitHub Actions runs context checks on every push
- Build fails if continuity errors exist
- Ensures consistency across all contributors

#### Safety Net Features

- Context must be updated when chapters change
- Continuity errors block commits
- CI/CD catches any missed issues
- Backups auto-prune to save space

### Quick Start for Writing Session

```bash
# 1. Start session (agent should run this)
make session-start

# 2. Write with agent assistance
# Agent will use find/track commands as needed

# 3. End session (agent should run this)
make session-end

# 4. Commit your work
git add .
git commit -m "feat: complete chapter X"
```

Remember: This pipeline is designed for professional ebook production. All commands ensure quality output suitable for commercial distribution.

## 🚨 REGRA CRÍTICA DE QA - NUNCA MENTIR!

### Verificação Obrigatória de PDF

**NUNCA** diga que o PDF está pronto sem verificar VISUALMENTE:

1. **Execute o script de verificação**:
   ```bash
   node scripts/pdf-qa-loop-real.js
   ```

2. **O script DEVE retornar**:
   - "✅ PDF ESTÁ PERFEITO! CAPA ENCONTRADA!"
   - Tamanho correto: 6×9 polegadas
   - Capa visual detectada (screenshot > 50KB)

3. **Se falhar, NÃO PARE**:
   - Debug o problema
   - Corrija o código
   - Execute novamente
   - Repita até funcionar

4. **Loop automático disponível**:
   ```bash
   ./scripts/verify-and-fix-loop.sh
   ```

### Por que isso é importante?

- PDFs renderizados não mostram tags `<img>` quando abertos no browser
- A única forma de verificar é visualmente (screenshot) ou com ferramentas PDF
- Imagens locais com `file://` podem não carregar no Puppeteer
- Use base64 para garantir que as imagens sejam embutidas

### Lembre-se:

**NUNCA ASSUMA QUE ESTÁ FUNCIONANDO!** Sempre verifique com o script `pdf-qa-loop-real.js` antes de dizer que o PDF está pronto.
