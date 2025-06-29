# 📚 book-automation - Professional eBook Automation Pipeline (Agent CLI Edition)

A comprehensive automation pipeline for generating professional-quality eBooks from Markdown chapters, with AI-powered image generation, context management, and multi-format output support. All generation tasks run through Agent CLI remote endpoints - NO local LLMs or SDKs.

## 🟥 AGENT CLI ONLY - NO LOCAL LLMs, NO SDKs

### 🔒 Hard Rules

• No OpenAI text calls
• No local model installs
• No SDK or token juggling—Agent CLI already handles auth, billing, retries
• QA loops forever until perfect
• Fatal-error if anything's missing

### 🚀 Quick Start - Agent CLI Edition

```bash
# Clone the repository
git clone https://github.com/yourusername/book-automation.git
cd book-automation

# Initialize the environment
make init

# Set your Agent CLI text model
export AGENT_CLI_TEXT_MODEL=claude-3-opus

# Run the complete Agent CLI pipeline
make pipeline

# Or run individual steps:
make writer    # Generate chapters via Agent CLI
make images    # Generate images via Agent CLI Ideogram
make builder   # Build PDF/EPUB via Agent CLI
make qa        # Run infinite QA loop until perfect
```

### Manual Workflow

```bash
# Start your writing session
make session-start

# Create your first chapter
cp chapters/chapter-template.md chapters/chapter-01-my-story.md
# Edit your chapter...

# Build your book
make all
```

### Agent CLI Pipeline Flow

1. **Writer**: `agentcli call writer --model $AGENT_CLI_TEXT_MODEL --outline outline.yaml --context context/CONTEXT.md --out chapters/`
2. **Image**: `agentcli call ideogram --md chapters/ --palette emotion --out assets/images/`
3. **Build**: `agentcli call builder --md chapters/ --img assets/images/ --css templates/pdf-standard.css --out build/dist/`
4. **Infinite QA Loop**:
   ```bash
   while true; do
       agentcli call qa --pdf build/dist/ebook.pdf --epub build/dist/ebook.epub
       [ $? -eq 0 ] && break
       agentcli call builder --tweak next   # adjusts preset
   done
   ```

## 🚀 Features

- **📖 Multi-format Output**: Generate PDF (6×9" professional format) and EPUB
- **🎨 AI Image Generation**: Automated image creation with Ideogram 3.0 and OpenAI Sora
- **🧠 Emotion-aware Styling**: EmotionPaletteEngine for context-appropriate imagery
- **📝 Context Management**: Maintain consistency across chapters with story bible
- **✅ Quality Control**: Automated linting, word counting, and continuity checks
- **🔄 CI/CD Pipeline**: GitHub Actions for automated builds and releases
- **🎯 Git Hooks**: Pre-commit and pre-push hooks for quality assurance

## 📁 Project Structure

```
.
├── src/ebook_pipeline/      # Main Python package
│   ├── agents/              # AI agents for content generation
│   ├── generators/          # Image and PDF generators
│   ├── context/             # Context management tools
│   └── utils/               # Utility functions
├── chapters/                # Book content (Markdown files)
├── context/                 # Story bible and writing rules
├── assets/                  # Images, fonts, and styles
├── tests/                   # Test suite
├── config/                  # Configuration files
├── docs/                    # Documentation
└── scripts/                 # Build and utility scripts
```

## 📚 Multi-Book Workflow

This pipeline supports multiple books using Git branches:

### Starting a New Book

```bash
# Create a new branch for your book
git checkout -b book/my-awesome-book

# Copy the chapter template
cp chapters/chapter-template.md chapters/chapter-01-introduction.md

# Start writing!
```

### Branch Structure

- `main` - Clean pipeline without book content
- `book/book-name` - Individual book branches
- `feature/*` - Pipeline improvements

### Syncing Pipeline Updates

```bash
# In your book branch
git checkout book/my-book
git merge main  # Get latest pipeline updates
```

## 🛠️ Installation

### Prerequisites

- Python 3.11+
- Node.js 20+
- Pandoc 2.0+
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/d1fmarketing/book-automation.git
cd book-automation

# Check your environment
python scripts/check_env.py

# Install dependencies
make init

# Set up pre-commit hooks (optional but recommended)
pip install pre-commit
pre-commit install

# Or manually:
npm install
pip install -r requirements.txt
pip install -e .
```

## 🎯 Quick Start

### 1. Write Your Chapter

Create a new chapter in `chapters/`:

```markdown
---
chap: 01
title: "Introduction"
words_target: 2000
words: 0
status: draft
---

# Chapter 1: Introduction

Your content here...

![AI-IMAGE: A mystical library with floating books]()
```

### 2. Generate Images

```bash
# With Ideogram (default)
export IDEOGRAM_API_KEY=your_key
make generate-images

# With Sora/OpenAI
export IMAGE_PROVIDER=openai
export OPENAI_API_KEY=your_key
python -m ebook_pipeline.generators.generate_images
```

### 3. Build Your Book

```bash
# Generate PDF
make pdf

# Generate EPUB
make epub

# Generate all formats
make all
```

## 🎨 Image Generation

### Supported Providers

1. **Ideogram 3.0** (default)
   - High-quality illustrations
   - Text overlay support
   - Cost: $0.08/image

2. **OpenAI Sora** (gpt-image-1)
   - Photorealistic images
   - Advanced text rendering
   - Cost: $0.04/image

### Text Overlay

Add text to images using the `text=""` attribute:

```markdown
![AI-IMAGE: Premium business card on marble text="EXCLUSIVE OFFER"]()
```

### Emotion-Based Styling

The EmotionPaletteEngine automatically detects emotions and applies appropriate color palettes:

- 🎉 Joyful → Warm, bright colors
- 😢 Sad → Cool, muted tones
- 😨 Tense → Dark, high contrast
- 💜 Luxurious → Rich, sophisticated hues

## 📖 Context Management

### Before Writing

```bash
make session-start
```

This updates context files and prepares your writing environment.

### During Writing

```bash
# Find references
make find QUERY="blue dress"

# Track character
make track-character NAME="Alice"

# Check continuity
make check-continuity
```

### After Writing

```bash
make session-end
```

Updates all context files and commits changes.

## 🧪 Testing

```bash
# Run all tests
pytest

# Run specific test suite
pytest tests/unit/test_sora_prompts.py -v

# With coverage
pytest --cov=ebook_pipeline
```

## 📋 Available Commands

### Build Commands
- `make pdf` - Generate PDF
- `make epub` - Generate EPUB
- `make all` - Generate all formats
- `make clean` - Clean build artifacts

### Development Commands
- `make wordcount` - Update word counts
- `make test` - Run tests and linting
- `make serve` - Local preview server

### Context Commands
- `make session-start` - Begin writing session
- `make session-end` - End writing session
- `make analyze` - Analyze all chapters
- `make context-update` - Full context refresh

## 🔧 Configuration

### Book Metadata

Edit `metadata.yaml`:

```yaml
title: "Your Book Title"
author: "Your Name"
isbn: "978-0-000000-00-0"
language: en
```

### Image Generation

Configure in environment:

```bash
# Provider selection
export IMAGE_PROVIDER=ideogram  # or openai

# API Keys
export IDEOGRAM_API_KEY=your_key
export OPENAI_API_KEY=your_key

# Default size
export IMAGE_SIZE=1024x1024
```

## 🤝 Contributing

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Powered by Claude Code integration
- EmotionPaletteEngine for intelligent image generation
- Ideogram and OpenAI for image generation APIs