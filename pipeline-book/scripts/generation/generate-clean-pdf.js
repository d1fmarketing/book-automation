#!/usr/bin/env node

/**
 * Clean PDF Generator - No gradients, Adobe-compatible
 * Removes all CSS gradients for maximum compatibility
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const marked = require('marked');
const puppeteer = require('puppeteer');

class CleanPDFGenerator {
    constructor(projectPath = '.') {
        this.projectPath = projectPath;
        this.buildDir = path.join(projectPath, 'build');
        this.distDir = path.join(this.buildDir, 'dist');
        this.chaptersDir = path.join(projectPath, 'chapters');
        this.assetsDir = path.join(projectPath, 'assets');
        this.metadataPath = path.join(projectPath, 'metadata.yaml');
        
        this.metadata = null;
        this.chapters = [];
        this.images = {};
    }

    async initialize() {
        // Create directories
        await fs.mkdir(this.buildDir, { recursive: true });
        await fs.mkdir(this.distDir, { recursive: true });
        
        // Load metadata
        const metadataContent = await fs.readFile(this.metadataPath, 'utf-8');
        this.metadata = yaml.parse(metadataContent);
        
        console.log('📚 Clean PDF Generator initialized');
    }

    async loadChapters() {
        const files = await fs.readdir(this.chaptersDir);
        const chapterFiles = files.filter(f => f.match(/^chapter-\d+.*\.md$/)).sort();
        
        for (const file of chapterFiles) {
            const content = await fs.readFile(path.join(this.chaptersDir, file), 'utf-8');
            
            // Extract frontmatter
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            let chapterData = { content: content };
            
            if (frontmatterMatch) {
                const frontmatter = yaml.parse(frontmatterMatch[1]);
                const markdownContent = frontmatterMatch[2];
                
                chapterData = {
                    ...frontmatter,
                    content: markdownContent,
                    filename: file
                };
            }
            
            this.chapters.push(chapterData);
        }
        
        console.log(`📖 Loaded ${this.chapters.length} chapters`);
    }

    async loadImages() {
        const imagesDir = path.join(this.assetsDir, 'images');
        
        try {
            const files = await fs.readdir(imagesDir);
            
            for (const file of files) {
                if (file.match(/\.(png|jpg|jpeg)$/i)) {
                    const imagePath = path.join(imagesDir, file);
                    const imageData = await fs.readFile(imagePath);
                    const base64 = imageData.toString('base64');
                    const mimeType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
                    this.images[path.parse(file).name] = `data:${mimeType};base64,${base64}`;
                }
            }
            
            console.log(`🖼️  Loaded ${Object.keys(this.images).length} images`);
        } catch (err) {
            console.log('⚠️  No images directory found');
        }
    }

    processMarkdown(markdown) {
        // Configure marked for clean rendering
        marked.setOptions({
            gfm: true,
            breaks: true,
            smartypants: true
        });
        
        let html = marked.parse(markdown);
        
        // Clean up any gradient references in content
        html = html.replace(/background:\s*linear-gradient[^;]+;/gi, '');
        html = html.replace(/background-image:\s*linear-gradient[^;]+;/gi, '');
        
        return html;
    }

    generateHTML() {
        console.log('🎨 Generating clean HTML (no gradients)...');
        
        // CLEAN CSS - No gradients, Adobe-compatible
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* CSS Variables */
        :root {
            --primary-color: #1a202c;
            --secondary-color: #4a5568;
            --accent-color: #2563eb;
            --page-width: 6in;
            --page-height: 9in;
            --margin-top: 0.5in;
            --margin-bottom: 0.6in;
            --margin-outer: 0.5in;
            --margin-inner: 0.6in;
            --base-font-size: 10pt;
            --line-height: 1.5;
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
            margin: 0.5in;
            
            @bottom-center {
                content: counter(page);
                font-family: 'Georgia', serif;
                font-size: 9pt;
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
        
        /* Base typography */
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: var(--base-font-size);
            line-height: var(--line-height);
            color: var(--primary-color);
            text-rendering: optimizeLegibility;
            font-kerning: normal;
            font-variant-ligatures: common-ligatures;
            hyphens: auto;
        }
        
        /* Cover */
        .cover {
            position: relative;
            width: var(--page-width);
            height: var(--page-height);
            margin: 0;
            padding: 0;
            page-break-after: always;
            overflow: hidden;
            background-color: #f8f9fa;
        }
        
        .cover img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* TOC */
        .toc-page {
            page-break-after: always;
            padding: var(--margin-top) var(--margin-outer) var(--margin-bottom) var(--margin-inner);
        }
        
        .toc-page h1 {
            font-size: 18pt;
            font-weight: normal;
            text-align: center;
            margin-bottom: 2rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: var(--primary-color);
        }
        
        .toc-entry {
            display: flex;
            align-items: baseline;
            margin-bottom: 0.8rem;
        }
        
        .toc-title {
            flex: 1;
            padding-right: 1rem;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #ccc;
            margin: 0 0.5rem;
            height: 0.8em;
        }
        
        .toc-page-num {
            font-size: 9pt;
            color: var(--secondary-color);
        }
        
        /* Chapters */
        .chapter {
            page: chapter;
            page-break-before: always;
            padding: var(--margin-top) var(--margin-outer) var(--margin-bottom) var(--margin-inner);
        }
        
        .chapter-header {
            text-align: center;
            margin-bottom: 2.5rem;
            page-break-after: avoid;
            /* NO GRADIENTS - solid color only */
            border-bottom: 2px solid var(--accent-color);
            padding-bottom: 1.5rem;
        }
        
        .chapter-number {
            font-size: 12pt;
            font-weight: normal;
            letter-spacing: 0.3em;
            text-transform: uppercase;
            color: var(--accent-color);
            margin-bottom: 0.8rem;
        }
        
        .chapter-title {
            font-size: 20pt;
            font-weight: normal;
            line-height: 1.3;
            margin-bottom: 0.5rem;
            color: var(--primary-color);
        }
        
        /* Chapter content */
        .chapter-content {
            text-align: justify;
        }
        
        /* Paragraphs */
        .chapter-content p {
            margin-bottom: 0.8rem;
            text-indent: 1.5em;
            orphans: 3;
            widows: 3;
        }
        
        .chapter-content p:first-of-type {
            text-indent: 0;
        }
        
        /* First letter - simple, no gradient */
        .chapter-content p:first-of-type::first-letter {
            font-size: 3.5em;
            float: left;
            line-height: 1;
            margin-right: 0.1em;
            margin-top: -0.1em;
            font-weight: normal;
            color: var(--accent-color);
        }
        
        /* Headings */
        .chapter-content h1,
        .chapter-content h2,
        .chapter-content h3,
        .chapter-content h4 {
            font-weight: normal;
            margin-top: 1.5rem;
            margin-bottom: 0.8rem;
            page-break-after: avoid;
            color: var(--primary-color);
        }
        
        .chapter-content h1 { 
            font-size: 14pt; 
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 0.5rem;
        }
        .chapter-content h2 { font-size: 12pt; }
        .chapter-content h3 { font-size: 11pt; }
        .chapter-content h4 { font-size: 10pt; font-style: italic; }
        
        /* Lists */
        .chapter-content ul,
        .chapter-content ol {
            margin-left: 2em;
            margin-bottom: 0.8rem;
        }
        
        .chapter-content li {
            margin-bottom: 0.3rem;
        }
        
        /* Images */
        .chapter-image,
        .image-figure {
            margin: 1.5rem 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .chapter-image img,
        .image-figure img {
            max-width: 100%;
            max-height: 3.5in;
            width: auto;
            height: auto;
            display: inline-block;
            border: 1px solid #e5e7eb;
        }
        
        figcaption {
            font-size: 9pt;
            color: var(--secondary-color);
            margin-top: 0.5rem;
            font-style: italic;
        }
        
        /* Code blocks - simple, no gradient */
        .chapter-content pre {
            background-color: #f8f9fa;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 0.8rem;
            margin: 1rem 0;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        .chapter-content code {
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 9pt;
            background-color: #f8f9fa;
            padding: 0.1em 0.3em;
            border-radius: 3px;
        }
        
        .chapter-content pre code {
            background: none;
            padding: 0;
        }
        
        /* Blockquotes */
        .chapter-content blockquote {
            margin: 1rem 0;
            padding-left: 1.5rem;
            border-left: 3px solid var(--accent-color);
            font-style: italic;
            color: var(--secondary-color);
        }
        
        /* Callout boxes - NO GRADIENTS */
        .note-box,
        .warning-box,
        .tip-box,
        .info-box {
            margin: 1rem 0;
            padding: 1rem;
            border-radius: 4px;
            page-break-inside: avoid;
            border: 1px solid;
        }
        
        .note-box {
            background-color: #eff6ff;
            border-color: #2563eb;
            color: #1e40af;
        }
        
        .warning-box {
            background-color: #fef3c7;
            border-color: #f59e0b;
            color: #92400e;
        }
        
        .tip-box {
            background-color: #d1fae5;
            border-color: #10b981;
            color: #065f46;
        }
        
        .info-box {
            background-color: #f3f4f6;
            border-color: #6b7280;
            color: #374151;
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Prevent widows and orphans */
        p, h1, h2, h3, h4, h5, h6 {
            orphans: 3;
            widows: 3;
        }
        
        /* Keep elements together */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
        }
        
        figure, table, blockquote, pre {
            page-break-inside: avoid;
        }
        
        /* Print optimization */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
`;

        // Add cover
        html += this.generateCover();
        
        // Add TOC
        html += this.generateTOC();
        
        // Add chapters
        this.chapters.forEach((chapter, index) => {
            html += this.generateChapter(chapter, index + 1);
        });
        
        html += `
</body>
</html>`;

        return html;
    }

    generateCover() {
        if (this.images.cover) {
            return `
    <div class="cover">
        <img src="${this.images.cover}" alt="Book Cover">
    </div>`;
        }
        
        // Fallback cover with solid color
        return `
    <div class="cover" style="display: flex; align-items: center; justify-content: center; background-color: var(--accent-color); color: white;">
        <div style="text-align: center; padding: 2rem;">
            <h1 style="font-size: 3rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
            ${this.metadata.subtitle ? `<p style="font-size: 1.5rem; margin-bottom: 2rem;">${this.metadata.subtitle}</p>` : ''}
            <p style="font-size: 1.2rem;">${this.metadata.author}</p>
        </div>
    </div>`;
    }

    generateTOC() {
        let toc = `
    <div class="toc-page">
        <h1>Table of Contents</h1>
        <div class="toc-entries">`;
        
        this.chapters.forEach((chapter, index) => {
            const pageNum = 3 + (index * 15); // Estimate
            toc += `
            <div class="toc-entry">
                <span class="toc-title">Chapter ${index + 1}: ${chapter.title}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-num">${pageNum}</span>
            </div>`;
        });
        
        toc += `
        </div>
    </div>`;
        
        return toc;
    }

    generateChapter(chapter, chapterNum) {
        const processedContent = this.processMarkdown(chapter.content);
        
        // Look for chapter image
        let chapterImage = '';
        const imageKey = `chapter-${String(chapterNum).padStart(2, '0')}`;
        if (this.images[imageKey]) {
            chapterImage = `
        <div class="chapter-image">
            <img src="${this.images[imageKey]}" alt="Chapter ${chapterNum} illustration">
        </div>`;
        }
        
        return `
    <div class="chapter">
        <div class="chapter-header">
            <div class="chapter-number">Chapter ${chapterNum}</div>
            <h1 class="chapter-title">${chapter.title}</h1>
        </div>
        <div class="chapter-content">
            ${chapterImage}
            ${processedContent}
        </div>
    </div>`;
    }

    async generatePDF(htmlContent) {
        console.log('🚀 Launching Puppeteer for clean PDF generation...');
        
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF with exact dimensions
        const pdfPath = path.join(this.distDir, 'ebook-clean.pdf');
        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            width: '6in',
            height: '9in',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });
        
        await browser.close();
        
        console.log(`✅ Clean PDF generated: ${pdfPath}`);
        return pdfPath;
    }

    async run() {
        try {
            await this.initialize();
            await this.loadChapters();
            await this.loadImages();
            
            const html = this.generateHTML();
            
            // Save HTML for debugging
            const htmlPath = path.join(this.buildDir, 'clean-book.html');
            await fs.writeFile(htmlPath, html);
            console.log(`📄 HTML saved: ${htmlPath}`);
            
            // Generate PDF
            const pdfPath = await this.generatePDF(html);
            
            console.log('\n🎉 Clean PDF generation complete!');
            console.log('📖 No gradients, Adobe-compatible');
            console.log(`📄 Output: ${pdfPath}`);
            
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new CleanPDFGenerator(process.cwd());
    generator.run();
}

module.exports = CleanPDFGenerator;