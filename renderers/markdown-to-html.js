/**
 * Clean Markdown to HTML Renderer
 * 
 * Uses unified/remark/rehype pipeline for reliable markdown→HTML conversion
 * Prevents [object Object] and other rendering issues
 */

const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkGfm = require('remark-gfm');
const remarkRehype = require('remark-rehype');
const rehypeSlug = require('rehype-slug');
const rehypeAutolinkHeadings = require('rehype-autolink-headings');
const rehypeStringify = require('rehype-stringify');
const rehypeHighlight = require('rehype-highlight');
const { toString } = require('mdast-util-to-string');

class MarkdownToHTMLRenderer {
    constructor(options = {}) {
        this.options = {
            gfm: true, // GitHub Flavored Markdown
            highlight: true, // Syntax highlighting
            headingAnchors: true, // Auto-generate heading anchors
            ...options
        };
        
        // Build the processor pipeline
        this.processor = this.buildProcessor();
    }

    buildProcessor() {
        let processor = unified()
            .use(remarkParse);
        
        // GitHub Flavored Markdown (tables, task lists, etc.)
        if (this.options.gfm) {
            processor = processor.use(remarkGfm);
        }
        
        // Convert markdown to HTML AST
        processor = processor.use(remarkRehype, {
            allowDangerousHtml: true
        });
        
        // Add heading IDs and anchors
        if (this.options.headingAnchors) {
            processor = processor
                .use(rehypeSlug)
                .use(rehypeAutolinkHeadings, {
                    behavior: 'append',
                    content: {
                        type: 'element',
                        tagName: 'span',
                        properties: {
                            className: ['heading-anchor']
                        },
                        children: [{ type: 'text', value: '#' }]
                    }
                });
        }
        
        // Syntax highlighting
        if (this.options.highlight) {
            processor = processor.use(rehypeHighlight, {
                ignoreMissing: true,
                plainText: ['text', 'txt']
            });
        }
        
        // Convert to HTML string
        processor = processor.use(rehypeStringify);
        
        return processor;
    }

    /**
     * Render markdown to HTML
     * @param {string} markdown - The markdown content
     * @returns {Promise<{html: string, toc: Array}>}
     */
    async render(markdown) {
        try {
            // Process markdown to HTML
            const file = await this.processor.process(markdown);
            const html = String(file);
            
            // Extract TOC from the processed content
            const toc = await this.extractTOC(markdown);
            
            return {
                html,
                toc,
                success: true
            };
        } catch (error) {
            console.error('Markdown rendering error:', error);
            return {
                html: `<div class="error">Error rendering content: ${error.message}</div>`,
                toc: [],
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract table of contents from markdown
     */
    async extractTOC(markdown) {
        const tocProcessor = unified()
            .use(remarkParse)
            .use(() => (tree) => {
                const toc = [];
                const slugify = (text) => {
                    return text
                        .toLowerCase()
                        .trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                };
                
                const visit = (node, depth = 0) => {
                    if (node.type === 'heading' && node.depth <= 3) {
                        const text = toString(node);
                        const slug = slugify(text);
                        toc.push({
                            level: node.depth,
                            text,
                            slug,
                            id: slug
                        });
                    }
                    
                    if (node.children) {
                        node.children.forEach(child => visit(child, depth + 1));
                    }
                };
                
                visit(tree);
                return toc;
            });
        
        const result = await tocProcessor.process(markdown);
        return result.result || [];
    }

    /**
     * Generate a complete HTML document
     */
    async renderDocument(markdown, metadata = {}) {
        const { html, toc } = await this.render(markdown);
        
        const document = `<!DOCTYPE html>
<html lang="${metadata.language || 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(metadata.title || 'Document')}</title>
    <meta name="description" content="${this.escapeHtml(metadata.description || '')}">
    <meta name="author" content="${this.escapeHtml(metadata.author || '')}">
    
    <!-- Base styles -->
    <link rel="stylesheet" href="assets/css/style.css">
    
    <!-- Syntax highlighting -->
    ${this.options.highlight ? '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">' : ''}
</head>
<body>
    <div class="container">
        ${this.generateTOCHTML(toc)}
        
        <main class="content">
            ${html}
        </main>
    </div>
    
    ${this.options.highlight ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>' : ''}
    <script>
        ${this.options.highlight ? 'hljs.highlightAll();' : ''}
        
        // Smooth scroll for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    </script>
</body>
</html>`;
        
        return document;
    }

    /**
     * Generate table of contents HTML
     */
    generateTOCHTML(toc) {
        if (!toc || toc.length === 0) return '';
        
        // Use a Set to track unique entries
        const seen = new Set();
        const uniqueToc = toc.filter(item => {
            const key = `${item.level}-${item.slug}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        let html = '<nav class="toc" aria-label="Table of contents">\n<h2>Table of Contents</h2>\n<ul>\n';
        
        uniqueToc.forEach(item => {
            const indent = '  '.repeat(item.level - 1);
            html += `${indent}<li class="toc-level-${item.level}">`;
            html += `<a href="#${item.slug}">${this.escapeHtml(item.text)}</a>`;
            html += '</li>\n';
        });
        
        html += '</ul>\n</nav>\n';
        return html;
    }

    /**
     * Escape HTML entities
     */
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Process multiple markdown files into a single book
     */
    async renderBook(chapters, metadata = {}) {
        const processedChapters = [];
        const fullToc = [];
        
        // Process each chapter
        for (const chapter of chapters) {
            const { html, toc } = await this.render(chapter.content);
            
            processedChapters.push({
                ...chapter,
                html,
                toc
            });
            
            // Add chapter to full TOC
            if (chapter.title) {
                fullToc.push({
                    level: 1,
                    text: chapter.title,
                    slug: `chapter-${chapter.number || processedChapters.length}`,
                    id: `chapter-${chapter.number || processedChapters.length}`
                });
                
                // Add chapter's TOC entries with adjusted levels
                toc.forEach(item => {
                    fullToc.push({
                        ...item,
                        level: item.level + 1
                    });
                });
            }
        }
        
        // Combine all chapters
        const combinedHTML = processedChapters
            .map(chapter => {
                const chapterId = `chapter-${chapter.number || ''}`;
                return `<section class="chapter" id="${chapterId}">
                    ${chapter.html}
                </section>`;
            })
            .join('\n\n');
        
        // Generate complete document
        const bookHTML = await this.renderDocument(combinedHTML, {
            ...metadata,
            toc: fullToc
        });
        
        return {
            html: bookHTML,
            chapters: processedChapters,
            toc: fullToc,
            success: true
        };
    }
}

// Export for use in other modules
module.exports = MarkdownToHTMLRenderer;

// Also export a simple function interface
module.exports.renderMarkdown = async function(markdown, options = {}) {
    const renderer = new MarkdownToHTMLRenderer(options);
    return renderer.render(markdown);
};

// Export for testing
module.exports.MarkdownToHTMLRenderer = MarkdownToHTMLRenderer;