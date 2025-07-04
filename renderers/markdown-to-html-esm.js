/**
 * Clean Markdown to HTML Renderer (ESM Compatible)
 * 
 * Uses unified/remark/rehype pipeline for reliable markdown→HTML conversion
 * Prevents [object Object] and other rendering issues
 */

async function createMarkdownToHTMLRenderer(options = {}) {
    // Dynamic imports for ESM modules
    const { unified } = await import('unified');
    const { default: remarkParse } = await import('remark-parse');
    const { default: remarkGfm } = await import('remark-gfm');
    const { default: remarkRehype } = await import('remark-rehype');
    const { default: rehypeSlug } = await import('rehype-slug');
    const { default: rehypeAutolinkHeadings } = await import('rehype-autolink-headings');
    const { default: rehypeStringify } = await import('rehype-stringify');
    const { default: rehypeHighlight } = await import('rehype-highlight');
    const { toString } = await import('mdast-util-to-string');
    
    class MarkdownToHTMLRenderer {
        constructor(opts = {}) {
            this.options = {
                gfm: true, // GitHub Flavored Markdown
                highlight: true, // Syntax highlighting
                headingAnchors: true, // Auto-generate heading anchors
                ...opts
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
                            type: 'text',
                            value: ' 🔗'
                        }
                    });
            }
            
            // Syntax highlighting
            if (this.options.highlight) {
                processor = processor.use(rehypeHighlight, {
                    ignoreMissing: true
                });
            }
            
            // Custom plugins can be added here
            if (this.options.plugins) {
                this.options.plugins.forEach(plugin => {
                    processor = processor.use(plugin);
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
                // Process the markdown
                const file = await this.processor.process(markdown);
                
                // Extract TOC if needed
                const toc = this.extractTOC(file);
                
                return {
                    html: String(file),
                    toc: toc
                };
            } catch (error) {
                console.error('Markdown rendering error:', error);
                throw new Error(`Failed to render markdown: ${error.message}`);
            }
        }

        /**
         * Extract table of contents from the AST
         */
        extractTOC(file) {
            const toc = [];
            
            // This would need the AST from the remark phase
            // For now, return empty array
            // TODO: Implement proper TOC extraction
            
            return toc;
        }

        /**
         * Render multiple markdown files
         */
        async renderMultiple(markdownFiles) {
            const results = [];
            
            for (const { name, content } of markdownFiles) {
                const result = await this.render(content);
                results.push({
                    name,
                    ...result
                });
            }
            
            return results;
        }
    }
    
    return new MarkdownToHTMLRenderer(options);
}

module.exports = { createMarkdownToHTMLRenderer };