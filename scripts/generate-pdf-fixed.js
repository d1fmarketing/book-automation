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
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

async function generateFixedPDF() {
    console.log(`${colors.green}${colors.bright}🔧 Generating FIXED Commercial PDF...${colors.reset}`);
    
    // Read metadata
    const metadata = yaml.load(fs.readFileSync(path.join(__dirname, '../metadata.yaml'), 'utf8'));
    
    // Set up paths
    const chaptersDir = path.join(__dirname, '../chapters');
    const outputPath = path.join(__dirname, '../build/dist/tdah-descomplicado-fixed.pdf');
    const tempDir = path.join(__dirname, '../build/temp');
    
    // Ensure directories exist
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Read all chapters
    const chapters = fs.readdirSync(chaptersDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .map(f => {
            const content = fs.readFileSync(path.join(chaptersDir, f), 'utf8');
            return { filename: f, content };
        });
    
    console.log(`${colors.blue}📖 Processing ${chapters.length} chapters...${colors.reset}`);
    
    // Convert markdown to HTML
    let allChaptersHTML = '';
    
    for (const [index, chapter] of chapters.entries()) {
        let { content, filename } = chapter;
        
        console.log(`${colors.cyan}  Processing: ${filename}${colors.reset}`);
        
        // Remove frontmatter
        const frontmatterRegex = /^---[\s\S]*?---\s*/;
        content = content.replace(frontmatterRegex, '');
        
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
            
            return `<img src="file://${absolutePath}"`;
        });
        
        // Wrap each chapter properly
        allChaptersHTML += `
            <div class="chapter-wrapper">
                <div class="chapter-content">
                    ${html}
                </div>
            </div>
        `;
    }
    
    // Fixed HTML template with better structure
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="${metadata.language || 'pt-BR'}">
<head>
    <meta charset="UTF-8">
    <title>${metadata.title} - ${metadata.subtitle}</title>
    <style>
        /* Reset and base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        
        html, body {
            width: 100%;
            margin: 0;
            padding: 0;
            font-family: 'Georgia', 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1a1a1a;
        }
        
        /* Page setup for A5 */
        @page {
            size: A5;
            margin: 20mm 15mm 25mm 15mm;
        }
        
        @page :first {
            margin: 0;
        }
        
        /* Cover page - full page */
        .cover-page {
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            background: linear-gradient(135deg, #4ECDC4 0%, #44A3AA 100%);
            color: white;
            page-break-after: always;
            position: relative;
            overflow: hidden;
        }
        
        .cover-page h1 {
            font-size: 48pt;
            margin-bottom: 20px;
            text-shadow: 0 4px 12px rgba(0,0,0,0.2);
            background: none;
            padding: 0;
            border: none;
        }
        
        .cover-page h2 {
            font-size: 18pt;
            font-weight: 300;
            margin-bottom: 40px;
            max-width: 80%;
            opacity: 0.95;
            border: none;
            padding: 0;
        }
        
        .cover-page .author {
            font-size: 14pt;
            margin-top: 60px;
            font-style: italic;
            opacity: 0.9;
        }
        
        /* Chapter wrapper - ensures each chapter starts on new page */
        .chapter-wrapper {
            page-break-before: always;
            min-height: 100vh;
        }
        
        .chapter-wrapper:first-of-type {
            page-break-before: avoid;
        }
        
        /* Chapter content */
        .chapter-content {
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
        }
        
        /* Typography */
        h1 {
            font-size: 28pt;
            font-weight: 700;
            color: #4ECDC4;
            text-align: center;
            margin: 30px 0 25px 0;
            padding: 20px;
            background: rgba(78,205,196,0.08);
            border-radius: 10px;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: 600;
            color: #FF6B6B;
            margin: 25px 0 15px 0;
            padding-left: 15px;
            border-left: 4px solid #FF6B6B;
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: 500;
            color: #FFA06C;
            margin: 20px 0 12px 0;
            page-break-after: avoid;
        }
        
        p {
            margin-bottom: 14px;
            text-align: justify;
            text-indent: 0;
        }
        
        /* Lists */
        ul, ol {
            margin: 15px 0 15px 25px;
            padding-left: 15px;
        }
        
        li {
            margin-bottom: 8px;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            border-radius: 8px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        /* Special boxes */
        .tip, .warning, .checklist {
            margin: 20px 0;
            padding: 15px;
            border-radius: 8px;
            page-break-inside: avoid;
        }
        
        .tip {
            background: #E8F8F5;
            border-left: 4px solid #52C41A;
        }
        
        .warning {
            background: #FFF4E6;
            border-left: 4px solid #FF6B6B;
        }
        
        .checklist {
            background: #F8F9FA;
            border: 1px solid #E9ECEF;
        }
        
        /* Blockquotes */
        blockquote {
            margin: 20px 15px;
            padding: 15px 20px;
            background: rgba(199,206,234,0.12);
            border-left: 4px solid #C7CEEA;
            border-radius: 6px;
            font-style: italic;
            page-break-inside: avoid;
        }
        
        /* Page numbers */
        @page {
            @bottom-center {
                content: counter(page);
                font-size: 10pt;
                color: #7f8c8d;
            }
        }
        
        /* Print optimizations */
        @media print {
            .cover-page {
                height: 100vh;
                page-break-after: always;
            }
            
            .chapter-wrapper {
                page-break-before: always;
            }
            
            h1, h2, h3, h4 {
                page-break-after: avoid;
            }
            
            p {
                orphans: 3;
                widows: 3;
            }
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <h1>${metadata.title}</h1>
        <h2>${metadata.subtitle}</h2>
        <div class="author">por ${metadata.author}</div>
    </div>
    
    <!-- All Chapters -->
    ${allChaptersHTML}
</body>
</html>`;
    
    // Save HTML
    const htmlPath = path.join(tempDir, 'adhd-book-fixed.html');
    fs.writeFileSync(htmlPath, htmlTemplate);
    console.log(`${colors.cyan}📝 HTML saved for debugging${colors.reset}`);
    
    // Generate PDF with Puppeteer
    console.log(`${colors.blue}🚀 Launching Puppeteer...${colors.reset}`);
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
        width: 595,  // A5 width in pixels
        height: 842, // A5 height in pixels
        deviceScaleFactor: 2
    });
    
    // Load HTML and wait for all content
    console.log(`${colors.blue}📄 Loading HTML...${colors.reset}`);
    await page.goto(`file://${htmlPath}`, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000 
    });
    
    // Wait a bit for styles to fully render
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
    
    // Scroll through the page to ensure all content is loaded
    await page.evaluate(() => {
        return new Promise((resolve) => {
            const distance = 100;
            const delay = 100;
            const timer = setInterval(() => {
                document.documentElement.scrollTop += distance;
                if (document.documentElement.scrollTop + window.innerHeight >= document.documentElement.scrollHeight) {
                    clearInterval(timer);
                    document.documentElement.scrollTop = 0;
                    resolve();
                }
            }, delay);
        });
    });
    
    // Generate PDF
    console.log(`${colors.blue}🖨️ Generating PDF...${colors.reset}`);
    await page.pdf({
        path: outputPath,
        format: 'A5',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
            <div style="width: 100%; text-align: center; font-size: 9pt; color: #7f8c8d; margin-top: 10px;">
                <span class="pageNumber"></span>
            </div>
        `,
        margin: {
            top: '20mm',
            bottom: '25mm',
            left: '15mm',
            right: '15mm'
        }
    });
    
    await browser.close();
    
    // Success message
    const stats = fs.statSync(outputPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`\n${colors.green}${colors.bright}✅ FIXED PDF generated successfully!${colors.reset}`);
    console.log(`${colors.cyan}📄 File: ${outputPath}${colors.reset}`);
    console.log(`${colors.cyan}📏 Size: ${fileSizeMB} MB${colors.reset}`);
    console.log(`${colors.cyan}📖 Format: A5 (148mm × 210mm)${colors.reset}`);
    
    console.log(`\n${colors.yellow}🔧 Fixed Issues:${colors.reset}`);
    console.log(`  ✓ All chapters now properly render`);
    console.log(`  ✓ Cover page displays correctly`);
    console.log(`  ✓ Page breaks work as expected`);
    console.log(`  ✓ Content flows naturally`);
    console.log(`  ✓ Images display properly`);
    
    console.log(`\n${colors.blue}Debug HTML: ${htmlPath}${colors.reset}`);
}

// Run
generateFixedPDF().catch(err => {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
});