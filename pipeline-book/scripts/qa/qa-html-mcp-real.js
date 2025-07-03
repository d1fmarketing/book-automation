#!/usr/bin/env node

/**
 * QA-HTML com MCP Browser REAL
 * Usa o browser para MEDIR e VERIFICAR qualidade, não apenas contar páginas
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class MCPRealQualityAssurance {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.issues = [];
        this.measurements = {};
    }

    async log(message, level = 'INFO') {
        console.log(`[${level}] ${message}`);
    }

    async performQualityChecks() {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Configurar viewport para simular impressão
            await page.setViewport({
                width: 576,  // 6 inches at 96 DPI
                height: 864  // 9 inches at 96 DPI
            });

            // Carregar HTML
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: ['networkidle0', 'domcontentloaded']
            });

            // Aguardar imagens
            await page.evaluate(() => {
                return Promise.all(
                    Array.from(document.images)
                        .filter(img => !img.complete)
                        .map(img => new Promise(resolve => {
                            img.onload = img.onerror = resolve;
                        }))
                );
            });

            // EXECUTAR VERIFICAÇÕES DE QUALIDADE REAL
            const qualityReport = await page.evaluate(() => {
                const report = {
                    pages: [],
                    globalIssues: [],
                    measurements: {}
                };

                // 1. VERIFICAR CADA PÁGINA
                const pages = document.querySelectorAll('.page');
                
                pages.forEach((page, index) => {
                    const pageReport = {
                        index: index,
                        type: page.className,
                        issues: [],
                        measurements: {}
                    };

                    // MEDIR DIMENSÕES REAIS
                    const rect = page.getBoundingClientRect();
                    const computed = window.getComputedStyle(page);
                    
                    pageReport.measurements.width = rect.width;
                    pageReport.measurements.height = rect.height;
                    pageReport.measurements.padding = computed.padding;
                    
                    // Verificar tamanho da página (deve ser 6x9 inches = 576x864px)
                    if (Math.abs(rect.width - 576) > 2) {
                        pageReport.issues.push(`Largura incorreta: ${rect.width}px (esperado 576px)`);
                    }
                    if (Math.abs(rect.height - 864) > 2) {
                        pageReport.issues.push(`Altura incorreta: ${rect.height}px (esperado 864px)`);
                    }

                    // VERIFICAR MARGENS (exceto capa)
                    if (!page.classList.contains('cover')) {
                        const paddingValue = parseFloat(computed.paddingTop);
                        const expectedPadding = 48; // 0.5in at 96 DPI
                        
                        if (Math.abs(paddingValue - expectedPadding) > 2) {
                            pageReport.issues.push(`Margem incorreta: ${paddingValue}px (esperado ${expectedPadding}px)`);
                        }
                    }

                    // VERIFICAR OVERFLOW DE TEXTO
                    const contentElements = page.querySelectorAll('p, h1, h2, h3, .callout-box');
                    contentElements.forEach((el) => {
                        const elRect = el.getBoundingClientRect();
                        const pageRect = page.getBoundingClientRect();
                        
                        // Verificar se elemento está dentro da página
                        if (elRect.right > pageRect.right - 10) {
                            pageReport.issues.push(`Overflow horizontal: ${el.tagName} em "${el.textContent.substring(0, 30)}..."`);
                        }
                        if (elRect.bottom > pageRect.bottom - 10) {
                            pageReport.issues.push(`Overflow vertical: ${el.tagName} ultrapassou página`);
                        }
                    });

                    // VERIFICAR TAMANHO DE FONTE
                    const paragraphs = page.querySelectorAll('.chapter-content p');
                    paragraphs.forEach((p) => {
                        const fontSize = parseFloat(window.getComputedStyle(p).fontSize);
                        // 11pt = ~14.67px
                        if (fontSize < 13 || fontSize > 16) {
                            pageReport.issues.push(`Fonte incorreta: ${fontSize.toFixed(1)}px (esperado ~14.67px para 11pt)`);
                            return; // Reportar apenas uma vez por página
                        }
                    });

                    // VERIFICAR IMAGENS
                    const images = page.querySelectorAll('img');
                    images.forEach((img) => {
                        if (!img.complete || img.naturalWidth === 0) {
                            pageReport.issues.push(`Imagem quebrada: ${img.alt || 'sem alt'}`);
                        }
                        
                        // Verificar proporções
                        const imgRect = img.getBoundingClientRect();
                        if (imgRect.width > rect.width * 0.9) {
                            pageReport.issues.push(`Imagem muito larga: ${img.alt || 'imagem'}`);
                        }
                    });

                    // VERIFICAR ÓRFÃS E VIÚVAS
                    const lastP = Array.from(page.querySelectorAll('p')).pop();
                    if (lastP) {
                        const lines = lastP.innerText.split('\n');
                        const lastLine = lines[lines.length - 1];
                        const words = lastLine.trim().split(' ').length;
                        
                        if (words <= 2 && words > 0) {
                            pageReport.issues.push(`Possível viúva: última linha com apenas ${words} palavra(s)`);
                        }
                    }

                    report.pages.push(pageReport);
                });

                // 2. VERIFICAÇÕES GLOBAIS
                
                // Verificar callout boxes
                const calloutBoxes = document.querySelectorAll('.callout-box');
                let calloutOverflow = 0;
                
                calloutBoxes.forEach((box) => {
                    const boxRect = box.getBoundingClientRect();
                    const parent = box.closest('.page');
                    if (parent) {
                        const parentRect = parent.getBoundingClientRect();
                        if (boxRect.right > parentRect.right - 48) { // Considerando margem
                            calloutOverflow++;
                        }
                    }
                });
                
                if (calloutOverflow > 0) {
                    report.globalIssues.push(`${calloutOverflow} callout boxes com overflow`);
                }

                // Verificar contraste de texto
                const textElements = document.querySelectorAll('p, h1, h2, h3');
                let lowContrast = 0;
                
                textElements.forEach((el) => {
                    const style = window.getComputedStyle(el);
                    const color = style.color;
                    const bg = style.backgroundColor;
                    
                    // Simplificado - verificar se é texto claro em fundo claro
                    if (color.includes('255') && bg.includes('255')) {
                        lowContrast++;
                    }
                });
                
                if (lowContrast > 0) {
                    report.globalIssues.push(`${lowContrast} elementos com possível baixo contraste`);
                }

                // Contar totais
                report.measurements.totalPages = pages.length;
                report.measurements.totalImages = document.images.length;
                report.measurements.loadedImages = Array.from(document.images).filter(img => img.complete && img.naturalWidth > 0).length;
                report.measurements.totalCalloutBoxes = calloutBoxes.length;

                return report;
            });

            // PROCESSAR RELATÓRIO
            await this.log('\n📊 RELATÓRIO DE QUALIDADE VISUAL', 'INFO');
            await this.log('=====================================\n');

            // Medições globais
            await this.log(`📑 Páginas: ${qualityReport.measurements.totalPages}`);
            await this.log(`🖼️  Imagens: ${qualityReport.measurements.loadedImages}/${qualityReport.measurements.totalImages}`);
            await this.log(`📦 Callout boxes: ${qualityReport.measurements.totalCalloutBoxes}`);

            // Problemas por página
            let totalIssues = 0;
            let criticalIssues = 0;

            for (const page of qualityReport.pages) {
                if (page.issues.length > 0) {
                    await this.log(`\n❌ Página ${page.index + 1} (${page.type}):`);
                    for (const issue of page.issues) {
                        await this.log(`   - ${issue}`, 'ERROR');
                        totalIssues++;
                        
                        if (issue.includes('Overflow') || issue.includes('quebrada')) {
                            criticalIssues++;
                        }
                    }
                } else {
                    await this.log(`✅ Página ${page.index + 1}: OK`);
                }
            }

            // Problemas globais
            if (qualityReport.globalIssues.length > 0) {
                await this.log('\n⚠️  PROBLEMAS GLOBAIS:');
                for (const issue of qualityReport.globalIssues) {
                    await this.log(`   - ${issue}`, 'WARN');
                    totalIssues++;
                }
            }

            // VEREDITO FINAL
            await this.log('\n' + '='.repeat(50));
            
            if (criticalIssues > 0) {
                await this.log(`❌ REPROVADO: ${criticalIssues} problemas críticos encontrados`, 'ERROR');
                return false;
            } else if (totalIssues > 5) {
                await this.log(`❌ REPROVADO: ${totalIssues} problemas encontrados (máximo 5)`, 'ERROR');
                return false;
            } else if (totalIssues > 0) {
                await this.log(`⚠️  APROVADO COM RESSALVAS: ${totalIssues} problemas menores`, 'WARN');
                return true;
            } else {
                await this.log(`✅ APROVADO: Nenhum problema encontrado!`, 'INFO');
                return true;
            }

        } finally {
            await browser.close();
        }
    }

    async run() {
        try {
            await this.log('🔍 QA-HTML com MCP Browser REAL');
            await this.log('================================\n');

            // Verificar se HTML existe
            if (!await fs.pathExists(this.htmlPath)) {
                await this.log(`❌ HTML não encontrado: ${this.htmlPath}`, 'ERROR');
                process.exit(1);
            }

            // Executar QA
            const passed = await this.performQualityChecks();
            
            process.exit(passed ? 0 : 1);
            
        } catch (error) {
            await this.log(`❌ Erro fatal: ${error.message}`, 'ERROR');
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Executar
if (require.main === module) {
    const qa = new MCPRealQualityAssurance();
    qa.run();
}

module.exports = MCPRealQualityAssurance;