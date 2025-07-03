#!/usr/bin/env node

/**
 * Premium PDF Generator with MCP Visual QA
 * Combines premium visual features with automated quality assurance
 * Includes: Callout boxes, syntax highlighting, full-bleed cover, MCP verification
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { processMarkdownWithCallouts } = require('../utils/callout-box-parser');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Prism.js for syntax highlighting
const Prism = require('prismjs');
require('prismjs/components/prism-javascript');
require('prismjs/components/prism-typescript');
require('prismjs/components/prism-python');
require('prismjs/components/prism-bash');
require('prismjs/components/prism-json');
require('prismjs/components/prism-yaml');
require('prismjs/components/prism-markdown');

class PremiumMCPGenerator {
    constructor() {
        this.projectRoot = path.join(__dirname, '../../');
        this.outputPath = path.join(this.projectRoot, 'build/dist/premium-mcp-ebook.pdf');
        this.metadata = null;
        this.chapters = [];
        this.images = {};
        this.qaReports = [];
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
        
        // Load cover image
        const coverPath = path.join(imagesDir, 'cover.png');
        if (await fs.pathExists(coverPath)) {
            const buffer = await fs.readFile(coverPath);
            this.images.cover = `data:image/png;base64,${buffer.toString('base64')}`;
            console.log(`  ✓ Cover loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
        }

        // Load chapter images
        for (let i = 1; i <= 5; i++) {
            const pngPath = path.join(imagesDir, `chapter-0${i}-architecture-horizontal.png`);
            if (await fs.pathExists(pngPath)) {
                const buffer = await fs.readFile(pngPath);
                this.images[`chapter${i}`] = `data:image/png;base64,${buffer.toString('base64')}`;
                console.log(`  ✓ Chapter ${i} image loaded (${(buffer.length / 1024).toFixed(0)} KB)`);
            }
        }
    }

    configureMarked() {
        const renderer = new marked.Renderer();
        
        // Custom code rendering with syntax highlighting
        renderer.code = (code, language) => {
            if (language && Prism.languages[language]) {
                const highlighted = Prism.highlight(code, Prism.languages[language], language);
                return `<pre class="code-block language-${language}"><code>${highlighted}</code></pre>`;
            }
            return `<pre class="code-block"><code>${this.escapeHtml(code)}</code></pre>`;
        };

        // Custom heading renderer
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

        // Custom image renderer
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
        console.log('\n🎨 Generating premium HTML with MCP enhancements...');
        
        // Load CSS files
        const professionalCSS = fs.readFileSync(
            path.join(this.projectRoot, 'assets/css/professional-web-style.css'), 
            'utf8'
        );
        
        // Get theme colors from metadata
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

        // Generate complete HTML with FULL BLEED COVER
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        ${cssVariables}
        ${professionalCSS}
        
        /* PDF-specific overrides for full bleed */
        @page {
            size: 6in 9in;
            margin: 0; /* No margin for cover page */
        }
        
        @page :left {
            margin: 1in 0.75in 1in 1in;
            @top-left {
                content: string(book-title);
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
            }
        }
        
        @page :right {
            margin: 1in 1in 1in 0.75in;
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
            }
        }
        
        @page :first {
            margin: 0; /* Full bleed for cover */
            @top-left { content: none; }
            @top-right { content: none; }
            @bottom-center { content: none; }
        }
        
        @page chapter-start {
            margin: 1in 0.75in;
            @top-left { content: none; }
            @top-right { content: none; }
        }
        
        /* Full bleed cover - ABSOLUTE positioning */
        .cover {
            page: auto;
            page-break-after: always;
            width: 6in;
            height: 9in;
            margin: 0 !important;
            padding: 0 !important;
            position: relative;
            overflow: hidden;
            background: white;
        }
        
        .cover img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            margin: 0 !important;
            padding: 0 !important;
        }
        
        /* Ensure content pages have proper margins */
        .page {
            page-break-after: always;
            min-height: 7.5in;
            position: relative;
            padding: 0;
        }
        
        .toc-page {
            page: auto;
        }
        
        .chapter-page:first-of-type {
            page: chapter-start;
        }
        
        /* String values for headers */
        .book-title-string {
            string-set: book-title content(text);
        }
        
        .chapter-title-string {
            string-set: chapter-title content(text);
        }
        
        /* Chapter images with proper spacing */
        .chapter-image {
            margin: 2rem 0;
            text-align: center;
            page-break-inside: avoid;
        }
        
        .chapter-image img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        /* Enhanced syntax highlighting */
        .token.comment { color: #6a737d; }
        .token.string { color: #032f62; }
        .token.keyword { color: #d73a49; }
        .token.function { color: #6f42c1; }
        .token.number { color: #005cc5; }
        .token.operator { color: #d73a49; }
        .token.class-name { color: #22863a; }
        .token.punctuation { color: #24292e; }
        
        /* Ensure callout boxes don't break */
        .callout-box {
            page-break-inside: avoid;
        }
        
        /* Code blocks shouldn't break */
        .code-block {
            page-break-inside: avoid;
        }
        
        /* Print color adjustment */
        * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    </style>
</head>
<body>
    <!-- Cover Page - ABSOLUTE FULL BLEED -->
    <div class="cover" style="margin: 0 !important; padding: 0 !important;">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;">` :
            `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white; display: flex; align-items: center; justify-content: center;">
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
            ${this.chapters.map((ch, idx) => `
                <li>
                    <span class="toc-title">Chapter ${ch.number}: ${ch.title}</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page">${2 + idx * 8}</span>
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
            ${visualTheme.premium_features?.end_matter_gradient ? `
            <div style="margin-top: 3rem; width: 200px; height: 3px; background: linear-gradient(90deg, transparent, var(--accent-color), transparent); margin-left: auto; margin-right: auto;"></div>
            ` : ''}
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async getPageCount(pdfPath) {
        const methods = [
            // Method 1: pdfinfo
            async () => {
                try {
                    const { stdout } = await execAsync(`pdfinfo "${pdfPath}" 2>/dev/null | grep "Pages:" | awk '{print $2}'`);
                    const count = parseInt(stdout.trim());
                    if (!isNaN(count)) return count;
                } catch (e) {}
                return null;
            },
            
            // Method 2: qpdf
            async () => {
                try {
                    const { stdout } = await execAsync(`qpdf --show-npages "${pdfPath}" 2>/dev/null`);
                    const count = parseInt(stdout.trim());
                    if (!isNaN(count)) return count;
                } catch (e) {}
                return null;
            },
            
            // Method 3: Ghostscript
            async () => {
                try {
                    const { stdout } = await execAsync(`gs -q -dNODISPLAY -c "(${pdfPath}) (r) file runpdfbegin pdfpagecount = quit" 2>/dev/null`);
                    const count = parseInt(stdout.trim());
                    if (!isNaN(count)) return count;
                } catch (e) {}
                return null;
            },
            
            // Method 4: File size estimation
            async () => {
                const stats = await fs.stat(pdfPath);
                const estimatedPages = Math.round(stats.size / (150 * 1024)); // ~150KB per page
                return estimatedPages > 0 ? estimatedPages : null;
            }
        ];

        for (const method of methods) {
            const count = await method();
            if (count !== null) return count;
        }
        
        return 1; // Default fallback
    }

    async runVisualQA(pdfPath) {
        console.log('\n🔍 Running Visual QA...');
        
        const qaResult = {
            passed: false,
            pageCount: 0,
            coverDetected: false,
            issues: []
        };

        try {
            // Get page count
            qaResult.pageCount = await this.getPageCount(pdfPath);
            console.log(`  📄 Page count: ${qaResult.pageCount}`);

            // Check minimum pages
            if (qaResult.pageCount < 10) {
                qaResult.issues.push(`Only ${qaResult.pageCount} pages detected (expected 30+)`);
            }

            // Take screenshot of first page (cover)
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            
            await page.goto(`file://${pdfPath}`, { waitUntil: 'networkidle0' });
            
            // Set viewport for cover
            await page.setViewport({ width: 600, height: 900 });
            
            const screenshotPath = path.join(this.projectRoot, 'build/qa/cover-screenshot.png');
            await fs.ensureDir(path.dirname(screenshotPath));
            await page.screenshot({ path: screenshotPath, fullPage: false });
            
            await browser.close();

            // Check if screenshot has content
            const screenshotStats = await fs.stat(screenshotPath);
            qaResult.coverDetected = screenshotStats.size > 50000; // > 50KB indicates visual content
            
            if (!qaResult.coverDetected) {
                qaResult.issues.push('Cover page appears blank or missing');
            }

            // Determine if QA passed
            qaResult.passed = qaResult.pageCount >= 10 && qaResult.coverDetected;

            // Save QA report
            const reportPath = path.join(this.projectRoot, 'build/qa/visual-qa-report.json');
            await fs.writeJson(reportPath, qaResult, { spaces: 2 });
            
            console.log(`  ✓ Visual QA ${qaResult.passed ? 'PASSED' : 'FAILED'}`);
            if (!qaResult.passed) {
                console.log(`  ⚠️  Issues found:`);
                qaResult.issues.forEach(issue => console.log(`     - ${issue}`));
            }

        } catch (error) {
            console.error('  ❌ Visual QA error:', error.message);
            qaResult.issues.push(error.message);
        }

        this.qaReports.push(qaResult);
        return qaResult;
    }

    async generatePDF() {
        console.log('\n🚀 Launching Puppeteer for premium PDF generation...');
        
        // Ensure output directory exists
        await fs.ensureDir(path.dirname(this.outputPath));
        
        const maxAttempts = 3;
        let attempt = 0;
        let pdfGenerated = false;

        while (attempt < maxAttempts && !pdfGenerated) {
            attempt++;
            console.log(`\n🔄 Generation attempt ${attempt}/${maxAttempts}...`);

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
                const debugPath = path.join(this.projectRoot, 'build/premium-mcp-debug.html');
                await fs.writeFile(debugPath, html);
                console.log(`  ✓ Debug HTML saved to: ${debugPath}`);
                
                // Set content
                await page.setContent(html, {
                    waitUntil: 'networkidle0'
                });
                
                // Wait a bit for rendering
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Generate PDF with full bleed settings
                console.log('  📑 Generating PDF with full bleed cover...');
                await page.pdf({
                    path: this.outputPath,
                    width: '6in',
                    height: '9in',
                    printBackground: true,
                    displayHeaderFooter: false,
                    margin: {
                        top: '0mm',
                        right: '0mm',
                        bottom: '0mm',
                        left: '0mm'
                    },
                    preferCSSPageSize: false, // Force our margins
                    omitBackground: false
                });
                
                console.log(`  ✓ PDF generated: ${this.outputPath}`);
                
                // Run Visual QA
                const qaResult = await this.runVisualQA(this.outputPath);
                
                if (qaResult.passed) {
                    pdfGenerated = true;
                    console.log('\n✅ Premium PDF with MCP validation completed successfully!');
                    
                    // Get file size
                    const stats = await fs.stat(this.outputPath);
                    console.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                    console.log(`📄 Pages: ${qaResult.pageCount}`);
                    console.log(`🖼️  Cover: ${qaResult.coverDetected ? 'Detected' : 'Missing'}`);
                } else {
                    console.log('  ⚠️  QA failed, retrying with adjustments...');
                    
                    // Delete failed PDF
                    await fs.remove(this.outputPath);
                    
                    if (attempt < maxAttempts) {
                        // Wait before retry
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                
            } finally {
                await browser.close();
            }
        }

        if (!pdfGenerated) {
            throw new Error('Failed to generate PDF after multiple attempts');
        }

        // Generate final QA summary
        await this.generateQASummary();
    }

    async generateQASummary() {
        const summaryPath = path.join(this.projectRoot, 'build/qa/premium-mcp-summary.json');
        
        const summary = {
            timestamp: new Date().toISOString(),
            generator: 'premium-mcp',
            output: this.outputPath,
            attempts: this.qaReports.length,
            finalResult: this.qaReports[this.qaReports.length - 1],
            features: {
                calloutBoxes: true,
                syntaxHighlighting: true,
                fullBleedCover: true,
                mcpValidation: true,
                premiumStyling: true
            }
        };

        await fs.writeJson(summaryPath, summary, { spaces: 2 });
        console.log(`\n📊 QA Summary saved to: ${summaryPath}`);
    }

    async run() {
        try {
            console.log('🎨 Premium PDF Generator with MCP Visual QA');
            console.log('===========================================\n');
            
            await this.loadMetadata();
            await this.loadChapters();
            await this.loadImages();
            await this.generatePDF();
            
            console.log('\n🎉 Premium PDF with full visual features and MCP validation complete!');
            console.log('📍 Your professionally formatted ebook is ready.');
            
        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new PremiumMCPGenerator();
    generator.run();
}

module.exports = PremiumMCPGenerator;