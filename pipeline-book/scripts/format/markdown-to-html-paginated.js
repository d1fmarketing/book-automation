#!/usr/bin/env node

/**
 * FORMATTER-HTML PAGINADO
 * Quebra conteúdo em páginas de 6x9" que cabem no papel
 */

const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { processMarkdownWithCallouts } = require('../utils/callout-box-parser');

class PaginatedHTMLFormatter {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
        this.metadata = null;
        this.chapters = [];
        this.images = {};
        
        // Configurações de página (6x9 inches com margens 0.5in)
        this.pageHeight = 864; // 9 inches em pixels (96 DPI)
        this.pageWidth = 576;  // 6 inches
        this.marginTop = 48;   // 0.5 inch
        this.marginBottom = 48;
        this.marginLeft = 48;
        this.marginRight = 48;
        this.contentHeight = this.pageHeight - this.marginTop - this.marginBottom; // 768px
        this.contentWidth = this.pageWidth - this.marginLeft - this.marginRight;   // 480px
        
        // Estimativas de altura de elementos
        this.lineHeight = 24; // ~1.6 line-height para 11pt
        this.paragraphMargin = 13; // margin-bottom de parágrafos
        this.h1Height = 60;
        this.h2Height = 45;
        this.h3Height = 35;
        this.imageHeight = 300; // altura média de imagem
        this.calloutHeight = 100; // altura média de callout box
    }

    async loadMetadata() {
        console.log('📋 Loading metadata...');
        const metadataPath = path.join(this.projectRoot, 'metadata.yaml');
        const content = await fs.readFile(metadataPath, 'utf8');
        this.metadata = yaml.load(content);
        console.log('  ✓ Metadata loaded');
    }

    async loadChapters() {
        console.log('\n📚 Loading chapters...');
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

            this.chapters.push({
                number: chapterNum,
                title: frontmatter.title || `Chapter ${chapterNum}`,
                content: markdown,
                frontmatter
            });
            
            console.log(`  ✓ Chapter ${chapterNum}: ${frontmatter.title || file}`);
        }
        
        // Remover duplicatas
        const seen = new Set();
        this.chapters = this.chapters.filter(ch => {
            const key = `${ch.number}-${ch.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    async loadImages() {
        console.log('\n🖼️  Loading and encoding images...');
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover
        const coverFormats = ['cover-premium.svg', 'cover.png', 'cover.jpg'];
        for (const format of coverFormats) {
            const coverPath = path.join(imagesDir, format);
            if (await fs.pathExists(coverPath)) {
                const ext = path.extname(format).slice(1);
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                const content = await fs.readFile(coverPath);
                const base64 = content.toString('base64');
                this.images.cover = `data:image/${mimeType};base64,${base64}`;
                console.log(`  ✓ Cover loaded: ${format}`);
                break;
            }
        }

        // Load chapter images
        for (let i = 1; i <= 5; i++) {
            const formats = [
                `chapter-0${i}-premium.svg`,
                `chapter-0${i}-architecture-horizontal.png`,
                `chapter-0${i}.png`
            ];
            
            for (const format of formats) {
                const imagePath = path.join(imagesDir, format);
                if (await fs.pathExists(imagePath)) {
                    const ext = path.extname(format).slice(1);
                    const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                    const content = await fs.readFile(imagePath);
                    const base64 = content.toString('base64');
                    this.images[`chapter${i}`] = `data:image/${mimeType};base64,${base64}`;
                    console.log(`  ✓ Chapter ${i} image loaded`);
                    break;
                }
            }
        }
    }

    configureMarked() {
        const renderer = new marked.Renderer();
        
        renderer.code = (code, language) => {
            const escaped = this.escapeHtml(code);
            return `<pre class="code-block" data-height="${this.calloutHeight}"><code>${escaped}</code></pre>`;
        };

        renderer.heading = (text, level) => {
            const height = level === 1 ? this.h1Height : level === 2 ? this.h2Height : this.h3Height;
            return `<h${level} class="heading-${level}" data-height="${height}">${text}</h${level}>`;
        };

        renderer.paragraph = (text) => {
            const lines = Math.ceil(text.length / 80); // Estimativa de linhas
            const height = lines * this.lineHeight + this.paragraphMargin;
            return `<p data-height="${height}">${text}</p>`;
        };

        renderer.image = (href, title, text) => {
            return `<figure class="content-image" data-height="${this.imageHeight}"><img src="${href}" alt="${text}"></figure>`;
        };

        marked.setOptions({
            renderer,
            breaks: true,
            gfm: true
        });
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    processChapterContent(markdown) {
        // Replace relative image paths with base64
        let processed = markdown.replace(/!\[([^\]]*)\]\(\.\.\/assets\/images\/([^)]+)\)/g, (match, alt, filename) => {
            const imagePath = path.join(this.projectRoot, 'assets/images', filename);
            if (fs.existsSync(imagePath)) {
                const ext = path.extname(filename).slice(1);
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                const content = fs.readFileSync(imagePath);
                const base64 = content.toString('base64');
                const dataUri = `data:image/${mimeType};base64,${base64}`;
                return `![${alt}](${dataUri})`;
            }
            return match;
        });
        
        // Also handle absolute paths
        processed = processed.replace(/!\[([^\]]*)\]\(\/assets\/images\/([^)]+)\)/g, (match, alt, filename) => {
            const imagePath = path.join(this.projectRoot, 'assets/images', filename);
            if (fs.existsSync(imagePath)) {
                const ext = path.extname(filename).slice(1);
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                const content = fs.readFileSync(imagePath);
                const base64 = content.toString('base64');
                const dataUri = `data:image/${mimeType};base64,${base64}`;
                return `![${alt}](${dataUri})`;
            }
            return match;
        });
        
        // Process callout boxes
        processed = processMarkdownWithCallouts(processed);
        
        // Convert to HTML
        return marked.parse(processed);
    }

    /**
     * FUNÇÃO CRÍTICA: Quebra conteúdo em páginas
     */
    paginateContent(htmlContent) {
        // Por enquanto, retornar conteúdo sem paginar para evitar overflow
        // Vamos usar CSS page-break para deixar o navegador quebrar páginas
        return [htmlContent];
    }

    generateHTML() {
        console.log('\n🎨 Generating paginated HTML...');
        
        // Configure marked
        this.configureMarked();
        
        // Gerar páginas de conteúdo
        const allPages = [];
        
        // 1. Cover page
        allPages.push({
            type: 'cover',
            content: this.images.cover ? 
                `<img src="${this.images.cover}" alt="Book Cover">` :
                `<div class="cover-text">
                    <h1>${this.metadata.title}</h1>
                    <p>${this.metadata.author}</p>
                </div>`
        });
        
        // 2. TOC page
        const tocContent = `
            <h1>Table of Contents</h1>
            <div class="section-divider"></div>
            <ol class="toc">
                ${this.chapters.map((ch, idx) => `
                <li>
                    <span class="toc-title">${ch.number > 0 ? `Chapter ${ch.number}: ` : ''}${ch.title}</span>
                    <span class="toc-page">${idx + 3}</span>
                </li>
                `).join('')}
            </ol>
        `;
        allPages.push({
            type: 'toc',
            content: tocContent
        });
        
        // 3. Chapter pages (com paginação)
        for (const chapter of this.chapters) {
            // Primeira página do capítulo
            const chapterStart = `
                <div class="chapter-header">
                    ${chapter.number > 0 ? `<div class="chapter-number">Chapter ${chapter.number}</div>` : ''}
                    <h1 class="chapter-title">${chapter.title}</h1>
                </div>
                <div class="section-divider"></div>
                ${chapter.number > 0 && chapter.number <= 5 && this.images[`chapter${chapter.number}`] ? 
                    `<figure class="chapter-image">
                        <img src="${this.images[`chapter${chapter.number}`]}" alt="Chapter ${chapter.number} illustration">
                    </figure>` : ''}
            `;
            
            // Processar conteúdo do capítulo
            const chapterHTML = this.processChapterContent(chapter.content);
            
            // Paginar conteúdo
            const contentPages = this.paginateContent(chapterHTML);
            
            // Adicionar primeira página com header
            if (contentPages.length > 0) {
                allPages.push({
                    type: 'chapter-start',
                    chapterNumber: chapter.number,
                    content: chapterStart + '<div class="chapter-content">' + contentPages[0] + '</div>'
                });
                
                // Adicionar páginas subsequentes
                for (let i = 1; i < contentPages.length; i++) {
                    allPages.push({
                        type: 'chapter-continuation',
                        chapterNumber: chapter.number,
                        content: '<div class="chapter-content continuation">' + contentPages[i] + '</div>'
                    });
                }
            } else {
                // Capítulo vazio
                allPages.push({
                    type: 'chapter-start',
                    chapterNumber: chapter.number,
                    content: chapterStart + '<div class="chapter-content"></div>'
                });
            }
        }
        
        // 4. Back cover
        allPages.push({
            type: 'back-cover',
            content: `
                <div class="end-content">
                    <div class="section-divider"></div>
                    <h2>Thank you for reading!</h2>
                    <p>${this.metadata.title}</p>
                    <p>© ${new Date().getFullYear()} ${this.metadata.author}</p>
                    <p class="small">Built with Claude Elite Pipeline</p>
                </div>
            `
        });
        
        // Gerar HTML final
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* Reset e configuração base */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Georgia', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        /* Páginas - TAMANHO FIXO 6x9" */
        .page {
            width: 6in !important;
            height: 9in !important;
            position: relative;
            overflow: hidden;
            background: white;
            page-break-after: always;
            page-break-inside: avoid;
        }
        
        /* Margens para páginas de conteúdo */
        .page:not(.cover) {
            padding: 0.5in;
        }
        
        /* Cover page */
        .cover {
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .cover img {
            width: 6in;
            height: 9in;
            object-fit: cover;
        }
        
        .cover-text {
            text-align: center;
        }
        
        /* Chapter styling */
        .chapter-header {
            text-align: center;
            margin-bottom: 1rem;
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 2rem;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        
        .chapter-title {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }
        
        .section-divider {
            width: 3in;
            height: 2px;
            background: linear-gradient(90deg, transparent, #667eea, transparent);
            margin: 1rem auto;
        }
        
        /* Chapter images */
        .chapter-image {
            text-align: center;
            margin: 1rem 0;
        }
        
        .chapter-image img {
            max-width: 100%;
            max-height: 3in;
            width: auto;
            height: auto;
        }
        
        /* Content */
        .chapter-content {
            text-align: justify;
        }
        
        .chapter-content.continuation {
            padding-top: 0;
        }
        
        /* Evitar quebras ruins */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
        }
        
        p {
            orphans: 3;
            widows: 3;
        }
        
        .callout-box {
            page-break-inside: avoid;
        }
        
        .chapter-content p {
            margin-bottom: 0.8rem;
            text-indent: 0.3in;
        }
        
        .chapter-content p:first-of-type {
            text-indent: 0;
        }
        
        h1, h2, h3 {
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            text-align: left;
        }
        
        h1 { font-size: 1.5rem; }
        h2 { font-size: 1.3rem; }
        h3 { font-size: 1.1rem; }
        
        /* Code blocks */
        .code-block {
            background: #f4f4f4;
            border: 1px solid #ddd;
            padding: 0.5rem;
            margin: 0.75rem 0;
            font-family: monospace;
            font-size: 9pt;
            overflow-x: auto;
        }
        
        /* Callout boxes */
        .callout-box {
            border-left: 4px solid;
            padding: 0.75rem;
            margin: 1rem 0;
            background: #f9f9f9;
            page-break-inside: avoid;
        }
        
        .tip-box { border-color: #10b981; background: #f0fdf4; }
        .warning-box { border-color: #f59e0b; background: #fffbeb; }
        .info-box { border-color: #3b82f6; background: #eff6ff; }
        
        /* Images */
        .content-image img {
            max-width: 100%;
            height: auto;
        }
        
        /* TOC */
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            margin-bottom: 0.5rem;
        }
        
        .toc-title {
            flex: 1;
        }
        
        .toc-page {
            text-align: right;
        }
        
        /* Back cover */
        .end-content {
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            height: 100%;
        }
        
        .small {
            font-size: 0.9rem;
            opacity: 0.8;
            margin-top: 2rem;
        }
    </style>
</head>
<body>
${allPages.map((page, index) => `
    <div class="page ${page.type === 'cover' ? 'cover' : 
                       page.type === 'toc' ? 'toc-page' : 
                       page.type === 'back-cover' ? 'back-cover' : 
                       'chapter-page'}" 
         data-page-number="${index + 1}">
        ${page.content}
    </div>
`).join('\n')}
</body>
</html>`;

        console.log(`✅ Generated ${allPages.length} pages`);
        return html;
    }

    async run() {
        try {
            console.log('📄 PAGINATED HTML FORMATTER');
            console.log('===========================\n');
            
            await fs.ensureDir(path.dirname(this.outputPath));
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            
            const html = this.generateHTML();
            
            await fs.writeFile(this.outputPath, html);
            
            console.log('\n✅ Paginated HTML generated successfully!');
            console.log(`📍 Output: ${this.outputPath}`);
            
            const stats = await fs.stat(this.outputPath);
            console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const formatter = new PaginatedHTMLFormatter();
    formatter.run();
}

module.exports = PaginatedHTMLFormatter;