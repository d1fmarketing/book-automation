# 📚 Publishing Integration

Automated publishing to Amazon KDP, Apple Books, and Google Play Books.

## 🚀 Quick Start

### 1. Test with Dry Run

```bash
# Test all platforms
npm run publish:dry-run

# Test specific platform
node scripts/publish-book.js -p kdp --dry-run
```

### 2. Set Up Credentials

Copy the template files and add your credentials:

```bash
cp config/kdp-credentials.template.json config/kdp-credentials.json
cp config/apple-credentials.template.json config/apple-credentials.json
cp config/google-credentials.template.json config/google-credentials.json
```

⚠️ **IMPORTANT**: Never commit real credentials! Add to `.gitignore`:

```gitignore
config/*-credentials.json
```

### 3. Publish Your Book

```bash
# Publish to all platforms
npm run publish:all

# Publish to specific platforms
npm run publish:kdp     # Amazon only
npm run publish:apple   # Apple Books only
npm run publish:google  # Google Play only
```

## 📋 Platform Requirements

### Amazon KDP

1. **Account**: KDP account at kdp.amazon.com
2. **Files**: PDF for print, optional EPUB for Kindle
3. **Metadata**: ISBN (optional), pricing, categories
4. **Cover**: High-res cover image (1600x2400px minimum)

### Apple Books

1. **Account**: Apple Developer account
2. **Software**: iTunes Producer (download from iTunes Connect)
3. **Files**: EPUB 3.0 format
4. **Metadata**: ISBN required, BISAC codes
5. **macOS**: Required for iTunes Producer

### Google Play Books

1. **Account**: Google Play Books Partner account
2. **API Access**: Enable Books API in Google Cloud Console
3. **OAuth**: Set up OAuth2 credentials
4. **Files**: EPUB format preferred
5. **Cover**: JPG format, high resolution

## 🔧 Configuration

### metadata.yaml

Add platform-specific fields:

```yaml
# Amazon KDP
pricing:
  us: 9.99
  uk: 7.99
  territories: all  # or specific list

# Apple Books
apple_id: "YOUR_APPLE_BOOK_ID"  # if republishing
bisac_codes:
  - "FIC000000"  # Fiction / General
  - "FIC009000"  # Fiction / Fantasy

# Google Play
maturity_rating: "NOT_MATURE"
page_count: 250
```

### Platform Features

| Feature | KDP | Apple | Google |
|---------|-----|-------|--------|
| Automated Upload | ✅ | ✅ | ✅ |
| Price Management | ✅ | ✅ | ✅ |
| Territory Selection | ✅ | ✅ | ✅ |
| Series Support | ✅ | ✅ | ❌ |
| Pre-orders | ✅ | ✅ | ✅ |
| DRM Options | ✅ | ✅ | ✅ |

## 🛠️ Advanced Usage

### Publishing Report

After publishing, a detailed report is generated:

```bash
build/reports/publishing-report-[timestamp].json
```

Contains:
- Publishing results for each platform
- Generated IDs (ASIN, Apple ID, Volume ID)
- Next steps checklist
- Error details if any

### Updating Existing Books

```javascript
// Update price on KDP
const publisher = new KDPPublisher();
await publisher.updateBookPrice('ASIN123456', 12.99);

// Update metadata on Apple
const apple = new AppleBooksPublisher();
await apple.updateMetadata('APPLE_ID', { 
  description: 'New description' 
});
```

### Monitoring Sales

Each platform provides sales reporting:

```bash
# Future feature
npm run sales:report --platform=kdp --month=2024-01
```

## 🐛 Troubleshooting

### KDP Issues

- **Login fails**: Check 2FA settings
- **Preview timeout**: Increase timeout in script
- **Category not found**: Use valid BISAC codes

### Apple Books Issues

- **iTunes Producer not found**: Install from iTunes Connect
- **Validation fails**: Check EPUB with epubcheck first
- **Upload hangs**: Check network and file size

### Google Play Issues

- **Auth fails**: Refresh OAuth tokens
- **API not enabled**: Enable Books API in Cloud Console
- **Price not showing**: Check territory settings

## 📝 Best Practices

1. **Always dry run first** to catch issues
2. **Version your books** - update metadata version
3. **Test EPUB validation** before uploading
4. **Set up price tiers** carefully
5. **Use consistent metadata** across platforms
6. **Monitor each platform** after publishing
7. **Keep credentials secure** - use env vars in production

## 🔗 Resources

- [KDP Guidelines](https://kdp.amazon.com/help/topic/G200634390)
- [Apple Books Asset Guide](https://itunespartner.apple.com/books/support)
- [Google Play Books Partner](https://play.google.com/books/publish)

## 🚧 Future Features

- [ ] Kobo integration
- [ ] Barnes & Noble Press
- [ ] Draft2Digital API
- [ ] Smashwords integration
- [ ] Sales analytics dashboard
- [ ] Automated price optimization
- [ ] Review monitoring
- [ ] Marketing automation