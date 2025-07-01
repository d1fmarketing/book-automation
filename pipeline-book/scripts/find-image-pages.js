#!/usr/bin/env node

const { PDFDocument: PDFLib } = require('pdf-lib');
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function findImagePages() {
    const pdfPath = path.join(__dirname, '../THE-CLAUDE-ELITE-PIPELINE-FINAL-PERFECT.pdf');
    
    // Load the PDF
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFLib.load(pdfBytes);
    
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ 
        width: 432, 
        height: 648,
        deviceScaleFactor: 2
    });
    
    // Check pages 12-17 as they might have images
    const pagesToCheck = [12, 13, 14, 15, 16, 17];
    
    for (const pageNum of pagesToCheck) {
        if (pageNum > pdfDoc.getPageCount()) continue;
        
        // Create single page PDF
        const singlePageDoc = await PDFLib.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [pageNum - 1]);
        singlePageDoc.addPage(copiedPage);
        const singlePageBytes = await singlePageDoc.save();
        
        const tempPdfPath = path.join(__dirname, `../build/temp-page-${pageNum}.pdf`);
        await fs.writeFile(tempPdfPath, singlePageBytes);
        
        await page.goto(`file://${tempPdfPath}`, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const screenshotPath = path.join(__dirname, `../build/image-search-page-${pageNum}.png`);
        await page.screenshot({ 
            path: screenshotPath,
            fullPage: true
        });
        
        const size = fs.statSync(screenshotPath).size;
        console.log(`Page ${pageNum} rendered: ${(size / 1024).toFixed(2)} KB ${size > 100000 ? '📸 LIKELY HAS IMAGE!' : ''}`);
        
        await fs.remove(tempPdfPath);
    }
    
    await browser.close();
    console.log('\nPages saved to build/ directory');
}

findImagePages().catch(console.error);