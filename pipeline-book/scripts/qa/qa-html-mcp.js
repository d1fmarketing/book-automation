#!/usr/bin/env node

/**
 * QA-HTML via MCP Browser - DOM PURO, SEM SCREENSHOTS!
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class QAHtmlMCP {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
    }

    async run() {
        console.log('[INFO] 🔍 QA-HTML via MCP Browser (DOM puro)');
        console.log('[INFO] =====================================\n');

        // Verificar se HTML existe
        if (!await fs.pathExists(this.htmlPath)) {
            console.log(`[ERROR] ❌ HTML não encontrado: ${this.htmlPath}`);
            process.exit(1);
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: ['networkidle0', 'domcontentloaded']
            });

            // Aguardar imagens carregarem
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        }))
                );
            });

            // EXECUTAR TODAS AS VERIFICAÇÕES VIA DOM
            const results = await page.evaluate(() => {
                const report = {
                    passed: true,
                    errors: [],
                    stats: {}
                };

                // 1. CONTAR PÁGINAS
                const pages = document.querySelectorAll('.page');
                report.stats.pageCount = pages.length;
                
                if (pages.length < 9) { // Mínimo realista
                    report.passed = false;
                    report.errors.push(`Apenas ${pages.length} páginas (mínimo 9)`);
                }

                // 2. VERIFICAR MARGENS (0.45-0.55" = 43.2-52.8px)
                const contentPages = document.querySelectorAll('.page:not(.cover)');
                let marginIssues = 0;
                
                contentPages.forEach((page, idx) => {
                    const style = window.getComputedStyle(page);
                    const padding = parseFloat(style.paddingTop);
                    
                    if (padding < 43.2 || padding > 52.8) {
                        marginIssues++;
                        if (marginIssues <= 3) {
                            report.errors.push(`Página ${idx + 2}: margem ${padding.toFixed(1)}px (esperado 43.2-52.8px)`);
                        }
                    }
                });
                
                if (marginIssues > 0) {
                    report.passed = false;
                    if (marginIssues > 3) {
                        report.errors.push(`... e mais ${marginIssues - 3} problemas de margem`);
                    }
                }
                report.stats.marginIssues = marginIssues;

                // 3. VERIFICAR OVERFLOW
                let overflowCount = 0;
                
                pages.forEach((page, pageIdx) => {
                    const pageRect = page.getBoundingClientRect();
                    const elements = page.querySelectorAll('p, h1, h2, h3, img, .callout-box, pre, table');
                    
                    elements.forEach(el => {
                        const elRect = el.getBoundingClientRect();
                        
                        // Overflow horizontal
                        if (elRect.right > pageRect.right - 5) {
                            overflowCount++;
                            if (overflowCount <= 5) {
                                report.errors.push(`Página ${pageIdx + 1}: overflow horizontal em ${el.tagName}`);
                            }
                        }
                        
                        // Overflow vertical
                        if (elRect.bottom > pageRect.bottom - 5) {
                            overflowCount++;
                            if (overflowCount <= 5) {
                                report.errors.push(`Página ${pageIdx + 1}: overflow vertical em ${el.tagName}`);
                            }
                        }
                    });
                });
                
                if (overflowCount > 0) {
                    report.passed = false;
                    if (overflowCount > 5) {
                        report.errors.push(`... e mais ${overflowCount - 5} problemas de overflow`);
                    }
                }
                report.stats.overflowCount = overflowCount;

                // 4. VERIFICAR CONTRASTE
                const textElements = document.querySelectorAll('p, h1, h2, h3');
                let contrastIssues = 0;
                
                textElements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const color = style.color;
                    
                    // Simplificado: verificar se texto é escuro
                    const rgb = color.match(/\d+/g);
                    if (rgb) {
                        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
                        if (brightness > 180) { // Texto muito claro
                            contrastIssues++;
                        }
                    }
                });
                
                if (contrastIssues > 0) {
                    report.passed = false;
                    report.errors.push(`${contrastIssues} elementos com possível baixo contraste`);
                }
                report.stats.contrastIssues = contrastIssues;

                // 5. VERIFICAR ÓRFÃS/VIÚVAS
                let orphanWidowCount = 0;
                
                pages.forEach((page, pageIdx) => {
                    const paragraphs = page.querySelectorAll('p');
                    const lastP = paragraphs[paragraphs.length - 1];
                    
                    if (lastP && lastP.innerText) {
                        const text = lastP.innerText.trim();
                        const words = text.split(/\s+/).filter(w => w.length > 0);
                        const lastLineWords = text.split('\n').pop().trim().split(/\s+/).filter(w => w.length > 0);
                        
                        if (lastLineWords.length > 0 && lastLineWords.length <= 2) {
                            orphanWidowCount++;
                            if (orphanWidowCount <= 3) {
                                report.errors.push(`Página ${pageIdx + 1}: viúva com ${lastLineWords.length} palavra(s)`);
                            }
                        }
                    }
                });
                
                if (orphanWidowCount > 3) {
                    report.errors.push(`... e mais ${orphanWidowCount - 3} órfãs/viúvas`);
                }
                report.stats.orphanWidows = orphanWidowCount;

                // 6. VERIFICAR IMAGENS
                const images = document.querySelectorAll('img');
                let loadedImages = 0;
                let brokenImages = 0;
                
                images.forEach(img => {
                    if (img.complete && img.naturalWidth > 0 && img.src.startsWith('data:image')) {
                        loadedImages++;
                    } else {
                        brokenImages++;
                    }
                });
                
                report.stats.totalImages = images.length;
                report.stats.loadedImages = loadedImages;
                
                if (loadedImages < 10) { // Mínimo: 1 capa + 5 chapter + 4 content
                    report.passed = false;
                    report.errors.push(`Apenas ${loadedImages} imagens carregadas (mínimo 10)`);
                }
                
                if (brokenImages > 0) {
                    report.passed = false;
                    report.errors.push(`${brokenImages} imagens quebradas`);
                }

                return report;
            });

            // EXIBIR RELATÓRIO
            console.log('[INFO] 📊 RELATÓRIO QA-HTML');
            console.log('[INFO] ' + '='.repeat(50));
            console.log(`[INFO] ✓ Páginas: ${results.stats.pageCount}`);
            console.log(`[INFO] ✓ Margens: ${results.stats.marginIssues === 0 ? 'OK' : results.stats.marginIssues + ' problemas'}`);
            console.log(`[INFO] ✓ Overflow: ${results.stats.overflowCount === 0 ? 'OK' : results.stats.overflowCount + ' problemas'}`);
            console.log(`[INFO] ✓ Contraste: ${results.stats.contrastIssues === 0 ? 'OK' : results.stats.contrastIssues + ' problemas'}`);
            console.log(`[INFO] ✓ Órfãs/Viúvas: ${results.stats.orphanWidows}`);
            console.log(`[INFO] ✓ Imagens: ${results.stats.loadedImages}/${results.stats.totalImages}`);
            
            console.log('\n[INFO] ' + '='.repeat(50));
            
            if (results.passed) {
                console.log('[SUCCESS] ✅ QA-HTML PASSOU!');
            } else {
                console.log(`[ERROR] ❌ QA-HTML FALHOU: ${results.errors.length} problemas`);
                results.errors.forEach(err => {
                    console.log(`[ERROR]   - ${err}`);
                });
            }

            // Salvar relatório
            const reportPath = path.join(this.projectRoot, 'build/logs/qa-html-report.json');
            await fs.ensureDir(path.dirname(reportPath));
            await fs.writeJson(reportPath, results, { spaces: 2 });

            await browser.close();
            process.exit(results.passed ? 0 : 1);

        } catch (error) {
            console.error('[ERROR] ❌ Erro fatal:', error.message);
            await browser.close();
            process.exit(1);
        }
    }
}

// Executar
if (require.main === module) {
    const qa = new QAHtmlMCP();
    qa.run();
}

module.exports = QAHtmlMCP;