#!/usr/bin/env node

/**
 * FormatterHTML Agent
 * 
 * Transforms Markdown chapters into professionally formatted HTML ebooks
 * with interactive features, responsive design, and multiple output options.
 * 
 * Usage:
 *   agentcli call formatter.html --book-dir="build/my-ebook" --template="professional"
 *   node agents/formatter-html.js --input="chapters/" --output="build/html/"
 */

const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');
const hljs = require('highlight.js');
const crypto = require('crypto');

// Use the clean formatter to prevent [object Object] errors
const CleanHTMLFormatter = require('./formatter-html-clean');

// Template configurations
const TEMPLATES = {
    professional: {
        name: 'Professional',
        description: 'Clean, minimal design for business and self-help books',
        fonts: {
            heading: 'Inter, -apple-system, sans-serif',
            body: 'Merriweather, Georgia, serif',
            mono: 'JetBrains Mono, Menlo, monospace'
        },
        colors: {
            primary: '#0ea5e9',
            secondary: '#06b6d4',
            accent: '#fbbf24',
            background: '#ffffff',
            text: '#1e293b',
            muted: '#64748b'
        }
    },
    academic: {
        name: 'Academic',
        description: 'Formal layout with citations and scholarly features',
        fonts: {
            heading: 'Playfair Display, Georgia, serif',
            body: 'Lora, Georgia, serif',
            mono: 'Consolas, Monaco, monospace'
        },
        colors: {
            primary: '#1e40af',
            secondary: '#3730a3',
            accent: '#dc2626',
            background: '#fafaf9',
            text: '#18181b',
            muted: '#71717a'
        }
    },
    creative: {
        name: 'Creative',
        description: 'Vibrant design with personality for creative content',
        fonts: {
            heading: 'Poppins, Helvetica, sans-serif',
            body: 'Open Sans, Arial, sans-serif',
            mono: 'Fira Code, Courier New, monospace'
        },
        colors: {
            primary: '#8b5cf6',
            secondary: '#ec4899',
            accent: '#f59e0b',
            background: '#fefce8',
            text: '#1f2937',
            muted: '#6b7280'
        }
    },
    technical: {
        name: 'Technical',
        description: 'Code-focused design for technical documentation',
        fonts: {
            heading: 'JetBrains Mono, monospace',
            body: 'Source Sans Pro, sans-serif',
            mono: 'JetBrains Mono, Consolas, monospace'
        },
        colors: {
            primary: '#10b981',
            secondary: '#14b8a6',
            accent: '#f97316',
            background: '#0f172a',
            text: '#e2e8f0',
            muted: '#94a3b8'
        }
    }
};

// Output format configurations
const OUTPUT_FORMATS = {
    single: {
        name: 'Single Page',
        description: 'All content in one HTML file',
        features: ['embedded-assets', 'offline-ready', 'searchable']
    },
    multi: {
        name: 'Multi Page',
        description: 'Separate files per chapter',
        features: ['fast-loading', 'bookmarkable', 'seo-friendly']
    },
    pwa: {
        name: 'Progressive Web App',
        description: 'Installable app with offline support',
        features: ['installable', 'offline-first', 'push-notifications']
    }
};

class FormatterHTML {
    constructor(options = {}) {
        this.template = options.template || 'professional';
        this.format = options.format || 'single';
        this.features = options.features || {
            toc: true,
            search: true,
            darkMode: true,
            readingProgress: true,
            fontControls: true,
            copyCode: true,
            socialShare: true,
            analytics: false
        };
        
        this.customCSS = options.customCSS || '';
        this.customJS = options.customJS || '';
        
        // Configure marked
        this.setupMarkedRenderer();
    }

    setupMarkedRenderer() {
        this.renderer = new marked.Renderer();
        
        // Custom heading renderer with anchors
        this.renderer.heading = (text, level, raw) => {
            // Validate level is 1-6
            if (!level || level < 1 || level > 6) {
                level = 3; // Default to h3 if invalid
            }
            const slug = this.slugify(raw || text);
            const safeText = text || '';
            return `<h${level} id="${slug}">
                ${safeText}
                <a href="#${slug}" class="heading-anchor" aria-label="Link to ${safeText}">
                    <span aria-hidden="true">#</span>
                </a>
            </h${level}>`;
        };
        
        // Custom blockquote renderer for callouts
        this.renderer.blockquote = (quote) => {
            const calloutMatch = quote.match(/^\s*\[!(\w+)\]\s*(.*?)$/m);
            if (calloutMatch) {
                const type = calloutMatch[1].toLowerCase();
                const content = quote.replace(/^\s*\[!\w+\]\s*/m, '');
                return this.renderCallout(type, content);
            }
            return `<blockquote>${quote}</blockquote>`;
        };
        
        // Custom code renderer with syntax highlighting
        this.renderer.code = (code, language) => {
            const id = 'code-' + crypto.randomBytes(4).toString('hex');
            const highlighted = language ? 
                hljs.highlight(code, { language }).value : 
                hljs.highlightAuto(code).value;
            
            return `<div class="code-block" data-language="${language || 'text'}">
                <div class="code-header">
                    <span class="code-language">${language || 'text'}</span>
                    ${this.features.copyCode ? `
                        <button class="copy-code-btn" onclick="copyCode('${id}')" aria-label="Copy code">
                            <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span class="copy-text">Copy</span>
                        </button>
                    ` : ''}
                </div>
                <pre><code id="${id}" class="hljs language-${language || 'text'}">${highlighted}</code></pre>
            </div>`;
        };
        
        // Custom table renderer
        this.renderer.table = (header, body) => {
            return `<div class="table-wrapper">
                <table class="data-table">
                    <thead>${header}</thead>
                    <tbody>${body}</tbody>
                </table>
            </div>`;
        };
        
        // Custom list item renderer for task lists
        this.renderer.listitem = (text, task, checked) => {
            if (task) {
                const id = 'task-' + crypto.randomBytes(4).toString('hex');
                return `<li class="task-item">
                    <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} 
                           onchange="saveTaskState('${id}', this.checked)">
                    <label for="${id}">${text}</label>
                </li>`;
            }
            return `<li>${text}</li>`;
        };
        
        // Custom image renderer with lazy loading
        this.renderer.image = (href, title, text) => {
            return `<figure class="image-figure">
                <img src="${href}" alt="${text}" title="${title || ''}" loading="lazy">
                ${title ? `<figcaption>${title}</figcaption>` : ''}
            </figure>`;
        };
        
        // Configure marked options
        marked.setOptions({
            renderer: this.renderer,
            gfm: true,
            breaks: true,
            smartLists: true,
            smartypants: true,
            xhtml: false
        });
    }

