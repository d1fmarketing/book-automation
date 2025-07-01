/**
 * Colorful Compact PDF Preset
 * Vibrant colors with ultra-compact spacing
 */

module.exports = {
    name: 'colorful',
    description: 'Colorful PDF with vibrant colors and compact spacing',
    
    // Output filename
    outputFilename: () => 'tdah-descomplicado-colorful.pdf',
    
    // Features
    features: {
        includeCover: true,
        includeTitlePage: false,
        includeCopyright: false,
        includeTOC: false,
        includeThankYou: false,
        includeBookTitle: false,
        includePageNumbers: false,
        processAIImages: false,
        saveDebugHTML: true,
        useExternalCSS: false,
        dropCaps: true,
        tipBoxes: true,
        warningBoxes: true,
        checklistBoxes: true
    },
    
    // PDF options
    pdfOptions: () => ({
        format: 'Letter',
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
    }),
    
    // Puppeteer options
    puppeteerOptions: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none'
        ]
    },
    
    // Page options
    pageOptions: {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
    },
    
    // Viewport
    viewport: {
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2
    },
    
    // Get custom CSS
    async getCustomCSS() {
        return this.defaultCSS;
    },
    
    // Colorful preset CSS
    defaultCSS: `
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
            margin: 10mm 12mm;
        }
        
        /* Import fonts */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
            font-size: 9.5pt;
            line-height: 13pt;
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
            margin: 20pt 0 15pt 0;
            padding: 12pt;
            background: linear-gradient(135deg, rgba(78,205,196,0.1) 0%, rgba(149,225,211,0.1) 100%);
            border-radius: 12pt;
            page-break-after: avoid;
        }
        
        h2 {
            font-size: 18pt;
            font-weight: 600;
            color: var(--accent-coral);
            margin: 15pt 0 10pt 0;
            padding-left: 12pt;
            border-left: 4pt solid var(--accent-coral);
            page-break-after: avoid;
        }
        
        h3 {
            font-size: 14pt;
            font-weight: 500;
            color: var(--warm-orange);
            margin: 12pt 0 8pt 0;
            page-break-after: avoid;
        }
        
        /* Paragraphs - ULTRA COMPACT spacing */
        p {
            margin-bottom: 4pt;
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
            margin: 8pt 0 8pt 16pt;
            padding-left: 12pt;
        }
        
        li {
            margin-bottom: 4pt;
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
            padding: 8pt;
            margin: 8pt 0;
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
            padding: 8pt;
            margin: 8pt 0;
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
            padding: 8pt;
            margin: 8pt 0;
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
            padding: 4pt 0 4pt 24pt;
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
            margin: 8pt auto;
            border-radius: 8pt;
            box-shadow: 0 6pt 20pt rgba(0,0,0,0.15);
            page-break-inside: avoid;
        }
        
        /* Tables - COLORFUL headers */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12pt 0;
            border-radius: 8pt;
            overflow: hidden;
            box-shadow: 0 4pt 12pt rgba(0,0,0,0.1);
            page-break-inside: avoid;
        }
        
        th {
            background: var(--primary-turquoise);
            color: white;
            padding: 8pt;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 8pt;
            border-bottom: 1pt solid rgba(0,0,0,0.1);
        }
        
        tr:nth-child(even) {
            background: var(--bg-light);
        }
        
        /* Blockquotes - COLORFUL with COMPACT spacing */
        blockquote {
            margin: 8pt 0;
            padding: 8pt;
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
        
        /* Print optimization */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    `,
    
    // Console output features
    consoleFeatures: [
        'Original vibrant colors restored',
        'All emojis preserved',
        'Reduced margins (12-15mm)',
        'Tighter line spacing',
        'Compact paragraph spacing',
        'Colorful boxes (green/yellow)',
        'Smaller font size (10pt)'
    ]
};