#!/usr/bin/env node
// Converte PDF em screenshots página por página para verificação visual

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

async function pdfToScreenshots() {
    console.log('🖼️  Convertendo PDF em screenshots...');
    
    const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'the-tiny-test-book.pdf');
    const screenshotsDir = path.join(__dirname, '..', 'build', 'screenshots');
    
    // Criar diretório de screenshots
    await fs.ensureDir(screenshotsDir);
    
    // Limpar screenshots antigas
    const existingFiles = await fs.readdir(screenshotsDir);
    for (const file of existingFiles) {
        if (file.startsWith('page-') && file.endsWith('.png')) {
            await fs.remove(path.join(screenshotsDir, file));
        }
    }
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Configurar viewport maior para melhor qualidade
        await page.setViewport({
            width: 1200,
            height: 1600,
            deviceScaleFactor: 2
        });
        
        console.log(`📄 Abrindo PDF: ${pdfPath}`);
        await page.goto(`file://${pdfPath}`, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        // Aguardar o PDF carregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tentar diferentes seletores para o viewer de PDF
        const viewerSelectors = [
            '#viewer', // PDF.js
            '#mainContainer', // Chrome PDF viewer
            'embed', // Embed genérico
            'iframe', // Alguns viewers usam iframe
            '.pdfViewer' // Outro seletor comum
        ];
        
        let viewerFound = false;
        for (const selector of viewerSelectors) {
            const element = await page.$(selector);
            if (element) {
                console.log(`✓ PDF viewer encontrado: ${selector}`);
                viewerFound = true;
                break;
            }
        }
        
        if (!viewerFound) {
            console.log('⚠️  Viewer específico não encontrado, tentando screenshot da página toda');
        }
        
        // Para PDFs, geralmente precisamos rolar ou navegar página por página
        // Vamos tentar ambas as abordagens
        
        // Primeiro, tentar obter o número total de páginas
        let totalPages = 15; // Default baseado no que sabemos
        
        try {
            // Tentar obter do PDF.js
            totalPages = await page.evaluate(() => {
                if (window.PDFViewerApplication) {
                    return window.PDFViewerApplication.pagesCount;
                }
                // Tentar outros métodos
                const pageInfo = document.querySelector('.page-info');
                if (pageInfo && pageInfo.textContent) {
                    const match = pageInfo.textContent.match(/of (\d+)/);
                    if (match) return parseInt(match[1]);
                }
                return 15; // Fallback
            });
            console.log(`📑 Total de páginas detectadas: ${totalPages}`);
        } catch (e) {
            console.log('📑 Usando número padrão de páginas: 15');
        }
        
        // Abrir o PDF diretamente - vamos usar uma abordagem diferente
        // Vamos criar páginas HTML individuais e capturá-las
        console.log('📝 Criando páginas HTML individuais...');
        
        // Ler o HTML original
        const htmlPath = path.join(__dirname, '..', 'build', 'tmp', 'ebook.html');
        if (!await fs.pathExists(htmlPath)) {
            console.log('⚠️  HTML não encontrado, tentando captura direta do PDF');
            
            // Fallback: capturar o PDF como está (limitado)
            for (let i = 1; i <= totalPages; i++) {
                console.log(`📸 Capturando página ${i}/${totalPages}...`);
                
                // Tentar scroll para simular navegação
                await page.evaluate((pageNum) => {
                    const viewportHeight = window.innerHeight;
                    window.scrollTo(0, viewportHeight * (pageNum - 1));
                }, i);
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const screenshotPath = path.join(screenshotsDir, `page-${String(i).padStart(2, '0')}.png`);
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: false,
                    type: 'png'
                });
                
                console.log(`✓ Screenshot salvo: ${screenshotPath}`);
            }
        } else {
            // Melhor abordagem: usar o HTML original
            console.log('✅ HTML encontrado, usando para captura precisa');
            
            const htmlContent = await fs.readFile(htmlPath, 'utf-8');
            
            // Criar uma página para cada seção do livro
            const sections = htmlContent.split('<div class="page-break"></div>');
            
            for (let i = 0; i < Math.min(sections.length, totalPages); i++) {
                console.log(`📸 Capturando página ${i + 1}/${totalPages}...`);
                
                // Criar HTML temporário para esta página
                let pageHtml = htmlContent.replace(/<body[^>]*>[\s\S]*<\/body>/, 
                    `<body>${sections[i]}</body>`);
                
                // Navegar para o HTML desta página específica
                await page.setContent(pageHtml, {
                    waitUntil: 'networkidle0'
                });
                
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const screenshotPath = path.join(screenshotsDir, `page-${String(i + 1).padStart(2, '0')}.png`);
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: true,
                    type: 'png'
                });
                
                console.log(`✓ Screenshot salvo: ${screenshotPath}`);
            }
        }
        
        console.log('\n✅ Conversão concluída!');
        console.log(`📁 Screenshots salvas em: ${screenshotsDir}`);
        
    } catch (error) {
        console.error('❌ Erro ao converter PDF:', error);
        
        // Fallback: tentar método alternativo
        console.log('\n🔄 Tentando método alternativo...');
        
        const page = await browser.newPage();
        await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
        
        // Screenshot da página inteira (pode pegar múltiplas páginas)
        const fullScreenshot = path.join(screenshotsDir, 'full-pdf.png');
        await page.screenshot({
            path: fullScreenshot,
            fullPage: true
        });
        
        console.log(`✓ Screenshot completo salvo: ${fullScreenshot}`);
    }
    
    await browser.close();
}

// Executar
pdfToScreenshots().catch(console.error);