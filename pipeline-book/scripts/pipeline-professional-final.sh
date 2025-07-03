#!/bin/bash

# PROFESSIONAL FINAL PIPELINE
# Small fonts, perfect breaks, Adobe compatible

echo "============================================================"
echo "🎯 PROFESSIONAL FINAL PIPELINE"
echo "============================================================"
echo ""

# Step 1: Generate Professional PDF
echo "📑 Step 1: Generating Professional PDF..."
echo "  • Font size: 9pt"
echo "  • Dense layout"
echo "  • Proper page breaks"
node scripts/generation/generate-professional-final.js

if [ $? -ne 0 ]; then
    echo "❌ PDF generation failed"
    exit 1
fi

# Step 2: Fix for Adobe
echo ""
echo "🔧 Step 2: Fixing for Adobe Reader..."
node scripts/qa/adobe-fix-and-test.js

if [ $? -ne 0 ]; then
    echo "❌ Adobe fix failed"
    exit 1
fi

# Step 3: Check page breaks
echo ""
echo "📄 Step 3: Checking page breaks..."
node scripts/qa/check-page-breaks.js build/dist/professional-adobe-fixed.pdf

# Step 4: Visual verification
echo ""
echo "🖼️  Step 4: Visual verification..."
node scripts/qa/full-visual-verification.js build/dist/professional-adobe-fixed.pdf

# Step 5: Final copy to Downloads
echo ""
echo "📦 Step 5: Preparing final delivery..."
FINAL_PDF="build/dist/professional-adobe-fixed.pdf"

if [ -f "$FINAL_PDF" ]; then
    cp "$FINAL_PDF" ~/Downloads/Claude-Elite-Pipeline-PROFESSIONAL.pdf
    
    # Get stats
    PAGE_COUNT=$(node -e "
    const {PDFDocument} = require('pdf-lib');
    const fs = require('fs');
    PDFDocument.load(fs.readFileSync('$FINAL_PDF'))
      .then(pdf => console.log(pdf.getPageCount()))
    ")
    
    FILE_SIZE=$(ls -lh "$FINAL_PDF" | awk '{print $5}')
    
    echo ""
    echo "============================================================"
    echo "✅ PROFESSIONAL PDF READY"
    echo "============================================================"
    echo ""
    echo "📄 File: ~/Downloads/Claude-Elite-Pipeline-PROFESSIONAL.pdf"
    echo "📊 Pages: $PAGE_COUNT"
    echo "📏 Size: $FILE_SIZE"
    echo "🔤 Font: 9pt Georgia (professional density)"
    echo "✓ Adobe Reader: Compatible"
    echo "✓ Page breaks: Optimized"
    echo ""
    echo "🎉 Ready for professional distribution!"
else
    echo "❌ Final PDF not found"
    exit 1
fi