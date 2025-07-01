/**
 * Readable PDF Preset
 * Large fonts and comfortable spacing for easy reading
 */

module.exports = {
    name: 'readable',
    description: 'Readable PDF with large fonts and comfortable spacing',
    
    // Output filename
    outputFilename: () => 'tdah-descomplicado-readable.pdf',
    
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
        colorfulBoxes: true
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
            top: '0.5in',
            bottom: '0.5in',
            left: '0.5in',
            right: '0.5in'
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
    
    // Readable preset CSS
    defaultCSS: `
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
        
        /* Dividers */
        hr {
            border: none;
            height: 1pt;
            background: linear-gradient(to right, transparent, var(--primary-turquoise), transparent);
            margin: 24pt 0;
        }
        
        /* Ensure emojis are visible */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    `,
    
    // Console output features
    consoleFeatures: [
        'Readable font size (11pt)',
        'Comfortable line spacing (18pt)',
        'Full page usage (0.5in margins)',
        'All emojis preserved and visible',
        'Vibrant colors maintained',
        'Proper spacing between elements'
    ]
};