#!/usr/bin/env node

/**
 * Visual QA Check - Screenshots and visual validation
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class VisualQAChecker {
    constructor(pdfPath) {
        this.pdfPath = path.resolve(pdfPath);
        this.qaDir = path.join(path.dirname(this.pdfPath), '..', 'qa', 'visual-verification');
        this.issues = [];
    }

    async initialize() {
        await fs.mkdir(this.qaDir, { recursive: true });
        console.log('📸 Visual QA Checker initialized');
    }

    async checkPDF() {
        console.log(`🔍 Checking PDF: ${this.pdfPath}`);
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Set viewport
            await page.setViewport({
                width: 1200,
                height: 1600,
                deviceScaleFactor: 2
            });

            // Navigate to PDF
            await page.goto(`file://${this.pdfPath}`, {
                waitUntil: 'networkidle0'
            });

            // Wait for PDF to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Take screenshots of key pages
            const screenshots = [
                { name: '01-cover', selector: 'embed', index: 0 },
                { name: '02-toc', selector: 'embed', index: 1 },
                { name: '03-chapter1', selector: 'embed', index: 2 },
                { name: '04-chapter2', selector: 'embed', index: 3 },
                { name: '99-end', selector: 'embed', index: -1 }
            ];

            for (const shot of screenshots) {
                try {
                    const screenshotPath = path.join(this.qaDir, `${shot.name}.png`);
                    
                    // Try to navigate to specific page if supported
                    if (shot.index > 0) {
                        await page.evaluate((pageNum) => {
                            const embed = document.querySelector('embed');
                            if (embed && embed.contentDocument) {
                                // Try to navigate to page
                                try {
                                    embed.contentDocument.getElementById(`page${pageNum}`)?.scrollIntoView();
                                } catch (e) {
                                    console.log('Could not navigate to page:', e);
                                }
                            }
                        }, shot.index);
                    }

                    await page.screenshot({
                        path: screenshotPath,
                        fullPage: false
                    });

                    console.log(`📸 Screenshot saved: ${shot.name}`);

                    // Analyze screenshot for issues
                    await this.analyzeScreenshot(screenshotPath, shot.name);
                } catch (err) {
                    console.warn(`⚠️  Could not capture ${shot.name}: ${err.message}`);
                }
            }

            // Check for gradient issues
            const hasGradients = await page.evaluate(() => {
                const styles = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
                return styles.includes('gradient');
            });

            if (hasGradients) {
                this.issues.push('CSS contains gradient definitions that may cause Adobe Reader issues');
            }

        } finally {
            await browser.close();
        }

        // Generate report
        await this.generateReport();

        return {
            passed: this.issues.length === 0,
            issues: this.issues,
            screenshotsDir: this.qaDir
        };
    }

    async analyzeScreenshot(screenshotPath, name) {
        // Check if screenshot was created successfully
        try {
            const stats = await fs.stat(screenshotPath);
            if (stats.size < 10000) {
                this.issues.push(`${name}: Screenshot appears to be blank or corrupted`);
            }
        } catch (err) {
            this.issues.push(`${name}: Failed to create screenshot`);
        }
    }

    async generateReport() {
        const reportPath = path.join(this.qaDir, 'report.html');
        
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Visual Verification Report</title>
    <style>
        body { font-family: sans-serif; margin: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .pass { background: #d4edda; color: #155724; }
        .fail { background: #f8d7da; color: #721c24; }
        .screenshots { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; }
        .screenshot { background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .screenshot img { width: 100%; border: 1px solid #ddd; }
        .issue { background: #fff3cd; color: #856404; padding: 10px; margin: 5px 0; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Visual Verification Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <div class="status ${this.issues.length === 0 ? 'pass' : 'fail'}">
        ${this.issues.length === 0 ? '✅ ALL VISUAL CHECKS PASSED' : `❌ FOUND ${this.issues.length} ISSUES`}
    </div>
    
    ${this.issues.length > 0 ? `
    <h2>Issues Found:</h2>
    ${this.issues.map(issue => `<div class="issue">${issue}</div>`).join('')}
    ` : ''}
    
    <h2>Screenshots:</h2>
    <div class="screenshots">
        ${await this.getScreenshotHTML()}
    </div>
    
    <script>
        document.querySelectorAll('.screenshot img').forEach(img => {
            img.style.cursor = 'pointer';
            img.onclick = () => window.open(img.src, '_blank');
        });
    </script>
</body>
</html>`;

        await fs.writeFile(reportPath, html);
        console.log(`📋 Report generated: ${reportPath}`);
    }

    async getScreenshotHTML() {
        const files = await fs.readdir(this.qaDir);
        const screenshots = files.filter(f => f.endsWith('.png'));
        
        return screenshots.map(file => `
            <div class="screenshot">
                <h3>${file.replace('.png', '').toUpperCase()}</h3>
                <img src="${file}" alt="${file}">
                <p>Click to view full size</p>
            </div>
        `).join('');
    }
}

// Run if called directly
if (require.main === module) {
    const pdfPath = process.argv[2];
    
    if (!pdfPath) {
        console.error('Usage: node visual-qa-check.js <pdf-path>');
        process.exit(1);
    }

    (async () => {
        const checker = new VisualQAChecker(pdfPath);
        await checker.initialize();
        
        const result = await checker.checkPDF();
        
        console.log('\n' + '='.repeat(50));
        if (result.passed) {
            console.log('✅ VISUAL QA PASSED!');
        } else {
            console.log('❌ VISUAL QA FAILED');
            console.log('\nIssues found:');
            result.issues.forEach(issue => console.log(`  - ${issue}`));
        }
        console.log(`\n📁 Screenshots: ${result.screenshotsDir}`);
        console.log('='.repeat(50));
        
        process.exit(result.passed ? 0 : 1);
    })();
}

module.exports = VisualQAChecker;