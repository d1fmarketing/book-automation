#!/usr/bin/env node

/**
 * Absolute Full Bleed PDF Generator
 * Uses raw HTML with inline base64 images to ensure zero margins
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

async function generateAbsoluteFullBleed() {
    console.log('🎯 Generating ABSOLUTE full bleed PDF...\n');
    
    const projectRoot = path.join(__dirname, '../../');
    const outputPath = path.join(projectRoot, 'build/dist/absolute-fullbleed.pdf');
    
    // Load cover image
    const coverPath = path.join(projectRoot, 'assets/images/cover.png');
    const coverBuffer = await fs.readFile(coverPath);
    const coverBase64 = `data:image/png;base64,${coverBuffer.toString('base64')}`;
    
    // Create HTML with ZERO margins everywhere
    const html = `<!DOCTYPE html>
<html style="margin:0;padding:0;">
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
            size: 6in 9in;
            margin: 0;
        }
        
        @page :first {
            margin: 0;
        }
        
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
        }
        
        .cover-page {
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            page-break-after: always;
            position: relative;
            overflow: hidden;
        }
        
        .cover-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .content-page {
            width: 6in;
            height: 9in;
            padding: 1in 0.75in;
            page-break-after: always;
        }
    </style>
</head>
<body style="margin:0;padding:0;">
    <!-- COVER PAGE - ABSOLUTE FULL BLEED -->
    <div class="cover-page">
        <img src="${coverBase64}" class="cover-image" alt="Cover">
    </div>
    
    <!-- Test content page -->
    <div class="content-page">
        <h1>Test Page</h1>
        <p>This PDF has been generated with absolute full bleed cover.</p>
        <p>The cover should have NO white borders at all.</p>
    </div>
</body>
</html>`;
    
    // Save HTML for inspection
    const debugPath = path.join(projectRoot, 'build/absolute-fullbleed-debug.html');
    await fs.writeFile(debugPath, html);
    console.log(`📄 Debug HTML saved: ${debugPath}`);
    
    // Generate PDF
    console.log('🚀 Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        await page.pdf({
            path: outputPath,
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            preferCSSPageSize: false,
            omitBackground: false
        });
        
        console.log(`✅ PDF generated: ${outputPath}`);
        
        // Take screenshot of the result
        const screenshotPath = path.join(projectRoot, 'build/qa/absolute-check.png');
        await fs.ensureDir(path.dirname(screenshotPath));
        
        // Reload as PDF
        await page.goto(`file://${path.resolve(outputPath)}`, {
            waitUntil: 'networkidle0'
        });
        
        await page.setViewport({ width: 432, height: 648 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await page.screenshot({
            path: screenshotPath,
            fullPage: false
        });
        
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
        
        // Open both for inspection
        const { exec } = require('child_process');
        exec(`open "${outputPath}"`);
        exec(`open "${screenshotPath}"`);
        
    } finally {
        await browser.close();
    }
    
    console.log('\n🎯 Please check the PDF and screenshot!');
}

generateAbsoluteFullBleed().catch(console.error);