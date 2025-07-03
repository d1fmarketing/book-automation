#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  const pdfPath = path.join(__dirname, '../build/dist/premium-mcp-ebook.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF not found:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Taking screenshots of PDF:', pdfPath);
  console.log('📏 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Larger viewport for better screenshots
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1
    });

    // Navigate to PDF using file protocol
    const pdfUrl = `file://${pdfPath}`;
    console.log('🌐 Opening PDF in browser...');
    await page.goto(pdfUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait for PDF viewer to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, '../build/dist/pdf-page-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Take initial screenshot to verify PDF loaded
    console.log('\n📸 Taking screenshots...\n');
    
    // Screenshot of current view (should be page 1)
    console.log('Page 1 - Cover:');
    await page.screenshot({
      path: path.join(screenshotDir, 'page-001-cover.png'),
      fullPage: false
    });
    console.log('✅ Saved');

    // Try to navigate through PDF using keyboard shortcuts
    const pagesToCapture = [
      { num: 1, name: 'cover' },
      { num: 2, name: 'toc' },
      { num: 5, name: 'early-content' },
      { num: 10, name: 'chapter-content' },
      { num: 20, name: 'mid-content' },
      { num: 40, name: 'late-content' },
      { num: 60, name: 'near-end' },
      { num: 88, name: 'last-page' }
    ];

    // Skip first page since we already captured it
    for (let i = 1; i < pagesToCapture.length; i++) {
      const pageInfo = pagesToCapture[i];
      console.log(`\nNavigating to page ${pageInfo.num}...`);
      
      try {
        // Try to use PDF.js API if available
        const navigated = await page.evaluate((targetPage) => {
          if (window.PDFViewerApplication && window.PDFViewerApplication.pdfViewer) {
            window.PDFViewerApplication.pdfViewer.currentPageNumber = targetPage;
            return true;
          }
          return false;
        }, pageInfo.num);

        if (!navigated) {
          console.log('⚠️  Could not navigate programmatically');
          // Try keyboard navigation as fallback
          for (let j = 1; j < pageInfo.num; j++) {
            await page.keyboard.press('ArrowDown');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`Page ${pageInfo.num} - ${pageInfo.name}:`);
        await page.screenshot({
          path: path.join(screenshotDir, `page-${String(pageInfo.num).padStart(3, '0')}-${pageInfo.name}.png`),
          fullPage: false
        });
        console.log('✅ Saved');
      } catch (err) {
        console.log(`❌ Error capturing page ${pageInfo.num}: ${err.message}`);
      }
    }

    console.log('\n📊 Screenshot Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Screenshots saved to:', screenshotDir);
    console.log('\n🔍 Manual Review Instructions:');
    console.log('1. Check cover page for white borders');
    console.log('2. Look for colorful callout boxes in content pages');
    console.log('3. Verify syntax highlighting in code blocks');
    console.log('4. Check overall formatting and readability');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Now let's analyze the cover page screenshot
    console.log('\n🔍 Analyzing cover page...');
    const coverScreenshot = path.join(screenshotDir, 'page-001-cover.png');
    if (fs.existsSync(coverScreenshot)) {
      const size = fs.statSync(coverScreenshot).size;
      console.log(`Cover screenshot size: ${(size / 1024).toFixed(2)} KB`);
      if (size < 50 * 1024) {
        console.log('⚠️  WARNING: Cover screenshot is suspiciously small!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);