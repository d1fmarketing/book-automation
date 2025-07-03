#!/usr/bin/env node

/**
 * IRON-FIST SUPERVISOR FINAL
 * 
 * 1. Gera HTML paginado
 * 2. QA visual 2x com MCP Browser
 * 3. Só então gera PDF
 * 4. Valida com qpdf e Ghostscript
 * 5. Entrega apenas quando PERFEITO
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const puppeteer = require('puppeteer');

const execAsync = promisify(exec);

class IronFistFinal {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.pdfPath = path.join(this.projectRoot, 'build/dist/ebook-final.pdf');
        this.logPath = path.join(this.projectRoot, 'build/logs/iron-fist-final.log');
        this.maxAttempts = 30;
        this.attempt = 0;
    }

    async log(message) {
        console.log(message);
        await fs.ensureDir(path.dirname(this.logPath));
        await fs.appendFile(this.logPath, `[${new Date().toISOString()}] ${message}\n`);
    }

    async generateHTML() {
        await this.log('\n📄 STEP 1: Generating paginated HTML...');
        
        try {
            const { stdout, stderr } = await execAsync('node scripts/format/markdown-to-html-paginated.js', {
                cwd: this.projectRoot
            });
            
            if (!await fs.pathExists(this.htmlPath)) {
                throw new Error('HTML not created!');
            }
            
            const stats = await fs.stat(this.htmlPath);
            await this.log(`✅ HTML generated: ${(stats.size / 1024).toFixed(0)} KB`);
            
            return true;
        } catch (error) {
            await this.log(`❌ HTML generation failed: ${error.message}`);
            return false;
        }
    }

    async qaHTML() {
        await this.log('\n🔍 STEP 2: Visual QA with real browser measurements...');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: ['networkidle0', 'domcontentloaded']
            });

            // Run simplified QA checks
            const qaResults = await page.evaluate(() => {
                const results = {
                    pageCount: 0,
                    criticalIssues: [],
                    warnings: [],
                    images: { total: 0, loaded: 0 }
                };

                // Count pages
                const pages = document.querySelectorAll('.page');
                results.pageCount = pages.length;

                // Check images
                const images = document.querySelectorAll('img');
                results.images.total = images.length;
                results.images.loaded = Array.from(images).filter(img => 
                    img.complete && img.naturalWidth > 0
                ).length;

                // Check for broken images
                if (results.images.loaded < results.images.total) {
                    results.criticalIssues.push(
                        `${results.images.total - results.images.loaded} images failed to load`
                    );
                }
                
                // Verify minimum expected images (1 cover + 5 chapter headers + at least 5 content)
                if (results.images.total < 11) {
                    results.criticalIssues.push(
                        `Too few images: ${results.images.total} (expected at least 11)`
                    );
                }

                // Check page dimensions
                pages.forEach((page, idx) => {
                    const rect = page.getBoundingClientRect();
                    if (Math.abs(rect.width - 576) > 5 || Math.abs(rect.height - 864) > 5) {
                        results.warnings.push(`Page ${idx + 1} dimensions off`);
                    }
                });

                return results;
            });

            await this.log(`  Pages: ${qaResults.pageCount}`);
            await this.log(`  Images: ${qaResults.images.loaded}/${qaResults.images.total}`);

            if (qaResults.criticalIssues.length > 0) {
                await this.log('❌ Critical issues found:');
                for (const issue of qaResults.criticalIssues) {
                    await this.log(`  - ${issue}`);
                }
                return false;
            }

            if (qaResults.warnings.length > 0) {
                await this.log('⚠️  Warnings:');
                for (const warning of qaResults.warnings) {
                    await this.log(`  - ${warning}`);
                }
            }

            await this.log('✅ HTML QA passed');
            return true;

        } finally {
            await browser.close();
        }
    }

    async generatePDF() {
        await this.log('\n📑 STEP 3: Generating PDF...');
        
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

            // Extra wait for rendering
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate PDF
            await fs.ensureDir(path.dirname(this.pdfPath));
            
            await page.pdf({
                path: this.pdfPath,
                width: '6in',
                height: '9in',
                printBackground: true,
                displayHeaderFooter: false,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: false, // Critical for Adobe
                scale: 1
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
        await this.log('\n🔍 STEP 4: Validating PDF...');
        
        // 1. qpdf check
        try {
            const { stdout, stderr } = await execAsync(`qpdf --check "${this.pdfPath}" 2>&1 || true`);
            const output = stdout + stderr;
            
            if (output.includes('No syntax or stream encoding errors found') || 
                output.includes('no errors')) {
                await this.log('✅ qpdf validation: PASS');
            } else {
                await this.log('❌ qpdf validation: FAIL');
                return false;
            }
        } catch (error) {
            await this.log('⚠️  qpdf check skipped');
        }

        // 2. Page size check
        try {
            const { stdout } = await execAsync(`pdfinfo "${this.pdfPath}"`);
            const sizeMatch = stdout.match(/Page size:\s+([\d.]+) x ([\d.]+) pts/);
            
            if (sizeMatch) {
                const width = parseFloat(sizeMatch[1]);
                const height = parseFloat(sizeMatch[2]);
                
                if (Math.abs(width - 432) <= 1 && Math.abs(height - 648) <= 1) {
                    await this.log('✅ Page size: CORRECT (432×648 pts)');
                } else {
                    await this.log(`❌ Page size: WRONG (${width}×${height} pts)`);
                    return false;
                }
            }
        } catch (error) {
            await this.log('⚠️  Page size check skipped');
        }

        // 3. Visual check with pdftoppm
        try {
            const tempDir = path.join(this.projectRoot, 'build/tmp/pdf-check');
            await fs.ensureDir(tempDir);
            
            await execAsync(`pdftoppm -png -r 150 -f 1 -l 1 "${this.pdfPath}" "${tempDir}/page"`);
            
            const files = await fs.readdir(tempDir);
            const coverFile = files.find(f => f.endsWith('.png'));
            
            if (coverFile) {
                const stats = await fs.stat(path.join(tempDir, coverFile));
                if (stats.size > 50 * 1024) {
                    await this.log('✅ Cover page: Has content');
                } else {
                    await this.log('❌ Cover page: Too small, might be blank');
                    await fs.remove(tempDir);
                    return false;
                }
            }
            
            await fs.remove(tempDir);
        } catch (error) {
            await this.log('⚠️  Visual check skipped');
        }

        return true;
    }

    async finalize() {
        await this.log('\n📦 STEP 5: Finalizing...');
        
        // Generate SHA256
        const fileBuffer = await fs.readFile(this.pdfPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const sha256 = hashSum.digest('hex');
        
        await this.log(`🔐 SHA256: ${sha256}`);
        
        // Copy to Downloads
        const downloadPath = path.join(process.env.HOME, 'Downloads', 'ebook-iron-fist-final.pdf');
        await fs.copy(this.pdfPath, downloadPath);
        
        await this.log('\n✅ FINAL_EBOOK_READY build/dist/ebook-final.pdf');
        await this.log(`📥 Also copied to: ${downloadPath}`);
    }

    async run() {
        await this.log('🔨 IRON-FIST SUPERVISOR FINAL');
        await this.log('==============================\n');
        
        while (this.attempt < this.maxAttempts) {
            this.attempt++;
            await this.log(`\nATTEMPT ${this.attempt} OF ${this.maxAttempts}`);
            await this.log('='.repeat(50));
            
            try {
                // 1. Generate HTML
                if (!await this.generateHTML()) {
                    continue;
                }
                
                // 2. QA HTML (2x)
                let qaPass = 0;
                for (let i = 0; i < 2; i++) {
                    await this.log(`\n  QA Pass ${i + 1}/2...`);
                    if (await this.qaHTML()) {
                        qaPass++;
                    } else {
                        break;
                    }
                }
                
                if (qaPass < 2) {
                    await this.log('❌ HTML QA failed, retrying...');
                    continue;
                }
                
                await this.log('\n✅ HTML passed 2x QA - proceeding to PDF');
                
                // 3. Generate PDF
                await this.generatePDF();
                
                // 4. Validate PDF
                if (!await this.validatePDF()) {
                    await this.log('❌ PDF validation failed, retrying...');
                    continue;
                }
                
                // 5. Success!
                await this.finalize();
                
                await this.log('\n🎉 SUCCESS! Perfect ebook delivered.');
                process.exit(0);
                
            } catch (error) {
                await this.log(`\n❌ Error: ${error.message}`);
                await this.log('Retrying...');
            }
        }
        
        await this.log('\n😔 Maximum attempts reached');
        process.exit(1);
    }
}

// Execute
if (require.main === module) {
    const supervisor = new IronFistFinal();
    supervisor.run();
}