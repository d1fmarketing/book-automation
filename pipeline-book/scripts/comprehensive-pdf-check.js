#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdf-lib').PDFDocument;

async function analyzePDF() {
  const pdfPath = path.join(__dirname, '../build/dist/premium-mcp-ebook.pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF not found:', pdfPath);
    process.exit(1);
  }

  console.log('📄 Analyzing PDF:', pdfPath);
  console.log('📏 File size:', (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2), 'MB');

  // Get total page count
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const totalPages = pdfDoc.getPageCount();
  console.log('📖 Total pages:', totalPages);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Set viewport for better visibility
    await page.setViewport({
      width: 800,
      height: 1000,
      deviceScaleFactor: 2
    });

    // Open PDF directly without viewer
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: #333; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          #pdf-container { background: white; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
          canvas { display: block; }
        </style>
      </head>
      <body>
        <div id="pdf-container">
          <canvas id="pdf-canvas"></canvas>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          let pdfDoc = null;
          let currentPage = 1;
          
          async function loadPDF(url) {
            const loadingTask = pdfjsLib.getDocument(url);
            pdfDoc = await loadingTask.promise;
            return pdfDoc.numPages;
          }
          
          async function renderPage(pageNum) {
            const page = await pdfDoc.getPage(pageNum);
            const scale = 1.5;
            const viewport = page.getViewport({ scale });
            
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            return { width: viewport.width, height: viewport.height };
          }
          
          window.loadPDF = loadPDF;
          window.renderPage = renderPage;
        </script>
      </body>
      </html>
    `;

    await page.setContent(htmlContent);
    await page.waitForFunction(() => window.loadPDF && window.renderPage);

    // Load PDF
    const pdfUrl = `file://${pdfPath}`;
    const pageCount = await page.evaluate(async (url) => {
      return await window.loadPDF(url);
    }, pdfUrl);

    // Create analysis directory
    const analysisDir = path.join(__dirname, '../build/dist/pdf-comprehensive-analysis');
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }

    const report = {
      totalPages: pageCount,
      fileSize: (fs.statSync(pdfPath).size / 1024 / 1024).toFixed(2) + ' MB',
      timestamp: new Date().toISOString(),
      pages: []
    };

    console.log('\n🔍 Analyzing each page...\n');

    // Analyze strategic pages
    const pagesToAnalyze = [
      1,  // Cover
      2,  // TOC
      3,  // First content page
      Math.floor(pageCount * 0.25),  // 25% through
      Math.floor(pageCount * 0.5),   // 50% through
      Math.floor(pageCount * 0.75),  // 75% through
      pageCount - 1,  // Second to last
      pageCount       // Last page
    ];

    // Remove duplicates and sort
    const uniquePages = [...new Set(pagesToAnalyze)].sort((a, b) => a - b).filter(p => p > 0 && p <= pageCount);

    for (const pageNum of uniquePages) {
      console.log(`Analyzing page ${pageNum}/${pageCount}...`);
      
      // Render page
      const dimensions = await page.evaluate(async (num) => {
        return await window.renderPage(num);
      }, pageNum);

      // Take screenshot
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render
      
      const screenshotPath = path.join(analysisDir, `page-${String(pageNum).padStart(3, '0')}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });

      // Analyze page content
      const pageAnalysis = await page.evaluate(() => {
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        let colorfulPixels = 0;
        let whitePixels = 0;
        let blackPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Check for white pixels (potential border)
          if (r > 250 && g > 250 && b > 250) {
            whitePixels++;
          }
          // Check for black text
          else if (r < 50 && g < 50 && b < 50) {
            blackPixels++;
          }
          // Check for colorful content (callout boxes, syntax highlighting)
          else if (Math.abs(r - g) > 30 || Math.abs(g - b) > 30 || Math.abs(r - b) > 30) {
            colorfulPixels++;
          }
        }
        
        const totalPixels = data.length / 4;
        
        return {
          hasColorfulContent: (colorfulPixels / totalPixels) > 0.01, // More than 1% colorful
          whitePercentage: ((whitePixels / totalPixels) * 100).toFixed(2),
          blackPercentage: ((blackPixels / totalPixels) * 100).toFixed(2),
          colorfulPercentage: ((colorfulPixels / totalPixels) * 100).toFixed(2)
        };
      });

      report.pages.push({
        pageNumber: pageNum,
        screenshot: path.basename(screenshotPath),
        dimensions,
        analysis: pageAnalysis,
        notes: []
      });

      // Add specific notes based on page
      if (pageNum === 1) {
        report.pages[report.pages.length - 1].notes.push('Cover page');
        if (pageAnalysis.whitePercentage > 60) {
          report.pages[report.pages.length - 1].notes.push('⚠️ High white percentage - possible white border issue');
        }
      }
      
      if (pageAnalysis.hasColorfulContent) {
        report.pages[report.pages.length - 1].notes.push('✅ Contains colorful content (callout boxes or syntax highlighting)');
      }
    }

    // Save report
    fs.writeFileSync(
      path.join(analysisDir, 'analysis-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Generate summary
    console.log('\n📊 Analysis Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Total Pages: ${pageCount}`);
    console.log(`💾 File Size: ${report.fileSize}`);
    console.log(`📸 Screenshots saved: ${uniquePages.length}`);
    
    const coverPage = report.pages.find(p => p.pageNumber === 1);
    if (coverPage) {
      console.log('\n🎨 Cover Page Analysis:');
      console.log(`   White content: ${coverPage.analysis.whitePercentage}%`);
      console.log(`   Black content: ${coverPage.analysis.blackPercentage}%`);
      console.log(`   Colorful content: ${coverPage.analysis.colorfulPercentage}%`);
      
      if (parseFloat(coverPage.analysis.whitePercentage) > 60) {
        console.log('   ⚠️  WARNING: High white percentage detected - possible white border!');
      }
    }
    
    const pagesWithColor = report.pages.filter(p => p.analysis.hasColorfulContent);
    console.log(`\n🎨 Pages with colorful content: ${pagesWithColor.length}/${uniquePages.length}`);
    
    console.log('\n📁 Full report saved to:', path.join(analysisDir, 'analysis-report.json'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

analyzePDF().catch(console.error);