#!/usr/bin/env node

/**
 * Professional PDF Generator for The Claude Elite Pipeline
 * Uses the complete pipeline system with all agents
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

// Define paths
const PIPELINE_DIR = __dirname;
const METADATA_PATH = path.join(PIPELINE_DIR, 'metadata.yaml');
const CSS_PATH = path.join(PIPELINE_DIR, 'assets', 'css', 'epub-ultra-thin.css');
const OUTPUT_PATH = path.join(PIPELINE_DIR, 'the-claude-elite-pipeline-professional.pdf');

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

// Configure marked for professional rendering
marked.setOptions({
    gfm: true,
    breaks: false,
    smartypants: true
});

async function loadMetadata() {
    console.log('📖 Content Agent: Loading book metadata...');
    const metadataContent = await fs.readFile(METADATA_PATH, 'utf8');
    return yaml.load(metadataContent);
}

async function loadChapters() {
    console.log('📚 Content Agent: Analyzing chapters...');
    
    const chapterFiles = await glob(path.join(PIPELINE_DIR, 'chapters', '*.md'));
    chapterFiles.sort((a, b) => {
        const aNum = parseInt(a.match(/chapter-(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/chapter-(\d+)/)?.[1] || '0');
        return aNum - bNum;
    });
    
    const chapters = [];
    let totalWords = 0;
    
    for (const file of chapterFiles) {
        const content = await fs.readFile(file, 'utf8');
        const filename = path.basename(file);
        
        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
        if (frontmatterMatch) {
            const frontmatter = yaml.load(frontmatterMatch[1]);
            const markdown = frontmatterMatch[2];
            
            // Process images to use absolute paths
            const processedMarkdown = markdown.replace(
                /!\[(.*?)\]\(\.\.(.*?)\)/g,
                (match, alt, src) => `![${alt}](${path.join(PIPELINE_DIR, '..', src)})`
            );
            
            chapters.push({
                filename,
                frontmatter,
                markdown: processedMarkdown,
                html: marked.parse(processedMarkdown)
            });
            
            totalWords += frontmatter.words || 0;
            console.log(`  ✓ ${frontmatter.title} (${frontmatter.words || 0} words)`);
        }
    }
    
    console.log(`  📊 Total words: ${totalWords.toLocaleString()}`);
    return chapters;
}

async function loadCSS() {
    console.log('🎨 Format Agent: Loading professional CSS...');
    return await fs.readFile(CSS_PATH, 'utf8');
}

async function generateProfessionalHTML(metadata, chapters, css) {
    console.log('✨ Format Agent: Creating professional layout...');
    
    // Enhanced CSS with professional typography
    const enhancedCSS = css + `
        /* Professional enhancements */
        @page {
            size: 6in 9in;
            margin: 0.75in;
            @bottom-center {
                content: counter(page);
                font-family: 'Inter', sans-serif;
                font-size: 10pt;
                color: #7A7A7A;
            }
        }
        
        .cover-page {
            page: cover;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            page-break-after: always;
            position: relative;
            overflow: hidden;
        }
        
        .cover-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        @page cover {
            margin: 0;
        }
        
        .chapter-opener {
            page-break-before: right;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }
        
        .page {
            page-break-before: auto;
            page-break-after: auto;
            page-break-inside: avoid;
        }
        
        img {
            max-width: 100%;
            height: auto;
            page-break-inside: avoid;
            display: block;
            margin: 2rem auto;
        }
        
        figure {
            page-break-inside: avoid;
        }
        
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
        }
        
        p {
            orphans: 3;
            widows: 3;
        }
        
        /* Drop caps for chapter starts */
        .chapter-content > p:first-of-type::first-letter {
            font-size: 4rem;
            line-height: 3rem;
            font-weight: 100;
            float: left;
            margin-right: 0.5rem;
            margin-top: -0.2rem;
            color: ${colors.primary};
        }
    `;
    
    let html = `<!DOCTYPE html>
