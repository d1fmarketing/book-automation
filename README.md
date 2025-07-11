# 📚 book-automation - Professional eBook Automation Pipeline (Agent CLI Edition)

A comprehensive automation pipeline for generating professional-quality eBooks from Markdown chapters, with AI-powered image generation, context management, and multi-format output support. All generation tasks run through Agent CLI remote endpoints - NO local LLMs or SDKs.

## 🎛️ Admin Dashboard

The project includes a web-based admin dashboard for monitoring and controlling the pipeline:

- **Auto Port Selection**: Dashboard automatically finds an available port if default (4000) is busy
- **Real-time Monitoring**: WebSocket updates for job progress and system status
- **Queue Management**: View and control all processing queues
- **Cost Tracking**: Monitor API usage and costs in real-time

### Starting the Dashboard

```bash
cd admin
npm run dev

# Dashboard will print the actual port being used:
# 🎛️ Admin Dashboard running at http://localhost:4000
# Or if port 4000 is busy:
# ⚠️  Port 4000 is in use, finding alternative...
# ✅ Using port 4001 instead
```

### Health Check

```bash
# Check if dashboard is running
node admin/scripts/ping-dashboard.js

# Output:
# ✅ Dashboard is healthy!
#    Port: 4000
#    Status: 200
```

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

### Agent CLI Pipeline Flow with MCP Visual QA

1. **Writer**: `agentcli call writer --model $AGENT_CLI_TEXT_MODEL --outline outline.yaml --context context/CONTEXT.md --out chapters/`
2. **Image**: `agentcli call ideogram --md chapters/ --palette emotion --out assets/images/`
3. **Build**: `agentcli call builder --md chapters/ --img assets/images/ --css templates/pdf-standard.css --out build/dist/ --save-html build/tmp/ebook.html`
4. **MCP Visual QA Loop** (literal "eyes on the page"):
   ```bash
   while true; do
       # MCP browser automation checks both HTML (fast DOM) and PDF (print geometry)
       mcp start --session qa --browser chromium
       mcp qa navigate "build/tmp/ebook.html"
       mcp qa assert font-size between 11.5pt 14pt
       mcp qa assert line-height between 1.3 1.6
       mcp qa assert contrast-ratio min 4.5
       mcp qa navigate "build/dist/ebook.pdf"
       mcp qa assert page-bleed within 3mm
       [ $? -eq 0 ] && break
       
       # Builder reads qa/last_fail.json and tweaks layout
       agentcli call builder --tweak next
   done
   ```

### MCP Integration Benefits

- **Real Browser Rendering**: MCP drives Chromium to render every pixel
- **Visual Assertions**: Checks typography, contrast, layout with actual eyes
- **Dual Validation**: HTML for fast DOM checks, PDF for print geometry
- **Smart Retries**: Failure reports guide which preset to try next
- **Screenshot Evidence**: Captures visual proof of any failures

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

# Generate with live preview
npm run preview
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

## 🖼️ Live Preview System

Generate PDFs with real-time visual feedback:

```bash
# Generate with live preview
npm run preview

# Custom preset with preview
npm run build:pdf:preview -- --preset clean

# Preview on different port
npm run preview -- --preview-port 3002
```

Features:
- Real-time page rendering
- Progress tracking with percentages
- Page navigation and zoom controls
- WebSocket updates
- Secure token authentication

See [preview-system/README.md](preview-system/README.md) for details.

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