#!/usr/bin/env node

/**
 * FIXED Premium PDF Generator with Proper 6x9 Layout
 * - Correct page size (6x9 inches)
 * - Optimized margins for maximum content
 * - Professional typography with proper text density
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

class PremiumPDFGeneratorFixed {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/premium-ebook-fixed.pdf');
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
        
        // Try to load premium SVG cover first, then fall back to PNG
        const coverSvgPath = path.join(imagesDir, 'cover-premium.svg');
        const coverPngPath = path.join(imagesDir, 'cover.png');
        
        if (await fs.pathExists(coverSvgPath)) {
            const svgContent = await fs.readFile(coverSvgPath, 'utf8');
            this.images.cover = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
            console.log(`  ✓ Premium SVG cover loaded`);
        } else if (await fs.pathExists(coverPngPath)) {
            const buffer = await fs.readFile(coverPngPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
        }

        // Load chapter images
        for (let i = 1; i <= 5; i++) {
            const svgPath = path.join(imagesDir, `chapter-0${i}-premium.svg`);
            const pngPath = path.join(imagesDir, `chapter-0${i}-architecture-horizontal.png`);
            
            if (await fs.pathExists(svgPath)) {
                const svgContent = await fs.readFile(svgPath, 'utf8');
                this.images[`chapter${i}`] = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
                console.log(`  ✓ Chapter ${i} premium SVG loaded`);
            } else if (await fs.pathExists(pngPath)) {
                const buffer = await fs.readFile(pngPath);
                this.images[`chapter${i}`] = `data:image/png;base64,${buffer.toString('base64')}`;
                console.log(`  ✓ Chapter ${i} image loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
            }
        }
    }

    configureMarked() {
        // Configure marked with custom renderer for enhanced features
        const renderer = new marked.Renderer();
        
        // Custom code rendering with syntax highlighting
        renderer.code = (code, language) => {
            if (language && Prism.languages[language]) {
                const highlighted = Prism.highlight(code, Prism.languages[language], language);
                return `<pre class="code-block language-${language}"><code>${highlighted}</code></pre>`;
            }
            return `<pre class="code-block"><code>${this.escapeHtml(code)}</code></pre>`;
        };

        // Custom heading renderer for better styling
        renderer.heading = (text, level) => {
            const id = text.toLowerCase().replace(/[^\w]+/g, '-');
            return `<h${level} id="${id}" class="heading-${level}">${text}</h${level}>`;
        };

        // Custom table renderer
        renderer.table = (header, body) => {
            return `<div class="table-wrapper">
                <table>
                    <thead>${header}</thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
        };

        // Custom image renderer to ensure proper sizing
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
        // First, process callout boxes
        let processed = processMarkdownWithCallouts(markdown);
        
        // Then convert remaining markdown to HTML
        processed = marked.parse(processed);
        
        return processed;
    }

    generateHTML() {
        console.log('\n🎨 Generating optimized HTML...');
        
        // Load CSS files
        const professionalCSS = fs.readFileSync(
            path.join(this.projectRoot, 'assets/css/professional-web-style.css'), 
            'utf8'
        );
        
        // Get theme colors from metadata
        const theme = this.metadata.theme || {};
        const visualTheme = this.metadata.visual_theme || {
            primary_gradient: ['#667eea', '#764ba2'],
            secondary_gradient: ['#f093fb', '#f5576c'],
            accent_color: '#FFD700'
        };

        // Generate CSS variables for dynamic theming
        const cssVariables = `
            :root {
                --primary-gradient-start: ${visualTheme.primary_gradient?.[0] || '#667eea'};
                --primary-gradient-end: ${visualTheme.primary_gradient?.[1] || '#764ba2'};
                --secondary-gradient-start: ${visualTheme.secondary_gradient?.[0] || '#f093fb'};
                --secondary-gradient-end: ${visualTheme.secondary_gradient?.[1] || '#f5576c'};
                --accent-color: ${visualTheme.accent_color || '#FFD700'};
            }
        `;

        // Generate chapters HTML
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

        // Generate complete HTML with FIXED styles
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        ${cssVariables}
        ${professionalCSS}
        
        /* CRITICAL FIXES FOR 6x9 LAYOUT */
        @page {
            size: 6in 9in !important;
            margin: 0.5in 0.5in 0.6in 0.5in !important; /* Reduced margins */
        }
        
        /* Reset page dimensions */
        body {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11pt !important; /* Increased from default */
            line-height: 1.6 !important; /* Optimized line spacing */
        }
        
        .page {
            width: 5in !important; /* 6in - 1in margins */
            min-height: 7.8in !important; /* 9in - 1.2in margins */
            max-height: 7.8in !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
            box-sizing: border-box;
        }
        
        /* Optimize chapter headers */
        .chapter-header {
            margin-bottom: 0.5rem !important;
        }
        
        .chapter-number {
            font-size: 2.5rem !important; /* Reduced from 3rem */
            margin-bottom: 0.25rem !important;
        }
        
        .chapter-title {
            font-size: 1.8rem !important; /* Reduced from 2.5rem */
            margin-bottom: 0.5rem !important;
        }
        
        /* Content optimization */
        .chapter-content {
            font-size: 11pt !important;
            line-height: 1.6 !important;
        }
        
        .chapter-content h1 { font-size: 1.5rem !important; margin: 1.5rem 0 0.75rem !important; }
        .chapter-content h2 { font-size: 1.3rem !important; margin: 1.25rem 0 0.6rem !important; }
        .chapter-content h3 { font-size: 1.1rem !important; margin: 1rem 0 0.5rem !important; }
        
        .chapter-content p {
            margin-bottom: 0.8rem !important;
            text-align: justify;
            hyphens: auto;
        }
        
        /* Optimize callout boxes */
        .callout-box {
            padding: 0.75rem 1rem !important;
            margin: 1rem 0 !important;
            font-size: 10pt !important;
        }
        
        .callout-title {
            font-size: 0.9rem !important;
        }
        
        /* Optimize code blocks */
        .code-block {
            font-size: 9pt !important;
            padding: 0.5rem !important;
            margin: 0.75rem 0 !important;
        }
        
        /* Chapter images */
        .chapter-image {
            margin: 0.5rem 0 !important;
            max-height: 3in !important;
        }
        
        .chapter-image img {
            max-width: 100% !important;
            max-height: 3in !important;
            width: auto !important;
            height: auto !important;
        }
        
        /* Cover page optimization */
        .cover {
            width: 6in !important;
            height: 9in !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
        }
        
        .cover img {
            width: 6in !important;
            height: 9in !important;
            object-fit: cover !important;
        }
        
        /* TOC optimization */
        .toc {
            font-size: 11pt !important;
            line-height: 1.8 !important;
        }
        
        .toc li {
            margin-bottom: 0.3rem !important;
        }
        
        /* Section divider */
        .section-divider {
            height: 2px !important;
            margin: 0.5rem 0 1rem !important;
        }
        
        /* Drop caps adjustment */
        .chapter-content > p:first-of-type::first-letter {
            font-size: 3rem !important;
            line-height: 2.5rem !important;
        }
        
        /* Page numbers - remove from CSS as Puppeteer doesn't support @page regions well */
        @page {
            @bottom-center { content: none !important; }
            @top-left { content: none !important; }
            @top-right { content: none !important; }
        }
        
        /* Ensure no overflow */
        * {
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white;">
                <div style="text-align: center;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
                    <h2 style="font-size: 1.3rem; font-weight: 300;">${this.metadata.subtitle || ''}</h2>
                    <p style="font-size: 1.1rem; margin-top: 2rem;">${this.metadata.author}</p>
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
                    <span class="toc-page">${ch.number * 20}</span>
                </li>
            `).join('\n')}
        </ol>
    </div>
    
    <!-- Chapters -->
    ${chaptersHTML}
    
    <!-- End matter -->
    <div class="page end-page">
        <div style="text-align: center; margin-top: 3rem;">
            <div class="section-divider"></div>
            <p style="font-size: 1.1rem; margin-top: 2rem;">Thank you for reading!</p>
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
        console.log('\n🚀 Launching Puppeteer for FIXED 6x9 PDF...');
        
        // Ensure output directory exists
        await fs.ensureDir(path.dirname(this.outputPath));
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Configure marked before generating HTML
            this.configureMarked();
            
            // Generate HTML
            const html = this.generateHTML();
            
            // Save HTML for debugging
            const debugPath = path.join(this.projectRoot, 'build/premium-debug-fixed.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
            
            // Set content
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });
            
            // Generate PDF with CORRECT settings
            console.log('\n📑 Generating FIXED 6x9 PDF...');
            await page.pdf({
                path: this.outputPath,
                // DO NOT USE format: 'Letter' - it overrides width/height!
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
                preferCSSPageSize: true
            });
            
            // Add page numbers as a post-processing step if needed
            console.log('\n✅ Fixed Premium PDF generated successfully!');
            console.log(`📍 Output: ${this.outputPath}`);
            
            // Get file size
            const stats = await fs.stat(this.outputPath);
            console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            
        } finally {
            await browser.close();
        }
    }

    async run() {
        try {
            console.log('🎨 FIXED Premium PDF Generator - Proper 6x9 Layout');
            console.log('=================================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 Fixed PDF ready with optimal text density!');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new PremiumPDFGeneratorFixed();
    generator.run();
}

module.exports = PremiumPDFGeneratorFixed;