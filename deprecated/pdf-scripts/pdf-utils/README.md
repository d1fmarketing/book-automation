# Unified PDF Generation System

## Overview

The unified PDF generation system consolidates 6 separate PDF generation scripts into a single configurable script with different presets. This reduces code duplication and makes it easier to maintain and extend the PDF generation functionality.

## Architecture

### Core Script
- `generate-pdf-unified.js` - Main entry point that loads presets and orchestrates PDF generation

### Utilities (`pdf-utils/`)
- `console-logger.js` - Colored console output and logging
- `chapter-processor.js` - Chapter reading, sorting, and markdown processing
- `image-handler.js` - Image path resolution and base64 encoding
- `html-builder.js` - HTML template generation with preset-specific layouts

### Presets (`pdf-presets/`)
- `main.js` - Full professional book with cover, TOC, and all features
- `clean.js` - Minimalist with zero margins and clean styling
- `colorful.js` - Vibrant colors with ultra-compact spacing
- `full-page.js` - Maximum content area with emoji preservation
- `professional.js` - Commercial-grade with baseline grid and accessibility
- `readable.js` - Large fonts and comfortable spacing

## Usage

### Command Line
```bash
# Default (main preset)
node scripts/generate-pdf-unified.js

# Specific preset
node scripts/generate-pdf-unified.js --preset=professional

# Debug mode (saves HTML)
node scripts/generate-pdf-unified.js --preset=colorful --debug

# Quiet mode
node scripts/generate-pdf-unified.js --preset=clean --quiet
```

### NPM Scripts
```bash
npm run build:pdf              # Main preset (default)
npm run build:pdf:clean        # Clean minimal preset
npm run build:pdf:colorful     # Colorful compact preset
npm run build:pdf:full-page    # Full page preset
npm run build:pdf:professional # Professional print-ready preset
npm run build:pdf:readable     # Readable large-font preset
npm run build:pdf:all          # Generate all presets
```

## Creating New Presets

1. Create a new file in `pdf-presets/` (e.g., `custom.js`)
2. Export an object with the following structure:

```javascript
module.exports = {
    name: 'custom',
    description: 'Custom PDF preset description',
    
    // Output filename (string or function)
    outputFilename: (metadata) => 'custom-output.pdf',
    
    // Feature flags
    features: {
        includeCover: true,
        includeTitlePage: false,
        // ... other features
    },
    
    // PDF generation options
    pdfOptions: (metadata) => ({
        width: '6in',
        height: '9in',
        printBackground: true,
        // ... other options
    }),
    
    // Puppeteer launch options
    puppeteerOptions: {
        headless: 'new',
        args: ['--no-sandbox']
    },
    
    // Custom CSS
    async getCustomCSS() {
        return `/* Custom styles */`;
    },
    
    // Optional: Process chapters
    processChapter(html, options) {
        // Custom chapter processing
        return html;
    },
    
    // Optional: Post-processing
    async postProcess(outputPath, tempDir, logger) {
        // Additional processing after PDF generation
    }
};
```

3. Use the preset: `node scripts/generate-pdf-unified.js --preset=custom`

## Preset Features

### Common Features
- `includeCover` - Include cover page
- `includeTitlePage` - Include title page
- `includeCopyright` - Include copyright page
- `includeTOC` - Include table of contents
- `includeThankYou` - Include thank you/CTA page
- `includePageNumbers` - Show page numbers
- `saveDebugHTML` - Save HTML for debugging
- `dropCaps` - Apply drop caps to paragraphs

### Special Features
- `processAIImages` - Handle AI-IMAGE placeholders (main)
- `preserveEmojis` - Special emoji handling (full-page)
- `professional` - Enable professional typography (professional)
- `baselineGrid` - Use baseline grid system (professional)
- `accessibility` - Add PDF accessibility features (professional)
- `cmykSupport` - Add CMYK color support (professional)

## Migration Notes

The original scripts are preserved for reference but can be removed once the unified system is verified. Key differences:

1. **main preset** = `generate-pdf-puppeteer.js`
2. **clean preset** = `generate-clean-pdf.js`
3. **colorful preset** = `generate-colorful-compact-pdf.js`
4. **full-page preset** = `generate-full-page-pdf.js`
5. **professional preset** = `generate-professional-pdf.js`
6. **readable preset** = `generate-readable-pdf.js`

## Benefits

1. **Single codebase** - Easier to maintain and debug
2. **Reduced duplication** - Common code extracted to utilities
3. **Extensibility** - Easy to add new presets
4. **Consistency** - Uniform error handling and logging
5. **Flexibility** - Mix and match features across presets
6. **Testing** - Easier to test with modular structure