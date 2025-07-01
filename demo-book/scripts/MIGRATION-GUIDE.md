# PDF Generation Scripts Migration Guide

## Overview

We've successfully consolidated 6 separate PDF generation scripts into a unified system. This guide helps you transition from the old scripts to the new unified approach.

## Migration Map

| Old Script | New Command | Notes |
|------------|-------------|-------|
| `generate-pdf-puppeteer.js` | `generate-pdf-unified.js --preset=main` | Default preset, includes all book features |
| `generate-clean-pdf.js` | `generate-pdf-unified.js --preset=clean` | Minimalist with zero margins |
| `generate-colorful-compact-pdf.js` | `generate-pdf-unified.js --preset=colorful` | Vibrant colors, compact spacing |
| `generate-full-page-pdf.js` | `generate-pdf-unified.js --preset=full-page` | Maximum content area |
| `generate-professional-pdf.js` | `generate-pdf-unified.js --preset=professional` | Commercial-grade with accessibility |
| `generate-readable-pdf.js` | `generate-pdf-unified.js --preset=readable` | Large fonts for readability |

## What Changed

### 1. Single Entry Point
- **Before**: 6 different scripts to maintain
- **After**: 1 script with preset configuration

### 2. Modular Architecture
- **Common utilities** extracted to `pdf-utils/`
- **Preset configurations** in `pdf-presets/`
- **Easier to maintain** and extend

### 3. Improved Features
- Consistent error handling
- Better logging with color support
- Debug mode for all presets
- Quiet mode for CI/CD

### 4. NPM Scripts Updated
```bash
# Old way
npm run build:pdf  # Only ran generate-pdf-puppeteer.js

# New way
npm run build:pdf              # Main preset
npm run build:pdf:clean        # Clean preset
npm run build:pdf:colorful     # Colorful preset
npm run build:pdf:full-page    # Full page preset
npm run build:pdf:professional # Professional preset
npm run build:pdf:readable     # Readable preset
npm run build:pdf:all          # Generate all presets
```

## Testing the Migration

1. **Test each preset**:
   ```bash
   npm run build:pdf:clean
   npm run build:pdf:colorful
   # etc.
   ```

2. **Compare outputs**:
   - File sizes should be similar
   - Visual appearance should match
   - Special features should work (e.g., accessibility in professional)

3. **Check compatibility**:
   - Main preset saves HTML to `build/tmp/ebook.html` for QA tools
   - Professional preset still calls accessibility/CMYK scripts
   - All output filenames match original scripts

## Rollback Plan

If issues arise, the original scripts are still available:
- All original scripts remain in `scripts/`
- Simply run them directly as before
- No changes to metadata or chapter files needed

## Next Steps

1. **Verify all presets** work as expected
2. **Update any automation** that calls the old scripts
3. **Remove old scripts** once confident (suggested after 1 week)

## Benefits of Migration

1. **Maintenance**: Fix bugs in one place, not 6
2. **Features**: Add new features to all presets easily
3. **Testing**: Easier to test common functionality
4. **Performance**: Shared code means better optimization
5. **Documentation**: Single source of truth

## Troubleshooting

### Issue: Preset not found
```bash
Error: Cannot find module './pdf-presets/xyz'
```
**Solution**: Check preset name, use `--help` to see available presets

### Issue: Different output than before
**Solution**: Run with `--debug` to save HTML and compare

### Issue: Missing features
**Solution**: Check preset configuration in `pdf-presets/[preset].js`

## Support

- Check `scripts/pdf-utils/README.md` for technical details
- Review preset files in `pdf-presets/` for configuration
- Run with `--debug` for detailed output