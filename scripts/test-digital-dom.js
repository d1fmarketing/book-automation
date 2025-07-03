const puppeteer = require('puppeteer');
const path = require('path');

async function testDigitalDOM() {
    console.log('🔍 Testando DOM do preset digital...\n');
    
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Assumindo que o HTML está em build/tmp/ebook.html
    const htmlPath = path.join(process.cwd(), 'build/tmp/ebook-digital.html');
    
    try {
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
        
        // Inspecionar DOM diretamente
        const analysis = await page.evaluate(() => {
            const results = {
                totalElements: document.querySelectorAll('*').length,
                chapters: document.querySelectorAll('.chapter').length,
                images: document.querySelectorAll('img').length,
                overflows: [],
                emptySpaces: [],
                cssIssues: []
            };
            
            // Verificar overflows
            document.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                
                if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
                    results.overflows.push({
                        tag: el.tagName,
                        class: el.className,
                        overflow: `width: ${el.scrollWidth}>${el.clientWidth}, height: ${el.scrollHeight}>${el.clientHeight}`
                    });
                }
                
                // Verificar espaços vazios grandes
                if (rect.height > 200 && el.textContent.trim() === '') {
                    results.emptySpaces.push({
                        tag: el.tagName,
                        class: el.className,
                        height: rect.height
                    });
                }
                
                // Verificar tamanhos fixos (6in, 9in, etc)
                if (style.width.includes('in') || style.height.includes('in')) {
                    results.cssIssues.push({
                        tag: el.tagName,
                        issue: `Fixed size: width=${style.width}, height=${style.height}`
                    });
                }
            });
            
            // Verificar propriedades do body
            const bodyStyle = window.getComputedStyle(document.body);
            results.bodyCSS = {
                fontSize: bodyStyle.fontSize,
                lineHeight: bodyStyle.lineHeight,
                maxWidth: bodyStyle.maxWidth,
                padding: bodyStyle.padding
            };
            
            return results;
        });
        
        console.log('📊 Análise do DOM:\n');
        console.log(`Total de elementos: ${analysis.totalElements}`);
        console.log(`Capítulos: ${analysis.chapters}`);
        console.log(`Imagens: ${analysis.images}`);
        console.log(`\n🚨 Overflows detectados: ${analysis.overflows.length}`);
        if (analysis.overflows.length > 0) {
            console.log(JSON.stringify(analysis.overflows, null, 2));
        }
        console.log(`\n⬜ Espaços vazios grandes: ${analysis.emptySpaces.length}`);
        console.log(`\n⚠️  Tamanhos fixos: ${analysis.cssIssues.length}`);
        if (analysis.cssIssues.length > 0) {
            console.log(JSON.stringify(analysis.cssIssues, null, 2));
        }
        console.log('\n📐 CSS do Body:');
        console.log(JSON.stringify(analysis.bodyCSS, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
    
    await browser.close();
}

testDigitalDOM();