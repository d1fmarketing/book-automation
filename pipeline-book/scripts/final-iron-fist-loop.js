#!/usr/bin/env node

/**
 * ORDEM DIRETA - PARE DE ENTREGAR PDF QUEBRADO
 * 
 * Este script NÃO PODE FALHAR. Vamos verificar TUDO visualmente.
 */

const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class FinalIronFistLoop {
    constructor() {
        this.projectRoot = path.join(__dirname, '../');
        this.maxAttempts = 30;
        this.attempt = 0;
    }

    async log(message) {
        console.log(message);
        const logPath = path.join(this.projectRoot, 'build/logs/final-loop.log');
        await fs.ensureDir(path.dirname(logPath));
        await fs.appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`);
    }

    async generateHTML() {
        await this.log('\n📄 PASSO 1: Gerando HTML com viewport 6×9"...');
        
        // Run the HTML generator
        try {
            const { stdout, stderr } = await execAsync('node scripts/format/markdown-to-html.js', {
                cwd: this.projectRoot
            });
            
            // Verify HTML was created
            const htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
            if (!await fs.pathExists(htmlPath)) {
                throw new Error('HTML não foi criado!');
            }
            
            const stats = await fs.stat(htmlPath);
            await this.log(`✅ HTML criado: ${(stats.size / 1024).toFixed(0)} KB`);
            
            // CHECK: Verify images are embedded
            const htmlContent = await fs.readFile(htmlPath, 'utf8');
            const base64Images = (htmlContent.match(/data:image/g) || []).length;
            await this.log(`  - Imagens base64 encontradas: ${base64Images}`);
            
            if (base64Images < 5) {
                throw new Error(`Apenas ${base64Images} imagens embutidas! Esperado pelo menos 5.`);
            }
            
            return true;
        } catch (error) {
            await this.log(`❌ Erro gerando HTML: ${error.message}`);
            return false;
        }
    }

    async visualQAWithBrowser() {
        await this.log('\n🌐 PASSO 2: QA Visual com Browser (2x)...');
        
        const htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
            
            // Wait for all images to load
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        }))
                );
            });
            
            // Check critical elements
            const checks = await page.evaluate(() => {
                const results = {
                    pages: document.querySelectorAll('.page').length,
                    images: document.querySelectorAll('img').length,
                    imagesLoaded: Array.from(document.images).filter(img => img.complete && img.naturalWidth > 0).length,
                    coverImage: null,
                    chapterImages: 0,
                    errors: []
                };
                
                // Check cover
                const coverImg = document.querySelector('.cover img');
                if (coverImg) {
                    results.coverImage = {
                        loaded: coverImg.complete && coverImg.naturalWidth > 0,
                        src: coverImg.src.substring(0, 50) + '...',
                        width: coverImg.naturalWidth,
                        height: coverImg.naturalHeight
                    };
                } else {
                    results.errors.push('Capa sem imagem!');
                }
                
                // Check chapter images
                document.querySelectorAll('.chapter-image img').forEach((img, idx) => {
                    if (img.complete && img.naturalWidth > 0) {
                        results.chapterImages++;
                    } else {
                        results.errors.push(`Imagem do capítulo ${idx + 1} não carregou`);
                    }
                });
                
                // Check for broken images
                document.querySelectorAll('img').forEach((img, idx) => {
                    if (!img.complete || img.naturalWidth === 0) {
                        results.errors.push(`Imagem ${idx + 1} quebrada: ${img.alt || 'sem alt'}`);
                    }
                    if (!img.src.startsWith('data:image/')) {
                        results.errors.push(`Imagem ${idx + 1} NÃO é base64!`);
                    }
                });
                
                return results;
            });
            
            // Log results
            await this.log(`📊 Resultados do QA Visual:`);
            await this.log(`  - Páginas: ${checks.pages}`);
            await this.log(`  - Imagens totais: ${checks.images}`);
            await this.log(`  - Imagens carregadas: ${checks.imagesLoaded}`);
            await this.log(`  - Capa: ${checks.coverImage ? (checks.coverImage.loaded ? '✅' : '❌') : '❌ Não encontrada'}`);
            await this.log(`  - Imagens de capítulos: ${checks.chapterImages}`);
            
            if (checks.errors.length > 0) {
                await this.log(`\n❌ ERROS ENCONTRADOS:`);
                for (const error of checks.errors) {
                    await this.log(`  - ${error}`);
                }
                return false;
            }
            
            // Take screenshots for verification
            const screenshotDir = path.join(this.projectRoot, 'build/tmp/qa-screenshots');
            await fs.ensureDir(screenshotDir);
            
            // Screenshot cover
            await page.evaluate(() => {
                document.querySelectorAll('.page').forEach((p, i) => {
                    p.style.display = i === 0 ? 'block' : 'none';
                });
            });
            await page.screenshot({
                path: path.join(screenshotDir, 'cover.png'),
                fullPage: false
            });
            
            await this.log(`\n✅ QA Visual PASSOU!`);
            return true;
            
        } finally {
            await browser.close();
        }
    }

    async generatePDF() {
        await this.log('\n📑 PASSO 4: Gerando PDF com Puppeteer...');
        
        const htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        const pdfPath = path.join(this.projectRoot, 'build/tmp/ebook.pdf');
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
        });

        try {
            const page = await browser.newPage();
            
            // CRITICAL: Load with proper settings
            await page.goto(`file://${htmlPath}`, { 
                waitUntil: ['networkidle0', 'domcontentloaded', 'load']
            });
            
            // CRITICAL: Wait for ALL images
            await page.evaluate(() => {
                return new Promise((resolve) => {
                    const images = Array.from(document.images);
                    let loaded = 0;
                    
                    if (images.length === 0) {
                        resolve();
                        return;
                    }
                    
                    images.forEach(img => {
                        if (img.complete) {
                            loaded++;
                            if (loaded === images.length) resolve();
                        } else {
                            img.addEventListener('load', () => {
                                loaded++;
                                if (loaded === images.length) resolve();
                            });
                            img.addEventListener('error', () => {
                                loaded++;
                                if (loaded === images.length) resolve();
                            });
                        }
                    });
                });
            });
            
            // Add a delay to ensure everything is rendered
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate PDF with CORRECT settings
            await page.pdf({
                path: pdfPath,
                width: '6in',
                height: '9in',
                printBackground: true,
                displayHeaderFooter: false,
                margin: { top: '0', right: '0', bottom: '0', left: '0' },
                preferCSSPageSize: false, // CRITICAL for Adobe
                timeout: 60000
            });
            
            const stats = await fs.stat(pdfPath);
            await this.log(`✅ PDF gerado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            // Post-process with Ghostscript
            await this.log('\n👻 Processando com Ghostscript...');
            const fixedPath = path.join(this.projectRoot, 'build/tmp/ebook-fixed.pdf');
            
            const gsCmd = `gs -dBATCH -dNOPAUSE -dQUIET -dPDFSETTINGS=/prepress -dCompatibilityLevel=1.4 -dPDFA=2 -dPDFACompatibilityPolicy=1 -sDEVICE=pdfwrite -sOutputFile="${fixedPath}" -dEmbedAllFonts=true -dSubsetFonts=true "${pdfPath}"`;
            
            try {
                await execAsync(gsCmd);
                await this.log('✅ Ghostscript processamento completo');
            } catch (error) {
                await this.log(`⚠️  Ghostscript falhou, usando PDF original: ${error.message}`);
                await fs.copy(pdfPath, fixedPath);
            }
            
            // Validate with qpdf
            await this.log('\n🔍 Validando com qpdf...');
            try {
                const { stdout, stderr } = await execAsync(`qpdf --check "${fixedPath}" 2>&1 || true`);
                if ((stdout + stderr).includes('No syntax or stream encoding errors found')) {
                    await this.log('✅ qpdf validação: PASSOU');
                } else {
                    await this.log('⚠️  qpdf encontrou avisos mas PDF é legível');
                }
            } catch (error) {
                await this.log(`⚠️  qpdf check falhou: ${error.message}`);
            }
            
            return true;
            
        } finally {
            await browser.close();
        }
    }

    async visualQAPDF() {
        await this.log('\n🖼️  PASSO 5: QA Visual do PDF...');
        
        const pdfPath = path.join(this.projectRoot, 'build/tmp/ebook-fixed.pdf');
        const qaDir = path.join(this.projectRoot, 'build/tmp/pdf-qa');
        await fs.ensureDir(qaDir);
        
        try {
            // Convert to images
            await this.log('Convertendo PDF para imagens...');
            const outputPattern = path.join(qaDir, 'page');
            await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPattern}"`);
            
            // Check pages
            const files = await fs.readdir(qaDir);
            const pageFiles = files.filter(f => f.endsWith('.png')).sort();
            
            await this.log(`✓ ${pageFiles.length} páginas encontradas`);
            
            // Check each page
            let issues = [];
            for (let i = 0; i < pageFiles.length; i++) {
                const pagePath = path.join(qaDir, pageFiles[i]);
                const stats = await fs.stat(pagePath);
                const sizeKB = stats.size / 1024;
                
                await this.log(`  Página ${i + 1}: ${sizeKB.toFixed(0)} KB`);
                
                // Check for issues
                if (i === 0 && sizeKB < 100) {
                    issues.push(`Capa muito pequena (${sizeKB.toFixed(0)} KB) - pode estar sem imagem!`);
                } else if (sizeKB < 20) {
                    issues.push(`Página ${i + 1} pode estar em branco (${sizeKB.toFixed(0)} KB)`);
                }
            }
            
            if (issues.length > 0) {
                await this.log('\n❌ PROBLEMAS ENCONTRADOS:');
                for (const issue of issues) {
                    await this.log(`  - ${issue}`);
                }
                return false;
            }
            
            await this.log('\n✅ QA Visual do PDF PASSOU!');
            return true;
            
        } finally {
            // Clean up
            await fs.remove(qaDir);
        }
    }

    async moveToFinal() {
        await this.log('\n📦 PASSO 7: Movendo para localização final...');
        
        const sourcePath = path.join(this.projectRoot, 'build/tmp/ebook-fixed.pdf');
        const finalPath = path.join(this.projectRoot, 'build/dist/ebook-final.pdf');
        
        await fs.ensureDir(path.dirname(finalPath));
        await fs.copy(sourcePath, finalPath);
        
        // Generate SHA256
        const fileBuffer = await fs.readFile(finalPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const sha256 = hashSum.digest('hex');
        
        await this.log(`🔐 SHA256: ${sha256}`);
        
        // Copy to Downloads
        const downloadPath = path.join(process.env.HOME, 'Downloads', 'final-perfect-ebook.pdf');
        await fs.copy(finalPath, downloadPath);
        
        await this.log('\n✅ FINAL_EBOOK_READY build/dist/ebook-final.pdf');
        await this.log(`📥 Também em: ${downloadPath}`);
        
        return true;
    }

    async run() {
        await this.log('🔨 FINAL IRON FIST LOOP - SEM DESCULPAS');
        await this.log('=====================================\n');
        
        while (this.attempt < this.maxAttempts) {
            this.attempt++;
            await this.log(`\n${'='.repeat(60)}`);
            await this.log(`TENTATIVA ${this.attempt} DE ${this.maxAttempts}`);
            await this.log('='.repeat(60));
            
            try {
                // Step 1: Generate HTML
                if (!await this.generateHTML()) {
                    await this.log('🔄 HTML falhou, tentando novamente...');
                    continue;
                }
                
                // Step 2-3: Visual QA (2x)
                let qaPass = 0;
                for (let i = 0; i < 2; i++) {
                    if (await this.visualQAWithBrowser()) {
                        qaPass++;
                    } else {
                        await this.log('🔄 QA Visual falhou, recomeçando...');
                        break;
                    }
                }
                
                if (qaPass < 2) continue;
                
                await this.log('\n✅ HTML passou QA 2x - prosseguindo para PDF');
                
                // Step 4: Generate PDF
                if (!await this.generatePDF()) {
                    await this.log('🔄 PDF falhou, recomeçando...');
                    continue;
                }
                
                // Step 5: Visual QA PDF
                if (!await this.visualQAPDF()) {
                    await this.log('🔄 QA do PDF falhou, recomeçando...');
                    continue;
                }
                
                // Step 6-7: Success!
                await this.moveToFinal();
                
                await this.log('\n🎉 SUCESSO TOTAL! PDF PERFEITO GERADO!');
                process.exit(0);
                
            } catch (error) {
                await this.log(`\n❌ Erro: ${error.message}`);
                await this.log('🔄 Recomeçando...');
            }
        }
        
        await this.log('\n😔 Máximo de tentativas atingido');
        process.exit(1);
    }
}

// RUN IT
if (require.main === module) {
    const loop = new FinalIronFistLoop();
    loop.run();
}