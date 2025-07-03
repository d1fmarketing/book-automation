#!/usr/bin/env node

/**
 * Extract PDF pages using Puppeteer
 * Takes screenshots of EVERY page
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function extractPages(pdfPath) {
    console.log('🔍 Extracting PDF pages with Puppeteer...\n');
    
    const outputDir = path.join('build/qa/pdf-pages');
    await fs.ensureDir(outputDir);
    await fs.emptyDir(outputDir);
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set viewport to match PDF page size
        await page.setViewport({
            width: 600,
            height: 900,
            deviceScaleFactor: 2 // Higher quality
        });
        
        // Generate HTML that displays the PDF
        const html = `<!DOCTYPE html>
<html>
<head>
    <style>
        body { margin: 0; padding: 0; }
        #pdf-container { width: 100%; }
        .pdf-page {
            width: 600px;
            height: 900px;
            margin: 0 auto 20px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            background: white;
            page-break-after: always;
        }
        embed {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <embed src="${pdfPath}" type="application/pdf" width="100%" height="100%" />
</body>
</html>`;
        
        // Load the PDF
        await page.goto(`file://${path.resolve(pdfPath)}`, {
            waitUntil: 'networkidle0'
        });
        
        // Wait for PDF to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get total height to estimate pages
        const totalHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = 900;
        const estimatedPages = Math.ceil(totalHeight / viewportHeight);
        
        console.log(`📄 Estimated pages: ${estimatedPages}\n`);
        
        // Extract each page
        for (let i = 0; i < Math.min(estimatedPages, 20); i++) {
            const pageNum = i + 1;
            console.log(`📸 Capturing page ${pageNum}...`);
            
            // Scroll to page position
            await page.evaluate((pageIndex, height) => {
                window.scrollTo(0, pageIndex * height);
            }, i, viewportHeight);
            
            // Wait for render
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Take screenshot
            const screenshotPath = path.join(outputDir, `page-${String(pageNum).padStart(3, '0')}.png`);
            await page.screenshot({
                path: screenshotPath,
                fullPage: false
            });
            
            // Special check for page 1 (cover)
            if (i === 0) {
                console.log(`   ⚠️  CHECK: Does the cover have white borders?`);
            }
            
            // Special check for page 4 (callout boxes)
            if (i === 3) {
                console.log(`   ⚠️  CHECK: Are callout boxes colored?`);
            }
        }
        
        console.log(`\n✅ Extracted ${Math.min(estimatedPages, 20)} pages`);
        console.log(`📁 Images saved to: ${path.resolve(outputDir)}\n`);
        
        // Create HTML report
        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <title>PDF Page Extraction Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        .page { margin: 20px 0; border: 1px solid #ddd; padding: 10px; }
        .page img { max-width: 100%; height: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .page-title { font-weight: bold; margin-bottom: 10px; }
        .warning { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>PDF Visual Inspection Report</h1>
    <p>PDF: ${pdfPath}</p>
    <p>Total pages extracted: ${Math.min(estimatedPages, 20)}</p>
    
    <div class="page">
        <div class="page-title">Page 1 - Cover</div>
        <p class="warning">CHECK: Are there white borders around the cover?</p>
        <img src="page-001.png" />
    </div>
    
    <div class="page">
        <div class="page-title">Page 4 - Callout Boxes</div>
        <p class="warning">CHECK: Are the callout boxes colored with gradients?</p>
        <img src="page-004.png" />
    </div>
    
    <div class="page">
        <div class="page-title">Page 5 - Code</div>
        <p class="warning">CHECK: Is the code syntax highlighted?</p>
        <img src="page-005.png" />
    </div>
</body>
</html>`;
        
        const reportPath = path.join(outputDir, 'inspection-report.html');
        await fs.writeFile(reportPath, reportHtml);
        
        // Open the report
        console.log('📋 Opening inspection report...');
        const { exec } = require('child_process');
        exec(`open "${reportPath}"`);
        
    } finally {
        await browser.close();
    }
}

// Run
const pdfPath = process.argv[2] || 'build/dist/premium-mcp-ebook.pdf';
extractPages(pdfPath).catch(console.error);