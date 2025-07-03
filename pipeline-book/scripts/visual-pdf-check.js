#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function checkPDF() {
  const pdfPath = path.join(__dirname, '../build/dist/premium-mcp-ebook.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF not found:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Checking PDF:', pdfPath);
  console.log('📏 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport to match PDF dimensions
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });

    // Navigate to PDF
    const pdfUrl = `file://${pdfPath}`;
    await page.goto(pdfUrl, { waitUntil: 'networkidle0' });

    // Wait for PDF to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, '../build/dist/pdf-visual-check');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log('\n📸 Taking screenshots of key pages...\n');

    // Check cover page
    console.log('Page 1 - Cover:');
    await page.screenshot({
      path: path.join(screenshotDir, 'page-01-cover.png'),
      fullPage: false
    });
    console.log('✅ Screenshot saved');

    // Navigate through pages using PDF.js viewer controls
    // Check for specific pages with code blocks and callout boxes
    const pagesToCheck = [
      { page: 2, name: 'TOC' },
      { page: 5, name: 'Chapter-1' },
      { page: 10, name: 'Code-Example' },
      { page: 15, name: 'Mid-Content' },
      { page: 20, name: 'Later-Content' }
    ];

    for (const pageInfo of pagesToCheck) {
      try {
        // Navigate to specific page
        await page.evaluate((pageNum) => {
          if (window.PDFViewerApplication) {
            window.PDFViewerApplication.pdfViewer.currentPageNumber = pageNum;
          }
        }, pageInfo.page);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`\nPage ${pageInfo.page} - ${pageInfo.name}:`);
        await page.screenshot({
          path: path.join(screenshotDir, `page-${String(pageInfo.page).padStart(2, '0')}-${pageInfo.name.toLowerCase()}.png`),
          fullPage: false
        });
        console.log('✅ Screenshot saved');
      } catch (err) {
        console.log(`⚠️  Could not navigate to page ${pageInfo.page}`);
      }
    }

    console.log('\n📊 Visual Check Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PDF opened successfully');
    console.log('📸 Screenshots saved to:', screenshotDir);
    console.log('\n🔍 Please manually review the screenshots to check:');
    console.log('   1. Cover page - white border presence');
    console.log('   2. Callout boxes - colored backgrounds');
    console.log('   3. Code blocks - syntax highlighting');
    console.log('   4. Overall formatting and layout');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkPDF().catch(console.error);