#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function directPDFCheck() {
  const pdfPath = path.join(__dirname, '../build/dist/true-fullbleed-ebook.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF not found:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Checking PDF:', pdfPath);
  console.log('📏 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');

  const browser = await puppeteer.launch({
    headless: false, // Run with GUI to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();
    
    // Navigate to PDF
    const pdfUrl = `file://${pdfPath}`;
    console.log('🌐 Opening PDF in browser...');
    await page.goto(pdfUrl, { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });

    // Wait for PDF to fully load
    console.log('⏳ Waiting for PDF to fully load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to interact with the PDF viewer
    console.log('📸 Attempting to capture PDF content...');
    
    // Check if we have a PDF viewer
    const hasViewer = await page.evaluate(() => {
      return !!document.querySelector('#viewer');
    });

    if (hasViewer) {
      console.log('✅ PDF viewer detected');
      
      // Get the actual PDF page element
      const pageInfo = await page.evaluate(() => {
        const viewer = document.querySelector('#viewer');
        const pages = viewer.querySelectorAll('.page');
        return {
          totalPages: pages.length,
          firstPageDimensions: pages[0] ? {
            width: pages[0].offsetWidth,
            height: pages[0].offsetHeight
          } : null
        };
      });
      
      console.log(`📊 Total pages: ${pageInfo.totalPages}`);
      if (pageInfo.firstPageDimensions) {
        console.log(`📐 Page dimensions: ${pageInfo.firstPageDimensions.width}x${pageInfo.firstPageDimensions.height}`);
      }
    } else {
      console.log('⚠️  No standard PDF viewer detected');
    }

    console.log('\n🔍 Visual Inspection Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('The PDF has been opened in your browser.');
    console.log('Please manually check:');
    console.log('1. Page 1 - Does the cover have white borders?');
    console.log('2. Page 4 - Are there colored callout boxes?');
    console.log('3. Page 5 - Is the code syntax highlighted?');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⏸️  Browser will remain open for manual inspection...');
    console.log('Press Ctrl+C when done reviewing.');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await browser.close();
  }
}

directPDFCheck();