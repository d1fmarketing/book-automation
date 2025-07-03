#!/usr/bin/env node

/**
 * FINAL PERFECT PDF GENERATOR
 * - Exact 6×9 inch (432×648 points) dimensions
 * - Zero margin on cover for full bleed
 * - Adobe Reader compatible
 * - All images embedded as base64
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

class FinalPerfectPDFGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/premium-ebook-perfect.pdf');
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
            
            // Extract frontmatter
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
        
        // CRITICAL: Embed ALL images as base64
        const coverSvgPath = path.join(imagesDir, 'cover-premium.svg');
        const coverPngPath = path.join(imagesDir, 'cover.png');
        
        if (await fs.pathExists(coverSvgPath)) {
            const svgContent = await fs.readFile(coverSvgPath, 'utf8');
            this.images.cover = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
            console.log(`  ✓ Premium SVG cover loaded and embedded`);
        } else if (await fs.pathExists(coverPngPath)) {
            const buffer = await fs.readFile(coverPngPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover PNG loaded and embedded (${(buffer.length / 1024).toFixed(0)} KB)`);
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
                console.log(`  ✓ Chapter ${i} PNG embedded (${(buffer.length / 1024).toFixed(0)} KB)`);
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
        console.log('\n🎨 Generating PERFECT HTML...');
        
        // Load CSS
        const professionalCSS = fs.readFileSync(
            path.join(this.projectRoot, 'assets/css/professional-web-style.css'), 
            'utf8'
        );
        
        const visualTheme = this.metadata.visual_theme || {
            primary_gradient: ['#667eea', '#764ba2'],
            secondary_gradient: ['#f093fb', '#f5576c'],
            accent_color: '#FFD700'
        };

        // Generate chapters HTML
        const chaptersHTML = this.chapters.map((chapter, index) => `
            <div class="page chapter-page" data-page-type="chapter">
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

        // CRITICAL HTML with EXACT specifications
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* CRITICAL: Root variables */
        :root {
            --primary-gradient-start: ${visualTheme.primary_gradient?.[0] || '#667eea'};
            --primary-gradient-end: ${visualTheme.primary_gradient?.[1] || '#764ba2'};
            --secondary-gradient-start: ${visualTheme.secondary_gradient?.[0] || '#f093fb'};
            --secondary-gradient-end: ${visualTheme.secondary_gradient?.[1] || '#f5576c'};
            --accent-color: ${visualTheme.accent_color || '#FFD700'};
        }
        
        /* CRITICAL: Reset ALL margins and paddings */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 432pt !important;
            height: 648pt !important;
            overflow: hidden;
        }
        
        /* CRITICAL: Page dimensions EXACTLY 6×9 inches */
        @page {
            size: 432pt 648pt !important;
            margin: 0 !important;
        }
        
        @page :first {
            margin: 0 !important;
        }
        
        /* Base styles */
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a202c;
        }
        
        /* CRITICAL: Cover page - FULL BLEED, NO MARGINS */
        .cover {
            position: relative;
            width: 432pt !important;
            height: 648pt !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            overflow: hidden;
            background: #000; /* Fallback */
        }
        
        .cover img {
            position: absolute;
            top: 0 !important;
            left: 0 !important;
            width: 432pt !important;
            height: 648pt !important;
            margin: 0 !important;
            padding: 0 !important;
            object-fit: cover;
            display: block;
        }
        
        /* Regular pages with margins */
        .page {
            position: relative;
            width: 432pt !important;
            height: 648pt !important;
            padding: 36pt !important; /* 0.5 inch margins */
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
        }
        
        /* Content area */
        .chapter-content {
            max-width: 360pt; /* 432pt - 72pt margins */
            margin: 0 auto;
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            font-weight: 700;
            line-height: 1.3;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
        }
        
        p {
            margin-bottom: 0.75rem;
            text-align: justify;
            hyphens: auto;
        }
        
        /* Chapter styling */
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
            color: #1a202c;
        }
        
        .section-divider {
            height: 3px;
            background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
            margin: 1rem 0 1.5rem;
        }
        
        /* Callout boxes */
        .callout-box {
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 0.5rem;
            border-left: 4px solid;
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
        }
        
        /* Syntax highlighting */
        .token.comment { color: #6a737d; }
        .token.string { color: #032f62; }
        .token.keyword { color: #d73a49; }
        .token.function { color: #6f42c1; }
        .token.number { color: #005cc5; }
        .token.operator { color: #d73a49; }
        .token.class-name { color: #22863a; }
        
        /* Images */
        .chapter-image {
            margin: 1.5rem 0;
            text-align: center;
        }
        
        .chapter-image img {
            max-width: 100%;
            max-height: 200pt;
            width: auto;
            height: auto;
        }
        
        /* Table of Contents */
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            align-items: baseline;
            margin-bottom: 0.5rem;
            font-size: 11pt;
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
        
        /* Professional CSS import */
        ${professionalCSS}
        
        /* OVERRIDE any conflicting margins */
        .page {
            width: 432pt !important;
            height: 648pt !important;
            padding: 36pt !important;
        }
        
        .cover {
            width: 432pt !important;
            height: 648pt !important;
            margin: 0 !important;
            padding: 0 !important;
        }
    </style>
</head>
<body>
    <!-- CRITICAL: Cover Page - FULL BLEED -->
    <div class="cover" data-page-type="cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="position: absolute; top: 0; left: 0; width: 432pt; height: 648pt; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white;">
                <div style="text-align: center;">
                    <h1 style="font-size: 3rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
                    <h2 style="font-size: 1.5rem; font-weight: 300;">${this.metadata.subtitle || ''}</h2>
                    <p style="font-size: 1.2rem; margin-top: 2rem;">${this.metadata.author}</p>
                </div>
            </div>`
        }
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page" data-page-type="toc">
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
    
    <!-- Chapters -->
    ${chaptersHTML}
    
    <!-- End matter -->
    <div class="page end-page" data-page-type="end">
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
        console.log('\n🚀 Launching Puppeteer for PERFECT PDF...');
        
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
            const debugPath = path.join(this.projectRoot, 'build/final-perfect-debug.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
            
            // CRITICAL: Set content with proper encoding
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });
            
            // Wait for fonts to load
            await page.evaluateHandle('document.fonts.ready');
            
            // CRITICAL: Generate PDF with EXACT specifications
            console.log('\n📑 Generating PERFECT 6×9 PDF...');
            await page.pdf({
                path: this.outputPath,
                // DO NOT USE format - it overrides dimensions!
                width: '6in',    // Exactly 6 inches
                height: '9in',   // Exactly 9 inches
                printBackground: true,
                displayHeaderFooter: false,
                margin: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                },
                preferCSSPageSize: false, // Let Puppeteer control size
                scale: 1.0
            });
            
            console.log(`\n✅ PERFECT PDF generated!`);
            console.log(`📍 Output: ${this.outputPath}`);
            
            // Verify size
            const stats = await fs.stat(this.outputPath);
            console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
        } finally {
            await browser.close();
        }
    }

    async run() {
        try {
            console.log('🎯 FINAL PERFECT PDF GENERATOR');
            console.log('================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 Generation complete! Running QA...');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new FinalPerfectPDFGenerator();
    generator.run();
}

module.exports = FinalPerfectPDFGenerator;