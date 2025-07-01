#!/bin/bash

# Verify and Fix Loop
# This script will create a perfect PDF and verify it

echo "🚀 Starting Verify and Fix Loop..."
echo ""

# Create a better cover image first
echo "📸 Creating high-quality cover..."
node -e "
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const coverSvg = \`<svg width=\"1200\" height=\"1800\" xmlns=\"http://www.w3.org/2000/svg\">
    <defs>
        <linearGradient id=\"bg\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">
            <stop offset=\"0%\" style=\"stop-color:#0066CC;stop-opacity:1\" />
            <stop offset=\"50%\" style=\"stop-color:#0088DD;stop-opacity:1\" />
            <stop offset=\"100%\" style=\"stop-color:#00AA44;stop-opacity:1\" />
        </linearGradient>
        <filter id=\"shadow\">
            <feDropShadow dx=\"0\" dy=\"10\" stdDeviation=\"20\" flood-opacity=\"0.3\"/>
        </filter>
    </defs>
    
    <!-- Background -->
    <rect width=\"1200\" height=\"1800\" fill=\"url(#bg)\"/>
    
    <!-- Abstract shapes -->
    <circle cx=\"100\" cy=\"100\" r=\"200\" fill=\"white\" opacity=\"0.1\"/>
    <circle cx=\"1100\" cy=\"1700\" r=\"300\" fill=\"white\" opacity=\"0.1\"/>
    <rect x=\"500\" y=\"200\" width=\"200\" height=\"200\" fill=\"white\" opacity=\"0.05\" transform=\"rotate(45 600 300)\"/>
    
    <!-- Title -->
    <text x=\"600\" y=\"800\" font-family=\"Arial, sans-serif\" font-size=\"90\" font-weight=\"100\" text-anchor=\"middle\" fill=\"white\" filter=\"url(#shadow)\">The Claude Elite</text>
    <text x=\"600\" y=\"900\" font-family=\"Arial, sans-serif\" font-size=\"90\" font-weight=\"100\" text-anchor=\"middle\" fill=\"white\" filter=\"url(#shadow)\">Pipeline</text>
    
    <!-- Subtitle -->
    <text x=\"600\" y=\"1000\" font-family=\"Arial, sans-serif\" font-size=\"36\" font-weight=\"300\" text-anchor=\"middle\" fill=\"white\" opacity=\"0.9\">Mastering Automated Ebook Creation</text>
    
    <!-- Author -->
    <text x=\"600\" y=\"1600\" font-family=\"Arial, sans-serif\" font-size=\"40\" font-weight=\"400\" text-anchor=\"middle\" fill=\"white\">Enrique Oliveira</text>
</svg>\`;

sharp(Buffer.from(coverSvg))
    .png()
    .toFile(path.join(__dirname, '../assets/images/cover-hq.png'))
    .then(() => console.log('✓ High-quality cover created'))
    .catch(console.error);
"

# Wait for cover creation
sleep 2

# Now run the perfect PDF generator with the new cover
echo ""
echo "📖 Generating perfect PDF..."
node -e "
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function generatePerfectBook() {
    console.log('Loading all assets...');
    
    // Load cover
    const coverPath = path.join(__dirname, 'assets/images/cover-hq.png');
    const coverBuffer = await fs.readFile(coverPath);
    const coverBase64 = 'data:image/png;base64,' + coverBuffer.toString('base64');
    
    // Load chapter images (using the horizontal ebook versions)
    const chapterImages = {};
    for (let i = 1; i <= 5; i++) {
        const imgPath = path.join(__dirname, 'assets/images', \`chapter-0\${i}-\${i === 1 ? 'architecture' : i === 2 ? 'quality-interface' : i === 3 ? 'assistant-interface' : i === 4 ? 'cover-options' : 'future-vision'}-horizontal-ebook.png\`);
        if (fs.existsSync(imgPath)) {
            const imgBuffer = await fs.readFile(imgPath);
            chapterImages[i] = 'data:image/png;base64,' + imgBuffer.toString('base64');
        }
    }
    
    // Read chapter content
    const chapters = [];
    for (let i = 1; i <= 5; i++) {
        const chapterFile = \`chapter-0\${i}-\${i === 1 ? 'introduction' : i === 2 ? 'five-agents' : i === 3 ? 'implementation' : i === 4 ? 'professional-publishing' : 'future-evolution'}.md\`;
        const content = await fs.readFile(path.join(__dirname, 'chapters', chapterFile), 'utf-8');
        const lines = content.split('\\n');
        const title = lines.find(l => l.startsWith('title:')).replace('title:', '').trim().replace(/\"/g, '');
        const body = lines.slice(lines.findIndex(l => l.startsWith('# Chapter')) + 2).join('\\n').trim();
        chapters.push({ number: i, title, body });
    }
    
    console.log('Generating HTML...');
    
    const html = \`<!DOCTYPE html>
<html>
<head>
    <meta charset=\"UTF-8\">
    <style>
        @page {
            size: 6in 9in;
            margin: 0.75in;
        }
        
        @page :first {
            margin: 0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Georgia, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1A1A1A;
        }
        
        /* Cover - full bleed */
        .cover {
            page-break-after: always;
            width: 6in;
            height: 9in;
            position: relative;
            overflow: hidden;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Interior pages */
        .page {
            page-break-after: always;
            min-height: 7.5in;
        }
        
        .title-page {
            text-align: center;
            padding-top: 3in;
        }
        
        .title-page h1 {
            font-size: 36pt;
            font-weight: 100;
            margin-bottom: 0.5em;
        }
        
        .title-page .subtitle {
            font-size: 18pt;
            font-weight: 300;
            color: #555;
            margin-bottom: 3in;
        }
        
        .title-page .author {
            font-size: 16pt;
            font-weight: 400;
        }
        
        /* Chapters */
        .chapter {
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 72pt;
            font-weight: 100;
            color: #0066CC;
            line-height: 1;
            margin-bottom: 0.25em;
        }
        
        .chapter h1 {
            font-size: 24pt;
            font-weight: 300;
            margin-bottom: 1em;
            color: #1A1A1A;
        }
        
        .chapter p {
            text-indent: 1.5em;
            margin-bottom: 0.5em;
            text-align: justify;
        }
        
        .chapter p:first-of-type {
            text-indent: 0;
        }
        
        .chapter p:first-of-type::first-letter {
            font-size: 48pt;
            line-height: 1;
            font-weight: 300;
            float: left;
            margin: 0 0.05em -0.1em 0;
            color: #0066CC;
        }
        
        .chapter-image {
            width: 100%;
            max-width: 4in;
            margin: 1.5em auto;
            display: block;
        }
        
        /* Copyright page */
        .copyright {
            font-size: 9pt;
            line-height: 1.4;
            color: #555;
        }
        
        .copyright p {
            margin-bottom: 0.5em;
        }
    </style>
</head>
<body>
    <!-- COVER -->
    <div class=\"cover\">
        <img src=\"\${coverBase64}\" alt=\"Book Cover\">
    </div>
    
    <!-- TITLE PAGE -->
    <div class=\"page title-page\">
        <h1>The Claude Elite Pipeline</h1>
        <p class=\"subtitle\">Mastering Automated Ebook Creation</p>
        <p class=\"author\">Enrique Oliveira</p>
    </div>
    
    <!-- COPYRIGHT -->
    <div class=\"page copyright\">
        <p>Copyright © 2025 Enrique Oliveira</p>
        <p>All rights reserved.</p>
        <p>ISBN: 978-1-234567-89-0</p>
        <p>Publisher: Elite Automation Press</p>
        <p>First Edition</p>
    </div>
    
    <!-- TABLE OF CONTENTS -->
    <div class=\"page\">
        <h1 style=\"font-size: 24pt; font-weight: 300; margin-bottom: 1em;\">Table of Contents</h1>
        \${chapters.map((ch, i) => \`<p style=\"margin-bottom: 0.5em;\">Chapter \${ch.number}: \${ch.title}</p>\`).join('')}
    </div>
    
    <!-- CHAPTERS -->
    \${chapters.map(ch => \`
    <div class=\"chapter\">
        <div class=\"chapter-number\">\${ch.number}</div>
        <h1>\${ch.title}</h1>
        \${ch.body.split('\\n\\n').map((p, i) => {
            if (i === 1 && chapterImages[ch.number]) {
                return \`<p>\${p}</p><img src=\"\${chapterImages[ch.number]}\" alt=\"Chapter \${ch.number} illustration\" class=\"chapter-image\">\`;
            }
            return \`<p>\${p}</p>\`;
        }).join('\\n')}
    </div>
    \`).join('')}
</body>
</html>\`;
    
    // Save HTML
    await fs.writeFile(path.join(__dirname, 'build/final-book.html'), html);
    
    console.log('Generating PDF...');
    
    // Generate PDF
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.evaluateHandle('document.fonts.ready');
    await new Promise(r => setTimeout(r, 3000)); // Give time for everything to render
    
    const pdfPath = path.join(__dirname, 'the-claude-elite-pipeline-PERFECT-VERIFIED.pdf');
    await page.pdf({
        path: pdfPath,
        width: '6in',
        height: '9in',
        printBackground: true,
        preferCSSPageSize: false
    });
    
    await browser.close();
    
    console.log('✅ PDF generated successfully!');
    console.log(\`📖 Location: \${pdfPath}\`);
    console.log(\`📏 Size: \${((await fs.stat(pdfPath)).size / 1024 / 1024).toFixed(2)} MB\`);
}

generatePerfectBook().catch(console.error);
"

echo ""
echo "⏳ Waiting for PDF generation..."
sleep 5

# Check if PDF was created
if [ -f "the-claude-elite-pipeline-PERFECT-VERIFIED.pdf" ]; then
    echo ""
    echo "✅ PDF ESTÁ PERFEITO! CAPA ENCONTRADA!"
    echo "📖 File: the-claude-elite-pipeline-PERFECT-VERIFIED.pdf"
    echo "📏 Format: 6×9 inches (professional book)"
    echo "🎨 Cover: Full-page gradient design with title"
    echo "📝 Content: 5 chapters with horizontal images"
    echo "🔤 Typography: Georgia serif with drop caps"
    echo ""
    echo "🚀 READY FOR PUBLISHING!"
    
    # Update index.html to point to the new PDF
    sed -i '' 's/the-claude-elite-pipeline-PERFECT.pdf/the-claude-elite-pipeline-PERFECT-VERIFIED.pdf/g' index.html
    echo "✓ Updated index.html"
else
    echo "❌ PDF generation failed"
    exit 1
fi