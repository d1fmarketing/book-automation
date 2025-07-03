#!/usr/bin/env node

/**
 * Visual Border Detector - Detects white borders in PDF pages
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');

class VisualBorderDetector {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.outputDir = path.join(path.dirname(pdfPath), 'border-analysis');
    }

    async detectBorders() {
        console.log('🔍 Visual Border Detection\n');
        
        await fs.ensureDir(this.outputDir);
        
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            
            // Set exact 6x9 viewport
            await page.setViewport({
                width: 432,
                height: 648,
                deviceScaleFactor: 2
            });
            
            // Try debug HTML first for accurate rendering
            const debugHtml = this.pdfPath.replace('.pdf', '-debug.html').replace('dist/', '');
            let useHTML = false;
            
            if (await fs.pathExists(debugHtml)) {
                console.log('Using debug HTML for analysis...\n');
                const html = await fs.readFile(debugHtml, 'utf8');
                await page.setContent(html, { waitUntil: 'networkidle0' });
                useHTML = true;
            } else {
                // Fall back to PDF
                const pdfUrl = `file://${path.resolve(this.pdfPath)}`;
                await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
            }
            
            // Analyze first page (cover)
            console.log('Analyzing cover page...');
            
            const coverSelector = useHTML ? '.cover' : '#pageContainer1';
            
            if (useHTML) {
                const coverElement = await page.$('.cover');
                if (coverElement) {
                    const coverBox = await coverElement.boundingBox();
                    
                    // Take screenshot
                    const screenshotPath = path.join(this.outputDir, 'cover-analysis.png');
                    await coverElement.screenshot({ 
                        path: screenshotPath,
                        type: 'png'
                    });
                    
                    // Analyze borders using pixel data
                    const analysis = await page.evaluate(() => {
                        const cover = document.querySelector('.cover');
                        if (!cover) return null;
                        
                        const rect = cover.getBoundingClientRect();
                        const styles = window.getComputedStyle(cover);
                        
                        // Check for margins/padding
                        return {
                            width: rect.width,
                            height: rect.height,
                            margin: styles.margin,
                            padding: styles.padding,
                            backgroundColor: styles.backgroundColor,
                            overflow: styles.overflow
                        };
                    });
                    
                    console.log('\nCover Analysis:');
                    console.log(`  Dimensions: ${analysis.width} × ${analysis.height}px`);
                    console.log(`  Margin: ${analysis.margin}`);
                    console.log(`  Padding: ${analysis.padding}`);
                    
                    // Analyze the image for white borders
                    if (await fs.pathExists(screenshotPath)) {
                        await this.analyzeImageBorders(screenshotPath);
                    }
                }
            }
            
            // Analyze a content page
            console.log('\nAnalyzing content page...');
            
            if (useHTML) {
                const contentPage = await page.$('.chapter-page');
                if (contentPage) {
                    const screenshotPath = path.join(this.outputDir, 'content-analysis.png');
                    await contentPage.screenshot({ path: screenshotPath });
                    
                    const analysis = await page.evaluate(() => {
                        const chapter = document.querySelector('.chapter-page');
                        const content = chapter?.querySelector('.chapter-content');
                        
                        if (!chapter || !content) return null;
                        
                        const pageRect = chapter.getBoundingClientRect();
                        const contentRect = content.getBoundingClientRect();
                        
                        return {
                            page: {
                                width: pageRect.width,
                                height: pageRect.height
                            },
                            margins: {
                                top: contentRect.top - pageRect.top,
                                right: pageRect.right - contentRect.right,
                                bottom: pageRect.bottom - contentRect.bottom,
                                left: contentRect.left - pageRect.left
                            }
                        };
                    });
                    
                    if (analysis) {
                        console.log('\nContent Page Analysis:');
                        console.log(`  Page: ${analysis.page.width} × ${analysis.page.height}px`);
                        console.log(`  Margins:`);
                        console.log(`    Top: ${analysis.margins.top}px (${(analysis.margins.top/72).toFixed(2)}")`);
                        console.log(`    Right: ${analysis.margins.right}px (${(analysis.margins.right/72).toFixed(2)}")`);
                        console.log(`    Bottom: ${analysis.margins.bottom}px (${(analysis.margins.bottom/72).toFixed(2)}")`);
                        console.log(`    Left: ${analysis.margins.left}px (${(analysis.margins.left/72).toFixed(2)}")`);
                    }
                }
            }
            
        } finally {
            await browser.close();
        }
        
        console.log(`\n📁 Screenshots saved to: ${this.outputDir}`);
    }
    
    async analyzeImageBorders(imagePath) {
        try {
            // Note: sharp is not installed, so we'll use a simpler approach
            console.log('\n🖼️  Border Detection Results:');
            console.log('  (Install sharp for pixel-level analysis)');
            console.log(`  Screenshot saved: ${imagePath}`);
            console.log('  Open image to visually inspect borders');
        } catch (error) {
            console.log('  Unable to perform pixel analysis:', error.message);
        }
    }
}

// Run
async function main() {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook-perfect.pdf');
    
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    const detector = new VisualBorderDetector(pdfPath);
    await detector.detectBorders();
}

main().catch(console.error);