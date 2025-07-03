#!/usr/bin/env node

/**
 * FORMATTER-HTML: Markdown to HTML Converter
 * 
 * IRON-FIST BUILD SUPERVISOR SPEC:
 * - Generate HTML with 6x9" viewport
 * - Inline ALL images as base64
 * - CSS margins exactly 0.5in
 * - NO @page rules (causes Adobe conflicts)
 */

const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { processMarkdownWithCallouts } = require('../utils/callout-box-parser');

class MarkdownToHTMLFormatter {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
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
        console.log('\n🖼️  Loading and encoding images...');
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover (try multiple formats)
        const coverFormats = ['cover-premium.svg', 'cover.png', 'cover.jpg'];
        for (const format of coverFormats) {
            const coverPath = path.join(imagesDir, format);
            if (await fs.pathExists(coverPath)) {
                const ext = path.extname(format).slice(1);
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                const content = await fs.readFile(coverPath);
                const base64 = content.toString('base64');
                this.images.cover = `data:image/${mimeType};base64,${base64}`;
                console.log(`  ✓ Cover loaded: ${format} (${(content.length / 1024).toFixed(0)} KB)`);
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
                    console.log(`  ✓ Chapter ${i} image: ${format} (${(content.length / 1024).toFixed(0)} KB)`);
                    break;
                }
            }
        }
    }

    configureMarked() {
        const renderer = new marked.Renderer();
        
        // Basic rendering - no fancy features that break PDF
        renderer.code = (code, language) => {
            const escaped = this.escapeHtml(code);
            return `<pre class="code-block"><code>${escaped}</code></pre>`;
        };

        renderer.heading = (text, level) => {
            return `<h${level} class="heading-${level}">${text}</h${level}>`;
        };

        renderer.image = (href, title, text) => {
            return `<img src="${href}" alt="${text}" class="content-image">`;
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
        // Process callout boxes first
        let processed = processMarkdownWithCallouts(markdown);
        
        // Replace relative image paths with base64
        processed = processed.replace(/!\[([^\]]*)\]\(\.\.\/assets\/images\/([^)]+)\)/g, (match, alt, filename) => {
            // Try to find the image in our loaded images
            const imageKey = filename.replace(/-pro\.svg$/, '').replace(/^chapter-0(\d)-/, 'chapter$1-');
            
            // Check if we have this image loaded
            for (const [key, dataUri] of Object.entries(this.images)) {
                if (filename.includes(key.replace('chapter', 'chapter-0')) || 
                    filename.includes(key)) {
                    return `![${alt}](${dataUri})`;
                }
            }
            
            // If not found, try to load it
            const imagePath = path.join(this.projectRoot, 'assets/images', filename);
            if (fs.existsSync(imagePath)) {
                const ext = path.extname(filename).slice(1);
                const mimeType = ext === 'svg' ? 'svg+xml' : ext;
                const content = fs.readFileSync(imagePath);
                const base64 = content.toString('base64');
                const dataUri = `data:image/${mimeType};base64,${base64}`;
                return `![${alt}](${dataUri})`;
            }
            
            // If still not found, return original
            console.warn(`  ⚠️  Image not found: ${filename}`);
            return match;
        });
        
        // Then convert to HTML
        return marked.parse(processed);
    }

    generateHTML() {
        console.log('\n🎨 Generating HTML with 6x9" viewport...');
        
        // Load professional CSS
        const cssPath = path.join(this.projectRoot, 'assets/css/professional-web-style.css');
        const professionalCSS = fs.existsSync(cssPath) ? 
            fs.readFileSync(cssPath, 'utf8') : '';

        // Configure marked
        this.configureMarked();

        // Remove duplicate chapters
        const uniqueChapters = [];
        const seen = new Set();
        for (const chapter of this.chapters) {
            const key = `${chapter.number}-${chapter.title}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueChapters.push(chapter);
            }
        }

        // Generate chapters HTML
        const chaptersHTML = uniqueChapters.map((chapter, index) => {
            const hasImage = chapter.number > 0 && chapter.number <= 5 && this.images[`chapter${chapter.number}`];
            
            return `
    <div class="page chapter-page" id="chapter-${chapter.number}">
        <div class="chapter-header">
            ${chapter.number > 0 ? `<div class="chapter-number">Chapter ${chapter.number}</div>` : ''}
            <h1 class="chapter-title">${chapter.title}</h1>
        </div>
        <div class="section-divider"></div>
        ${hasImage ? `
        <figure class="chapter-image">
            <img src="${this.images[`chapter${chapter.number}`]}" alt="Chapter ${chapter.number} illustration">
        </figure>
        ` : ''}
        <div class="chapter-content">
            ${this.processChapterContent(chapter.content)}
        </div>
    </div>`;
        }).join('\n');

        // Generate complete HTML
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.metadata.title}</title>
    <style>
        /* CRITICAL: NO @page rules - causes Adobe conflicts */
        
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Body setup for 6x9" viewport */
        body {
            width: 6in;
            min-height: 9in;
            margin: 0 auto;
            font-family: 'Georgia', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        /* Page setup - exactly 6x9" with 0.5in margins */
        .page {
            width: 6in;
            height: 9in;
            padding: 0.5in;
            position: relative;
            overflow: hidden;
            background: white;
            page-break-after: always;
            page-break-inside: avoid;
        }
        
        /* Cover page */
        .cover {
            width: 6in;
            height: 9in;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Chapter styling */
        .chapter-header {
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .chapter-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        
        .chapter-title {
            font-size: 1.5rem;
            font-weight: normal;
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
        
        /* Content styling */
        .chapter-content {
            text-align: justify;
        }
        
        .chapter-content p {
            margin-bottom: 0.8rem;
            text-indent: 0.3in;
        }
        
        .chapter-content p:first-of-type {
            text-indent: 0;
        }
        
        .chapter-content h1,
        .chapter-content h2,
        .chapter-content h3 {
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            text-align: left;
        }
        
        /* Code blocks */
        .code-block {
            background: #f4f4f4;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 0.5rem;
            margin: 0.75rem 0;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            overflow-x: auto;
        }
        
        /* Callout boxes */
        .callout-box {
            border-left: 4px solid;
            padding: 0.75rem;
            margin: 1rem 0;
            background: #f9f9f9;
        }
        
        .tip-box { border-color: #10b981; background: #f0fdf4; }
        .warning-box { border-color: #f59e0b; background: #fffbeb; }
        .info-box { border-color: #3b82f6; background: #eff6ff; }
        .success-box { border-color: #10b981; background: #f0fdf4; }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 0.5rem;
            text-align: left;
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
        
        /* Professional CSS overrides */
        ${professionalCSS}
        
        /* OVERRIDE any @page rules from professional CSS */
        @page {
            size: auto !important;
            margin: 0 !important;
        }
    </style>
</head>
<body>
    <!-- Cover -->
    <div class="page cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="text-align: center;">
                <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
                <p style="font-size: 1.2rem;">${this.metadata.author}</p>
            </div>`
        }
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page">
        <h1>Table of Contents</h1>
        <div class="section-divider"></div>
        <ol class="toc">
            ${uniqueChapters.map((ch, idx) => `
            <li>
                <span class="toc-title">${ch.number > 0 ? `Chapter ${ch.number}: ` : ''}${ch.title}</span>
                <span class="toc-page">${idx + 3}</span>
            </li>
            `).join('')}
        </ol>
    </div>
    
    <!-- Chapters -->
    ${chaptersHTML}
    
    <!-- Back Cover -->
    <div class="page back-cover" style="display: flex; align-items: center; justify-content: center; text-align: center;">
        <div>
            <div class="section-divider" style="width: 4in;"></div>
            <h2 style="margin: 2rem 0;">Thank you for reading!</h2>
            <p style="font-size: 1.1rem;">${this.metadata.title}</p>
            <p style="margin-top: 1rem;">© ${new Date().getFullYear()} ${this.metadata.author}</p>
            <p style="margin-top: 3rem; font-size: 0.9rem; opacity: 0.8;">Built with Claude Elite Pipeline</p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async run() {
        try {
            console.log('📄 FORMATTER-HTML: Markdown to HTML Converter');
            console.log('============================================\n');
            
            // Ensure output directory exists
            await fs.ensureDir(path.dirname(this.outputPath));
            
            // Load data
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            
            // Generate HTML
            const html = this.generateHTML();
            
            // Save HTML
            await fs.writeFile(this.outputPath, html);
            
            console.log('\n✅ HTML generated successfully!');
            console.log(`📍 Output: ${this.outputPath}`);
            
            // Report stats
            const stats = await fs.stat(this.outputPath);
            console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`📑 Pages: ${this.chapters.length + 3} (cover + TOC + chapters + back)`);
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const formatter = new MarkdownToHTMLFormatter();
    formatter.run();
}

module.exports = MarkdownToHTMLFormatter;