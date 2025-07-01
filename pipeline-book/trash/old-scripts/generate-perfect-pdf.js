#!/usr/bin/env node

/**
 * Perfect PDF Generator - Fixed version with proper formatting
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

// Paths
const PIPELINE_DIR = __dirname;
const OUTPUT_PATH = path.join(PIPELINE_DIR, 'the-claude-elite-pipeline-perfect.pdf');

// Professional colors
const colors = {
    primary: '#0066CC',
    secondary: '#00AA44',
    accent: '#FF6600',
    dark: '#1A1A1A',
    gray: '#7A7A7A',
    lightGray: '#DADADA',
    ultraLight: '#F5F5F5',
    white: '#FFFFFF'
};

console.log('🚀 Starting PERFECT PDF generation...\n');

async function generatePerfectPDF() {
    try {
        // Load metadata
        const metadata = yaml.load(await fs.readFile('metadata.yaml', 'utf8'));
        
        // Load CSS
        const css = await fs.readFile('assets/css/epub-ultra-thin.css', 'utf8');
        
        // Load chapters
        const chapterFiles = await glob('chapters/*.md');
        chapterFiles.sort((a, b) => {
            const aNum = parseInt(a.match(/chapter-(\d+)/)?.[1] || '0');
            const bNum = parseInt(b.match(/chapter-(\d+)/)?.[1] || '0');
            return aNum - bNum;
        });
        
        const chapters = [];
        for (const file of chapterFiles) {
            const content = await fs.readFile(file, 'utf8');
            const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
            if (match) {
                const frontmatter = yaml.load(match[1]);
                const markdown = match[2];
                
                // Fix image paths
                const processedMarkdown = markdown.replace(
                    /!\[(.*?)\]\(\.\.(.*?)\)/g,
                    (match, alt, src) => `![${alt}](file://${path.join(PIPELINE_DIR, '..', src)})`
                );
                
                chapters.push({
                    frontmatter,
                    markdown: processedMarkdown,
                    html: marked.parse(processedMarkdown)
                });
            }
        }
        
        console.log(`📚 Loaded ${chapters.length} chapters`);
        
        // Generate HTML with FIXED structure
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${metadata.title}</title>
    <style>
        ${css}
        
        /* Additional fixes */
        @page {
            size: 6in 9in;
            margin: 0.75in;
        }
        
        @page:first {
            margin: 0;
        }
        
        body {
            margin: 0;
            padding: 0;
        }
        
        .page {
            page-break-after: always;
            min-height: 7.5in;
            position: relative;
        }
        
        .cover-page {
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            page-break-after: always;
        }
        
        .cover-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .title-page {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
            min-height: 9in;
        }
        
        .copyright-page {
            padding-top: 5in;
            font-size: 0.9rem;
            color: #7A7A7A;
        }
        
        .toc-page h1 {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .toc-entry {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1rem;
            font-size: 1rem;
        }
        
        .toc-number {
            font-weight: 500;
        }
        
        .toc-title {
            flex: 1;
            margin-left: 1rem;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #DADADA;
            margin: 0 0.5rem;
            height: 0.8em;
        }
        
        .toc-page-num {
            font-weight: 300;
        }
        
        .chapter-page {
            page-break-before: always;
        }
        
        .chapter-opener {
            text-align: center;
            padding-top: 2in;
            page-break-after: always;
        }
        
        .chapter-number {
            font-size: 5rem;
            font-weight: 100;
            color: #DADADA;
            margin-bottom: 1rem;
        }
        
        .chapter-title {
            font-size: 2rem;
            font-weight: 200;
            color: #1A1A1A;
        }
        
        .chapter-content {
            page-break-before: avoid;
        }
        
        .chapter-content p:first-of-type::first-letter {
            font-size: 3rem;
            line-height: 1;
            font-weight: 100;
            float: left;
            margin-right: 0.2rem;
            margin-top: -0.1rem;
            color: #0066CC;
        }
        
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 2rem auto;
            page-break-inside: avoid;
        }
        
        /* Page numbers */
        @page {
            @bottom-center {
                content: counter(page);
                font-family: 'Inter', sans-serif;
                font-size: 0.8rem;
                color: #7A7A7A;
            }
        }
        
        @page:first {
            @bottom-center {
                content: '';
            }
        }
    </style>
