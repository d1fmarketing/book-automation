#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function captureScreenshots() {
    console.log('📸 Quick PDF Screenshot Tool');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600 });
    
    // Ensure directories exist
    await fs.ensureDir('build/visual-report/screenshots');
    
    try {
        // Load HTML
        const htmlPath = path.resolve('build/temp/adhd-book-ultimate.html');
        console.log(`Loading: ${htmlPath}`);
        
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Capture full page
        await page.screenshot({
            path: 'build/visual-report/screenshots/full-page.png',
            fullPage: true
        });
        console.log('✅ Full page captured');
        
        // Capture specific elements
        const elements = [
            { selector: '.cover', name: 'cover-page' },
            { selector: '.tip-box', name: 'tip-box' },
            { selector: '.warning-box', name: 'warning-box' },
            { selector: '.checklist', name: 'checklist' },
            { selector: 'img', name: 'first-image' },
            { selector: '.chapter h1', name: 'chapter-heading' }
        ];
        
        for (const el of elements) {
            try {
                const element = await page.$(el.selector);
                if (element) {
                    await element.screenshot({
                        path: `build/visual-report/screenshots/${el.name}.png`
                    });
                    console.log(`✅ Captured: ${el.name}`);
                    
                    // Get computed styles
                    const styles = await page.evaluate((sel) => {
                        const elem = document.querySelector(sel);
                        if (!elem) return null;
                        const computed = window.getComputedStyle(elem);
                        return {
                            backgroundColor: computed.backgroundColor,
                            color: computed.color,
                            border: computed.border,
                            padding: computed.padding,
                            fontSize: computed.fontSize
                        };
                    }, el.selector);
                    
                    console.log(`   Styles:`, styles);
                } else {
                    console.log(`❌ Not found: ${el.selector}`);
                }
            } catch (err) {
                console.log(`⚠️ Error capturing ${el.name}: ${err.message}`);
            }
        }
        
        // Generate simple report
        const report = `
<!DOCTYPE html>
<html>
<head>
    <title>Quick Visual Report</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .screenshot { max-width: 600px; margin: 20px 0; border: 1px solid #ddd; }
        img { width: 100%; }
    </style>
</head>
<body>
    <h1>PDF Visual Report</h1>
    <h2>Screenshots:</h2>
    ${fs.readdirSync('build/visual-report/screenshots').map(f => `
        <div class="screenshot">
            <h3>${f}</h3>
            <img src="screenshots/${f}" />
        </div>
    `).join('')}
</body>
</html>
        `;
        
        await fs.writeFile('build/visual-report/index.html', report);
        console.log('✅ Report generated: build/visual-report/index.html');
        
    } finally {
        await browser.close();
    }
}

captureScreenshots().catch(console.error);