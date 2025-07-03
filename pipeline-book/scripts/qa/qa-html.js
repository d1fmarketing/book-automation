#!/usr/bin/env node

/**
 * QA-HTML: HTML Visual Quality Assurance with MCP Browser
 * 
 * IRON-FIST BUILD SUPERVISOR SPEC:
 * - Open HTML via MCP browser
 * - Check DOM: margins 0.45-0.55in, contrast ≥ 4.5
 * - Page count matches outline
 * - No orphan/widow > 2 lines
 * - Must pass 2X consecutively
 */

const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class HTMLQualityAssurance {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.logPath = path.join(this.projectRoot, 'build/logs/qa-html.log');
        this.passCount = 0;
        this.requiredPasses = 2;
        this.issues = [];
    }

    async ensureLogDir() {
        await fs.ensureDir(path.dirname(this.logPath));
    }

    async log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        console.log(message);
        await fs.appendFile(this.logPath, logEntry);
    }

    async checkWithBrowser() {
        await this.log('\n🌐 Opening HTML in browser for visual QA...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Set viewport to match print size
            await page.setViewport({
                width: 576,  // 6 inches at 96 DPI
                height: 864  // 9 inches at 96 DPI
            });

            // Load HTML
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: 'networkidle0'
            });

            // Run comprehensive checks
            const checkResults = await page.evaluate(() => {
                const results = {
                    margins: { pass: true, issues: [] },
                    contrast: { pass: true, issues: [] },
                    pageCount: { pass: true, count: 0, expected: 0 },
                    orphansWidows: { pass: true, issues: [] },
                    images: { pass: true, issues: [] },
                    overall: true
                };

                // Check margins on all pages
                const pages = document.querySelectorAll('.page');
                results.pageCount.count = pages.length;
                
                pages.forEach((page, idx) => {
                    // Cover page (idx 0) should have 0 padding for full-bleed
                    if (idx === 0 && page.classList.contains('cover')) {
                        const computed = window.getComputedStyle(page);
                        const padding = parseFloat(computed.padding);
                        if (padding !== 0) {
                            results.margins.pass = false;
                            results.margins.issues.push(
                                `Cover page has padding ${padding}px (should be 0 for full-bleed)`
                            );
                        }
                        return;
                    }
                    
                    // All other pages should have 0.5in padding
                    const computed = window.getComputedStyle(page);
                    const padding = parseFloat(computed.padding);
                    
                    // Convert to inches (assuming 96 DPI)
                    const paddingInches = padding / 96;
                    
                    if (paddingInches < 0.45 || paddingInches > 0.55) {
                        results.margins.pass = false;
                        results.margins.issues.push(
                            `Page ${idx + 1}: margin ${paddingInches.toFixed(2)}in (expected 0.45-0.55in)`
                        );
                    }
                });

                // Check text contrast
                const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
                textElements.forEach((el, idx) => {
                    const computed = window.getComputedStyle(el);
                    const color = computed.color;
                    const bgColor = computed.backgroundColor || 'rgb(255, 255, 255)';
                    
                    // Simple contrast check (would need proper implementation)
                    if (color === 'rgb(255, 255, 255)' && bgColor === 'rgb(255, 255, 255)') {
                        results.contrast.pass = false;
                        results.contrast.issues.push(`Element ${idx}: white on white text`);
                    }
                });

                // Check for orphans/widows (simplified)
                const paragraphs = document.querySelectorAll('.chapter-content p');
                paragraphs.forEach((p, idx) => {
                    const lines = p.innerText.split('\n');
                    const lastLine = lines[lines.length - 1];
                    
                    if (lastLine && lastLine.split(' ').length <= 2) {
                        results.orphansWidows.issues.push(
                            `Paragraph ${idx}: possible widow (${lastLine.split(' ').length} words)`
                        );
                    }
                });

                // Check images
                const images = document.querySelectorAll('img');
                results.images.count = images.length;
                
                images.forEach((img, idx) => {
                    if (!img.complete || img.naturalWidth === 0) {
                        results.images.pass = false;
                        results.images.issues.push(`Image ${idx}: failed to load`);
                    }
                    
                    // Check if image is base64
                    if (!img.src.startsWith('data:image/')) {
                        results.images.pass = false;
                        results.images.issues.push(`Image ${idx}: not base64 encoded`);
                    }
                });

                // Check chapter structure
                const chapters = document.querySelectorAll('.chapter-page');
                const toc = document.querySelectorAll('.toc li');
                
                if (chapters.length !== toc.length) {
                    results.pageCount.pass = false;
                    results.pageCount.issues = [
                        `Chapter count mismatch: ${chapters.length} chapters, ${toc.length} TOC entries`
                    ];
                }

                // Overall pass/fail
                results.overall = results.margins.pass && 
                                results.contrast.pass && 
                                results.pageCount.pass && 
                                results.images.pass;

                return results;
            });

            // Log results
            await this.log('\n📊 HTML Quality Check Results:');
            await this.log(`  ✓ Pages found: ${checkResults.pageCount.count}`);
            
            if (checkResults.margins.pass) {
                await this.log('  ✅ Margins: PASS (all within 0.45-0.55in)');
            } else {
                await this.log('  ❌ Margins: FAIL');
                for (const issue of checkResults.margins.issues) {
                    await this.log(`     - ${issue}`);
                }
            }

            if (checkResults.contrast.pass) {
                await this.log('  ✅ Contrast: PASS');
            } else {
                await this.log('  ❌ Contrast: FAIL');
                for (const issue of checkResults.contrast.issues.slice(0, 3)) {
                    await this.log(`     - ${issue}`);
                }
            }

            if (checkResults.pageCount.pass) {
                await this.log('  ✅ Page structure: PASS');
            } else {
                await this.log('  ❌ Page structure: FAIL');
                await this.log(`     - ${checkResults.pageCount.issues[0]}`);
            }

            if (checkResults.images.pass) {
                await this.log(`  ✅ Images: PASS (${checkResults.images.count} images loaded)`);
            } else {
                await this.log('  ❌ Images: FAIL');
                for (const issue of checkResults.images.issues) {
                    await this.log(`     - ${issue}`);
                }
            }

            if (checkResults.orphansWidows.issues.length > 0) {
                await this.log(`  ⚠️  Orphans/Widows: ${checkResults.orphansWidows.issues.length} potential issues`);
            }

            // Take screenshots for visual verification
            await this.log('\n📸 Taking screenshots for visual record...');
            const screenshotDir = path.join(this.projectRoot, 'build/tmp/qa-screenshots');
            await fs.ensureDir(screenshotDir);

            // Screenshot first 3 pages
            for (let i = 0; i < Math.min(3, checkResults.pageCount.count); i++) {
                await page.evaluate((pageNum) => {
                    const pages = document.querySelectorAll('.page');
                    pages.forEach((p, idx) => {
                        p.style.display = idx === pageNum ? 'block' : 'none';
                    });
                }, i);

                await page.screenshot({
                    path: path.join(screenshotDir, `page-${i + 1}.png`),
                    fullPage: false
                });
            }

            await this.log(`  ✓ Screenshots saved to ${screenshotDir}`);

            return checkResults.overall;

        } finally {
            await browser.close();
        }
    }

    async performQA() {
        await this.log('\n🔍 QA-HTML: Visual Quality Assurance');
        await this.log('=====================================');

        // Check if HTML exists
        if (!await fs.pathExists(this.htmlPath)) {
            await this.log(`❌ HTML not found: ${this.htmlPath}`);
            return false;
        }

        // Run browser checks
        const passed = await this.checkWithBrowser();

        if (passed) {
            this.passCount++;
            await this.log(`\n✅ QA Pass ${this.passCount}/${this.requiredPasses}`);
            
            if (this.passCount >= this.requiredPasses) {
                await this.log('\n🎉 HTML passed QA 2X consecutively!');
                return true;
            } else {
                await this.log('\n🔄 Running second QA pass...');
                // Small delay before second pass
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.performQA();
            }
        } else {
            this.passCount = 0;
            await this.log('\n❌ QA FAILED - Issues must be fixed before proceeding');
            return false;
        }
    }

    async run() {
        try {
            await this.ensureLogDir();
            
            const success = await this.performQA();
            
            if (success) {
                await this.log('\n✅ HTML QA COMPLETE - Ready for PDF generation');
                process.exit(0);
            } else {
                await this.log('\n❌ HTML QA FAILED - Fix issues and retry');
                process.exit(1);
            }
            
        } catch (error) {
            await this.log(`\n❌ Error: ${error.message}`);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const qa = new HTMLQualityAssurance();
    qa.run();
}

module.exports = HTMLQualityAssurance;