// Main preset - Full book with cover, TOC, and professional layout
// Based on the original generate-pdf-puppeteer.js

module.exports = {
    name: 'main',
    description: 'Full book with cover, table of contents, and professional layout',
    
    buildHTML: async function({ metadata, chapters, coverBase64, verbose }) {
        const fs = require('fs-extra');
        const path = require('path');
        const bookDir = path.join(__dirname, '..', '..', 'pipeline-book');
        const coverPath = path.join(bookDir, 'assets', 'images', 'cover.png');
        let finalCoverBase64 = '';
        if (await fs.pathExists(coverPath)) {
            const coverBuffer = await fs.readFile(coverPath);
            finalCoverBase64 = `data:image/png;base64,${coverBuffer.toString('base64')}`;
        }
        
        // Replace AI-IMAGE placeholders with actual images
        for (const chapter of chapters) {
            chapter.html = chapter.html.replace(/!\[([^\]]*)\]\(AI-IMAGE:([^)]+)\)/g, (match, alt, prompt) => {
                const promptSlug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const imagePath = `assets/images/chapters/${promptSlug}.webp`;
                const fullPath = require('path').join(process.cwd(), imagePath);
                
                if (require('fs').existsSync(fullPath)) {
                    const imageBuffer = require('fs').readFileSync(fullPath);
                    const base64 = imageBuffer.toString('base64');
                    if (verbose) {
                        console.log(`✅ Replaced AI-IMAGE with actual image: ${imagePath}`);
                    }
                    return `<img src="data:image/webp;base64,${base64}" alt="${alt}" style="max-width: 100%; height: auto; display: block; margin: 2rem auto;">`;
                } else {
                    if (verbose) {
                        console.log(`⚠️ Image not found for AI-IMAGE: ${imagePath}`);
                    }
                    return `<div style="border: 2px dashed #ccc; padding: 2rem; text-align: center; margin: 2rem 0; background: #f5f5f5;">
                        <p style="color: #666; margin: 0;">🖼️ AI-IMAGE: ${alt}</p>
                        <p style="color: #999; font-size: 0.9em; margin: 0.5rem 0 0 0;">Prompt: ${prompt}</p>
                    </div>`;
                }
            });
        }
        
        // Build table of contents
        let tocHTML = '<div class="toc"><h2>Sumário</h2><ul>';
        chapters.forEach((chapter, index) => {
            const title = chapter.frontmatter.title || `Capítulo ${index + 1}`;
            tocHTML += `<li><a href="#chapter-${index + 1}">${title}</a></li>`;
        });
        tocHTML += '</ul></div>';
        
        // Build chapters HTML
        let chaptersHTML = '';
        chapters.forEach((chapter, index) => {
            const title = chapter.frontmatter.title || `Capítulo ${index + 1}`;
            chaptersHTML += `
                <div class="chapter" id="chapter-${index + 1}">
                    <h1 class="chapter-title">Capítulo ${index + 1}</h1>
                    <h2 class="chapter-subtitle">${title}</h2>
                    <div class="chapter-content">
                        ${chapter.html}
                    </div>
                </div>
            `;
        });
        
        // Build complete HTML
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        @page {
            size: 6in 9in;
            margin: 0.75in;
            @bottom-center {
                content: counter(page);
                font-family: Georgia, serif;
                font-size: 10pt;
                color: #666;
            }
        }
        
        @page :first {
            margin: 0;
            @bottom-center {
                content: '';
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            text-align: justify;
            hyphens: auto;
        }
        
        /* Cover page */
        .cover-page {
            width: 6in;
            height: 9in;
            page-break-after: always;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            overflow: hidden;
        }
        
        .cover-page img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Title page */
        .title-page {
            page-break-after: always;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-height: 100vh;
        }
        
        .title-page h1 {
            font-size: 36pt;
            margin-bottom: 0.5in;
            font-weight: normal;
        }
        
        .title-page .author {
            font-size: 18pt;
            color: #666;
            margin-bottom: 2in;
        }
        
        .title-page .publisher {
            font-size: 10pt;
            color: #999;
            position: absolute;
            bottom: 1in;
            left: 50%;
            transform: translateX(-50%);
        }
        
        /* Copyright page */
        .copyright-page {
            page-break-after: always;
            font-size: 9pt;
            color: #666;
            padding-top: 3in;
        }
        
        .copyright-page p {
            margin-bottom: 0.5em;
            text-align: left;
        }
        
        /* Table of contents */
        .toc {
            page-break-after: always;
        }
        
        .toc h2 {
            font-size: 24pt;
            margin-bottom: 1in;
            text-align: center;
            font-weight: normal;
        }
        
        .toc ul {
            list-style: none;
        }
        
        .toc li {
            margin-bottom: 0.5em;
            font-size: 12pt;
        }
        
        .toc a {
            text-decoration: none;
            color: #333;
        }
        
        /* Chapters */
        .chapter {
            page-break-before: always;
        }
        
        .chapter-title {
            font-size: 14pt;
            text-align: center;
            margin-bottom: 0.5em;
            font-weight: normal;
            color: #666;
        }
        
        .chapter-subtitle {
            font-size: 24pt;
            text-align: center;
            margin-bottom: 1.5in;
            font-weight: normal;
        }
        
        /* Content styles */
        p {
            margin-bottom: 1em;
            text-indent: 0.5in;
        }
        
        p:first-child,
        h1 + p,
        h2 + p,
        h3 + p,
        blockquote + p {
            text-indent: 0;
        }
        
        h1, h2, h3, h4, h5, h6 {
            font-weight: normal;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            text-align: left;
        }
        
        h1 { font-size: 18pt; }
        h2 { font-size: 16pt; }
        h3 { font-size: 14pt; }
        
        blockquote {
            margin: 1em 0.5in;
            font-style: italic;
            color: #555;
        }
        
        /* Lists */
        ul, ol {
            margin: 1em 0 1em 0.5in;
        }
        
        li {
            margin-bottom: 0.25em;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1em auto;
        }
        
        /* Scene breaks */
        hr {
            border: none;
            text-align: center;
            margin: 2em 0;
        }
        
        hr:after {
            content: "* * *";
            color: #999;
        }
        
        /* No break for dialogues */
        .no-break {
            page-break-inside: avoid;
        }
        
        /* First paragraph after chapter title */
        .chapter-content > p:first-child {
            text-indent: 0;
        }
        
        .chapter-content > p:first-child:first-letter {
            font-size: 3em;
            line-height: 1;
            float: left;
            margin: 0 0.1em 0 0;
        }
    </style>
</head>
<body>
    ${finalCoverBase64 ? `<div class="cover-page"><img src="${finalCoverBase64}" alt="Capa do livro"></div>` : ''}
    
    <div class="title-page">
        <h1>${metadata.title}</h1>
        <div class="author">${metadata.author}</div>
        <div class="publisher">${metadata.publisher || ''}</div>
    </div>
    
    <div class="copyright-page">
        <p>Copyright © ${new Date().getFullYear()} ${metadata.author}</p>
        <p>Todos os direitos reservados.</p>
        ${metadata.isbn ? `<p>ISBN: ${metadata.isbn}</p>` : ''}
        <p>Categoria: ${metadata.category || 'Ficção'}</p>
        ${metadata.publisher ? `<p>Publicado por: ${metadata.publisher}</p>` : ''}
    </div>
    
    ${tocHTML}
    
    ${chaptersHTML}
</body>
</html>`;
    },
    
    getPDFOptions: function() {
        return {
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: {
                top: '0',
                right: '0',
                bottom: '0',
                left: '0'
            },
            preferCSSPageSize: true
        };
    }
};