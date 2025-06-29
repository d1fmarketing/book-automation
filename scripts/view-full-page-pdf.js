const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs-extra');

async function viewPDF() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();
    
    // Path to the PDF
    const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'ebook-full-page.pdf');
    const pdfUrl = `file://${pdfPath}`;
    
    console.log('Opening PDF:', pdfUrl);
    
    // Navigate to the PDF
    await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
    
    // Wait a bit for PDF to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshots of different pages
    const outputDir = path.join(__dirname, '..', 'build', 'dist');
    
    // Page 2
    await page.screenshot({ 
        path: path.join(outputDir, 'full-page-view-2.png'),
        fullPage: false
    });
    
    // Page 20
    await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        if (viewer) {
            viewer.scrollTop = viewer.scrollHeight * (20/43);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ 
        path: path.join(outputDir, 'full-page-view-20.png'),
        fullPage: false
    });
    
    // Page 30
    await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        if (viewer) {
            viewer.scrollTop = viewer.scrollHeight * (30/43);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ 
        path: path.join(outputDir, 'full-page-view-30.png'),
        fullPage: false
    });
    
    console.log('Screenshots saved. Browser will remain open for inspection.');
    console.log('Close the browser window when done.');
    
    // Keep browser open
    await new Promise(() => {});
}

viewPDF().catch(console.error);