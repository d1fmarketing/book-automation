#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function pdfToImages() {
    const pdfUrl = 'http://localhost:8080/pdfjs/web/viewer.html?file=/dist/tdah-descomplicado-colorful.pdf';
    const outputDir = path.join(__dirname, '../build/dist/pdf-visual-check');
    
    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });
    
    console.log('🚀 Starting PDF visualization...');
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser so you can see what's happening
        defaultViewport: { width: 1200, height: 1600 }
    });
    
    const page = await browser.newPage();
    
    console.log('📄 Loading PDF viewer...');
    await page.goto(pdfUrl, { waitUntil: 'networkidle2' });
    
    // Wait for PDF.js to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshots of first 10 pages
    const pagesToCapture = [1, 2, 3, 5, 10, 20, 30, 40, 50];
    
    for (const pageNum of pagesToCapture) {
        console.log(`📸 Capturing page ${pageNum}...`);
        
        // Navigate to specific page
        await page.evaluate((num) => {
            window.PDFViewerApplication.pdfViewer.currentPageNumber = num;
        }, pageNum);
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for page to render
        
        // Take screenshot
        await page.screenshot({
            path: path.join(outputDir, `page-${String(pageNum).padStart(2, '0')}.png`),
            fullPage: false
        });
    }
    
    console.log('✅ PDF visualization complete!');
    console.log(`📁 Images saved to: ${outputDir}`);
    console.log('👀 Browser will stay open for 30 seconds so you can manually check the PDF...');
    
    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await browser.close();
}

pdfToImages().catch(console.error);