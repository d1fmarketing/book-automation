#!/usr/bin/env node
/**
 * Generate HTML Only - For QA and DOM inspection
 * Uses preset buildHTML without generating PDF
 */

const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const { glob } = require('glob');

// Parse command line arguments
const args = process.argv.slice(2);
let preset = 'digital';
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
    }
}

// Configure marked
marked.setOptions({
    breaks: true,
    gfm: true,
    headerIds: true
});

// Load preset configuration
async function loadPreset(presetName) {
    const presetPath = path.join(__dirname, 'pdf-presets', `${presetName}.js`);
    
    if (!await fs.pathExists(presetPath)) {
        console.error(`❌ Preset '${presetName}' not found!`);
        process.exit(1);
    }
    
    return require(presetPath);
}

// Load book metadata
async function loadMetadata() {
    const bookDir = path.join(__dirname, '..', 'pipeline-book');
    const metadataPath = path.join(bookDir, 'metadata.yaml');
    
    if (!await fs.pathExists(metadataPath)) {
        throw new Error('metadata.yaml not found');
    }
    
    return yaml.load(await fs.readFile(metadataPath, 'utf8'));
}

// Load cover image
async function loadCoverImage() {
    const bookDir = path.join(__dirname, '..', 'pipeline-book');
    const coverPath = path.join(bookDir, 'assets', 'images', 'cover.png');
    
    if (await fs.pathExists(coverPath)) {
        const coverBuffer = await fs.readFile(coverPath);
        return `data:image/png;base64,${coverBuffer.toString('base64')}`;
    }
    
    return null;
}

// Load chapters
async function loadChapters() {
    const bookDir = path.join(__dirname, '..', 'pipeline-book');
    const chapterFiles = await glob(path.join(bookDir, 'chapters', '*.md'));
    const chapters = [];
    
    for (const file of chapterFiles.sort()) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');
        let frontmatter = {};
        let markdownContent = content;
        
        if (lines[0] === '---') {
            const endIndex = lines.indexOf('---', 1);
            if (endIndex > 0) {
                const yamlContent = lines.slice(1, endIndex).join('\n');
                frontmatter = yaml.load(yamlContent);
                markdownContent = lines.slice(endIndex + 1).join('\n');
            }
        }
        
        chapters.push({
            path: file,
            frontmatter,
            content: markdownContent,
            html: marked.parse(markdownContent)
        });
    }
    
    return chapters;
}

// Main HTML generation function
async function generateHTML() {
    console.log(`🚀 Generating HTML with '${preset}' preset...`);
    
    try {
        // Load preset configuration
        const presetConfig = await loadPreset(preset);
        
        // Load metadata and content
        const metadata = await loadMetadata();
        const coverBase64 = await loadCoverImage();
        const chapters = await loadChapters();
        
        if (verbose) {
            console.log(`📚 Found ${chapters.length} chapters`);
        }
        
        // Build HTML content using preset
        const htmlContent = await presetConfig.buildHTML({
            metadata,
            chapters,
            coverBase64,
            verbose
        });
        
        // Determine output path
        const defaultOutput = path.join(__dirname, '..', 'build', 'tmp', `ebook-${preset}.html`);
        const finalOutput = outputPath || defaultOutput;
        
        // Ensure output directory exists
        await fs.ensureDir(path.dirname(finalOutput));
        
        // Save HTML
        await fs.writeFile(finalOutput, htmlContent);
        
        console.log(`✅ HTML generated successfully!`);
        console.log(`📄 Output: ${finalOutput}`);
        
        // Show file size
        const stats = await fs.stat(finalOutput);
        console.log(`📏 Size: ${(stats.size / 1024).toFixed(2)} KB`);
        
        return finalOutput;
        
    } catch (error) {
        console.error(`❌ Error generating HTML: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    generateHTML();
}

module.exports = { generateHTML };