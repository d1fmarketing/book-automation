#!/usr/bin/env node

/**
 * REBUILD HTML CLEAN - Reconstrói HTML do zero sem overflow
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');

class RebuildHtmlClean {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.outputPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.metadata = null;
        this.chapters = [];
        this.images = {};
    }

    async loadMetadata() {
        const metadataPath = path.join(this.projectRoot, 'metadata.yaml');
        const content = await fs.readFile(metadataPath, 'utf8');
        this.metadata = yaml.load(content);
    }

    async loadChapters() {
        const chaptersDir = path.join(this.projectRoot, 'chapters');
        const files = await fs.readdir(chaptersDir);
        const chapterFiles = files
            .filter(f => f.endsWith('.md') && !f.includes('-enhanced'))
            .sort();

        for (const file of chapterFiles) {
            const content = await fs.readFile(path.join(chaptersDir, file), 'utf8');
            const chapterNum = parseInt(file.match(/\d+/)?.[0] || '0');
            
            // Extract frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
            let frontmatter = {};
            let markdown = content;
            
            if (frontmatterMatch) {
                frontmatter = yaml.load(frontmatterMatch[1]);
                markdown = content.slice(frontmatterMatch[0].length).trim();
            }

            // Limitar conteúdo para teste
            if (markdown.length > 2000) {
                markdown = markdown.substring(0, 2000) + '\n\n[Conteúdo truncado para evitar overflow]';
            }

            this.chapters.push({
                number: chapterNum,
                title: frontmatter.title || `Chapter ${chapterNum}`,
                content: markdown,
                frontmatter
            });
        }
    }

    async loadImages() {
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover
        const coverPath = path.join(imagesDir, 'cover-premium.svg');
        if (await fs.pathExists(coverPath)) {
            const content = await fs.readFile(coverPath);
            const base64 = content.toString('base64');
            this.images.cover = `data:image/svg+xml;base64,${base64}`;
        }
    }

    generateHTML() {
        // Configurar marked sem features complexas
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: false
        });

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* RESET TOTAL */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* BODY */
        body {
            width: 6in;
            margin: 0 auto;
            font-family: Georgia, serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #333;
        }
        
        /* PÁGINA BASE */
        .page {
            width: 6in;
            height: 9in;
            padding: 0.5in;
            overflow: hidden;
            page-break-after: always;
            position: relative;
        }
        
        /* COVER - SEM MARGEM */
        .page.cover {
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .cover img {
            width: 6in;
            height: 9in;
            object-fit: contain;
            margin: 0; /* SEM MARGEM! */
            padding: 0;
            display: block;
        }
        
        /* CONTEÚDO COM LIMITE RÍGIDO */
        .content-area {
            width: 5in; /* 6in - 1in margins */
            height: 8in; /* 9in - 1in margins */
            overflow: hidden;
            position: relative;
        }
        
        /* TEXTO BÁSICO */
        h1 { font-size: 1.4rem; margin: 0.3rem 0; }
        h2 { font-size: 1.2rem; margin: 0.3rem 0; }
        h3 { font-size: 1.1rem; margin: 0.3rem 0; }
        
        p {
            margin: 0.3rem 0;
            text-align: justify;
        }
        
        /* ELEMENTOS SIMPLES */
        .callout-box {
            border-left: 3px solid #667eea;
            padding: 0.3rem;
            margin: 0.3rem 0;
            font-size: 10pt;
        }
        
        pre {
            background: #f5f5f5;
            padding: 0.3rem;
            margin: 0.3rem 0;
            font-size: 8pt;
            overflow: hidden;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        code {
            font-size: 8pt;
        }
        
        table {
            width: 100%;
            margin: 0.3rem 0;
            font-size: 9pt;
            border-collapse: collapse;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 0.2rem;
        }
        
        ul, ol {
            margin: 0.3rem 0;
            padding-left: 1.2rem;
        }
        
        blockquote {
            border-left: 3px solid #999;
            padding-left: 0.5rem;
            margin: 0.3rem 0;
            font-style: italic;
            font-size: 10pt;
        }
        
        /* CHAPTER HEADER */
        .chapter-header {
            text-align: center;
            margin-bottom: 0.5rem;
        }
        
        .chapter-number {
            font-size: 1.8rem;
            color: #667eea;
        }
        
        /* TOC */
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            margin: 0.3rem 0;
            font-size: 10pt;
        }
        
        .toc-title { flex: 1; }
        
        /* IMAGENS */
        img {
            max-width: 100%;
            max-height: 3in;
            display: block;
            margin: 0.3rem auto;
        }
        
        /* PRINT */
        @media print {
            .page {
                margin: 0;
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <!-- COVER -->
    <div class="page cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Cover">` :
            `<h1>${this.metadata.title}</h1>`
        }
    </div>
    
    <!-- TOC -->
    <div class="page">
        <div class="content-area">
            <h1>Table of Contents</h1>
            <ul class="toc">
                ${this.chapters.map((ch, idx) => `
                <li>
                    <span class="toc-title">${ch.title}</span>
                    <span class="toc-page">${idx + 3}</span>
                </li>
                `).join('')}
            </ul>
        </div>
    </div>
    
    <!-- CHAPTERS -->
    ${this.chapters.map(chapter => {
        // Processar markdown básico
        let content = marked.parse(chapter.content);
        
        // Simplificar callout boxes
        content = content.replace(/<div class="callout-box[^"]*">/g, '<div class="callout-box">');
        
        // Remover elementos complexos
        content = content.replace(/<div class="callout-box-header">[^<]*<\/div>/g, '');
        content = content.replace(/<div class="callout-box-content">/g, '<div>');
        content = content.replace(/<span class="callout-box-icon">[^<]*<\/span>/g, '');
        
        return `
    <div class="page">
        <div class="content-area">
            <div class="chapter-header">
                ${chapter.number > 0 ? `<div class="chapter-number">Chapter ${chapter.number}</div>` : ''}
                <h1>${chapter.title}</h1>
            </div>
            ${content}
        </div>
    </div>
    `;
    }).join('\n')}
    
    <!-- END -->
    <div class="page">
        <div class="content-area" style="text-align: center; padding-top: 3in;">
            <h2>The End</h2>
            <p>Thank you for reading!</p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async run() {
        try {
            console.log('🔨 REBUILD HTML CLEAN');
            console.log('====================\n');
            
            await fs.ensureDir(path.dirname(this.outputPath));
            
            console.log('1. Carregando dados...');
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            
            console.log('2. Gerando HTML limpo...');
            const html = this.generateHTML();
            
            console.log('3. Salvando arquivo...');
            await fs.writeFile(this.outputPath, html);
            
            const stats = await fs.stat(this.outputPath);
            console.log(`\n✅ HTML reconstruído: ${(stats.size / 1024).toFixed(0)} KB`);
            console.log(`📍 Arquivo: ${this.outputPath}`);
            
            console.log('\n📋 Características:');
            console.log('   - Páginas 6×9" com 0.5" margins');
            console.log('   - Conteúdo limitado a 8" altura');
            console.log('   - Margens mínimas (0.3rem)');
            console.log('   - Sem CSS complexo');
            console.log('   - Overflow: hidden em tudo');
            
        } catch (error) {
            console.error('❌ Erro:', error.message);
            process.exit(1);
        }
    }
}

// Executar
if (require.main === module) {
    const rebuilder = new RebuildHtmlClean();
    rebuilder.run();
}

module.exports = RebuildHtmlClean;