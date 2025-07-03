#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const marked = require('marked');
const { generateEbookContent, generateAuthorBio } = require('./generate-content-real');

// Map niches to CSS styles
const nicheStyles = {
    'AI/Technology': 'technology',
    'Business/Money': 'business',
    'Health/Diet': 'health',
    'Finance/Crypto': 'business',
    'E-commerce/Business': 'business',
    'Self-Help': 'business',
    'default': 'professional'
};

// Load and process template
async function loadTemplate(templatePath, styleFile) {
    const template = await fs.readFile(templatePath, 'utf8');
    const style = await fs.readFile(styleFile, 'utf8');
    
    // Inject additional styles
    return template.replace('</style>', `${style}\n</style>`);
}

// Generate table of contents
function generateTableOfContents(chapters) {
    return chapters.map(ch => `
        <li class="toc-item">
            <span class="toc-chapter">Chapter ${ch.number}: ${ch.title}</span>
            <span class="toc-page-num">${ch.number * 10}</span>
        </li>
    `).join('');
}

// Process chapter content
async function processChapter(chapterPath, chapterNum) {
    const content = await fs.readFile(chapterPath, 'utf8');
    
    // Remove frontmatter
    const markdownContent = content.replace(/^---[\s\S]*?---\n/, '');
    
    // Process callouts before markdown parsing
    const processedContent = processCallouts(markdownContent);
    
    // Convert to HTML
    const htmlContent = marked.parse(processedContent);
    
    // Wrap in chapter container
    return `
        <div class="chapter">
            <div class="chapter-header">
                <span class="chapter-number">Chapter ${chapterNum}</span>
            </div>
            ${htmlContent}
        </div>
    `;
}

// Process callout syntax
function processCallouts(markdown) {
    const calloutTypes = {
        'TIP': { icon: '💡', class: 'callout-tip' },
        'WARNING': { icon: '⚠️', class: 'callout-warning' },
        'INFO': { icon: 'ℹ️', class: 'callout-info' },
        'KEY': { icon: '🔑', class: 'callout-key' },
        'SUCCESS': { icon: '✅', class: 'callout-success' }
    };
    
    // Process inline callouts [!TYPE] text
    Object.keys(calloutTypes).forEach(type => {
        const regex = new RegExp(`\\[!${type}\\]\\s*([^\\n]+)\\n([^\\n]+)`, 'g');
        markdown = markdown.replace(regex, (match, title, content) => {
            const config = calloutTypes[type];
            return `<div class="callout ${config.class}">
                <div class="callout-title">
                    <span class="callout-icon">${config.icon}</span>
                    ${title}
                </div>
                <div class="callout-content">${content}</div>
            </div>`;
        });
    });
    
    return markdown;
}

