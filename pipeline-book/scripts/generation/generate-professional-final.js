#!/usr/bin/env node

/**
 * PROFESSIONAL FINAL PDF GENERATOR
 * - Small, elegant typography (9pt)
 * - Dense layout for serious readers
 * - Perfect page breaks
 * - Adobe Reader compatible
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { processMarkdownWithCallouts } = require('../utils/callout-box-parser');

// Prism.js for syntax highlighting
const Prism = require('prismjs');
require('prismjs/components/prism-javascript');
require('prismjs/components/prism-typescript');
require('prismjs/components/prism-python');
require('prismjs/components/prism-bash');
require('prismjs/components/prism-json');
require('prismjs/components/prism-yaml');
require('prismjs/components/prism-markdown');

class ProfessionalFinalPDFGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/professional-final.pdf');
        this.metadata = null;
        this.chapters = [];
        this.images = {};
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
            .filter(f => f.endsWith('.md'))
            .sort();

        for (const file of chapterFiles) {
            const content = await fs.readFile(path.join(chaptersDir, file), 'utf8');
            const chapterNum = parseInt(file.match(/\d+/)?.[0] || '0');
            
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)?\n---/);
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
    }

    async loadImages() {
        console.log('\n🖼️  Loading images...');
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover
        const coverSvgPath = path.join(imagesDir, 'cover-premium.svg');
        const coverPngPath = path.join(imagesDir, 'cover.png');
        
        if (await fs.pathExists(coverSvgPath)) {
            const svgContent = await fs.readFile(coverSvgPath, 'utf8');
            this.images.cover = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
            console.log(`  ✓ Cover SVG embedded`);
        } else if (await fs.pathExists(coverPngPath)) {
            const buffer = await fs.readFile(coverPngPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover PNG embedded`);
        }

        // Load chapter images - smaller versions
        for (let i = 1; i <= 5; i++) {
            const svgPath = path.join(imagesDir, `chapter-0${i}-premium.svg`);
            const pngPath = path.join(imagesDir, `chapter-0${i}-architecture-horizontal.png`);
            
            if (await fs.pathExists(svgPath)) {
                const svgContent = await fs.readFile(svgPath, 'utf8');
                this.images[`chapter${i}`] = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
                console.log(`  ✓ Chapter ${i} SVG embedded`);
            } else if (await fs.pathExists(pngPath)) {
                const buffer = await fs.readFile(pngPath);
                this.images[`chapter${i}`] = `data:image/png;base64,${buffer.toString('base64')}`;
                console.log(`  ✓ Chapter ${i} PNG embedded`);
            }
        }
    }

    configureMarked() {
        const renderer = new marked.Renderer();
        
        renderer.code = (code, language) => {
            if (language && Prism.languages[language]) {
                const highlighted = Prism.highlight(code, Prism.languages[language], language);
                return `<pre class="code-block language-${language}"><code>${highlighted}</code></pre>`;
            }
            return `<pre class="code-block"><code>${this.escapeHtml(code)}</code></pre>`;
        };

        renderer.heading = (text, level) => {
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');
            return `<h${level} id="${id}" class="heading-${level}">${text}</h${level}>`;
        };

        renderer.table = (header, body) => {
            return `<div class="table-wrapper">
                <table>
                    <thead>${header}</thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
        };

        renderer.image = (href, title, text) => {
            return `<figure class="image-figure">
                <img src="${href}" alt="${text}" title="${title || ''}">
                ${title ? `<figcaption>${title}</figcaption>` : ''}
            </figure>`;
        };

        marked.setOptions({
            renderer,
            highlight: (code, lang) => {
                if (Prism.languages[lang]) {
                    return Prism.highlight(code, Prism.languages[lang], lang);
                }
                return code;
            },
            breaks: false, // Professional books don't use breaks
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
        let processed = processMarkdownWithCallouts(markdown);
        processed = marked.parse(processed);
        return processed;
    }

    generateHTML() {
        console.log('\n🎨 Generating PROFESSIONAL HTML...');
        
        const visualTheme = this.metadata.visual_theme || {
            primary_gradient: ['#667eea', '#764ba2'],
            secondary_gradient: ['#f093fb', '#f5576c'],
            accent_color: '#FFD700'
        };

        // Generate chapters with professional layout
        const chaptersHTML = this.chapters.map((chapter, index) => `
            <div class="chapter" data-chapter="${chapter.number}">
                <div class="chapter-header">
                    <div class="chapter-number">Chapter ${chapter.number}</div>
                    <h1 class="chapter-title">${chapter.title}</h1>
                </div>
                ${chapter.number <= 5 && this.images[`chapter${chapter.number}`] ? `
                    <figure class="chapter-image">
                        <img src="${this.images[`chapter${chapter.number}`]}" alt="Chapter ${chapter.number} illustration">
                    </figure>
                ` : ''}
                <div class="chapter-content">
                    ${this.processChapterContent(chapter.content)}
                </div>
            </div>
        `).join('\n');

        // PROFESSIONAL CSS - Small, dense, elegant
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* CSS Variables */
        :root {
            --primary-color: #1a202c;
            --secondary-color: #4a5568;
            --accent-color: ${visualTheme.accent_color || '#FFD700'};
            --page-width: 6in;
            --page-height: 9in;
            --margin-top: 0.4in;
            --margin-bottom: 0.5in;
            --margin-outer: 0.4in;
            --margin-inner: 0.4in;
            --base-font-size: 9pt;
            --line-height: 1.35;
        }
        
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Page setup */
        @page {
            size: 6in 9in;
            margin: 0.4in;
            
            @bottom-center {
                content: counter(page);
                font-family: 'Georgia', serif;
                font-size: 8pt;
                color: #666;
            }
        }
        
        @page :first {
            margin: 0;
            @bottom-center { content: none; }
        }
        
        @page chapter {
            @top-center { content: none; }
            @bottom-center { content: counter(page); }
        }
        
        /* Base typography - PROFESSIONAL DENSITY */
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: var(--base-font-size);
            line-height: var(--line-height);
            color: var(--primary-color);
            text-rendering: optimizeLegibility;
            font-kerning: normal;
            font-variant-ligatures: common-ligatures;
            hyphens: auto;
            -webkit-hyphens: auto;
            -moz-hyphens: auto;
            -ms-hyphens: auto;
        }
        
        /* Cover - full bleed */
        .cover {
            position: relative;
            width: var(--page-width);
            height: var(--page-height);
            margin: 0;
            padding: 0;
            page-break-after: always;
            overflow: hidden;
        }
        
        .cover img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* TOC - Professional style */
        .toc-page {
            page-break-after: always;
            padding: var(--margin-top) var(--margin-outer) var(--margin-bottom) var(--margin-inner);
        }
        
        .toc-page h1 {
            font-size: 14pt;
            font-weight: normal;
            text-align: center;
            margin-bottom: 1.5rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }
        
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            align-items: baseline;
            margin-bottom: 0.4rem;
            font-size: var(--base-font-size);
        }
        
        .toc-title {
            flex: 1;
            padding-right: 0.5rem;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #999;
            margin: 0 0.3rem;
            height: 0.4rem;
        }
        
        .toc-page-num {
            font-size: 8pt;
        }
        
        /* Chapters - Professional layout */
        .chapter {
            page: chapter;
            page-break-before: always;
        }
        
        .chapter-header {
            text-align: center;
            margin-bottom: 2rem;
            page-break-after: avoid;
        }
        
        .chapter-number {
            font-size: 10pt;
            font-weight: normal;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: var(--secondary-color);
            margin-bottom: 0.5rem;
        }
        
        .chapter-title {
            font-size: 16pt;
            font-weight: normal;
            line-height: 1.2;
            margin-bottom: 0.5rem;
        }
        
        /* Chapter content - DENSE PROFESSIONAL */
        .chapter-content {
            text-align: justify;
            column-count: 1;
            column-gap: 0;
        }
        
        /* Paragraphs - Professional spacing */
        .chapter-content p {
            margin-bottom: 0.6rem;
            text-indent: 1.5em;
            orphans: 3;
            widows: 3;
        }
        
        .chapter-content p:first-of-type {
            text-indent: 0;
        }
        
        /* NO DROP CAPS - too flashy */
        
        /* Headings - Subtle and professional */
        .chapter-content h1,
        .chapter-content h2,
        .chapter-content h3,
        .chapter-content h4 {
            font-weight: normal;
            margin-top: 1.2rem;
            margin-bottom: 0.6rem;
            page-break-after: avoid;
            orphans: 3;
            widows: 3;
        }
        
        .chapter-content h1 { font-size: 12pt; }
        .chapter-content h2 { font-size: 11pt; }
        .chapter-content h3 { font-size: 10pt; }
        .chapter-content h4 { font-size: 9pt; font-style: italic; }
        
        /* Lists - Compact */
        .chapter-content ul,
        .chapter-content ol {
            margin-left: 1.5em;
            margin-bottom: 0.6rem;
        }
        
        .chapter-content li {
            margin-bottom: 0.2rem;
        }
        
        /* Images - Controlled sizing */
        .chapter-image {
            margin: 1rem 0;
            text-align: center;
            page-break-inside: avoid;
            page-break-before: auto;
            page-break-after: auto;
        }
        
        .chapter-image img {
            max-width: 100%;
            max-height: 2.5in;
            width: auto;
            height: auto;
            display: inline-block;
        }
        
        .image-figure {
            margin: 0.8rem 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .image-figure img {
            max-width: 100%;
            max-height: 2in;
        }
        
        figcaption {
            font-size: 8pt;
            color: var(--secondary-color);
            font-style: italic;
            margin-top: 0.3rem;
        }
        
        /* Callout boxes - Subtle */
        .callout-box {
            margin: 0.8rem 0;
            padding: 0.5rem 0.7rem;
            border-left: 3px solid;
            background: #f8f9fa;
            font-size: 8.5pt;
            page-break-inside: avoid;
        }
        
        .tip-box { border-left-color: #17a2b8; background: #e8f4f8; }
        .warning-box { border-left-color: #ffc107; background: #fff8e1; }
        .success-box { border-left-color: #28a745; background: #e8f5e9; }
        .info-box { border-left-color: #007bff; background: #e3f2fd; }
        .quote-box { border-left-color: #6c757d; background: #f5f5f5; font-style: italic; }
        .key-box { border-left-color: var(--accent-color); background: #fffbf0; }
        
        .callout-box-title {
            font-weight: bold;
            font-size: 9pt;
            margin-bottom: 0.2rem;
        }
        
        /* Code blocks - Compact */
        .code-block {
            background: #f5f5f5;
            border: 1px solid #ddd;
            padding: 0.4rem 0.5rem;
            margin: 0.6rem 0;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 7.5pt;
            line-height: 1.3;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        code {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 8pt;
            background: #f0f0f0;
            padding: 0.1rem 0.2rem;
            border-radius: 2px;
        }
        
        /* Tables - Professional */
        .table-wrapper {
            margin: 0.8rem 0;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
        }
        
        th, td {
            padding: 0.3rem 0.5rem;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        th {
            font-weight: bold;
            border-bottom: 2px solid #333;
        }
        
        /* Blockquotes */
        blockquote {
            margin: 0.8rem 0;
            padding-left: 0.8rem;
            border-left: 2px solid #ccc;
            font-style: italic;
            color: var(--secondary-color);
        }
        
        /* Page breaks - Critical for proper layout */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
        }
        
        p {
            orphans: 3;
            widows: 3;
        }
        
        .keep-together {
            page-break-inside: avoid;
        }
        
        /* End page */
        .end-page {
            page-break-before: always;
            text-align: center;
            padding-top: 3in;
            font-size: var(--base-font-size);
        }
        
        /* Print optimization */
        @media print {
            body {
                color: #000;
            }
            
            .callout-box {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #1a202c; color: white;">
                <div style="text-align: center;">
                    <h1 style="font-size: 24pt; margin-bottom: 0.5rem; font-weight: normal;">${this.metadata.title}</h1>
                    <p style="font-size: 12pt; margin-top: 1rem;">${this.metadata.author}</p>
                </div>
            </div>`
        }
    </div>
    
    <!-- Table of Contents -->
    <div class="toc-page">
        <h1>Contents</h1>
        <ol class="toc">
            ${this.chapters.map((ch, idx) => `
                <li>
                    <span class="toc-title">${ch.title}</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page-num">${(idx + 1) * 15}</span>
                </li>
            `).join('\n')}
        </ol>
    </div>
    
    <!-- Chapters -->
    ${chaptersHTML}
    
    <!-- End -->
    <div class="end-page">
        <p style="font-size: 10pt; font-style: italic;">~ End ~</p>
        <p style="font-size: 8pt; margin-top: 2rem; color: #666;">
            ${this.metadata.title}<br>
            © ${new Date().getFullYear()} ${this.metadata.author}
        </p>
    </div>
</body>
</html>`;

        return html;
    }

    async generatePDF() {
        console.log('\n🚀 Launching Puppeteer for PROFESSIONAL PDF...');
        
        await fs.ensureDir(path.dirname(this.outputPath));
        
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--font-render-hinting=none' // Better font rendering
            ]
        });

        try {
            const page = await browser.newPage();
            
            // Configure marked
            this.configureMarked();
            
            // Generate HTML
            const html = this.generateHTML();
            
            // Save debug HTML
            const debugPath = path.join(this.projectRoot, 'build/professional-final-debug.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved`);
            
            // Set content
            await page.setContent(html, {
                waitUntil: ['networkidle0', 'domcontentloaded', 'load']
            });
            
            // Wait for fonts
            await page.evaluateHandle('document.fonts.ready');
            
            // Additional wait for complete rendering
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Generate PDF with professional settings
            console.log('\n📑 Generating PROFESSIONAL PDF...');
            await page.pdf({
                path: this.outputPath,
                format: 'Letter', // Use standard format
                width: '6in',
                height: '9in',
                printBackground: true,
                displayHeaderFooter: false,
                margin: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                },
                preferCSSPageSize: true,
                scale: 1.0
            });
            
            // Verify
            const { PDFDocument } = require('pdf-lib');
            const pdfBytes = await fs.readFile(this.outputPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            
            console.log(`\n✅ Professional PDF generated!`);
            console.log(`📍 Output: ${this.outputPath}`);
            console.log(`📄 Pages: ${pages.length}`);
            console.log(`📏 Size: ${(pdfBytes.length / 1024 / 1024).toFixed(2)} MB`);
            
        } finally {
            await browser.close();
        }
    }

    async run() {
        try {
            console.log('🎯 PROFESSIONAL FINAL PDF GENERATOR');
            console.log('===================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 Professional PDF ready!');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run
if (require.main === module) {
    const generator = new ProfessionalFinalPDFGenerator();
    generator.run();
}

module.exports = ProfessionalFinalPDFGenerator;