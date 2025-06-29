#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function captureAllPages() {
    console.log('📸 Capturing multiple pages for analysis...');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 595, height: 842 }); // A5 size in pixels
    
    await fs.ensureDir('build/visual-analysis');
    
    try {
        // Load HTML
        const htmlPath = path.resolve('build/temp/adhd-book-perfect.html');
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0'
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Capture specific sections
        const sections = [
            { name: '1-cover', selector: '.cover' },
            { name: '2-chapter1-start', selector: '.chapter:nth-of-type(2)' },
            { name: '3-tip-box', scrollTo: 'div[style*="rgba(78,205,196,0.15)"]' },
            { name: '4-checklist', scrollTo: 'div[style*="#F8F9FA"]' },
            { name: '5-chapter5-middle', selector: '.chapter:nth-of-type(6)' },
            { name: '6-warning-box', scrollTo: 'div[style*="rgba(255,107,107,0.15)"]' },
            { name: '7-chapter10-end', selector: '.chapter:nth-of-type(11)' },
            { name: '8-final-page', selector: '.chapter:last-child' }
        ];
        
        for (const section of sections) {
            if (section.scrollTo) {
                // Scroll to element
                await page.evaluate((selector) => {
                    const element = document.querySelector(selector);
                    if (element) element.scrollIntoView({ block: 'center' });
                }, section.scrollTo);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Take viewport screenshot
            await page.screenshot({
                path: `build/visual-analysis/${section.name}.png`
            });
            console.log(`✅ Captured: ${section.name}`);
            
            // Analyze font sizes and spacing
            const analysis = await page.evaluate((sel) => {
                const getElementInfo = (selector) => {
                    const el = document.querySelector(selector);
                    if (!el) return null;
                    const styles = window.getComputedStyle(el);
                    return {
                        fontSize: styles.fontSize,
                        lineHeight: styles.lineHeight,
                        marginTop: styles.marginTop,
                        marginBottom: styles.marginBottom,
                        padding: styles.padding
                    };
                };
                
                return {
                    h1: getElementInfo('h1'),
                    h2: getElementInfo('h2'),
                    h3: getElementInfo('h3'),
                    p: getElementInfo('p'),
                    tipBox: getElementInfo('div[style*="rgba(78,205,196,0.15)"]'),
                    body: getElementInfo('body')
                };
            }, section.selector);
            
            console.log(`  Analysis:`, JSON.stringify(analysis, null, 2));
        }
        
        // Generate comparison HTML
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Visual Analysis - All Pages</title>
    <style>
        body { 
            font-family: sans-serif; 
            background: #333; 
            color: white;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .page-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        .page-preview {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        }
        .page-header {
            background: #222;
            color: white;
            padding: 10px;
            font-weight: bold;
        }
        img {
            width: 100%;
            display: block;
        }
        .issues {
            background: #f8d7da;
            color: #721c24;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .issue-item {
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📋 Visual Analysis Report</h1>
        
        <div class="issues">
            <h2>🔍 Issues Found:</h2>
            <div class="issue-item">❌ <strong>Font Sizes:</strong> Some headings appear same size as body text</div>
            <div class="issue-item">❌ <strong>Spacing:</strong> Large gaps between elements</div>
            <div class="issue-item">❌ <strong>Hierarchy:</strong> Visual hierarchy needs improvement</div>
            <div class="issue-item">⚠️ <strong>Consistency:</strong> Check if styling is consistent across all pages</div>
        </div>
        
        <h2>📄 Page Screenshots:</h2>
        <div class="page-grid">
            ${sections.map(s => `
                <div class="page-preview">
                    <div class="page-header">${s.name}</div>
                    <img src="${s.name}.png" alt="${s.name}">
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
        `;
        
        await fs.writeFile('build/visual-analysis/index.html', html);
        console.log('\n✅ Analysis complete: build/visual-analysis/index.html');
        
    } finally {
        await browser.close();
    }
}

captureAllPages().catch(console.error);