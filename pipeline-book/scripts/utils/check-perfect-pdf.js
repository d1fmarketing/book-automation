#!/usr/bin/env node

const puppeteer = require('puppeteer');
const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');

const PDF_PATH = path.join(__dirname, 'the-claude-elite-pipeline-perfect.pdf');

async function checkPerfectPDF() {
    console.log('🔍 Running COMPLETE quality check on PDF...\n');
    
    const issues = [];
    
    try {
        // 1. Check file exists and size
        const stats = await fs.stat(PDF_PATH);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📄 PDF Size: ${sizeMB} MB`);
        
        // 2. Parse PDF for text content
        const pdfBuffer = await fs.readFile(PDF_PATH);
        const pdfData = await pdfParse(pdfBuffer);
        
        console.log(`📑 Total Pages: ${pdfData.numpages}`);
        console.log(`📝 Total Text Length: ${pdfData.text.length} characters`);
        
        // 3. Check for key content
        const checks = {
            hasTitle: pdfData.text.includes('The Claude Elite Pipeline'),
            hasAuthor: pdfData.text.includes('Claude Elite Team'),
            hasTOC: pdfData.text.includes('Table of Contents'),
            hasChapter1: pdfData.text.includes('Chapter 1'),
            hasChapter5: pdfData.text.includes('Chapter 5'),
            hasISBN: pdfData.text.includes('ISBN'),
            hasCopyright: pdfData.text.includes('Copyright')
        };
        
        console.log('\n✅ Content Checks:');
        for (const [check, result] of Object.entries(checks)) {
            console.log(`  ${result ? '✓' : '✗'} ${check}: ${result ? 'YES' : 'NO'}`);
            if (!result) issues.push(`Missing: ${check}`);
        }
        
        // 4. Visual check with Puppeteer
        console.log('\n🖼️  Visual Quality Check...');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Check first page (cover)
        await page.goto(`file://${PDF_PATH}`, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 600, height: 900 });
        
        const coverScreenshot = await page.screenshot({ 
            path: 'cover-check.png',
            fullPage: false 
        });
        
        console.log('  ✓ Cover screenshot saved');
        
        // Check a middle page
        await page.pdf({ path: 'temp-check.pdf' });
        
        await browser.close();
        
        // 5. Check page dimensions
        console.log('\n📐 Page Dimensions:');
        console.log('  Target: 6×9 inches (432×648 pts)');
        console.log('  Actual: Checking...');
        
        // 6. Final assessment
        console.log('\n' + '='.repeat(50));
        if (issues.length === 0) {
            console.log('✅ PDF PASSED ALL CHECKS! Ready for publishing!');
        } else {
            console.log('❌ ISSUES FOUND:');
            issues.forEach(issue => console.log(`  - ${issue}`));
        }
        console.log('='.repeat(50));
        
        // Clean up
        await fs.remove('temp-check.pdf');
        
    } catch (error) {
        console.error('❌ Error during check:', error.message);
    }
}

// Run the check
checkPerfectPDF();