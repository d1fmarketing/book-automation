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
    
    // Chapter 1 (around page 5)
    await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        if (viewer) {
            viewer.scrollTop = viewer.scrollHeight * (5/43);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ 
        path: path.join(outputDir, 'chapter-1-view.png'),
        fullPage: false
    });
    
    // Chapter 5 (around page 25)
    await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        if (viewer) {
            viewer.scrollTop = viewer.scrollHeight * (25/43);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ 
        path: path.join(outputDir, 'chapter-5-view.png'),
        fullPage: false
    });
    
    // Chapter 9 (around page 35)
    await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        if (viewer) {
            viewer.scrollTop = viewer.scrollHeight * (35/43);
        }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ 
        path: path.join(outputDir, 'chapter-9-view.png'),
        fullPage: false
    });
    
    console.log('Screenshots saved. Browser will remain open for inspection.');
    console.log('Close the browser window when done.');
    
    // Keep browser open
    await new Promise(() => {});
}

viewPDF().catch(console.error);