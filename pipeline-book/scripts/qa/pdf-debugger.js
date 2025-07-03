#!/usr/bin/env node

/**
 * PDF Debugger - Analyzes exact PDF structure and dimensions
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');

async function debugPDF(pdfPath) {
    console.log('🔍 PDF Debug Analysis\n');
    console.log(`File: ${pdfPath}\n`);
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    
    console.log(`Total pages: ${pages.length}\n`);
    
    // Analyze each page
    for (let i = 0; i < Math.min(5, pages.length); i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const mediaBox = page.getMediaBox();
        const cropBox = page.getCropBox();
        const bleedBox = page.getBleedBox();
        const trimBox = page.getTrimBox();
        
        console.log(`Page ${i + 1}:`);
        console.log(`  Size: ${width} × ${height} points (${(width/72).toFixed(2)}" × ${(height/72).toFixed(2)}")`);
        console.log(`  MediaBox: [${mediaBox.x}, ${mediaBox.y}, ${mediaBox.width}, ${mediaBox.height}]`);
        console.log(`  CropBox: [${cropBox.x}, ${cropBox.y}, ${cropBox.width}, ${cropBox.height}]`);
        console.log(`  BleedBox: [${bleedBox.x}, ${bleedBox.y}, ${bleedBox.width}, ${bleedBox.height}]`);
        console.log(`  TrimBox: [${trimBox.x}, ${trimBox.y}, ${trimBox.width}, ${trimBox.height}]`);
        
        // Check rotation
        const rotation = page.getRotation();
        if (rotation.angle !== 0) {
            console.log(`  ⚠️  Rotation: ${rotation.angle}°`);
        }
        
        console.log('');
    }
    
    // Check for embedded fonts
    const fonts = pdfDoc.embedStandardFont ? 'Standard fonts' : 'No embedded fonts';
    console.log(`Fonts: ${fonts}`);
    
    // Check producer
    console.log(`\nPDF Producer: ${pdfDoc.getProducer() || 'Unknown'}`);
    console.log(`PDF Creator: ${pdfDoc.getCreator() || 'Unknown'}`);
    
    return pages[0].getSize();
}

// Run
const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook-perfect.pdf');
debugPDF(pdfPath).catch(console.error);