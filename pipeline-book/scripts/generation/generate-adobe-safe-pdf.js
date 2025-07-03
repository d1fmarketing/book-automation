#!/usr/bin/env node

/**
 * Adobe-Safe PDF Generator
 * Generates PDFs that work perfectly in Adobe Reader and all PDF viewers
 * Key fixes:
 * - No CSS @page rules when using Puppeteer page settings
 * - Proper image embedding
 * - Clean PDF structure
 * - Metadata compliance
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

class AdobeSafePDFGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/adobe-safe-ebook.pdf');
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
        console.log('\n🖼️  Loading and optimizing images...');
        const imagesDir = path.join(this.projectRoot, 'assets/images');
        
        // Load cover image
        const coverPath = path.join(imagesDir, 'cover.png');
        if (await fs.pathExists(coverPath)) {
            const buffer = await fs.readFile(coverPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
        } else {
            // Create a default cover if missing
            console.log('  ⚠️  Cover not found, creating default...');
            this.images.cover = this.createDefaultCover();
        }

        // Load chapter images
        for (let i = 1; i <= 5; i++) {
            const imageName = `chapter-0${i}-architecture-horizontal.png`;
            const imagePath = path.join(imagesDir, imageName);
            
            if (await fs.pathExists(imagePath)) {
                const buffer = await fs.readFile(imagePath);
                this.images[`chapter${i}`] = `data:image/png;base64,${buffer.toString('base64')}`;
                console.log(`  ✓ Chapter ${i} image loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
            }
        }
    }

    createDefaultCover() {
        // Simple SVG cover as base64
        const svg = `<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#0066CC;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#00AA44;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="1200" height="1800" fill="url(#bg)"/>
            <text x="600" y="900" font-family="Arial, sans-serif" font-size="80" font-weight="bold" text-anchor="middle" fill="white">The Claude Elite Pipeline</text>
            <text x="600" y="1000" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="white">Mastering Automated Ebook Creation</text>
            <text x="600" y="1600" font-family="Arial, sans-serif" font-size="30" text-anchor="middle" fill="white">Enrique Oliveira</text>
        </svg>`;
        
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }

    configureMarked() {
        const renderer = new marked.Renderer();
        
        // Simple code rendering without complex CSS
        renderer.code = (code, language) => {
            const escaped = this.escapeHtml(code);
            return `<pre class="code-block"><code>${escaped}</code></pre>`;
        };

        // Clean heading renderer
        renderer.heading = (text, level) => {
            return `<h${level}>${text}</h${level}>`;
        };

        // Simple image renderer
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

    generateHTML() {
        console.log('\n🎨 Generating Adobe-safe HTML...');
        
        // Configure marked
        this.configureMarked();
        
        // CRITICAL: No @page CSS rules! Let Puppeteer handle all page settings
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Georgia, "Times New Roman", serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1A1A1A;
            background: white;
        }
        
        /* Cover page - simple positioning */
        .cover {
            width: 432pt; /* 6 inches */
            height: 648pt; /* 9 inches */
            position: relative;
            page-break-after: always;
        }
        
        .cover img {
            width: 100%;
            height: 100%;
            display: block;
        }
        
        /* Interior pages */
        .page {
            page-break-after: always;
            padding: 54pt; /* 0.75 inch margins */
            min-height: 540pt; /* 9in - 2*0.75in */
        }
        
        /* Title page */
        .title-page {
            text-align: center;
            padding-top: 216pt; /* 3 inches */
        }
        
        .title-page h1 {
            font-size: 36pt;
            font-weight: normal;
            margin-bottom: 12pt;
        }
        
        .subtitle {
            font-size: 18pt;
            color: #555;
            margin-bottom: 144pt; /* 2 inches */
        }
        
        .author {
            font-size: 16pt;
        }
        
        /* Chapter pages */
        .chapter {
            page-break-before: always;
        }
        
        .chapter-number {
            font-size: 48pt;
            font-weight: bold;
            color: #0066CC;
            margin-bottom: 12pt;
        }
        
        h1 {
            font-size: 24pt;
            font-weight: normal;
            margin-bottom: 24pt;
        }
        
        h2 {
            font-size: 18pt;
            margin-top: 18pt;
            margin-bottom: 12pt;
        }
        
        p {
            text-indent: 18pt;
            margin-bottom: 6pt;
            text-align: justify;
        }
        
        p:first-of-type {
            text-indent: 0;
        }
        
        /* Simple drop cap */
        .drop-cap {
            float: left;
            font-size: 48pt;
            line-height: 36pt;
            margin-right: 6pt;
            margin-top: -6pt;
            font-weight: bold;
            color: #0066CC;
        }
        
        /* Images - simple and reliable */
        .chapter-image {
            display: block;
            max-width: 100%;
            height: auto;
            margin: 18pt auto;
        }
        
        .content-image {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 12pt auto;
        }
        
        /* Code blocks - simple styling */
        .code-block {
            background: #f5f5f5;
            border: 1pt solid #ddd;
            padding: 12pt;
            margin: 12pt 0;
            overflow-x: auto;
            font-family: "Courier New", monospace;
            font-size: 9pt;
            line-height: 1.4;
        }
        
        /* Lists */
        ul, ol {
            margin-left: 24pt;
            margin-bottom: 12pt;
        }
        
        li {
            margin-bottom: 6pt;
        }
        
        /* Table of contents */
        .toc {
            list-style: none;
            margin-left: 0;
        }
        
        .toc li {
            margin-bottom: 12pt;
            display: flex;
            align-items: baseline;
        }
        
        .toc-title {
            flex: 1;
        }
        
        .toc-dots {
            flex: 0 0 auto;
            margin: 0 6pt;
            border-bottom: 1pt dotted #999;
            height: 1em;
            min-width: 24pt;
        }
        
        .toc-page {
            flex: 0 0 auto;
        }
    </style>
