#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function checkPDF() {
    const pdfPath = path.join(__dirname, '../THE-CLAUDE-ELITE-PIPELINE-FINAL-PERFECT.pdf');
    
    if (!fs.existsSync(pdfPath)) {
        console.error('PDF not found:', pdfPath);
        process.exit(1);
    }
    
    console.log('Checking PDF:', pdfPath);
    console.log('File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Enable console logging
        page.on('console', msg => console.log('Browser console:', msg.text()));
        page.on('error', err => console.error('Browser error:', err));
        
        // Set viewport to book size
        await page.setViewport({ width: 600, height: 900 });
        
        // Load PDF
        console.log('Loading PDF...');
        await page.goto(`file://${pdfPath}`, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait a bit for PDF to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take screenshots of first few pages
        console.log('\nTaking screenshots...');
        
        for (let i = 1; i <= 5; i++) {
            await page.goto(`file://${pdfPath}#page=${i}`, { waitUntil: 'networkidle0' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const screenshotPath = path.join(__dirname, `../build/page-${i}.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: false 
            });
            
            const size = fs.statSync(screenshotPath).size;
            console.log(`Page ${i} screenshot: ${(size / 1024).toFixed(2)} KB`);
            
            // Check if it's mostly blank
            if (size < 50000) {
                console.log(`  ⚠️  Page ${i} might be blank or have rendering issues`);
            }
        }
        
        console.log('\n✅ Screenshots saved to build/ directory');
        
    } finally {
        await browser.close();
    }
}

checkPDF().catch(console.error);