const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function inspectPDF() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const outputDir = path.join(__dirname, '../build/pdf-inspection');
    
    console.log('Starting comprehensive PDF inspection...');
    console.log(`PDF Path: ${pdfPath}`);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set viewport to see full page
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 2
        });
        
        // Navigate to PDF
        await page.goto(`file://${pdfPath}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for PDF to load
        await page.waitForTimeout(3000);
        
        // Get PDF viewer info
        const pdfInfo = await page.evaluate(() => {
            // Try to get PDF viewer details
            const viewer = document.querySelector('embed') || document.querySelector('iframe') || document.querySelector('object');
            if (viewer) {
                return {
                    type: viewer.tagName,
                    src: viewer.src,
                    width: viewer.width,
                    height: viewer.height
                };
            }
            return { type: 'inline', bodyContent: document.body.innerHTML.substring(0, 200) };
        });
        
        console.log('PDF Viewer Info:', pdfInfo);
        
        // Take screenshot of current view
        const screenshotPath = path.join(outputDir, 'pdf-view.png');
        await page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
        });
        console.log(`Screenshot saved: ${screenshotPath}`);
        
        // Try to interact with PDF viewer
        const hasControls = await page.evaluate(() => {
            // Check for PDF.js controls
            const controls = document.querySelector('#toolbarContainer') || 
                           document.querySelector('.toolbar') ||
                           document.querySelector('[id*="toolbar"]');
            return !!controls;
        });
        
        console.log('PDF Controls detected:', hasControls);
        
        // Get page count if possible
        const pageInfo = await page.evaluate(() => {
            // Try various methods to get page count
            const pageCountElement = document.querySelector('#numPages') ||
                                   document.querySelector('.page-count') ||
                                   document.querySelector('[class*="pageNumber"]');
            
            if (pageCountElement) {
                return pageCountElement.textContent;
            }
            
            // Check for PDF.js specific elements
            if (window.PDFViewerApplication) {
                return {
                    numPages: window.PDFViewerApplication.pagesCount,
                    currentPage: window.PDFViewerApplication.page
                };
            }
            
            return null;
        });
        
        console.log('Page Info:', pageInfo);
        
        // Save inspection report
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath: pdfPath,
            fileSize: (await fs.stat(pdfPath)).size,
            viewerInfo: pdfInfo,
            hasControls: hasControls,
            pageInfo: pageInfo,
            screenshotPath: screenshotPath
        };
        
        await fs.writeFile(
            path.join(outputDir, 'inspection-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\nInspection complete. Please check the browser window manually.');
        console.log('Look for:');
        console.log('- White borders around pages');
        console.log('- Missing images');
        console.log('- Broken layouts');
        console.log('- Text overflow');
        console.log('- Any rendering glitches');
        
        console.log('\nPress Ctrl+C to close when done inspecting...');
        
        // Keep browser open for manual inspection
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error during inspection:', error);
        throw error;
    }
}

inspectPDF().catch(console.error);