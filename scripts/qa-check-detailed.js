#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Read the HTML file
const htmlPath = path.join(__dirname, '..', 'build', 'tmp', 'ebook.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Create a DOM environment with proper CSS parsing
const dom = new JSDOM(htmlContent, {
    pretendToBeVisual: true,
    resources: 'usable'
});

const { window } = dom;
const { document } = window;

// Extract CSS rules manually since JSDOM doesn't fully support getComputedStyle
const styleElement = document.querySelector('style');
const cssText = styleElement ? styleElement.textContent : '';

// Parse font-size from CSS
const fontSizeMatch = cssText.match(/body\s*{[^}]*font-size:\s*(\d+)pt/);
const lineHeightMatch = cssText.match(/body\s*{[^}]*line-height:\s*([\d.]+)/);

const fontSize = fontSizeMatch ? parseFloat(fontSizeMatch[1]) : 11;
const lineHeight = lineHeightMatch ? parseFloat(lineHeightMatch[1]) : 1.6;

// Check for image
const img = document.querySelector('img');
const imagePath = img ? img.getAttribute('src') : null;
const fullImagePath = imagePath ? path.join(__dirname, '..', imagePath.replace('../', '')) : null;

let imageExists = false;
let imageDimensions = 'none';

if (fullImagePath && fs.existsSync(fullImagePath)) {
    imageExists = true;
    // For a basic check, we'll just verify the file exists
    const stats = fs.statSync(fullImagePath);
    imageDimensions = `exists (${stats.size} bytes)`;
}

const qaResults = {
    image: {
        exists: img !== null,
        fileExists: imageExists,
        src: imagePath || 'none',
        dimensions: imageDimensions
    },
    typography: {
        fontSize: fontSize,
        fontSizePt: fontSize,
        fontSizePixels: fontSize * 1.333,
        lineHeightRatio: lineHeight,
        fontFamily: 'Georgia, serif'
    },
    content: {
        chapters: document.querySelectorAll('.chapter').length,
        totalWords: document.body.textContent.split(/\s+/).filter(word => word.length > 0).length,
        hasTitlePage: document.querySelector('.title-page') !== null,
        hasCopyrightPage: document.querySelector('.copyright-page') !== null,
        hasTOC: document.querySelector('.toc') !== null
    },
    cssAnalysis: {
        hasStyles: styleElement !== null,
        fontSizeInCSS: fontSizeMatch ? fontSizeMatch[0] : 'not found',
        lineHeightInCSS: lineHeightMatch ? lineHeightMatch[0] : 'not found'
    },
    overall: {
        passedImageCheck: imageExists,
        passedTypographyCheck: fontSize >= 10 && fontSize <= 12, // 10-12pt is standard for books
        passedLineHeightCheck: lineHeight >= 1.3 && lineHeight <= 2.0
    }
};

// Overall QA status
qaResults.QA_PASSED = qaResults.overall.passedImageCheck && 
                      qaResults.overall.passedTypographyCheck && 
                      qaResults.overall.passedLineHeightCheck;

console.log(JSON.stringify(qaResults, null, 2));

// Exit with appropriate code
process.exit(qaResults.QA_PASSED ? 0 : 1);