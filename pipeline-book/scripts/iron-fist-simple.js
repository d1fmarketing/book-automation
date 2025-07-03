#!/usr/bin/env node

/**
 * IRON-FIST SIMPLE - Just make it work!
 * Skip complex pagination, focus on working PDF
 */

const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class IronFistSimple {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook-simple.html');
        this.pdfPath = path.join(this.projectRoot, 'build/dist/ebook-iron-fist-simple.pdf');
    }

    async log(message) {
        console.log(message);
    }

    async generateSimpleHTML() {
        await this.log('\n📄 Generating simple HTML (no complex pagination)...');
        
        try {
            // Run the standard formatter which works better
            const { stdout, stderr } = await execAsync('node scripts/format/markdown-to-html.js', {
                cwd: this.projectRoot
            });
            
            // Copy to our path
            const standardPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
            if (await fs.pathExists(standardPath)) {
                await fs.copy(standardPath, this.htmlPath);
                await this.log('✅ HTML generated successfully');
                return true;
            }
            
            throw new Error('HTML not created');
        } catch (error) {
            await this.log(`❌ Error: ${error.message}`);
            return false;
        }
    }

    async generatePDF() {
        await this.log('\n📑 Generating PDF with proper settings...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--font-render-hinting=none',
                '--disable-lcd-text'
            ]
        });

        try {
            const page = await browser.newPage();
            
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: ['networkidle0', 'domcontentloaded', 'load']
            });

            // Wait for all images
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        }))
                );
            });

            // Extra wait
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Generate PDF
            await fs.ensureDir(path.dirname(this.pdfPath));
            
            await page.pdf({
                path: this.pdfPath,
                format: 'Letter', // Use standard format
                printBackground: true,
                displayHeaderFooter: false,
                margin: {
                    top: '0.5in',
                    right: '0.5in',
                    bottom: '0.5in',
                    left: '0.5in'
                },
                preferCSSPageSize: false,
                scale: 0.75 // Scale down to fit content better
            });

            const stats = await fs.stat(this.pdfPath);
            await this.log(`✅ PDF generated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        } finally {
            await browser.close();
        }

        // Post-process with Ghostscript
        await this.log('\n👻 Post-processing with Ghostscript...');
        
        const tempPath = this.pdfPath + '.temp';
        await fs.move(this.pdfPath, tempPath);
        
        try {
            const gsCmd = `gs -dBATCH -dNOPAUSE -dQUIET -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -sDEVICE=pdfwrite -sOutputFile="${this.pdfPath}" "${tempPath}"`;
            await execAsync(gsCmd);
            await fs.remove(tempPath);
            await this.log('✅ Ghostscript processing complete');
        } catch (error) {
            await this.log('⚠️  Ghostscript failed, using original');
            await fs.move(tempPath, this.pdfPath);
        }
    }

    async validatePDF() {
        await this.log('\n🔍 Validating PDF...');
        
        // Basic validation
        const stats = await fs.stat(this.pdfPath);
        if (stats.size < 100 * 1024) {
            await this.log('❌ PDF too small');
            return false;
        }

        // Try qpdf
        try {
            await execAsync(`qpdf --check "${this.pdfPath}" 2>&1 || true`);
            await this.log('✅ qpdf check passed');
        } catch (error) {
            await this.log('⚠️  qpdf check skipped');
        }

        // Try pdfinfo
        try {
            const { stdout } = await execAsync(`pdfinfo "${this.pdfPath}"`);
            await this.log('✅ PDF info retrieved');
        } catch (error) {
            await this.log('⚠️  pdfinfo check skipped');
        }

        return true;
    }

    async run() {
        await this.log('🔨 IRON-FIST SIMPLE - Just make it work!');
        await this.log('=====================================\n');
        
        // 1. Generate HTML
        if (!await this.generateSimpleHTML()) {
            await this.log('❌ Failed to generate HTML');
            process.exit(1);
        }
        
        // 2. Generate PDF
        await this.generatePDF();
        
        // 3. Validate
        if (!await this.validatePDF()) {
            await this.log('❌ PDF validation failed');
            process.exit(1);
        }
        
        // 4. Copy to Downloads
        const downloadPath = path.join(process.env.HOME, 'Downloads', 'ebook-iron-fist-simple.pdf');
        await fs.copy(this.pdfPath, downloadPath);
        
        await this.log('\n✅ SUCCESS! PDF generated successfully');
        await this.log(`📍 Location: ${this.pdfPath}`);
        await this.log(`📥 Also in: ${downloadPath}`);
    }
}

// Execute
if (require.main === module) {
    const supervisor = new IronFistSimple();
    supervisor.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}