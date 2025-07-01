#!/usr/bin/env node
// Script alternativo para capturar screenshots de páginas individuais do PDF

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function capturePages() {
    console.log('🚀 Iniciando captura de páginas do PDF...');
    
    const pdfPath = path.join(__dirname, '..', 'release', 'ebook.pdf');
    const screenshotsDir = path.join(__dirname, '..', 'build', 'screenshots');
    
    // Garantir diretório
    await fs.ensureDir(screenshotsDir);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        // Vamos abrir uma página para cada página do PDF
        for (let pageNum = 1; pageNum <= 15; pageNum++) {
            console.log(`\n📄 Processando página ${pageNum}/15...`);
            
            const page = await browser.newPage();
            
            // Configurar viewport grande
            await page.setViewport({
                width: 612,  // 8.5" at 72 DPI
                height: 792, // 11" at 72 DPI
                deviceScaleFactor: 2
            });
            
            // Adicionar script para forçar navegação
            await page.evaluateOnNewDocument((targetPage) => {
                // Interceptar carregamento do PDF viewer
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        // Tentar diferentes métodos de navegação
                        if (window.PDFViewerApplication && window.PDFViewerApplication.pdfViewer) {
                            window.PDFViewerApplication.pdfViewer.currentPageNumber = targetPage;
                        } else if (window.PDFView) {
                            window.PDFView.page = targetPage;
                        } else {
                            // Chrome PDF viewer
                            const toolbar = document.querySelector('pdf-viewer-toolbar');
                            if (toolbar) {
                                const pageInput = toolbar.shadowRoot.querySelector('#page-number');
                                if (pageInput) {
                                    pageInput.value = targetPage;
                                    pageInput.dispatchEvent(new Event('change'));
                                }
                            }
                        }
                    }, 2000);
                });
            }, pageNum);
            
            // Navegar com a página específica no URL
            console.log(`  → Abrindo PDF na página ${pageNum}...`);
            await page.goto(`file://${pdfPath}#page=${pageNum}`, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            // Aguardar o PDF carregar completamente
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Tentar forçar navegação novamente
            await page.evaluate((targetPage) => {
                if (window.PDFViewerApplication && window.PDFViewerApplication.pdfViewer) {
                    window.PDFViewerApplication.pdfViewer.currentPageNumber = targetPage;
                }
            }, pageNum);
            
            // Mais uma pausa para garantir renderização
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Capturar screenshot
            const screenshotPath = path.join(screenshotsDir, `page-${String(pageNum).padStart(2, '0')}.png`);
            
            await page.screenshot({
                path: screenshotPath,
                fullPage: false,
                type: 'png'
            });
            
            console.log(`  ✓ Screenshot salva: ${screenshotPath}`);
            
            await page.close();
        }
        
        console.log('\n✅ Todas as páginas capturadas com sucesso!');
        console.log(`📁 Screenshots em: ${screenshotsDir}`);
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await browser.close();
    }
}

// Executar
capturePages().catch(console.error);