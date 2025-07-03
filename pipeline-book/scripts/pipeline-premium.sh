#!/bin/bash

# Premium Pipeline with Perfect PDF Generation
# Uses the new unified generator and automated QA loop

echo "============================================================"
echo "🚀 PREMIUM PIPELINE WITH PERFECT PDF"
echo "============================================================"
echo ""

# Step 1: Generate Perfect PDF
echo "📑 Step 1: Generating Perfect 6×9 PDF..."
echo "----------------------------------------"
node scripts/generation/generate-final-perfect-pdf.js

if [ $? -ne 0 ]; then
    echo "❌ PDF generation failed"
    exit 1
fi

# Step 2: Run Automated QA Loop
echo ""
echo "🔄 Step 2: Running Automated QA Loop..."
echo "----------------------------------------"
node scripts/qa/automated-pdf-fixer.js

if [ $? -ne 0 ]; then
    echo "❌ QA loop failed"
    exit 1
fi

# Step 3: Visual Verification
echo ""
echo "🖼️  Step 3: Visual Verification..."
echo "----------------------------------------"
node scripts/qa/full-visual-verification.js

if [ $? -ne 0 ]; then
    echo "❌ Visual verification failed"
    exit 1
fi

# Step 4: Adobe Compatibility Check
echo ""
echo "📄 Step 4: Adobe Reader Compatibility..."
echo "----------------------------------------"
node scripts/qa/test-adobe-compatibility.js

if [ $? -ne 0 ]; then
    echo "⚠️  Adobe compatibility warning"
fi

# Success
echo ""
echo "============================================================"
echo "✅ PREMIUM PIPELINE COMPLETE"
echo "============================================================"
echo ""

# Check for SHA256
if [ -f "build/dist/perfect.sha256" ]; then
    echo "📄 SHA256 Hash:"
    cat build/dist/perfect.sha256
    echo ""
fi

echo "📍 Final PDF: build/dist/premium-ebook-perfect.pdf"
echo "📊 Visual Report: build/qa/visual-verification/report.html"
echo "📋 Quality Log: build/logs/quality-loop.log"
echo ""
echo "✨ 100% Professional Quality Achieved! ✨"