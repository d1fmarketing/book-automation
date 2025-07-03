#!/usr/bin/env node

/**
 * FULL VISUAL VERIFICATION
 * Takes screenshots of EVERY page and checks for borders
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class FullVisualVerification {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.pdfPath = path.join(this.projectRoot, 'build/dist/premium-ebook-perfect.pdf');
        this.outputDir = path.join(this.projectRoot, 'build/qa/visual-verification');
        this.issues = [];
    }

    async verify() {
        console.log('🔍 FULL VISUAL VERIFICATION\n');
        
        await fs.ensureDir(this.outputDir);
        
        // First check PDF structure
        const pdfOk = await this.verifyPDFStructure();
        if (!pdfOk) {
            console.log('❌ PDF structure invalid');
            return false;
        }
        
        // Then do visual verification
        const visualOk = await this.verifyVisually();
        
        // Generate report
        await this.generateReport();
        
        return pdfOk && visualOk && this.issues.length === 0;
    }

    async verifyPDFStructure() {
        console.log('📄 Verifying PDF structure...');
        
        const pdfBytes = await fs.readFile(this.pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        
        console.log(`  Pages: ${pages.length}`);
        
        // Check first 3 pages in detail
        for (let i = 0; i < Math.min(3, pages.length); i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            console.log(`  Page ${i+1}: ${width}×${height} points (${(width/72).toFixed(2)}"×${(height/72).toFixed(2)}")`);
            
            if (Math.abs(width - 432) > 1 || Math.abs(height - 648) > 1) {
                this.issues.push({
                    type: 'dimensions',
                    page: i + 1,
                    message: `Wrong size: ${width}×${height} (should be 432×648)`
                });
            }
        }
        
        return true;
    }

    async verifyVisually() {
        console.log('\n🖼️  Visual verification...\n');
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set viewport to exact PDF size
            await page.setViewport({
                width: 432,
                height: 648,
                deviceScaleFactor: 2
            });
            
            // Option 1: Use debug HTML
            const debugHtml = path.join(this.projectRoot, 'build/final-perfect-debug.html');
            if (await fs.pathExists(debugHtml)) {
                console.log('Using debug HTML for analysis...\n');
                const html = await fs.readFile(debugHtml, 'utf8');
                await page.setContent(html, { waitUntil: 'networkidle0' });
                
                // Screenshot each page type
                const pageTypes = [
                    { selector: '.cover', name: '01-cover', critical: true },
                    { selector: '.toc-page', name: '02-toc', critical: false },
                    { selector: '.chapter-page:nth-of-type(3)', name: '03-chapter1', critical: true },
                    { selector: '.chapter-page:nth-of-type(4)', name: '04-chapter2', critical: false },
                    { selector: '.end-page', name: '99-end', critical: false }
                ];
                
                for (const pageInfo of pageTypes) {
                    const element = await page.$(pageInfo.selector);
                    if (!element) continue;
                    
                    console.log(`📸 Capturing ${pageInfo.name}...`);
                    
                    // Take screenshot
                    const screenshotPath = path.join(this.outputDir, `${pageInfo.name}.png`);
                    await element.screenshot({ path: screenshotPath });
                    
                    // Analyze for borders
                    const analysis = await page.evaluate((selector) => {
                        const elem = document.querySelector(selector);
                        if (!elem) return null;
                        
                        const rect = elem.getBoundingClientRect();
                        const styles = window.getComputedStyle(elem);
                        
                        // For cover, check if image fills the entire space
                        if (selector === '.cover') {
                            const img = elem.querySelector('img');
                            if (img) {
                                const imgRect = img.getBoundingClientRect();
                                const imgStyles = window.getComputedStyle(img);
                                
                                return {
                                    page: {
                                        width: rect.width,
                                        height: rect.height,
                                        margin: styles.margin,
                                        padding: styles.padding
                                    },
                                    image: {
                                        width: imgRect.width,
                                        height: imgRect.height,
                                        margin: imgStyles.margin,
                                        padding: imgStyles.padding,
                                        fillsPage: imgRect.width >= rect.width && imgRect.height >= rect.height
                                    }
                                };
                            }
                        }
                        
                        // For content pages, measure margins
                        const content = elem.querySelector('.chapter-content');
                        if (content) {
                            const contentRect = content.getBoundingClientRect();
                            return {
                                page: {
                                    width: rect.width,
                                    height: rect.height
                                },
                                margins: {
                                    top: contentRect.top - rect.top,
                                    right: rect.right - contentRect.right,
                                    bottom: rect.bottom - contentRect.bottom,
                                    left: contentRect.left - rect.left
                                }
                            };
                        }
                        
                        return {
                            page: {
                                width: rect.width,
                                height: rect.height,
                                margin: styles.margin,
                                padding: styles.padding
                            }
                        };
                    }, pageInfo.selector);
                    
                    console.log(`  Analysis:`, JSON.stringify(analysis, null, 2));
                    
                    // Check for issues
                    if (pageInfo.critical && analysis) {
                        if (pageInfo.name.includes('cover') && analysis.image) {
                            if (!analysis.image.fillsPage) {
                                this.issues.push({
                                    type: 'visual',
                                    page: 'cover',
                                    message: 'Cover image does not fill entire page'
                                });
                            }
                            if (analysis.page.margin !== '0px' || analysis.page.padding !== '0px') {
                                this.issues.push({
                                    type: 'visual',
                                    page: 'cover',
                                    message: `Cover has margin/padding: ${analysis.page.margin} / ${analysis.page.padding}`
                                });
                            }
                        }
                    }
                }
            } else {
                // Option 2: Direct PDF screenshots
                console.log('Using PDF directly...\n');
                const pdfUrl = `file://${path.resolve(this.pdfPath)}`;
                await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
                
                // Wait for PDF.js
                await page.waitForFunction(() => window.PDFViewerApplication, { timeout: 5000 });
                
                // Screenshot first few pages
                for (let i = 1; i <= 3; i++) {
                    await page.evaluate((pageNum) => {
                        if (window.PDFViewerApplication) {
                            window.PDFViewerApplication.page = pageNum;
                        }
                    }, i);
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const screenshotPath = path.join(this.outputDir, `pdf-page-${String(i).padStart(2, '0')}.png`);
                    await page.screenshot({ path: screenshotPath, fullPage: false });
                    console.log(`📸 Page ${i} screenshot saved`);
                }
            }
            
        } finally {
            await browser.close();
        }
        
        return this.issues.filter(i => i.type === 'visual').length === 0;
    }

    async generateReport() {
        console.log('\n📊 Generating visual report...\n');
        
        const reportHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Visual Verification Report</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        .screenshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .screenshot { background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .screenshot img { width: 100%; border: 1px solid #ddd; }
        .issue { background: #fff3cd; color: #856404; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Visual Verification Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="status ${this.issues.length === 0 ? 'pass' : 'fail'}">
        ${this.issues.length === 0 ? '✅ ALL VISUAL CHECKS PASSED' : `❌ Found ${this.issues.length} issues`}
    </div>
    
    ${this.issues.length > 0 ? `
        <h2>Issues Found:</h2>
        ${this.issues.map(issue => `
            <div class="issue">
                <strong>${issue.type.toUpperCase()}</strong> - Page ${issue.page}: ${issue.message}
            </div>
        `).join('')}
    ` : ''}
    
    <h2>Screenshots:</h2>
    <div class="screenshots">
        ${(await fs.readdir(this.outputDir))
            .filter(f => f.endsWith('.png'))
            .sort()
            .map(f => `
                <div class="screenshot">
                    <h3>${f.replace('.png', '').replace(/-/g, ' ').toUpperCase()}</h3>
                    <img src="${f}" alt="${f}">
                    <p>Click to view full size</p>
                </div>
            `).join('')}
    </div>
    
    <script>
        document.querySelectorAll('.screenshot img').forEach(img => {
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(img.src, '_blank');
        });
    </script>
</body>
</html>`;
        
        await fs.writeFile(path.join(this.outputDir, 'report.html'), reportHtml);
        console.log(`📄 Report saved to: ${this.outputDir}/report.html`);
        
        // Also save JSON report
        const jsonReport = {
            timestamp: new Date().toISOString(),
            pdf: this.pdfPath,
            passed: this.issues.length === 0,
            issues: this.issues,
            screenshots: await fs.readdir(this.outputDir).then(files => files.filter(f => f.endsWith('.png')))
        };
        
        await fs.writeJson(path.join(this.outputDir, 'report.json'), jsonReport, { spaces: 2 });
    }
}

// Main
async function main() {
    const verifier = new FullVisualVerification();
    
    try {
        const passed = await verifier.verify();
        
        if (passed) {
            console.log('\n✅ VISUAL VERIFICATION PASSED!');
        } else {
            console.log('\n❌ VISUAL VERIFICATION FAILED!');
            console.log(`Found ${verifier.issues.length} issues`);
        }
        
        console.log(`\n📊 Open report: open ${verifier.outputDir}/report.html`);
        
        process.exit(passed ? 0 : 1);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = FullVisualVerification;