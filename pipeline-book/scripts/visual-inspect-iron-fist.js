const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

async function visualInspectPDF() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const pdfUrl = `file://${pdfPath}`;
    const outputDir = path.join(__dirname, '../build/iron-fist-visual');
    
    console.log('Visual Inspection of Iron Fist PDF...');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    const browser = await puppeteer.launch({
        headless: false, // Show browser for manual inspection
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--enable-features=PdfOopif' // Enable PDF features
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        // Set a good viewport for PDF viewing
        await page.setViewport({
            width: 1400,
            height: 900,
            deviceScaleFactor: 2
        });
        
        console.log('Opening PDF in browser...');
        await page.goto(pdfUrl, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Wait for PDF to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Take screenshots
        console.log('Taking screenshots...');
        
        // Full page screenshot
        const fullScreenshot = path.join(outputDir, 'full-view.png');
        await page.screenshot({ 
            path: fullScreenshot,
            fullPage: false
        });
        console.log(`Screenshot saved: ${fullScreenshot}`);
        
        // Try to interact with PDF controls
        console.log('\nAttempting to capture individual pages...');
        
        // Take screenshots while navigating
        const screenshots = [];
        for (let i = 0; i < 5; i++) {
            const screenshotPath = path.join(outputDir, `navigation-${i}.png`);
            await page.screenshot({ path: screenshotPath });
            screenshots.push(screenshotPath);
            
            // Try different navigation methods
            if (i < 4) {
                await page.keyboard.press('ArrowDown');
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        // Generate inspection report
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath: pdfPath,
            pdfUrl: pdfUrl,
            screenshotsDirectory: outputDir,
            screenshots: screenshots,
            inspectionNotes: [
                'Check for white borders around pages',
                'Verify cover image is full-bleed (no margins)',
                'Look for missing or broken images',
                'Check text alignment and overflow',
                'Verify page dimensions appear as 6x9 inches',
                'Look for any rendering glitches or artifacts'
            ]
        };
        
        await fs.writeFile(
            path.join(outputDir, 'inspection-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n=== VISUAL INSPECTION CHECKLIST ===');
        console.log('\nPlease manually check the PDF in the browser window for:');
        console.log('\n1. COVER PAGE (Page 1):');
        console.log('   - Should have full-bleed image (no white borders)');
        console.log('   - Image should extend to all edges');
        console.log('   - No margin or padding visible');
        
        console.log('\n2. INTERIOR PAGES:');
        console.log('   - Proper margins (should have some white space)');
        console.log('   - Text should not overflow or be cut off');
        console.log('   - Images should be properly positioned');
        console.log('   - No broken image placeholders');
        
        console.log('\n3. OVERALL QUALITY:');
        console.log('   - Page size should be 6x9 inches');
        console.log('   - No rendering artifacts');
        console.log('   - Professional appearance');
        console.log('   - Would work in Adobe Acrobat');
        
        console.log('\n4. NAVIGATION:');
        console.log('   - Use Page Up/Down or scroll to view all 9 pages');
        console.log('   - Check each page carefully');
        
        console.log(`\nScreenshots saved in: ${outputDir}`);
        console.log('\nBrowser will remain open for manual inspection.');
        console.log('Press Ctrl+C when done reviewing.');
        
        // Keep browser open
        await new Promise(() => {});
        
    } catch (error) {
        console.error('Error during inspection:', error);
        await browser.close();
        throw error;
    }
}

visualInspectPDF().catch(console.error);