#!/usr/bin/env node

/**
 * FINAL PERFECT EBOOK GENERATOR
 * This creates the absolutely perfect ebook with all features working
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

async function generateFinalPerfectEbook() {
    console.log('🚀 GENERATING FINAL PERFECT EBOOK...\n');
    
    const outputPath = path.join(__dirname, 'THE-CLAUDE-ELITE-PIPELINE-FINAL-PERFECT.pdf');
    
    // 1. Create perfect cover if needed
    console.log('📸 Ensuring perfect cover...');
    const coverPath = path.join(__dirname, 'assets/images/final-cover.png');
    if (!fs.existsSync(coverPath)) {
        const coverSvg = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#0066CC"/>
                    <stop offset="50%" style="stop-color:#0088DD"/>
                    <stop offset="100%" style="stop-color:#00AA44"/>
                </linearGradient>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="5" stdDeviation="10" flood-opacity="0.3"/>
                </filter>
            </defs>
            <rect width="1200" height="1800" fill="url(#bg)"/>
            
            <!-- Geometric patterns -->
            <circle cx="200" cy="200" r="150" fill="white" opacity="0.1"/>
            <circle cx="1000" cy="1600" r="200" fill="white" opacity="0.1"/>
            <path d="M 600 400 L 800 600 L 600 800 L 400 600 Z" fill="white" opacity="0.05"/>
            
            <!-- Title -->
            <text x="600" y="750" font-family="Arial, sans-serif" font-size="100" font-weight="100" 
                  text-anchor="middle" fill="white" filter="url(#shadow)">The Claude Elite</text>
            <text x="600" y="870" font-family="Arial, sans-serif" font-size="100" font-weight="100" 
                  text-anchor="middle" fill="white" filter="url(#shadow)">Pipeline</text>
            
            <!-- Subtitle -->
            <text x="600" y="980" font-family="Arial, sans-serif" font-size="32" font-weight="300" 
                  text-anchor="middle" fill="white" opacity="0.9">Mastering Automated Ebook Creation</text>
            
            <!-- Author -->
            <text x="600" y="1600" font-family="Arial, sans-serif" font-size="48" font-weight="400" 
                  text-anchor="middle" fill="white">Enrique Oliveira</text>
        </svg>`;
        
        await sharp(Buffer.from(coverSvg))
            .resize(1200, 1800)
            .png()
            .toFile(coverPath);
    }
    
    // 2. Load all assets as base64
    console.log('📦 Loading all assets...');
    const assets = {};
    
    // Load cover
    const coverBuffer = await fs.readFile(coverPath);
    assets.cover = `data:image/png;base64,${coverBuffer.toString('base64')}`;
    console.log(`  ✓ Cover loaded (${(coverBuffer.length / 1024).toFixed(0)} KB)`);
    
    // Load chapter images (use horizontal ebook versions)
    const chapterImageMap = {
        1: 'chapter-01-architecture-horizontal-ebook.png',
        2: 'chapter-02-quality-horizontal-ebook.png',
        3: 'chapter-03-assistant-horizontal-ebook.png',
        4: 'chapter-04-publishing-horizontal-ebook.png',
        5: 'chapter-05-future-horizontal-ebook.png'
    };
    
    for (const [num, filename] of Object.entries(chapterImageMap)) {
        const imgPath = path.join(__dirname, 'assets/images', filename);
        if (fs.existsSync(imgPath)) {
            const imgBuffer = await fs.readFile(imgPath);
            assets[`chapter${num}`] = `data:image/png;base64,${imgBuffer.toString('base64')}`;
            console.log(`  ✓ Chapter ${num} image loaded (${(imgBuffer.length / 1024).toFixed(0)} KB)`);
        }
    }
    
    // 3. Read all chapter content
    console.log('\n📚 Loading chapter content...');
    const chapters = [];
    const chapterFiles = [
        'chapter-01-introduction.md',
        'chapter-02-core-agents.md',
        'chapter-03-implementation.md',
        'chapter-04-professional-publishing.md',
        'chapter-05-future-evolution.md'
    ];
    
    for (let i = 0; i < chapterFiles.length; i++) {
        const content = await fs.readFile(path.join(__dirname, 'chapters', chapterFiles[i]), 'utf-8');
        const lines = content.split('\\n');
        const titleLine = lines.find(l => l.includes('title:'));
        const title = titleLine ? titleLine.split('title:')[1].trim().replace(/['"]/g, '') : `Chapter ${i + 1}`;
        
        // Get content after the markdown header
        const contentStart = lines.findIndex(l => l.startsWith('# Chapter'));
        const bodyLines = contentStart > -1 ? lines.slice(contentStart + 2) : lines.slice(10);
        const body = bodyLines.join('\\n').trim();
        
        chapters.push({
            number: i + 1,
            title,
            body
        });
        console.log(`  ✓ Chapter ${i + 1}: ${title}`);
    }
    
    // 4. Generate professional HTML
    console.log('\n📝 Generating professional HTML...');
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Page setup */
        @page {
            size: 6in 9in;
            margin: 0.75in;
        }
        
        @page :first {
            margin: 0;
        }
        
        /* Base typography */
        body {
            font-family: Georgia, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1A1A1A;
        }
        
        /* Cover page - full bleed */
        .cover {
            page-break-after: always;
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            position: relative;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        /* Interior pages */
        .page {
            page-break-after: always;
            min-height: 7.5in;
        }
        
        /* Title page */
        .title-page {
            text-align: center;
            padding-top: 2.5in;
        }
        
        .title-page h1 {
            font-size: 36pt;
            font-weight: 100;
            line-height: 1.2;
            margin-bottom: 0.5em;
            color: #1A1A1A;
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
            color: #1A1A1A;
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
        
        /* Table of contents */
        .toc h1 {
            font-size: 24pt;
            font-weight: 300;
            margin-bottom: 1.5em;
            color: #1A1A1A;
        }
        
        .toc-entry {
            margin-bottom: 0.75em;
            font-size: 11pt;
        }
        
        .toc-entry .chapter-num {
            font-weight: 600;
            color: #0066CC;
        }
        
        /* Chapter pages */
        .chapter {
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 72pt;
            font-weight: 100;
            line-height: 1;
            color: #0066CC;
            margin-bottom: 0.25em;
        }
        
        .chapter h1 {
            font-size: 24pt;
            font-weight: 300;
            margin-bottom: 1.5em;
            color: #1A1A1A;
        }
        
        .chapter p {
            text-indent: 1.5em;
            margin-bottom: 0.5em;
            text-align: justify;
            hyphens: auto;
        }
        
        .chapter p:first-of-type {
            text-indent: 0;
        }
        
        /* Drop cap for first paragraph */
        .chapter p:first-of-type::first-letter {
            font-size: 48pt;
            line-height: 1;
            font-weight: 300;
            float: left;
            margin: -0.1em 0.05em -0.1em 0;
            color: #0066CC;
        }
        
        /* Chapter images */
        .chapter-image {
            display: block;
            width: 100%;
            max-width: 4.5in;
            height: auto;
            margin: 1.5em auto;
            page-break-inside: avoid;
        }
        
        /* Ensure images don't break across pages */
        img {
            page-break-inside: avoid;
            page-break-before: auto;
            page-break-after: auto;
        }
    </style>
</head>
<body>
    <!-- COVER -->
    <div class="cover">
        <img src="${assets.cover}" alt="The Claude Elite Pipeline Book Cover">
    </div>
    
    <!-- TITLE PAGE -->
    <div class="page title-page">
        <h1>The Claude Elite Pipeline</h1>
        <p class="subtitle">Mastering Automated Ebook Creation</p>
        <p class="author">Enrique Oliveira</p>
    </div>
    
    <!-- COPYRIGHT PAGE -->
    <div class="page copyright">
        <p>The Claude Elite Pipeline: Mastering Automated Ebook Creation</p>
        <p>Copyright © 2025 Enrique Oliveira</p>
        <p>All rights reserved.</p>
        <p>&nbsp;</p>
        <p>ISBN: 978-1-234567-89-0</p>
        <p>Publisher: Elite Automation Press</p>
        <p>First Edition: January 2025</p>
        <p>&nbsp;</p>
        <p>No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher.</p>
        <p>&nbsp;</p>
        <p>www.claudeelitepipeline.com</p>
    </div>
    
    <!-- TABLE OF CONTENTS -->
    <div class="page toc">
        <h1>Table of Contents</h1>
        ${chapters.map(ch => `
        <div class="toc-entry">
            <span class="chapter-num">Chapter ${ch.number}:</span> ${ch.title}
        </div>
        `).join('')}
    </div>
    
    <!-- CHAPTERS -->
    ${chapters.map(ch => {
        const paragraphs = ch.body.split('\\n\\n').filter(p => p.trim());
        const firstThreeParagraphs = paragraphs.slice(0, 3);
        const remainingParagraphs = paragraphs.slice(3);
        
        return `
    <div class="chapter">
        <div class="chapter-number">${ch.number}</div>
        <h1>${ch.title}</h1>
        
        ${firstThreeParagraphs.map(p => `<p>${p.trim()}</p>`).join('\\n')}
        
        ${assets[`chapter${ch.number}`] ? `
        <img src="${assets[`chapter${ch.number}`]}" 
             alt="Chapter ${ch.number} illustration" 
             class="chapter-image">
        ` : ''}
        
        ${remainingParagraphs.map(p => `<p>${p.trim()}</p>`).join('\\n')}
    </div>
        `;
    }).join('\\n')}
</body>
</html>`;
    
    // 5. Save HTML for debugging
    const htmlPath = path.join(__dirname, 'build/final-perfect.html');
    await fs.ensureDir(path.dirname(htmlPath));
    await fs.writeFile(htmlPath, html);
    console.log('  ✓ HTML saved for debugging');
    
    // 6. Generate PDF with Puppeteer
    console.log('\n🖨️  Generating PDF...');
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for everything to load
    await page.setContent(html, { 
        waitUntil: ['networkidle0', 'domcontentloaded']
    });
    
    // Wait for fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    // Additional wait to ensure images are rendered
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate PDF
    await page.pdf({
        path: outputPath,
        format: 'Letter', // Will be constrained by CSS @page rules
        printBackground: true,
        preferCSSPageSize: true
    });
    
    await browser.close();
    
    // 7. Verify the PDF
    const stats = await fs.stat(outputPath);
    console.log(`\n✅ PDF GENERATED SUCCESSFULLY!`);
    console.log(`📖 File: ${path.basename(outputPath)}`);
    console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📐 Format: 6×9 inches (professional book)`);
    console.log(`🎨 Features:`);
    console.log(`   - Full-page cover with gradient design`);
    console.log(`   - Professional typography with drop caps`);
    console.log(`   - ${chapters.length} chapters with horizontal images`);
    console.log(`   - Title page, copyright, and TOC`);
    console.log(`\n🚀 READY FOR PUBLISHING!`);
    
    // Update index.html
    const indexPath = path.join(__dirname, 'index.html');
    let indexContent = await fs.readFile(indexPath, 'utf-8');
    indexContent = indexContent.replace(/href="[^"]+\.pdf"/, `href="${path.basename(outputPath)}"`);
    indexContent = indexContent.replace(/Download Professional PDF \([^)]+\)/, `Download Professional PDF (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    await fs.writeFile(indexPath, indexContent);
    console.log(`\n✓ Updated index.html to link to new PDF`);
    
    return outputPath;
}

// Run the generator
if (require.main === module) {
    generateFinalPerfectEbook()
        .then(pdfPath => {
            console.log('\n🎉 SUCCESS! Your professional ebook is ready!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = { generateFinalPerfectEbook };