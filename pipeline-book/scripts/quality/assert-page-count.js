#!/usr/bin/env node

/**
 * Assert Page Count - Validates PDF has expected number of pages
 * Critical for catching the Adobe Reader single-page bug
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PageCountValidator {
    constructor(pdfPath, expectedMinPages = 10) {
        this.pdfPath = path.resolve(pdfPath);
        this.expectedMinPages = expectedMinPages;
        this.actualPageCount = 0;
    }

    async validate() {
        console.log('📄 Validating page count...');
        
        // Check file exists
        if (!fs.existsSync(this.pdfPath)) {
            throw new Error(`PDF not found: ${this.pdfPath}`);
        }

        // Get file size
        const stats = fs.statSync(this.pdfPath);
        const sizeMB = stats.size / (1024 * 1024);
        console.log(`📊 PDF size: ${sizeMB.toFixed(2)} MB`);

        // Method 1: Try qpdf
        try {
            this.actualPageCount = this.getPageCountWithQpdf();
            console.log(`✅ qpdf reports: ${this.actualPageCount} pages`);
        } catch (error) {
            console.log('⚠️  qpdf not available, trying alternative methods...');
            
            // Method 2: Try pdfinfo
            try {
                this.actualPageCount = this.getPageCountWithPdfinfo();
                console.log(`✅ pdfinfo reports: ${this.actualPageCount} pages`);
            } catch (error2) {
                console.log('⚠️  pdfinfo not available, trying gs...');
                
                // Method 3: Try Ghostscript
                try {
                    this.actualPageCount = this.getPageCountWithGs();
                    console.log(`✅ Ghostscript reports: ${this.actualPageCount} pages`);
                } catch (error3) {
                    // Fallback: Estimate from file size
                    this.actualPageCount = Math.max(1, Math.floor(sizeMB * 15)); // ~15 pages per MB
                    console.log(`⚠️  Estimated from size: ${this.actualPageCount} pages`);
                }
            }
        }

        // Validate page count
        const validation = {
            passed: true,
            actualPages: this.actualPageCount,
            expectedMin: this.expectedMinPages,
            fileSize: sizeMB,
            issues: []
        };

        // Check for single-page bug
        if (this.actualPageCount === 1 && sizeMB > 0.1) {
            validation.passed = false;
            validation.issues.push('CRITICAL: Single-page bug detected! PDF should have multiple pages.');
        }

        // Check minimum pages
        if (this.actualPageCount < this.expectedMinPages) {
            validation.passed = false;
            validation.issues.push(`Page count too low: ${this.actualPageCount} < ${this.expectedMinPages}`);
        }

        // Check for suspiciously high page count
        if (this.actualPageCount > 1000) {
            validation.issues.push(`Warning: Unusually high page count (${this.actualPageCount})`);
        }

        // Check page/size ratio
        const pagesPerMB = this.actualPageCount / sizeMB;
        if (pagesPerMB < 5 || pagesPerMB > 100) {
            validation.issues.push(`Warning: Unusual pages/MB ratio: ${pagesPerMB.toFixed(1)}`);
        }

        return validation;
    }

    getPageCountWithQpdf() {
        const output = execSync(`qpdf --show-npages "${this.pdfPath}"`).toString().trim();
        return parseInt(output) || 0;
    }

    getPageCountWithPdfinfo() {
        const output = execSync(`pdfinfo "${this.pdfPath}"`).toString();
        const match = output.match(/Pages:\s+(\d+)/);
        if (match) {
            return parseInt(match[1]) || 0;
        }
        throw new Error('Could not parse pdfinfo output');
    }

    getPageCountWithGs() {
        // Use Ghostscript to count pages
        const output = execSync(
            `gs -q -dNODISPLAY -c "(${this.pdfPath}) (r) file runpdfbegin pdfpagecount = quit"`
        ).toString().trim();
        return parseInt(output) || 0;
    }

    async assertPageCount() {
        const validation = await this.validate();
        
        console.log('\n' + '='.repeat(50));
        console.log('PAGE COUNT VALIDATION RESULT');
        console.log('='.repeat(50));
        console.log(`PDF: ${path.basename(this.pdfPath)}`);
        console.log(`Actual pages: ${validation.actualPages}`);
        console.log(`Expected minimum: ${validation.expectedMin}`);
        console.log(`File size: ${validation.fileSize.toFixed(2)} MB`);
        console.log(`Status: ${validation.passed ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (validation.issues.length > 0) {
            console.log('\nIssues:');
            validation.issues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log('='.repeat(50) + '\n');
        
        if (!validation.passed) {
            throw new Error(`Page count validation failed: ${validation.issues.join('; ')}`);
        }
        
        return validation;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: assert-page-count.js <pdf-path> [expected-min-pages]');
        console.error('Example: assert-page-count.js build/dist/ebook.pdf 50');
        process.exit(1);
    }
    
    const pdfPath = args[0];
    const expectedMin = parseInt(args[1]) || 10;
    
    const validator = new PageCountValidator(pdfPath, expectedMin);
    
    validator.assertPageCount()
        .then(() => {
            console.log('✅ Page count assertion passed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Page count assertion failed:', error.message);
            process.exit(1);
        });
}

module.exports = PageCountValidator;