    async formatBook(bookDir, options = {}) {
        console.log('📚 Starting HTML Formatter Agent');
        console.log(`📁 Book directory: ${bookDir}`);
        console.log(`🎨 Template: ${this.template}`);
        console.log(`📄 Format: ${this.format}`);
        console.log('');
        
        // Use clean formatter to prevent [object Object] errors
        if (options.useCleanFormatter !== false) {
            console.log('🧹 Using clean formatter to prevent rendering errors');
            const cleanFormatter = new CleanHTMLFormatter({
                template: this.template,
                features: this.features
            });
            return await cleanFormatter.formatBook(bookDir);
        }
        
        try {
            // Load book data
            const bookData = await this.loadBookData(bookDir);
            
            // Create output directory
            const outputDir = options.outputDir || path.join(bookDir, 'html');
            await fs.mkdir(outputDir, { recursive: true });
            
            // Process based on format
            let result;
            switch (this.format) {
                case 'single':
                    result = await this.generateSinglePage(bookData, outputDir);
                    break;
                case 'multi':
                    result = await this.generateMultiPage(bookData, outputDir);
                    break;
                case 'pwa':
                    result = await this.generatePWA(bookData, outputDir);
                    break;
                default:
                    throw new Error(`Unknown format: ${this.format}`);
            }
            
            // Generate additional assets
            await this.generateAssets(outputDir);
            
            console.log('\n✅ HTML Formatting Complete!');
            console.log(`📁 Output: ${outputDir}`);
            
            return {
                success: true,
                outputDir,
                files: result.files,
                stats: result.stats
            };
            
        } catch (error) {
            console.error('❌ Formatting failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadBookData(bookDir) {
        const data = {
            metadata: {},
            chapters: [],
            images: {},
            assets: {}
        };
        
        // Load metadata
        try {
            const metadataPath = path.join(bookDir, 'metadata.json');
            const content = await fs.readFile(metadataPath, 'utf8');
            data.metadata = JSON.parse(content);
        } catch {
            console.warn('No metadata.json found, using defaults');
            data.metadata = {
                title: 'Untitled Book',
                author: 'Unknown Author',
                description: ''
            };
        }
        
        // Load chapters from root directory
        const chapterFiles = await this.getChapterFiles(bookDir);
        
        for (const file of chapterFiles) {
            const content = await fs.readFile(path.join(bookDir, file), 'utf8');
            const chapter = this.parseChapter(content, file);
            data.chapters.push(chapter);
        }
        
        // Load images
        try {
            const imagesDir = path.join(bookDir, 'assets', 'images');
            const imageFiles = await fs.readdir(imagesDir);
            
            for (const file of imageFiles) {
                if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(file)) {
                    const imagePath = path.join(imagesDir, file);
                    const imageData = await fs.readFile(imagePath);
                    const base64 = imageData.toString('base64');
                    const mimeType = this.getMimeType(file);
                    data.images[file] = `data:${mimeType};base64,${base64}`;
                }
            }
        } catch {
            console.log('No images directory found');
        }
        
        return data;
    }

    async getChapterFiles(bookDir) {
        try {
            const files = await fs.readdir(bookDir);
            return files
                .filter(f => f.match(/^chapter-\d+.*\.md$/))
                .sort((a, b) => {
                    const numA = parseInt(a.match(/chapter-(\d+)/)?.[1] || '0');
                    const numB = parseInt(b.match(/chapter-(\d+)/)?.[1] || '0');
                    return numA - numB;
                });
        } catch {
            return [];
        }
    }

    parseChapter(content, filename) {
        const lines = content.split('\n');
        const chapter = {
            filename,
            frontmatter: {},
            content: content,
            html: '',
            toc: []
        };
        
        // Parse frontmatter
        if (lines[0] === '---') {
            let i = 1;
            while (i < lines.length && lines[i] !== '---') {
                const line = lines[i];
                const match = line.match(/^(\w+):\s*(.+)$/);
                if (match) {
                    const key = match[1];
                    const value = match[2].replace(/^["']|["']$/g, '');
                    chapter.frontmatter[key] = value;
                }
                i++;
            }
            
            // Get content after frontmatter
            const contentStart = lines.findIndex((line, idx) => idx > 0 && line === '---') + 1;
            chapter.content = lines.slice(contentStart).join('\n');
        }
        
        // Parse content and generate TOC
        if (chapter.content) {
            chapter.html = marked.parse(chapter.content);
            chapter.toc = this.extractTOC(chapter.content);
        } else {
            chapter.html = '';
            chapter.toc = [];
        }
        
        return chapter;
    }

    extractTOC(content) {
        const toc = [];
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        let match;
        
        while ((match = headingRegex.exec(content)) !== null) {
            const level = match[1].length;
            const text = match[2];
            const slug = this.slugify(text);
            
            toc.push({
                level,
                text,
                slug
            });
        }
        
        return toc;
    }

    async generateSinglePage(bookData, outputDir) {
        console.log('📄 Generating single-page HTML...');
        
        const html = this.buildCompleteHTML(bookData);
        const outputPath = path.join(outputDir, 'index.html');
        
        await fs.writeFile(outputPath, html);
        
        // Validate content
        if (!html.includes('<section class="chapter"') && !html.includes('<article class="chapter"')) {
            throw new Error('FORMAT_FAIL: nenhum <section class="chapter"> ou <article class="chapter">');
        }
        
        if (!html.includes('<img')) {
            throw new Error('FORMAT_FAIL: nenhuma imagem embutida');
        }
        
        if (!html.includes('<nav id="toc"') && !html.includes('<nav class="toc"')) {
            throw new Error('FORMAT_FAIL: nenhum TOC (table of contents)');
        }
        
        const sizeKB = Buffer.byteLength(html) / 1024;
        console.log(`   ✅ HTML gerado: ${sizeKB.toFixed(1)} KB`);
        
        return {
            files: ['index.html'],
            stats: {
                totalSize: Buffer.byteLength(html),
                chapters: bookData.chapters.length,
                images: Object.keys(bookData.images).length
            }
        };
    }

    buildCompleteHTML(bookData) {
        const template = TEMPLATES[this.template];
        const { metadata, chapters, images } = bookData;
        
        // Generate table of contents
        const tocHTML = this.generateTOC(chapters);
        
        // Generate chapters HTML
        const chaptersHTML = chapters.map((chapter, index) => {
            const chapterNum = chapter.frontmatter.chap || index + 1;
            const chapterTitle = chapter.frontmatter.title || `Chapter ${chapterNum}`;
            
            return `
            <article class="chapter" id="chapter-${chapterNum}" data-chapter="${chapterNum}">
                <header class="chapter-header">
                    <h1 class="chapter-title">${chapterTitle}</h1>
                    ${chapter.frontmatter.description ? 
                        `<p class="chapter-description">${chapter.frontmatter.description}</p>` : ''}
                </header>
                <div class="chapter-content">
                    ${chapter.html}
                </div>
                <nav class="chapter-nav">
                    ${index > 0 ? 
                        `<a href="#chapter-${chapterNum - 1}" class="nav-prev">← Previous</a>` : ''}
                    ${index < chapters.length - 1 ? 
                        `<a href="#chapter-${chapterNum + 1}" class="nav-next">Next →</a>` : ''}
                </nav>
            </article>`;
        }).join('\n');
        
        // Build complete HTML
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <meta name="description" content="${metadata.description || ''}">
    <meta name="author" content="${metadata.author || ''}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${metadata.title}">
    <meta property="og:description" content="${metadata.description || ''}">
    <meta property="og:type" content="book">
    
    <!-- PWA -->
    ${this.format === 'pwa' ? `
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="${template.colors.primary}">
    ` : ''}
    
    <!-- Styles -->
    <style>
        ${this.generateCSS(template)}
        ${this.customCSS}
    </style>
    
    <!-- Highlight.js -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>
<body>
    ${this.features.readingProgress ? '<div class="reading-progress"><div class="progress-bar"></div></div>' : ''}
    
    <div class="app-container">
        <!-- Sidebar -->
        ${this.features.toc ? `
        <aside class="sidebar" id="sidebar">
            <header class="sidebar-header">
                <h2 class="book-title">${metadata.title}</h2>
                <p class="book-author">by ${metadata.author}</p>
            </header>
            <nav class="toc" aria-label="Table of Contents">
                ${tocHTML}
            </nav>
        </aside>
        ` : ''}
        
        <!-- Main Content -->
        <main class="main-content">
            <!-- Cover -->
            <section class="cover-page" id="cover">
                ${images['cover.png'] || images['cover.jpg'] || images['cover.svg'] ? `<img src="${images['cover.png'] || images['cover.jpg'] || images['cover.svg']}" alt="Book cover" class="cover-image">` : ''}
                <h1 class="cover-title">${metadata.title}</h1>
                ${metadata.subtitle ? `<p class="cover-subtitle">${metadata.subtitle}</p>` : ''}
                <p class="cover-author">by ${metadata.author}</p>
                <a href="#chapter-1" class="start-reading-btn">Start Reading →</a>
            </section>
            
            <!-- Chapters -->
            ${chaptersHTML}
            
            <!-- About -->
            <section class="about-section" id="about">
                <h2>About This Book</h2>
                <p>${metadata.description || 'No description available.'}</p>
                ${metadata.publisher ? `<p>Published by ${metadata.publisher}</p>` : ''}
            </section>
        </main>
    </div>
    
    <!-- Floating Actions -->
    <div class="fab-container">
        ${this.features.search ? '<button class="fab" onclick="toggleSearch()" aria-label="Search">🔍</button>' : ''}
        ${this.features.darkMode ? '<button class="fab" onclick="toggleTheme()" aria-label="Toggle theme">🌓</button>' : ''}
        ${this.features.toc ? '<button class="fab" onclick="toggleSidebar()" aria-label="Toggle sidebar">📚</button>' : ''}
    </div>
    
    ${this.features.search ? this.generateSearchModal() : ''}
    ${this.features.fontControls ? this.generateFontControls() : ''}
    
    <!-- Scripts -->
    <script>
        ${this.generateJavaScript()}
        ${this.customJS}
    </script>
</body>
</html>`;
    }

    generateCSS(template) {
        return `
        /* Reset & Base */
        *, *::before, *::after {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        :root {
            /* Colors */
            --color-primary: ${template.colors.primary};
            --color-secondary: ${template.colors.secondary};
            --color-accent: ${template.colors.accent};
            --color-background: ${template.colors.background};
            --color-text: ${template.colors.text};
            --color-muted: ${template.colors.muted};
            
            /* Dark mode colors */
            --color-dark-bg: #1a1a1a;
            --color-dark-text: #e0e0e0;
            --color-dark-muted: #999;
            
            /* Typography */
            --font-heading: ${template.fonts.heading};
            --font-body: ${template.fonts.body};
            --font-mono: ${template.fonts.mono};
            
            /* Spacing */
            --content-width: 750px;
            --sidebar-width: 300px;
            
            /* Transitions */
            --transition: 250ms ease;
        }
        
        /* Dark mode */
        [data-theme="dark"] {
            --color-background: var(--color-dark-bg);
            --color-text: var(--color-dark-text);
            --color-muted: var(--color-dark-muted);
        }
        
        /* Typography */
        html {
            font-size: 16px;
            scroll-behavior: smooth;
        }
        
        body {
            font-family: var(--font-body);
            font-size: 1.125rem;
            line-height: 1.7;
            color: var(--color-text);
            background: var(--color-background);
            transition: background-color var(--transition), color var(--transition);
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-heading);
            font-weight: 700;
            line-height: 1.2;
            margin-top: 2em;
            margin-bottom: 0.75em;
            color: var(--color-text);
        }
        
        h1 { font-size: 2.5rem; }
        h2 { font-size: 2rem; }
        h3 { font-size: 1.5rem; }
        h4 { font-size: 1.25rem; }
        
        p { margin-bottom: 1.5rem; }
        
        a {
            color: var(--color-primary);
            text-decoration: none;
            transition: color var(--transition);
        }
        
        a:hover {
            color: var(--color-secondary);
            text-decoration: underline;
        }
        
        /* Heading anchors */
        .heading-anchor {
            opacity: 0;
            margin-left: 0.5rem;
            font-size: 0.8em;
            transition: opacity var(--transition);
        }
        
        h1:hover .heading-anchor,
        h2:hover .heading-anchor,
        h3:hover .heading-anchor {
            opacity: 0.5;
        }
        
        /* Layout */
        .app-container {
            display: flex;
            min-height: 100vh;
        }
        
        /* Sidebar */
        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: var(--sidebar-width);
            background: var(--color-background);
            border-right: 1px solid var(--color-muted);
            overflow-y: auto;
            transform: translateX(0);
            transition: transform var(--transition);
            z-index: 100;
        }
        
        .sidebar.hidden {
            transform: translateX(-100%);
        }
        
        .sidebar-header {
            padding: 2rem;
            border-bottom: 1px solid var(--color-muted);
        }
        
        .book-title {
            font-size: 1.25rem;
            margin: 0;
        }
        
        .book-author {
            color: var(--color-muted);
            font-size: 0.875rem;
            margin-top: 0.5rem;
        }
        
        /* Table of Contents */
        .toc {
            padding: 1rem 0;
        }
        
        .toc-list {
            list-style: none;
        }
        
        .toc-item {
            margin: 0;
        }
        
        .toc-link {
            display: block;
            padding: 0.5rem 2rem;
            color: var(--color-text);
            transition: all var(--transition);
            border-left: 3px solid transparent;
        }
        
        .toc-link:hover {
            background: rgba(0, 0, 0, 0.05);
            border-left-color: var(--color-primary);
            text-decoration: none;
        }
        
        .toc-link.active {
            background: rgba(0, 0, 0, 0.1);
            border-left-color: var(--color-primary);
            font-weight: 600;
        }
        
        .toc-item[data-level="2"] .toc-link {
            padding-left: 3rem;
        }
        
        .toc-item[data-level="3"] .toc-link {
            padding-left: 4rem;
        }
        
        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: var(--sidebar-width);
            transition: margin-left var(--transition);
        }
        
        .sidebar.hidden ~ .main-content {
            margin-left: 0;
        }
        
        /* Reading Progress */
        .reading-progress {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: rgba(0, 0, 0, 0.1);
            z-index: 200;
        }
        
        .progress-bar {
            height: 100%;
            background: var(--color-primary);
            width: 0%;
            transition: width var(--transition);
        }
        
        /* Chapters */
        .chapter,
        .cover-page,
        .about-section {
            max-width: var(--content-width);
            margin: 0 auto;
            padding: 4rem 2rem;
            min-height: 100vh;
        }
        
        .cover-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        
        .cover-image {
            max-width: 400px;
            width: 100%;
            height: auto;
            margin-bottom: 2rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            border-radius: 0.5rem;
        }
        
        .cover-title {
            font-size: 3rem;
            margin: 0 0 1rem;
        }
        
        .cover-subtitle {
            font-size: 1.5rem;
            color: var(--color-muted);
            margin-bottom: 2rem;
        }
        
        .cover-author {
            font-size: 1.25rem;
            color: var(--color-muted);
        }
        
        .start-reading-btn {
            display: inline-block;
            margin-top: 2rem;
            padding: 1rem 2rem;
            background: var(--color-primary);
            color: white;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: all var(--transition);
        }
        
        .start-reading-btn:hover {
            background: var(--color-secondary);
            text-decoration: none;
            transform: translateY(-2px);
        }
        
        .chapter-header {
            margin-bottom: 3rem;
        }
        
        .chapter-title {
            font-size: 2.5rem;
            margin: 0 0 0.5rem;
        }
        
        .chapter-description {
            font-size: 1.25rem;
            color: var(--color-muted);
        }
        
        .chapter-nav {
            display: flex;
            justify-content: space-between;
            margin-top: 4rem;
            padding-top: 2rem;
            border-top: 1px solid var(--color-muted);
        }
        
        .nav-prev,
        .nav-next {
            padding: 0.75rem 1.5rem;
            background: var(--color-background);
            border: 1px solid var(--color-muted);
            border-radius: 0.5rem;
            transition: all var(--transition);
        }
        
        .nav-prev:hover,
        .nav-next:hover {
            background: var(--color-primary);
            color: white;
            text-decoration: none;
            border-color: var(--color-primary);
        }
        
        /* Callouts */
        .callout {
            margin: 2rem 0;
            padding: 1.5rem;
            border-radius: 0.5rem;
            border-left: 4px solid;
            background: rgba(0, 0, 0, 0.05);
        }
        
        .callout-info {
            border-color: var(--color-primary);
            background: rgba(14, 165, 233, 0.1);
        }
        
        .callout-warning {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
        }
        
        .callout-tip {
            border-color: #10b981;
            background: rgba(16, 185, 129, 0.1);
        }
        
        .callout-important {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        
        .callout-quote {
            border-color: var(--color-accent);
            background: rgba(251, 191, 36, 0.1);
        }
        
        .callout-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
        }
        
        .callout-icon {
            font-size: 1.25rem;
        }
        
        /* Code blocks */
        .code-block {
            margin: 2rem 0;
            border-radius: 0.5rem;
            overflow: hidden;
            background: #1a1a1a;
        }
        
        .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: #2d2d2d;
            border-bottom: 1px solid #444;
        }
        
        .code-language {
            color: #888;
            font-size: 0.875rem;
            font-family: var(--font-mono);
        }
        
        .copy-code-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.75rem;
            background: transparent;
            border: 1px solid #444;
            border-radius: 0.25rem;
            color: #ccc;
            font-size: 0.875rem;
            cursor: pointer;
            transition: all var(--transition);
        }
        
