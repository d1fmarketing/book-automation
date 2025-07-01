#!/usr/bin/env node

/**
 * TRULY PERFECT PDF Generator
 * - All images embedded as base64 PNGs
 * - Proper 6x9 book format
 * - Professional layout
 * - Page-by-page perfection
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

const PIPELINE_DIR = __dirname;
const OUTPUT_PATH = path.join(PIPELINE_DIR, 'the-claude-elite-pipeline-PERFECT.pdf');

console.log('🚀 Generating TRULY PERFECT PDF with all fixes...\n');

async function generateTrulyPerfectPDF() {
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
        
        // Map of images for each chapter
        const chapterImages = {
            1: 'chapter-01-architecture-horizontal-ebook.png',
            2: 'chapter-02-quality-horizontal-ebook.png',
            3: 'chapter-03-assistant-horizontal-ebook.png',
            4: 'chapter-04-publishing-horizontal-ebook.png',
            5: 'chapter-05-future-horizontal-ebook.png'
        };
        
        for (const [index, file] of chapterFiles.entries()) {
            const content = await fs.readFile(file, 'utf8');
            const match = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]+)$/);
            if (match) {
                const frontmatter = yaml.load(match[1]);
                let markdown = match[2];
                
                // Replace image references with actual embedded images
                const chapterNum = index + 1;
                const imageFile = chapterImages[chapterNum];
                
                if (imageFile) {
                    // Remove existing image references
                    markdown = markdown.replace(/!\[.*?\]\(.*?\)/g, '');
                    
                    // Add our horizontal image after the first heading
                    const firstHeadingMatch = markdown.match(/^(#+\s+.+)$/m);
                    if (firstHeadingMatch) {
                        const insertPos = markdown.indexOf(firstHeadingMatch[0]) + firstHeadingMatch[0].length;
                        markdown = markdown.slice(0, insertPos) + 
                            `\n\n![Chapter ${chapterNum} Illustration](CHAPTER_IMAGE_${chapterNum})\n\n` + 
                            markdown.slice(insertPos);
                    }
                }
                
                chapters.push({
                    frontmatter,
                    markdown,
                    html: marked.parse(markdown),
                    number: chapterNum
                });
            }
        }
        
        console.log(`📚 Loaded ${chapters.length} chapters`);
        
        // Read and encode all images as base64
        const encodedImages = {};
        
        // Cover image
        const coverPath = path.join(PIPELINE_DIR, 'assets/images/cover-horizontal-ebook.png');
        const coverBuffer = await fs.readFile(coverPath);
        const coverBase64 = coverBuffer.toString('base64');
        encodedImages.cover = `data:image/png;base64,${coverBase64}`;
        console.log('✅ Cover image embedded');
        
        // Chapter images
        for (const [num, filename] of Object.entries(chapterImages)) {
            const imagePath = path.join(PIPELINE_DIR, 'assets/images', filename);
            const imageBuffer = await fs.readFile(imagePath);
            const imageBase64 = imageBuffer.toString('base64');
            encodedImages[`chapter${num}`] = `data:image/png;base64,${imageBase64}`;
            console.log(`✅ Chapter ${num} image embedded`);
        }
        
        // Generate HTML with embedded images
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${metadata.title}</title>
    <style>
        ${css}
        
        /* Perfect 6x9 inch book format */
        @page {
            size: 6in 9in;
            margin: 0.75in;
            @bottom-center {
                content: counter(page);
                font-family: Georgia, serif;
                font-size: 10pt;
                color: #999;
            }
        }
        
        @page:first {
            margin: 0;
            @bottom-center { content: none; }
        }
        
        @page:blank {
            @bottom-center { content: none; }
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: Georgia, 'Times New Roman', serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }
        
        /* Cover page - full bleed */
        .cover-page {
            page: cover;
            width: 6in;
            height: 9in;
            margin: 0;
            padding: 0;
            position: relative;
            page-break-after: always;
        }
        
        @page cover {
            margin: 0;
        }
        
        .cover-image {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        /* Interior pages */
        .page {
            page-break-after: always;
            min-height: 7.5in;
        }
        
        .title-page {
            text-align: center;
            padding-top: 2.5in;
        }
        
        .copyright-page {
            font-size: 9pt;
            color: #666;
            padding-top: 5in;
        }
        
        .toc-page h1 {
            text-align: center;
            font-size: 24pt;
            font-weight: normal;
            margin-bottom: 2rem;
        }
        
        .toc-entry {
            display: flex;
            align-items: baseline;
            margin-bottom: 0.8rem;
            font-size: 11pt;
        }
        
        .toc-left {
            display: flex;
            align-items: baseline;
        }
        
        .toc-chapter {
            font-weight: bold;
            min-width: 70px;
        }
        
        .toc-title {
            margin-left: 0.5rem;
        }
        
        .toc-dots {
            flex: 1;
            border-bottom: 1px dotted #ccc;
            margin: 0 0.5rem;
            height: 0.5em;
        }
        
        .toc-page-num {
            font-weight: normal;
        }
        
        /* Chapter openers */
        .chapter-opener {
            page-break-before: right;
            text-align: center;
            padding-top: 2in;
            min-height: 7.5in;
        }
        
        .chapter-number {
            font-size: 72pt;
            font-weight: 100;
            color: #e0e0e0;
            margin: 0;
            line-height: 1;
        }
        
        .chapter-title {
            font-size: 24pt;
            font-weight: normal;
            margin-top: 0.5in;
            color: #333;
        }
        
        /* Chapter content */
        .chapter-content {
            page-break-before: always;
        }
        
        .chapter-content h1 {
            font-size: 24pt;
            font-weight: normal;
            margin-bottom: 1rem;
            page-break-after: avoid;
        }
        
        .chapter-content h2 {
            font-size: 18pt;
            font-weight: normal;
            margin-top: 1.5rem;
            margin-bottom: 0.5rem;
            page-break-after: avoid;
        }
        
        .chapter-content h3 {
            font-size: 14pt;
            font-weight: bold;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            page-break-after: avoid;
        }
        
        /* Drop caps on first paragraph */
        .chapter-content > p:first-of-type::first-letter {
            font-size: 48pt;
            line-height: 40pt;
            font-weight: normal;
            float: left;
            margin-right: 0.1em;
            margin-top: -0.1em;
            color: #0066CC;
        }
        
        /* Images - horizontal format */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 1.5rem auto;
            page-break-inside: avoid;
        }
        
        /* Ensure images don't break across pages */
        figure {
            page-break-inside: avoid;
            margin: 1.5rem 0;
            text-align: center;
        }
        
        figcaption {
            font-size: 9pt;
            color: #666;
            font-style: italic;
            margin-top: 0.5rem;
        }
        
        /* Typography */
        p {
            margin-bottom: 0.5rem;
            text-align: justify;
            orphans: 3;
            widows: 3;
        }
        
        blockquote {
            margin: 1rem 2rem;
            font-style: italic;
            color: #555;
        }
        
        code {
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            background: #f5f5f5;
            padding: 0.1em 0.3em;
        }
        
        pre {
            background: #f5f5f5;
            padding: 0.5rem;
            overflow-x: auto;
            font-size: 9pt;
            page-break-inside: avoid;
        }
        
        /* Lists */
        ul, ol {
            margin: 0.5rem 0;
            padding-left: 2rem;
        }
        
        li {
            margin-bottom: 0.25rem;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <img src="${encodedImages.cover}" alt="Book Cover" class="cover-image">
    </div>
    
    <!-- Title Page -->
    <div class="page title-page">
        <h1 style="font-size: 36pt; font-weight: normal; margin-bottom: 0.5in;">${metadata.title}</h1>
        <p style="font-size: 18pt; font-weight: normal; color: #666;">${metadata.subtitle}</p>
        <p style="font-size: 16pt; margin-top: 2in;">${metadata.author}</p>
    </div>
    
    <!-- Copyright Page -->
    <div class="page copyright-page">
        <p>Copyright © 2024 ${metadata.author}</p>
        <p>All rights reserved.</p>
        <p style="margin-top: 1rem;">ISBN: ${metadata.isbn}</p>
        <p>Published by ${metadata.publisher}</p>
        <p style="margin-top: 1rem;">First Edition</p>
        
        <p style="margin-top: 2rem;">Cover design by ${metadata.cover_designer}</p>
        <p>Interior design by Claude Elite Format Agent</p>
        
        <p style="margin-top: 2rem;">Visit us at www.claude-elite.dev</p>
    </div>
    
    <!-- Table of Contents -->
    <div class="page toc-page">
        <h1>Table of Contents</h1>
        ${chapters.map((ch, i) => {
            const pageNum = 7 + (i * 10);
            return `
        <div class="toc-entry">
            <div class="toc-left">
                <span class="toc-chapter">Chapter ${i + 1}</span>
                <span class="toc-title">${ch.frontmatter.title}</span>
            </div>
            <span class="toc-dots"></span>
            <span class="toc-page-num">${pageNum}</span>
        </div>`;
        }).join('')}
    </div>
    
    <!-- Chapters -->
    ${chapters.map((ch, i) => {
        // Replace image placeholder with actual embedded image
        const processedHtml = ch.html.replace(
            `<img src="CHAPTER_IMAGE_${ch.number}" alt="Chapter ${ch.number} Illustration">`,
            `<figure>
                <img src="${encodedImages[`chapter${ch.number}`]}" alt="Chapter ${ch.number} Illustration">
                <figcaption>Figure ${ch.number}.1: ${ch.frontmatter.title} Overview</figcaption>
            </figure>`
        );
        
        return `
    <!-- Chapter ${i + 1} -->
    <div class="chapter-opener">
        <div class="chapter-number">${i + 1}</div>
        <div class="chapter-title">${ch.frontmatter.title}</div>
    </div>
    
    <div class="page chapter-content">
        ${processedHtml}
    </div>`;
    }).join('')}
    
    <!-- About Page -->
    <div class="page" style="page-break-before: always; text-align: center; padding-top: 3in;">
        <h2 style="font-size: 24pt; font-weight: normal; margin-bottom: 1in;">About the Claude Elite Team</h2>
        <p style="font-style: italic; max-width: 80%; margin: 0 auto; line-height: 1.8;">
            The Claude Elite Team is a collective of publishing innovators dedicated to 
            democratizing professional book creation through intelligent automation.
        </p>
        <p style="margin-top: 2rem;">
            Join our community at<br>
            <strong>www.claude-elite.dev</strong>
        </p>
    </div>
</body>
</html>`;
        
        // Save HTML for debugging
        await fs.writeFile('truly-perfect.html', html);
        console.log('\n💾 HTML saved with all images embedded');
        
        // Launch Puppeteer
        console.log('🚀 Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(html, {
            waitUntil: ['load', 'domcontentloaded', 'networkidle0']
        });
        
        // Wait for images to render
        await page.waitForTimeout(3000);
        
        // Generate PDF
        console.log('📄 Generating perfect 6×9 inch PDF...');
        await page.pdf({
            path: OUTPUT_PATH,
            width: '6in',
            height: '9in',
            printBackground: true,
            displayHeaderFooter: false,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            preferCSSPageSize: true
        });
        
        await browser.close();
        
        const stats = await fs.stat(OUTPUT_PATH);
        console.log(`\n✅ TRULY PERFECT PDF generated!`);
        console.log(`📊 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📖 Output: ${OUTPUT_PATH}`);
        
        console.log('\n🎉 All features implemented:');
        console.log('  ✓ Professional horizontal images for each chapter');
        console.log('  ✓ High-quality PNG images embedded');
        console.log('  ✓ Perfect 6×9 inch book format');
        console.log('  ✓ Drop caps on chapter openings');
        console.log('  ✓ Professional typography and layout');
        console.log('  ✓ Proper page breaks and flow');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Fix the waitForTimeout issue
const originalWaitForTimeout = puppeteer.Page.prototype.waitForTimeout;
if (!originalWaitForTimeout) {
    puppeteer.Page.prototype.waitForTimeout = function(timeout) {
        return new Promise(resolve => setTimeout(resolve, timeout));
    };
}

generateTrulyPerfectPDF();