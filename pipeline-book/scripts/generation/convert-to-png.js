#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');

async function convertSVGtoPNG() {
    console.log('🔄 Converting SVGs to high-quality PNGs...\n');
    
    const svgFiles = [
        'cover-horizontal.svg',
        'chapter-01-architecture-horizontal.svg',
        'chapter-02-quality-horizontal.svg',
        'chapter-03-assistant-horizontal.svg',
        'chapter-04-publishing-horizontal.svg',
        'chapter-05-future-horizontal.svg'
    ];
    
    for (const svgFile of svgFiles) {
        try {
            const svgPath = path.join(__dirname, svgFile);
            const pngFile = svgFile.replace('.svg', '.png');
            const pngPath = path.join(__dirname, pngFile);
            
            // Read SVG
            const svgBuffer = await fs.readFile(svgPath);
            
            // Convert to PNG with high quality
            await sharp(svgBuffer)
                .png({ quality: 100, compressionLevel: 6 })
                .resize(1920, 1080, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .toFile(pngPath);
            
            console.log(`✅ Converted: ${svgFile} → ${pngFile}`);
            
            // Also create a smaller version for the ebook
            const ebookPath = path.join(__dirname, pngFile.replace('.png', '-ebook.png'));
            await sharp(svgBuffer)
                .png({ quality: 90, compressionLevel: 9 })
                .resize(1200, 675, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .toFile(ebookPath);
            
            console.log(`   📚 Ebook version: ${pngFile.replace('.png', '-ebook.png')}`);
            
        } catch (error) {
            console.error(`❌ Failed to convert ${svgFile}:`, error.message);
        }
    }
    
    console.log('\n✨ All images converted to PNG!');
}

convertSVGtoPNG();