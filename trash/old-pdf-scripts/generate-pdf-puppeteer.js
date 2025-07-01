#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
// Both chalk and ora are ESM-only in newer versions, use simple console.log
const chalk = {
    green: (text) => `✅ ${text}`,
    red: (text) => `❌ ${text}`,
    yellow: (text) => `⚠️  ${text}`,
    blue: (text) => `ℹ️  ${text}`,
    bold: (text) => text
};
let ora = () => ({ start: () => ({ stop: () => {}, succeed: () => {}, fail: () => {} }) });
const { glob } = require('glob');

// Configurar marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true
});

async function generatePDF() {
    console.log('🚀 Gerando PDF profissional...');
    const spinner = ora('Gerando PDF profissional...').start();
    
    try {
        // Carregar metadados
        const metadata = yaml.load(
            await fs.readFile('metadata.yaml', 'utf8')
        );
        
        // Converter imagem da capa para base64
        const coverPath = path.join(process.cwd(), 'assets/images/cover.jpg');
        let coverBase64 = '';
        if (await fs.pathExists(coverPath)) {
            const coverBuffer = await fs.readFile(coverPath);
            // Detectar o tipo real da imagem
            const isPNG = coverBuffer[0] === 0x89 && coverBuffer[1] === 0x50;
            const mimeType = isPNG ? 'image/png' : 'image/jpeg';
            coverBase64 = `data:${mimeType};base64,${coverBuffer.toString('base64')}`;
            console.log(chalk.blue(`Capa carregada: ${(coverBuffer.length / 1024 / 1024).toFixed(2)} MB`));
        } else {
            console.log(chalk.yellow('Aviso: Capa não encontrada em assets/images/cover.jpg'));
        }
        
        // Ler capítulos
        const chaptersDir = path.join(process.cwd(), 'chapters');
        const chapterFiles = await glob('chapters/*.md');
        chapterFiles.sort();
        
        spinner.text = 'Processando capítulos...';
        
        // Processar capítulos
        let chaptersHTML = '';
        let chapterNumber = 1;
        
        for (const file of chapterFiles) {
            const content = await fs.readFile(file, 'utf8');
            
            // Separar frontmatter do conteúdo
            const lines = content.split('\n');
            let inFrontmatter = false;
            let frontmatterEnd = 0;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i] === '---') {
                    if (!inFrontmatter) {
                        inFrontmatter = true;
                    } else {
                        frontmatterEnd = i + 1;
                        break;
                    }
                }
            }
            
            // Pegar apenas o conteúdo (sem frontmatter)
            const markdownContent = lines.slice(frontmatterEnd).join('\n');
            
            // Converter para HTML
            let html = marked.parse(markdownContent);
            
            // Process AI-IMAGE placeholders
            // The marked.js output includes quotes inside the alt text, so we need a more flexible regex
            html = html.replace(/<img src="" alt="AI-IMAGE: (.*?)">/g, (match, altText) => {
                // For now, use the cover image for any AI-IMAGE placeholder
                const coverPath = path.join(process.cwd(), 'assets/images/cover.jpg');
                const absolutePath = `file://${coverPath}`;
                // Clean up the alt text and escape quotes properly
                const cleanAltText = altText.replace(/"/g, '&quot;').replace(/&quot;&quot;/g, '&quot;');
                return `<img src="${absolutePath}" alt="${cleanAltText}" style="max-width: 100%; height: auto; display: block; margin: 2em auto;">`;
            });
            
            // Não adicionar "Capítulo X:" se já estiver no conteúdo
            // Apenas manter o título original do capítulo
            
            // Extract chapter title from first h1 or h2
            let chapterTitle = '';
            const titleMatch = html.match(/<h[12]>(.*?)<\/h[12]>/);
            if (titleMatch) {
                chapterTitle = titleMatch[1];
            }
            
            // Wrap em div com classe chapter e adicionar string para header
            // Usar chapter-first para o primeiro capítulo (sem page-break)
            const chapterClass = chapterNumber === 1 ? 'chapter-first' : 'chapter';
            chaptersHTML += `<div class="${chapterClass}">
                <div class="chapter-title-string">${chapterTitle}</div>
                ${html}
            </div>\n`;
            
            chapterNumber++;
        }
        
        spinner.text = 'Gerando HTML...';
        
        // Ler CSS profissional
        const cssPath = path.join(process.cwd(), 'assets/css/pdf.css');
        let customCSS = '';
        if (await fs.pathExists(cssPath)) {
            customCSS = await fs.readFile(cssPath, 'utf8');
            console.log(chalk.blue('CSS profissional carregado'));
        }
        
        // Template HTML
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="${metadata.language || 'pt-BR'}">
<head>
    <meta charset="UTF-8">
    <title>${metadata.title}</title>
    <style>
        ${customCSS}
    </style>
