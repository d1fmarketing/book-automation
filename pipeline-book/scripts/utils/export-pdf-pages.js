#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument: PDFLib } = require('pdf-lib');

async function exportPDFPages() {
    const pdfPath = path.join(__dirname, '../THE-CLAUDE-ELITE-PIPELINE-FINAL-PERFECT.pdf');
    
    if (!fs.existsSync(pdfPath)) {
        console.error('PDF not found:', pdfPath);
        process.exit(1);
    }
    
    console.log('Analyzing PDF:', pdfPath);
    console.log('File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');
    
    try {
        // Load the PDF
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFLib.load(pdfBytes);
        
        console.log('\nPDF Details:');
        console.log('Total pages:', pdfDoc.getPageCount());
        console.log('PDF version:', pdfDoc.getTitle() || 'No title');
        
        // Get page dimensions
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        console.log(`Page size: ${width} x ${height} points (${(width/72).toFixed(1)}" x ${(height/72).toFixed(1)}")`);
        
        // Now use Puppeteer to render specific pages
        const browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set viewport to match PDF page size
        await page.setViewport({ 
            width: Math.round(width), 
            height: Math.round(height),
            deviceScaleFactor: 2 // Higher quality
        });
        
        console.log('\nRendering pages...');
        
        // Render first 5 pages
        for (let i = 0; i < Math.min(5, pdfDoc.getPageCount()); i++) {
            // Create a new PDF with just this page
            const singlePageDoc = await PDFLib.create();
            const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
            singlePageDoc.addPage(copiedPage);
            const singlePageBytes = await singlePageDoc.save();
            
            // Save single page PDF
            const tempPdfPath = path.join(__dirname, `../build/temp-page-${i + 1}.pdf`);
            await fs.writeFile(tempPdfPath, singlePageBytes);
            
            // Load and screenshot the single page
            await page.goto(`file://${tempPdfPath}`, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const screenshotPath = path.join(__dirname, `../build/pdf-page-${i + 1}.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true
            });
            
            const size = fs.statSync(screenshotPath).size;
            console.log(`Page ${i + 1} rendered: ${(size / 1024).toFixed(2)} KB`);
            
            // Clean up temp file
            await fs.remove(tempPdfPath);
        }
        
        await browser.close();
        console.log('\n✅ Page images saved to build/ directory');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

exportPDFPages().catch(console.error);