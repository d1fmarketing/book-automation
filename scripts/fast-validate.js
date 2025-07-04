#!/usr/bin/env node

/**
 * Fast Validation Script
 * 
 * Runs cheap validations before expensive operations
 * Fails fast to save time
 */

const fs = require('fs').promises;
const path = require('path');

// ANSI colors
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

class FastValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.checks = 0;
    }

    log(message, type = 'info') {
        const prefix = {
            error: `${colors.red}❌`,
            warning: `${colors.yellow}⚠️ `,
            success: `${colors.green}✅`,
            info: '  '
        }[type];
        
        console.log(`${prefix} ${message}${colors.reset}`);
    }

    async validateEnvironment() {
        this.log('Checking environment variables...', 'info');
        this.checks++;
        
        const required = [
            'ANTHROPIC_API_KEY',
            'PERPLEXITY_API_KEY'
        ];
        
        const optional = [
            'IDEOGRAM_API_KEY',
            'DEEPSEEK_API_KEY',
            'GITHUB_TOKEN'
        ];
        
        // Check required
        for (const key of required) {
            if (!process.env[key]) {
                this.errors.push(`Missing required env var: ${key}`);
                this.log(`Missing ${key}`, 'error');
            }
        }
        
        // Check optional
        for (const key of optional) {
            if (!process.env[key]) {
                this.warnings.push(`Missing optional env var: ${key}`);
                this.log(`Missing ${key} (optional)`, 'warning');
            }
        }
        
        if (this.errors.length === 0) {
            this.log('Environment variables OK', 'success');
        }
    }

    async validateAgents() {
        this.log('Checking agent modules...', 'info');
        this.checks++;
        
        const agents = [
            { name: 'planner', path: '../agents/planner', required: ['createOutline'] },
            { name: 'writer', path: '../agents/writer', required: ['Writer'] },
            { name: 'formatter-html', path: '../agents/formatter-html', required: ['FormatterHTML'] },
            { name: 'illustrator', path: '../agents/illustrator', required: [] },
            { name: 'tone-polisher', path: '../agents/tone-polisher', required: ['polishBook'] },
            { name: 'fact-checker', path: '../agents/fact-checker', required: ['checkBook'] },
            { name: 'affiliate-injector', path: '../agents/affiliate-injector', required: ['processEbookDirectory'] }
        ];
        
        for (const agent of agents) {
            try {
                const module = require(agent.path);
                
                // Check if it's a function or class
                if (typeof module !== 'function' && typeof module !== 'object') {
                    this.errors.push(`${agent.name}: Invalid module export`);
                    this.log(`${agent.name}: Invalid export type`, 'error');
                    continue;
                }
                
                // Check required methods/properties
                for (const req of agent.required) {
                    if (!module[req] && !(module.prototype && module.prototype[req])) {
                        this.errors.push(`${agent.name}: Missing ${req}`);
                        this.log(`${agent.name}: Missing ${req}`, 'error');
                    }
                }
                
            } catch (error) {
                this.errors.push(`${agent.name}: ${error.message}`);
                this.log(`${agent.name}: ${error.message}`, 'error');
            }
        }
        
        if (this.errors.length === 0) {
            this.log('All agents OK', 'success');
        }
    }

    async validateFileSystem() {
        this.log('Checking file system...', 'info');
        this.checks++;
        
        const requiredDirs = [
            'agents',
            'scripts',
            'qa',
            'utils',
            'assets'
        ];
        
        for (const dir of requiredDirs) {
            try {
                await fs.access(dir);
            } catch {
                this.errors.push(`Missing directory: ${dir}`);
                this.log(`Missing directory: ${dir}`, 'error');
            }
        }
        
        // Check write permissions on build
        try {
            await fs.mkdir('build/test-write', { recursive: true });
            await fs.rmdir('build/test-write');
        } catch (error) {
            this.errors.push('Cannot write to build directory');
            this.log('Cannot write to build directory', 'error');
        }
        
        if (this.errors.length === 0) {
            this.log('File system OK', 'success');
        }
    }

    async validateDependencies() {
        this.log('Checking npm dependencies...', 'info');
        this.checks++;
        
        try {
            const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
            const required = [
                'marked',
                'js-yaml',
                'chokidar',
                'dotenv'
            ];
            
            const missing = required.filter(dep => 
                !packageJson.dependencies?.[dep] && 
                !packageJson.devDependencies?.[dep]
            );
            
            if (missing.length > 0) {
                this.errors.push(`Missing dependencies: ${missing.join(', ')}`);
                this.log(`Missing: ${missing.join(', ')}`, 'error');
            } else {
                this.log('Dependencies OK', 'success');
            }
            
        } catch (error) {
            this.errors.push('Cannot read package.json');
            this.log('Cannot read package.json', 'error');
        }
    }

    async validateSyntax() {
        this.log('Checking JavaScript syntax...', 'info');
        this.checks++;
        
        const files = [
            'scripts/orchestrator.js',
            'scripts/orchestrator-fast.js',
            'agents/writer.js',
            'agents/formatter-html.js'
        ];
        
        for (const file of files) {
            try {
                await fs.access(file);
                
                // Try to parse the file
                const content = await fs.readFile(file, 'utf8');
                new Function(content); // This will throw on syntax errors
                
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.warnings.push(`File not found: ${file}`);
                    this.log(`File not found: ${file}`, 'warning');
                } else {
                    this.errors.push(`Syntax error in ${file}: ${error.message}`);
                    this.log(`Syntax error in ${file}`, 'error');
                }
            }
        }
        
        if (this.errors.length === 0) {
            this.log('Syntax OK', 'success');
        }
    }

    async quickContentCheck(bookDir) {
        if (!bookDir) return;
        
        this.log(`Checking book content in ${bookDir}...`, 'info');
        this.checks++;
        
        try {
            // Check outline
            const outlinePath = path.join(bookDir, 'outline.json');
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            
            if (!outline.chapters || outline.chapters.length === 0) {
                this.errors.push('Outline has no chapters');
                this.log('Outline has no chapters', 'error');
            }
            
            // Check chapters
            const files = await fs.readdir(bookDir);
            const chapters = files.filter(f => f.match(/^chapter-\d+\.md$/));
            
            if (chapters.length === 0) {
                this.errors.push('No chapter files found');
                this.log('No chapter files found', 'error');
            } else {
                // Check all chapters for content issues
                for (const chapter of chapters) {
                    await this.lintChapter(path.join(bookDir, chapter), chapter);
                }
            }
            
            this.log('Content check complete', 'success');
            
        } catch (error) {
            this.warnings.push(`Cannot check book content: ${error.message}`);
            this.log(`Cannot check book: ${error.message}`, 'warning');
        }
    }

    async lintChapter(filePath, filename) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Word count check
            const words = content.split(/\s+/).filter(w => w.length > 0).length;
            if (words < 500) {
                this.warnings.push(`${filename}: Only ${words} words (minimum: 500)`);
                this.log(`${filename}: Only ${words} words`, 'warning');
            }
            
            // Check for [object Object]
            if (content.includes('[object Object]')) {
                this.errors.push(`${filename}: Contains [object Object]`);
                this.log(`${filename}: Contains [object Object]`, 'error');
            }
            
            // Check for undefined heading tags
            if (content.match(/<h\s*undefined|<hundefined/i)) {
                this.errors.push(`${filename}: Contains undefined heading tags`);
                this.log(`${filename}: Contains undefined heading tags`, 'error');
            }
            
            // Check markdown structure
            let headingLevel = 0;
            let hasH1 = false;
            let emptyHeadings = [];
            let consecutiveEmptyLines = 0;
            let maxConsecutiveEmpty = 0;
            
            lines.forEach((line, index) => {
                // Check for headings
                const headingMatch = line.match(/^(#{1,6})\s*(.*)$/);
                if (headingMatch) {
                    const level = headingMatch[1].length;
                    const text = headingMatch[2].trim();
                    
                    if (level === 1) hasH1 = true;
                    
                    // Check for empty headings
                    if (!text) {
                        emptyHeadings.push(index + 1);
                    }
                    
                    // Check heading hierarchy
                    if (level > headingLevel + 1 && headingLevel > 0) {
                        this.warnings.push(`${filename}:${index + 1}: Skipped heading level (${headingLevel} → ${level})`);
                    }
                    
                    headingLevel = level;
                }
                
                // Check for excessive empty lines
                if (line.trim() === '') {
                    consecutiveEmptyLines++;
                    maxConsecutiveEmpty = Math.max(maxConsecutiveEmpty, consecutiveEmptyLines);
                } else {
                    consecutiveEmptyLines = 0;
                }
                
                // Check for broken links
                const linkMatch = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
                if (linkMatch) {
                    linkMatch.forEach(link => {
                        const urlMatch = link.match(/\[([^\]]*)\]\(([^)]*)\)/);
                        if (urlMatch) {
                            const text = urlMatch[1];
                            const url = urlMatch[2];
                            
                            if (!text.trim()) {
                                this.errors.push(`${filename}:${index + 1}: Empty link text`);
                            }
                            if (!url.trim()) {
                                this.errors.push(`${filename}:${index + 1}: Empty link URL`);
                            }
                        }
                    });
                }
                
                // Check for malformed lists
                if (line.match(/^[-*+]\s*$/)) {
                    this.errors.push(`${filename}:${index + 1}: Empty list item`);
                }
                
                // Check for code blocks
                if (line.startsWith('```') && line.length > 3 && !line.slice(3).trim()) {
                    this.warnings.push(`${filename}:${index + 1}: Code block without language specified`);
                }
            });
            
            // Report issues
            if (!hasH1) {
                this.warnings.push(`${filename}: No H1 heading found`);
            }
            
            if (emptyHeadings.length > 0) {
                this.errors.push(`${filename}: Empty headings on lines ${emptyHeadings.join(', ')}`);
            }
            
            if (maxConsecutiveEmpty > 3) {
                this.warnings.push(`${filename}: Excessive empty lines (${maxConsecutiveEmpty} consecutive)`);
            }
            
            // Check for common placeholder text
            const placeholders = [
                'Lorem ipsum',
                'TODO',
                'FIXME',
                'XXX',
                '[PLACEHOLDER]',
                'Content goes here',
                'To be written'
            ];
            
            placeholders.forEach(placeholder => {
                if (content.toLowerCase().includes(placeholder.toLowerCase())) {
                    this.warnings.push(`${filename}: Contains placeholder text: "${placeholder}"`);
                }
            });
            
        } catch (error) {
            this.errors.push(`${filename}: Failed to lint: ${error.message}`);
        }
    }

    async run(options = {}) {
        console.log('🚀 FAST VALIDATION\n');
        console.log('Running cheap checks before expensive operations...\n');
        
        const startTime = Date.now();
        
        // Run all validations
        await this.validateEnvironment();
        await this.validateAgents();
        await this.validateFileSystem();
        await this.validateDependencies();
        await this.validateSyntax();
        
        if (options.bookDir) {
            await this.quickContentCheck(options.bookDir);
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('VALIDATION SUMMARY');
        console.log('='.repeat(50));
        console.log(`Checks performed: ${this.checks}`);
        console.log(`Time taken: ${duration}s`);
        console.log(`Errors: ${colors.red}${this.errors.length}${colors.reset}`);
        console.log(`Warnings: ${colors.yellow}${this.warnings.length}${colors.reset}`);
        
        if (this.errors.length > 0) {
            console.log(colors.red + '\n❌ VALIDATION FAILED\n' + colors.reset);
            console.log('Errors found:');
            this.errors.forEach(err => console.log(`  - ${err}`));
            return false;
        }
        
        if (this.warnings.length > 0) {
            console.log(colors.yellow + '\n⚠️  VALIDATION PASSED WITH WARNINGS\n' + colors.reset);
            console.log('Warnings:');
            this.warnings.forEach(warn => console.log(`  - ${warn}`));
        } else {
            console.log(colors.green + '\n✅ ALL VALIDATIONS PASSED\n' + colors.reset);
        }
        
        return true;
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--book' && i + 1 < args.length) {
            options.bookDir = args[i + 1];
            i++;
        } else if (args[i] === '--help') {
            console.log(`
Fast Validation Script

Usage:
  node fast-validate.js [options]

Options:
  --book <dir>   Also validate book content
  --help         Show this help

Example:
  node fast-validate.js
  node fast-validate.js --book build/ebooks/my-book
`);
            process.exit(0);
        }
    }
    
    // Load environment variables
    require('dotenv').config();
    
    const validator = new FastValidator();
    
    validator.run(options).then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error(colors.red + '\nFatal error: ' + error.message + colors.reset);
        process.exit(1);
    });
}

module.exports = FastValidator;