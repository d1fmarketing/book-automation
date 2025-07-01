#!/usr/bin/env node

/**
 * Dedicated PDF generator for The Claude Elite Pipeline book
 * This ensures we use the correct chapters and metadata
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

// Define paths relative to this script
const PIPELINE_DIR = __dirname;
const PROJECT_ROOT = path.dirname(PIPELINE_DIR);
const CHAPTERS_DIR = path.join(PIPELINE_DIR, 'chapters');
const METADATA_PATH = path.join(PIPELINE_DIR, 'metadata.yaml');
const CSS_PATH = path.join(PIPELINE_DIR, 'assets', 'css', 'epub-ultra-thin.css');
const OUTPUT_PATH = path.join(PIPELINE_DIR, 'the-claude-elite-pipeline.pdf');

// Colors for console output
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};

async function loadMetadata() {
    console.log(colors.blue('📖 Loading pipeline book metadata...'));
    const metadataContent = await fs.readFile(METADATA_PATH, 'utf8');
    return yaml.load(metadataContent);
}

async function loadChapters() {
    console.log(colors.blue('📚 Loading pipeline book chapters...'));
    
    // Get all markdown files in the chapters directory
    const chapterFiles = await glob(path.join(CHAPTERS_DIR, '*.md'));
    
    // Sort by chapter number
    chapterFiles.sort((a, b) => {
        const aNum = parseInt(a.match(/chapter-(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/chapter-(\d+)/)?.[1] || '0');
        return aNum - bNum;
    });
    
    console.log(`Found ${chapterFiles.length} chapters`);
    
    // Load and parse each chapter
    const chapters = [];
    for (const file of chapterFiles) {
        const content = await fs.readFile(file, 'utf8');
        const filename = path.basename(file);
        
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
        if (frontmatterMatch) {
            const frontmatter = yaml.load(frontmatterMatch[1]);
            const markdown = frontmatterMatch[2];
            
            chapters.push({
                filename,
                frontmatter,
                markdown,
                html: marked.parse(markdown)
            });
            
            console.log(`  ✓ ${frontmatter.title || filename}`);
        }
    }
    
    return chapters;
}

async function loadCSS() {
    console.log(colors.blue('🎨 Loading ultra-thin CSS...'));
    return await fs.readFile(CSS_PATH, 'utf8');
}

async function generateHTML(metadata, chapters, css) {
    console.log(colors.blue('🔨 Generating HTML...'));
    
    let html = `<!DOCTYPE html>
<html lang="${metadata.language || 'en-US'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <meta name="author" content="${metadata.author}">
    <style>${css}</style>
</head>
<body>
    <!-- Cover Page -->
    <div class="page cover-page">
        <div class="cover-content">
            <h1 class="book-title">${metadata.title}</h1>
            <h2 class="book-subtitle">${metadata.subtitle || ''}</h2>
            <p class="book-author">${metadata.author}</p>
        </div>
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc">
        <h1>Table of Contents</h1>
        <div class="toc-entries">`;
    
    // Add TOC entries
    chapters.forEach((chapter, index) => {
        html += `
            <div class="toc-entry">
                <span class="toc-title">Chapter ${index + 1}: ${chapter.frontmatter.title}</span>
                <span class="toc-dots"></span>
                <span class="toc-page">${(index + 1) * 2 + 3}</span>
            </div>`;
    });
    
    html += `
        </div>
    </div>`;
    
    // Add chapters
    chapters.forEach((chapter, index) => {
        html += `
    <!-- Chapter ${index + 1} -->
    <div class="page chapter-opener">
        <div class="chapter-number">${index + 1}</div>
        <div class="chapter-title">${chapter.frontmatter.title}</div>
    </div>
    
    <div class="page chapter-content">
        ${chapter.html}
    </div>`;
    });
    
    html += `
</body>
</html>`;
    
    return html;
}

async function generatePDF() {
    try {
        // Load all necessary data
        const metadata = await loadMetadata();
        const chapters = await loadChapters();
        const css = await loadCSS();
        
        // Generate HTML
        const html = await generateHTML(metadata, chapters, css);
        
        // Save HTML for debugging
        const debugPath = path.join(PIPELINE_DIR, 'debug.html');
        await fs.writeFile(debugPath, html);
        console.log(colors.blue('💾 Debug HTML saved'));
        
        // Launch Puppeteer
        console.log(colors.blue('🚀 Launching Puppeteer...'));
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(html, {
            waitUntil: 'networkidle0'
        });
        
        // Generate PDF with 6x9 inch dimensions
        console.log(colors.blue('📄 Generating PDF...'));
        await page.pdf({
            path: OUTPUT_PATH,
            format: 'Letter', // We'll use margins to create 6x9
            width: '6in',
            height: '9in',
            margin: {
                top: metadata.pdf?.margins?.top || '0.75in',
                bottom: metadata.pdf?.margins?.bottom || '0.75in',
                left: metadata.pdf?.margins?.left || '0.75in',
                right: metadata.pdf?.margins?.right || '0.75in'
            },
            printBackground: true,
            preferCSSPageSize: true
        });
        
        await browser.close();
        
        // Get file size
        const stats = await fs.stat(OUTPUT_PATH);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(colors.green(`✅ PDF generated successfully!`));
        console.log(colors.bold(`📖 Output: ${OUTPUT_PATH} (${fileSizeMB} MB)`));
        
        // Clean up debug HTML
        await fs.remove(debugPath);
        
    } catch (error) {
        console.error(colors.red('❌ Error generating PDF:'), error);
        process.exit(1);
    }
}

// Run the generator
console.log(colors.bold('🚀 Generating The Claude Elite Pipeline PDF...\n'));
generatePDF();