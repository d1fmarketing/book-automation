#!/usr/bin/env node

const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function qaCheckPerfectPDF() {
    const pdfPath = path.join(__dirname, 'the-claude-elite-pipeline-PERFECT.pdf');
    
    console.log('🔍 Running COMPLETE QA Check on PERFECT PDF...\n');
    
    try {
        // Check file exists
        const stats = fs.statSync(pdfPath);
        console.log(`📄 PDF Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Launch browser for visual check
        const browser = await puppeteer.launch({ 
            headless: false, // Show browser for visual inspection
            devtools: true 
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1200, height: 800 });
        
        // Open PDF
        await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
        
        console.log('\n🖼️  Visual inspection started...');
        console.log('Please check in the browser:');
        console.log('  1. Is the cover showing properly?');
        console.log('  2. Are all images visible and horizontal?');
        console.log('  3. Do chapters have drop caps?');
        console.log('  4. Does it look professional?');
        
        // Keep browser open for manual inspection
        console.log('\n⏸️  Browser will stay open for manual inspection.');
        console.log('Press Ctrl+C when done checking.');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

qaCheckPerfectPDF();