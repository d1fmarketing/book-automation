#!/usr/bin/env node
// Converte PDF em screenshots página por página

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function pdfToScreenshots() {
    console.log('🖼️  Convertendo PDF em screenshots...');
    
    const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'the-tiny-test-book.pdf');
    const screenshotsDir = path.join(__dirname, '..', 'build', 'screenshots');
    
    // Verificar se o PDF existe
    if (!await fs.pathExists(pdfPath)) {
        console.error(`❌ PDF não encontrado: ${pdfPath}`);
        return;
    }
    
    // Criar diretório de screenshots
    await fs.ensureDir(screenshotsDir);
    
    // Limpar screenshots antigas
    const existingFiles = await fs.readdir(screenshotsDir);
    for (const file of existingFiles) {
        if (file.endsWith('.png')) {
            await fs.remove(path.join(screenshotsDir, file));
        }
    }
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Usar viewport de tamanho de página
        await page.setViewport({
            width: 612,  // 8.5 inches at 72 DPI
            height: 792, // 11 inches at 72 DPI
            deviceScaleFactor: 2
        });
        
        // Carregar o PDF
        console.log(`📄 Abrindo PDF: ${pdfPath}`);
        await page.goto(`file://${pdfPath}`, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        
        // Aguardar o PDF carregar completamente
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Procurar o número total de páginas
        let totalPages = 15; // Default baseado no nosso livro
        
        try {
            // Tentar encontrar o indicador de páginas do Chrome PDF viewer
            const pageInfo = await page.evaluate(() => {
                const toolbar = document.querySelector('#toolbar');
                if (toolbar) {
                    const pageInput = toolbar.querySelector('input[type="number"]');
                    const pageText = toolbar.querySelector('.page-info');
                    if (pageText && pageText.textContent) {
                        const match = pageText.textContent.match(/of (\d+)/);
                        if (match) return parseInt(match[1]);
                    }
                }
                return null;
            });
            
            if (pageInfo) {
                totalPages = pageInfo;
                console.log(`📑 Total de páginas detectadas: ${totalPages}`);
            } else {
                console.log(`📑 Usando número padrão de páginas: ${totalPages}`);
            }
        } catch (e) {
            console.log(`⚠️  Não foi possível detectar número de páginas, usando padrão: ${totalPages}`);
        }
        
        // Capturar cada página
        for (let i = 1; i <= totalPages; i++) {
            console.log(`📸 Capturando página ${i}/${totalPages}...`);
            
            // Navegar para a página específica
            if (i > 1) {
                // Tentar usar o controle de página do PDF viewer
                try {
                    await page.evaluate((pageNum) => {
                        // Chrome PDF viewer
                        const pageInput = document.querySelector('#toolbar input[type="number"]');
                        if (pageInput) {
                            pageInput.value = pageNum;
                            pageInput.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                        
                        // Alternativa: usar comandos de teclado
                        if (window.PDFViewerApplication) {
                            window.PDFViewerApplication.page = pageNum;
                        }
                    }, i);
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (e) {
                    // Se falhar, tentar Page Down
                    await page.keyboard.press('PageDown');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            // Capturar screenshot
            const screenshotPath = path.join(screenshotsDir, `page-${String(i).padStart(2, '0')}.png`);
            
            // Tentar capturar apenas o conteúdo do PDF
            const pdfContent = await page.$('#viewer, #mainContainer, .pdfViewer, embed, iframe');
            
            if (pdfContent) {
                await pdfContent.screenshot({
                    path: screenshotPath,
                    type: 'png'
                });
            } else {
                // Fallback: capturar página inteira
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: false,
                    type: 'png',
                    clip: {
                        x: 0,
                        y: 0,
                        width: 612,
                        height: 792
                    }
                });
            }
            
            console.log(`✓ Screenshot salvo: ${screenshotPath}`);
        }
        
        console.log('\n✅ Conversão concluída!');
        console.log(`📁 Screenshots salvas em: ${screenshotsDir}`);
        
    } catch (error) {
        console.error('❌ Erro ao converter PDF:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Executar
pdfToScreenshots().catch(console.error);