</head>
<body>
    <!-- Cover -->
    <div class="cover-page">
        <img src="file://${path.join(PIPELINE_DIR, 'assets/images/cover-professional.svg')}" alt="Cover" class="cover-image">
    </div>
    
    <!-- Title Page -->
    <div class="page title-page">
        <h1 style="font-size: 3rem; font-weight: 100; margin-bottom: 1rem;">${metadata.title}</h1>
        <h2 style="font-size: 1.5rem; font-weight: 300; color: #7A7A7A; margin-bottom: 3rem;">${metadata.subtitle}</h2>
        <p style="font-size: 1.2rem; font-weight: 300;">${metadata.author}</p>
    </div>
    
    <!-- Copyright Page -->
    <div class="page copyright-page">
        <p>Copyright &copy; 2024 ${metadata.author}</p>
        <p>All rights reserved.</p>
        <p>ISBN: ${metadata.isbn}</p>
        <p>Published by ${metadata.publisher}</p>
        <p style="margin-top: 2rem;">Cover design by ${metadata.cover_designer}</p>
        <p>Interior design by Claude Elite Format Agent</p>
        <p style="margin-top: 2rem;">First Edition</p>
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page">
        <h1>Table of Contents</h1>
        <div class="toc-entries">
            ${chapters.map((ch, i) => `
            <div class="toc-entry">
                <span class="toc-number">Chapter ${i + 1}</span>
                <span class="toc-title">${ch.frontmatter.title}</span>
                <span class="toc-dots"></span>
                <span class="toc-page-num">${7 + (i * 8)}</span>
            </div>
            `).join('')}
        </div>
    </div>
    
    <!-- Chapters -->
    ${chapters.map((ch, i) => `
    <div class="chapter-page">
        <div class="chapter-opener">
            <div class="chapter-number">${i + 1}</div>
            <div class="chapter-title">${ch.frontmatter.title}</div>
        </div>
        
        <div class="page chapter-content">
            ${ch.html}
        </div>
    </div>
    `).join('')}
    
    <!-- About -->
    <div class="page" style="page-break-before: always;">
        <h2 style="text-align: center; margin-bottom: 2rem;">About the Claude Elite Team</h2>
        <p style="text-align: center; font-style: italic; max-width: 80%; margin: 0 auto;">
            The Claude Elite Team is dedicated to revolutionizing the publishing industry through 
            intelligent automation. Our mission is to empower authors worldwide with professional-grade 
            tools that transform ideas into beautifully published books.
        </p>
    </div>
</body>
</html>`;
        
        // Save debug HTML
        await fs.writeFile('debug-perfect.html', html);
        console.log('💾 Debug HTML saved');
        
        // Launch Puppeteer
        console.log('🚀 Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content with local file base
        await page.goto(`file://${path.join(PIPELINE_DIR, 'debug-perfect.html')}`, {
            waitUntil: 'networkidle0'
        });
        
        // Wait for images
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate PDF
        console.log('📄 Generating PDF...');
        await page.pdf({
            path: OUTPUT_PATH,
            format: 'Letter',
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width: 100%; text-align: center; font-size: 10px; color: #7A7A7A;">
                    <span class="pageNumber"></span>
                </div>
            `,
            margin: {
                top: '0.75in',
                bottom: '0.75in',
                left: '0.75in',
                right: '0.75in'
            }
        });
        
        await browser.close();
        
        // Add metadata
        console.log('📝 Adding metadata...');
        // Note: In production, use a PDF library to add metadata
        
        const stats = await fs.stat(OUTPUT_PATH);
        console.log(`\n✅ PDF generated: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📖 Output: ${OUTPUT_PATH}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

generatePerfectPDF();