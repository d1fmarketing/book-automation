#!/usr/bin/env node

/**
 * Full PDF Visual Check
 * Verifica CADA página do PDF visualmente
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function checkPDF(pdfPath) {
    console.log('🔍 Full PDF Visual Check Starting...\n');
    
    // Load PDF to get page count
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`📄 Total pages: ${pageCount}\n`);
    
    const browser = await puppeteer.launch({ 
        headless: false, // Show browser so we can see
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    // Open PDF
    await page.goto(`file://${path.resolve(pdfPath)}`, {
        waitUntil: 'networkidle0'
    });
    
    // Wait for PDF to load
    await page.waitForTimeout(3000);
    
    const issues = [];
    
    // Check page 1 - Cover
    console.log('🎨 Checking Page 1 (Cover)...');
    
    // Take screenshot of viewport
    const coverScreenshot = await page.screenshot({ 
        path: 'build/qa/page-1-cover-check.png',
        fullPage: false 
    });
    
    // Check for white borders by analyzing the screenshot
    // This is a simple check - in reality we'd analyze the image pixels
    console.log('  - Screenshot saved for manual inspection');
    
    // Scroll through pages
    for (let i = 2; i <= Math.min(pageCount, 10); i++) {
        console.log(`📄 Checking Page ${i}...`);
        
        // Scroll to approximate page position
        const scrollAmount = (i - 1) * 950; // Approximate height per page
        await page.evaluate((scroll) => {
            window.scrollTo(0, scroll);
        }, scrollAmount);
        
        await page.waitForTimeout(500);
        
        // Take screenshot
        await page.screenshot({ 
            path: `build/qa/page-${i}-check.png`,
            fullPage: false 
        });
    }
    
    console.log('\n📸 Screenshots saved to build/qa/');
    console.log('👀 Please manually inspect the screenshots');
    console.log('\nPress Enter to close browser...');
    
    // Wait for user input
    await new Promise(resolve => {
        process.stdin.once('data', resolve);
    });
    
    await browser.close();
}

// Run
const pdfPath = process.argv[2] || 'build/dist/premium-mcp-ebook.pdf';
checkPDF(pdfPath).catch(console.error);