// Build complete ebook
async function buildEbook(bookDir, options = {}) {
    console.log('\n🏗️  Building Professional Ebook...');
    console.log('━'.repeat(60));
    
    try {
        // Load metadata
        const metadataPath = path.join(bookDir, 'metadata.json');
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
        
        console.log(`📚 Title: ${metadata.title}`);
        console.log(`✍️  Author: ${metadata.author}`);
        console.log(`📁 Niche: ${metadata.niche}`);
        
        // Determine style based on niche
        const styleType = nicheStyles[metadata.niche] || 'professional';
        const templatePath = path.join(__dirname, '..', 'templates', 'ebook-templates', 'professional.html');
        const stylePath = path.join(__dirname, '..', 'templates', 'ebook-templates', 'styles', `${styleType}.css`);
        
        console.log(`🎨 Using style: ${styleType}`);
        
        // Load template with style
        let html = await loadTemplate(templatePath, stylePath);
        
        // Load chapters
        const chaptersDir = path.join(bookDir, 'chapters');
        const chapterFiles = await fs.readdir(chaptersDir);
        const chapters = chapterFiles
            .filter(f => f.endsWith('.md'))
            .sort();
        
        console.log(`📖 Processing ${chapters.length} chapters...`);
        
        // Process chapters
        const chaptersHtml = [];
        for (let i = 0; i < chapters.length; i++) {
            const chapterPath = path.join(chaptersDir, chapters[i]);
            const chapterHtml = await processChapter(chapterPath, i + 1);
            chaptersHtml.push(chapterHtml);
            process.stdout.write(`   ✓ Chapter ${i + 1}\r`);
        }
        console.log(`   ✅ All chapters processed`);
        
        // Generate TOC
        const tocData = chapters.map((file, index) => ({
            number: index + 1,
            title: file.replace(/chapter-\d+-/, '').replace(/-/g, ' ').replace('.md', '').replace(/\b\w/g, l => l.toUpperCase())
        }));
        
        // Generate author bio
        const authorBio = await generateAuthorBio(metadata);
        
        // Replace placeholders
        const replacements = {
            '{{TITLE}}': metadata.title,
            '{{SUBTITLE}}': metadata.subtitle,
            '{{AUTHOR}}': metadata.author,
            '{{EDITION}}': `${metadata.year} Edition`,
            '{{TABLE_OF_CONTENTS}}': generateTableOfContents(tocData),
            '{{CHAPTERS}}': chaptersHtml.join('\n'),
            '{{AUTHOR_BIO}}': authorBio,
            '{{WEBSITE_URL}}': '#',
            '{{CONTACT_URL}}': '#',
            '{{MORE_BOOKS_URL}}': '#',
            '{{YEAR}}': metadata.year,
            '{{ISBN}}': `ISBN: ${metadata.isbn}`
        };
        
        for (const [placeholder, value] of Object.entries(replacements)) {
            html = html.replace(new RegExp(placeholder, 'g'), value);
        }
        
        // Save HTML
        const outputDir = path.join(bookDir, 'output');
        await fs.mkdir(outputDir, { recursive: true });
        
        const htmlPath = path.join(outputDir, 'ebook.html');
        await fs.writeFile(htmlPath, html);
        console.log(`\n📄 HTML saved: ${htmlPath}`);
        
        // Generate PDF
        console.log('\n🖨️  Generating PDF...');
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        
        // Add custom CSS for PDF
        await page.addStyleTag({
            content: `
                @media print {
                    .chapter { page-break-after: always; }
                    .cover-page { page-break-after: always; }
                    .toc-page { page-break-after: always; }
                }
            `
        });
        
        // Generate PDF with professional settings
        const pdfPath = path.join(outputDir, `${metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            margin: {
                top: '0.75in',
                right: '0.75in',
                bottom: '0.75in',
                left: '0.75in'
            },
            printBackground: true,
            preferCSSPageSize: true
        });
        
        await browser.close();
        
        console.log(`✅ PDF generated: ${pdfPath}`);
        
        // Generate summary
        const fileSize = (await fs.stat(pdfPath)).size;
        const summary = {
            title: metadata.title,
            author: metadata.author,
            niche: metadata.niche,
            chapters: chapters.length,
            wordCount: metadata.wordCount,
            pages: Math.round(metadata.wordCount / 250),
            fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
            price: `$${metadata.price}`,
            outputFiles: {
                html: htmlPath,
                pdf: pdfPath
            },
            generatedAt: new Date().toISOString()
        };
        
        // Save summary
        const summaryPath = path.join(outputDir, 'build-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log('\n' + '═'.repeat(60));
        console.log('✨ EBOOK BUILD COMPLETE!');
        console.log('═'.repeat(60));
        console.log(`📚 ${summary.title}`);
        console.log(`📄 ${summary.pages} pages | ${summary.chapters} chapters`);
        console.log(`💾 ${summary.fileSize}`);
        console.log(`💰 Ready to sell at ${summary.price}`);
        console.log('\n📁 Output files:');
        console.log(`   - HTML: ${summary.outputFiles.html}`);
        console.log(`   - PDF: ${summary.outputFiles.pdf}`);
        console.log(`   - Summary: ${summaryPath}`);
        
        return summary;
        
    } catch (error) {
        console.error('\n❌ Build failed:', error.message);
        throw error;
    }
}

// Complete pipeline: research -> generate -> build
async function completePipeline(topicIndex = 0) {
    console.log('\n🚀 COMPLETE EBOOK GENERATION PIPELINE');
    console.log('━'.repeat(60));
    
    try {
        // 1. Load research data
        console.log('\n1️⃣ Loading research data...');
        const topicsFile = path.join('build', 'research', 'trending-topics.json');
        const topicsData = JSON.parse(await fs.readFile(topicsFile, 'utf8'));
        const topic = topicsData.topics[topicIndex];
        
        if (!topic) {
            throw new Error(`Invalid topic index: ${topicIndex}`);
        }
        
        console.log(`   ✅ Selected: "${topic.title}"`);
        console.log(`   📊 Demand: ${topic.estimatedDemand} searches/month`);
        
        // 2. Generate content
        console.log('\n2️⃣ Generating ebook content...');
        const { bookDir } = await generateEbookContent(topic);
        
        // 3. Build ebook
        console.log('\n3️⃣ Building professional ebook...');
        const summary = await buildEbook(bookDir);
        
        // 4. Final report
        console.log('\n' + '🎉'.repeat(30));
        console.log('\n🏆 EBOOK READY FOR SALE!');
        console.log('\nNext steps:');
        console.log('1. Review the PDF for quality');
        console.log('2. Create a compelling sales page');
        console.log('3. Upload to your sales platforms');
        console.log('4. Start marketing and watch the sales come in!');
        console.log('\n💡 Pro tip: Price at $9.99 for maximum conversions');
        
        return summary;
        
    } catch (error) {
        console.error('\n❌ Pipeline failed:', error);
        throw error;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args[0] === 'build' && args[1]) {
        // Build existing book
        buildEbook(args[1])
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    } else if (args[0] === 'complete') {
        // Complete pipeline
        const topicIndex = parseInt(args[1]) || 0;
        completePipeline(topicIndex)
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    } else {
        console.log('Usage:');
        console.log('  Build existing book: node build-ebook-complete.js build <book-dir>');
        console.log('  Complete pipeline: node build-ebook-complete.js complete [topic-index]');
        console.log('\nExamples:');
        console.log('  node build-ebook-complete.js build build/ebooks/my-book');
        console.log('  node build-ebook-complete.js complete 0');
        process.exit(1);
    }
}

module.exports = { buildEbook, completePipeline };