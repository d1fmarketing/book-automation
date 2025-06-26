#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const chalk = require('chalk');
const ora = require('ora');
const { glob } = require('glob');

// Configurar marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true
});

async function generatePDF() {
    const spinner = ora('Gerando PDF profissional...').start();
    
    try {
        // Carregar metadados
        const metadata = yaml.load(
            await fs.readFile('metadata.yaml', 'utf8')
        );
        
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
            
            // Adicionar número do capítulo
            html = html.replace(/<h1[^>]*>/, `<h1>Capítulo ${chapterNumber}: `);
            
            // Wrap em div com classe chapter
            chaptersHTML += `<div class="chapter">${html}</div>\n`;
            
            chapterNumber++;
        }
        
        spinner.text = 'Gerando HTML...';
        
        // Template HTML
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="${metadata.language || 'pt-BR'}">
<head>
    <meta charset="UTF-8">
    <title>${metadata.title}</title>
    <style>
        /* Reset e configurações base */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${metadata.build.pdf.fontFamily};
            font-size: ${metadata.build.pdf.fontSize};
            line-height: ${metadata.build.pdf.lineHeight};
            color: #1a1a1a;
            text-align: justify;
            hyphens: auto;
        }
        
        /* Página de título */
        .title-page {
            page-break-after: always;
            text-align: center;
            padding-top: 3in;
        }
        
        .title-page h1 {
            font-size: 32pt;
            margin-bottom: 0.5in;
            font-weight: normal;
        }
        
        .title-page .subtitle {
            font-size: 18pt;
            color: #666;
            margin-bottom: 2in;
        }
        
        .title-page .author {
            font-size: 16pt;
            text-transform: uppercase;
            letter-spacing: 0.1em;
        }
        
        /* Página de copyright */
        .copyright-page {
            page-break-after: always;
            text-align: center;
            padding-top: 6in;
            font-size: 9pt;
        }
        
        /* Sumário */
        .toc {
            page-break-after: always;
        }
        
        .toc h2 {
            text-align: center;
            margin-bottom: 2em;
        }
        
        .toc ul {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            margin-bottom: 0.5em;
        }
        
        .toc a {
            text-decoration: none;
            color: inherit;
        }
        
        /* Capítulos */
        .chapter {
            page-break-before: always;
        }
        
        h1 {
            font-size: 24pt;
            margin-top: 2in;
            margin-bottom: 0.5in;
            text-align: center;
            font-weight: normal;
        }
        
        h2 {
            font-size: 14pt;
            margin-top: 1.5em;
            margin-bottom: 0.8em;
        }
        
        h3 {
            font-size: 12pt;
            margin-top: 1.2em;
            margin-bottom: 0.6em;
        }
        
        p {
            margin-bottom: 0.8em;
            text-indent: 0.3in;
        }
        
        p:first-of-type,
        h1 + p,
        h2 + p,
        h3 + p {
            text-indent: 0;
        }
        
        /* Listas */
        ul, ol {
            margin: 1em 0 1em 2em;
        }
        
        li {
            margin-bottom: 0.3em;
        }
        
        /* Citações */
        blockquote {
            margin: 1em 2em;
            font-style: italic;
            color: #555;
        }
        
        /* Links */
        a {
            color: #0066cc;
            text-decoration: none;
        }
        
        /* Código */
        code {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            background: #f5f5f5;
            padding: 0.1em 0.3em;
        }
        
        pre {
            background: #f5f5f5;
            padding: 1em;
            margin: 1em 0;
            overflow-x: auto;
            font-size: 0.9em;
        }
        
        /* Configurações de impressão */
        @page {
            size: ${metadata.build.pdf.pageSize};
            margin: ${metadata.build.pdf.margin.top} 
                    ${metadata.build.pdf.margin.right} 
                    ${metadata.build.pdf.margin.bottom} 
                    ${metadata.build.pdf.margin.left};
        }
        
        @media print {
            .no-print {
                display: none;
            }
        }
    </style>
</head>
<body>
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
    
    <!-- Conteúdo dos Capítulos -->
    ${chaptersHTML}
    
    ${metadata.build.general.includeProductLinks && metadata.product_url ? `
    <!-- Página Final com CTA -->
    <div class="chapter">
        <div style="text-align: center; margin-top: 3in;">
            <h2>Obrigado por ler!</h2>
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
            format: 'Letter',
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
        
        // Salvar HTML para debug se necessário
        if (process.env.DEBUG) {
            await fs.writeFile(
                path.join(outputDir, 'debug.html'),
                htmlTemplate
            );
        }
        
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