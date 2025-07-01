#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

// Parse command line arguments
const args = process.argv.slice(2);
let preset = 'main';
let verbose = false;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--preset' || args[i] === '-p') {
        preset = args[i + 1];
        i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
        verbose = true;
    } else if (args[i] === '--output' || args[i] === '-o') {
        outputPath = args[i + 1];
        i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
        console.log(`
Usage: node generate-pdf-unified.js [options]

Options:
  -p, --preset <name>    Use a specific preset (default: main)
                         Available: main, clean, colorful, full-page, professional, readable
  -o, --output <path>    Custom output path for the PDF
  -v, --verbose          Show detailed output
  -h, --help             Show this help message

Examples:
  node generate-pdf-unified.js                    # Use default 'main' preset
  node generate-pdf-unified.js --preset clean     # Use clean preset
  node generate-pdf-unified.js -p professional -v  # Professional preset with verbose output
`);
        process.exit(0);
    }
}

// Console colors
const chalk = {
    green: (text) => `✅ ${text}`,
    red: (text) => `❌ ${text}`,
    yellow: (text) => `⚠️  ${text}`,
    blue: (text) => `ℹ️  ${text}`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`,
    dim: (text) => `\x1b[2m${text}\x1b[0m`
};

// Configure marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true
});

// Load preset configuration
async function loadPreset(presetName) {
    const presetPath = path.join(__dirname, 'pdf-presets', `${presetName}.js`);
    
    // Check if preset exists
    if (!await fs.pathExists(presetPath)) {
        console.error(chalk.red(`Preset '${presetName}' not found!`));
        console.log('Available presets: main, clean, colorful, full-page, professional, readable');
        process.exit(1);
    }
    
    return require(presetPath);
}

// Utility functions
async function loadMetadata() {
    return yaml.load(await fs.readFile('metadata.yaml', 'utf8'));
}

async function loadCoverImage() {
    const coverPath = path.join(process.cwd(), 'assets/images/cover.jpg');
    
    if (await fs.pathExists(coverPath)) {
        const coverBuffer = await fs.readFile(coverPath);
        const isPNG = coverBuffer[0] === 0x89 && coverBuffer[1] === 0x50;
        const mimeType = isPNG ? 'image/png' : 'image/jpeg';
        const base64 = `data:${mimeType};base64,${coverBuffer.toString('base64')}`;
        
        if (verbose) {
            console.log(chalk.blue(`Cover loaded: ${(coverBuffer.length / 1024 / 1024).toFixed(2)} MB`));
        }
        
        return base64;
    }
    
    console.log(chalk.yellow('Warning: Cover not found at assets/images/cover.jpg'));
    return '';
}

async function loadChapters() {
    const chaptersDir = path.join(process.cwd(), 'chapters');
    const chapterFiles = await glob('chapters/chapter-*.md');
    
    const chapters = [];
    
    for (const file of chapterFiles.sort()) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        
        // Find frontmatter
        let frontmatterStart = -1;
        let frontmatterEnd = -1;
        let frontmatter = {};
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                if (frontmatterStart === -1) {
                    frontmatterStart = i;
                } else {
                    frontmatterEnd = i;
                    break;
                }
            }
        }
        
        if (frontmatterStart !== -1 && frontmatterEnd !== -1) {
            const frontmatterText = lines.slice(frontmatterStart + 1, frontmatterEnd).join('\n');
            frontmatter = yaml.load(frontmatterText) || {};
        }
        
        // Remove frontmatter from content
        const markdownContent = frontmatterEnd !== -1 
            ? lines.slice(frontmatterEnd + 1).join('\n')
            : content;
        
        chapters.push({
            file: path.basename(file),
            frontmatter,
            content: markdownContent,
            html: marked.parse(markdownContent)
        });
    }
    
    return chapters;
}

// Main PDF generation function
async function generatePDF() {
    console.log(chalk.bold(`🚀 Generating PDF with '${preset}' preset...`));
    
    try {
        // Load preset configuration
        const presetConfig = await loadPreset(preset);
        
        // Load metadata and content
        const metadata = await loadMetadata();
        const coverBase64 = await loadCoverImage();
        const chapters = await loadChapters();
        
        if (verbose) {
            console.log(chalk.dim(`Found ${chapters.length} chapters`));
        }
        
        // Create output directory
        const defaultOutput = path.join(process.cwd(), 'build/dist/ebook.pdf');
        const finalOutput = outputPath || defaultOutput;
        await fs.ensureDir(path.dirname(finalOutput));
        
        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Build HTML content using preset
        const htmlContent = await presetConfig.buildHTML({
            metadata,
            chapters,
            coverBase64,
            verbose
        });
        
        // Save debug HTML if requested
        if (process.env.DEBUG === '1') {
            const debugPath = path.join(process.cwd(), 'build/tmp/debug.html');
            await fs.ensureDir(path.dirname(debugPath));
            await fs.writeFile(debugPath, htmlContent);
            console.log(chalk.dim(`Debug HTML saved to ${debugPath}`));
        }
        
        // Set page content
        await page.setContent(htmlContent, {
            waitUntil: ['load', 'networkidle0']
        });
        
        // Apply preset-specific page setup
        if (presetConfig.setupPage) {
            await presetConfig.setupPage(page);
        }
        
        // Get PDF options from preset
        const pdfOptions = presetConfig.getPDFOptions ? presetConfig.getPDFOptions() : {
            path: finalOutput,
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: true
        };
        
        // Ensure output path is set
        pdfOptions.path = finalOutput;
        
        // Generate PDF
        await page.pdf(pdfOptions);
        
        // Close browser
        await browser.close();
        
        // Run post-processing if preset has it
        if (presetConfig.postProcess) {
            await presetConfig.postProcess(finalOutput, verbose);
        }
        
        // Show success message
        const stats = await fs.stat(finalOutput);
        console.log(chalk.green(`PDF generated successfully!`));
        console.log(chalk.dim(`Output: ${finalOutput} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`));
        
    } catch (error) {
        console.error(chalk.red('Error generating PDF:'), error);
        process.exit(1);
    }
}

// Run the generator
generatePDF();