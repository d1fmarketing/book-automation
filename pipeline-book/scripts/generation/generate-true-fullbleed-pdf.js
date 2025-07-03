#!/usr/bin/env node

/**
 * True Full Bleed PDF Generator
 * Ensures ZERO margins on cover page
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function generateTrueFullBleed() {
    console.log('🎯 Generating TRUE full bleed PDF...\n');
    
    const projectRoot = path.join(__dirname, '../../');
    const htmlPath = path.join(projectRoot, 'build/premium-mcp-debug.html');
    const tempPdfPath = path.join(projectRoot, 'build/temp-fullbleed.pdf');
    const finalPdfPath = path.join(projectRoot, 'build/dist/true-fullbleed-ebook.pdf');
    
    // Ensure the HTML exists
    if (!await fs.pathExists(htmlPath)) {
        throw new Error('HTML file not found. Run make pdf-premium first.');
    }
    
    console.log('🚀 Launching Puppeteer...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Load the HTML
        const html = await fs.readFile(htmlPath, 'utf8');
        
        // Modify HTML to ensure NO margins on cover
        const modifiedHtml = html.replace(
            '@page :first {',
            '@page :first { size: 6in 9in !important;'
        ).replace(
            '.cover {',
            '.cover { margin: 0 !important; padding: 0 !important; width: 6in !important; height: 9in !important;'
        );
        
        await page.setContent(modifiedHtml, {
            waitUntil: 'networkidle0'
        });
        
        // Wait for rendering
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate PDF with EXACT dimensions
        console.log('📄 Generating PDF with TRUE full bleed...');
        await page.pdf({
            path: tempPdfPath,
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: '0mm',
                right: '0mm',
                bottom: '0mm',
                left: '0mm'
            },
            preferCSSPageSize: false // Don't let CSS override our settings
        });
        
        await browser.close();
        
        // Now use pdf-lib to ensure the first page has NO cropbox/mediabox issues
        console.log('🔧 Processing with pdf-lib to ensure full bleed...');
        
        const pdfBytes = await fs.readFile(tempPdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Get first page
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        
        // Set media box to exact 6x9 inches (432x648 points)
        firstPage.setMediaBox(0, 0, 432, 648);
        
        // Remove any crop box
        if (firstPage.node.CropBox) {
            delete firstPage.node.CropBox;
        }
        
        // Save the modified PDF
        const modifiedPdfBytes = await pdfDoc.save();
        await fs.writeFile(finalPdfPath, modifiedPdfBytes);
        
        // Clean up temp file
        await fs.remove(tempPdfPath);
        
        console.log('\n✅ TRUE full bleed PDF generated!');
        console.log(`📍 Output: ${finalPdfPath}`);
        
        // Get file info
        const stats = await fs.stat(finalPdfPath);
        console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Take a screenshot of just the cover for verification
        console.log('\n📸 Taking cover screenshot for verification...');
        
        const browser2 = await puppeteer.launch({ headless: true });
        const page2 = await browser2.newPage();
        
        await page2.goto(`file://${path.resolve(finalPdfPath)}`, {
            waitUntil: 'networkidle0'
        });
        
        await page2.setViewport({ width: 432, height: 648 });
        
        const screenshotPath = path.join(projectRoot, 'build/qa/true-fullbleed-cover.png');
        await fs.ensureDir(path.dirname(screenshotPath));
        await page2.screenshot({ 
            path: screenshotPath,
            fullPage: false,
            clip: { x: 0, y: 0, width: 432, height: 648 }
        });
        
        await browser2.close();
        
        console.log(`📸 Cover screenshot saved: ${screenshotPath}`);
        console.log('\n🎯 Please check the screenshot to verify NO WHITE BORDERS!');
        
        // Open the screenshot
        const { exec } = require('child_process');
        exec(`open "${screenshotPath}"`);
        
    } catch (error) {
        await browser.close();
        throw error;
    }
}

// Run
generateTrueFullBleed().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});