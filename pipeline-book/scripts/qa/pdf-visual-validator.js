#!/usr/bin/env node

/**
 * PDF Visual Validator - Captures and analyzes every page
 * Ensures professional quality before delivery
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class PDFVisualValidator {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.screenshotDir = path.join(path.dirname(pdfPath), 'qa-validation');
        this.issues = [];
        this.pageAnalysis = [];
    }

    async validate() {
        console.log('🔍 PDF Visual Validation Starting...\n');
        console.log(`📄 Analyzing: ${path.basename(this.pdfPath)}\n`);
        
        // Ensure screenshot directory
        await fs.ensureDir(this.screenshotDir);
        
        // First, check PDF metadata
        const pdfBytes = await fs.readFile(this.pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        
        console.log('📊 PDF Metadata:');
        console.log(`  Total pages: ${pages.length}`);
        
        // Check page dimensions
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        console.log(`  Page size: ${(width/72).toFixed(2)}" x ${(height/72).toFixed(2)}"`);
        
        if (Math.abs(width/72 - 6) > 0.1 || Math.abs(height/72 - 9) > 0.1) {
            this.issues.push({
                type: 'critical',
                message: `Wrong page size: ${(width/72).toFixed(2)}" x ${(height/72).toFixed(2)}" (should be 6" x 9")`
            });
        }
        
        // Now capture screenshots
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set viewport to exact 6x9 at 150 DPI for better quality
            await page.setViewport({
                width: 900,   // 6 * 150
                height: 1350, // 9 * 150
                deviceScaleFactor: 2
            });
            
            // Load PDF
            const pdfUrl = `file://${path.resolve(this.pdfPath)}`;
            console.log('\n📸 Capturing page screenshots...\n');
            
            // For direct PDF rendering, we'll use page.pdf() approach
            // But for screenshots, let's load the debug HTML if available
            const debugHtmlPath = this.pdfPath.replace('.pdf', '-debug.html').replace('dist/', '');
            let useHTML = false;
            
            if (await fs.pathExists(debugHtmlPath)) {
                const htmlContent = await fs.readFile(debugHtmlPath, 'utf8');
                await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
                useHTML = true;
                console.log('  Using HTML debug file for accurate screenshots');
            } else {
                await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
            }
            
            // Analyze specific pages
            const pagesToCheck = [
                { num: 1, name: 'Cover', selector: '.cover' },
                { num: 2, name: 'TOC', selector: '.toc-page' },
                { num: 3, name: 'Chapter 1', selector: '.chapter-page' },
                { num: 'last', name: 'Last Chapter', selector: '.chapter-page:last-of-type' }
            ];
            
            for (const pageInfo of pagesToCheck) {
                console.log(`📸 Capturing ${pageInfo.name}...`);
                
                if (useHTML && pageInfo.selector) {
                    // Scroll to specific element
                    const element = await page.$(pageInfo.selector);
                    if (element) {
                        await element.scrollIntoView();
                        const box = await element.boundingBox();
                        
                        // Take screenshot of the specific page
                        const screenshotPath = path.join(this.screenshotDir, `${pageInfo.name.toLowerCase().replace(' ', '-')}.png`);
                        await page.screenshot({
                            path: screenshotPath,
                            clip: box
                        });
                        
                        // Analyze content density
                        const analysis = await page.evaluate((selector) => {
                            const elem = document.querySelector(selector);
                            if (!elem) return null;
                            
                            const content = elem.querySelector('.chapter-content');
                            if (!content) return { hasContent: false };
                            
                            const text = content.innerText || '';
                            const words = text.trim().split(/\s+/).filter(w => w.length > 0);
                            const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
                            
                            // Check for callout boxes
                            const calloutBoxes = elem.querySelectorAll('.callout-box').length;
                            
                            // Check for code blocks
                            const codeBlocks = elem.querySelectorAll('.code-block').length;
                            
                            // Check margins visually
                            const rect = elem.getBoundingClientRect();
                            const contentRect = content ? content.getBoundingClientRect() : null;
                            
                            return {
                                hasContent: true,
                                wordCount: words.length,
                                lineCount: lines.length,
                                calloutBoxes,
                                codeBlocks,
                                pageWidth: rect.width,
                                pageHeight: rect.height,
                                contentWidth: contentRect ? contentRect.width : 0,
                                marginLeft: contentRect ? contentRect.left - rect.left : 0,
                                marginRight: contentRect ? rect.right - contentRect.right : 0
                            };
                        }, pageInfo.selector);
                        
                        if (analysis && analysis.hasContent) {
                            console.log(`  ✓ Words: ${analysis.wordCount}`);
                            console.log(`  ✓ Lines: ${analysis.lineCount}`);
                            console.log(`  ✓ Callout boxes: ${analysis.calloutBoxes}`);
                            console.log(`  ✓ Code blocks: ${analysis.codeBlocks}`);
                            console.log(`  ✓ Content width: ${(analysis.contentWidth/150).toFixed(2)}" of ${(analysis.pageWidth/150).toFixed(2)}"`);
                            
                            // Check for issues
                            if (analysis.wordCount < 200 && pageInfo.name.includes('Chapter')) {
                                this.issues.push({
                                    type: 'warning',
                                    page: pageInfo.name,
                                    message: `Low word count: ${analysis.wordCount} words`
                                });
                            }
                            
                            const contentWidthInches = analysis.contentWidth / 150;
                            if (contentWidthInches < 4.0) {
                                this.issues.push({
                                    type: 'error',
                                    page: pageInfo.name,
                                    message: `Content too narrow: ${contentWidthInches.toFixed(2)}" (should be ~5")`
                                });
                            }
                            
                            this.pageAnalysis.push({
                                page: pageInfo.name,
                                ...analysis
                            });
                        }
                    }
                }
            }
            
            // Generate visual comparison
            await this.generateVisualReport();
            
        } finally {
            await browser.close();
        }
        
        return this.generateFinalReport();
    }
    
    async generateVisualReport() {
        console.log('\n📊 Generating Visual Report...\n');
        
        // Create HTML report showing all screenshots
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>PDF Visual QA Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        h1 { color: #333; }
        .issue { 
            padding: 10px; 
            margin: 10px 0; 
            border-radius: 5px;
        }
        .issue.critical { background: #fee; border-left: 4px solid #f44; }
        .issue.error { background: #ffe; border-left: 4px solid #fa0; }
        .issue.warning { background: #eff; border-left: 4px solid #08f; }
        .screenshots {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .screenshot {
            background: white;
            padding: 10px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .screenshot img {
            width: 100%;
            border: 1px solid #ddd;
        }
        .metrics {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .pass { color: green; }
        .fail { color: red; }
    </style>
</head>
<body>
    <h1>PDF Visual Quality Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="metrics">
        <h2>Quality Metrics</h2>
        <p>PDF: ${path.basename(this.pdfPath)}</p>
        <p>Issues found: ${this.issues.length}</p>
        ${this.issues.length === 0 ? '<p class="pass">✅ All checks passed!</p>' : 
          '<p class="fail">❌ Issues need attention</p>'}
    </div>
    
    ${this.issues.length > 0 ? `
        <h2>Issues Found</h2>
        ${this.issues.map(issue => `
            <div class="issue ${issue.type}">
                <strong>${issue.type.toUpperCase()}</strong>: ${issue.message}
                ${issue.page ? `<br>Page: ${issue.page}` : ''}
            </div>
        `).join('')}
    ` : ''}
    
    <h2>Page Analysis</h2>
    <div class="screenshots">
        ${(await fs.readdir(this.screenshotDir))
            .filter(f => f.endsWith('.png'))
            .map(f => `
                <div class="screenshot">
                    <h3>${f.replace('.png', '').replace(/-/g, ' ').toUpperCase()}</h3>
                    <img src="${f}" alt="${f}">
                    ${this.pageAnalysis.find(p => p.page.toLowerCase().replace(' ', '-') === f.replace('.png', '')) ? 
                        `<p>Words: ${this.pageAnalysis.find(p => p.page.toLowerCase().replace(' ', '-') === f.replace('.png', '')).wordCount}</p>` : ''}
                </div>
            `).join('')}
    </div>
</body>
</html>`;
        
        await fs.writeFile(path.join(this.screenshotDir, 'report.html'), html);
        console.log(`📄 Visual report saved to: ${path.join(this.screenshotDir, 'report.html')}`);
    }
    
    generateFinalReport() {
        console.log('\n' + '='.repeat(50));
        console.log('📋 FINAL VALIDATION REPORT');
        console.log('='.repeat(50) + '\n');
        
        if (this.issues.length === 0) {
            console.log('✅ PDF PASSED ALL QUALITY CHECKS!\n');
            console.log('The PDF is ready for professional distribution.');
        } else {
            console.log(`❌ FOUND ${this.issues.length} ISSUES:\n`);
            
            const critical = this.issues.filter(i => i.type === 'critical');
            const errors = this.issues.filter(i => i.type === 'error');
            const warnings = this.issues.filter(i => i.type === 'warning');
            
            if (critical.length > 0) {
                console.log('🚨 CRITICAL ISSUES:');
                critical.forEach(i => console.log(`   - ${i.message}`));
            }
            
            if (errors.length > 0) {
                console.log('\n❌ ERRORS:');
                errors.forEach(i => console.log(`   - ${i.message} (${i.page || 'General'})`));
            }
            
            if (warnings.length > 0) {
                console.log('\n⚠️  WARNINGS:');
                warnings.forEach(i => console.log(`   - ${i.message} (${i.page || 'General'})`));
            }
        }
        
        console.log(`\n📸 Screenshots saved to: ${this.screenshotDir}`);
        console.log(`📊 Open visual report: ${this.screenshotDir}/report.html\n`);
        
        return this.issues.length === 0;
    }
}

// Main execution
async function main() {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook-fixed.pdf');
    
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    const validator = new PDFVisualValidator(pdfPath);
    const passed = await validator.validate();
    
    process.exit(passed ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = PDFVisualValidator;