/**
 * Central Markdown Processor
 * Handles all markdown transformations including callouts, AI-IMAGE placeholders, etc.
 */

const marked = require('marked');
const fs = require('fs');
const path = require('path');

class MarkdownProcessor {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        
        // Configure marked with consistent settings
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false,
            pedantic: false,
            sanitize: false,
            smartLists: true,
            smartypants: false
        });
        
        // Custom renderer for callouts
        this.renderer = new marked.Renderer();
        this.setupCalloutRenderer();
    }
    
    setupCalloutRenderer() {
        const originalParagraph = this.renderer.paragraph.bind(this.renderer);
        const self = this;
        
        this.renderer.paragraph = function(text) {
            // Ensure text is a string
            if (typeof text !== 'string') {
                return originalParagraph(text);
            }
            
            // Check for callout syntax: [!TYPE] or > [!TYPE]
            const calloutMatch = text.match(/^(?:&gt;\s*)?\[!(\w+)\]\s*(.*?)(?:<br>|$)([\s\S]*)/i);
            
            if (calloutMatch) {
                const type = calloutMatch[1].toLowerCase();
                const title = calloutMatch[2] || type.charAt(0).toUpperCase() + type.slice(1);
                const content = calloutMatch[3]
                    .replace(/^&gt;\s*/gm, '')
                    .replace(/<br>/g, '\n')
                    .trim();
                
                return `<div class="callout callout-${type}">
                    <div class="callout-header">
                        <span class="callout-icon"></span>
                        <span class="callout-title">${title}</span>
                    </div>
                    <div class="callout-content">${content}</div>
                </div>`;
            }
            
            return originalParagraph(text);
        };
    }
    
    /**
     * Process markdown content with all transformations
     */
    processMarkdown(content, options = {}) {
        // Preprocess simple callout syntax before marked sees it
        content = this.preprocessCallouts(content);
        
        // Parse markdown with custom renderer
        let html = marked.parse(content, { renderer: this.renderer });
        
        // Process AI-IMAGE placeholders
        if (options.processAIImages !== false) {
            html = this.processAIImagePlaceholders(html);
        }
        
        // Process blockquote callouts (for content already converted to HTML)
        html = this.processBlockquoteCallouts(html);
        
        return html;
    }
    
    /**
     * Process AI-IMAGE placeholders
     */
    processAIImagePlaceholders(html) {
        return html.replace(/!\[([^\]]*)\]\(AI-IMAGE:([^)]+)\)/g, (match, alt, prompt) => {
            const promptSlug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const imagePath = path.join(process.cwd(), 'assets/images/chapters', `${promptSlug}.webp`);
            
            if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                const base64 = imageBuffer.toString('base64');
                if (this.verbose) {
                    console.log(`✅ Replaced AI-IMAGE with actual image: ${promptSlug}.webp`);
                }
                return `<img src="data:image/webp;base64,${base64}" alt="${alt}" class="chapter-image">`;
            } else {
                if (this.verbose) {
                    console.log(`⚠️ Image not found for AI-IMAGE: ${promptSlug}.webp`);
                }
                return `<div class="image-placeholder">
                    <p>🖼️ ${alt}</p>
                    <p class="image-prompt">AI-IMAGE: ${prompt}</p>
                </div>`;
            }
        });
    }
    
    /**
     * Process blockquote-style callouts in HTML
     */
    processBlockquoteCallouts(html) {
        // Handle blockquote callouts that might have been converted to HTML
        const blockquoteCalloutRegex = /<blockquote>\s*(?:<p>)?\s*\[!(\w+)\]\s*(.*?)(?:<\/p>)?\s*(?:<p>)?([\s\S]*?)(?:<\/p>)?\s*<\/blockquote>/gi;
        
        return html.replace(blockquoteCalloutRegex, (match, type, title, content) => {
            const cleanType = type.toLowerCase();
            const cleanTitle = title || cleanType.charAt(0).toUpperCase() + cleanType.slice(1);
            const cleanContent = content
                .replace(/<p>/g, '')
                .replace(/<\/p>/g, '\n\n')
                .trim();
            
            return `<div class="callout callout-${cleanType}">
                <div class="callout-header">
                    <span class="callout-icon"></span>
                    <span class="callout-title">${cleanTitle}</span>
                </div>
                <div class="callout-content">${cleanContent}</div>
            </div>`;
        });
    }
    
    /**
     * Preprocess simple callout syntax [!TYPE] to blockquote syntax
     */
    preprocessCallouts(content) {
        const lines = content.split('\n');
        const result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const simpleCalloutMatch = line.match(/^\[!(\w+)\]\s*(.*)/);
            
            if (simpleCalloutMatch) {
                const type = simpleCalloutMatch[1];
                const title = simpleCalloutMatch[2];
                
                // Convert to blockquote syntax
                result.push(`> [!${type}] ${title}`);
                
                // Check if next lines should be part of the callout
                let j = i + 1;
                while (j < lines.length && lines[j].trim() !== '' && !lines[j].match(/^\[!\w+\]/) && !lines[j].match(/^>\s*\[!\w+\]/) && !lines[j].match(/^#/)) {
                    result.push('> ' + lines[j]);
                    j++;
                }
                i = j - 1; // Skip processed lines
            } else {
                result.push(line);
            }
        }
        
        return result.join('\n');
    }
    
    /**
     * Extract frontmatter from markdown content
     */
    extractFrontmatter(content) {
        const yaml = require('js-yaml');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        
        if (frontmatterMatch) {
            try {
                const frontmatter = yaml.load(frontmatterMatch[1]);
                const markdown = content.replace(/^---\n[\s\S]*?\n---\n/, '');
                return { frontmatter, markdown };
            } catch (e) {
                if (this.verbose) {
                    console.warn('Failed to parse frontmatter:', e.message);
                }
            }
        }
        
        return { frontmatter: {}, markdown: content };
    }
}

module.exports = MarkdownProcessor;