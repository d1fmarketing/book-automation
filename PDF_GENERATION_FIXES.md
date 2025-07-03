# PDF Generation System Fixes

## Summary of Changes

### 1. Centralized Markdown Processing
- Created `scripts/pdf-utils/markdown-processor.js` to handle all markdown transformations
- Unified callout processing for both syntaxes: `[!TYPE]` and `> [!TYPE]`
- Centralized AI-IMAGE placeholder processing
- All presets now use the same markdown processor for consistency

### 2. Fixed Header/Footer Conflicts
- Removed CSS @page rules that conflicted with Puppeteer's headerTemplate/footerTemplate
- Each preset now uses either CSS OR Puppeteer options, not both
- Fixed duplicate page numbers issue

### 3. Consolidated PDF Generation
- Removed duplicate scripts:
  - `scripts/generate-pdf-fixed.js` (duplicate functionality)
  - `scripts/nuclear-rebuild.js` (created conflicting implementations)
- All PDF generation now goes through `generate-pdf-unified.js` with presets

### 4. Updated Presets
- **main.js**: Uses Puppeteer for page numbers instead of CSS @page
- **digital.js**: Removed duplicate AI-IMAGE processing
- **digital-pro.js**: Removed custom callout renderer, uses central processor
- **digital-pro-fixed.js**: Completely rewritten to use central processing
- **adobe-fixed.js**: Simplified to use central processing
- Removed backup files (`*.backup`, `*.backup-*`)

### 5. Callout Processing
- Preprocesses simple `[!TYPE]` syntax before marked parsing
- Handles blockquote syntax `> [!TYPE]` in the custom renderer
- Supports all callout types: TIP, WARNING, INFO, SUCCESS, KEY, QUOTE, NOTE
- Properly handles multi-line callout content

### 6. Added Scripts
- `test-callout-processing.js`: Test script to verify callout processing
- Added npm scripts for new presets:
  - `build:pdf:digital-pro`
  - `build:pdf:digital-pro-fixed`
  - `build:pdf:adobe-fixed`

## Testing

To test the fixes:

```bash
# Test callout processing
node scripts/test-callout-processing.js

# Build with different presets
npm run build:pdf:digital
npm run build:pdf:professional
npm run build:pdf:digital-pro-fixed
npm run build:pdf:adobe-fixed

# Build with verbose output
node scripts/generate-pdf-unified.js --preset=digital --verbose
```

## Benefits

1. **Consistency**: All presets process markdown the same way
2. **No Conflicts**: Headers/footers render correctly without duplication
3. **Maintainability**: Central processor makes updates easier
4. **Extensibility**: Easy to add new callout types or markdown features
5. **Clarity**: Removed duplicate and conflicting implementations