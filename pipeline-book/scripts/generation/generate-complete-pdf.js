#!/usr/bin/env node

/**
 * COMPLETE PDF GENERATOR - All Pages Included
 * Fixes the single-page issue by properly handling page breaks
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

class CompletePDFGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/complete-ebook.pdf');
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

        // Load chapter images
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
            const imgClass = text.toLowerCase().includes('diagram') ? 'diagram-image' : 'content-image';
            return `<figure class="image-figure">
                <img src="${href}" alt="${text}" title="${title || ''}" class="${imgClass}">
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
        let processed = processMarkdownWithCallouts(markdown);
        processed = marked.parse(processed);
        return processed;
    }

    generateHTML() {
        console.log('\n🎨 Generating COMPLETE HTML...');
        
        const professionalCSS = fs.readFileSync(
            path.join(this.projectRoot, 'assets/css/professional-web-style.css'), 
            'utf8'
        );
        
        const visualTheme = this.metadata.visual_theme || {
            primary_gradient: ['#667eea', '#764ba2'],
            secondary_gradient: ['#f093fb', '#f5576c'],
            accent_color: '#FFD700'
        };

        // Generate ALL chapters
        const chaptersHTML = this.chapters.map((chapter, index) => `
            <div class="page chapter-page">
                <div class="chapter-header">
                    <div class="chapter-number">Chapter ${chapter.number}</div>
                    <h1 class="chapter-title">${chapter.title}</h1>
                </div>
                <div class="section-divider"></div>
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

        // CRITICAL: Fixed CSS for proper page breaks
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        :root {
            --primary-gradient-start: ${visualTheme.primary_gradient?.[0] || '#667eea'};
            --primary-gradient-end: ${visualTheme.primary_gradient?.[1] || '#764ba2'};
            --secondary-gradient-start: ${visualTheme.secondary_gradient?.[0] || '#f093fb'};
            --secondary-gradient-end: ${visualTheme.secondary_gradient?.[1] || '#f5576c'};
            --accent-color: ${visualTheme.accent_color || '#FFD700'};
        }
        
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* CRITICAL: Remove all height restrictions */
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: auto; /* NOT fixed height */
        }
        
        /* Page setup for print */
        @page {
            size: 6in 9in;
            margin: 0;
        }
        
        @page :first {
            margin: 0;
        }
        
        /* Base typography */
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a202c;
        }
        
        /* Cover page - full bleed */
        .cover {
            position: relative;
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            page-break-after: always;
            page-break-inside: avoid;
        }
        
        .cover img {
            position: absolute;
            top: 0;
            left: 0;
            width: 6in;
            height: 9in;
            object-fit: cover;
        }
        
        /* Regular pages */
        .page {
            position: relative;
            width: 6in;
            min-height: 9in; /* MIN height, not fixed */
            padding: 0.5in;
            page-break-after: always;
            page-break-inside: avoid;
        }
        
        /* Prevent last page from breaking */
        .page:last-child {
            page-break-after: auto;
        }
        
        /* Content should flow naturally */
        .chapter-content {
            width: 100%;
            height: auto;
        }
        
        /* Headers */
        .chapter-header {
            text-align: center;
            margin-bottom: 1.5rem;
        }
        
        .chapter-number {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
        }
        
        .chapter-title {
            font-size: 1.8rem;
            font-weight: 700;
        }
        
        .section-divider {
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
            margin: 1rem 0 1.5rem;
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            font-weight: 700;
            line-height: 1.3;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            page-break-after: avoid;
        }
        
        p {
            margin-bottom: 0.75rem;
            text-align: justify;
            hyphens: auto;
        }
        
        /* Images */
        .chapter-image {
            margin: 1.5rem 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .chapter-image img {
            max-width: 100%;
            max-height: 3in;
            width: auto;
            height: auto;
        }
        
        /* Callout boxes */
        .callout-box {
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 0.5rem;
            border-left: 4px solid;
            page-break-inside: avoid;
        }
        
        .tip-box {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            border-left-color: #5dd3d0;
        }
        
        .warning-box {
            background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
            border-left-color: #fdcb6e;
        }
        
        .success-box {
            background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%);
            border-left-color: #00b894;
        }
        
        .info-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-left-color: #5f3dc4;
            color: white;
        }
        
        .quote-box {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            border-left-color: #e84393;
        }
        
        .key-box {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border-left-color: #FFD700;
            border-left-width: 6px;
        }
        
        /* Code blocks */
        .code-block {
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.375rem;
            padding: 1rem;
            margin: 1rem 0;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 9pt;
            line-height: 1.5;
            page-break-inside: avoid;
        }
        
        /* Syntax highlighting */
        .token.comment { color: #6a737d; }
        .token.string { color: #032f62; }
        .token.keyword { color: #d73a49; }
        .token.function { color: #6f42c1; }
        .token.number { color: #005cc5; }
        .token.operator { color: #d73a49; }
        .token.class-name { color: #22863a; }
        
        /* TOC */
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            align-items: baseline;
            margin-bottom: 0.5rem;
        }
        
        .toc-title {
            flex: 1;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #cbd5e0;
            margin: 0 0.5rem;
            height: 0.5rem;
        }
        
        .toc-page {
            font-weight: 500;
        }
        
        /* Drop caps */
        .chapter-content > p:first-of-type::first-letter {
            float: left;
            font-size: 3.5rem;
            line-height: 3rem;
            padding-right: 0.5rem;
            margin-top: -0.2rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        /* Import professional CSS but override problematic rules */
        ${professionalCSS}
        
        /* CRITICAL OVERRIDES */
        .page {
            width: 6in !important;
            min-height: 9in !important;
            height: auto !important; /* Allow content to flow */
            overflow: visible !important; /* Don't hide content */
            padding: 0.5in !important;
        }
        
        .cover {
            width: 6in !important;
            height: 9in !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important; /* Only cover can have hidden */
        }
        
        body {
            height: auto !important;
            overflow: visible !important;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="position: absolute; top: 0; left: 0; width: 6in; height: 9in; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white;">
                <div style="text-align: center;">
                    <h1 style="font-size: 3rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
                    <h2 style="font-size: 1.5rem; font-weight: 300;">${this.metadata.subtitle || ''}</h2>
                    <p style="font-size: 1.2rem; margin-top: 2rem;">${this.metadata.author}</p>
                </div>
            </div>`
        }
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page">
        <h1>Table of Contents</h1>
        <div class="section-divider"></div>
        <ol class="toc">
            ${this.chapters.map(ch => `
                <li>
                    <span class="toc-title">Chapter ${ch.number}: ${ch.title}</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page">${ch.number * 10}</span>
                </li>
            `).join('\n')}
        </ol>
    </div>
    
    <!-- ALL Chapters -->
    ${chaptersHTML}
    
    <!-- End matter -->
    <div class="page end-page">
        <div style="text-align: center; margin-top: 3rem;">
            <div class="section-divider"></div>
            <p style="font-size: 1.2rem; margin-top: 2rem;">Thank you for reading!</p>
            <p style="margin-top: 1rem; color: #666;">
                ${this.metadata.title}<br>
                © ${new Date().getFullYear()} ${this.metadata.author}
            </p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async generatePDF() {
        console.log('\n🚀 Launching Puppeteer for COMPLETE PDF...');
        
        await fs.ensureDir(path.dirname(this.outputPath));
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Configure marked
            this.configureMarked();
            
            // Generate HTML
            const html = this.generateHTML();
            
            // Save debug HTML
            const debugPath = path.join(this.projectRoot, 'build/complete-debug.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
            
            // Set content
            await page.setContent(html, {
                waitUntil: ['networkidle0', 'domcontentloaded']
            });
            
            // Wait for all content to render
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Count pages in HTML
            const pageCount = await page.evaluate(() => {
                return document.querySelectorAll('.page, .cover').length;
            });
            console.log(`  ✓ HTML has ${pageCount} pages`);
            
            // Generate PDF
            console.log('\n📑 Generating COMPLETE PDF with all pages...');
            await page.pdf({
                path: this.outputPath,
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
                preferCSSPageSize: false
            });
            
            // Verify PDF pages
            const { PDFDocument } = require('pdf-lib');
            const pdfBytes = await fs.readFile(this.outputPath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pdfPages = pdfDoc.getPages();
            
            console.log(`\n✅ PDF generated with ${pdfPages.length} pages!`);
            console.log(`📍 Output: ${this.outputPath}`);
            
            // File size
            const stats = await fs.stat(this.outputPath);
            console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
            if (pdfPages.length < pageCount) {
                console.error(`\n⚠️  WARNING: Expected ${pageCount} pages but PDF has ${pdfPages.length}`);
            }
            
        } finally {
            await browser.close();
        }
    }

    async run() {
        try {
            console.log('🎯 COMPLETE PDF GENERATOR - All Pages');
            console.log('=====================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 Complete PDF generated successfully!');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new CompletePDFGenerator();
    generator.run();
}

module.exports = CompletePDFGenerator;