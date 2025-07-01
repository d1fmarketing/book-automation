#!/usr/bin/env node

/**
 * Generate PDF with Live Preview Support
 * Integrates preview system with the main PDF generation workflow
 */

const PDFPreviewGenerator = require('../preview-system/pdf-preview-generator');
const path = require('path');
const fs = require('fs-extra');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    verbose: args.includes('-v') || args.includes('--verbose'),
    preset: 'main',
    enablePreview: !args.includes('--no-preview'),
    previewPort: 3001,
    outputPath: null
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--preset' || args[i] === '-p') && args[i + 1]) {
        options.preset = args[i + 1];
        i++;
    } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
        options.outputPath = args[i + 1];
        i++;
    } else if (args[i] === '--preview-port' && args[i + 1]) {
        options.previewPort = parseInt(args[i + 1]);
        i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
Usage: node generate-pdf-with-preview.js [options]

Options:
  -p, --preset <name>        Use a specific preset (default: main)
  -o, --output <path>        Custom output path for the PDF
  -v, --verbose              Show detailed output
  --no-preview               Disable live preview
  --preview-port <port>      Preview server port (default: 3001)
  -h, --help                 Show this help message

Examples:
  node generate-pdf-with-preview.js                      # Generate with preview
  node generate-pdf-with-preview.js --no-preview         # Generate without preview
  node generate-pdf-with-preview.js --preset clean -v    # Clean preset with verbose
`);
        process.exit(0);
    }
}

async function generate() {
    const startTime = Date.now();
    
    // Create default output path if not specified
    if (!options.outputPath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        options.outputPath = path.join(process.cwd(), 'build/dist', `ebook-${timestamp}.pdf`);
    }
    
    console.log('📚 Starting PDF generation with live preview...\n');
    
    try {
        // Create generator instance
        const generator = new PDFPreviewGenerator(options);
        
        // Generate PDF
        await generator.generate();
        
        // Show completion stats
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        const stats = await fs.stat(options.outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ PDF Generation Complete!');
        console.log('='.repeat(60));
        console.log(`📄 Output: ${options.outputPath}`);
        console.log(`📏 Size: ${sizeMB} MB`);
        console.log(`⏱️  Time: ${duration}s`);
        
        // Run PDF QA verification
        if (!process.env.SKIP_PDF_QA) {
            console.log('\n🔍 Running PDF quality checks...');
            const { execSync } = require('child_process');
            try {
                // Copy PDF to release directory for QA script
                const releaseDir = path.join(process.cwd(), 'release');
                await fs.ensureDir(releaseDir);
                await fs.copy(options.outputPath, path.join(releaseDir, 'ebook.pdf'));
                
                // Run QA script
                execSync('node scripts/pdf-qa-loop-real.js', { stdio: 'inherit' });
                console.log('✅ PDF quality checks passed!');
            } catch (qaError) {
                console.error('❌ PDF quality checks failed!');
                console.error('Fix the issues and run again, or use SKIP_PDF_QA=1 to bypass');
                process.exit(1);
            }
        }
        
        if (options.enablePreview) {
            console.log(`\n📺 Preview server is still running at http://localhost:${options.previewPort}`);
            console.log('   Press Ctrl+C to stop the server and exit\n');
        } else {
            process.exit(0);
        }
        
    } catch (error) {
        console.error('\n❌ Error generating PDF:', error.message);
        if (options.verbose) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
});

// Run generation
generate();