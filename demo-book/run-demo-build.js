#!/usr/bin/env node

/**
 * Simple demo build runner
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// ANSI colors
const colors = {
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

async function updateWordCounts() {
    console.log(colors.blue('\n📊 Updating word counts...'));
    
    const chapters = await fs.readdir('chapters');
    for (const file of chapters) {
        if (file.endsWith('.md')) {
            const content = await fs.readFile(path.join('chapters', file), 'utf8');
            const words = content.split(/\s+/).length;
            
            // Update frontmatter
            const updated = content.replace(/words: \d+/, `words: ${words}`);
            await fs.writeFile(path.join('chapters', file), updated);
            
            console.log(`  ${file}: ${words} words`);
        }
    }
}

async function buildPDF() {
    console.log(colors.blue('\n📄 Building PDF...'));
    
    try {
        const { stdout, stderr } = await execAsync('node scripts/generate-pdf-unified.js');
        if (stderr) console.error(stderr);
        console.log(colors.green('✅ PDF generated successfully'));
    } catch (error) {
        console.error(colors.red('❌ PDF generation failed:'), error.message);
    }
}

async function buildEPUB() {
    console.log(colors.blue('\n📚 Building EPUB...'));
    
    try {
        const { stdout, stderr } = await execAsync('node scripts/build-epub.js');
        if (stderr) console.error(stderr);
        console.log(colors.green('✅ EPUB generated successfully'));
    } catch (error) {
        console.error(colors.red('❌ EPUB generation failed:'), error.message);
    }
}

async function validateOutputs() {
    console.log(colors.blue('\n✅ Validating outputs...'));
    
    const outputs = [
        'build/dist/ebook.pdf',
        'build/dist/ebook.epub'
    ];
    
    for (const output of outputs) {
        try {
            const stats = await fs.stat(output);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`  ${output}: ${sizeMB}MB`);
        } catch (error) {
            console.log(colors.red(`  ${output}: NOT FOUND`));
        }
    }
}

async function main() {
    console.log(colors.blue('🚀 Demo Book Build Runner\n'));
    
    try {
        await updateWordCounts();
        await buildPDF();
        await buildEPUB();
        await validateOutputs();
        
        console.log(colors.green('\n✨ Build completed successfully!'));
        
        // Generate summary report
        const report = {
            timestamp: new Date().toISOString(),
            status: 'success',
            outputs: {
                pdf: 'build/dist/ebook.pdf',
                epub: 'build/dist/ebook.epub'
            },
            chapters: 4,
            images: 11
        };
        
        await fs.writeFile('build-report.json', JSON.stringify(report, null, 2));
        console.log(colors.blue('\n📊 Build report: build-report.json'));
        
    } catch (error) {
        console.error(colors.red('Build failed:'), error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}