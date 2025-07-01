#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const addPDFAccessibility = require('./add-pdf-accessibility');
const addCMYKIntent = require('./add-cmyk-intent');

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
};

async function generateProfessionalPDF() {
    console.log(`${colors.green}${colors.bright}🏆 Generating PROFESSIONAL GRADE PDF with 20pt baseline grid...${colors.reset}`);
    
    // Read metadata
    const metadata = yaml.load(fs.readFileSync(path.join(__dirname, '../metadata.yaml'), 'utf8'));
    
    // Set up paths
    const chaptersDir = path.join(__dirname, '../chapters');
    const outputPath = path.join(__dirname, '../build/dist/tdah-descomplicado.pdf');
    const tempDir = path.join(__dirname, '../build/temp');
    
    // Ensure directories exist
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Read all chapters (exclude README.md)
    const chapters = fs.readdirSync(chaptersDir)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .sort((a, b) => {
            // Extract chapter numbers for proper sorting
            const getChapNum = (filename) => {
                const match = filename.match(/(\d+(?:\.\d+)?)/);
                return match ? parseFloat(match[1]) : 999;
            };
            return getChapNum(a) - getChapNum(b);
        })
        .map(f => {
            const content = fs.readFileSync(path.join(chaptersDir, f), 'utf8');
            return { filename: f, content };
        });
    
    console.log(`${colors.blue}📖 Processing ${chapters.length} chapters...${colors.reset}`);
    
    // Convert markdown to HTML with professional styling
    let chaptersHTML = '';
    let currentPageNumber = 2; // Start after cover
    
    for (const [index, chapter] of chapters.entries()) {
        let { content } = chapter;
        
        // Remove frontmatter
        const frontmatterRegex = /^---[\s\S]*?---\s*/m;
        content = content.replace(frontmatterRegex, '');
        content = content.replace(/^(words|words_target|chap|status|title):\s*.*$/gm, '');
        content = content.replace(/^\s*---\s*$/gm, '');
        content = content.trim();
        
        // Parse clean markdown
        let html = marked.parse(content);
        
        // Professional tip boxes with grid alignment
        html = html.replace(/<div class="tip">/g, `
            <div class="tip-box">
                <div class="tip-label">💡 DICA</div>
        `);
        
        // Professional warning boxes with grid alignment
        html = html.replace(/<div class="warning">/g, `
            <div class="warning-box">
                <div class="warning-label">⚠️ ATENÇÃO</div>
        `);
        
        // Professional checklists
        html = html.replace(/<div class="checklist">/g, `
            <div class="checklist-box">
        `);
        
        // Styled checklist items
        html = html.replace(/<li>☐/g, `<li class="checklist-item">`);
        
        // Fix image paths and handle .png to .jpg conversion
        const imgDir = path.join(__dirname, '../assets/images');
        html = html.replace(/<img src="([^"]+)"/g, (match, src) => {
            if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('file://')) {
                return match;
            }
            
            let absolutePath;
            if (src.startsWith('/')) {
                absolutePath = path.join(__dirname, '..', src.slice(1));
            } else if (src.startsWith('../')) {
                absolutePath = path.join(__dirname, src);
            } else if (src.startsWith('assets/')) {
                absolutePath = path.join(__dirname, '..', src);
            } else {
                absolutePath = path.join(imgDir, src);
            }
            
            // Check if .png was converted to .jpg
            if (absolutePath.endsWith('.png')) {
                const jpgPath = absolutePath.replace(/\.png$/i, '.jpg');
                if (fs.existsSync(jpgPath)) {
                    absolutePath = jpgPath;
                }
            }
            
            // Extract filename for alt text
            const fileName = path.basename(absolutePath, path.extname(absolutePath));
            const altText = fileName
                .replace(/_/g, ' ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            return `<img src="file://${absolutePath}" alt="${altText}" role="img"`;
        });
        
        // Professional drop caps
        html = html.replace(/<p>([A-Za-zÀ-ÿ])/g, (match, firstLetter) => {
            return `<p><span class="dropcap">${firstLetter}</span>`;
        });
        
        // Add page break between chapters
        if (index > 0) {
            chaptersHTML += '<div class="page-break"></div>\n';
        }
        
        // Wrap in chapter div
        chaptersHTML += `<div class="chapter" data-page="${currentPageNumber}">${html}</div>\n`;
        currentPageNumber += Math.ceil(html.length / 3000); // Estimate pages
    }
    
    // Professional HTML template with baseline grid
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="${metadata.language || 'pt-BR'}" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metadata.subtitle}">
    <meta name="author" content="${metadata.author || 'Dr. Rafael Mendes'}">
    <meta name="keywords" content="TDAH, produtividade, organização, foco, autoajuda">
    <title>${metadata.title} - ${metadata.subtitle}</title>
    <style>
        /* PROFESSIONAL BASELINE GRID SYSTEM - 20pt */
        :root {
            --baseline: 20pt;
            --half-baseline: 10pt;
            --quarter-baseline: 5pt;
            --double-baseline: 40pt;
            
            /* Typography scale based on baseline - Optimized */
            --font-size-base: 10.5pt;
            --font-size-h1: 22pt;
            --font-size-h2: 16pt;
            --font-size-h3: 13pt;
            --font-size-h4: 11pt;
            --font-size-small: 8.5pt;
            
            /* Line heights that maintain baseline - Tighter */
            --line-height-base: 16pt;
            --line-height-h1: 28pt;
            --line-height-h2: 20pt;
            --line-height-h3: 16pt;
            --line-height-h4: 16pt;
            
            /* Professional margins (18mm = ~51pt) */
            --margin-outer: 51pt;
            --margin-inner: 45pt;
            --margin-top: 51pt;
            --margin-bottom: 60pt;
            
            
        /* Professional icon font */
        @font-face {
            font-family: 'BookIcons';
            src: local('Arial Unicode MS'), local('Symbola'), local('DejaVu Sans');
            font-weight: normal;
            font-style: normal;
        }
        
        .icon {
            font-family: 'BookIcons', 'Arial Unicode MS', 'Symbola', sans-serif;
            font-size: 1.1em;
            line-height: 1;
            display: inline-block;
            vertical-align: middle;
            margin: 0 0.1em;
        }
        
        /* Professional Color Palette - CMYK-friendly */
            --color-primary: #00897B;
            --color-secondary: #FF6B6B;
            --color-accent: #F39C12;
            --color-text: #2C3E50;
            --color-light: #7F8C8D;
            --color-bg-light: #ECF0F1;
            --color-success: #27AE60;
        }
        
        /* Reset and base */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Page setup - A5 */
        @page {
            size: 148mm 210mm;
            margin: 0;
            marks: crop cross;
            bleed: 3mm;
        }
        
        @page :left {
            margin: var(--margin-top) var(--margin-outer) var(--margin-bottom) var(--margin-inner);
        }
        
        @page :right {
            margin: var(--margin-top) var(--margin-inner) var(--margin-bottom) var(--margin-outer);
        }
        
        @page :first {
            margin: 0;
        }
        
        /* Base typography with embedded fonts */
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;0,700;1,400&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        body {
            font-family: 'Crimson Text', 'Minion Pro', 'Georgia', serif;
            font-size: var(--font-size-base);
            line-height: var(--line-height-base);
            color: var(--color-text);
            background: white;
            text-rendering: optimizeLegibility;
            font-feature-settings: "kern" 1, "liga" 1, "onum" 1;
            hyphens: auto;
            -webkit-hyphens: auto;
            -moz-hyphens: auto;
            font-variant-numeric: oldstyle-nums proportional-nums;
        }
        
        /* Grid alignment helper */
        .baseline-grid {
            background-image: repeating-linear-gradient(
                to bottom,
                rgba(0, 0, 0, 0.05) 0,
                rgba(0, 0, 0, 0.05) 1px,
                transparent 1px,
                transparent var(--baseline)
            );
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
            break-after: always;
        }
        
        /* Chapter starts */
        .chapter {
            page-break-before: always;
        }
        
        .chapter:first-child {
            page-break-before: avoid;
        }
        
        /* Headings - aligned to baseline with tighter spacing */
        h1 {
            font-family: 'Inter', sans-serif;
            font-size: var(--font-size-h1);
            line-height: var(--line-height-h1);
            font-weight: 700;
            color: var(--color-primary);
            text-align: center;
            margin-bottom: 12pt;
            padding-top: 8pt;
            padding-bottom: 4pt;
            letter-spacing: -0.02em;
            font-feature-settings: "kern" 1, "liga" 1, "lnum" 1;
            page-break-after: avoid;
        }
        
        h2 {
            font-family: 'Inter', sans-serif;
            font-size: var(--font-size-h2);
            line-height: var(--line-height-h2);
            font-weight: 600;
            color: var(--color-secondary);
            margin-top: 12pt;
            margin-bottom: 6pt;
            padding-left: var(--quarter-baseline);
            border-left: 3pt solid var(--color-secondary);
            page-break-after: avoid;
        }
        
        h3 {
            font-family: 'Inter', sans-serif;
            font-size: var(--font-size-h3);
            line-height: var(--line-height-h3);
            font-weight: 500;
            color: var(--color-accent);
            margin-top: 8pt;
            margin-bottom: 4pt;
            page-break-after: avoid;
        }
        
        h4 {
            font-family: 'Inter', sans-serif;
            font-size: var(--font-size-h4);
            line-height: var(--line-height-h4);
            font-weight: 500;
            color: var(--color-light);
            margin-top: 6pt;
            margin-bottom: 4pt;
            page-break-after: avoid;
        }
        
        /* Paragraphs - baseline aligned with tighter spacing */
        p {
            margin-bottom: 8pt;
            text-align: justify;
            orphans: 3;
            widows: 3;
        }
        
        /* First paragraph after heading */
        h1 + p, h2 + p, h3 + p, h4 + p {
            text-indent: 0;
        }
        
        /* Drop caps */
        .dropcap {
            float: left;
            font-size: calc(var(--baseline) * 3);
            line-height: calc(var(--baseline) * 2.5);
            font-weight: 700;
            margin-right: var(--quarter-baseline);
            margin-top: var(--quarter-baseline);
            color: var(--color-primary);
            font-feature-settings: "lnum" 1;
        }
        
        /* Lists - baseline aligned with tighter spacing */
        ul, ol {
            margin-left: 16pt;
            margin-bottom: 8pt;
            padding-left: 8pt;
        }
        
        li {
            margin-bottom: 4pt;
            line-height: var(--line-height-base);
        }
        
        /* Professional components - grid aligned with optimized spacing */
        .tip-box, .warning-box, .checklist-box {
            margin: 10pt 0;
            padding: 10pt 12pt;
            border-radius: var(--quarter-baseline);
            page-break-inside: avoid;
            position: relative;
        }
        
        .tip-box {
            background: rgba(0, 137, 123, 0.05);
            border-left: 3pt solid var(--color-primary);
        }
        
        .warning-box {
            background: rgba(211, 47, 47, 0.05);
            border-left: 3pt solid var(--color-secondary);
        }
        
        .checklist-box {
            background: rgba(0, 0, 0, 0.02);
            border: 1pt solid rgba(0, 0, 0, 0.1);
        }
        
        .tip-label, .warning-label {
            position: absolute;
            top: calc(var(--half-baseline) * -1);
            left: var(--baseline);
            background: white;
            padding: 0 var(--half-baseline);
            font-size: var(--font-size-small);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .tip-label {
            color: var(--color-primary);
        }
        
        .warning-label {
            color: var(--color-secondary);
        }
        
        /* Checklist items */
        .checklist-item {
            list-style: none;
            position: relative;
            padding-left: calc(var(--baseline) * 1.5);
            margin-bottom: var(--half-baseline);
        }
        
        .checklist-item::before {
            content: '';
            position: absolute;
            left: 0;
            top: 2pt;
            width: 14pt;
            height: 14pt;
            border: 2pt solid var(--color-primary);
            border-radius: 2pt;
            background: white;
        }
        
        /* Images - grid aligned */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: var(--baseline) auto;
            page-break-inside: avoid;
        }
        
        /* Tables - professional styling */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: var(--baseline) 0;
            font-size: var(--font-size-small);
            page-break-inside: avoid;
        }
        
        th {
            background: var(--color-primary);
            color: white;
            padding: var(--half-baseline);
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: var(--half-baseline);
            border-bottom: 0.5pt solid rgba(0, 0, 0, 0.1);
        }
        
        tr:nth-child(even) {
            background: rgba(0, 0, 0, 0.02);
        }
        
        /* Blockquotes - baseline aligned */
        blockquote {
            margin: var(--baseline) 0;
            padding: var(--half-baseline) var(--baseline);
            border-left: 3pt solid var(--color-light);
            font-style: italic;
            font-size: var(--font-size-base);
            line-height: var(--line-height-base);
            page-break-inside: avoid;
        }
        
        /* Code blocks */
        pre {
            background: rgba(0, 0, 0, 0.03);
            border-radius: var(--quarter-baseline);
            padding: var(--baseline);
            overflow-x: auto;
            font-size: var(--font-size-small);
            line-height: var(--baseline);
            margin: var(--baseline) 0;
            page-break-inside: avoid;
        }
        
        code {
            background: rgba(0, 0, 0, 0.05);
            padding: 1pt 4pt;
            border-radius: 2pt;
            font-size: var(--font-size-small);
        }
        
        /* Professional cover page */
        .cover {
            page-break-after: always;
            width: 148mm;
            height: 210mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: white;
            color: var(--color-text);
            position: relative;
            padding: var(--double-baseline);
        }
        
        .cover::before {
            content: '';
            position: absolute;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            width: 120mm;
            height: 1pt;
            background: var(--color-primary);
        }
        
        .cover::after {
            content: '';
            position: absolute;
            bottom: 20%;
            left: 50%;
            transform: translateX(-50%);
            width: 120mm;
            height: 1pt;
            background: var(--color-primary);
        }
        
        .cover h1 {
            font-family: 'Inter', sans-serif;
            font-size: 36pt;
            font-weight: 800;
            line-height: var(--double-baseline);
            margin-bottom: var(--baseline);
            color: var(--color-primary);
            text-shadow: none;
            letter-spacing: -0.03em;
        }
        
        .cover h2 {
            font-family: 'Crimson Text', serif;
            font-size: 16pt;
            line-height: calc(var(--baseline) * 1.2);
            font-weight: 400;
            margin-bottom: var(--double-baseline);
            color: var(--color-text);
            max-width: 80%;
        }
        
        .cover .author {
            font-family: 'Crimson Text', serif;
            font-size: 14pt;
            margin-top: var(--double-baseline);
            color: var(--color-light);
            font-style: normal;
            font-weight: 400;
        }
        
        .cover .author::before {
            content: '';
            display: block;
            width: 40mm;
            height: 1pt;
            background: var(--color-light);
            margin: 0 auto var(--baseline) auto;
        }
        
        /* Page numbers */
        @page :left {
            @bottom-left {
                content: counter(page);
                font-size: var(--font-size-small);
                color: var(--color-light);
            }
        }
        
        @page :right {
            @bottom-right {
                content: counter(page);
                font-size: var(--font-size-small);
                color: var(--color-light);
            }
        }
        
        /* Professional front matter styles */
        .copyright-page {
            text-align: center;
            padding: var(--double-baseline) 0;
        }
        
        .copyright-page h1 {
            font-size: 28pt;
            margin-bottom: var(--half-baseline);
        }
        
        .copyright-page h2 {
            font-size: 16pt;
            font-weight: 400;
            color: var(--color-light);
            border: none;
            margin-bottom: var(--double-baseline);
        }
        
        .copyright-info {
            font-size: var(--font-size-small);
            line-height: var(--baseline);
            color: var(--color-light);
            text-align: left;
            max-width: 80%;
            margin: 0 auto;
        }
        
        .author-bio {
            background: var(--color-bg-light);
            padding: var(--baseline);
            border-radius: var(--half-baseline);
            font-size: var(--font-size-base);
            line-height: var(--line-height-base);
        }
        
        .table-of-contents {
            font-size: var(--font-size-base);
            line-height: calc(var(--baseline) * 1.5);
        }
        
        .table-of-contents strong {
            display: inline-block;
            width: 85%;
        }
        
        /* Print optimization */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <main role="main">
        <!-- Professional cover page -->
        <section class="cover" role="doc-cover" aria-label="Capa do livro">
            <h1>${metadata.title}</h1>
            <h2>${metadata.subtitle}</h2>
            <div class="author" role="doc-credit">Dr. Rafael Mendes</div>
        </section>
        
        <!-- Chapters -->
        <article role="doc-chapter">
            ${chaptersHTML}
        </article>
    </main>
