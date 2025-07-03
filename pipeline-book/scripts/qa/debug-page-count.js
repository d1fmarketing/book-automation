#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function debugPageCount() {
    console.log('🔍 Debugging Page Count Issue\n');
    
    const debugHtml = path.join(__dirname, '../../build/final-perfect-debug.html');
    
    if (!await fs.pathExists(debugHtml)) {
        console.error('Debug HTML not found');
        return;
    }
    
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser to see what's happening
        devtools: true
    });
    
    try {
        const page = await browser.newPage();
        
        // Set print media
        await page.emulateMediaType('print');
        
        // Load HTML
        const html = await fs.readFile(debugHtml, 'utf8');
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Wait for rendering
        await page.waitForTimeout(2000);
        
        // Count page elements
        const pageCount = await page.evaluate(() => {
            const pages = document.querySelectorAll('.page, .cover');
            console.log('Found pages:', pages.length);
            
            pages.forEach((p, i) => {
                const rect = p.getBoundingClientRect();
                console.log(`Page ${i+1}:`, {
                    class: p.className,
                    height: rect.height,
                    width: rect.width,
                    display: window.getComputedStyle(p).display,
                    pageBreak: window.getComputedStyle(p).pageBreakAfter
                });
            });
            
            return pages.length;
        });
        
        console.log(`\nHTML has ${pageCount} page elements`);
        
        // Try to generate PDF with logging
        console.log('\nGenerating PDF...');
        const pdf = await page.pdf({
            path: 'debug-test.pdf',
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: false
        });
        
        console.log('PDF generated, checking with pdf-lib...');
        
        // Check PDF pages
        const { PDFDocument } = require('pdf-lib');
        const pdfBytes = await fs.readFile('debug-test.pdf');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        
        console.log(`\nPDF has ${pages.length} pages`);
        
        if (pages.length !== pageCount) {
            console.error(`\n❌ MISMATCH: HTML has ${pageCount} pages but PDF has ${pages.length}`);
        }
        
    } finally {
        // Keep browser open for inspection
        console.log('\nPress Ctrl+C to close browser...');
        await new Promise(() => {}); // Keep running
    }
}

debugPageCount().catch(console.error);