#!/usr/bin/env node

/**
 * MCP Full PDF Check
 * Uses MCP to visually verify the entire PDF
 */

const fs = require('fs-extra');
const path = require('path');

async function checkWithMCP(pdfPath) {
    const fullPath = path.resolve(pdfPath);
    
    console.log('🔍 MCP Full PDF Visual Check');
    console.log('============================\n');
    console.log(`PDF: ${fullPath}\n`);
    
    // Create a simple HTML that embeds the PDF
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>PDF Visual Check</title>
    <style>
        body { margin: 0; padding: 20px; background: #f0f0f0; }
        h1 { font-family: Arial, sans-serif; }
        .checks { font-family: Arial, sans-serif; margin: 20px 0; }
        .check { margin: 10px 0; padding: 10px; background: white; border-radius: 5px; }
        .check h3 { margin: 0 0 5px 0; color: #333; }
        .pdf-viewer { width: 100%; height: 800px; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>PDF Visual Verification</h1>
    
    <div class="checks">
        <div class="check">
            <h3>❓ Page 1 - Cover</h3>
            <p>CHECK: Are there WHITE BORDERS around the cover image?</p>
        </div>
        
        <div class="check">
            <h3>❓ Page 4 - Visual Features</h3>
            <p>CHECK: Do you see COLORED CALLOUT BOXES with gradients?</p>
        </div>
        
        <div class="check">
            <h3>❓ Page 5 - Code</h3>
            <p>CHECK: Is the code SYNTAX HIGHLIGHTED with colors?</p>
        </div>
        
        <div class="check">
            <h3>❓ Overall Quality</h3>
            <p>CHECK: Does the PDF look professional throughout?</p>
        </div>
    </div>
    
    <iframe src="${fullPath}" class="pdf-viewer"></iframe>
    
    <script>
        // Log page info
        console.log('PDF loaded:', '${fullPath}');
    </script>
</body>
</html>`;
    
    const checkHtmlPath = path.join('build/qa/mcp-pdf-check.html');
    await fs.writeFile(checkHtmlPath, htmlContent);
    
    console.log('📄 Created visual check HTML');
    console.log(`📍 Path: ${path.resolve(checkHtmlPath)}\n`);
    
    console.log('🤖 Please use MCP to:');
    console.log('1. Open the HTML file in browser');
    console.log('2. Scroll through the PDF');
    console.log('3. Answer the verification questions');
    console.log('4. Report any issues found\n');
    
    console.log('HTML file path for MCP:');
    console.log(path.resolve(checkHtmlPath));
}

// Run
const pdfPath = process.argv[2] || 'build/dist/true-fullbleed-ebook.pdf';
checkWithMCP(pdfPath).catch(console.error);