# PDF Quality Assurance

The PDF QA system automatically verifies that generated PDFs meet quality standards, especially checking for proper cover images and correct page dimensions.

## 🔍 What It Checks

1. **File Existence** - Ensures PDF was generated
2. **Page Dimensions** - Verifies 6×9" book format (432×648 pts)
3. **Cover Image** - Detects if first page has visual content (not just text)
4. **File Size** - Reports PDF size for reference

## 🚀 How It Works

The QA check runs automatically after PDF generation unless disabled. It uses:
- `pdf-lib` to analyze PDF structure
- Puppeteer to capture visual screenshots
- Image analysis to detect cover presence

## 📦 Usage

### Automatic QA (Default)

```bash
# Build with automatic QA
npm run build:pdf
make pdf

# With preview
npm run preview
```

### Skip QA (Development)

```bash
# Skip QA for faster builds
SKIP_PDF_QA=1 npm run build:pdf
make pdf-fast
```

### Manual QA Check

```bash
# Run QA on existing PDF
node scripts/pdf-qa-loop-real.js
```

## ⚠️ QA Failures

If QA fails, you'll see:

```
❌ ERRO: CAPA NÃO ENCONTRADA NO PDF!
O PDF não tem uma imagem de capa na primeira página.
```

Common causes:
- Missing cover image in `assets/images/cover.jpg`
- Cover image failed to embed (use base64 encoding)
- PDF generation errors

## 🛠️ Troubleshooting

### Cover Not Found

1. Check if `assets/images/cover.jpg` exists
2. Verify image is being embedded as base64
3. Check console for image loading errors
4. Look at the screenshot in `build/pdf-first-page.png`

### Wrong Page Size

1. Verify preset configuration
2. Check CSS `@page` rules
3. Ensure `preferCSSPageSize: true` in PDF options

## 📊 CI/CD Integration

GitHub Actions automatically runs PDF QA:
- On every push to main/develop
- On pull requests
- Build fails if QA doesn't pass

## 🔧 Configuration

The QA script expects:
- PDF at `release/ebook.pdf`
- 6×9 inch page size (432×648 points)
- Visual content on first page (>50KB screenshot)

Modify `scripts/pdf-qa-loop-real.js` to adjust thresholds.