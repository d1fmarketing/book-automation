#!/usr/bin/env node

/**
 * Visual PDF Quality Assurance
 * Takes screenshots of every page to analyze layout issues
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

class VisualPDFQA {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.outputDir = path.join(path.dirname(pdfPath), 'qa-screenshots');
        this.issues = [];
    }

    async analyzePDF() {
        console.log('🔍 Visual PDF Quality Analysis Starting...\n');
        
        // Ensure output directory
        await fs.ensureDir(this.outputDir);
        
        // Get PDF page count
        const pdfBytes = await fs.readFile(this.pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pageCount = pdfDoc.getPageCount();
        console.log(`📄 PDF has ${pageCount} pages\n`);
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set viewport to match 6x9 inch at 96 DPI
            await page.setViewport({
                width: 576,  // 6 inches * 96 DPI
                height: 864  // 9 inches * 96 DPI
            });
            
            // Load PDF
            const pdfUrl = `file://${path.resolve(this.pdfPath)}`;
            await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
            
            // Wait for PDF.js to load
            await page.waitForFunction(() => window.PDFViewerApplication, { timeout: 5000 });
            
            // Analyze each page
            for (let i = 1; i <= Math.min(pageCount, 10); i++) {
                console.log(`📸 Analyzing page ${i}/${pageCount}...`);
                
                // Navigate to specific page
                await page.evaluate((pageNum) => {
                    if (window.PDFViewerApplication) {
                        window.PDFViewerApplication.page = pageNum;
                    }
                }, i);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Take screenshot
                const screenshotPath = path.join(this.outputDir, `page-${String(i).padStart(3, '0')}.png`);
                await page.screenshot({ 
                    path: screenshotPath,
                    fullPage: false
                });
                
                // Analyze the page visually
                const analysis = await page.evaluate(() => {
                    const viewer = document.querySelector('#viewer');
                    const pageContainer = document.querySelector('.page');
                    
                    if (!pageContainer) return null;
                    
                    const rect = pageContainer.getBoundingClientRect();
                    const computedStyle = window.getComputedStyle(pageContainer);
                    
                    // Try to count text lines
                    const textLayers = pageContainer.querySelectorAll('.textLayer span');
                    let totalWords = 0;
                    textLayers.forEach(span => {
                        totalWords += span.textContent.trim().split(/\s+/).length;
                    });
                    
                    return {
                        width: rect.width,
                        height: rect.height,
                        padding: computedStyle.padding,
                        margin: computedStyle.margin,
                        wordsOnPage: totalWords,
                        hasContent: textLayers.length > 0
                    };
                });
                
                if (analysis) {
                    console.log(`  - Page dimensions: ${Math.round(analysis.width)}x${Math.round(analysis.height)}px`);
                    console.log(`  - Words on page: ~${analysis.wordsOnPage}`);
                    
                    // Check for issues
                    if (analysis.wordsOnPage < 100 && analysis.hasContent) {
                        this.issues.push({
                            page: i,
                            issue: 'Very low word count',
                            details: `Only ${analysis.wordsOnPage} words on page`
                        });
                    }
                }
            }
            
            // Generate report
            await this.generateReport();
            
        } finally {
            await browser.close();
        }
    }
    
    async generateReport() {
        console.log('\n📊 Analysis Complete!\n');
        console.log('Issues Found:');
        console.log('=============');
        
        if (this.issues.length === 0) {
            console.log('✅ No major issues detected');
        } else {
            this.issues.forEach(issue => {
                console.log(`❌ Page ${issue.page}: ${issue.issue}`);
                console.log(`   ${issue.details}`);
            });
        }
        
        console.log(`\n📸 Screenshots saved to: ${this.outputDir}`);
        console.log('\nTo view the screenshots and analyze margins:');
        console.log(`open ${this.outputDir}`);
        
        // Save report
        const reportPath = path.join(this.outputDir, 'visual-qa-report.json');
        await fs.writeJson(reportPath, {
            timestamp: new Date().toISOString(),
            pdfPath: this.pdfPath,
            issues: this.issues,
            screenshotDir: this.outputDir
        }, { spaces: 2 });
        
        console.log(`\n📄 Report saved to: ${reportPath}`);
    }
}

// Direct PDF margin analyzer using pdf-lib
async function analyzePDFMargins(pdfPath) {
    console.log('\n📏 Analyzing PDF Page Dimensions and Margins...\n');
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    console.log(`Total pages: ${pages.length}\n`);
    
    // Analyze first few pages
    for (let i = 0; i < Math.min(5, pages.length); i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        
        console.log(`Page ${i + 1}:`);
        console.log(`  Dimensions: ${width} x ${height} points`);
        console.log(`  In inches: ${(width/72).toFixed(2)}" x ${(height/72).toFixed(2)}"`);
        
        // Try to detect content bounds (this is approximate)
        const content = page.getContentStream();
        
        console.log('');
    }
}

// Alternative: Use Puppeteer to render and measure
async function measureActualContent(pdfPath) {
    console.log('\n📐 Measuring Actual Content Area...\n');
    
    const debugHtmlPath = path.join(path.dirname(pdfPath), '..', 'premium-debug.html');
    
    if (!await fs.pathExists(debugHtmlPath)) {
        console.log('Debug HTML not found, skipping content measurement');
        return;
    }
    
    const browser = await puppeteer.launch({ headless: true });
    
    try {
        const page = await browser.newPage();
        
        // Load the debug HTML
        const html = await fs.readFile(debugHtmlPath, 'utf8');
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Set viewport to 6x9 inches
        await page.setViewport({
            width: 576,  // 6 * 96
            height: 864  // 9 * 96
        });
        
        // Measure actual content
        const measurements = await page.evaluate(() => {
            const firstPage = document.querySelector('.page');
            if (!firstPage) return null;
            
            const content = firstPage.querySelector('.chapter-content');
            if (!content) return null;
            
            const pageRect = firstPage.getBoundingClientRect();
            const contentRect = content.getBoundingClientRect();
            
            // Count words in first paragraph
            const firstPara = content.querySelector('p');
            const wordsInFirstPara = firstPara ? firstPara.textContent.trim().split(/\s+/).length : 0;
            
            // Measure line height
            const computedStyle = window.getComputedStyle(firstPara || content);
            
            return {
                page: {
                    width: pageRect.width,
                    height: pageRect.height
                },
                content: {
                    width: contentRect.width,
                    height: contentRect.height,
                    left: contentRect.left - pageRect.left,
                    top: contentRect.top - pageRect.top
                },
                typography: {
                    fontSize: computedStyle.fontSize,
                    lineHeight: computedStyle.lineHeight,
                    fontFamily: computedStyle.fontFamily
                },
                wordsInFirstParagraph: wordsInFirstPara,
                margins: {
                    top: contentRect.top - pageRect.top,
                    right: pageRect.right - contentRect.right,
                    bottom: pageRect.bottom - contentRect.bottom,
                    left: contentRect.left - pageRect.left
                }
            };
        });
        
        if (measurements) {
            console.log('Content Area Analysis:');
            console.log('====================');
            console.log(`Page size: ${measurements.page.width}x${measurements.page.height}px`);
            console.log(`Content area: ${measurements.content.width}x${measurements.content.height}px`);
            console.log(`\nEffective margins:`);
            console.log(`  Top: ${Math.round(measurements.margins.top)}px (${(measurements.margins.top/96).toFixed(2)}in)`);
            console.log(`  Right: ${Math.round(measurements.margins.right)}px (${(measurements.margins.right/96).toFixed(2)}in)`);
            console.log(`  Bottom: ${Math.round(measurements.margins.bottom)}px (${(measurements.margins.bottom/96).toFixed(2)}in)`);
            console.log(`  Left: ${Math.round(measurements.margins.left)}px (${(measurements.margins.left/96).toFixed(2)}in)`);
            console.log(`\nTypography:`);
            console.log(`  Font: ${measurements.typography.fontFamily}`);
            console.log(`  Size: ${measurements.typography.fontSize}`);
            console.log(`  Line height: ${measurements.typography.lineHeight}`);
            console.log(`  Words in first paragraph: ${measurements.wordsInFirstParagraph}`);
            
            // Calculate issues
            const contentWidthInches = measurements.content.width / 96;
            const marginTotalInches = (measurements.margins.left + measurements.margins.right) / 96;
            
            console.log(`\n⚠️  Issues Detected:`);
            if (marginTotalInches > 2) {
                console.log(`  - Margins too large: ${marginTotalInches.toFixed(2)}" total (should be ~1.5")`);
            }
            if (contentWidthInches < 3.5) {
                console.log(`  - Content area too narrow: ${contentWidthInches.toFixed(2)}" (should be ~4.5")`);
            }
            
            // Take a screenshot showing the issue
            const screenshotPath = path.join(path.dirname(pdfPath), 'margin-issue-visualization.png');
            
            // Add visual guides
            await page.evaluate(() => {
                const firstPage = document.querySelector('.page');
                const content = firstPage.querySelector('.chapter-content');
                
                // Add border to show page bounds
                firstPage.style.border = '2px solid red';
                firstPage.style.boxSizing = 'border-box';
                
                // Add border to show content bounds
                content.style.border = '2px solid blue';
                content.style.boxSizing = 'border-box';
                
                // Add margin indicators
                const marginDiv = document.createElement('div');
                marginDiv.style.position = 'absolute';
                marginDiv.style.top = '0';
                marginDiv.style.left = '0';
                marginDiv.style.right = '0';
                marginDiv.style.bottom = '0';
                marginDiv.style.border = '2px dashed orange';
                marginDiv.style.pointerEvents = 'none';
                marginDiv.style.margin = '72px 54px'; // Current margins in pixels
                firstPage.style.position = 'relative';
                firstPage.appendChild(marginDiv);
            });
            
            await page.screenshot({ path: screenshotPath });
            console.log(`\n📸 Margin visualization saved to: ${screenshotPath}`);
        }
        
    } finally {
        await browser.close();
    }
}

// Run analysis
async function main() {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook.pdf');
    
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    try {
        // First, analyze PDF structure
        await analyzePDFMargins(pdfPath);
        
        // Then measure actual content
        await measureActualContent(pdfPath);
        
        // Finally, take screenshots
        const qa = new VisualPDFQA(pdfPath);
        await qa.analyzePDF();
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { VisualPDFQA, analyzePDFMargins, measureActualContent };