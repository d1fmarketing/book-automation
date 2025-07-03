const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

async function analyzeIronFistPDF() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const outputDir = path.join(__dirname, '../build/iron-fist-analysis');
    
    console.log('Analyzing Iron Fist Perfect Ebook PDF...');
    console.log(`PDF Path: ${pdfPath}`);
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    try {
        // First, analyze with pdf-lib
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        console.log(`\nPDF Analysis:`);
        console.log(`- Total pages: ${pageCount}`);
        
        // Analyze each page
        const pageAnalysis = [];
        for (let i = 0; i < pageCount; i++) {
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            
            // Get page content info
            const content = page.node.toString();
            const hasImages = content.includes('/Image') || content.includes('/XObject');
            const hasText = content.includes('/Font') || content.includes('BT'); // Begin Text
            
            const analysis = {
                pageNumber: i + 1,
                dimensions: {
                    points: { width, height },
                    inches: { width: (width/72).toFixed(2), height: (height/72).toFixed(2) }
                },
                hasImages,
                hasText,
                isStandardSize: Math.abs(width - 432) < 1 && Math.abs(height - 648) < 1 // 6x9 inches
            };
            
            pageAnalysis.push(analysis);
            
            console.log(`\nPage ${i + 1}:`);
            console.log(`- Size: ${analysis.dimensions.inches.width}" x ${analysis.dimensions.inches.height}"`);
            console.log(`- Has images: ${hasImages}`);
            console.log(`- Has text: ${hasText}`);
            console.log(`- Standard 6x9: ${analysis.isStandardSize}`);
        }
        
        // Now render with Puppeteer for visual inspection
        console.log('\n\nStarting visual inspection with Puppeteer...');
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({
            width: 1200,
            height: 900,
            deviceScaleFactor: 2
        });
        
        // Create HTML pages for each PDF page
        for (let i = 0; i < Math.min(pageCount, 5); i++) { // First 5 pages
            console.log(`\nRendering page ${i + 1}...`);
            
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>PDF Page ${i + 1}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        background: #2a2a2a;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        font-family: Arial, sans-serif;
                    }
                    .container {
                        background: white;
                        padding: 20px;
                        text-align: center;
                    }
                    .page-info {
                        background: #ffeb3b;
                        color: #000;
                        padding: 10px;
                        margin-bottom: 20px;
                        font-weight: bold;
                    }
                    .pdf-frame {
                        width: 600px;
                        height: 900px;
                        border: 2px solid #000;
                        background: #fff;
                    }
                    .analysis {
                        margin-top: 20px;
                        text-align: left;
                        background: #f5f5f5;
                        padding: 15px;
                        border-radius: 5px;
                    }
                    .issue {
                        color: #d32f2f;
                        font-weight: bold;
                    }
                    .good {
                        color: #388e3c;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="page-info">
                        PDF: iron-fist-perfect-ebook.pdf - Page ${i + 1} of ${pageCount}
                    </div>
                    <iframe 
                        class="pdf-frame"
                        src="file://${pdfPath}#page=${i + 1}" 
                        type="application/pdf">
                    </iframe>
                    <div class="analysis">
                        <h3>Page Analysis:</h3>
                        <p>Dimensions: ${pageAnalysis[i].dimensions.inches.width}" x ${pageAnalysis[i].dimensions.inches.height}"</p>
                        <p class="${pageAnalysis[i].isStandardSize ? 'good' : 'issue'}">
                            Standard 6x9: ${pageAnalysis[i].isStandardSize ? 'YES ✓' : 'NO ✗'}
                        </p>
                        <p>Has Images: ${pageAnalysis[i].hasImages ? 'Yes' : 'No'}</p>
                        <p>Has Text: ${pageAnalysis[i].hasText ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            </body>
            </html>`;
            
            await page.setContent(html, { waitUntil: 'networkidle0' });
            await page.waitForTimeout(2000);
            
            const screenshotPath = path.join(outputDir, `page-${i + 1}-visual.png`);
            await page.screenshot({ 
                path: screenshotPath,
                fullPage: true 
            });
            
            console.log(`Screenshot saved: ${screenshotPath}`);
        }
        
        await browser.close();
        
        // Save full analysis report
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath: pdfPath,
            fileSize: pdfBuffer.length,
            pageCount: pageCount,
            pages: pageAnalysis,
            issues: {
                nonStandardPages: pageAnalysis.filter(p => !p.isStandardSize).map(p => p.pageNumber),
                pagesWithoutImages: pageAnalysis.filter(p => !p.hasImages).map(p => p.pageNumber),
                pagesWithoutText: pageAnalysis.filter(p => !p.hasText).map(p => p.pageNumber)
            }
        };
        
        await fs.writeFile(
            path.join(outputDir, 'analysis-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        // Summary
        console.log('\n\n=== ANALYSIS SUMMARY ===');
        console.log(`Total Pages: ${pageCount}`);
        console.log(`File Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        
        if (report.issues.nonStandardPages.length > 0) {
            console.log(`\n❌ NON-STANDARD PAGE SIZES: Pages ${report.issues.nonStandardPages.join(', ')}`);
        } else {
            console.log('\n✅ All pages are standard 6x9 inches');
        }
        
        if (report.issues.pagesWithoutImages.length > 0) {
            console.log(`\n⚠️  Pages without images: ${report.issues.pagesWithoutImages.join(', ')}`);
        }
        
        if (report.issues.pagesWithoutText.length > 0) {
            console.log(`\n⚠️  Pages without text: ${report.issues.pagesWithoutText.join(', ')}`);
        }
        
        console.log(`\n\nDetailed analysis saved to: ${outputDir}`);
        console.log('Check the screenshots for visual issues!');
        
    } catch (error) {
        console.error('Error analyzing PDF:', error);
        throw error;
    }
}

analyzeIronFistPDF().catch(console.error);