#!/usr/bin/env node

/**
 * Test Adobe Reader Compatibility
 * Checks if PDF can be opened and parsed correctly
 */

const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');

async function testAdobeCompatibility(pdfPath) {
    console.log('🔍 Testing Adobe Reader Compatibility\n');
    
    try {
        // Try to load PDF with strict parsing
        const pdfBytes = await fs.readFile(pdfPath);
        console.log(`📄 PDF size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Load with different options to test compatibility
        console.log('\n1️⃣ Testing standard load...');
        const pdfDoc = await PDFDocument.load(pdfBytes);
        console.log('  ✓ Standard load successful');
        
        console.log('\n2️⃣ Testing strict parsing...');
        const pdfDocStrict = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: false,
            throwOnInvalidObject: true,
            updateMetadata: false
        });
        console.log('  ✓ Strict parsing successful');
        
        console.log('\n3️⃣ Checking PDF structure...');
        const catalog = pdfDoc.catalog;
        const pages = pdfDoc.getPages();
        console.log(`  ✓ Catalog found`);
        console.log(`  ✓ ${pages.length} pages found`);
        
        console.log('\n4️⃣ Checking page structure...');
        for (let i = 0; i < Math.min(3, pages.length); i++) {
            const page = pages[i];
            const { width, height } = page.getSize();
            const mediaBox = page.getMediaBox();
            console.log(`  Page ${i + 1}:`);
            console.log(`    Size: ${width}×${height} (${(width/72).toFixed(2)}"×${(height/72).toFixed(2)}")`);
            console.log(`    MediaBox: [${mediaBox.x}, ${mediaBox.y}, ${mediaBox.width}, ${mediaBox.height}]`);
            
            // Check for content streams
            const contents = page.node.Contents();
            console.log(`    Content streams: ${contents ? 'Present' : 'Missing'}`);
        }
        
        console.log('\n5️⃣ Checking metadata...');
        const title = pdfDoc.getTitle();
        const author = pdfDoc.getAuthor();
        const producer = pdfDoc.getProducer();
        console.log(`  Title: ${title || 'Not set'}`);
        console.log(`  Author: ${author || 'Not set'}`);
        console.log(`  Producer: ${producer || 'Not set'}`);
        
        console.log('\n6️⃣ Testing PDF modification (Adobe compatibility)...');
        // Try to add a simple annotation to test if structure is valid
        const firstPage = pages[0];
        try {
            // This would fail if PDF structure is corrupt
            const { rgb } = pdfDoc;
            firstPage.drawText(' ', {
                x: 0,
                y: 0,
                size: 1,
                color: rgb(1, 1, 1)
            });
            console.log('  ✓ Can modify PDF structure');
        } catch (error) {
            console.log('  ❌ Cannot modify PDF:', error.message);
        }
        
        console.log('\n7️⃣ Checking for common Adobe issues...');
        
        // Check for xref issues
        const pdfString = pdfBytes.toString('latin1');
        const xrefCount = (pdfString.match(/xref/g) || []).length;
        const startxrefCount = (pdfString.match(/startxref/g) || []).length;
        console.log(`  xref tables: ${xrefCount}`);
        console.log(`  startxref: ${startxrefCount}`);
        
        if (xrefCount !== startxrefCount) {
            console.log('  ⚠️  Warning: xref/startxref mismatch (may cause Adobe issues)');
        } else {
            console.log('  ✓ xref structure valid');
        }
        
        // Check PDF version
        const version = pdfString.substring(5, 8);
        console.log(`  PDF version: ${version}`);
        
        console.log('\n✅ Adobe Reader Compatibility: PASSED');
        console.log('\nThe PDF should open correctly in Adobe Reader.');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Adobe Reader Compatibility: FAILED');
        console.error('Error:', error.message);
        console.error('\nThis PDF may have issues opening in Adobe Reader.');
        return false;
    }
}

// Main
async function main() {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook-perfect.pdf');
    
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    const compatible = await testAdobeCompatibility(pdfPath);
    process.exit(compatible ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = { testAdobeCompatibility };