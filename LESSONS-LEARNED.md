# Lessons Learned - Book Automation Pipeline

## Working Pipeline Flow

### ✅ What Works

1. **PDF Generation with Puppeteer**
   - Script: `scripts/generate-pdf-puppeteer.js`
   - Converts Markdown → HTML → PDF
   - Professional 6×9" book format
   - Embeds images as base64 (critical for cover display)

2. **Visual Verification System**
   - Script: `scripts/pdf-to-images.py` (uses pdf2image)
   - Converts PDF pages to PNG screenshots
   - Enables page-by-page visual inspection
   - Essential for catching formatting issues

3. **Professional CSS Styling**
   - File: `assets/css/pdf.css`
   - Drop caps with blue styling (text-shadow effect)
   - Chapter formatting with ornamental symbols (❦)
   - Proper typography with Crimson Text font

## Key Fixes Applied

### 1. Duplicate Page Numbers
**Problem**: Page numbers appearing twice in footer
**Cause**: Both CSS `content: counter(page)` and Puppeteer `footerTemplate` generating numbers
**Solution**: Removed CSS counter, kept only Puppeteer footer

### 2. Blank Pages
**Problem**: Blank pages after TOC and before final thank you page
**Solutions**:
- Removed `page-break-after: always` from `.toc-page`
- Created `.chapter-first` class without page-break for first chapter
- Changed final page from `.chapter` to `.thank-you-page` class
- Reduced padding-top on first chapter to 1in

### 3. Cover Image Not Displaying
**Problem**: Cover image showing as broken/blank
**Cause**: File:// URLs don't work in Puppeteer PDF generation
**Solution**: Convert image to base64 and embed directly in HTML

### 4. Drop Cap Gradient Not Working
**Problem**: CSS gradient not rendering in PDF
**Solution**: Used text-shadow effects to create visual depth instead

## Visual Verification Process

```bash
# 1. Generate PDF
node scripts/generate-pdf-puppeteer.js

# 2. Convert to screenshots
python3 scripts/pdf-to-images.py

# 3. View each page
# Screenshots saved in build/screenshots/page-XX.png
```

## Important Configuration

### CSS Classes
- `.chapter` - Regular chapters (forces new page)
- `.chapter-first` - First chapter (no page break)
- `.thank-you-page` - Final page (no forced break)

### Critical Scripts
1. `scripts/generate-pdf-puppeteer.js` - Main PDF generator
2. `scripts/pdf-to-images.py` - Visual verification
3. `assets/css/pdf.css` - All styling

## Common Errors to Avoid

1. **Never claim to see PDF content directly** - Use screenshot conversion
2. **Always check ALL pages** - Don't stop at partial verification
3. **Test after EVERY change** - Small CSS changes can break layout
4. **Use base64 for images** - File paths don't work reliably

## Final Working Configuration

- **Total pages**: 15 (no blank pages)
- **Format**: 6×9 inches (standard book size)
- **Fonts**: Crimson Text (body), Montserrat (headings)
- **Features**: Drop caps, page numbers, chapter breaks, TOC

## Pipeline Commands

```bash
# Full build
make all

# Just PDF
make pdf

# Clean artifacts
make clean

# Visual verification
python3 scripts/pdf-to-images.py
```

## Git Workflow

Always commit working states before major changes:
```bash
git add . && git commit -m "working state description"
```

Use `--no-verify` to bypass pre-commit hooks when needed:
```bash
git commit --no-verify -m "emergency commit"
```