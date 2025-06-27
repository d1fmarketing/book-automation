# OmniCreator-X: Universal Book-to-Everything Pipeline

Transform your Markdown chapters into a complete digital publishing ecosystem with zero manual intervention.

## Features

- 📚 **EPUB & PDF Generation** - Professional ebook formats with metadata
- 🎨 **AI Image Generation** - Contextual images via Ideogram 3.0
- 🌐 **Landing Page Creation** - Conversion-focused, responsive design
- 🎯 **Brand Consistency** - Optional palette injection across all outputs
- 🤖 **Fully Automated** - Set config and run once

## Quick Start

1. **Configure your book** (.env file):
```bash
BOOK_TITLE=Your Amazing Book
BOOK_SLUG=your-amazing-book
AUTHOR_NAME=Jane Doe
SOURCE_DIR=chapters/
TARGET_DOMAIN=mybooks.com
PRIMARY_PALETTE=["#FF6B00", "#002B5B"]
IDEOGRAM_API_KEY=your_key
```

2. **Add image placeholders** in your Markdown:
```markdown
![AI-IMAGE: A mystical forest with glowing mushrooms]()
```

3. **Run the pipeline**:
```bash
python omnicreator_run.py
```

## Output Structure

```
dist/
├── your-book-slug.epub
├── your-book-slug.pdf
└── your-book-slug-landing.html

assets/images/your-book-slug/
├── mystical_forest_abc123.png
└── ...

build_manifest.json
```

## Architecture

```
OmniCreator-X
├── ImagePromptAgent    # Local prompt engineering
├── BookBuilder         # EPUB/PDF generation
├── LandingPageBuilder  # Static site generation
└── OmniCreator         # Main orchestrator
```

## Customization

### Brand Colors
Set `PRIMARY_PALETTE` to inject your brand colors into:
- Generated images (when "brand" is mentioned)
- Landing page theme
- Book cover elements

### Image Style
Modify `ImagePromptAgent.default_style` for different aesthetics:
- `"vivid, ultra-detail"` (default)
- `"minimalist, clean"`
- `"photorealistic, cinematic"`

### Landing Page Sections
Edit `LandingPageBuilder.create_page()` to customize:
- Hero content
- Benefit points
- Author bio
- CTA buttons

## Build Manifest

After completion, check `build_manifest.json`:
```json
{
  "status": "success",
  "started_at": "2025-06-26T22:30:00",
  "completed_at": "2025-06-26T22:35:00",
  "ebook_path": "dist/your-book.epub",
  "pdf_path": "dist/your-book.pdf",
  "landing_page_url": "https://example.com/your-book",
  "images_generated": {
    "forest_scene.png": {
      "raw_desc": "mystical forest",
      "final_prompt": "mystical forest. vivid, ultra-detail",
      "cost": 0.08
    }
  }
}
```

## Requirements

- Python 3.9+
- Pandoc (for EPUB generation)
- Node.js (optional, for advanced PDF)
- Ideogram API key

## Error Handling

- **Retry Logic**: 3 attempts with exponential backoff
- **Graceful Degradation**: PDF falls back to Pandoc if Puppeteer fails
- **Detailed Logging**: Check `logs/omnicreator.log`

## Zero-Touch Publishing

Once configured, OmniCreator-X handles everything:
1. Scans chapters
2. Generates contextual images
3. Builds professional ebooks
4. Creates landing page
5. Deploys to your domain
6. Reports success

**No manual edits needed after initial setup!**