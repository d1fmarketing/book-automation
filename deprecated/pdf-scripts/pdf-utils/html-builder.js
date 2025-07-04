/**
 * HTML Builder Utility
 * Generates HTML templates with preset-specific styles
 */

const fs = require('fs-extra');
const path = require('path');

class HTMLBuilder {
    constructor(metadata, preset) {
        this.metadata = metadata;
        this.preset = preset;
    }

    /**
     * Build complete HTML document
     */
    async buildHTML(chaptersHTML, options = {}) {
        const { coverBase64, customCSS } = options;

        // Build sections based on preset
        const sections = [];

        // Add cover if preset includes it
        if (this.preset.includeCover && coverBase64) {
            sections.push(this.buildCoverSection(coverBase64));
        }

        // Add title page if preset includes it
        if (this.preset.includeTitlePage) {
            sections.push(this.buildTitlePage());
        }

        // Add copyright page if preset includes it
        if (this.preset.includeCopyright) {
            sections.push(this.buildCopyrightPage());
        }

        // Add table of contents if preset includes it
        if (this.preset.includeTOC) {
            sections.push(this.buildTableOfContents(options.chapterTitles || []));
        }

        // Add main content
        sections.push(this.wrapChapters(chaptersHTML));

        // Add thank you page if preset includes it
        if (this.preset.includeThankYou && this.metadata.product_url) {
            sections.push(this.buildThankYouPage());
        }

        // Build complete HTML
        return this.buildHTMLTemplate(sections.join('\n'), customCSS);
    }

    /**
     * Build HTML template with styles
     */
    buildHTMLTemplate(content, customCSS) {
        const styles = customCSS || this.buildPresetStyles();
        
        return `<!DOCTYPE html>
<html lang="${this.metadata.language || 'pt-BR'}"${this.preset.professional ? ' dir="ltr"' : ''}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${this.metadata.subtitle || ''}">
    <meta name="author" content="${this.metadata.author || ''}">
    ${this.preset.professional ? '<meta name="keywords" content="TDAH, produtividade, organização, foco, autoajuda">' : ''}
    <title>${this.metadata.title}${this.metadata.subtitle ? ' - ' + this.metadata.subtitle : ''}</title>
    <style>
        ${styles}
    </style>
</head>
<body>
    ${this.preset.professional ? '<main role="main">' : ''}
    ${this.preset.includeBookTitle ? `<div class="book-title">${this.metadata.title}</div>` : ''}
    ${content}
    ${this.preset.professional ? '</main>' : ''}
</body>
</html>`;
    }

    /**
     * Build preset-specific styles
     */
    buildPresetStyles() {
        // This would be implemented by reading from preset configuration
        // For now, return empty string as styles will be in presets
        return '';
    }

    /**
     * Build cover section
     */
    buildCoverSection(coverBase64) {
        if (this.preset.name === 'main') {
            return `
    <!-- Cover Page -->
    <div class="cover-page">
        ${coverBase64 ? `<img src="${coverBase64.base64}" alt="Book Cover">` : '<p>Capa não encontrada</p>'}
    </div>`;
        } else if (this.preset.professional) {
            return `
        <!-- Professional cover page -->
        <section class="cover" role="doc-cover" aria-label="Capa do livro">
            <h1>${this.metadata.title}</h1>
            <h2>${this.metadata.subtitle || ''}</h2>
            <div class="author" role="doc-credit">${this.metadata.author || ''}</div>
        </section>`;
        } else {
            return `
    <!-- Cover page -->
    <div class="cover">
        <h1>${this.metadata.title}</h1>
        <h2>${this.metadata.subtitle || ''}</h2>
        <div class="author">${this.metadata.author || ''}</div>
    </div>`;
        }
    }

    /**
     * Build title page
     */
    buildTitlePage() {
        return `
    <!-- Página de Título -->
    <div class="title-page">
        <h1>${this.metadata.title}</h1>
        ${this.metadata.subtitle ? `<div class="subtitle">${this.metadata.subtitle}</div>` : ''}
        <div class="author">${this.metadata.author || ''}</div>
    </div>`;
    }

    /**
     * Build copyright page
     */
    buildCopyrightPage() {
        const includeProductLinks = this.metadata.build?.general?.includeProductLinks;
        
        return `
    <!-- Página de Copyright -->
    <div class="copyright-page">
        <p>${this.metadata.copyright || ''}</p>
        <p>${this.metadata.publisher || ''}</p>
        <p>ISBN: ${this.metadata.isbn || ''}</p>
        ${includeProductLinks && this.metadata.product_url ? 
            `<p style="margin-top: 2em;">Disponível em:<br><a href="${this.metadata.product_url}">${this.metadata.product_url}</a></p>` : 
            ''
        }
    </div>`;
    }

    /**
     * Build table of contents
     */
    buildTableOfContents(chapterTitles) {
        const entries = chapterTitles.map((title, index) => {
            const chapterNum = index + 1;
            const pageNum = 5 + index; // Estimate
            return `<div class="toc-entry"><span class="toc-title">Capítulo ${chapterNum}</span><span class="toc-page-num">${pageNum}</span></div>`;
        }).join('\n        ');

        return `
    <!-- Sumário -->
    <div class="toc-page">
        <h2>Sumário</h2>
        ${entries}
    </div>`;
    }

    /**
     * Build thank you page
     */
    buildThankYouPage() {
        return `
    <!-- Página Final com CTA -->
    <div class="thank-you-page">
        <div style="text-align: center; margin-top: 3in;">
            <h2>Obrigado por ler!</h2>
            <div style="font-size: 24pt; color: #666; margin: 1em 0;">❦</div>
            <p style="margin: 2em 0;">
                Para mais informações e recursos adicionais, visite:
            </p>
            <p style="font-size: 14pt;">
                <a href="${this.metadata.product_url}">${this.metadata.product_url}</a>
            </p>
        </div>
    </div>`;
    }

    /**
     * Wrap chapters in appropriate container
     */
    wrapChapters(chaptersHTML) {
        if (this.preset.professional) {
            return `
        <!-- Chapters -->
        <article role="doc-chapter">
            ${chaptersHTML}
        </article>`;
        } else {
            return `
    <!-- Conteúdo dos Capítulos -->
    ${chaptersHTML}`;
        }
    }

    /**
     * Build individual chapter wrapper
     */
    wrapChapter(html, index, options = {}) {
        const { chapterTitle, pageNumber } = options;
        const isFirst = index === 0;
        
        let chapterClass = this.preset.name === 'main' && isFirst ? 'chapter-first' : 'chapter';
        let chapterAttrs = '';
        
        if (this.preset.professional && pageNumber) {
            chapterAttrs = ` data-page="${pageNumber}"`;
        }

        let wrapper = '';
        
        // Add page break before chapter (except first)
        if (index > 0 && !this.preset.noPageBreaks) {
            wrapper += '<div class="page-break"></div>\n';
        }

        // Add chapter title string for headers (main preset)
        if (this.preset.name === 'main' && chapterTitle) {
            wrapper += `<div class="${chapterClass}"${chapterAttrs}>
                <div class="chapter-title-string">${chapterTitle}</div>
                ${html}
            </div>\n`;
        } else {
            wrapper += `<div class="${chapterClass}"${chapterAttrs}>${html}</div>\n`;
        }

        return wrapper;
    }
}

module.exports = HTMLBuilder;