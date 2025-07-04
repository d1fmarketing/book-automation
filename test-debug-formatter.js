#!/usr/bin/env node

const path = require('path');

// Test the formatter
async function testFormatter() {
    try {
        // Import the formatter
        const FormatterHTML = require('./agents/formatter-html.js');
        const formatter = new FormatterHTML({
            template: 'professional',
            format: 'single'
        });
        
        // Use the actual book directory
        const bookDir = 'build/ebooks/whats-one-brutal-truth-you-learned-after-starting-your-busin';
        
        console.log('Testing formatter with book dir:', bookDir);
        
        // Test loading book data
        const bookData = await formatter.loadBookData(bookDir);
        
        console.log('\n=== Metadata ===');
        console.log(JSON.stringify(bookData.metadata, null, 2));
        
        console.log('\n=== Chapters loaded ===');
        console.log(`Total chapters: ${bookData.chapters.length}`);
        
        // Check first chapter
        if (bookData.chapters.length > 0) {
            const firstChapter = bookData.chapters[0];
            console.log('\n=== First Chapter ===');
            console.log('Filename:', firstChapter.filename);
            console.log('Frontmatter:', firstChapter.frontmatter);
            console.log('Content length:', firstChapter.content.length);
            console.log('HTML length:', firstChapter.html.length);
            console.log('TOC items:', firstChapter.toc.length);
            
            // Check for problematic content
            if (firstChapter.html.includes('[object Object]')) {
                console.log('\n⚠️  WARNING: HTML contains [object Object]');
            }
            
            // Check TOC for duplicate
            console.log('\n=== TOC Structure ===');
            firstChapter.toc.forEach((item, i) => {
                console.log(`${i}: Level ${item.level} - ${item.text} (#${item.slug})`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testFormatter();