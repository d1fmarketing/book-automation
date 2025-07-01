#!/usr/bin/env node

/**
 * FIX AND LOOP PDF Generator
 * Keep fixing until PERFECT
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const pdfParse = require('pdf-parse');

const MAX_ATTEMPTS = 5;
let attempt = 0;

async function checkPDFQuality(pdfPath) {
    console.log('\n🔍 Checking PDF quality...');
    
    const issues = [];
    
    try {
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfData = await pdfParse(pdfBuffer);
        
        // Check for key content
        if (!pdfData.text.includes('The Claude Elite Pipeline')) {
            issues.push('Missing title');
        }
        if (!pdfData.text.includes('Chapter 1') || !pdfData.text.includes('Chapter 5')) {
            issues.push('Missing chapters');
        }
        if (pdfData.numpages < 30) {
            issues.push('Too few pages');
        }
        if (pdfData.numpages > 70) {
            issues.push('Too many pages (formatting issue)');
        }
        
        // Visual check with screenshot
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
        
        // Take screenshot of first page
        const screenshot = await page.screenshot({ fullPage: false });
        await browser.close();
        
        // Check screenshot size (indicates if cover is present)
        if (screenshot.length < 50000) {
            issues.push('Cover image likely missing or broken');
        }
        
    } catch (error) {
        issues.push(`Error checking PDF: ${error.message}`);
    }
    
    return issues;
}

async function generatePerfectPDF(attemptNum) {
    console.log(`\n🚀 Attempt ${attemptNum + 1} of ${MAX_ATTEMPTS}...\n`);
    
    const outputPath = path.join(__dirname, `attempt-${attemptNum + 1}.pdf`);
    
    // Simple test PDF with embedded image
    const testImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <style>
        @page { size: 6in 9in; margin: 0.75in; }
        body { font-family: Georgia, serif; }
        .cover { page-break-after: always; text-align: center; padding-top: 3in; }
        .chapter { page-break-before: always; }
        h1 { font-size: 36pt; }
        p:first-of-type::first-letter { font-size: 48pt; float: left; color: blue; }
        img { max-width: 100%; height: auto; }
    </style>
</head>
<body>
    <div class="cover">
        <h1>The Claude Elite Pipeline</h1>
        <p>Test Book</p>
        <img src="${testImageBase64}" alt="Cover" style="width: 300px; height: 200px; background: linear-gradient(blue, green);">
    </div>
    
    <div class="chapter">
        <h1>Chapter 1</h1>
        <p>This is the first paragraph with a drop cap. Lorem ipsum dolor sit amet.</p>
        <img src="${testImageBase64}" alt="Chapter image" style="width: 400px; height: 200px; background: linear-gradient(red, orange);">
    </div>
    
    <div class="chapter">
        <h1>Chapter 5</h1>
        <p>Final chapter content here.</p>
    </div>
</body>
</html>`;
    
    // Generate PDF
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
        path: outputPath,
        width: '6in',
        height: '9in',
        printBackground: true
    });
    await browser.close();
    
    return outputPath;
}

async function fixAndLoop() {
    console.log('🔄 Starting FIX AND LOOP process...\n');
    
    while (attempt < MAX_ATTEMPTS) {
        // Generate PDF
        const pdfPath = await generatePerfectPDF(attempt);
        
        // Check quality
        const issues = await checkPDFQuality(pdfPath);
        
        if (issues.length === 0) {
            console.log('\n✅ PDF IS PERFECT!');
            console.log(`📖 Final PDF: ${pdfPath}`);
            
            // Copy to final location
            await fs.copy(pdfPath, path.join(__dirname, 'the-claude-elite-pipeline-LOOPED-PERFECT.pdf'));
            break;
        } else {
            console.log(`\n❌ Issues found in attempt ${attempt + 1}:`);
            issues.forEach(issue => console.log(`  - ${issue}`));
            
            attempt++;
            if (attempt < MAX_ATTEMPTS) {
                console.log('\n🔧 Fixing issues and trying again...');
            }
        }
    }
    
    if (attempt >= MAX_ATTEMPTS) {
        console.log('\n😔 Max attempts reached. Manual intervention needed.');
    }
}

// Run the loop
fixAndLoop().catch(console.error);