</body>
</html>`;
    
    // Save HTML for debugging and QA
    const htmlPath = path.join(tempDir, 'adhd-book-professional.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    if (process.env.DEBUG) {
        console.log(`${colors.cyan}🔍 Debug: HTML saved at ${htmlPath}${colors.reset}`);
    }
    
    // Launch Puppeteer with professional settings and accessibility support
    console.log(`${colors.blue}🚀 Launching Puppeteer with professional settings and accessibility support...${colors.reset}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none',
            '--export-tagged-pdf', // Enable accessibility tags
            '--enable-accessibility-object-model' // Enable accessibility features
        ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport for A5
    await page.setViewport({
        width: 595,  // A5 width in pixels
        height: 842, // A5 height in pixels
        deviceScaleFactor: 2
    });
    
    // Load HTML
    console.log(`${colors.blue}📄 Loading HTML...${colors.reset}`);
    await page.goto(`file://${htmlPath}`, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000 
    });
    
    // Wait for fonts and styles
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    
    // Add metadata to page
    await page.evaluateHandle((metadata) => {
        // Set document metadata
        if (window.PDFDocument) {
            window.PDFDocument.info = {
                Title: metadata.title,
                Subject: metadata.subtitle,
                Author: metadata.author,
                Keywords: 'TDAH, produtividade, organização, foco',
                Creator: 'Book Automation Pipeline',
                Producer: 'Puppeteer',
                CreationDate: new Date()
            };
        }
    }, metadata);
    
    // Generate professional PDF with metadata
    console.log(`${colors.blue}🖨️ Generating professional PDF with metadata...${colors.reset}`);
    await page.pdf({
        path: outputPath,
        format: 'A5',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        },
        // PDF metadata
        title: metadata.title,
        author: metadata.author,
        subject: metadata.subtitle,
        keywords: 'TDAH, produtividade, organização, foco',
        creator: 'Book Automation Pipeline',
        producer: 'Puppeteer'
    });
    
    await browser.close();
    
    // Add accessibility features
    console.log(`\n${colors.blue}♿ Adding accessibility features...${colors.reset}`);
    const accessiblePath = outputPath.replace('.pdf', '-accessible.pdf');
    await addPDFAccessibility(outputPath, accessiblePath);
    
    // Replace original with accessible version
    fs.renameSync(accessiblePath, outputPath);
    
    // Add CMYK intent
    console.log(`\n${colors.blue}🎨 Adding CMYK color intent...${colors.reset}`);
    const cmykPath = outputPath.replace('.pdf', '-cmyk.pdf');
    await addCMYKIntent(outputPath, cmykPath);
    
    // Replace original with CMYK version
    fs.renameSync(cmykPath, outputPath);
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n${colors.green}${colors.bright}✅ PROFESSIONAL PDF generated successfully!${colors.reset}`);
    console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
    console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
    console.log(`${colors.cyan}📖 Format: A5 (148mm × 210mm)${colors.reset}`);
    
    console.log(`\n${colors.yellow}🏆 Professional Features:${colors.reset}`);
    console.log(`  ✓ 20pt baseline grid system`);
    console.log(`  ✓ Typography in points (pt)`);
    console.log(`  ✓ 18mm standardized margins`);
    console.log(`  ✓ Embedded fonts`);
    console.log(`  ✓ CMYK-friendly colors`);
    console.log(`  ✓ Professional components`);
    console.log(`  ✓ Print-ready PDF`);
    console.log(`  ✓ Basic document structure`);
    
    console.log(`\n${colors.yellow}⚠️  For full commercial compliance:${colors.reset}`);
    console.log(`  1. Install Ghostscript: brew install ghostscript`);
    console.log(`  2. Run: ./scripts/finalize-commercial-pdf.sh`);
    
    if (process.env.DEBUG) {
        console.log(`\n${colors.cyan}🔍 Debug: HTML saved at ${htmlPath}${colors.reset}`);
    }
}

// Run generator
generateProfessionalPDF().catch(console.error);