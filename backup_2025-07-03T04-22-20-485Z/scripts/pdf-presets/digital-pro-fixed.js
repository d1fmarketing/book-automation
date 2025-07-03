/**
 * Digital eBook Preset - Professional Adobe Optimized FIXED
 * Uses centralized markdown processing
 */

module.exports = {
    name: 'digital-pro-fixed',
    description: 'Professional Digital eBook with centralized processing',
    
    buildHTML: async function({ metadata, chapters, coverBase64, verbose }) {
        // Chapters already have processed HTML from MarkdownProcessor
        // Just build the HTML structure
        
        // Build cover HTML
        let coverHTML = '';
        if (coverBase64) {
            coverHTML = `
                <div class="cover-page">
                    <img src="${coverBase64}" alt="Book Cover" class="cover-image">
                </div>
            `;
        }
        
        // Build chapters HTML
        let chaptersHTML = '';
        chapters.forEach((chapter, index) => {
            const chapterNum = chapter.frontmatter.chap || index + 1;
            const title = chapter.frontmatter.title || `Chapter ${chapterNum}`;
            const pageBreakClass = (index === 0 && !coverBase64) ? '' : 'new-page';
            
            chaptersHTML += `
                <div class="chapter ${pageBreakClass}" id="chapter-${chapterNum}">
                    <div class="chapter-header">
                        <h1 class="chapter-number">Chapter ${chapterNum}</h1>
                        <h2 class="chapter-title">${title}</h2>
                    </div>
                    <div class="chapter-content">
                        ${chapter.html}
                    </div>
                </div>
            `;
        });
        
        // Build complete HTML
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        @page {
            size: A4;
            margin: 35mm 20mm;
        }
        
        html {
            font-size: 11pt;
        }
        
        body {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.8;
            color: #000;
            background: #fff;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Cover page */
        .cover-page {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            page-break-after: always;
        }
        
        .cover-image {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
        }
        
        /* Chapter styles */
        .chapter {
            max-width: 450pt;
            margin: 0 auto;
            padding: 0 20pt;
        }
        
        .new-page {
            page-break-before: always;
        }
        
        .chapter-header {
            text-align: center;
            margin-bottom: 48pt;
        }
        
        .chapter-number {
            font-size: 14pt;
            font-weight: normal;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 2pt;
            margin-bottom: 12pt;
        }
        
        .chapter-title {
            font-size: 28pt;
            font-weight: normal;
            color: #111;
            line-height: 1.2;
        }
        
        /* Typography */
        h1 {
            font-size: 24pt;
            font-weight: normal;
            margin: 36pt 0 18pt 0;
            color: #111;
            line-height: 1.2;
            page-break-after: avoid;
        }
        
        /* Remove duplicate title */
        .chapter-content > h1:first-child {
            display: none;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: normal;
            margin: 24pt 0 12pt 0;
            color: #222;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: normal;
            margin: 18pt 0 9pt 0;
            color: #333;
            page-break-after: avoid;
        }
        
        p {
            margin-bottom: 12pt;
            text-align: justify;
            text-indent: 1.5em;
            orphans: 3;
            widows: 3;
        }
        
        /* First paragraph - no indent */
        h1 + p,
        h2 + p,
        h3 + p,
        .chapter-content > p:first-child,
        .callout + p,
        blockquote + p {
            text-indent: 0;
        }
        
        /* Callout boxes - centralized styles */
        .callout {
            margin: 18pt 0;
            padding: 12pt 16pt;
            border-radius: 6pt;
            page-break-inside: avoid;
            position: relative;
            overflow: hidden;
        }
        
        .callout-header {
            font-weight: bold;
            margin-bottom: 6pt;
            display: flex;
            align-items: center;
            gap: 8pt;
        }
        
        .callout-icon {
            font-size: 16pt;
            width: 20pt;
            display: inline-block;
            text-align: center;
        }
        
        .callout-content {
            margin-left: 28pt;
        }
        
        /* Callout types */
        .callout-key {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            border-left: 4pt solid #FFD700;
        }
        .callout-key .callout-icon::before { content: "🔑"; }
        
        .callout-info {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-left: 4pt solid #3f51b5;
        }
        .callout-info .callout-icon::before { content: "ℹ️"; }
        
        .callout-tip {
            background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
            border-left: 4pt solid #00bcd4;
        }
        .callout-tip .callout-icon::before { content: "💡"; }
        
        .callout-warning {
            background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
            border-left: 4pt solid #f44336;
        }
        .callout-warning .callout-icon::before { content: "⚠️"; }
        
        .callout-success {
            background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
            border-left: 4pt solid #4caf50;
        }
        .callout-success .callout-icon::before { content: "✅"; }
        
        .callout-quote {
            background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
            border-left: 4pt solid #9c27b0;
            font-style: italic;
        }
        .callout-quote .callout-icon::before { content: "💭"; }
        
        /* Lists */
        ul, ol {
            margin: 12pt 0 12pt 24pt;
        }
        
        li {
            margin-bottom: 6pt;
            line-height: 1.8;
        }
        
        /* Blockquotes */
        blockquote {
            margin: 18pt 0;
            padding: 0 24pt;
            font-style: italic;
            color: #444;
            border-left: 3pt solid #ddd;
        }
        
        /* Code blocks */
        pre, code {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            background: #f8f8f8;
            border: 1pt solid #e0e0e0;
        }
        
        pre {
            padding: 12pt;
            margin: 12pt 0;
            overflow-x: auto;
            white-space: pre-wrap;
            word-wrap: break-word;
            page-break-inside: avoid;
            border-radius: 4pt;
        }
        
        code {
            padding: 2pt 4pt;
            border-radius: 2pt;
        }
        
        pre code {
            background: none;
            border: none;
            padding: 0;
        }
        
        /* Tables */
        .table-wrapper {
            margin: 18pt 0;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            background: white;
        }
        
        th, td {
            padding: 8pt 12pt;
            text-align: left;
            border: 1pt solid #ddd;
        }
        
        th {
            background: #f0f0f0;
            font-weight: bold;
            color: #333;
        }
        
        tr:nth-child(even) {
            background: #f9f9f9;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 18pt auto;
            page-break-inside: avoid;
        }
        
        .chapter-image {
            border-radius: 4pt;
            box-shadow: 0 2pt 8pt rgba(0,0,0,0.1);
        }
        
        /* Image placeholder */
        .image-placeholder {
            border: 2pt dashed #ccc;
            padding: 24pt;
            text-align: center;
            margin: 18pt 0;
            background: #f5f5f5;
            border-radius: 4pt;
        }
        
        .image-placeholder p {
            margin: 0;
            text-indent: 0;
        }
        
        .image-placeholder .image-prompt {
            font-size: 9pt;
            color: #999;
            margin-top: 6pt;
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Prevent orphans and widows */
        p, li, blockquote {
            orphans: 3;
            widows: 3;
        }
        
        /* Headers should stick with content */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
        }
        
        /* Keep elements together */
        figure, table, pre, .callout, .table-wrapper {
            page-break-inside: avoid;
        }
    </style>
</head>
<body>
    ${coverHTML}
    ${chaptersHTML}
</body>
</html>`;
    },
    
    getPDFOptions: function() {
        return {
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div style="font-size: 9pt; color: #999; font-style: italic; text-align: center; width: 100%; padding-top: 10mm;">The Claude Elite Pipeline</div>',
            footerTemplate: '<div style="font-size: 10pt; color: #666; text-align: center; width: 100%; padding-bottom: 10mm;"><span class="pageNumber"></span></div>',
            margin: {
                top: '35mm',
                right: '20mm', 
                bottom: '35mm',
                left: '20mm'
            },
            preferCSSPageSize: true
        };
    }
};