#!/usr/bin/env node

/**
 * PDF Generator with Live Preview Support
 * Enhanced version that emits progress events
 */

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');
const PreviewServer = require('./preview-server');

class PDFPreviewGenerator {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.preset = options.preset || 'main';
        this.outputPath = options.outputPath;
        this.enablePreview = options.enablePreview !== false;
        this.previewServer = null;
        this.previewPort = options.previewPort || 3001;
        this.browser = null;
        this.page = null;
        this.currentPageNum = 0;
        this.totalPages = 0;
        
        // Hook callbacks
        this.onProgress = options.onProgress || null;
        this.onPageComplete = options.onPageComplete || null;
        this.onComplete = options.onComplete || null;
    }
    
    async generate() {
        try {
            // Start preview server if enabled
            if (this.enablePreview) {
                await this.startPreviewServer();
            }
            
            // Load metadata and chapters
            const metadata = await this.loadMetadata();
            const chapters = await this.loadChapters();
            
            // Estimate total pages (rough calculation)
            this.totalPages = this.estimateTotalPages(chapters);
            
            // Start build
            if (this.previewServer) {
                await this.previewServer.startBuild({
                    id: Date.now(),
                    totalPages: this.totalPages,
                    chapters: chapters.map(ch => ch.title)
                });
            }
            
            // Generate PDF with progress tracking
            const startTime = Date.now();
            await this.generatePDF(metadata, chapters);
            
            console.log('✅ PDF generated successfully with live preview!');
            
            // Call completion hook
            if (this.onComplete) {
                this.onComplete({
                    outputPath: this.outputPath,
                    totalPages: this.totalPages,
                    duration: Date.now() - startTime
                });
            }
            
        } catch (error) {
            console.error('❌ Error generating PDF:', error);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
    
    async startPreviewServer() {
        console.log('🖼️  Connecting to preview server...');
        
        // Check if server is already running
        const isRunning = await this.checkServerRunning();
        
        if (isRunning) {
            console.log(`📺 Using existing preview server at: http://localhost:${this.previewPort}`);
            console.log('   (Open in browser to see live preview)\n');
            
            // Create a client connection to existing server
            this.previewServer = {
                startBuild: async (info) => await this.sendToServer('build_start', info),
                updateProgress: async (info) => await this.sendToServer('progress', info),
                addPagePreview: async (page, path) => await this.sendToServer('page_ready', { page, path }),
                completeBuild: async (path) => await this.sendToServer('build_complete', { path })
            };
        } else {
            console.log('🖼️  Starting new preview server...');
            
            this.previewServer = new PreviewServer({
                port: this.previewPort,
                authToken: process.env.PREVIEW_TOKEN
            });
            
            await this.previewServer.start();
            
            console.log(`📺 Preview available at: http://localhost:${this.previewPort}`);
            console.log('   (Open in browser to see live preview)\n');
        }
    }
    
    async checkServerRunning() {
        const http = require('http');
        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${this.previewPort}/api/status`, (res) => {
                resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(1000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
    
    async sendToServer(type, data) {
        const http = require('http');
        const postData = JSON.stringify({ type, data });
        
        const options = {
            hostname: 'localhost',
            port: this.previewPort,
            path: '/api/update',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve());
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    }
    
    async loadMetadata() {
        const metadataPath = path.join(process.cwd(), 'metadata.yaml');
        const content = await fs.readFile(metadataPath, 'utf8');
        return yaml.load(content);
    }
    
    async loadChapters() {
        const chapterFiles = await glob('chapters/*.md');
        chapterFiles.sort();
        
        const chapters = [];
        for (const file of chapterFiles) {
            const content = await fs.readFile(file, 'utf8');
            const lines = content.split('\n');
            
            let frontmatter = {};
            let markdownStart = 0;
            
            if (lines[0] === '---') {
                const endIndex = lines.indexOf('---', 1);
                if (endIndex > 0) {
                    const yamlContent = lines.slice(1, endIndex).join('\n');
                    frontmatter = yaml.load(yamlContent) || {};
                    markdownStart = endIndex + 1;
                }
            }
            
            const markdownContent = lines.slice(markdownStart).join('\n');
            const htmlContent = marked.parse(markdownContent);
            
            chapters.push({
                file: path.basename(file),
                title: frontmatter.title || `Chapter ${chapters.length + 1}`,
                content: htmlContent,
                frontmatter
            });
        }
        
        return chapters;
    }
    
    estimateTotalPages(chapters) {
        // Rough estimate: 1 page per 500 words + images
        let totalWords = 0;
        for (const chapter of chapters) {
            const text = chapter.content.replace(/<[^>]*>/g, '');
            totalWords += text.split(/\s+/).length;
        }
        return Math.ceil(totalWords / 500) + chapters.length * 2; // Extra for titles/breaks
    }
    
    async generatePDF(metadata, chapters) {
        console.log('🚀 Launching browser...');
        
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Listen for console messages from the page
        this.page.on('console', msg => {
            if (this.verbose) {
                console.log('Page console:', msg.text());
            }
        });
        
        // Build HTML content
        const htmlContent = await this.buildHTML(metadata, chapters);
        
        // Set page content
        await this.page.setContent(htmlContent, {
            waitUntil: ['load', 'networkidle0']
        });
        
        // Apply preset configuration
        const presetConfig = this.getPresetConfig();
        if (presetConfig.setupPage) {
            await presetConfig.setupPage(this.page);
        }
        
        // Generate PDF with page tracking
        const outputDir = path.join(process.cwd(), 'build/dist');
        await fs.ensureDir(outputDir);
        
        const outputFile = this.outputPath || 
            path.join(outputDir, `ebook-preview-${Date.now()}.pdf`);
        
        // Configure PDF options
        const pdfOptions = {
            path: outputFile,
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%;">Page <span class="pageNumber"></span></div>',
            margin: {
                top: '0.75in',
                bottom: '0.75in',
                left: '0.75in',
                right: '0.75in'
            }
        };
        
        // Hook into PDF generation to capture pages
        if (this.enablePreview) {
            await this.generateWithPreview(pdfOptions);
        } else {
            await this.page.pdf(pdfOptions);
        }
        
        // Complete build
        if (this.previewServer) {
            await this.previewServer.completeBuild(outputFile);
        }
        
        console.log(`\n✅ PDF saved to: ${outputFile}`);
    }
    
    async generateWithPreview(pdfOptions) {
        // First, generate the full PDF
        await this.page.pdf(pdfOptions);
        
        // Then, capture individual pages for preview
        console.log('\n📸 Capturing page previews...');
        
        // Get total pages by evaluating page breaks
        const pageHeight = 11 * 96; // 11 inches at 96 DPI
        const contentHeight = await this.page.evaluate(() => {
            return document.documentElement.scrollHeight;
        });
        
        const actualTotalPages = Math.ceil(contentHeight / pageHeight);
        this.totalPages = actualTotalPages;
        
        // Update total pages in preview
        if (this.previewServer) {
            await this.previewServer.updateProgress({
                totalPages: actualTotalPages
            });
        }
        
        // Capture each page
        for (let i = 0; i < actualTotalPages; i++) {
            await this.capturePage(i + 1, pageHeight);
            
            // Update progress
            const progressData = {
                currentPage: i + 1,
                totalPages: actualTotalPages,
                currentChapter: this.getCurrentChapter(i + 1, actualTotalPages),
                percentage: ((i + 1) / actualTotalPages * 100).toFixed(1)
            };
            
            if (this.previewServer) {
                await this.previewServer.updateProgress(progressData);
            }
            
            // Call progress hook
            if (this.onProgress) {
                this.onProgress(progressData);
            }
            
            // Small delay to not overwhelm
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    
    async capturePage(pageNum, pageHeight) {
        const yOffset = (pageNum - 1) * pageHeight;
        
        // Take screenshot of the page area
        const screenshotPath = path.join(__dirname, 'previews', `page-${pageNum}.png`);
        await fs.ensureDir(path.dirname(screenshotPath));
        
        await this.page.screenshot({
            path: screenshotPath,
            clip: {
                x: 0,
                y: yOffset,
                width: 816, // 8.5 inches at 96 DPI
                height: pageHeight
            }
        });
        
        // Notify preview server
        if (this.previewServer) {
            await this.previewServer.addPagePreview(pageNum, screenshotPath);
        }
        
        this.currentPageNum = pageNum;
        
        // Call page complete hook
        if (this.onPageComplete) {
            this.onPageComplete(pageNum);
        }
    }
    
    getCurrentChapter(pageNum, totalPages) {
        // Simple estimation
        const progress = pageNum / totalPages;
        if (progress < 0.25) return 'Chapter 1';
        if (progress < 0.5) return 'Chapter 2';
        if (progress < 0.75) return 'Chapter 3';
        return 'Chapter 4';
    }
    
    async buildHTML(metadata, chapters) {
        // Build HTML with preset styles
        const presetConfig = this.getPresetConfig();
        const css = presetConfig.getCSS ? presetConfig.getCSS() : '';
        
        let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${metadata.book?.title || metadata.title}</title>
    <style>${css}</style>
</head>
<body>`;
        
        // Add cover page
        html += `<div class="cover-page">
            <h1>${metadata.book?.title || metadata.title}</h1>
            <h2>${metadata.book?.subtitle || ''}</h2>
            <p class="author">${metadata.book?.author || metadata.author}</p>
        </div>`;
        
        // Add chapters
        for (const chapter of chapters) {
            html += `<div class="chapter">
                <h1>${chapter.title}</h1>
                ${chapter.content}
            </div>`;
        }
        
        html += '</body></html>';
        
        return html;
    }
    
    getPresetConfig() {
        // Simple preset configuration
        return {
            getCSS: () => `
                @page {
                    size: 6in 9in;
                    margin: 0.75in;
                }
                
                body {
                    font-family: Georgia, serif;
                    font-size: 11pt;
                    line-height: 1.6;
                }
                
                .cover-page {
                    page-break-after: always;
                    text-align: center;
                    padding-top: 2in;
                }
                
                .chapter {
                    page-break-before: always;
                }
                
                h1 {
                    font-size: 24pt;
                    margin-bottom: 1em;
                }
                
                h2 {
                    font-size: 18pt;
                    margin-bottom: 0.8em;
                }
                
                p {
                    text-align: justify;
                    margin-bottom: 1em;
                }
                
                img {
                    max-width: 100%;
                    height: auto;
                }
            `
        };
    }
}

// CLI interface
if (require.main === module) {
    const generator = new PDFPreviewGenerator({
        verbose: process.argv.includes('-v') || process.argv.includes('--verbose'),
        preset: process.argv.find(arg => arg.startsWith('--preset='))?.split('=')[1] || 'main',
        enablePreview: !process.argv.includes('--no-preview'),
        previewPort: parseInt(process.argv.find(arg => arg.startsWith('--preview-port='))?.split('=')[1] || '3001')
    });
    
    generator.generate().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = PDFPreviewGenerator;