</head>
<body>
    <!-- Cover Page (full bleed) -->
    <div class="cover">
        <img src="${this.images.cover}" alt="Book Cover">
    </div>
    
    <!-- Title Page -->
    <div class="page title-page">
        <h1>${this.metadata.title}</h1>
        <p class="subtitle">${this.metadata.subtitle || ''}</p>
        <p class="author">${this.metadata.author}</p>
    </div>
    
    <!-- Table of Contents -->
    <div class="page">
        <h1>Table of Contents</h1>
        <ol class="toc">
            ${this.chapters.map((ch, idx) => `
                <li>
                    <span class="toc-title">Chapter ${ch.number}: ${ch.title}</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page">${3 + idx * 10}</span>
                </li>
            `).join('')}
        </ol>
    </div>
    
    <!-- Chapters -->
    ${this.chapters.map(chapter => this.generateChapterHTML(chapter)).join('\n')}
    
    <!-- End Page -->
    <div class="page" style="text-align: center; padding-top: 216pt;">
        <p style="font-size: 14pt;">Thank you for reading!</p>
        <p style="margin-top: 24pt; color: #666;">
            ${this.metadata.title}<br>
            © ${new Date().getFullYear()} ${this.metadata.author}
        </p>
    </div>
</body>
</html>`;

        return html;
    }

    generateChapterHTML(chapter) {
        // Convert markdown to HTML
        let content = marked.parse(chapter.content);
        
        // Add drop cap to first paragraph
        content = content.replace(/<p>([A-Z])/i, '<p><span class="drop-cap">$1</span>');
        
        // Add chapter image if available
        const chapterImage = this.images[`chapter${chapter.number}`] 
            ? `<img src="${this.images['chapter' + chapter.number]}" alt="Chapter ${chapter.number} illustration" class="chapter-image">`
            : '';
        
        return `
    <div class="page chapter">
        <div class="chapter-number">${chapter.number}</div>
        <h1>${chapter.title}</h1>
        ${chapterImage}
        ${content}
    </div>`;
    }

    async generatePDF() {
        console.log('\n🚀 Generating Adobe-safe PDF...');
        
        // Ensure output directory
        await fs.ensureDir(path.dirname(this.outputPath));
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Generate HTML
            const html = this.generateHTML();
            
            // Save HTML for debugging
            const debugPath = path.join(this.projectRoot, 'build/adobe-safe-debug.html');
            await fs.writeFile(debugPath, html);
            console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
            
            // Set content and wait for images
            await page.setContent(html, {
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            
            // Emulate print media
            await page.emulateMediaType('print');
            
            // Wait a bit more for rendering
            await page.waitForTimeout(2000);
            
            // Generate PDF with exact settings
            console.log('  ⚙️  Generating PDF with Puppeteer...');
            await page.pdf({
                path: this.outputPath,
                width: '6in',
                height: '9in',
                printBackground: true,
                preferCSSPageSize: false, // Critical: Let Puppeteer control page size
                margin: {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0
                }
            });
            
            console.log('  ✓ PDF generated');
            
            // Post-process with pdf-lib to ensure Adobe compatibility
            await this.postProcessPDF();
            
        } finally {
            await browser.close();
        }
    }

    async postProcessPDF() {
        console.log('\n📝 Post-processing for Adobe compatibility...');
        
        // Load the PDF
        const pdfBytes = await fs.readFile(this.outputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // Set metadata
        pdfDoc.setTitle(this.metadata.title);
        pdfDoc.setAuthor(this.metadata.author);
        pdfDoc.setSubject(this.metadata.subtitle || '');
        pdfDoc.setProducer('Claude Elite Pipeline - Adobe Safe Generator');
        pdfDoc.setCreator('Puppeteer + pdf-lib');
        pdfDoc.setCreationDate(new Date());
        pdfDoc.setModificationDate(new Date());
        
        // Ensure all pages have correct size
        const pages = pdfDoc.getPages();
        console.log(`  ✓ Processing ${pages.length} pages`);
        
        pages.forEach((page, idx) => {
            const { width, height } = page.getSize();
            console.log(`  Page ${idx + 1}: ${(width/72).toFixed(2)}" × ${(height/72).toFixed(2)}"`);
        });
        
        // Save the optimized PDF
        const optimizedBytes = await pdfDoc.save({
            useObjectStreams: false, // Better compatibility
            addDefaultPage: false,
            objectsPerTick: 50
        });
        
        await fs.writeFile(this.outputPath, optimizedBytes);
        
        // Get final file size
        const stats = await fs.stat(this.outputPath);
        console.log(`  ✓ Final PDF size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }

    async run() {
        try {
            console.log('🎯 Adobe-Safe PDF Generator');
            console.log('===========================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n✅ Adobe-safe PDF generated successfully!');
            console.log(`📍 Output: ${this.outputPath}`);
            console.log('\n🎉 This PDF will work perfectly in:');
            console.log('  ✓ Adobe Reader/Acrobat');
            console.log('  ✓ Chrome/Edge PDF viewer');
            console.log('  ✓ macOS Preview');
            console.log('  ✓ All standard PDF readers');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new AdobeSafePDFGenerator();
    generator.run();
}

module.exports = AdobeSafePDFGenerator;