# Real Implementation Guide: Building the Agent CLI Pipeline

## Understanding the Architecture

The book-automation project describes an architecture using two key tools that don't exist as public packages:
- **agentcli** - A unified CLI for calling AI services (Claude, GPT-4, Ideogram)
- **mcp** - Model Context Protocol for browser-based visual QA

## How to Build This for Real

### Option 1: Direct API Integration

Replace the conceptual tools with direct API calls:

```python
# scripts/real_pipeline.py
import os
import anthropic
import requests
from playwright.sync_api import sync_playwright

# Text generation with Claude
def generate_text(prompt):
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text

# Image generation with Ideogram
def generate_image(prompt):
    headers = {"Api-Key": os.getenv("IDEOGRAM_API_KEY")}
    response = requests.post(
        "https://api.ideogram.ai/generate",
        headers=headers,
        json={"prompt": prompt, "aspect_ratio": "2:3"}
    )
    return response.json()["data"][0]["url"]

# Visual QA with Playwright
def visual_qa(html_path):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"file://{html_path}")
        
        # Check font size
        font_size = page.evaluate("getComputedStyle(document.body).fontSize")
        
        # Take screenshot for manual review
        page.screenshot(path="qa/page.png")
        
        browser.close()
        return {"font_size": font_size}
```

### Option 2: Create the CLI Tools

Build the actual `agentcli` and `mcp` tools:

```bash
# Create agentcli project
mkdir agentcli && cd agentcli
npm init -y

# agentcli/index.js
#!/usr/bin/env node
const { program } = require('commander');
const axios = require('axios');

program
  .command('call <service>')
  .option('--model <model>', 'AI model to use')
  .option('--prompt <prompt>', 'Input prompt')
  .action(async (service, options) => {
    if (service === 'writer') {
      // Call Claude API
      const response = await callClaude(options.prompt, options.model);
      console.log(response);
    } else if (service === 'ideogram') {
      // Call Ideogram API
      const imageUrl = await callIdeogram(options.prompt);
      console.log(`Image generated: ${imageUrl}`);
    }
  });

program.parse();

# Make it installable
npm link
```

### Option 3: Use Existing Tools

Leverage established tools that provide similar functionality:

```bash
# For text generation
pip install langchain openai anthropic

# For image generation  
pip install replicate
# or use DALL-E API directly

# For visual QA
npm install -g @playwright/test

# Create a unified script
cat > run_pipeline.sh << 'EOF'
#!/bin/bash

# Generate text with LangChain
python scripts/generate_chapters.py

# Generate images with DALL-E
python scripts/generate_images.py

# Build PDF with Pandoc + wkhtmltopdf
pandoc chapters/*.md -o build/ebook.pdf \
  --pdf-engine=wkhtmltopdf \
  --css=templates/pdf-standard.css

# Visual QA with Playwright
npx playwright test tests/visual-qa.spec.js
EOF
```

## Recommended Approach

For immediate results, use **Option 3** with existing tools:

1. **Text Generation**: OpenAI/Anthropic Python SDK
2. **Image Generation**: OpenAI DALL-E or Replicate
3. **PDF Building**: Pandoc or Puppeteer
4. **Visual QA**: Playwright or Puppeteer

This gives you a working pipeline today while the idealized `agentcli`/`mcp` architecture remains a future goal.

## Example Working Pipeline

```bash
# 1. Install real tools
pip install openai anthropic pillow pypdf2
npm install -g playwright

# 2. Generate content
python scripts/generate_content.py \
  --chapters 4 \
  --words-per-chapter 200 \
  --model claude-3-opus

# 3. Generate cover
python scripts/generate_cover.py \
  --prompt "Minimalist geometric book cover" \
  --output assets/images/cover.jpg

# 4. Build PDF
node scripts/build-pdf.js \
  --input chapters/ \
  --output build/ebook.pdf

# 5. Visual QA
npx playwright test \
  --project=chromium \
  tests/check-pdf-quality.spec.js
```

This achieves the same result as the conceptual `agentcli`/`mcp` pipeline but uses tools that exist today.