#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function viewPDFWithMCP() {
    const pdfUrl = 'http://localhost:8080/pdfjs/web/viewer.html?file=/dist/tdah-descomplicado-colorful.pdf';
    
    console.log('🚀 Opening PDF with browser control...');
    
    // Launch browser in non-headless mode so we can see it
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    
    console.log('📄 Loading PDF viewer...');
    await page.goto(pdfUrl, { waitUntil: 'networkidle2' });
    
    // Wait for PDF.js to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('👀 Browser is open. I can now see the PDF.');
    console.log('📋 Analyzing each page...\n');
    
    // Function to analyze current page
    const analyzePage = async (pageNum) => {
        console.log(`\n📖 Analyzing page ${pageNum}...`);
        
        // Navigate to specific page
        await page.evaluate((num) => {
            window.PDFViewerApplication.pdfViewer.currentPageNumber = num;
        }, pageNum);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get page dimensions and check for issues
        const pageAnalysis = await page.evaluate(() => {
            const viewer = document.getElementById('viewer');
            const currentPage = viewer.querySelector('.page.selected');
            
            if (!currentPage) return null;
            
            const canvas = currentPage.querySelector('canvas');
            const textLayer = currentPage.querySelector('.textLayer');
            
            return {
                pageWidth: currentPage.offsetWidth,
                pageHeight: currentPage.offsetHeight,
                canvasWidth: canvas ? canvas.width : 0,
                canvasHeight: canvas ? canvas.height : 0,
                hasTextOverlap: false, // We'll check this visually
                viewerWidth: viewer.offsetWidth,
                viewerHeight: viewer.offsetHeight
            };
        });
        
        console.log('Page dimensions:', pageAnalysis);
        
        // Take a screenshot for reference
        const screenshotPath = path.join(__dirname, `../build/dist/mcp-view-page-${pageNum}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved: ${screenshotPath}`);
        
        return pageAnalysis;
    };
    
    // Analyze key pages
    const pagesToCheck = [1, 2, 3, 5, 10, 15, 20, 30, 40];
    
    for (const pageNum of pagesToCheck) {
        await analyzePage(pageNum);
        
        // Pause to allow manual inspection
        console.log('⏸️  Pausing for manual inspection...');
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log('\n🔍 Visual inspection complete.');
    console.log('📝 Issues identified:');
    console.log('- Need to check spacing issues');
    console.log('- Need to check text overlap');
    console.log('- Need to check white space around pages');
    
    console.log('\n⏳ Browser will remain open for 60 seconds for manual verification...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    
    await browser.close();
}

viewPDFWithMCP().catch(console.error);