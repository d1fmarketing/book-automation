# 📚 eBook Pipeline Setup Guide

## Prerequisites

### System Requirements

- **Node.js**: Version 20.0.0 or higher
- **Python**: Version 3.9 or higher
- **Git**: For version control

### Recommended Tools (Optional but Helpful)

- **qpdf**: For PDF validation
  ```bash
  # macOS
  brew install qpdf
  
  # Ubuntu/Debian
  sudo apt-get install qpdf
  ```

- **Ghostscript**: For PDF repair and optimization
  ```bash
  # macOS
  brew install ghostscript
  
  # Ubuntu/Debian
  sudo apt-get install ghostscript
  ```

- **ImageMagick**: For image processing
  ```bash
  # macOS
  brew install imagemagick
  
  # Ubuntu/Debian
  sudo apt-get install imagemagick
  ```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/claude-elite/book-automation.git
cd book-automation
```

### 2. Install Node Dependencies

```bash
npm install
```

### 3. Install Python Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt
```

### 4. Initialize the Pipeline

```bash
# From the pipeline-book directory
cd pipeline-book
make init
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# API Keys (when using real services)
IDEOGRAM_API_KEY=your_ideogram_key_here
OPENAI_API_KEY=your_openai_key_here
STRIPE_API_KEY=your_stripe_key_here

# WebSocket Configuration
WEBSOCKET_HOST=127.0.0.1
WEBSOCKET_PORT=8765

# Security
DASHBOARD_TOKEN=your_secure_token_here

# Publishing Platforms (optional)
AMAZON_KDP_ID=your_kdp_id
APPLE_BOOKS_ID=your_apple_id
GOOGLE_PLAY_ID=your_google_id
```

### Book Metadata

Edit `metadata.yaml` in your book project:

```yaml
title: "Your Book Title"
subtitle: "An Amazing Subtitle"
author: "Your Name"
isbn: "978-0-00000-000-0"
language: "en"
publisher: "Your Publishing Name"
publication_date: "2025-01-01"

# PDF settings
pdf:
  page_size: "6x9"
  margins: "0.75in"
  font_family: "Georgia"
  font_size: "11pt"
  
# EPUB settings
epub:
  cover_image: "assets/images/cover.jpg"
  stylesheet: "assets/css/style.css"
```

## MCP (Model Context Protocol) Setup

MCP tools are used for browser control and visual QA:

### Install MCP CLI (if available)

```bash
# Check if MCP tools are available
claude mcp list

# If not installed, MCP is built into Claude
# No additional installation needed
```

### MCP Tools Available

1. **Browser Control**: Automated PDF verification
2. **File System**: Reading/writing files
3. **Bash**: Running commands

## Running the Pipeline

### Quick Start

```bash
# Generate all formats with visual QA
make pipeline

# Or run individual components
make pdf        # Generate PDF only
make epub       # Generate EPUB only
make qa         # Run quality checks
```

### WebSocket Dashboard

```bash
# Start the WebSocket server
./scripts/start-websocket-server.sh

# Open dashboard in browser
open dashboard.html
```

### Advanced Usage

```bash
# Run with MCP visual QA
node scripts/generation/pdf-generator-with-mcp.js

# Run complete pipeline with all agents
python -m ebook_pipeline.run_complete_pipeline

# Run with specific platforms
make pipeline ARGS='--platforms amazon apple google'
```

## Security Considerations

### WebSocket Security

The WebSocket server binds to localhost by default. For external access:

1. Set `WS_DASHBOARD_TOKEN` in `.env`
2. Use HTTPS proxy (nginx recommended)
3. Implement authentication middleware

### API Key Security

- Never commit API keys to version control
- Use environment variables or secure vaults
- Rotate keys regularly
- Monitor usage for anomalies

## Troubleshooting

### Common Issues

**Problem**: "qpdf: command not found"
**Solution**: Install qpdf or the pipeline will use fallback validation

**Problem**: "WebSocket connection refused"
**Solution**: Ensure the WebSocket server is running on port 8765

**Problem**: "PDF has only 1 page"
**Solution**: Run the MCP PDF generator which includes visual QA

**Problem**: "Cannot find module 'puppeteer'"
**Solution**: Run `npm install` in the project directory

### Debug Mode

Enable detailed logging:

```bash
# Debug PDF generation
DEBUG=1 make pdf

# Debug WebSocket communication
DEBUG=websocket python -m ebook_pipeline.run_complete_pipeline
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Code style
- Testing requirements
- Pull request process
- Community standards

## Support

- **Documentation**: [docs.claude-elite.dev](https://docs.claude-elite.dev)
- **Issues**: [GitHub Issues](https://github.com/claude-elite/book-automation/issues)
- **Community**: [Discord Server](https://discord.gg/claude-elite)

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.