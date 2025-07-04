# 🚫 NO PDF POLICY

## Overview

This pipeline generates **HTML and EPUB only**. PDF generation has been completely removed to focus on modern, accessible, and lightweight ebook formats.

## Why No PDF?

1. **File Size**: PDFs are 10-30MB vs HTML/EPUB at 1-3MB
2. **Complexity**: PDF generation adds unnecessary complexity
3. **Accessibility**: HTML/EPUB are more accessible and responsive
4. **Distribution**: Modern platforms prefer EPUB format
5. **SEO**: HTML can be indexed by search engines

## Enforcement Mechanisms

### 1. Environment Variable
```bash
GENERATE_PDF=false
```

### 2. Orchestrator Flow
- Pipeline goes directly from `QA_HTML` → `DONE`
- No PDF state exists in the state machine

### 3. CI/CD Validation
- Manifest gate blocks any mention of PDF
- Deployment fails if PDF detected

### 4. File System
- All PDF scripts moved to `deprecated/pdf-scripts/`
- `.gitignore` blocks all `*.pdf` files
- `make clean` removes any PDF files

## Verification

Run this command to verify no PDF generation:
```bash
npm run verify-no-pdf
```

Expected output:
```
✅ ALL CLEAR! No PDF generation detected.
The pipeline will generate HTML/EPUB only.
```

## What If I Need PDF?

If you absolutely need PDF for a specific use case:

1. **Use browser print**: Open HTML in browser → Print → Save as PDF
2. **Use online converters**: Upload EPUB to online EPUB→PDF converters
3. **Use Calibre**: Convert EPUB to PDF using Calibre software
4. **DO NOT** re-enable PDF in the pipeline

## Migration Guide

If you're updating from an older version:

1. Add to `.env`:
   ```
   GENERATE_PDF=false
   ```

2. Clean build artifacts:
   ```bash
   make clean
   ```

3. Update scripts:
   ```bash
   npm run verify-no-pdf
   ```

4. Remove deprecated scripts:
   ```bash
   rm -rf scripts/generate-pdf-*.js
   rm -rf scripts/pdf-utils/
   ```

## HTML/EPUB Benefits

### HTML Ebooks
- **Instant loading**: No download required
- **SEO friendly**: Searchable content
- **Responsive**: Works on all devices
- **Interactive**: Supports JavaScript features
- **Lightweight**: ~1-2MB total

### EPUB Format
- **Industry standard**: Accepted by all major platforms
- **Reflowable text**: Adapts to screen size
- **Accessibility**: Built-in support for screen readers
- **Metadata rich**: Better discoverability
- **Small size**: ~500KB-1MB

## Pipeline Output

The pipeline now produces:

```
build/ebooks/your-topic/
├── html/
│   ├── index.html      # Complete HTML ebook
│   ├── styles.css      # Optimized styles
│   └── images/         # Compressed images
├── epub/
│   └── ebook.epub      # Standard EPUB file
└── metadata.json       # Book metadata
```

## Publishing Platforms

All major platforms accept EPUB:
- ✅ Amazon KDP (converts EPUB to AZW automatically)
- ✅ Apple Books (prefers EPUB)
- ✅ Google Play Books (EPUB required)
- ✅ Kobo (EPUB native)
- ✅ Gumroad (any format)

---

**Remember**: The future of ebooks is HTML/EPUB. PDF is legacy.