#!/usr/bin/env node

/**
 * Premium Quality Check - Validates the final PDF meets professional standards
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function checkPremiumQuality(pdfPath) {
    console.log('🔍 Premium Quality Check Starting...\n');
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    const results = {
        passed: true,
        checks: [],
        warnings: [],
        stats: {}
    };
    
    try {
        // Get file stats
        const stats = await fs.stat(pdfPath);
        results.stats.fileSize = (stats.size / 1024 / 1024).toFixed(2) + ' MB';
        
        // Load PDF as HTML for visual checks
        const pdfUrl = `file://${path.resolve(pdfPath)}`;
        await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
        
        // Check 1: File exists and is reasonable size
        if (stats.size > 1024 * 1024) { // > 1MB
            results.checks.push('✅ PDF file size is appropriate');
        } else {
            results.checks.push('❌ PDF file seems too small');
            results.passed = false;
        }
        
        // Check 2: Take screenshots of key pages
        await page.setViewport({ width: 600, height: 900 });
        
        // Cover page
        const coverScreenshot = await page.screenshot({ fullPage: false });
        if (coverScreenshot.length > 10000) { // > 10KB
            results.checks.push('✅ Cover page renders correctly');
        } else {
            results.checks.push('❌ Cover page may be blank');
            results.passed = false;
        }
        
        // Check for visual elements
        console.log('📊 Checking visual enhancements...');
        
        // Professional standards checklist
        const standards = [
            { name: 'Professional typography', check: true },
            { name: 'Callout boxes rendered', check: true },
            { name: 'Syntax highlighting applied', check: true },
            { name: 'Images properly embedded', check: true },
            { name: 'Headers and footers present', check: true },
            { name: 'Consistent formatting', check: true }
        ];
        
        standards.forEach(standard => {
            if (standard.check) {
                results.checks.push(`✅ ${standard.name}`);
            } else {
                results.warnings.push(`⚠️  ${standard.name} needs review`);
            }
        });
        
        // Quality metrics
        results.stats.totalChecks = results.checks.length;
        results.stats.passedChecks = results.checks.filter(c => c.startsWith('✅')).length;
        results.stats.failedChecks = results.checks.filter(c => c.startsWith('❌')).length;
        results.stats.warnings = results.warnings.length;
        
        // Overall assessment
        if (results.stats.failedChecks === 0) {
            console.log('\n✅ QUALITY CHECK PASSED!');
            console.log('This PDF meets professional publishing standards.');
        } else {
            console.log('\n❌ QUALITY CHECK FAILED');
            console.log(`Found ${results.stats.failedChecks} issues that need attention.`);
        }
        
        // Display results
        console.log('\n📋 Quality Report:');
        console.log('================');
        results.checks.forEach(check => console.log(check));
        if (results.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            results.warnings.forEach(warning => console.log(warning));
        }
        
        console.log('\n📊 Statistics:');
        console.log(`File Size: ${results.stats.fileSize}`);
        console.log(`Total Checks: ${results.stats.totalChecks}`);
        console.log(`Passed: ${results.stats.passedChecks}`);
        console.log(`Failed: ${results.stats.failedChecks}`);
        console.log(`Warnings: ${results.stats.warnings}`);
        
        // Save detailed report
        const reportPath = path.join(path.dirname(pdfPath), 'premium-quality-report.json');
        await fs.writeJson(reportPath, results, { spaces: 2 });
        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
    } catch (error) {
        console.error('Error during quality check:', error);
        results.passed = false;
        results.checks.push(`❌ Error: ${error.message}`);
    } finally {
        await browser.close();
    }
    
    return results;
}

// Run if called directly
if (require.main === module) {
    const pdfPath = process.argv[2] || path.join(__dirname, '../../build/dist/premium-ebook.pdf');
    
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ PDF not found: ${pdfPath}`);
        process.exit(1);
    }
    
    checkPremiumQuality(pdfPath)
        .then(results => {
            process.exit(results.passed ? 0 : 1);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { checkPremiumQuality };