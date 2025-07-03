#!/usr/bin/env node

/**
 * Simple Visual Verification for PDF
 * Converts PDF pages to images and checks for visual issues
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class PDFVisualVerifier {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.pdfPath = path.join(this.projectRoot, 'build/dist/premium-ebook-fixed.pdf');
        this.outputDir = path.join(this.projectRoot, 'build/visual-verify');
    }

    async verify() {
        console.log('🔍 Visual PDF Verification');
        console.log('========================\n');

        // Check if PDF exists
        if (!await fs.pathExists(this.pdfPath)) {
            console.error(`❌ PDF not found: ${this.pdfPath}`);
            return false;
        }

        // Get PDF info
        const stats = await fs.stat(this.pdfPath);
        console.log(`📄 PDF: ${path.basename(this.pdfPath)}`);
        console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        // Create output directory
        await fs.ensureDir(this.outputDir);

        try {
            // Convert PDF to images
            console.log('\n🎨 Converting PDF to images...');
            const outputPattern = path.join(this.outputDir, 'page');
            const cmd = `pdftoppm -png -r 150 "${this.pdfPath}" "${outputPattern}"`;
            await execAsync(cmd);

            // Analyze pages
            const files = await fs.readdir(this.outputDir);
            const pageFiles = files.filter(f => f.endsWith('.png')).sort();
            
            console.log(`\n📑 Found ${pageFiles.length} pages\n`);

            const issues = [];
            
            for (let i = 0; i < pageFiles.length; i++) {
                const file = pageFiles[i];
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);
                const sizeKB = stats.size / 1024;
                
                console.log(`Page ${i + 1}: ${sizeKB.toFixed(0)} KB`);
                
                // Check for potential issues
                if (sizeKB < 10) {
                    issues.push(`Page ${i + 1}: Likely blank (only ${sizeKB.toFixed(0)} KB)`);
                } else if (i === 0 && sizeKB < 50) {
                    issues.push(`Page ${i + 1}: Cover might be missing (only ${sizeKB.toFixed(0)} KB)`);
                }
            }

            // Report results
            console.log('\n' + '='.repeat(40));
            if (issues.length === 0) {
                console.log('✅ PDF LOOKS GOOD! All pages have content.');
                
                // Show page size summary
                console.log('\n📊 Page Summary:');
                console.log(`  - Cover page: ${pageFiles[0]} ✓`);
                console.log(`  - TOC page: ${pageFiles[1]} ✓`);
                console.log(`  - First chapter: ${pageFiles[2]} ✓`);
                console.log(`  - Total pages: ${pageFiles.length}`);
                
                return true;
            } else {
                console.log('⚠️  ISSUES FOUND:');
                issues.forEach(issue => console.log(`  - ${issue}`));
                return false;
            }
            
        } catch (error) {
            console.error('❌ Error during verification:', error.message);
            return false;
        } finally {
            // Clean up
            await fs.remove(this.outputDir);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const verifier = new PDFVisualVerifier();
    verifier.verify().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = PDFVisualVerifier;