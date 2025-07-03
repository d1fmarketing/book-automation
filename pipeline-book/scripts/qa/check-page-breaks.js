#!/usr/bin/env node

/**
 * Page Break Checker
 * Detects bad page breaks (images cut, paragraphs split, etc)
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class PageBreakChecker {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.outputDir = path.join(path.dirname(pdfPath), 'page-break-check');
        this.issues = [];
    }

    async check() {
        console.log('🔍 Checking for page break issues...\n');
        
        await fs.ensureDir(this.outputDir);
        
        // First check PDF structure
        const pdfBytes = await fs.readFile(this.pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        console.log(`📄 Total pages: ${pages.length}\n`);
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            await page.setViewport({
                width: 600,
                height: 900,
                deviceScaleFactor: 2
            });
            
            // Try debug HTML first
            const debugHtml = this.pdfPath.replace('.pdf', '-debug.html').replace('dist/', '');
            let useHTML = false;
            
            if (await fs.pathExists(debugHtml)) {
                console.log('Using debug HTML for analysis...\n');
                const html = await fs.readFile(debugHtml, 'utf8');
                await page.setContent(html, { waitUntil: 'networkidle0' });
                useHTML = true;
                
                // Check for problematic breaks
                const breakIssues = await page.evaluate(() => {
                    const issues = [];
                    
                    // Check images
                    const images = document.querySelectorAll('img');
                    images.forEach((img, idx) => {
                        const rect = img.getBoundingClientRect();
                        const pageHeight = 864; // 9in at 96dpi
                        const pageNum = Math.floor(rect.top / pageHeight) + 1;
                        const bottomOnPage = rect.bottom % pageHeight;
                        
                        // Image crosses page boundary
                        if (rect.height > 100 && bottomOnPage < rect.height && bottomOnPage > 0) {
                            issues.push({
                                type: 'image-split',
                                element: `Image ${idx + 1}`,
                                page: pageNum,
                                details: `Image height ${rect.height}px crosses page boundary`
                            });
                        }
                    });
                    
                    // Check callout boxes
                    const callouts = document.querySelectorAll('.callout-box');
                    callouts.forEach((box, idx) => {
                        const rect = box.getBoundingClientRect();
                        const pageHeight = 864;
                        const pageNum = Math.floor(rect.top / pageHeight) + 1;
                        const bottomOnPage = rect.bottom % pageHeight;
                        
                        if (rect.height > 50 && bottomOnPage < rect.height && bottomOnPage > 0) {
                            issues.push({
                                type: 'callout-split',
                                element: `Callout ${idx + 1}`,
                                page: pageNum,
                                details: `Callout box split across pages`
                            });
                        }
                    });
                    
                    // Check code blocks
                    const codeBlocks = document.querySelectorAll('.code-block');
                    codeBlocks.forEach((code, idx) => {
                        const rect = code.getBoundingClientRect();
                        const pageHeight = 864;
                        const pageNum = Math.floor(rect.top / pageHeight) + 1;
                        const bottomOnPage = rect.bottom % pageHeight;
                        
                        if (rect.height > 50 && bottomOnPage < rect.height && bottomOnPage > 0) {
                            issues.push({
                                type: 'code-split',
                                element: `Code block ${idx + 1}`,
                                page: pageNum,
                                details: `Code block split across pages`
                            });
                        }
                    });
                    
                    return issues;
                });
                
                this.issues = breakIssues;
                
                // Take screenshots of problematic pages
                if (breakIssues.length > 0) {
                    const problematicPages = [...new Set(breakIssues.map(i => i.page))];
                    
                    for (const pageNum of problematicPages.slice(0, 5)) {
                        console.log(`📸 Capturing page ${pageNum} with issues...`);
                        
                        // Scroll to page
                        await page.evaluate((num) => {
                            window.scrollTo(0, (num - 1) * 864);
                        }, pageNum);
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        await page.screenshot({
                            path: path.join(this.outputDir, `page-${pageNum}-issues.png`),
                            clip: {
                                x: 0,
                                y: (pageNum - 1) * 864,
                                width: 600,
                                height: 900
                            }
                        });
                    }
                }
                
            } else {
                // Direct PDF check
                const pdfUrl = `file://${path.resolve(this.pdfPath)}`;
                await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
                console.log('Checking PDF directly (limited analysis)...\n');
            }
            
        } finally {
            await browser.close();
        }
        
        // Generate report
        await this.generateReport();
        
        return this.issues.length === 0;
    }
    
    async generateReport() {
        console.log('\n📊 Page Break Analysis Complete\n');
        
        if (this.issues.length === 0) {
            console.log('✅ No page break issues found!');
        } else {
            console.log(`❌ Found ${this.issues.length} page break issues:\n`);
            
            const byType = {};
            this.issues.forEach(issue => {
                if (!byType[issue.type]) byType[issue.type] = [];
                byType[issue.type].push(issue);
            });
            
            Object.entries(byType).forEach(([type, issues]) => {
                console.log(`${type.toUpperCase()} (${issues.length}):`);
                issues.slice(0, 3).forEach(issue => {
                    console.log(`  - ${issue.element} on page ${issue.page}`);
                    console.log(`    ${issue.details}`);
                });
                if (issues.length > 3) {
                    console.log(`  ... and ${issues.length - 3} more`);
                }
                console.log('');
            });
        }
        
        // Save JSON report
        const report = {
            timestamp: new Date().toISOString(),
            pdf: this.pdfPath,
            passed: this.issues.length === 0,
            issueCount: this.issues.length,
            issues: this.issues,
            screenshots: await fs.readdir(this.outputDir).then(files => 
                files.filter(f => f.endsWith('.png'))
            )
        };
        
        await fs.writeJson(path.join(this.outputDir, 'page-break-report.json'), report, { spaces: 2 });
        
        if (this.issues.length > 0) {
            console.log(`📸 Screenshots saved to: ${this.outputDir}`);
            console.log(`📄 Full report: ${this.outputDir}/page-break-report.json`);
        }
    }
}

// Main
async function main() {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/professional-adobe-fixed.pdf');
    
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    const checker = new PageBreakChecker(pdfPath);
    const passed = await checker.check();
    
    process.exit(passed ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = PageBreakChecker;