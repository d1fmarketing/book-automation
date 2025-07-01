#!/usr/bin/env node
// Visual PDF analysis script

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function analyzePDFVisually() {
    const pdfPath = path.join(__dirname, '..', 'pipeline-book', 'the-claude-elite-pipeline-professional.pdf');
    const outputDir = path.join(__dirname, '..', 'build', 'pdf-analysis');
    
    console.log('🔍 Visual PDF Analysis');
    console.log('PDF:', pdfPath);
    
    try {
        // Create output directory
        await fs.mkdir(outputDir, { recursive: true });
        
        // 1. Basic PDF info
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        
        console.log(`\n📊 PDF Info:`);
        console.log(`- Total pages: ${pages.length}`);
        console.log(`- Title: ${pdfDoc.getTitle() || 'Not set'}`);
        console.log(`- Page size: 6×9 inches`);
        
        // 2. Launch browser for screenshots
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Set viewport to match PDF size
        await page.setViewport({ width: 600, height: 900 });
        
        // Navigate to PDF
        await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Take screenshots of key pages
        const pagesToCapture = [
            { page: 1, name: 'cover' },
            { page: 2, name: 'toc-start' },
            { page: 5, name: 'chapter-1' },
            { page: 15, name: 'mid-content' },
            { page: pages.length, name: 'last-page' }
        ];
        
        console.log('\n📸 Capturing key pages...');
        
        for (const { page: pageNum, name } of pagesToCapture) {
            if (pageNum <= pages.length) {
                // Navigate to specific page (if PDF viewer supports it)
                const screenshotPath = path.join(outputDir, `${name}-page${pageNum}.png`);
                
                // Scroll to approximate position for the page
                const scrollPosition = (pageNum - 1) * 900;
                await page.evaluate((scroll) => {
                    window.scrollTo(0, scroll);
                }, scrollPosition);
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                await page.screenshot({ 
                    path: screenshotPath,
                    fullPage: false
                });
                
                const stats = await fs.stat(screenshotPath);
                console.log(`✓ Page ${pageNum} (${name}): ${(stats.size / 1024).toFixed(1)}KB`);
            }
        }
        
        await browser.close();
        
        // 3. Analyze screenshots
        console.log('\n📋 Analysis Results:');
        
        // Check cover
        const coverStats = await fs.stat(path.join(outputDir, 'cover-page1.png'));
        const coverSizeKB = coverStats.size / 1024;
        
        if (coverSizeKB > 50) {
            console.log('✅ Cover: Visual content detected (likely has cover image)');
        } else {
            console.log('❌ Cover: Only text detected (missing cover image)');
        }
        
        console.log('\n📁 Screenshots saved to:', outputDir);
        console.log('\nPlease review the screenshots manually for:');
        console.log('- Cover quality and appeal');
        console.log('- Table of contents formatting');
        console.log('- Chapter layout and typography');
        console.log('- Overall professional appearance');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run analysis
analyzePDFVisually();