        .copy-code-btn:hover {
            background: #444;
            color: white;
        }
        
        .copy-code-btn.copied {
            background: var(--color-primary);
            border-color: var(--color-primary);
            color: white;
        }
        
        pre {
            margin: 0;
            padding: 1rem;
            overflow-x: auto;
        }
        
        code {
            font-family: var(--font-mono);
            font-size: 0.875rem;
            line-height: 1.5;
        }
        
        /* Tables */
        .table-wrapper {
            overflow-x: auto;
            margin: 2rem 0;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid var(--color-muted);
        }
        
        .data-table th,
        .data-table td {
            padding: 0.75rem 1rem;
            text-align: left;
            border-bottom: 1px solid var(--color-muted);
        }
        
        .data-table th {
            background: rgba(0, 0, 0, 0.05);
            font-weight: 600;
        }
        
        .data-table tr:hover {
            background: rgba(0, 0, 0, 0.02);
        }
        
        /* Task lists */
        .task-item {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            list-style: none;
        }
        
        .task-item input[type="checkbox"] {
            margin-top: 0.375rem;
            cursor: pointer;
        }
        
        .task-item label {
            cursor: pointer;
        }
        
        /* Images */
        .image-figure {
            margin: 2rem 0;
            text-align: center;
        }
        
        .image-figure img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .image-figure figcaption {
            margin-top: 0.75rem;
            color: var(--color-muted);
            font-size: 0.875rem;
            font-style: italic;
        }
        
