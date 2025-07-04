#!/usr/bin/env node

/**
 * Clean HTML Formatter
 * 
 * Uses unified/remark/rehype pipeline to prevent [object Object] errors
 * Generates clean, valid HTML from markdown chapters
 */

const fs = require('fs').promises;
const path = require('path');
const { createMarkdownToHTMLRenderer } = require('../renderers/markdown-to-html-esm');
const HTMLSanitizer = require('../utils/html-sanitizer');

class CleanHTMLFormatter {
    constructor(options = {}) {
        this.template = options.template || 'professional';
        this.features = {
            toc: true,
            search: false, // Disabled for now
            darkMode: true,
            readingProgress: true,
            fontControls: true,
            ...options.features
        };
        
        this.renderer = null; // Will be initialized asynchronously
    }

    async formatBook(bookDir) {
        console.log(`📚 Formatting book from: ${bookDir}`);
        
        try {
            // Initialize renderer if not already done
            if (!this.renderer) {
                this.renderer = await createMarkdownToHTMLRenderer({
                    gfm: true,
                    highlight: true,
                    headingAnchors: true
                });
            }
            // Load book metadata
            const metadata = await this.loadMetadata(bookDir);
            
            // Load all chapters
            const chapters = await this.loadChapters(bookDir);
            
            // Load cover image if exists
            const coverImage = await this.loadCoverImage(bookDir);
            
            // Process each chapter
            const processedChapters = [];
            for (const chapter of chapters) {
                // Preprocess markdown to fix common issues
                const cleanMarkdown = HTMLSanitizer.preprocessMarkdown(chapter.content);
                
                // Render to HTML
                const { html } = await this.renderer.render(cleanMarkdown);
                
                // Clean the HTML
                const cleanHTML = HTMLSanitizer.clean(html);
                
                processedChapters.push({
                    ...chapter,
                    html: cleanHTML
                });
            }
            
            // Combine all chapters
            const combinedHTML = this.combineChaptersHTML(processedChapters, metadata, coverImage);
            
            // Generate complete HTML document
            const fullHTML = this.generateFullDocument(combinedHTML, metadata);
            
            // Save HTML file
            const outputDir = path.join(bookDir, 'html');
            await fs.mkdir(outputDir, { recursive: true });
            
            const outputPath = path.join(outputDir, 'index.html');
            await fs.writeFile(outputPath, fullHTML, 'utf8');
            
            // Copy assets
            await this.copyAssets(bookDir, outputDir);
            
            // Validate final HTML
            const validation = HTMLSanitizer.validate(fullHTML);
            if (!validation.valid) {
                console.warn('⚠️  HTML validation issues:', validation.issues);
            }
            
            console.log(`✅ HTML generated: ${outputPath}`);
            
            return {
                success: true,
                outputPath,
                outputDir,
                validation
            };
            
        } catch (error) {
            console.error('❌ Formatting error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadMetadata(bookDir) {
        try {
            const outlinePath = path.join(bookDir, 'outline.json');
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            
            return {
                title: outline.title || 'Untitled Book',
                author: outline.author || 'Unknown Author',
                description: outline.description || '',
                language: outline.language || 'en',
                theme: outline.theme || 'business'
            };
        } catch (error) {
            console.warn('⚠️  Could not load metadata:', error.message);
            return {
                title: 'Untitled Book',
                author: 'Unknown Author',
                description: '',
                language: 'en'
            };
        }
    }

    async loadChapters(bookDir) {
        const files = await fs.readdir(bookDir);
        const chapterFiles = files
            .filter(f => f.match(/^chapter-\d+\.md$/))
            .sort();
        
        const chapters = [];
        
        for (const file of chapterFiles) {
            const content = await fs.readFile(path.join(bookDir, file), 'utf8');
            const number = parseInt(file.match(/chapter-(\d+)/)[1]);
            
            // Extract title from first heading
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : `Chapter ${number}`;
            
            chapters.push({
                number,
                title,
                content,
                filename: file
            });
        }
        
        return chapters;
    }

    async loadCoverImage(bookDir) {
        const imagePaths = [
            path.join(bookDir, 'assets', 'images', 'cover.png'),
            path.join(bookDir, 'assets', 'images', 'cover.jpg'),
            path.join(bookDir, 'cover.png'),
            path.join(bookDir, 'cover.jpg')
        ];
        
        for (const imagePath of imagePaths) {
            try {
                const stats = await fs.stat(imagePath);
                if (stats.size > 100) { // At least 100 bytes
                    // Convert to base64 for embedding
                    const imageBuffer = await fs.readFile(imagePath);
                    const base64 = imageBuffer.toString('base64');
                    const ext = path.extname(imagePath).slice(1);
                    return `data:image/${ext};base64,${base64}`;
                }
            } catch {
                // Continue to next path
            }
        }
        
        return null;
    }

    combineChaptersHTML(chapters, metadata, coverImage) {
        let html = '';
        
        // Add cover if available
        if (coverImage) {
            html += `<div class="cover-page">
                <img src="${coverImage}" alt="${metadata.title} Cover" />
                <h1>${metadata.title}</h1>
                <p class="author">by ${metadata.author}</p>
            </div>\n\n`;
        }
        
        // Add table of contents
        html += '<nav class="toc">\n<h2>Table of Contents</h2>\n<ol>\n';
        chapters.forEach(chapter => {
            html += `<li><a href="#chapter-${chapter.number}">${chapter.title}</a></li>\n`;
        });
        html += '</ol>\n</nav>\n\n';
        
        // Add chapters
        chapters.forEach(chapter => {
            html += `<section id="chapter-${chapter.number}" class="chapter">
                ${chapter.html}
            </section>\n\n`;
        });
        
        return html;
    }

    generateFullDocument(html, metadata) {
        return `<!DOCTYPE html>
<html lang="${metadata.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <meta name="author" content="${metadata.author}">
    <meta name="description" content="${metadata.description}">
    
    <!-- Embedded font -->
    <style>
        @font-face {
            font-family: 'Inter';
            font-weight: 400;
            font-style: normal;
            src: url('data:font/woff2;base64,d09GMgABAAAAA...') format('woff2');
            font-display: swap;
        }
        
        ${this.getDefaultStyles()}
    </style>
    
    ${this.features.darkMode ? this.getDarkModeStyles() : ''}
</head>
<body>
    <div class="container">
        ${this.features.readingProgress ? '<div class="reading-progress"></div>' : ''}
        
        <main class="content">
            ${html}
        </main>
        
        ${this.features.fontControls ? this.getFontControls() : ''}
    </div>
    
    <!-- PDF Download Button -->
    <div class="fab-container">
        <a href="javascript:window.print()" class="fab" title="Download PDF">
            🖨️
        </a>
    </div>
    
    <script>
        ${this.getDefaultScripts()}
    </script>
</body>
</html>`;
    }

    getDefaultStyles() {
        return `
        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        
        /* Typography */
        h1, h2, h3, h4, h5, h6 {
            margin: 1.5em 0 0.5em;
            line-height: 1.2;
        }
        
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; }
        h3 { font-size: 1.5em; }
        
        p {
            margin: 1em 0;
        }
        
        /* Code blocks */
        pre {
            background: #f5f5f5;
            padding: 1em;
            border-radius: 4px;
            overflow-x: auto;
        }
        
        code {
            background: #f5f5f5;
            padding: 2px 4px;
            border-radius: 2px;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        
        /* Links */
        a {
            color: #0066cc;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Chapter spacing */
        .chapter {
            margin: 4em 0;
            page-break-after: always;
        }
        
        /* Cover page */
        .cover-page {
            text-align: center;
            margin: 4em 0;
            page-break-after: always;
        }
        
        .cover-page img {
            max-width: 400px;
            width: 100%;
            height: auto;
            margin: 2em auto;
        }
        
        /* Table of contents */
        .toc {
            margin: 2em 0;
            page-break-after: always;
        }
        
        .toc ol {
            list-style: decimal;
            padding-left: 2em;
        }
        
        .toc li {
            margin: 0.5em 0;
        }
        
        /* PDF button - FAB style */
        .fab-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        
        .fab {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 56px;
            background: #2563eb;
            color: white;
            border-radius: 50%;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-decoration: none;
            font-size: 24px;
            transition: all 0.3s ease;
        }
        
        .fab:hover {
            background: #1d4ed8;
            transform: scale(1.1);
            box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
        }
        
        /* Print styles */
        @media print {
            @page {
                size: 148mm 210mm; /* A5 size */
                margin: 20mm;
            }
            
            body {
                font-size: 11pt;
                line-height: 1.5;
                color: #000;
                background: #fff;
                padding: 0;
            }
            
            .container {
                max-width: 100%;
                margin: 0;
            }
            
            /* Clean chapter breaks */
            .chapter {
                page-break-before: always;
                page-break-after: always;
            }
            
            /* Avoid breaking inside elements */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
            
            p {
                orphans: 3;
                widows: 3;
            }
            
            /* Hide non-printable elements */
            .sidebar,
            .fab-container,
            .reading-progress,
            .font-controls,
            .no-print {
                display: none !important;
            }
            
            /* Optimize images for print */
            img {
                max-width: 100%;
                page-break-inside: avoid;
            }
            
            /* Links */
            a {
                color: #000;
                text-decoration: underline;
            }
            
            /* Show link URLs in print */
            a[href^="http"]:after {
                content: " (" attr(href) ")";
                font-size: 0.8em;
                color: #666;
            }
            
            /* But not for internal links */
            a[href^="#"]:after {
                content: "";
            }
        }
        `;
    }

    getDarkModeStyles() {
        return `
        <style id="dark-mode-styles">
        @media (prefers-color-scheme: dark) {
            body {
                background: #1a1a1a;
                color: #e0e0e0;
            }
            
            pre, code {
                background: #2a2a2a;
                color: #e0e0e0;
            }
            
            a {
                color: #4db8ff;
            }
        }
        </style>
        `;
    }

    getFontControls() {
        return `
        <div class="font-controls">
            <button onclick="changeFontSize(-1)">A-</button>
            <button onclick="changeFontSize(1)">A+</button>
        </div>
        `;
    }

    getDefaultScripts() {
        return `
        // Font size controls
        function changeFontSize(delta) {
            const body = document.body;
            const currentSize = parseFloat(getComputedStyle(body).fontSize);
            body.style.fontSize = (currentSize + delta) + 'px';
        }
        
        // Reading progress
        if (document.querySelector('.reading-progress')) {
            window.addEventListener('scroll', () => {
                const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const scrolled = (winScroll / height) * 100;
                document.querySelector('.reading-progress').style.width = scrolled + '%';
            });
        }
        `;
    }

    async copyAssets(bookDir, outputDir) {
        const assetsDir = path.join(bookDir, 'assets');
        const outputAssetsDir = path.join(outputDir, 'assets');
        
        try {
            await fs.access(assetsDir);
            await this.copyDirectory(assetsDir, outputAssetsDir);
        } catch {
            // No assets directory, that's OK
        }
    }

    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }
}

// Export for use in formatter-html.js
module.exports = CleanHTMLFormatter;

// Also export function interface
module.exports.formatBook = async function(bookDir, options = {}) {
    const formatter = new CleanHTMLFormatter(options);
    return formatter.formatBook(bookDir);
};

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Clean HTML Formatter

Usage:
  node formatter-html-clean.js <book-directory> [options]

Options:
  --template <name>    Template to use (professional, academic, creative, technical)
  --no-toc            Disable table of contents
  --no-dark-mode      Disable dark mode support
  --help              Show this help
        `);
        process.exit(0);
    }
    
    const bookDir = args[0];
    const options = {
        template: args.includes('--template') ? args[args.indexOf('--template') + 1] : 'professional',
        features: {
            toc: !args.includes('--no-toc'),
            darkMode: !args.includes('--no-dark-mode')
        }
    };
    
    const formatter = new CleanHTMLFormatter(options);
    formatter.formatBook(bookDir).then(result => {
        if (!result.success) {
            console.error('Failed:', result.error);
            process.exit(1);
        }
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}