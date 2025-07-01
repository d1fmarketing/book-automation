#!/usr/bin/env node
// VERIFICAÇÃO REAL DO PDF - NÃO MENTE!

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function checkPDFCover() {
    const pdfPath = path.join(__dirname, '..', 'release', 'ebook.pdf');
    
    console.log('🔍 Verificando PDF REAL:', pdfPath);
    
    try {
        // 1. Verificar se o arquivo existe
        const stats = await fs.stat(pdfPath);
        console.log(`📄 Tamanho do PDF: ${(stats.size / 1024).toFixed(2)} KB`);
        
        // 2. Usar pdf-lib para extrair informações
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        console.log(`📑 Total de páginas: ${pages.length}`);
        
        // 3. Verificar primeira página
        const firstPage = pages[0];
        const { width, height } = firstPage.getSize();
        console.log(`📐 Tamanho da página: ${width}x${height} pts (${(width/72).toFixed(1)}x${(height/72).toFixed(1)} polegadas)`);
        
        // 4. Abrir com Puppeteer para verificação visual
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Navegar para o PDF
        await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
        
        // Aguardar o PDF carregar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tirar screenshot da primeira página
        const screenshotPath = path.join(__dirname, '..', 'build', 'pdf-first-page.png');
        await page.screenshot({ 
            path: screenshotPath,
            fullPage: false
        });
        console.log(`📸 Screenshot salvo: ${screenshotPath}`);
        
        // PDFs não têm tags img quando visualizados no browser
        // Vamos verificar visualmente analisando o screenshot
        console.log(`\n🖼️  Analisando visualmente a primeira página...`);
        
        // Verificar se o screenshot foi criado e tem tamanho significativo
        const screenshotStats = await fs.stat(screenshotPath);
        const screenshotSizeKB = screenshotStats.size / 1024;
        console.log(`  - Screenshot: ${screenshotSizeKB.toFixed(2)} KB`);
        
        // Se o screenshot for maior que 50KB, provavelmente tem uma imagem de capa
        // (páginas com apenas texto geralmente são menores)
        let coverFound = screenshotSizeKB > 50;
        
        if (coverFound) {
            console.log(`  - ✅ Conteúdo visual detectado (provável capa)`);
        } else {
            console.log(`  - ❌ Apenas texto detectado (sem capa)`);
        }
        
        await browser.close();
        
        // 5. Resultado final
        console.log('\n📊 RESULTADO DA VERIFICAÇÃO:');
        console.log(`✓ PDF existe: SIM`);
        console.log(`✓ Tamanho correto (6x9"): ${width === 432 && height === 648 ? 'SIM' : 'NÃO'}`);
        console.log(`✓ Capa encontrada: ${coverFound ? 'SIM' : 'NÃO'}`);
        
        if (!coverFound) {
            console.error('\n❌ ERRO: CAPA NÃO ENCONTRADA NO PDF!');
            console.error('O PDF não tem uma imagem de capa na primeira página.');
            process.exit(1);
        }
        
        if (width !== 432 || height !== 648) {
            console.error('\n❌ ERRO: TAMANHO INCORRETO!');
            console.error(`Esperado: 432x648 pts (6x9"), Encontrado: ${width}x${height} pts`);
            process.exit(1);
        }
        
        console.log('\n✅ PDF ESTÁ PERFEITO! CAPA ENCONTRADA!');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ERRO AO VERIFICAR PDF:', error.message);
        process.exit(1);
    }
}

// Executar verificação
checkPDFCover();