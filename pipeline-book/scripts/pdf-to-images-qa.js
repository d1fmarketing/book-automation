#!/usr/bin/env node

/**
 * PDF to Images QA
 * Converts PDF pages to PNG for visual verification
 * Solves the MCP PDF Shadow DOM limitation
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');

const execAsync = promisify(exec);

class PDFtoImagesQA {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.outputDir = path.join(path.dirname(pdfPath), 'pdf-pages-qa');
    }

    async run() {
        console.log('🖼️  PDF to Images QA Starting...\n');
        
        // Check if pdftoppm is installed
        const hasPdftoppm = await this.checkPdftoppm();
        if (!hasPdftoppm) {
            console.log('⚠️  pdftoppm not found. Using alternative method...\n');
            return await this.useAlternativeMethod();
        }
        
        // Create output directory
        await fs.ensureDir(this.outputDir);
        
        // Convert PDF pages to PNG
        console.log('📄 Converting PDF pages to PNG images...');
        await this.convertPages();
        
        // Analyze the images
        console.log('\n🔍 Analyzing page images...');
        const analysis = await this.analyzeImages();
        
        // Generate report
        await this.generateReport(analysis);
        
        console.log(`\n✅ QA Complete! Images saved to: ${this.outputDir}`);
        console.log(`📊 Report: ${path.join(this.outputDir, 'qa-report.json')}\n`);
    }

    async checkPdftoppm() {
        try {
            await execAsync('which pdftoppm');
            return true;
        } catch {
            return false;
        }
    }

    async convertPages() {
        const pdfName = path.basename(this.pdfPath, '.pdf');
        const outputPattern = path.join(this.outputDir, `${pdfName}-page`);
        
        try {
            // Convert all pages at 150 DPI (good balance of quality/size)
            const cmd = `pdftoppm -png -r 150 "${this.pdfPath}" "${outputPattern}"`;
            const { stdout, stderr } = await execAsync(cmd);
            
            if (stderr) {
                console.warn('⚠️  Warnings:', stderr);
            }
            
            // List generated files
            const files = await fs.readdir(this.outputDir);
            const pngFiles = files.filter(f => f.endsWith('.png')).sort();
            console.log(`✅ Generated ${pngFiles.length} page images`);
            
            return pngFiles;
        } catch (error) {
            console.error('❌ Error converting PDF:', error.message);
            throw error;
        }
    }

    async analyzeImages() {
        const files = await fs.readdir(this.outputDir);
        const pngFiles = files.filter(f => f.endsWith('.png')).sort();
        
        const analysis = {
            totalPages: pngFiles.length,
            pages: [],
            issues: []
        };
        
        for (let i = 0; i < pngFiles.length; i++) {
            const file = pngFiles[i];
            const filePath = path.join(this.outputDir, file);
            const stats = await fs.stat(filePath);
            
            const pageInfo = {
                pageNumber: i + 1,
                filename: file,
                sizeKB: (stats.size / 1024).toFixed(2),
                type: this.detectPageType(i, pngFiles.length)
            };
            
            // Check for common issues
            if (stats.size < 10 * 1024) { // Less than 10KB
                pageInfo.issue = 'Page appears blank or corrupted';
                analysis.issues.push({
                    page: i + 1,
                    issue: 'Blank page detected'
                });
            }
            
            if (i === 0 && stats.size < 50 * 1024) { // Cover should be larger
                pageInfo.issue = 'Cover image may be missing';
                analysis.issues.push({
                    page: 1,
                    issue: 'Cover image possibly missing'
                });
            }
            
            analysis.pages.push(pageInfo);
        }
        
        return analysis;
    }

    detectPageType(index, total) {
        if (index === 0) return 'cover';
        if (index === 1) return 'toc';
        if (index === total - 1) return 'back-cover';
        return 'content';
    }

    async generateReport(analysis) {
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath: this.pdfPath,
            summary: {
                totalPages: analysis.totalPages,
                issuesFound: analysis.issues.length,
                status: analysis.issues.length === 0 ? 'PASSED' : 'NEEDS_ATTENTION'
            },
            pages: analysis.pages,
            issues: analysis.issues,
            recommendations: this.getRecommendations(analysis)
        };
        
        await fs.writeJson(
            path.join(this.outputDir, 'qa-report.json'), 
            report, 
            { spaces: 2 }
        );
        
        // Also create a visual HTML report
        await this.createHTMLReport(report);
        
        return report;
    }

    getRecommendations(analysis) {
        const recs = [];
        
        if (analysis.issues.some(i => i.issue.includes('Cover'))) {
            recs.push('Check that cover image is properly embedded in the PDF');
        }
        
        if (analysis.issues.some(i => i.issue.includes('Blank'))) {
            recs.push('Review page breaks and content flow');
        }
        
        if (analysis.totalPages < 10) {
            recs.push('Document seems short - verify all chapters were included');
        }
        
        return recs;
    }

    async createHTMLReport(report) {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>PDF Visual QA Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .status-passed { color: green; }
        .status-needs_attention { color: orange; }
        .page-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .page-card { border: 1px solid #ddd; padding: 10px; text-align: center; }
        .page-card img { max-width: 100%; height: auto; }
        .issue { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
    </style>
</head>
<body>
    <h1>PDF Visual QA Report</h1>
    <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
    
    <h2>Summary</h2>
    <p>Total Pages: ${report.summary.totalPages}</p>
    <p>Status: <span class="status-${report.summary.status.toLowerCase()}">${report.summary.status}</span></p>
    <p>Issues Found: ${report.summary.issuesFound}</p>
    
    ${report.issues.length > 0 ? `
    <h2>Issues</h2>
    ${report.issues.map(issue => `
        <div class="issue">Page ${issue.page}: ${issue.issue}</div>
    `).join('')}
    ` : ''}
    
    <h2>Page Preview</h2>
    <div class="page-grid">
        ${report.pages.map(page => `
        <div class="page-card">
            <h4>Page ${page.pageNumber} (${page.type})</h4>
            <img src="${page.filename}" alt="Page ${page.pageNumber}">
            <p>${page.sizeKB} KB</p>
            ${page.issue ? `<p style="color: red;">${page.issue}</p>` : ''}
        </div>
        `).join('')}
    </div>
    
    ${report.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <ul>
        ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    ` : ''}
</body>
</html>`;
        
        await fs.writeFile(
            path.join(this.outputDir, 'qa-report.html'),
            html
        );
    }

    async useAlternativeMethod() {
        console.log('🔧 Alternative: Using Puppeteer to capture PDF pages...\n');
        
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        // Create output directory
        await fs.ensureDir(this.outputDir);
        
        // We can't inspect PDF directly, but we can try PDF.js approach
        console.log('⚠️  Note: For best results, install pdftoppm:');
        console.log('   macOS: brew install poppler');
        console.log('   Ubuntu: sudo apt-get install poppler-utils');
        console.log('   Windows: Download from https://blog.alivate.com.au/poppler-windows/\n');
        
        await browser.close();
        
        return {
            message: 'Please install pdftoppm for visual PDF QA',
            alternative: 'Or use the HTML-first workflow for full visual control'
        };
    }
}

// Run if called directly
if (require.main === module) {
    const pdfPath = process.argv[2];
    
    if (!pdfPath) {
        console.error('Usage: node pdf-to-images-qa.js <path/to/pdf>');
        process.exit(1);
    }
    
    const qa = new PDFtoImagesQA(pdfPath);
    qa.run().catch(console.error);
}

module.exports = PDFtoImagesQA;