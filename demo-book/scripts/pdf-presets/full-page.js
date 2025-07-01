/**
 * Full Page PDF Preset
 * Maximum content area with zero margins and emoji preservation
 */

module.exports = {
    name: 'full-page',
    description: 'Full page PDF with zero margins and emoji preservation',
    
    // Output filename
    outputFilename: () => 'ebook-full-page.pdf',
    
    // Features
    features: {
        includeCover: false,
        includeTitlePage: false,
        includeCopyright: false,
        includeTOC: false,
        includeThankYou: false,
        includeBookTitle: false,
        includePageNumbers: false,
        processAIImages: false,
        saveDebugHTML: false,
        useExternalCSS: false,
        dropCaps: false,
        preserveEmojis: true,
        customRenderer: true
    },
    
    // PDF options - A5 format with zero margins
    pdfOptions: () => ({
        format: 'A5', // ~6x9 inches
        printBackground: true,
        margin: {
            top: '0',
            right: '0',
            bottom: '0',
            left: '0'
        },
        displayHeaderFooter: false
    }),
    
    // Puppeteer options
    puppeteerOptions: {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    
    // Page options
    pageOptions: {
        waitUntil: 'networkidle0'
    },
    
    // Custom marked renderer for preserving HTML and emojis
    getMarkedOptions() {
        const renderer = new (require('marked').Renderer)();
        
        // Preserve existing HTML in markdown
        renderer.html = function(html) {
            return html;
        };
        
        // Don't escape text to preserve emojis
        renderer.text = function(text) {
            return text;
        };
        
        return {
            renderer,
            breaks: true,
            gfm: true,
            sanitize: false
        };
    },
    
    // Get custom CSS
    async getCustomCSS() {
        return this.defaultCSS;
    },
    
    // Full page preset CSS
    defaultCSS: `
        @page {
            size: 6in 9in;
            margin: 0;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0.75in; /* Content padding inside the page */
            width: 6in;
            min-height: 9in;
        }
        
        .chapter {
            page-break-after: always;
            margin-bottom: 0;
        }
        
        .chapter:last-child {
            page-break-after: avoid;
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-weight: 600;
            line-height: 1.2;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            page-break-after: avoid;
        }
        
        h1 { 
            font-size: 24pt; 
            color: #2c3e50;
            margin-top: 0;
        }
        
        .chapter-title {
            text-align: center;
            margin-bottom: 2em;
        }
        
        h2 { 
            font-size: 18pt; 
            color: #34495e;
        }
        
        h3 { 
            font-size: 14pt; 
            color: #34495e;
        }
        
        p {
            margin-bottom: 0.8em;
            text-align: justify;
            hyphens: auto;
        }
        
        ul, ol {
            margin-left: 1.5em;
            margin-bottom: 0.8em;
        }
        
        li {
            margin-bottom: 0.3em;
        }
        
        /* Colorful boxes - Compact */
        .tip-box, .warning-box, .info-box {
            padding: 12px 16px;
            margin: 0.8em 0;
            border-radius: 8px;
            page-break-inside: avoid;
            border: 2px solid;
            font-size: 10pt;
        }
        
        .tip-box {
            background-color: #e8f8f5;
            border-color: #4ECDC4;
            color: #0a5c55;
        }
        
        .warning-box {
            background-color: #fff3cd;
            border-color: #FFA06C;
            color: #664d03;
        }
        
        .info-box {
            background-color: #e7f3ff;
            border-color: #2196F3;
            color: #0d47a1;
        }
        
        /* Code blocks - Very compact */
        pre {
            background-color: #f5f5f5;
            padding: 8px 12px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 0.5em 0;
            font-size: 9pt;
            line-height: 1.3;
            page-break-inside: avoid;
            border: 1px solid #e0e0e0;
        }
        
        code {
            background-color: #f0f0f0;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9pt;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        
        pre code {
            background: none;
            padding: 0;
            font-size: 9pt;
        }
        
        /* Tables - Compact */
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.8em 0;
            font-size: 10pt;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 6px 10px;
            text-align: left;
        }
        
        th {
            background-color: #f5f5f5;
            font-weight: 600;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 4px solid #4ECDC4;
            padding-left: 1em;
            margin: 0.8em 0;
            color: #555;
            font-style: italic;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0.8em auto;
        }
        
        /* Preserve emoji styling */
        .emoji {
            font-size: 1.2em;
            vertical-align: middle;
        }
        
        /* Links */
        a {
            color: #2196F3;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Reduce spacing for lists inside colored boxes */
        .tip-box ul, .warning-box ul, .info-box ul,
        .tip-box ol, .warning-box ol, .info-box ol {
            margin-bottom: 0;
            margin-top: 0.3em;
        }
        
        .tip-box li, .warning-box li, .info-box li {
            margin-bottom: 0.2em;
        }
        
        /* Horizontal rules */
        hr {
            border: none;
            border-top: 1px solid #ddd;
            margin: 1em 0;
        }
    `,
    
    // Process content before markdown conversion
    preprocessContent(content) {
        // Replace problematic emoji patterns before markdown conversion
        return content
            .replace(/❄️❄️/g, '<span class="emoji">❄️❄️</span>')
            .replace(/📧/g, '<span class="emoji">📧</span>');
    },
    
    // Process chapters
    processChapter(html, options) {
        // Extract chapter title
        const titleMatch = html.match(/<h1>(.*?)<\/h1>/);
        if (titleMatch && !options.hasChapterTitle) {
            const title = titleMatch[1];
            html = html.replace(/<h1>.*?<\/h1>/, `<h1 class="chapter-title">${title}</h1>`);
        }
        
        return html;
    }
};