#!/usr/bin/env node

const FormatterHTML = require('./agents/formatter-html.js');
const path = require('path');

async function debugImages() {
    const formatter = new FormatterHTML();
    const bookDir = 'build/ebooks/whats-one-brutal-truth-you-learned-after-starting-your-busin';
    
    const bookData = await formatter.loadBookData(bookDir);
    
    console.log('Images found:', Object.keys(bookData.images));
    console.log('Images object:', bookData.images);
    
    // Check specifically for cover
    if (bookData.images['cover.png']) {
        console.log('✅ Found cover.png');
    } else {
        console.log('❌ No cover.png found');
    }
}

debugImages();