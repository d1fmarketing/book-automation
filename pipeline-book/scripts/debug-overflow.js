#!/usr/bin/env node

/**
 * DEBUG-OVERFLOW - Identifica EXATAMENTE qual elemento está vazando
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

class DebugOverflow {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.overflowReport = [];
    }

    async run() {
        console.log('🔍 DEBUG OVERFLOW - Análise Detalhada');
        console.log('=====================================\n');

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.goto(`file://${this.htmlPath}`, {
                waitUntil: ['networkidle0', 'domcontentloaded']
            });

            // Injetar função de debug
            const overflowData = await page.evaluate(() => {
                const report = {
                    totalPages: 0,
                    overflowsByPage: {},
                    summary: {
                        horizontal: 0,
                        vertical: 0,
                        both: 0
                    }
                };

                // Analisar cada página
                const pages = document.querySelectorAll('.page');
                report.totalPages = pages.length;

                pages.forEach((page, pageIndex) => {
                    const pageNum = pageIndex + 1;
                    const pageRect = page.getBoundingClientRect();
                    const pageStyle = window.getComputedStyle(page);
                    
                    // Dimensões reais da página
                    const pageWidth = pageRect.width;
                    const pageHeight = pageRect.height;
                    
                    // Padding da página
                    const paddingLeft = parseFloat(pageStyle.paddingLeft);
                    const paddingRight = parseFloat(pageStyle.paddingRight);
                    const paddingTop = parseFloat(pageStyle.paddingTop);
                    const paddingBottom = parseFloat(pageStyle.paddingBottom);
                    
                    // Área útil
                    const contentWidth = pageWidth - paddingLeft - paddingRight;
                    const contentHeight = pageHeight - paddingTop - paddingBottom;
                    
                    const overflows = [];
                    
                    // Verificar todos os elementos dentro da página
                    const elements = page.querySelectorAll('*');
                    
                    elements.forEach(el => {
                        const elRect = el.getBoundingClientRect();
                        const elStyle = window.getComputedStyle(el);
                        
                        let hasOverflow = false;
                        let overflowType = [];
                        
                        // Overflow horizontal
                        const rightEdge = elRect.right - pageRect.left;
                        const maxRight = pageWidth - paddingRight;
                        
                        if (rightEdge > maxRight) {
                            hasOverflow = true;
                            overflowType.push('horizontal');
                            report.summary.horizontal++;
                        }
                        
                        // Overflow vertical
                        const bottomEdge = elRect.bottom - pageRect.top;
                        const maxBottom = pageHeight - paddingBottom;
                        
                        if (bottomEdge > maxBottom) {
                            hasOverflow = true;
                            overflowType.push('vertical');
                            report.summary.vertical++;
                        }
                        
                        if (hasOverflow) {
                            // Informações detalhadas do elemento
                            const info = {
                                tag: el.tagName,
                                class: el.className,
                                id: el.id,
                                text: el.innerText ? el.innerText.substring(0, 50) + '...' : '',
                                dimensions: {
                                    width: elRect.width,
                                    height: elRect.height,
                                    left: elRect.left - pageRect.left,
                                    top: elRect.top - pageRect.top,
                                    right: rightEdge,
                                    bottom: bottomEdge
                                },
                                overflow: overflowType,
                                exceedsBy: {
                                    horizontal: rightEdge > maxRight ? (rightEdge - maxRight).toFixed(1) + 'px' : '0',
                                    vertical: bottomEdge > maxBottom ? (bottomEdge - maxBottom).toFixed(1) + 'px' : '0'
                                },
                                styles: {
                                    width: elStyle.width,
                                    height: elStyle.height,
                                    margin: elStyle.margin,
                                    padding: elStyle.padding,
                                    position: elStyle.position
                                }
                            };
                            
                            // Para imagens, adicionar src
                            if (el.tagName === 'IMG') {
                                info.src = el.src ? (el.src.startsWith('data:') ? 'data:image...' : el.src) : '';
                                info.naturalDimensions = {
                                    width: el.naturalWidth,
                                    height: el.naturalHeight
                                };
                            }
                            
                            overflows.push(info);
                        }
                    });
                    
                    if (overflows.length > 0) {
                        report.overflowsByPage[pageNum] = {
                            pageInfo: {
                                width: pageWidth,
                                height: pageHeight,
                                padding: `${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,
                                contentArea: `${contentWidth}x${contentHeight}px`
                            },
                            overflowCount: overflows.length,
                            elements: overflows
                        };
                    }
                });
                
                return report;
            });

            // Exibir relatório
            console.log(`📊 RELATÓRIO DE OVERFLOW\n`);
            console.log(`Total de páginas: ${overflowData.totalPages}`);
            console.log(`Overflows horizontais: ${overflowData.summary.horizontal}`);
            console.log(`Overflows verticais: ${overflowData.summary.vertical}`);
            console.log(`\n${'='.repeat(80)}\n`);

            // Detalhes por página
            for (const [pageNum, pageData] of Object.entries(overflowData.overflowsByPage)) {
                console.log(`📄 PÁGINA ${pageNum}`);
                console.log(`   Dimensões: ${pageData.pageInfo.contentArea}`);
                console.log(`   Problemas: ${pageData.overflowCount}\n`);
                
                pageData.elements.forEach((el, idx) => {
                    console.log(`   [${idx + 1}] ${el.tag}${el.class ? '.' + el.class : ''}${el.id ? '#' + el.id : ''}`);
                    console.log(`       Overflow: ${el.overflow.join(', ')}`);
                    console.log(`       Excede por: H:${el.exceedsBy.horizontal} V:${el.exceedsBy.vertical}`);
                    console.log(`       Dimensões: ${el.dimensions.width}x${el.dimensions.height}px`);
                    console.log(`       Posição: left:${el.dimensions.left}px top:${el.dimensions.top}px`);
                    
                    if (el.tag === 'IMG') {
                        console.log(`       Natural: ${el.naturalDimensions.width}x${el.naturalDimensions.height}px`);
                    }
                    
                    console.log(`       Styles: ${JSON.stringify(el.styles)}`);
                    console.log();
                });
                
                console.log(`${'='.repeat(80)}\n`);
            }

            // Salvar relatório completo
            const reportPath = path.join(this.projectRoot, 'build/logs/overflow-debug.json');
            await fs.ensureDir(path.dirname(reportPath));
            await fs.writeJson(reportPath, overflowData, { spaces: 2 });
            console.log(`💾 Relatório salvo em: ${reportPath}`);

            // Recomendações
            console.log('\n🔧 RECOMENDAÇÕES DE CORREÇÃO:\n');
            
            if (overflowData.overflowsByPage['1']) {
                console.log('1. PÁGINA 1 (Cover):');
                console.log('   - Verificar dimensões da imagem SVG');
                console.log('   - Usar object-fit: contain ao invés de cover');
                console.log('   - Adicionar max-width: 100%; max-height: 100%;\n');
            }
            
            if (overflowData.summary.vertical > overflowData.summary.horizontal) {
                console.log('2. OVERFLOW VERTICAL PREDOMINANTE:');
                console.log('   - Reduzir margins/paddings dos elementos');
                console.log('   - Implementar quebra de página automática');
                console.log('   - Verificar altura total do conteúdo vs altura da página\n');
            }
            
            if (overflowData.summary.horizontal > 0) {
                console.log('3. OVERFLOW HORIZONTAL:');
                console.log('   - Adicionar max-width: 100% em imagens e tabelas');
                console.log('   - Verificar code blocks com overflow-x: auto');
                console.log('   - Remover larguras fixas maiores que o container\n');
            }

            await browser.close();

        } catch (error) {
            console.error('❌ Erro:', error.message);
            await browser.close();
            process.exit(1);
        }
    }
}

// Executar
if (require.main === module) {
    const debug = new DebugOverflow();
    debug.run();
}

module.exports = DebugOverflow;