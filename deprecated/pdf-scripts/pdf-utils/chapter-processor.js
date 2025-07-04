/**
 * Chapter Processor Utility
 * Handles reading, sorting, and processing markdown chapters
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');

class ChapterProcessor {
    constructor(chaptersDir) {
        this.chaptersDir = chaptersDir;
        
        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true
        });
    }

    /**
     * Read and sort all chapter files
     */
    async readChapters() {
        const files = await fs.readdir(this.chaptersDir);
        
        // Filter markdown files (exclude README.md)
        const chapterFiles = files
            .filter(f => f.endsWith('.md') && f !== 'README.md')
            .sort(this.sortChapters);
        
        // Read content for each file
        const chapters = [];
        for (const file of chapterFiles) {
            const filePath = path.join(this.chaptersDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            chapters.push({
                filename: file,
                filepath: filePath,
                content
            });
        }
        
        return chapters;
    }

    /**
     * Sort chapters by number (handles decimal numbers like 1.5)
     */
    sortChapters(a, b) {
        const getChapNum = (filename) => {
            const match = filename.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 999;
        };
        return getChapNum(a) - getChapNum(b);
    }

    /**
     * Process a single chapter - remove frontmatter and extract metadata
     */
    processChapter(content) {
        const result = {
            frontmatter: {},
            markdown: content,
            html: ''
        };

        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
            try {
                result.frontmatter = yaml.load(frontmatterMatch[1]);
            } catch (e) {
                // Invalid frontmatter, skip
            }
            
            // Remove frontmatter from content
            result.markdown = content.replace(/^---\n[\s\S]*?\n---\n/, '');
        }

        // Clean up any remaining frontmatter-style lines
        result.markdown = result.markdown
            .replace(/^(words|words_target|chap|status|title):\s*.*$/gm, '')
            .replace(/^\s*---\s*$/gm, '')
            .trim();

        // Convert to HTML
        result.html = marked.parse(result.markdown);

        return result;
    }

    /**
     * Extract chapter title from HTML
     */
    extractChapterTitle(html) {
        const titleMatch = html.match(/<h[12]>(.*?)<\/h[12]>/);
        return titleMatch ? titleMatch[1] : '';
    }

    /**
     * Process AI-IMAGE placeholders (for main preset)
     */
    processAIImagePlaceholders(html, coverBase64) {
        return html.replace(/<img src="" alt="AI-IMAGE: (.*?)">/g, (match, altText) => {
            // For now, use the cover image for any AI-IMAGE placeholder
            const cleanAltText = altText.replace(/"/g, '&quot;').replace(/&quot;&quot;/g, '&quot;');
            return `<img src="${coverBase64}" alt="${cleanAltText}" style="max-width: 100%; height: auto; display: block; margin: 2em auto;">`;
        });
    }

    /**
     * Apply drop caps to first letter of paragraphs
     */
    applyDropCaps(html) {
        return html.replace(/<p>([A-Za-zÀ-ÿ])/g, (match, firstLetter) => {
            return `<p><span class="dropcap">${firstLetter}</span>`;
        });
    }

    /**
     * Apply custom box styling (for colorful presets)
     */
    applyBoxStyling(html, preset) {
        let processedHtml = html;

        if (preset.tipBoxes) {
            processedHtml = processedHtml.replace(/<div class="tip">/g, `
                <div class="tip-box">
                    <div class="tip-label">💡 DICA</div>
            `);
        }

        if (preset.warningBoxes) {
            processedHtml = processedHtml.replace(/<div class="warning">/g, `
                <div class="warning-box">
                    <div class="warning-label">⚠️ ATENÇÃO</div>
            `);
        }

        if (preset.checklistBoxes) {
            processedHtml = processedHtml.replace(/<div class="checklist">/g, `
                <div class="checklist-box">
            `);
            processedHtml = processedHtml.replace(/<li>☐/g, `<li class="checklist-item">`);
        }

        return processedHtml;
    }
}

module.exports = ChapterProcessor;