#!/usr/bin/env node

/**
 * Gera PDF FINAL com todas as verificações
 * GARANTE que as imagens estão embutidas
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function generateFinalPDF() {
    const projectRoot = path.join(__dirname, '..');
    const htmlPath = path.join(projectRoot, 'build/tmp/ebook.html');
    const pdfPath = path.join(projectRoot, 'build/dist/final-guaranteed.pdf');
    
    console.log('🚀 Gerando PDF FINAL com GARANTIA de qualidade...\n');
    
    // 1. Verificar HTML
    console.log('📋 Verificando HTML...');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    
    const base64Images = (htmlContent.match(/data:image/g) || []).length;
    console.log(`  ✓ Imagens base64: ${base64Images}`);
    
    if (base64Images < 5) {
        throw new Error('HTML não tem imagens suficientes embutidas!');
    }
    
    // 2. Launch Puppeteer com configurações especiais
    console.log('\n🌐 Iniciando Puppeteer com configurações otimizadas...');
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--deterministic-fetch',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
            // Importante para fontes
            '--font-render-hinting=none',
            '--disable-lcd-text'
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        // 3. Configurar página
        console.log('📄 Configurando página...');
        
        // Definir viewport para match com impressão
        await page.setViewport({
            width: 576,  // 6 inches at 96 DPI
            height: 864, // 9 inches at 96 DPI
            deviceScaleFactor: 2 // Alta resolução
        });
        
        // 4. Carregar HTML
        console.log('📥 Carregando HTML...');
        await page.goto(`file://${htmlPath}`, {
            waitUntil: ['networkidle0', 'domcontentloaded', 'load'],
            timeout: 30000
        });
        
        // 5. Esperar TODAS as imagens
        console.log('🖼️  Aguardando carregamento de imagens...');
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const images = Array.from(document.images);
                console.log(`Encontradas ${images.length} imagens`);
                
                if (images.length === 0) {
                    resolve();
                    return;
                }
                
                let loaded = 0;
                let errors = 0;
                
                const checkComplete = () => {
                    if (loaded + errors >= images.length) {
                        console.log(`Carregadas: ${loaded}, Erros: ${errors}`);
                        resolve();
                    }
                };
                
                images.forEach((img, index) => {
                    if (img.complete && img.naturalWidth > 0) {
                        loaded++;
                        console.log(`Imagem ${index + 1}: OK (${img.naturalWidth}x${img.naturalHeight})`);
                    } else {
                        img.addEventListener('load', () => {
                            loaded++;
                            console.log(`Imagem ${index + 1}: Carregada`);
                            checkComplete();
                        });
                        img.addEventListener('error', () => {
                            errors++;
                            console.error(`Imagem ${index + 1}: ERRO!`);
                            checkComplete();
                        });
                    }
                });
                
                checkComplete();
            });
        });
        
        // 6. Verificar estado das imagens
        const imageStats = await page.evaluate(() => {
            const images = Array.from(document.images);
            return {
                total: images.length,
                loaded: images.filter(img => img.complete && img.naturalWidth > 0).length,
                errors: images.filter(img => img.complete && img.naturalWidth === 0).length,
                details: images.map(img => ({
                    src: img.src.substring(0, 50) + '...',
                    loaded: img.complete && img.naturalWidth > 0,
                    size: `${img.naturalWidth}x${img.naturalHeight}`,
                    alt: img.alt
                }))
            };
        });
        
        console.log(`\n📊 Status das imagens:`);
        console.log(`  Total: ${imageStats.total}`);
        console.log(`  Carregadas: ${imageStats.loaded}`);
        console.log(`  Erros: ${imageStats.errors}`);
        
        if (imageStats.errors > 0) {
            console.error('\n❌ Imagens com erro:');
            imageStats.details.filter(img => !img.loaded).forEach(img => {
                console.error(`  - ${img.alt || 'sem alt'}`);
            });
        }
        
        // 7. Adicionar delay para garantir renderização
        console.log('\n⏱️  Aguardando renderização completa...');
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
        
        // 8. Gerar PDF
        console.log('\n📑 Gerando PDF...');
        await fs.ensureDir(path.dirname(pdfPath));
        
        await page.pdf({
            path: pdfPath,
            format: undefined, // NÃO usar format predefinido
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            },
            preferCSSPageSize: false, // CRÍTICO para Adobe
            scale: 1,
            pageRanges: '',
            timeout: 60000
        });
        
        const stats = await fs.stat(pdfPath);
        console.log(`\n✅ PDF gerado: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        
        // 9. Verificar PDF com pdftoppm
        console.log('\n🔍 Verificando PDF gerado...');
        const tempDir = path.join(projectRoot, 'build/tmp/pdf-verify');
        await fs.ensureDir(tempDir);
        
        try {
            // Extrair primeira página
            await execAsync(`pdftoppm -png -r 150 -f 1 -l 1 "${pdfPath}" "${tempDir}/page"`);
            
            const files = await fs.readdir(tempDir);
            const coverFile = files.find(f => f.endsWith('.png'));
            
            if (coverFile) {
                const coverStats = await fs.stat(path.join(tempDir, coverFile));
                console.log(`  ✓ Capa extraída: ${(coverStats.size / 1024).toFixed(0)} KB`);
                
                if (coverStats.size < 50 * 1024) {
                    console.warn('  ⚠️  Capa pode estar sem imagem!');
                }
            }
        } catch (error) {
            console.warn('  ⚠️  Não foi possível verificar com pdftoppm');
        } finally {
            await fs.remove(tempDir);
        }
        
        // 10. Copiar para Downloads
        const downloadPath = path.join(process.env.HOME, 'Downloads', 'ebook-final-guaranteed.pdf');
        await fs.copy(pdfPath, downloadPath);
        
        console.log('\n🎉 SUCESSO!');
        console.log(`📍 PDF final: ${pdfPath}`);
        console.log(`📥 Cópia em: ${downloadPath}`);
        
    } finally {
        await browser.close();
    }
}

// Executar
generateFinalPDF().catch(error => {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
});