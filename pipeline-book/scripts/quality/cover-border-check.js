#!/usr/bin/env node

/**
 * Cover Border Check
 * Specifically checks for white borders on the cover
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function checkCoverBorders(pdfPath) {
    console.log('🔍 Cover Border Check\n');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set exact PDF dimensions
        await page.setViewport({
            width: 432,  // 6 inches at 72 DPI
            height: 648, // 9 inches at 72 DPI
            deviceScaleFactor: 2
        });
        
        // Load PDF
        await page.goto(`file://${path.resolve(pdfPath)}`, {
            waitUntil: 'networkidle0'
        });
        
        // Wait for PDF to render
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Take cover screenshot
        const screenshotPath = 'build/qa/cover-border-analysis.png';
        await fs.ensureDir(path.dirname(screenshotPath));
        
        await page.screenshot({
            path: screenshotPath,
            fullPage: false,
            clip: {
                x: 0,
                y: 0,
                width: 432,
                height: 648
            }
        });
        
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
        
        // Analyze the image for white borders
        const image = await loadImage(screenshotPath);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        
        // Check edges for white pixels
        const imageData = ctx.getImageData(0, 0, image.width, image.height);
        const data = imageData.data;
        
        // Check top edge
        let hasWhiteBorder = true;
        for (let x = 0; x < image.width; x++) {
            const idx = (0 * image.width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            // If any pixel is not white/near-white, no border
            if (r < 250 || g < 250 || b < 250) {
                hasWhiteBorder = false;
                break;
            }
        }
        
        if (hasWhiteBorder) {
            console.log('❌ WHITE BORDER DETECTED on top edge!');
        } else {
            console.log('✅ No white border on top edge');
        }
        
        // Check left edge
        hasWhiteBorder = true;
        for (let y = 0; y < Math.min(100, image.height); y++) {
            const idx = (y * image.width + 0) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            
            if (r < 250 || g < 250 || b < 250) {
                hasWhiteBorder = false;
                break;
            }
        }
        
        if (hasWhiteBorder) {
            console.log('❌ WHITE BORDER DETECTED on left edge!');
        } else {
            console.log('✅ No white border on left edge');
        }
        
        // Open the screenshot
        const { exec } = require('child_process');
        exec(`open "${screenshotPath}"`);
        
        console.log('\n👀 Please check the screenshot manually');
        
    } finally {
        await browser.close();
    }
}

// Run
const pdfPath = process.argv[2] || 'build/dist/premium-mcp-ebook.pdf';
checkCoverBorders(pdfPath).catch(console.error);