#!/usr/bin/env node

/**
 * Premium PDF Generator with Visual Enhancements
 * Includes: Callout boxes, syntax highlighting, professional styling
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

class PremiumPDFGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/premium-ebook.pdf');
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
    }

    async loadImages() {
        console.log('\n🖼️  Loading images...');
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover
        const coverPath = path.join(imagesDir, 'cover.png');
        if (await fs.pathExists(coverPath)) {
            const buffer = await fs.readFile(coverPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
        }

        // Load chapter images
        for (let i = 1; i <= 5; i++) {
            const imagePath = path.join(imagesDir, `chapter-0${i}-architecture-horizontal.png`);
            if (await fs.pathExists(imagePath)) {
                const buffer = await fs.readFile(imagePath);
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
        console.log('\n🎨 Generating premium HTML...');
        
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
            
            /* Dynamic callout box theming */
            ${visualTheme.callout_boxes ? Object.entries(visualTheme.callout_boxes).map(([type, config]) => `
            .${type}-box {
                background: linear-gradient(135deg, ${config.gradient[0]} 0%, ${config.gradient[1]} 100%) !important;
            }
            .${type}-box::before {
                background: ${config.border} !important;
            }
            `).join('\n') : ''}
            
            /* Typography enhancements */
            ${visualTheme.typography?.drop_caps ? `
            .chapter-content > p:first-of-type::first-letter {
                float: left;
                font-size: 4rem;
                line-height: 3rem;
                padding-right: 0.5rem;
                margin-top: -0.2rem;
                font-weight: 700;
                background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }` : ''}
            
            ${visualTheme.typography?.chapter_number_style === 'gradient' ? `
            .chapter-number {
                background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }` : ''}
        `;

        // Generate chapters HTML
        const chaptersHTML = this.chapters.map((chapter, index) => `
            <div class="page chapter-page">
                <div class="book-title-string" style="display: none;">${this.metadata.title}</div>
                <div class="chapter-title-string" style="display: none;">Chapter ${chapter.number}: ${chapter.title}</div>
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

        // Generate complete HTML
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        ${cssVariables}
        ${professionalCSS}
        
        /* Additional PDF-specific styles */
        @page {
            size: 6in 9in;
            margin: 1in 0.75in;
            
            @top-left {
                content: string(book-title);
                font-family: var(--font-family-primary);
                font-size: 9pt;
                color: #666;
                font-weight: 300;
            }
            
            @top-right {
                content: string(chapter-title);
                font-family: var(--font-family-primary);
                font-size: 9pt;
                color: #666;
                font-weight: 300;
            }
            
            @bottom-center {
                content: counter(page);
                font-family: var(--font-family-primary);
                font-size: 10pt;
                color: #666;
                font-weight: 400;
            }
        }
        
        @page :first {
            margin: 0;
            @top-left { content: none; }
            @top-right { content: none; }
            @bottom-center { content: none; }
        }
        
        @page chapter-start {
            @top-left { content: none; }
            @top-right { content: none; }
        }
        
        /* Set string values for headers */
        .book-title-string {
            string-set: book-title content(text);
        }
        
        .chapter-title-string {
            string-set: chapter-title content(text);
        }
        
        .page {
            page-break-after: always;
            min-height: 7.5in;
            position: relative;
        }
        
        .chapter-page:first-child {
            page: chapter-start;
        }
        
        .cover {
            page-break-after: always;
            width: 6in;
            height: 9in;
            position: relative;
            overflow: hidden;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Chapter images */
        .chapter-image {
            margin: 2rem 0;
            text-align: center;
        }
        
        .chapter-image img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        /* Syntax highlighting theme */
        .token.comment { color: #6a737d; }
        .token.string { color: #032f62; }
        .token.keyword { color: #d73a49; }
        .token.function { color: #6f42c1; }
        .token.number { color: #005cc5; }
        .token.operator { color: #d73a49; }
        .token.class-name { color: #22863a; }
        
        /* Enhanced page numbers with visual flair */
        @page {
            @bottom-left {
                content: "";
                width: 30%;
                height: 1px;
                background: linear-gradient(to right, transparent, #ddd);
            }
            
            @bottom-right {
                content: "";
                width: 30%;
                height: 1px;
                background: linear-gradient(to left, transparent, #ddd);
            }
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
        console.log('\n🚀 Launching Puppeteer...');
        
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
            const debugPath = path.join(this.projectRoot, 'build/premium-debug.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
            
            // Set content
            await page.setContent(html, {
                waitUntil: 'networkidle0'
            });
            
            // Generate PDF
            console.log('\n📑 Generating PDF...');
            await page.pdf({
                path: this.outputPath,
                format: 'Letter',
                width: '6in',
                height: '9in',
                printBackground: true,
                displayHeaderFooter: false,
                margin: {
                    top: '0.75in',
                    right: '0.75in',
                    bottom: '0.75in',
                    left: '0.75in'
                }
            });
            
            console.log(`\n✅ Premium PDF generated successfully!`);
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
            console.log('🎨 Premium PDF Generator with Visual Enhancements');
            console.log('================================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 All done! Your premium ebook is ready.');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new PremiumPDFGenerator();
    generator.run();
}

module.exports = PremiumPDFGenerator;