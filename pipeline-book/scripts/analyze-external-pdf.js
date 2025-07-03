const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function analyzePDF(pdfPath) {
    console.log(`🔍 Analyzing PDF: ${pdfPath}`);
    
    try {
        // Check if PDF exists
        await fs.access(pdfPath);
        console.log('✅ PDF file found');
        
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Open PDF
        const pdfUrl = `file://${pdfPath}`;
        console.log(`📄 Opening PDF: ${pdfUrl}`);
        await page.goto(pdfUrl, { waitUntil: 'networkidle0', timeout: 60000 });
        
        // Wait for PDF to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get PDF viewer info
        const pdfInfo = await page.evaluate(() => {
            const viewer = document.querySelector('embed') || document.querySelector('iframe') || document.body;
            return {
                hasViewer: !!viewer,
                viewerType: viewer?.tagName,
                pageCount: window.PDFViewerApplication?.pagesCount || 'Unknown'
            };
        });
        
        console.log('📊 PDF Info:', pdfInfo);
        
        // Take screenshots of each page
        const screenshotsDir = path.join(process.cwd(), 'build', 'screenshots');
        await fs.mkdir(screenshotsDir, { recursive: true });
        
        // Scroll through the PDF and take screenshots
        const viewportHeight = await page.evaluate(() => window.innerHeight);
        const documentHeight = await page.evaluate(() => document.body.scrollHeight);
        const pages = Math.ceil(documentHeight / viewportHeight);
        
        console.log(`📸 Taking screenshots of ${pages} viewport sections...`);
        
        for (let i = 0; i < pages; i++) {
            await page.evaluate((pageNum, height) => {
                window.scrollTo(0, pageNum * height);
            }, i, viewportHeight);
            
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for render
            
            const screenshotPath = path.join(screenshotsDir, `external-pdf-viewport-${i + 1}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: false });
            console.log(`  ✅ Screenshot ${i + 1}/${pages} saved`);
        }
        
        // Also take a full page screenshot
        const fullScreenshotPath = path.join(screenshotsDir, 'external-pdf-full.png');
        await page.screenshot({ path: fullScreenshotPath, fullPage: true });
        console.log('  ✅ Full page screenshot saved');
        
        console.log('\n🎉 PDF analysis complete!');
        console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
        
        // Keep browser open for manual inspection
        console.log('\n👀 Browser left open for manual inspection. Press Ctrl+C to close.');
        
    } catch (error) {
        console.error('❌ Error analyzing PDF:', error);
        process.exit(1);
    }
}

// Get PDF path from command line
const pdfPath = process.argv[2];
if (!pdfPath) {
    console.error('❌ Please provide a PDF path as argument');
    process.exit(1);
}

analyzePDF(path.resolve(pdfPath));