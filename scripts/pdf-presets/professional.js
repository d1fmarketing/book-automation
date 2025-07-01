/**
 * Professional PDF Preset
 * Commercial-grade with baseline grid, accessibility, and CMYK support
 */

const path = require('path');

module.exports = {
    name: 'professional',
    description: 'Professional PDF with baseline grid, accessibility, and print-ready features',
    
    // Output filename
    outputFilename: () => 'tdah-descomplicado.pdf',
    
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
        professional: true,
        baselineGrid: true,
        accessibility: true,
        cmykSupport: true,
        tipBoxes: true,
        warningBoxes: true,
        checklistBoxes: true
    },
    
    // PDF options - A5 professional format
    pdfOptions: (metadata) => ({
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
    }),
    
    // Puppeteer options with accessibility
    puppeteerOptions: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none',
            '--export-tagged-pdf', // Enable accessibility tags
            '--enable-accessibility-object-model' // Enable accessibility features
        ]
    },
    
    // Page options
    pageOptions: {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 60000
    },
    
    // Viewport for A5
    viewport: {
        width: 595,  // A5 width in pixels
        height: 842, // A5 height in pixels
        deviceScaleFactor: 2
    },
    
    // Get custom CSS
    async getCustomCSS() {
        return this.defaultCSS;
    },
    
    // Professional preset CSS with baseline grid
    defaultCSS: `
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
            
            /* Professional Color Palette - CMYK-friendly */
            --color-primary: #00897B;
            --color-secondary: #FF6B6B;
            --color-accent: #F39C12;
            --color-text: #2C3E50;
            --color-light: #7F8C8D;
            --color-bg-light: #ECF0F1;
            --color-success: #27AE60;
        }
        
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
        
        /* Paragraphs - baseline aligned with tighter spacing */
        p {
            margin-bottom: 8pt;
            text-align: justify;
            orphans: 3;
            widows: 3;
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
        
        /* Print optimization */
        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
        }
    `,
    
    // Post-processing for accessibility and CMYK
    async postProcess(outputPath, tempDir, logger, projectRoot) {
        // Add accessibility features
        logger.info('Adding accessibility features...');
        const addPDFAccessibility = require(path.join(projectRoot, 'scripts/add-pdf-accessibility'));
        const accessiblePath = outputPath.replace('.pdf', '-accessible.pdf');
        await addPDFAccessibility(outputPath, accessiblePath);
        
        // Replace original with accessible version
        const fs = require('fs-extra');
        await fs.rename(accessiblePath, outputPath);
        
        // Add CMYK intent
        logger.info('Adding CMYK color intent...');
        const addCMYKIntent = require(path.join(projectRoot, 'scripts/add-cmyk-intent'));
        const cmykPath = outputPath.replace('.pdf', '-cmyk.pdf');
        await addCMYKIntent(outputPath, cmykPath);
        
        // Replace original with CMYK version
        await fs.rename(cmykPath, outputPath);
        
        logger.success('Professional PDF with accessibility and CMYK support generated!');
    },
    
    // Console output features
    consoleFeatures: [
        '20pt baseline grid system',
        'Typography in points (pt)',
        '18mm standardized margins',
        'Embedded fonts',
        'CMYK-friendly colors',
        'Professional components',
        'Print-ready PDF',
        'Basic document structure'
    ],
    
    // Additional warning
    additionalInfo: `For full commercial compliance:
  1. Install Ghostscript: brew install ghostscript
  2. Run: ./scripts/finalize-commercial-pdf.sh`
};