<html lang="${metadata.language || 'en-US'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <meta name="author" content="${metadata.author}">
    <style>${enhancedCSS}</style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <img src="${path.join(PIPELINE_DIR, metadata.cover_image)}" alt="Book Cover" class="cover-image">
    </div>
    
    <!-- Title Page -->
    <div class="page title-page" style="text-align: center; padding-top: 3in;">
        <h1 style="font-size: 3rem; font-weight: 100; margin-bottom: 1rem;">${metadata.title}</h1>
        <h2 style="font-size: 1.5rem; font-weight: 300; color: ${colors.gray}; margin-bottom: 3rem;">${metadata.subtitle || ''}</h2>
        <p style="font-size: 1.2rem; font-weight: 300;">${metadata.author}</p>
    </div>
    
    <!-- Copyright Page -->
    <div class="page copyright-page" style="font-size: 0.9rem; color: ${colors.gray};">
        <p style="margin-top: 5in;">Copyright © 2024 ${metadata.author}</p>
        <p>All rights reserved.</p>
        <p>ISBN: ${metadata.isbn || '978-1-234567-89-0'}</p>
        <p>Published by ${metadata.publisher || 'Claude Elite Press'}</p>
        <p style="margin-top: 2rem;">Cover design by ${metadata.cover_designer}</p>
        <p>Interior design by Claude Elite Format Agent</p>
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc">
        <h1 style="text-align: center; margin-bottom: 3rem;">Table of Contents</h1>
        <div class="toc-entries">`;
    
    // Add TOC entries
    chapters.forEach((chapter, index) => {
        const pageNum = (index * 10) + 7; // Approximate page numbers
        html += `
            <div class="toc-entry" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <span class="toc-title">
                        <span style="font-weight: 500;">Chapter ${index + 1}</span>
                        <span style="margin-left: 1rem; font-weight: 300;">${chapter.frontmatter.title}</span>
                    </span>
                    <span class="toc-dots" style="flex: 1; border-bottom: 1px dotted ${colors.lightGray}; margin: 0 1rem; min-width: 2rem;"></span>
                    <span class="toc-page" style="font-weight: 300;">${pageNum}</span>
                </div>
            </div>`;
    });
    
    html += `
        </div>
    </div>`;
    
    // Add chapters with professional formatting
    chapters.forEach((chapter, index) => {
        html += `
    <!-- Chapter ${index + 1} -->
    <div class="chapter-opener">
        <div class="chapter-number" style="font-size: 8rem; font-weight: 100; color: ${colors.lightGray}; line-height: 1;">${index + 1}</div>
        <div class="chapter-title" style="font-size: 2.5rem; font-weight: 200; margin-top: 2rem; color: ${colors.dark};">${chapter.frontmatter.title}</div>
    </div>
    
    <div class="page chapter-content">
        ${chapter.html}
    </div>`;
    });
    
    // About the Author
    html += `
    <div class="page about-author" style="page-break-before: always;">
        <h2 style="text-align: center; margin-bottom: 2rem;">About the Claude Elite Team</h2>
        <p style="text-align: center; font-style: italic;">
            The Claude Elite Team is dedicated to revolutionizing the publishing industry through 
            intelligent automation. Our mission is to empower authors worldwide with professional-grade 
            tools that transform ideas into beautifully published books.
        </p>
    </div>`;
    
    html += `
</body>
</html>`;
    
    return html;
}

async function runQualityChecks(html) {
    console.log('🔍 Quality Agent: Running professional checks...');
    
    // Basic quality checks
    const checks = {
        hasImages: html.includes('<img'),
        hasTOC: html.includes('toc-entry'),
        hasChapters: (html.match(/chapter-opener/g) || []).length,
        wordCount: html.split(/\s+/).length,
        hasDropCaps: html.includes('first-letter')
    };
    
    console.log('  ✓ Images found:', checks.hasImages);
    console.log('  ✓ Table of Contents:', checks.hasTOC);
    console.log('  ✓ Chapters:', checks.hasChapters);
    console.log('  ✓ Approximate words:', checks.wordCount.toLocaleString());
    console.log('  ✓ Professional typography:', checks.hasDropCaps);
    
    return checks;
}

async function generatePDF() {
    try {
        console.log('🚀 Pipeline Core: Initializing professional ebook generation...\n');
        
        // Load all data
        const metadata = await loadMetadata();
        const chapters = await loadChapters();
        const css = await loadCSS();
        
        // Generate HTML
        const html = await generateProfessionalHTML(metadata, chapters, css);
        
        // Run quality checks
        await runQualityChecks(html);
        
        // Save debug HTML
        const debugPath = path.join(PIPELINE_DIR, 'debug-professional.html');
        await fs.writeFile(debugPath, html);
        console.log('\n💾 Format Agent: Debug HTML saved');
        
        // Launch Puppeteer with professional settings
        console.log('📄 Publish Agent: Generating professional PDF...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none']
        });
        
        const page = await browser.newPage();
        
        // Set viewport for 6x9 book
        await page.setViewport({
            width: 432,  // 6 inches at 72 DPI
            height: 648, // 9 inches at 72 DPI
        });
        
        // Load local file protocol for images
        await page.goto(`file://${debugPath}`, {
            waitUntil: 'networkidle0'
        });
        
        // Wait for images to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate PDF with professional settings
        await page.pdf({
            path: OUTPUT_PATH,
            width: '6in',
            height: '9in',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            margin: {
                top: '0',
                bottom: '0',
                left: '0',
                right: '0'
            }
        });
        
        await browser.close();
        
        // Get file stats
        const stats = await fs.stat(OUTPUT_PATH);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log('\n📊 Monitor Agent: Generation complete!');
        console.log(`  ✅ PDF size: ${fileSizeMB} MB`);
        console.log(`  ✅ Output: ${OUTPUT_PATH}`);
        
        // Clean up debug HTML
        await fs.remove(debugPath);
        
    } catch (error) {
        console.error('❌ Pipeline Error:', error);
        process.exit(1);
    }
}

// Run the professional pipeline
console.log(`
╔═══════════════════════════════════════════════════════════╗
║          The Claude Elite Pipeline - Professional         ║
║              Automated Ebook Generation System            ║
╚═══════════════════════════════════════════════════════════╝
`);

generatePDF();