</head>
<body>
    <!-- Book Title String for Running Headers -->
    <div class="book-title">${metadata.title}</div>
    
    <!-- Cover Page -->
    <div class="cover-page">
        ${coverBase64 ? `<img src="${coverBase64}" alt="Book Cover">` : '<p>Capa não encontrada</p>'}
    </div>
    
    <!-- Página de Título -->
    <div class="title-page">
        <h1>${metadata.title}</h1>
        ${metadata.subtitle ? `<div class="subtitle">${metadata.subtitle}</div>` : ''}
        <div class="author">${metadata.author}</div>
    </div>
    
    <!-- Página de Copyright -->
    <div class="copyright-page">
        <p>${metadata.copyright}</p>
        <p>${metadata.publisher || ''}</p>
        <p>ISBN: ${metadata.isbn}</p>
        ${metadata.build.general.includeProductLinks && metadata.product_url ? 
            `<p style="margin-top: 2em;">Disponível em:<br><a href="${metadata.product_url}">${metadata.product_url}</a></p>` : 
            ''
        }
    </div>
    
    <!-- Sumário -->
    <div class="toc-page">
        <h2>Sumário</h2>
        ${chapterFiles.map((file, index) => {
            const chapterNum = index + 1;
            const chapterTitle = `Capítulo ${chapterNum}`;
            return `<div class="toc-entry"><span class="toc-title">${chapterTitle}</span><span class="toc-page-num">${5 + index}</span></div>`;
        }).join('\n        ')}
    </div>
    
    <!-- Conteúdo dos Capítulos -->
    ${chaptersHTML}
    
    ${metadata.build.general.includeProductLinks && metadata.product_url ? `
    <!-- Página Final com CTA -->
    <div class="thank-you-page">
        <div style="text-align: center; margin-top: 3in;">
            <h2>Obrigado por ler!</h2>
            <div style="font-size: 24pt; color: #666; margin: 1em 0;">❦</div>
            <p style="margin: 2em 0;">
                Para mais informações e recursos adicionais, visite:
            </p>
            <p style="font-size: 14pt;">
                <a href="${metadata.product_url}">${metadata.product_url}</a>
            </p>
        </div>
    </div>
    ` : ''}
</body>
</html>`;
        
        spinner.text = 'Iniciando Puppeteer...';
        
        // Gerar PDF com Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(htmlTemplate, { 
            waitUntil: 'networkidle0' 
        });
        
        // Aguardar um momento para garantir que o conteúdo seja renderizado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Aguardar imagens carregarem
        await page.waitForSelector('img', { timeout: 10000 }).catch(() => {});
        
        // Esperar todas as imagens carregarem completamente
        await page.evaluate(() => {
            return Promise.all(
                Array.from(document.images).map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve, reject) => {
                        img.addEventListener('load', resolve);
                        img.addEventListener('error', () => {
                            console.error('Erro ao carregar imagem:', img.src.substring(0, 100));
                            resolve(); // Continuar mesmo com erro
                        });
                        // Timeout para cada imagem
                        setTimeout(resolve, 5000);
                    });
                })
            );
        });
        
        // Aguardar mais um momento para garantir renderização completa
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Debug: verificar se a capa está presente
        const hasCovers = await page.evaluate(() => {
            const imgs = document.querySelectorAll('.cover-page img');
            console.log('Número de imagens na capa:', imgs.length);
            imgs.forEach((img, index) => {
                console.log(`Imagem ${index + 1}:`, {
                    src: img.src.substring(0, 100) + '...',
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    complete: img.complete
                });
            });
            return imgs.length;
        });
        console.log(chalk.blue(`Imagens de capa encontradas: ${hasCovers}`));
        
        // Configurar output
        const outputDir = path.join(process.cwd(), 'build', 'dist');
        await fs.ensureDir(outputDir);
        
        const outputFile = path.join(
            outputDir,
            `${metadata.title.toLowerCase().replace(/\s+/g, '-')}.pdf`
        );
        
        spinner.text = 'Renderizando PDF...';
        
        // Gerar PDF
        await page.pdf({
            path: outputFile,
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: metadata.build.pdf.showPageNumbers,
            headerTemplate: '<div></div>',
            footerTemplate: metadata.build.pdf.showPageNumbers ? 
                '<div style="width: 100%; text-align: center; font-size: 10pt; color: #666;"><span class="pageNumber"></span></div>' : 
                '<div></div>',
            margin: {
                top: metadata.build.pdf.margin.top,
                right: metadata.build.pdf.margin.right,
                bottom: metadata.build.pdf.margin.bottom,
                left: metadata.build.pdf.margin.left
            }
        });
        
        await browser.close();
        
        // Salvar HTML para MCP QA
        const tmpDir = path.join(process.cwd(), 'build', 'tmp');
        await fs.ensureDir(tmpDir);
        await fs.writeFile(
            path.join(tmpDir, 'ebook.html'),
            htmlTemplate
        );
        console.log(chalk.blue(`HTML salvo para QA: build/tmp/ebook.html`));
        
        spinner.succeed(chalk.green(`PDF gerado com sucesso: ${outputFile}`));
        
        // Mostrar estatísticas
        const stats = await fs.stat(outputFile);
        console.log(chalk.blue(`Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
        
    } catch (error) {
        spinner.fail(chalk.red('Erro ao gerar PDF'));
        console.error(error);
        process.exit(1);
    }
}

// Executar
generatePDF();