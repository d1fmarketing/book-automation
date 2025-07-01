#!/usr/bin/env node
// Deep PDF content and formatting analysis

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function deepPDFAnalysis() {
    const pdfPath = path.join(__dirname, '..', 'pipeline-book', 'the-claude-elite-pipeline-professional.pdf');
    const tempDir = path.join(__dirname, '..', 'build', 'pdf-text-extract');
    
    console.log('🔬 Deep PDF Analysis\n');
    
    try {
        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });
        
        // 1. Basic structure analysis
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        
        console.log('📄 PDF Structure:');
        console.log(`- Total pages: ${pages.length}`);
        console.log(`- File size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`- Title: ${pdfDoc.getTitle() || 'Not set'}`);
        console.log(`- Author: ${pdfDoc.getAuthor() || 'Not set'}`);
        console.log(`- Creator: ${pdfDoc.getCreator() || 'Not set'}`);
        
        // 2. Extract text from key pages using pdftotext
        console.log('\n📝 Extracting text from key pages...\n');
        
        const pagesToAnalyze = [
            { page: 1, name: 'Cover Page' },
            { page: 2, name: 'Table of Contents' },
            { page: 5, name: 'Chapter 1 Start' },
            { page: 10, name: 'Mid-Chapter Content' },
            { page: 20, name: 'Chapter Transition' }
        ];
        
        for (const { page, name } of pagesToAnalyze) {
            if (page <= pages.length) {
                try {
                    // Extract specific page text
                    const textFile = path.join(tempDir, `page-${page}.txt`);
                    await execPromise(`pdftotext -f ${page} -l ${page} "${pdfPath}" "${textFile}" 2>/dev/null || echo "pdftotext not available"`);
                    
                    // Read extracted text
                    let pageText = '';
                    try {
                        pageText = await fs.readFile(textFile, 'utf-8');
                    } catch (e) {
                        // If pdftotext failed, note it
                        pageText = '[Text extraction requires pdftotext tool]';
                    }
                    
                    console.log(`📄 ${name} (Page ${page}):`);
                    
                    if (pageText.trim()) {
                        // Show first 200 chars
                        const preview = pageText.trim().substring(0, 200).replace(/\n+/g, ' ');
                        console.log(`   Text preview: "${preview}..."`);
                        
                        // Analyze formatting
                        const lines = pageText.split('\n').filter(l => l.trim());
                        console.log(`   - Lines of text: ${lines.length}`);
                        console.log(`   - Empty lines: ${pageText.split('\n').length - lines.length}`);
                        
                        // Check for common issues
                        if (page === 1 && lines.length < 5) {
                            console.log('   ⚠️  Cover page has very little text - check if image is present');
                        }
                        
                        if (name.includes('Table of Contents')) {
                            const chapterRefs = lines.filter(l => l.match(/Chapter \d+|^\d+\./));
                            console.log(`   - Chapter references found: ${chapterRefs.length}`);
                        }
                    } else {
                        console.log('   ⚠️  No text extracted - page might be image-only or empty');
                    }
                    
                    console.log('');
                    
                } catch (error) {
                    console.log(`   ❌ Error extracting page: ${error.message}`);
                }
            }
        }
        
        // 3. Font analysis using complex PDF parsing
        console.log('🔤 Font Analysis:');
        console.log('Note: Full font analysis requires specialized PDF tools\n');
        
        // 4. Image detection
        console.log('🖼️  Image Analysis:');
        try {
            // Try to count images using pdfimages
            const { stdout } = await execPromise(`pdfimages -list "${pdfPath}" 2>/dev/null | grep -E '^[[:space:]]*[0-9]+' | wc -l || echo "0"`);
            const imageCount = parseInt(stdout.trim()) || 0;
            console.log(`- Total images found: ${imageCount}`);
            
            if (imageCount === 0) {
                console.log('  ⚠️  No embedded images detected - cover might be missing');
            }
        } catch (e) {
            console.log('- Image detection requires pdfimages tool');
        }
        
        // 5. Issues summary
        console.log('\n🔍 Quality Check Summary:\n');
        
        const issues = [];
        const warnings = [];
        const successes = [];
        
        // Check page size
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        if (width === 432 && height === 648) {
            successes.push('✅ Page size correct (6×9 inches)');
        } else {
            issues.push(`❌ Page size incorrect: ${(width/72).toFixed(1)}×${(height/72).toFixed(1)} inches (expected 6×9)`);
        }
        
        // Check metadata
        if (!pdfDoc.getTitle()) {
            warnings.push('⚠️  PDF title metadata not set');
        }
        if (!pdfDoc.getAuthor()) {
            warnings.push('⚠️  PDF author metadata not set');
        }
        
        // Page count
        if (pages.length < 10) {
            warnings.push(`⚠️  Very short book (${pages.length} pages)`);
        } else {
            successes.push(`✅ Good length (${pages.length} pages)`);
        }
        
        // File size
        const fileSizeMB = pdfBytes.length / 1024 / 1024;
        if (fileSizeMB > 10) {
            warnings.push(`⚠️  Large file size (${fileSizeMB.toFixed(2)} MB) - consider optimization`);
        } else {
            successes.push(`✅ Reasonable file size (${fileSizeMB.toFixed(2)} MB)`);
        }
        
        // Print results
        console.log('Successes:');
        successes.forEach(s => console.log(`  ${s}`));
        
        if (warnings.length > 0) {
            console.log('\nWarnings:');
            warnings.forEach(w => console.log(`  ${w}`));
        }
        
        if (issues.length > 0) {
            console.log('\nIssues:');
            issues.forEach(i => console.log(`  ${i}`));
        }
        
        // Recommendations
        console.log('\n📋 Recommendations:');
        console.log('1. Manually review the screenshots in build/pdf-analysis/');
        console.log('2. Check cover image quality and appeal');
        console.log('3. Verify table of contents has proper page numbers');
        console.log('4. Ensure chapter headings are consistent');
        console.log('5. Check for any blank or poorly formatted pages');
        console.log('6. Verify fonts are embedded and render correctly');
        
        // Clean up
        try {
            await fs.rm(tempDir, { recursive: true });
        } catch (e) {
            // Ignore cleanup errors
        }
        
    } catch (error) {
        console.error('❌ Analysis error:', error.message);
    }
}

// Run analysis
deepPDFAnalysis();