        /* Floating Action Buttons */
        .fab-container {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            z-index: 50;
        }
        
        .fab {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--color-primary);
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            transition: all var(--transition);
        }
        
        .fab:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
        }
        
        /* Search Modal */
        .search-modal {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: flex-start;
            justify-content: center;
            padding-top: 10vh;
            z-index: 300;
        }
        
        .search-modal.active {
            display: flex;
        }
        
        .search-container {
            background: var(--color-background);
            border-radius: 0.5rem;
            width: 90%;
            max-width: 600px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .search-input {
            width: 100%;
            padding: 1.25rem;
            font-size: 1.125rem;
            border: none;
            background: transparent;
            outline: none;
            color: var(--color-text);
        }
        
        .search-results {
            max-height: 400px;
            overflow-y: auto;
            border-top: 1px solid var(--color-muted);
        }
        
        .search-result {
            padding: 1rem 1.25rem;
            border-bottom: 1px solid var(--color-muted);
            cursor: pointer;
            transition: background var(--transition);
        }
        
        .search-result:hover {
            background: rgba(0, 0, 0, 0.05);
        }
        
        .search-highlight {
            background: var(--color-accent);
            padding: 0 0.25rem;
            border-radius: 0.25rem;
        }
        
        /* Font Controls */
        .font-controls {
            position: fixed;
            bottom: 2rem;
            left: 2rem;
            background: var(--color-background);
            border: 1px solid var(--color-muted);
            border-radius: 0.5rem;
            padding: 1rem;
            display: none;
            gap: 1rem;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 50;
        }
        
        .font-controls.active {
            display: flex;
        }
        
        .font-btn {
            padding: 0.5rem 1rem;
            background: transparent;
            border: 1px solid var(--color-muted);
            border-radius: 0.25rem;
            cursor: pointer;
            transition: all var(--transition);
        }
        
        .font-btn:hover {
            background: var(--color-primary);
            color: white;
            border-color: var(--color-primary);
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
            .sidebar {
                transform: translateX(-100%);
            }
            
            .sidebar.active {
                transform: translateX(0);
            }
            
            .main-content {
                margin-left: 0;
            }
        }
        
        @media (max-width: 768px) {
            html { font-size: 14px; }
            
            .chapter,
            .cover-page,
            .about-section {
                padding: 2rem 1rem;
            }
            
            .cover-title { font-size: 2rem; }
            .chapter-title { font-size: 1.75rem; }
            
            .fab-container {
                bottom: 1rem;
                right: 1rem;
            }
            
            .fab {
                width: 48px;
                height: 48px;
                font-size: 1.25rem;
            }
        }
        
        /* Print styles */
        @media print {
            .sidebar,
            .reading-progress,
            .fab-container,
            .search-modal,
            .font-controls,
            .chapter-nav {
                display: none !important;
            }
            
            .main-content {
                margin-left: 0 !important;
            }
            
            .chapter {
                page-break-after: always;
            }
            
            .callout,
            .code-block,
            .table-wrapper {
                break-inside: avoid;
            }
        }
        `;
    }

    generateJavaScript() {
        return `
        // State management
        const state = {
            theme: localStorage.getItem('ebook-theme') || 'light',
            fontSize: parseInt(localStorage.getItem('ebook-fontSize')) || 18,
            sidebarVisible: window.innerWidth > 1024,
            currentChapter: 0
        };
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            initializeTheme();
            initializeFontSize();
            initializeNavigation();
            trackReadingProgress();
            ${this.features.search ? 'initializeSearch();' : ''}
            ${this.features.toc ? 'updateActiveTOC();' : ''}
        });
        
        // Theme management
        function initializeTheme() {
            document.documentElement.setAttribute('data-theme', state.theme);
        }
        
        function toggleTheme() {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', state.theme);
            localStorage.setItem('ebook-theme', state.theme);
        }
        
        // Font size management
        function initializeFontSize() {
            document.body.style.fontSize = state.fontSize + 'px';
        }
        
        function changeFontSize(delta) {
            state.fontSize = Math.max(14, Math.min(24, state.fontSize + delta));
            document.body.style.fontSize = state.fontSize + 'px';
            localStorage.setItem('ebook-fontSize', state.fontSize);
        }
        
        // Sidebar
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            if (window.innerWidth <= 1024) {
                sidebar.classList.toggle('active');
            } else {
                sidebar.classList.toggle('hidden');
            }
        }
        
        // Navigation
        function initializeNavigation() {
            // Smooth scrolling for anchor links
            document.querySelectorAll('a[href^="#"]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = document.querySelector(link.getAttribute('href'));
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        // Close sidebar on mobile
                        if (window.innerWidth <= 1024) {
                            document.getElementById('sidebar')?.classList.remove('active');
                        }
                    }
                });
            });
        }
        
        // Reading progress
        function trackReadingProgress() {
            window.addEventListener('scroll', () => {
                const scrolled = window.scrollY;
                const height = document.documentElement.scrollHeight - window.innerHeight;
                const progress = (scrolled / height) * 100;
                
                ${this.features.readingProgress ? 
                    "document.querySelector('.progress-bar').style.width = progress + '%';" : ''}
                
                ${this.features.toc ? 'updateActiveTOC();' : ''}
            });
        }
        
        ${this.features.toc ? `
        // Table of Contents
        function updateActiveTOC() {
            const chapters = document.querySelectorAll('.chapter');
            const tocLinks = document.querySelectorAll('.toc-link');
            
            let activeChapter = null;
            
            chapters.forEach((chapter, index) => {
                const rect = chapter.getBoundingClientRect();
                if (rect.top <= 100 && rect.bottom >= 100) {
                    activeChapter = index;
                }
            });
            
            tocLinks.forEach((link, index) => {
                if (index === activeChapter) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        }
        ` : ''}
        
        ${this.features.search ? `
        // Search functionality
        function toggleSearch() {
            const modal = document.getElementById('searchModal');
            modal.classList.toggle('active');
            
            if (modal.classList.contains('active')) {
                document.getElementById('searchInput').focus();
            }
        }
        
        function initializeSearch() {
            const searchInput = document.getElementById('searchInput');
            searchInput.addEventListener('input', debounce(performSearch, 300));
            
            // Close on escape
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    toggleSearch();
                }
            });
            
            // Close on outside click
            document.getElementById('searchModal').addEventListener('click', (e) => {
                if (e.target.id === 'searchModal') {
                    toggleSearch();
                }
            });
        }
        
        function performSearch() {
            const query = document.getElementById('searchInput').value.toLowerCase();
            const results = document.getElementById('searchResults');
            
            if (query.length < 2) {
                results.innerHTML = '';
                return;
            }
            
            const chapters = document.querySelectorAll('.chapter-content');
            const matches = [];
            
            chapters.forEach((chapter, index) => {
                const text = chapter.textContent.toLowerCase();
                if (text.includes(query)) {
                    const chapterTitle = chapter.parentElement.querySelector('.chapter-title').textContent;
                    const snippet = extractSnippet(text, query);
                    
                    matches.push({
                        chapter: index + 1,
                        title: chapterTitle,
                        snippet: highlightMatch(snippet, query)
                    });
                }
            });
            
            if (matches.length === 0) {
                results.innerHTML = '<div class="search-result">No results found</div>';
            } else {
                results.innerHTML = matches.map(match => \`
                    <div class="search-result" onclick="goToChapter(\${match.chapter})">
                        <strong>\${match.title}</strong>
                        <div>\${match.snippet}</div>
                    </div>
                \`).join('');
            }
        }
        
        function extractSnippet(text, query) {
            const index = text.indexOf(query);
            const start = Math.max(0, index - 50);
            const end = Math.min(text.length, index + query.length + 50);
            return '...' + text.substring(start, end) + '...';
        }
        
        function highlightMatch(text, query) {
            return text.replace(new RegExp(query, 'gi'), '<span class="search-highlight">$&</span>');
        }
        
        function goToChapter(chapterNum) {
            toggleSearch();
            document.getElementById(\`chapter-\${chapterNum}\`).scrollIntoView({ behavior: 'smooth' });
        }
        ` : ''}
        
        ${this.features.copyCode ? `
        // Copy code functionality
        function copyCode(codeId) {
            const codeElement = document.getElementById(codeId);
            const button = event.target.closest('.copy-code-btn');
            
            if (codeElement) {
                navigator.clipboard.writeText(codeElement.textContent).then(() => {
                    button.classList.add('copied');
                    const originalContent = button.innerHTML;
                    button.innerHTML = '<svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5"></path></svg><span class="copy-text">Copied!</span>';
                    
                    setTimeout(() => {
                        button.classList.remove('copied');
                        button.innerHTML = originalContent;
                    }, 2000);
                });
            }
        }
        ` : ''}
        
        // Task state management
        function saveTaskState(taskId, checked) {
            const tasks = JSON.parse(localStorage.getItem('ebook-tasks') || '{}');
            tasks[taskId] = checked;
            localStorage.setItem('ebook-tasks', JSON.stringify(tasks));
        }
        
        // Load saved task states
        document.addEventListener('DOMContentLoaded', () => {
            const tasks = JSON.parse(localStorage.getItem('ebook-tasks') || '{}');
            Object.entries(tasks).forEach(([taskId, checked]) => {
                const checkbox = document.getElementById(taskId);
                if (checkbox) {
                    checkbox.checked = checked;
                }
            });
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key) {
                case '/':
                    e.preventDefault();
                    ${this.features.search ? 'toggleSearch();' : ''}
                    break;
                case 'b':
                    e.preventDefault();
                    toggleSidebar();
                    break;
                case 'd':
                    e.preventDefault();
                    ${this.features.darkMode ? 'toggleTheme();' : ''}
                    break;
            }
        });
        
        // Utility functions
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        `;
    }

    generateTOC(chapters) {
        const tocItems = [];
        const seenIds = new Set();
        
        chapters.forEach((chapter, index) => {
            const chapterNum = chapter.frontmatter.chap || index + 1;
            const chapterId = `chapter-${chapterNum}`;
            
            // Skip if already seen (de-duplication)
            if (seenIds.has(chapterId)) {
                return;
            }
            seenIds.add(chapterId);
            
            // Add chapter
            tocItems.push(`
                <li class="toc-item" data-level="1">
                    <a href="#${chapterId}" class="toc-link">
                        Chapter ${chapterNum}: ${chapter.frontmatter.title || 'Untitled'}
                    </a>
                </li>
            `);
            
            // Add sub-sections
            chapter.toc.forEach(item => {
                if (item.level <= 3 && item.slug && !seenIds.has(item.slug)) {
                    seenIds.add(item.slug);
                    tocItems.push(`
                        <li class="toc-item" data-level="${item.level}">
                            <a href="#${item.slug}" class="toc-link">${item.text}</a>
                        </li>
                    `);
                }
            });
        });
        
        return `<ul class="toc-list">${tocItems.join('')}</ul>`;
    }

    renderCallout(type, content) {
        const types = {
            info: { icon: 'ℹ️', title: 'Information' },
            warning: { icon: '⚠️', title: 'Warning' },
            tip: { icon: '💡', title: 'Tip' },
            important: { icon: '🔴', title: 'Important' },
            quote: { icon: '💬', title: 'Quote' }
        };
        
        const calloutInfo = types[type] || types.info;
        
        return `
        <div class="callout callout-${type}">
            <div class="callout-header">
                <span class="callout-icon">${calloutInfo.icon}</span>
                <span class="callout-title">${calloutInfo.title}</span>
            </div>
            <div class="callout-content">${marked.parse(content)}</div>
        </div>`;
    }

    generateSearchModal() {
        return `
        <div class="search-modal" id="searchModal">
            <div class="search-container">
                <input type="text" 
                       class="search-input" 
                       id="searchInput" 
                       placeholder="Search content..."
                       autocomplete="off">
                <div class="search-results" id="searchResults"></div>
            </div>
        </div>`;
    }

    generateFontControls() {
        return `
        <div class="font-controls" id="fontControls">
            <button class="font-btn" onclick="changeFontSize(-2)">A-</button>
            <span>Font Size</span>
            <button class="font-btn" onclick="changeFontSize(2)">A+</button>
        </div>`;
    }

    async generateMultiPage(bookData, outputDir) {
        console.log('📄 Generating multi-page HTML...');
        
        const files = [];
        const template = TEMPLATES[this.template];
        
        // Generate index page
        const indexHTML = this.buildIndexPage(bookData);
        await fs.writeFile(path.join(outputDir, 'index.html'), indexHTML);
        files.push('index.html');
        
        // Generate chapter pages
        for (const [index, chapter] of bookData.chapters.entries()) {
            const chapterNum = chapter.frontmatter.chap || index + 1;
            const chapterHTML = this.buildChapterPage(chapter, chapterNum, bookData, template);
            const filename = `chapter-${String(chapterNum).padStart(2, '0')}.html`;
            
            await fs.writeFile(path.join(outputDir, filename), chapterHTML);
            files.push(filename);
        }
        
        return {
            files,
            stats: {
                totalSize: 0, // Calculate if needed
                chapters: bookData.chapters.length,
                images: Object.keys(bookData.images).length
            }
        };
    }

    async generatePWA(bookData, outputDir) {
        console.log('📱 Generating Progressive Web App...');
        
        // Generate single-page HTML first
        const singlePageResult = await this.generateSinglePage(bookData, outputDir);
        
        // Generate manifest.json
        const manifest = {
            name: bookData.metadata.title,
            short_name: bookData.metadata.title.split(' ').slice(0, 2).join(' '),
            description: bookData.metadata.description || '',
            start_url: '/',
            display: 'standalone',
            background_color: TEMPLATES[this.template].colors.background,
            theme_color: TEMPLATES[this.template].colors.primary,
            icons: [
                {
                    src: 'icon-192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: 'icon-512.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ]
        };
        
        await fs.writeFile(
            path.join(outputDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
        
        // Generate service worker
        const sw = this.generateServiceWorker();
        await fs.writeFile(path.join(outputDir, 'sw.js'), sw);
        
        // Add PWA registration to existing files
        await this.injectPWAScript(outputDir);
        
        return {
            files: [...singlePageResult.files, 'manifest.json', 'sw.js'],
            stats: singlePageResult.stats
        };
    }

    generateServiceWorker() {
        return `
        const CACHE_NAME = 'ebook-v1';
        const urlsToCache = [
            '/',
            '/index.html',
            '/manifest.json'
        ];
        
        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => cache.addAll(urlsToCache))
            );
        });
        
        self.addEventListener('fetch', event => {
            event.respondWith(
                caches.match(event.request)
                    .then(response => response || fetch(event.request))
            );
        });
        
        self.addEventListener('activate', event => {
            event.waitUntil(
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            if (cacheName !== CACHE_NAME) {
                                return caches.delete(cacheName);
                            }
                        })
                    );
                })
            );
        });
        `;
    }

    async generateAssets(outputDir) {
        // Generate any additional assets needed
        console.log('📦 Generating additional assets...');
        
        // Create assets directory
        const assetsDir = path.join(outputDir, 'assets');
        await fs.mkdir(assetsDir, { recursive: true });
        
        // Copy fonts, icons, etc. if needed
    }

    slugify(text) {
        if (!text) return '';
        return String(text)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/--+/g, '-')
            .trim();
    }

    getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options['book-dir'] && !options.input) {
        console.error('Usage: formatter-html.js --book-dir="path/to/book" [options]');
        console.error('   or: formatter-html.js --input="chapters/" --output="build/html/"');
        console.error('\nOptions:');
        console.error('  --template    Design template (professional, academic, creative, technical)');
        console.error('  --format      Output format (single, multi, pwa)');
        console.error('  --no-toc      Disable table of contents');
        console.error('  --no-search   Disable search functionality');
        console.error('  --analytics   Enable analytics tracking');
        process.exit(1);
    }
    
    const formatter = new FormatterHTML({
        template: options.template,
        format: options.format,
        features: {
            toc: options['no-toc'] !== true,
            search: options['no-search'] !== true,
            analytics: options.analytics === true
        }
    });
    
    (async () => {
        try {
            const bookDir = options['book-dir'] || options.input;
            const result = await formatter.formatBook(bookDir, {
                outputDir: options.output
            });
            
            process.exit(result.success ? 0 : 1);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

// Export function for pipeline integration
async function formatterHTMLAgent() {
    const formatter = new FormatterHTML({
        template: 'professional',
        format: 'single'
    });
    
    // Format the book
    const bookDir = 'build/ebooks/whats-one-brutal-truth-you-learned-after-starting-your-busin';
    const result = await formatter.formatBook(bookDir);
    
    if (!result.success) {
        throw new Error(`Formatter failed: ${result.error}`);
    }
    
    // Read the generated HTML and return it as a string
    const fs = require('fs').promises;
    const path = require('path');
    const htmlPath = path.join(result.outputDir, 'index.html');
    const htmlContent = await fs.readFile(htmlPath, 'utf8');
    
    return htmlContent;
}

// Export the agent function as default
module.exports = formatterHTMLAgent;

// Also export the class for direct usage
module.exports.FormatterHTML = FormatterHTML;