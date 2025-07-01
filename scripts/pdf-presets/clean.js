// Clean preset - Minimalist with zero margins
// Based on generate-clean-pdf.js

module.exports = {
    name: 'clean',
    description: 'Minimalist PDF with zero margins and clean layout',
    
    buildHTML: async function({ metadata, chapters, coverBase64, verbose }) {
        // Build chapters HTML
        let chaptersHTML = '';
        chapters.forEach((chapter, index) => {
            const title = chapter.frontmatter.title || `Chapter ${index + 1}`;
            chaptersHTML += `
                <div class="chapter">
                    <h1>${title}</h1>
                    ${chapter.html}
                </div>
            `;
        });
        
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${metadata.title}</title>
    <style>
        @page {
            size: 6in 9in;
            margin: 0;
        }
        
        body {
            margin: 0;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #222;
        }
        
        .chapter {
            page-break-before: always;
        }
        
        .chapter:first-child {
            page-break-before: avoid;
        }
        
        h1 {
            font-size: 24pt;
            font-weight: 600;
            margin: 0 0 1em 0;
            color: #000;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: 600;
            margin: 2em 0 1em 0;
            color: #222;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: 600;
            margin: 1.5em 0 0.5em 0;
            color: #333;
        }
        
        p {
            margin: 0 0 1em 0;
        }
        
        blockquote {
            margin: 1em 0;
            padding-left: 1em;
            border-left: 3px solid #ddd;
            color: #666;
            font-style: italic;
        }
        
        ul, ol {
            margin: 0 0 1em 0;
            padding-left: 2em;
        }
        
        li {
            margin-bottom: 0.5em;
        }
        
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em 0;
        }
        
        hr {
            border: none;
            border-top: 1px solid #eee;
            margin: 2em 0;
        }
        
        code {
            background: #f5f5f5;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }
        
        pre {
            background: #f5f5f5;
            padding: 1em;
            border-radius: 5px;
            overflow-x: auto;
            margin: 1em 0;
        }
        
        pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    ${chaptersHTML}
</body>
</html>`;
    },
    
    getPDFOptions: function() {
        return {
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: false,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            }
        };
    }
};