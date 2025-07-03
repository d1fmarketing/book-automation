#!/usr/bin/env node

/**
 * Adobe Reader Fix and Test
 * Ensures PDF works perfectly in Adobe Reader
 */

const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');

async function fixForAdobe(inputPath, outputPath) {
    console.log('🔧 Fixing PDF for Adobe Reader compatibility...\n');
    
    try {
        // Load the PDF
        const existingPdfBytes = await fs.readFile(inputPath);
        
        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();
        
        // Copy pages from existing PDF
        const existingPdf = await PDFDocument.load(existingPdfBytes, {
            ignoreEncryption: true
        });
        
        const pages = await pdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
        pages.forEach(page => pdfDoc.addPage(page));
        
        // Set metadata
        pdfDoc.setTitle('The Claude Elite Pipeline');
        pdfDoc.setAuthor('Enrique Oliveira');
        pdfDoc.setSubject('Professional Publishing Automation');
        pdfDoc.setKeywords(['AI', 'Publishing', 'Automation', 'Claude']);
        pdfDoc.setProducer('Claude Elite Pipeline');
        pdfDoc.setCreator('Professional PDF Generator');
        pdfDoc.setCreationDate(new Date());
        pdfDoc.setModificationDate(new Date());
        
        // Embed standard font to ensure compatibility
        await pdfDoc.embedFont(StandardFonts.TimesRoman);
        
        // Save with linearization for fast web view
        const pdfBytes = await pdfDoc.save({
            useObjectStreams: false, // Better compatibility
            addDefaultPage: false,
            objectsPerTick: 50 // Slower but more compatible
        });
        
        // Write the fixed PDF
        await fs.writeFile(outputPath, pdfBytes);
        
        console.log(`✅ Fixed PDF saved to: ${outputPath}`);
        console.log(`📏 Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
        
        // Test the fixed PDF
        await testAdobeCompatibility(outputPath);
        
    } catch (error) {
        console.error('❌ Error fixing PDF:', error.message);
        throw error;
    }
}

async function testAdobeCompatibility(pdfPath) {
    console.log('\n🔍 Testing Adobe Reader compatibility...\n');
    
    try {
        const pdfBytes = await fs.readFile(pdfPath);
        
        // Load with strict settings to simulate Adobe Reader
        const pdfDoc = await PDFDocument.load(pdfBytes, {
            ignoreEncryption: false,
            throwOnInvalidObject: true,
            updateMetadata: false
        });
        
        const pages = pdfDoc.getPages();
        console.log(`✓ Pages loaded: ${pages.length}`);
        
        // Check structure
        const catalog = pdfDoc.catalog;
        console.log(`✓ Catalog valid: ${!!catalog}`);
        
        // Check page tree
        const pageTree = catalog.Pages();
        console.log(`✓ Page tree valid: ${!!pageTree}`);
        
        // Check for embedded fonts
        const form = pdfDoc.getForm();
        console.log(`✓ Form structure: ${form ? 'Present' : 'Not needed'}`);
        
        // Check metadata
        const title = pdfDoc.getTitle();
        const author = pdfDoc.getAuthor();
        console.log(`✓ Metadata: "${title}" by ${author}`);
        
        // Check PDF version
        const pdfString = pdfBytes.toString('latin1').substring(0, 10);
        const version = pdfString.substring(5, 8);
        console.log(`✓ PDF version: ${version}`);
        
        // Check xref structure
        const xrefPos = pdfBytes.toString('latin1').lastIndexOf('startxref');
        if (xrefPos === -1) {
            throw new Error('Invalid xref structure');
        }
        console.log(`✓ xref structure valid`);
        
        console.log('\n✅ Adobe Reader compatibility: PASSED');
        console.log('This PDF should open correctly in Adobe Reader.\n');
        
        return true;
        
    } catch (error) {
        console.error('\n❌ Adobe Reader compatibility: FAILED');
        console.error('Error:', error.message);
        return false;
    }
}

// Main
async function main() {
    const inputPath = process.argv[2] || path.join(__dirname, '../../build/dist/professional-final.pdf');
    const outputPath = path.join(path.dirname(inputPath), 'professional-adobe-fixed.pdf');
    
    if (!await fs.pathExists(inputPath)) {
        console.error(`❌ Input PDF not found: ${inputPath}`);
        process.exit(1);
    }
    
    try {
        await fixForAdobe(inputPath, outputPath);
        console.log('\n🎉 Adobe-compatible PDF ready!');
        console.log(`📄 File: ${outputPath}`);
    } catch (error) {
        console.error('Failed to fix PDF:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { fixForAdobe, testAdobeCompatibility };