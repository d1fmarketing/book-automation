#!/usr/bin/env node

/**
 * Test script for the live preview system
 */

const PDFPreviewGenerator = require('./pdf-preview-generator');
const path = require('path');

async function testPreview() {
    console.log('🧪 Testing PDF Preview System...\n');
    
    // Create generator with preview enabled
    const generator = new PDFPreviewGenerator({
        verbose: true,
        enablePreview: true,
        previewPort: 3001,
        outputPath: path.join(process.cwd(), 'build/dist/test-preview.pdf')
    });
    
    try {
        // Generate PDF with live preview
        await generator.generate();
        
        console.log('\n✅ Preview test completed!');
        console.log('   Keep the preview server running to view the result');
        console.log('   Press Ctrl+C to exit\n');
        
    } catch (error) {
        console.error('❌ Preview test failed:', error);
        process.exit(1);
    }
}

// Run test
testPreview();