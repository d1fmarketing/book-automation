const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function quickPDFCheck() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const outputDir = path.join(__dirname, '../build/pdf-check');
    
    console.log('Quick PDF Check...');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set a good viewport
        await page.setViewport({
            width: 1200,
            height: 1600,
            deviceScaleFactor: 2
        });
        
        // Navigate to PDF
        console.log('Opening PDF...');
        await page.goto(`file://${pdfPath}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for PDF to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Taking screenshots...');
        
        // Take initial screenshot
        await page.screenshot({ 
            path: path.join(outputDir, 'initial-view.png'),
            fullPage: false 
        });
        
        // Try to detect PDF viewer type
        const viewerType = await page.evaluate(() => {
            if (document.querySelector('#viewer')) return 'pdf.js';
            if (document.querySelector('embed[type="application/pdf"]')) return 'chrome-native';
            if (document.querySelector('iframe')) return 'iframe';
            return 'unknown';
        });
        
        console.log('PDF Viewer Type:', viewerType);
        
        // For Chrome native viewer, try to navigate pages
        if (viewerType === 'chrome-native') {
            console.log('Attempting to navigate through pages...');
            
            // Try Page Down key
            for (let i = 0; i < 5; i++) {
                await page.keyboard.press('PageDown');
                await new Promise(resolve => setTimeout(resolve, 1000));
                await page.screenshot({ 
                    path: path.join(outputDir, `page-${i + 1}.png`),
                    fullPage: false 
                });
            }
        }
        
        console.log(`\nScreenshots saved in: ${outputDir}`);
        console.log('\nPlease inspect the PDF manually in the browser window.');
        console.log('Look for:');
        console.log('- Cover page with full-bleed image');
        console.log('- White borders or margins that shouldn\'t be there');
        console.log('- Missing images');
        console.log('- Text overflow or layout issues');
        console.log('- Any rendering glitches');
        
        console.log('\nKeeping browser open for manual inspection...');
        console.log('Press Ctrl+C when done.');
        
        // Keep browser open
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error:', error);
        await browser.close();
    }
}

quickPDFCheck().catch(console.error);