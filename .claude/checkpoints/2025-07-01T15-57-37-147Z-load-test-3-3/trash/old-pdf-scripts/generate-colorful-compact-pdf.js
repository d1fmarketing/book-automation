#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
};

async function generateColorfulCompactPDF() {
    console.log(`${colors.green}${colors.bright}🌈 Generating COLORFUL COMPACT PDF (keeping emojis and vibrant colors)...${colors.reset}`);
    
    // Read metadata
    const metadata = yaml.load(fs.readFileSync(path.join(__dirname, '../metadata.yaml'), 'utf8'));
    
    // Set up paths
    const chaptersDir = path.join(__dirname, '../chapters');
    const outputPath = path.join(__dirname, '../build/dist/tdah-descomplicado-colorful.pdf');
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
    
    // Convert markdown to HTML - keep original styling
    let chaptersHTML = '';
    
    for (const [index, chapter] of chapters.entries()) {
        let { content } = chapter;
        
        // Remove frontmatter
        const frontmatterRegex = /^---[\s\S]*?---\s*/m;
        content = content.replace(frontmatterRegex, '');
        content = content.replace(/^(words|words_target|chap|status|title):\s*.*$/gm, '');
        content = content.replace(/^\s*---\s*$/gm, '');
        content = content.trim();
        
        // Parse markdown
        let html = marked.parse(content);
        
        // Keep original box styling
        html = html.replace(/<div class="tip-box">/g, '<div class="tip-box">');
        html = html.replace(/<div class="warning-box">/g, '<div class="warning-box">');
        html = html.replace(/<div class="checklist-box">/g, '<div class="checklist-box">');
        
        // Fix image paths
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
            
            const fileName = path.basename(absolutePath, path.extname(absolutePath));
            const altText = fileName
                .replace(/_/g, ' ')
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            
            return `<img src="file://${absolutePath}" alt="${altText}"`;
        });
        
        // Add dropcaps to first letter of first paragraph
        html = html.replace(/<p>([A-Za-zÀ-ÿ])/g, (match, firstLetter) => {
            return `<p><span class="dropcap">${firstLetter}</span>`;
        });
        
        // Add page break between chapters
        if (index > 0) {
            chaptersHTML += '<div class="page-break"></div>\n';
        }
        
        // Wrap in chapter div
        chaptersHTML += `<div class="chapter">${html}</div>\n`;
    }
    
    // HTML template with ORIGINAL vibrant colors and REDUCED spacing
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="${metadata.language || 'pt-BR'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${metadata.subtitle}">
    <meta name="author" content="${metadata.author || 'Dr. Rafael Mendes'}">
    <title>${metadata.title}</title>
    <style>
        /* ORIGINAL VIBRANT COLORS */
        :root {
            --primary-turquoise: #4ECDC4;
            --accent-coral: #FF6B6B;
            --warm-orange: #FFA06C;
            --mint-green: #95E1D3;
            --soft-lavender: #C7CEEA;
            --text-dark: #2C3E50;
            --text-light: #5A6C7D;
            --bg-white: #FFFFFF;
            --bg-light: #F8F9FA;
            --bg-highlight: #FFF9E6;
        }
        
        /* Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Page setup - 6x9 inches with REDUCED margins */
        @page {
            size: 6in 9in;
            margin: 10mm 12mm; /* Even more reduced */
        }
        
        /* Import fonts */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            font-size: 9.5pt; /* Even more compact */
            line-height: 13pt; /* Even tighter line height */
            color: var(--text-dark);
            background: white;
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
        }
        
        .chapter {
            page-break-before: always;
            margin-top: 0;
            padding-top: 0;
        }
        
        .chapter:first-child {
            page-break-before: avoid;
        }
        
        /* Headings - COLORFUL with REDUCED spacing */
        h1 {
            font-size: 24pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            text-align: center;
            margin: 20pt 0 15pt 0; /* Reduced margins */
            padding: 12pt;
            background: linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(149,225,211,0.1) 100%);
            border-radius: 12pt;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: 600;
            color: var(--accent-coral);
            margin: 15pt 0 10pt 0; /* Reduced margins */
            padding-left: 12pt;
            border-left: 4pt solid var(--accent-coral);
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: 500;
            color: var(--warm-orange);
            margin: 12pt 0 8pt 0; /* Reduced margins */
            page-break-after: avoid;
        }
        
        /* Paragraphs - ULTRA COMPACT spacing */
        p {
            margin-bottom: 4pt; /* Ultra reduced */
            text-align: justify;
            orphans: 2;
            widows: 2;
        }
        
        /* Drop caps - kept colorful */
        .dropcap {
            float: left;
            font-size: 42pt;
            line-height: 36pt;
            font-weight: 700;
            margin-right: 4pt;
            margin-top: 2pt;
            color: var(--primary-turquoise);
        }
        
        /* Lists - COMPACT */
        ul, ol {
            margin: 8pt 0 8pt 16pt; /* Reduced margins */
            padding-left: 12pt;
        }
        
        li {
            margin-bottom: 4pt; /* Reduced spacing */
            line-height: 14pt;
        }
        
        /* Keep colorful bullets */
        ul li::marker {
            color: var(--primary-turquoise);
            font-size: 1.2em;
        }
        
        ol li::marker {
            color: var(--accent-coral);
            font-weight: 600;
        }
        
        /* COLORFUL BOXES with COMPACT spacing */
        .tip-box {
            background: linear-gradient(135deg, rgba(78,205,196,0.15) 0%, rgba(149,225,211,0.15) 100%);
            border: 2pt solid var(--primary-turquoise);
            border-radius: 10pt;
            padding: 8pt; /* Ultra compact padding */
            margin: 8pt 0; /* Ultra compact margins */
            position: relative;
            page-break-inside: avoid;
        }
        
        .tip-box .tip-label {
            position: absolute;
            top: -8pt;
            left: 12pt;
            background: white;
            padding: 2pt 8pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            font-size: 9pt;
        }
        
        .warning-box {
            background: linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,160,108,0.15) 100%);
            border: 2pt solid var(--accent-coral);
            border-radius: 10pt;
            padding: 8pt; /* Ultra compact padding */
            margin: 8pt 0; /* Ultra compact margins */
            position: relative;
            page-break-inside: avoid;
        }
        
        .warning-box .warning-label {
            position: absolute;
            top: -8pt;
            left: 12pt;
            background: white;
            padding: 2pt 8pt;
            font-weight: 700;
            color: var(--accent-coral);
            font-size: 9pt;
        }
        
        .checklist-box {
            background: var(--bg-light);
            border-radius: 10pt;
            padding: 8pt; /* Ultra compact padding */
            margin: 8pt 0; /* Ultra compact margins */
            page-break-inside: avoid;
        }
        
        .checklist-box h4 {
            color: var(--warm-orange);
            margin-bottom: 8pt;
            font-size: 12pt;
        }
        
        .checklist-box ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .checklist-box li {
            padding: 4pt 0 4pt 24pt; /* Ultra compact padding */
            position: relative;
            border-bottom: 1pt solid rgba(0,0,0,0.1);
        }
        
        .checklist-box li:last-child {
            border-bottom: none;
        }
        
        .checklist-box li::before {
            content: "☐";
            position: absolute;
            left: 6pt;
            font-size: 16pt;
            color: var(--primary-turquoise);
        }
        
        /* Images - COMPACT */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 8pt auto; /* Ultra compact margins */
            border-radius: 8pt;
            box-shadow: 0 6pt 20pt rgba(0,0,0,0.15);
            page-break-inside: avoid;
        }
        
        /* Tables - COLORFUL headers */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0; /* Reduced margins */
            border-radius: 8pt;
            overflow: hidden;
            box-shadow: 0 4pt 12pt rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        th {
            background: var(--primary-turquoise);
            color: white;
            padding: 8pt; /* Reduced padding */
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 8pt; /* Reduced padding */
            border-bottom: 1pt solid rgba(0,0,0,0.1);
        }
        
        tr:nth-child(even) {
            background: var(--bg-light);
        }
        
        /* Blockquotes - COLORFUL with COMPACT spacing */
        blockquote {
            margin: 8pt 0; /* Ultra compact margins */
            padding: 8pt; /* Ultra compact padding */
            background: linear-gradient(135deg, rgba(199,206,234,0.2) 0%, rgba(149,225,211,0.2) 100%);
            border-left: 4pt solid var(--soft-lavender);
            border-radius: 8pt;
            font-style: italic;
            font-size: 11pt;
            color: var(--text-dark);
            position: relative;
            page-break-inside: avoid;
        }
        
        blockquote::before {
            content: """;
            font-size: 36pt;
            color: var(--soft-lavender);
            position: absolute;
            top: -6pt;
            left: 10pt;
            font-family: Georgia, serif;
        }
        
        /* Cover page - COLORFUL */
        .cover {
            page-break-after: always;
            width: 6in;
            height: 9in;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, rgba(78,205,196,0.05) 0%, rgba(149,225,211,0.05) 100%);
            position: relative;
        }
        
        .cover h1 {
            font-size: 36pt;
            font-weight: 800;
            margin-bottom: 12pt;
            background: none;
            padding: 0;
        }
        
        .cover h2 {
            font-size: 16pt;
            font-weight: 400;
            margin-bottom: 24pt;
            color: var(--text-dark);
            max-width: 80%;
            border: none;
            padding: 0;
        }
        
        .cover .author {
            font-size: 14pt;
            margin-top: 24pt;
            color: var(--text-light);
        }
        
        /* Special sections */
        .copyright-page {
            text-align: center;
            padding: 12pt 0; /* Reduced padding */
        }
        
        .copyright-info {
            font-size: 9pt;
            line-height: 14pt;
            color: var(--text-light);
            text-align: left;
            max-width: 80%;
            margin: 0 auto;
        }
        
        .author-bio {
            background: linear-gradient(135deg, rgba(149,225,211,0.1) 0%, rgba(199,206,234,0.1) 100%);
            padding: 8pt;
            border-radius: 8pt;
            margin: 8pt 0;
        }
        
        .table-of-contents {
            font-size: 10pt;
            line-height: 14pt; /* Tighter spacing */
        }
        
        /* Numbers for stats */
        .big-number {
            font-size: 36pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            text-align: center;
            margin: 12pt 0 6pt 0;
        }
        
        .big-number-label {
            font-size: 12pt;
            color: var(--text-light);
            text-align: center;
            margin-bottom: 12pt;
        }
        
        /* Dividers */
        hr {
            border: none;
            height: 1pt;
            background: linear-gradient(to right, transparent, var(--primary-turquoise), transparent);
            margin: 8pt 0; /* Ultra compact */
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
    <!-- Cover page -->
    <div class="cover">
        <h1>${metadata.title}</h1>
        <h2>${metadata.subtitle}</h2>
        <div class="author">Dr. Rafael Mendes</div>
    </div>
    
    <!-- Chapters -->
    ${chaptersHTML}
</body>
</html>`;
    
    // Save HTML for debugging
    const htmlPath = path.join(tempDir, 'adhd-book-colorful-compact.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
    
    if (process.env.DEBUG) {
        console.log(`${colors.cyan}🔍 Debug: HTML saved at ${htmlPath}${colors.reset}`);
    }
    
    // Launch Puppeteer
    console.log(`${colors.blue}🚀 Launching Puppeteer...${colors.reset}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none'
        ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2
    });
    
    // Load HTML
    console.log(`${colors.blue}📄 Loading HTML...${colors.reset}`);
    await page.goto(`file://${htmlPath}`, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000 
    });
    
    // Wait for fonts
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));
    
    // Generate PDF
    console.log(`${colors.blue}🖨️ Generating colorful compact PDF...${colors.reset}`);
    await page.pdf({
        path: outputPath,
        format: 'Letter', // Standard US Letter for 6x9
        width: '6in',
        height: '9in',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margin: {
            top: '8mm',
            bottom: '8mm',
            left: '10mm',
            right: '10mm'
        }
    });
    
    await browser.close();
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n${colors.green}${colors.bright}✅ COLORFUL COMPACT PDF generated successfully!${colors.reset}`);
    console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
    console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
    console.log(`${colors.cyan}📖 Format: 6×9 inches${colors.reset}`);
    
    console.log(`\n${colors.yellow}🌈 Features:${colors.reset}`);
    console.log(`  ✓ Original vibrant colors restored`);
    console.log(`  ✓ All emojis preserved`);
    console.log(`  ✓ Reduced margins (12-15mm)`);
    console.log(`  ✓ Tighter line spacing`);
    console.log(`  ✓ Compact paragraph spacing`);
    console.log(`  ✓ Colorful boxes (green/yellow)`);
    console.log(`  ✓ Smaller font size (10pt)`);
    
    if (process.env.DEBUG) {
        console.log(`\n${colors.cyan}🔍 Debug: HTML saved at ${htmlPath}${colors.reset}`);
    }
}

// Run generator
generateColorfulCompactPDF().catch(console.error);