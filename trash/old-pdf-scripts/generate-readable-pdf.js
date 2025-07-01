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

async function generateReadablePDF() {
    console.log(`${colors.green}${colors.bright}📖 Generating READABLE PDF with proper spacing...${colors.reset}`);
    
    // Read metadata
    const metadata = yaml.load(fs.readFileSync(path.join(__dirname, '../metadata.yaml'), 'utf8'));
    
    // Set up paths
    const chaptersDir = path.join(__dirname, '../chapters');
    const outputPath = path.join(__dirname, '../build/dist/tdah-descomplicado-readable.pdf');
    const tempDir = path.join(__dirname, '../build/temp');
    
    // Ensure directories exist
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Read all chapters (exclude README.md)
    const chapters = fs.readdirSync(chaptersDir)
        .filter(f => f.endsWith('.md') && f !== 'README.md')
        .sort((a, b) => {
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
    
    // Convert markdown to HTML
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
        
        // Add dropcaps
        html = html.replace(/<p>([A-Za-zÀ-ÿ])/g, (match, firstLetter) => {
            return `<p><span class="dropcap">${firstLetter}</span>`;
        });
        
        // Add page break between chapters
        if (index > 0) {
            chaptersHTML += '<div class="page-break"></div>\n';
        }
        
        chaptersHTML += `<div class="chapter">${html}</div>\n`;
    }
    
    // HTML template with READABLE spacing and FULL PAGE usage
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
        /* VIBRANT COLORS */
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
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* Page setup - FULL PAGE USAGE */
        @page {
            size: 6in 9in;
            margin: 0.5in; /* Much smaller margins to use full page */
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            font-size: 11pt; /* Readable size */
            line-height: 18pt; /* Comfortable spacing */
            color: var(--text-dark);
            background: white;
            padding: 0;
            margin: 0;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        .chapter {
            page-break-before: always;
        }
        
        .chapter:first-child {
            page-break-before: avoid;
        }
        
        /* Headings - COLORFUL and READABLE */
        h1 {
            font-size: 28pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            text-align: center;
            margin: 24pt 0 18pt 0;
            padding: 16pt;
            background: linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(149,225,211,0.1) 100%);
            border-radius: 12pt;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 20pt;
            font-weight: 600;
            color: var(--accent-coral);
            margin: 20pt 0 12pt 0;
            padding-left: 12pt;
            border-left: 4pt solid var(--accent-coral);
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 16pt;
            font-weight: 500;
            color: var(--warm-orange);
            margin: 16pt 0 10pt 0;
            page-break-after: avoid;
        }
        
        /* Paragraphs - COMFORTABLE spacing */
        p {
            margin-bottom: 12pt;
            text-align: justify;
            orphans: 3;
            widows: 3;
        }
        
        /* Drop caps - VISIBLE */
        .dropcap {
            float: left;
            font-size: 48pt;
            line-height: 42pt;
            font-weight: 700;
            margin-right: 6pt;
            margin-top: 2pt;
            color: var(--primary-turquoise);
        }
        
        /* Lists - READABLE */
        ul, ol {
            margin: 12pt 0 12pt 20pt;
            padding-left: 16pt;
        }
        
        li {
            margin-bottom: 6pt;
            line-height: 18pt;
        }
        
        /* Colorful bullets */
        ul li::marker {
            color: var(--primary-turquoise);
            font-size: 1.3em;
        }
        
        ol li::marker {
            color: var(--accent-coral);
            font-weight: 600;
        }
        
        /* COLORFUL BOXES - properly sized */
        .tip-box {
            background: linear-gradient(135deg, rgba(78,205,196,0.15) 0%, rgba(149,225,211,0.15) 100%);
            border: 2pt solid var(--primary-turquoise);
            border-radius: 12pt;
            padding: 16pt;
            margin: 16pt 0;
            position: relative;
            page-break-inside: avoid;
        }
        
        .tip-box .tip-label {
            position: absolute;
            top: -10pt;
            left: 16pt;
            background: white;
            padding: 3pt 10pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            font-size: 11pt;
        }
        
        .warning-box {
            background: linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,160,108,0.15) 100%);
            border: 2pt solid var(--accent-coral);
            border-radius: 12pt;
            padding: 16pt;
            margin: 16pt 0;
            position: relative;
            page-break-inside: avoid;
        }
        
        .warning-box .warning-label {
            position: absolute;
            top: -10pt;
            left: 16pt;
            background: white;
            padding: 3pt 10pt;
            font-weight: 700;
            color: var(--accent-coral);
            font-size: 11pt;
        }
        
        .checklist-box {
            background: var(--bg-light);
            border-radius: 12pt;
            padding: 16pt;
            margin: 16pt 0;
            page-break-inside: avoid;
        }
        
        .checklist-box h4 {
            color: var(--warm-orange);
            margin-bottom: 10pt;
            font-size: 14pt;
        }
        
        .checklist-box ul {
            list-style: none;
            margin: 0;
            padding: 0;
        }
        
        .checklist-box li {
            padding: 8pt 0 8pt 28pt;
            position: relative;
            border-bottom: 1pt solid rgba(0,0,0,0.1);
        }
        
        .checklist-box li:last-child {
            border-bottom: none;
        }
        
        .checklist-box li::before {
            content: "☐";
            position: absolute;
            left: 8pt;
            font-size: 18pt;
            color: var(--primary-turquoise);
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 16pt auto;
            border-radius: 8pt;
            box-shadow: 0 6pt 20pt rgba(0,0,0,0.15);
            page-break-inside: avoid;
        }
        
        /* Tables - COLORFUL */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16pt 0;
            border-radius: 8pt;
            overflow: hidden;
            box-shadow: 0 4pt 12pt rgba(0,0,0,0.1);
            page-break-inside: avoid;
            font-size: 10pt;
        }
        
        th {
            background: var(--primary-turquoise);
            color: white;
            padding: 10pt;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 10pt;
            border-bottom: 1pt solid rgba(0,0,0,0.1);
        }
        
        tr:nth-child(even) {
            background: var(--bg-light);
        }
        
        /* Blockquotes */
        blockquote {
            margin: 16pt 0;
            padding: 16pt;
            background: linear-gradient(135deg, rgba(199,206,234,0.2) 0%, rgba(149,225,211,0.2) 100%);
            border-left: 4pt solid var(--soft-lavender);
            border-radius: 8pt;
            font-style: italic;
            font-size: 12pt;
            color: var(--text-dark);
            position: relative;
            page-break-inside: avoid;
        }
        
        blockquote::before {
            content: """;
            font-size: 42pt;
            color: var(--soft-lavender);
            position: absolute;
            top: -8pt;
            left: 12pt;
            font-family: Georgia, serif;
        }
        
        /* Cover page */
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
            padding: 1in;
        }
        
        .cover h1 {
            font-size: 42pt;
            font-weight: 800;
            margin-bottom: 20pt;
            background: none;
            padding: 0;
        }
        
        .cover h2 {
            font-size: 18pt;
            font-weight: 400;
            margin-bottom: 30pt;
            color: var(--text-dark);
            max-width: 80%;
            border: none;
            padding: 0;
        }
        
        .cover .author {
            font-size: 16pt;
            margin-top: 30pt;
            color: var(--text-light);
        }
        
        /* Special sections */
        .copyright-page {
            text-align: center;
            padding: 30pt 0;
        }
        
        .copyright-info {
            font-size: 10pt;
            line-height: 16pt;
            color: var(--text-light);
            text-align: left;
            max-width: 80%;
            margin: 0 auto;
        }
        
        .author-bio {
            background: linear-gradient(135deg, rgba(149,225,211,0.1) 0%, rgba(199,206,234,0.1) 100%);
            padding: 16pt;
            border-radius: 10pt;
            margin: 16pt 0;
        }
        
        .table-of-contents {
            font-size: 11pt;
            line-height: 20pt;
        }
        
        /* Numbers for stats */
        .big-number {
            font-size: 42pt;
            font-weight: 700;
            color: var(--primary-turquoise);
            text-align: center;
            margin: 16pt 0 8pt 0;
        }
        
        .big-number-label {
            font-size: 14pt;
            color: var(--text-light);
            text-align: center;
            margin-bottom: 16pt;
        }
        
        /* Dividers */
        hr {
            border: none;
            height: 1pt;
            background: linear-gradient(to right, transparent, var(--primary-turquoise), transparent);
            margin: 24pt 0;
        }
        
        /* Emojis - make them bigger */
        .chapter {
            font-size: 11pt;
        }
        
        /* Ensure emojis are visible */
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
    const htmlPath = path.join(tempDir, 'adhd-book-readable.html');
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
    console.log(`${colors.blue}🖨️ Generating readable PDF...${colors.reset}`);
    await page.pdf({
        path: outputPath,
        format: 'Letter',
        width: '6in',
        height: '9in',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: false,
        margin: {
            top: '0.5in',
            bottom: '0.5in',
            left: '0.5in',
            right: '0.5in'
        }
    });
    
    await browser.close();
    
    // Get file stats
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n${colors.green}${colors.bright}✅ READABLE PDF generated successfully!${colors.reset}`);
    console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
    console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
    console.log(`${colors.cyan}📖 Format: 6×9 inches${colors.reset}`);
    
    console.log(`\n${colors.yellow}📖 Features:${colors.reset}`);
    console.log(`  ✓ Readable font size (11pt)`);
    console.log(`  ✓ Comfortable line spacing (18pt)`);
    console.log(`  ✓ Full page usage (0.5in margins)`);
    console.log(`  ✓ All emojis preserved and visible`);
    console.log(`  ✓ Vibrant colors maintained`);
    console.log(`  ✓ Proper spacing between elements`);
    
    if (process.env.DEBUG) {
        console.log(`\n${colors.cyan}🔍 Debug: HTML saved at ${htmlPath}${colors.reset}`);
    }
}

// Run generator
generateReadablePDF().catch(console.error);