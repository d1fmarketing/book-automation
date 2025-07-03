#!/usr/bin/env node

/**
 * Extract ALL pages from PDF as images for visual inspection
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const execAsync = promisify(exec);

async function extractAllPages(pdfPath) {
    console.log('📄 Extracting ALL pages from PDF for inspection...\n');
    
    const outputDir = path.join('build/qa/all-pages');
    await fs.ensureDir(outputDir);
    
    // Clean previous extractions
    await fs.emptyDir(outputDir);
    
    try {
        // Use ImageMagick to extract all pages
        console.log('🔄 Converting PDF pages to images...');
        const cmd = `convert -density 150 "${pdfPath}" "${outputDir}/page-%03d.png"`;
        
        await execAsync(cmd);
        
        // List extracted pages
        const files = await fs.readdir(outputDir);
        const pageFiles = files.filter(f => f.startsWith('page-')).sort();
        
        console.log(`\n✅ Extracted ${pageFiles.length} pages\n`);
        
        // Check specific pages
        console.log('🔍 Checking key pages:\n');
        
        // Page 1 - Cover
        if (pageFiles[0]) {
            const coverPath = path.join(outputDir, pageFiles[0]);
            const stats = await fs.stat(coverPath);
            console.log(`📄 Page 1 (Cover): ${pageFiles[0]} - ${(stats.size / 1024).toFixed(0)}KB`);
            console.log(`   Path: ${coverPath}`);
        }
        
        // Page 4 - Should have callout boxes
        if (pageFiles[3]) {
            const page4Path = path.join(outputDir, pageFiles[3]);
            console.log(`📄 Page 4 (Callout boxes): ${pageFiles[3]}`);
            console.log(`   Path: ${page4Path}`);
        }
        
        // Page 5 - Should have syntax highlighting
        if (pageFiles[4]) {
            const page5Path = path.join(outputDir, pageFiles[4]);
            console.log(`📄 Page 5 (Code): ${pageFiles[4]}`);
            console.log(`   Path: ${page5Path}`);
        }
        
        console.log(`\n📁 All pages extracted to: ${path.resolve(outputDir)}`);
        console.log('👀 Please check the images manually\n');
        
        // Open the folder
        await execAsync(`open "${outputDir}"`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\nTrying alternative method with Ghostscript...\n');
        
        try {
            const gsCmd = `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -sOutputFile="${outputDir}/page-%03d.png" "${pdfPath}"`;
            await execAsync(gsCmd);
            
            const files = await fs.readdir(outputDir);
            console.log(`✅ Extracted ${files.length} pages with Ghostscript`);
            
        } catch (gsError) {
            console.error('❌ Ghostscript also failed:', gsError.message);
        }
    }
}

// Run
const pdfPath = process.argv[2] || 'build/dist/premium-mcp-ebook.pdf';
extractAllPages(pdfPath).catch(console.error);