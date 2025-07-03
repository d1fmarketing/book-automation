const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function extractPDFPages() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const outputDir = path.join(__dirname, '../build/pdf-pages');
    
    console.log('Extracting PDF pages for inspection...');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    try {
        // Load the PDF
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        console.log(`PDF has ${pageCount} pages`);
        
        // Get PDF dimensions
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        console.log(`Page dimensions: ${width} x ${height} points`);
        console.log(`Page dimensions: ${width/72}" x ${height/72}" inches`);
        
        // Launch browser for rendering
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set high quality viewport
        await page.setViewport({
            width: Math.ceil(width * 2),
            height: Math.ceil(height * 2),
            deviceScaleFactor: 2
        });
        
        // Create HTML template for each page
        for (let i = 0; i < Math.min(pageCount, 10); i++) { // First 10 pages for testing
            console.log(`Processing page ${i + 1}/${pageCount}...`);
            
            // Create single-page PDF
            const singlePageDoc = await PDFDocument.create();
            const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
            singlePageDoc.addPage(copiedPage);
            const singlePagePdf = await singlePageDoc.save();
            
            const tempPdfPath = path.join(outputDir, `page-${i + 1}.pdf`);
            await fs.writeFile(tempPdfPath, singlePagePdf);
            
            // Create HTML to display the PDF page
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        background: #333; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .page-container {
                        background: white;
                        box-shadow: 0 0 20px rgba(0,0,0,0.3);
                        width: ${width}px;
                        height: ${height}px;
                        position: relative;
                        overflow: hidden;
                    }
                    embed {
                        width: 100%;
                        height: 100%;
                    }
                    .info {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background: rgba(255,255,0,0.8);
                        padding: 5px 10px;
                        font-family: monospace;
                        font-size: 12px;
                        z-index: 1000;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <div class="info">Page ${i + 1} of ${pageCount}</div>
                    <embed src="file://${tempPdfPath}" type="application/pdf" />
                </div>
            </body>
            </html>`;
            
            await page.setContent(html, { waitUntil: 'networkidle0' });
            await page.waitForTimeout(1000);
            
            // Take screenshot
            const screenshotPath = path.join(outputDir, `page-${i + 1}-screenshot.png`);
            await page.screenshot({ 
                path: screenshotPath,
                clip: {
                    x: (page.viewport().width - width) / 2,
                    y: (page.viewport().height - height) / 2,
                    width: width,
                    height: height
                }
            });
            
            // Check for common issues
            const issues = await page.evaluate(() => {
                const container = document.querySelector('.page-container');
                const embed = document.querySelector('embed');
                const issues = [];
                
                if (!embed) {
                    issues.push('PDF embed element not found');
                }
                
                // Check if embed loaded
                if (embed && embed.clientWidth === 0) {
                    issues.push('PDF not rendering (width = 0)');
                }
                
                return issues;
            });
            
            if (issues.length > 0) {
                console.log(`  Issues found on page ${i + 1}:`, issues);
            }
        }
        
        await browser.close();
        
        // Generate inspection report
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath: pdfPath,
            pageCount: pageCount,
            pageDimensions: {
                points: { width, height },
                inches: { width: width/72, height: height/72 }
            },
            pagesExtracted: Math.min(pageCount, 10),
            outputDirectory: outputDir
        };
        
        await fs.writeFile(
            path.join(outputDir, 'extraction-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\nExtraction complete!');
        console.log(`Check the screenshots in: ${outputDir}`);
        console.log('\nLook for:');
        console.log('- White borders or margins');
        console.log('- Missing images or broken image links');
        console.log('- Text overflow or cut-off content');
        console.log('- Incorrect page dimensions (should be 6x9 inches)');
        
    } catch (error) {
        console.error('Error extracting PDF pages:', error);
        throw error;
    }
}

extractPDFPages().catch(console.error);