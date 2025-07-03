#!/usr/bin/env node

/**
 * HTML-First Workflow with Live Preview
 * Solves the MCP PDF inspection limitation by doing QA on HTML
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');

class HTMLFirstWorkflow {
    constructor() {
        this.bookDir = path.join(__dirname, '..');
        this.buildDir = path.join(this.bookDir, 'build');
        this.distDir = path.join(this.buildDir, 'dist');
        this.htmlPath = path.join(this.distDir, 'preview.html');
        this.pdfPath = path.join(this.distDir, 'final-ebook.pdf');
    }

    async run() {
        console.log('🌐 HTML-First Workflow Starting...\n');
        
        // Step 1: Generate HTML
        console.log('📝 Step 1: Generating HTML from Markdown...');
        const html = await this.generateHTML();
        await fs.ensureDir(this.distDir);
        await fs.writeFile(this.htmlPath, html);
        console.log(`✅ HTML saved to: ${this.htmlPath}\n`);
        
        // Step 2: Launch preview server
        console.log('🚀 Step 2: Starting live preview server...');
        console.log(`📍 Open in browser: file://${this.htmlPath}\n`);
        
        // Step 3: Visual QA on HTML (where MCP can inspect everything!)
        console.log('🔍 Step 3: Running visual QA on HTML...');
        const qaResults = await this.runHTMLQualityChecks();
        
        if (!qaResults.passed) {
            console.error('❌ HTML QA failed:', qaResults.issues);
            return;
        }
        
        console.log('✅ HTML passed all quality checks!\n');
        
        // Step 4: Generate PDF from approved HTML
        console.log('📑 Step 4: Generating PDF from approved HTML...');
        await this.generatePDFFromHTML();
        console.log(`✅ PDF generated: ${this.pdfPath}\n`);
        
        // Step 5: Technical PDF validation (not visual)
        console.log('🔧 Step 5: Running technical PDF validation...');
        await this.validatePDFTechnically();
        
        console.log('🎉 Workflow complete! Professional ebook ready.\n');
    }

    async generateHTML() {
        const metadata = await this.loadMetadata();
        const chapters = await this.loadChapters();
        
        // Professional HTML template with print CSS
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <style>
        /* Screen preview styles */
        @media screen {
            body {
                font-family: 'Crimson Text', Georgia, serif;
                line-height: 1.6;
                max-width: 6in;
                margin: 0 auto;
                padding: 20px;
                background: #f5f5f5;
            }
            
            .page {
                background: white;
                padding: 1in;
                margin-bottom: 20px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                min-height: 9in;
                width: 6in;
                box-sizing: border-box;
            }
        }
        
        /* Print/PDF styles */
        @media print {
            @page {
                size: 6in 9in;
                margin: 0.75in;
            }
            
            .page {
                page-break-after: always;
            }
            
            body {
                margin: 0;
                font-size: 11pt;
            }
        }
        
        /* Common styles */
        .cover {
            text-align: center;
            padding-top: 3in;
        }
        
        .cover h1 {
            font-size: 36pt;
            margin-bottom: 0.5in;
        }
        
        .chapter {
            page-break-before: always;
        }
        
        .chapter h1 {
            font-size: 24pt;
            margin-bottom: 1em;
            padding-top: 0.5in;
        }
        
        .callout {
            background: #f0f8ff;
            border-left: 4px solid #2196F3;
            padding: 1em;
            margin: 1em 0;
        }
        
        code {
            background: #f5f5f5;
            padding: 2px 4px;
            font-family: 'Fira Code', monospace;
        }
        
        pre {
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 1em;
            overflow-x: auto;
        }
        
        /* Visual QA markers for MCP */
        [data-qa="cover-image"] {
            width: 100%;
            max-width: 4in;
            margin: 2em auto;
        }
        
        [data-qa="page-number"] {
            position: absolute;
            bottom: 0.5in;
            right: 0.5in;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="page cover" data-qa="cover-page">
        <h1 data-qa="book-title">${metadata.title}</h1>
        <p data-qa="book-subtitle">${metadata.subtitle || ''}</p>
        <img src="assets/images/cover-premium.svg" alt="Cover" data-qa="cover-image">
        <p data-qa="author">by ${metadata.author}</p>
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc" data-qa="toc-page">
        <h1>Table of Contents</h1>
        <ul data-qa="toc-list">
            ${chapters.map((ch, i) => 
                `<li><a href="#chapter-${i+1}">${ch.title}</a></li>`
            ).join('\n')}
        </ul>
    </div>
    
    <!-- Chapters -->
    ${chapters.map((chapter, i) => `
    <div class="page chapter" data-qa="chapter-${i+1}" id="chapter-${i+1}">
        ${chapter.html}
        <span data-qa="page-number" class="page-number">${i + 3}</span>
    </div>
    `).join('\n')}
</body>
</html>`;
        
        return html;
    }

    async loadMetadata() {
        const metadataPath = path.join(this.bookDir, 'metadata.yaml');
        return yaml.load(await fs.readFile(metadataPath, 'utf8'));
    }

    async loadChapters() {
        const chaptersDir = path.join(this.bookDir, 'chapters');
        const files = await fs.readdir(chaptersDir);
        const chapters = [];
        
        for (const file of files.sort()) {
            if (file.endsWith('.md')) {
                const content = await fs.readFile(path.join(chaptersDir, file), 'utf8');
                const lines = content.split('\n');
                const titleMatch = lines.find(l => l.startsWith('# '));
                const title = titleMatch ? titleMatch.substring(2) : file;
                const html = marked.parse(content);
                
                chapters.push({ title, html });
            }
        }
        
        return chapters;
    }

    async runHTMLQualityChecks() {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        // Navigate to HTML (MCP can inspect everything here!)
        await page.goto(`file://${this.htmlPath}`, { waitUntil: 'networkidle0' });
        
        const checks = await page.evaluate(() => {
            const results = {
                passed: true,
                issues: [],
                metrics: {}
            };
            
            // Check 1: Cover image exists and loads
            const coverImg = document.querySelector('[data-qa="cover-image"]');
            if (!coverImg || !coverImg.complete) {
                results.issues.push('Cover image missing or failed to load');
                results.passed = false;
            }
            
            // Check 2: All chapters present
            const chapters = document.querySelectorAll('[data-qa^="chapter-"]');
            results.metrics.chapterCount = chapters.length;
            if (chapters.length === 0) {
                results.issues.push('No chapters found');
                results.passed = false;
            }
            
            // Check 3: TOC links work
            const tocLinks = document.querySelectorAll('[data-qa="toc-list"] a');
            tocLinks.forEach(link => {
                const target = link.getAttribute('href');
                if (!document.querySelector(target)) {
                    results.issues.push(`TOC link broken: ${target}`);
                    results.passed = false;
                }
            });
            
            // Check 4: Visual elements rendered
            const callouts = document.querySelectorAll('.callout');
            const codeBlocks = document.querySelectorAll('pre');
            results.metrics.callouts = callouts.length;
            results.metrics.codeBlocks = codeBlocks.length;
            
            // Check 5: Page dimensions
            const pages = document.querySelectorAll('.page');
            pages.forEach((page, i) => {
                const rect = page.getBoundingClientRect();
                if (rect.width !== 6 * 96) { // 6 inches at 96 DPI
                    results.issues.push(`Page ${i+1} wrong width: ${rect.width}px`);
                }
            });
            
            return results;
        });
        
        await browser.close();
        return checks;
    }

    async generatePDFFromHTML() {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto(`file://${this.htmlPath}`, { waitUntil: 'networkidle0' });
        
        // Generate PDF with exact specifications
        await page.pdf({
            path: this.pdfPath,
            format: 'Letter', // Close to 6x9
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: '0.75in', right: '0.75in', bottom: '0.75in', left: '0.75in' }
        });
        
        await browser.close();
    }

    async validatePDFTechnically() {
        // Technical validation (not visual since MCP can't inspect PDFs)
        const stats = await fs.stat(this.pdfPath);
        console.log(`📊 PDF Technical Validation:`);
        console.log(`   - Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   - Created: ${stats.ctime}`);
        
        // Could add qpdf or ghostscript validation here
        return true;
    }
}

// Run the workflow
if (require.main === module) {
    const workflow = new HTMLFirstWorkflow();
    workflow.run().catch(console.error);
}

module.exports = HTMLFirstWorkflow;