#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function checkTrueFullbleedPDF() {
  const pdfPath = path.join(__dirname, '../build/dist/true-fullbleed-ebook.pdf');
  
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
    
    // 6x9 inch viewport at 96 DPI
    await page.setViewport({
      width: 576,  // 6 inches * 96 DPI
      height: 864, // 9 inches * 96 DPI
      deviceScaleFactor: 2
    });

    // Navigate to PDF
    const pdfUrl = `file://${pdfPath}`;
    console.log('🌐 Opening PDF in browser...');
    await page.goto(pdfUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    // Wait for PDF viewer to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, '../build/dist/true-fullbleed-check');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    console.log('\n📸 Taking screenshots of key pages...\n');

    // Page 1 - Cover
    console.log('Page 1 - Checking cover for white borders...');
    await page.screenshot({
      path: path.join(screenshotDir, '01-cover.png'),
      fullPage: true
    });

    // Navigate to page 4
    console.log('\nNavigating to page 4...');
    await page.evaluate(() => {
      const viewer = document.querySelector('#viewer');
      if (viewer) viewer.scrollTop = 3 * viewer.firstElementChild.offsetHeight;
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Page 4 - Checking for callout boxes...');
    await page.screenshot({
      path: path.join(screenshotDir, '04-callout-boxes.png'),
      fullPage: true
    });

    // Navigate to page 5
    console.log('\nNavigating to page 5...');
    await page.evaluate(() => {
      const viewer = document.querySelector('#viewer');
      if (viewer) viewer.scrollTop = 4 * viewer.firstElementChild.offsetHeight;
    });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Page 5 - Checking for syntax highlighting...');
    await page.screenshot({
      path: path.join(screenshotDir, '05-syntax-highlighting.png'),
      fullPage: true
    });

    // Take more screenshots
    const pagesToCheck = [10, 15, 20, 25, 30];
    for (const pageNum of pagesToCheck) {
      console.log(`\nNavigating to page ${pageNum}...`);
      await page.evaluate((num) => {
        const viewer = document.querySelector('#viewer');
        if (viewer) viewer.scrollTop = (num - 1) * viewer.firstElementChild.offsetHeight;
      }, pageNum);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await page.screenshot({
        path: path.join(screenshotDir, `${String(pageNum).padStart(2, '0')}-page.png`),
        fullPage: true
      });
    }

    console.log('\n✅ Screenshots saved to:', screenshotDir);
    console.log('\n🔍 Visual Analysis Report:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Please manually review the screenshots to check:');
    console.log('1. Cover page (01-cover.png) - Look for white borders');
    console.log('2. Page 4 (04-callout-boxes.png) - Check for colored callout boxes');
    console.log('3. Page 5 (05-syntax-highlighting.png) - Verify syntax highlighting');
    console.log('4. Other pages - General formatting and layout');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkTrueFullbleedPDF();