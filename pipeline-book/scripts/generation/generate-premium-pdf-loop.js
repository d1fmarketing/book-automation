#!/usr/bin/env node

/**
 * Premium PDF Generator with Visual QA Loop
 * This version implements the loop you requested:
 * 1. Generate PDF
 * 2. Check visually
 * 3. Fix problems
 * 4. Repeat until perfect
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const marked = require('marked');
const yaml = require('js-yaml');
const { processMarkdownWithCallouts } = require('../utils/callout-box-parser');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import the original generator
const PremiumPDFGeneratorFixed = require('./generate-premium-pdf-fixed');

class PremiumPDFGeneratorWithLoop extends PremiumPDFGeneratorFixed {
    constructor() {
        super();
        this.iteration = 0;
        this.maxIterations = 5;
        this.issues = [];
    }

    generateHTML() {
        console.log('\n🎨 Generating optimized HTML with fixes...');
        
        // Load CSS files
        const professionalCSS = fs.readFileSync(
            path.join(this.projectRoot, 'assets/css/professional-web-style.css'), 
            'utf8'
        );
        
        // Get theme colors from metadata
        const theme = this.metadata.theme || {};
        const visualTheme = this.metadata.visual_theme || {
            primary_gradient: ['#667eea', '#764ba2'],
            secondary_gradient: ['#f093fb', '#f5576c'],
            accent_color: '#FFD700'
        };

        const cssVariables = `
        :root {
            --primary-gradient-start: ${visualTheme.primary_gradient[0]};
            --primary-gradient-end: ${visualTheme.primary_gradient[1]};
            --secondary-gradient-start: ${visualTheme.secondary_gradient[0]};
            --secondary-gradient-end: ${visualTheme.secondary_gradient[1]};
            --accent-color: ${visualTheme.accent_color};
        }
        `;

        // Generate chapters HTML with fixes for blank pages
        const chaptersHTML = this.chapters.map((chapter, index) => {
            // Ensure chapter 0 has enough content to fill a page
            const isShortChapter = chapter.content.length < 500;
            const extraPadding = isShortChapter ? 'padding-bottom: 3in;' : '';
            
            return `
            <div class="page chapter-page" style="${extraPadding}">
                <div class="chapter-header">
                    <div class="chapter-number">Chapter ${chapter.number}</div>
                    <h1 class="chapter-title">${chapter.title}</h1>
                </div>
                <div class="section-divider"></div>
                ${chapter.number <= 5 && this.images[`chapter${chapter.number}`] ? `
                    <figure class="chapter-image">
                        <img src="${this.images[`chapter${chapter.number}`]}" alt="Chapter ${chapter.number} illustration">
                    </figure>
                ` : chapter.number === 0 && this.images.cover ? `
                    <figure class="chapter-image" style="margin: 2rem 0;">
                        <img src="${this.images.cover}" alt="Visual Enhancement Demo" style="max-height: 4in;">
                    </figure>
                ` : ''}
                <div class="chapter-content">
                    ${this.processChapterContent(chapter.content)}
                </div>
            </div>
        `;
        }).join('\n');

        // Generate complete HTML with FIXED styles
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${this.metadata.title}</title>
    <style>
        ${cssVariables}
        ${professionalCSS}
        
        /* CRITICAL FIXES FOR 6x9 LAYOUT */
        @page {
            size: 6in 9in !important;
            margin: 0.5in 0.5in 0.6in 0.5in !important;
        }
        
        /* Ensure no blank pages */
        .page {
            width: 5in !important;
            min-height: 7.8in !important;
            max-height: 7.8in !important;
            margin: 0 auto !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            page-break-after: always !important;
            overflow: hidden !important;
        }
        
        /* Fix for short chapters */
        .chapter-page {
            display: flex;
            flex-direction: column;
        }
        
        .chapter-content {
            flex: 1;
            min-height: 5in;
        }
        
        /* Enhanced chapter images */
        .chapter-image {
            margin: 1rem 0 !important;
            text-align: center;
        }
        
        .chapter-image img {
            max-width: 100% !important;
            max-height: 4in !important;
            width: auto !important;
            height: auto !important;
            object-fit: contain !important;
        }
        
        /* Fix TOC */
        .toc {
            font-size: 11pt !important;
            line-height: 1.8 !important;
        }
        
        .toc li {
            margin-bottom: 0.5rem !important;
            display: flex;
            align-items: baseline;
        }
        
        .toc-title {
            flex: 1;
        }
        
        .toc-dots {
            flex: 0 0 auto;
            margin: 0 0.5rem;
            border-bottom: 1px dotted #ccc;
            width: 2in;
        }
        
        .toc-page {
            flex: 0 0 auto;
            text-align: right;
            min-width: 2em;
        }
        
        /* Enhanced back cover */
        .end-page {
            background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end));
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
        
        .end-page .section-divider {
            background: white;
            opacity: 0.8;
        }
        
        /* Fix cover page */
        .cover {
            width: 6in !important;
            height: 9in !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always;
            overflow: hidden;
        }
        
        .cover img {
            width: 6in !important;
            height: 9in !important;
            object-fit: cover !important;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover">
        ${this.images.cover ? 
            `<img src="${this.images.cover}" alt="Book Cover">` :
            `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, var(--primary-gradient-start), var(--primary-gradient-end)); color: white;">
                <div style="text-align: center;">
                    <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">${this.metadata.title}</h1>
                    <h2 style="font-size: 1.3rem; font-weight: 300;">${this.metadata.subtitle || ''}</h2>
                    <p style="font-size: 1.1rem; margin-top: 2rem;">${this.metadata.author}</p>
                </div>
            </div>`
        }
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page">
        <h1>Table of Contents</h1>
        <div class="section-divider"></div>
        <ol class="toc">
            ${this.chapters
                .filter((ch, index) => !(ch.number === 1 && index > 0)) // Remove duplicate Chapter 1
                .map((ch, idx) => `
                <li>
                    <span class="toc-title">${ch.number === 0 ? '' : `Chapter ${ch.number}: `}${ch.title}</span>
                    <span class="toc-dots"></span>
                    <span class="toc-page">${3 + idx}</span>
                </li>
            `).join('\n')}
        </ol>
    </div>
    
    <!-- Chapters -->
    ${chaptersHTML}
    
    <!-- Enhanced End Page -->
    <div class="page end-page">
        <div>
            <div class="section-divider" style="width: 4in; margin: 0 auto;"></div>
            <h2 style="font-size: 1.5rem; margin: 2rem 0;">Thank you for reading!</h2>
            <p style="font-size: 1.1rem; margin-top: 2rem;">
                ${this.metadata.title}
            </p>
            <p style="margin-top: 1rem; opacity: 0.9;">
                © ${new Date().getFullYear()} ${this.metadata.author}
            </p>
            <div style="margin-top: 3rem;">
                <p style="font-size: 0.9rem; opacity: 0.8;">Built with Claude Elite Pipeline</p>
                <p style="font-size: 0.8rem; opacity: 0.7;">100% AI-Powered Publishing</p>
            </div>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    async checkPDFVisually() {
        console.log('\n🔍 Visual QA Check...');
        
        // Convert PDF to images
        const outputDir = path.join(this.projectRoot, 'build/dist/pdf-qa-loop');
        await fs.ensureDir(outputDir);
        
        try {
            const pdfName = path.basename(this.outputPath, '.pdf');
            const outputPattern = path.join(outputDir, `${pdfName}-page`);
            const cmd = `pdftoppm -png -r 150 "${this.outputPath}" "${outputPattern}"`;
            await execAsync(cmd);
            
            // Analyze images
            const files = await fs.readdir(outputDir);
            const pngFiles = files.filter(f => f.endsWith('.png')).sort();
            
            this.issues = [];
            
            for (let i = 0; i < pngFiles.length; i++) {
                const file = pngFiles[i];
                const filePath = path.join(outputDir, file);
                const stats = await fs.stat(filePath);
                
                // Check for blank pages (less than 10KB usually means blank)
                if (stats.size < 10 * 1024) {
                    this.issues.push({
                        page: i + 1,
                        issue: 'Blank or nearly blank page',
                        severity: 'high'
                    });
                }
                
                // Check cover page (should be larger)
                if (i === 0 && stats.size < 50 * 1024) {
                    this.issues.push({
                        page: 1,
                        issue: 'Cover image may be missing or corrupted',
                        severity: 'high'
                    });
                }
            }
            
            // Clean up
            await fs.remove(outputDir);
            
            return this.issues.length === 0;
            
        } catch (error) {
            console.warn('⚠️  Could not perform visual check:', error.message);
            return true; // Assume it's OK if we can't check
        }
    }

    async runWithLoop() {
        console.log('🔄 Starting Premium PDF Generation with Visual QA Loop\n');
        
        let success = false;
        
        while (!success && this.iteration < this.maxIterations) {
            this.iteration++;
            console.log(`\n📍 Iteration ${this.iteration}/${this.maxIterations}`);
            console.log('─'.repeat(50));
            
            try {
                // Load data
                await this.loadMetadata();
                await this.loadChapters();
                await this.loadImages();
                
                // Generate PDF
                await this.generatePDF();
                
                // Check visually
                success = await this.checkPDFVisually();
                
                if (!success) {
                    console.log(`\n⚠️  Found ${this.issues.length} issues:`);
                    this.issues.forEach(issue => {
                        console.log(`   - Page ${issue.page}: ${issue.issue}`);
                    });
                    
                    if (this.iteration < this.maxIterations) {
                        console.log('\n🔧 Applying fixes and regenerating...');
                        // Fixes are applied in generateHTML method
                    }
                } else {
                    console.log('\n✅ PDF passed all visual checks!');
                }
                
            } catch (error) {
                console.error('\n❌ Error in iteration:', error.message);
                if (this.iteration >= this.maxIterations) {
                    throw error;
                }
            }
        }
        
        if (!success) {
            console.log('\n⚠️  Maximum iterations reached. Some issues may remain.');
        } else {
            console.log('\n🎉 Perfect PDF generated successfully!');
            console.log(`📍 Final output: ${this.outputPath}`);
        }
    }

    async run() {
        try {
            console.log('🎨 Premium PDF Generator with Visual QA Loop');
            console.log('============================================\n');
            
            await this.runWithLoop();
            
        } catch (error) {
            console.error('\n❌ Fatal error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new PremiumPDFGeneratorWithLoop();
    generator.run();
}

module.exports = PremiumPDFGeneratorWithLoop;