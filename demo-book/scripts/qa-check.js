#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Read the HTML file
const htmlPath = path.join(__dirname, '..', 'build', 'tmp', 'ebook.html');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// Create a DOM environment
const dom = new JSDOM(htmlContent, {
    resources: 'usable',
    runScripts: 'dangerously'
});

const { window } = dom;
const { document } = window;

// Wait for images to load
setTimeout(() => {
    // Final comprehensive QA check
    const img = document.querySelector('img');
    const style = window.getComputedStyle(document.body);

    const qaResults = {
        image: {
            exists: img !== null,
            loaded: img && img.complete && img.naturalHeight > 0,
            src: img ? img.src : 'none',
            dimensions: img ? `${img.naturalWidth}x${img.naturalHeight}` : 'none'
        },
        typography: {
            fontSize: parseFloat(style.fontSize),
            fontSizePt: parseFloat(style.fontSize) * 0.75,
            lineHeightRatio: style.lineHeight === 'normal' ? 1.2 : parseFloat(style.lineHeight) / parseFloat(style.fontSize),
            fontFamily: style.fontFamily
        },
        content: {
            chapters: document.querySelectorAll('.chapter').length,
            totalWords: document.body.textContent.split(/\s+/).filter(word => word.length > 0).length
        },
        overall: {
            passedImageCheck: img && img.complete && img.naturalHeight > 0,
            passedTypographyCheck: parseFloat(style.fontSize) >= 14 && parseFloat(style.fontSize) <= 20,
            passedLineHeightCheck: (style.lineHeight === 'normal' ? 1.2 : parseFloat(style.lineHeight) / parseFloat(style.fontSize)) >= 1.3
        }
    };

    // Overall QA status
    qaResults.QA_PASSED = qaResults.overall.passedImageCheck && 
                          qaResults.overall.passedTypographyCheck && 
                          qaResults.overall.passedLineHeightCheck;

    console.log(JSON.stringify(qaResults, null, 2));
    
    // Exit with appropriate code
    process.exit(qaResults.QA_PASSED ? 0 : 1);
}, 1000);