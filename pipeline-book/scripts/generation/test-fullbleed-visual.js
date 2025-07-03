#!/usr/bin/env node

/**
 * Visual Full Bleed Test
 * Creates a PDF with colored borders to easily see if there are margins
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function testFullBleed() {
    console.log('🎯 Creating visual full bleed test...\n');
    
    const outputPath = 'build/dist/test-fullbleed-visual.pdf';
    
    // Create HTML with visible colored borders
    const html = `<!DOCTYPE html>
<html style="margin:0;padding:0;">
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
            size: 6in 9in;
            margin: 0;
        }
        
        html, body {
            margin: 0;
            padding: 0;
        }
        
        .test-page {
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            position: relative;
            background: #333;
            page-break-after: always;
        }
        
        /* Red border indicators */
        .border-top {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 10px;
            background: red;
        }
        
        .border-bottom {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 10px;
            background: red;
        }
        
        .border-left {
            position: absolute;
            top: 0;
            left: 0;
            width: 10px;
            height: 100%;
            background: red;
        }
        
        .border-right {
            position: absolute;
            top: 0;
            right: 0;
            width: 10px;
            height: 100%;
            background: red;
        }
        
        .content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            text-align: center;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body style="margin:0;padding:0;">
    <div class="test-page">
        <div class="border-top"></div>
        <div class="border-bottom"></div>
        <div class="border-left"></div>
        <div class="border-right"></div>
        <div class="content">
            <h1>FULL BLEED TEST</h1>
            <p>If you see RED BORDERS touching all edges = FULL BLEED WORKS</p>
            <p>If you see WHITE SPACE around the red = THERE ARE MARGINS</p>
        </div>
    </div>
</body>
</html>`;
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });
        
        await page.pdf({
            path: outputPath,
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            },
            preferCSSPageSize: false
        });
        
        console.log(`✅ Test PDF created: ${outputPath}`);
        console.log('\n📋 HOW TO CHECK:');
        console.log('1. Open the PDF');
        console.log('2. Look at the edges');
        console.log('3. RED touching all edges = GOOD (full bleed works)');
        console.log('4. WHITE space around red = BAD (margins exist)');
        
        // Open the PDF
        const { exec } = require('child_process');
        exec(`open "${outputPath}"`);
        
    } finally {
        await browser.close();
    }
}

testFullBleed().catch(console.error);