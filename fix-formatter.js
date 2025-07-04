#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function fixFormatter() {
    try {
        const bookDir = 'build/ebooks/whats-one-brutal-truth-you-learned-after-starting-your-busin';
        
        // 1. Remove duplicate files
        console.log('🧹 Cleaning up duplicate files...');
        const files = await fs.readdir(bookDir);
        const toDelete = files.filter(f => f.includes('-affiliate'));
        
        for (const file of toDelete) {
            const filePath = path.join(bookDir, file);
            await fs.unlink(filePath);
            console.log(`   Removed: ${file}`);
        }
        
        // 2. Run formatter again
        console.log('\n📄 Running formatter...');
        const FormatterHTML = require('./agents/formatter-html.js');
        const formatter = new FormatterHTML({
            template: 'professional',
            format: 'single'
        });
        
        const result = await formatter.formatBook(bookDir);
        
        if (result.success) {
            console.log('✅ Formatting complete!');
            console.log(`   Output: ${result.outputDir}`);
            
            // Check if the HTML still has issues
            const htmlPath = path.join(result.outputDir, 'index.html');
            const html = await fs.readFile(htmlPath, 'utf8');
            
            console.log('\n🔍 Checking for issues...');
            const hasObjectIssue = html.includes('[object Object]');
            const hasHundefined = html.includes('<hundefined');
            const hasUntitled = html.includes('Untitled Book');
            
            if (!hasObjectIssue && !hasHundefined && !hasUntitled) {
                console.log('✅ All issues fixed!');
                
                // Copy to Downloads
                const destPath = '/Users/d1f/Downloads/brutal-truth-ebook-clean.html';
                await fs.copyFile(htmlPath, destPath);
                console.log(`\n📁 Clean file saved to: ${destPath}`);
            } else {
                console.log('❌ Issues still present:');
                if (hasObjectIssue) console.log('   - [object Object] found');
                if (hasHundefined) console.log('   - <hundefined> tags found');
                if (hasUntitled) console.log('   - "Untitled Book" found');
            }
        } else {
            console.error('❌ Formatting failed:', result.error);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixFormatter();