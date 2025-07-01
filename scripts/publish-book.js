#!/usr/bin/env node

/**
 * Unified Book Publishing Orchestrator
 * Publishes to multiple platforms with a single command
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const KDPPublisher = require('./publishers/kdp-publisher');
const AppleBooksPublisher = require('./publishers/apple-books-publisher');
const GooglePlayPublisher = require('./publishers/google-play-publisher');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    magenta: (text) => `\x1b[35m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};

class BookPublisher {
    constructor(options = {}) {
        this.metadata = options.metadata || {};
        this.platforms = options.platforms || ['kdp', 'apple', 'google'];
        this.dryRun = options.dryRun || false;
        this.results = {};
    }

    async loadMetadata(metadataPath) {
        console.log(colors.blue('📖 Loading book metadata...'));
        const content = await fs.readFile(metadataPath, 'utf8');
        this.metadata = yaml.load(content);
        
        console.log(colors.green('✅ Metadata loaded:'));
        console.log(colors.gray(`   Title: ${this.metadata.title}`));
        console.log(colors.gray(`   Author: ${this.metadata.author}`));
        console.log(colors.gray(`   ISBN: ${this.metadata.isbn || 'Not specified'}`));
        
        return this.metadata;
    }

    async checkFiles() {
        console.log(colors.blue('\n🔍 Checking required files...'));
        
        const requiredFiles = {
            'PDF': this.metadata.pdf_path || 'build/dist/ebook.pdf',
            'EPUB': this.metadata.epub_path || 'build/dist/book.epub',
            'Cover': this.metadata.cover_image || 'assets/images/cover.jpg'
        };
        
        let allFilesExist = true;
        
        for (const [type, filePath] of Object.entries(requiredFiles)) {
            try {
                await fs.access(filePath);
                const stats = await fs.stat(filePath);
                console.log(colors.green(`   ✓ ${type}: ${filePath} (${this.formatFileSize(stats.size)})`));
            } catch (error) {
                console.log(colors.red(`   ✗ ${type}: ${filePath} - NOT FOUND`));
                allFilesExist = false;
            }
        }
        
        return allFilesExist;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
        else return (bytes / 1048576).toFixed(2) + ' MB';
    }

    async publishToKDP() {
        console.log(colors.bold(colors.magenta('\n📦 Publishing to Amazon KDP...\n')));
        
        try {
            const publisher = new KDPPublisher({ 
                dryRun: this.dryRun,
                metadata: this.metadata 
            });
            
            // Load credentials if not dry run
            if (!this.dryRun) {
                await publisher.loadCredentials('config/kdp-credentials.json');
            }
            
            const result = await publisher.publishBook({
                manuscriptPath: this.metadata.pdf_path || 'build/dist/ebook.pdf',
                coverPath: this.metadata.cover_image || 'assets/images/cover.jpg',
                skipPreview: this.dryRun
            });
            
            this.results.kdp = result;
            return result;
        } catch (error) {
            console.error(colors.red(`❌ KDP publishing failed: ${error.message}`));
            this.results.kdp = { success: false, error: error.message };
            throw error;
        }
    }

    async publishToAppleBooks() {
        console.log(colors.bold(colors.cyan('\n🍎 Publishing to Apple Books...\n')));
        
        try {
            const publisher = new AppleBooksPublisher({ 
                dryRun: this.dryRun,
                metadata: this.metadata 
            });
            
            // Load credentials if not dry run
            if (!this.dryRun) {
                await publisher.loadCredentials('config/apple-credentials.json');
            }
            
            const result = await publisher.publishBook({
                epubPath: this.metadata.epub_path || 'build/dist/book.epub',
                coverPath: this.metadata.cover_image || 'assets/images/cover.jpg'
            });
            
            this.results.apple = result;
            return result;
        } catch (error) {
            console.error(colors.red(`❌ Apple Books publishing failed: ${error.message}`));
            this.results.apple = { success: false, error: error.message };
            throw error;
        }
    }

    async publishToGooglePlay() {
        console.log(colors.bold(colors.yellow('\n🎮 Publishing to Google Play Books...\n')));
        
        try {
            const publisher = new GooglePlayPublisher({ 
                dryRun: this.dryRun,
                metadata: this.metadata 
            });
            
            // Load credentials if not dry run
            if (!this.dryRun) {
                await publisher.loadCredentials('config/google-credentials.json');
            }
            
            const result = await publisher.publishBook({
                epubPath: this.metadata.epub_path || 'build/dist/book.epub',
                coverPath: this.metadata.cover_image || 'assets/images/cover.jpg'
            });
            
            this.results.google = result;
            return result;
        } catch (error) {
            console.error(colors.red(`❌ Google Play publishing failed: ${error.message}`));
            this.results.google = { success: false, error: error.message };
            throw error;
        }
    }

    async publishToAll() {
        console.log(colors.bold(colors.green('\n🚀 Starting multi-platform publishing...\n')));
        
        // Check files first
        const filesExist = await this.checkFiles();
        if (!filesExist && !this.dryRun) {
            throw new Error('Missing required files. Please build the book first.');
        }
        
        const results = {
            total: this.platforms.length,
            successful: 0,
            failed: 0,
            platforms: {}
        };
        
        // Publish to each platform
        for (const platform of this.platforms) {
            try {
                let result;
                
                switch (platform.toLowerCase()) {
                    case 'kdp':
                    case 'amazon':
                        result = await this.publishToKDP();
                        break;
                    case 'apple':
                    case 'ibooks':
                        result = await this.publishToAppleBooks();
                        break;
                    case 'google':
                    case 'play':
                        result = await this.publishToGooglePlay();
                        break;
                    default:
                        console.log(colors.yellow(`⚠️  Unknown platform: ${platform}`));
                        continue;
                }
                
                if (result.success) {
                    results.successful++;
                    results.platforms[platform] = result;
                }
            } catch (error) {
                results.failed++;
                results.platforms[platform] = { 
                    success: false, 
                    error: error.message 
                };
                
                // Continue with other platforms
                console.log(colors.yellow(`\n⚠️  Continuing with remaining platforms...\n`));
            }
        }
        
        // Summary
        console.log(colors.bold('\n📊 PUBLISHING SUMMARY'));
        console.log(colors.bold('======================\n'));
        
        console.log(`Total platforms: ${results.total}`);
        console.log(colors.green(`✅ Successful: ${results.successful}`));
        if (results.failed > 0) {
            console.log(colors.red(`❌ Failed: ${results.failed}`));
        }
        
        console.log('\nPlatform Results:');
        for (const [platform, result] of Object.entries(results.platforms)) {
            if (result.success) {
                console.log(colors.green(`  ✓ ${platform}: SUCCESS`));
                if (result.asin) console.log(colors.gray(`     ASIN: ${result.asin}`));
                if (result.appleId) console.log(colors.gray(`     Apple ID: ${result.appleId}`));
                if (result.volumeId) console.log(colors.gray(`     Volume ID: ${result.volumeId}`));
            } else {
                console.log(colors.red(`  ✗ ${platform}: FAILED - ${result.error}`));
            }
        }
        
        return results;
    }

    async generatePublishingReport(results) {
        console.log(colors.blue('\n📝 Generating publishing report...'));
        
        const report = {
            timestamp: new Date().toISOString(),
            book: {
                title: this.metadata.title,
                author: this.metadata.author,
                isbn: this.metadata.isbn
            },
            results: results,
            next_steps: this.generateNextSteps(results)
        };
        
        const reportPath = path.join('build', 'reports', `publishing-report-${Date.now()}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(colors.green(`✅ Report saved: ${reportPath}`));
        return reportPath;
    }

    generateNextSteps(results) {
        const steps = [];
        
        if (results.platforms.kdp?.success) {
            steps.push('Monitor KDP dashboard for review status (24-72 hours)');
            steps.push('Set up Amazon Author Central profile');
            steps.push('Request reviews from early readers');
        }
        
        if (results.platforms.apple?.success) {
            steps.push('Check Apple Books Connect for review status (24-48 hours)');
            steps.push('Set up promotional pricing if desired');
        }
        
        if (results.platforms.google?.success) {
            steps.push('Verify book appears in Google Play Store');
            steps.push('Set up Google Books preview settings');
        }
        
        steps.push('Update book website with purchase links');
        steps.push('Announce publication on social media');
        steps.push('Submit to book review sites');
        
        return steps;
    }
}

// CLI usage
if (require.main === module) {
    const yargs = require('yargs/yargs');
    const { hideBin } = require('yargs/helpers');
    
    const argv = yargs(hideBin(process.argv))
        .option('metadata', {
            alias: 'm',
            description: 'Path to metadata.yaml',
            type: 'string',
            default: 'metadata.yaml'
        })
        .option('platforms', {
            alias: 'p',
            description: 'Platforms to publish to',
            type: 'array',
            choices: ['kdp', 'amazon', 'apple', 'ibooks', 'google', 'play'],
            default: ['kdp', 'apple', 'google']
        })
        .option('dry-run', {
            alias: 'd',
            description: 'Perform a dry run without publishing',
            type: 'boolean',
            default: false
        })
        .option('report', {
            alias: 'r',
            description: 'Generate publishing report',
            type: 'boolean',
            default: true
        })
        .example('$0', 'Publish to all platforms')
        .example('$0 -p kdp', 'Publish to Amazon KDP only')
        .example('$0 -p apple google', 'Publish to Apple Books and Google Play')
        .example('$0 -d', 'Dry run to test the process')
        .help()
        .argv;
    
    (async () => {
        const publisher = new BookPublisher({
            platforms: argv.platforms,
            dryRun: argv.dryRun
        });
        
        try {
            console.log(colors.bold(colors.green('📚 BOOK PUBLISHING AUTOMATION\n')));
            
            if (argv.dryRun) {
                console.log(colors.yellow('⚠️  DRY RUN MODE - No actual publishing will occur\n'));
            }
            
            // Load metadata
            await publisher.loadMetadata(argv.metadata);
            
            // Publish to all platforms
            const results = await publisher.publishToAll();
            
            // Generate report
            if (argv.report) {
                await publisher.generatePublishingReport(results);
            }
            
            if (results.successful === results.total) {
                console.log(colors.bold(colors.green('\n🎉 ALL PLATFORMS PUBLISHED SUCCESSFULLY! 🎉')));
            } else if (results.successful > 0) {
                console.log(colors.bold(colors.yellow('\n⚠️  PARTIAL SUCCESS - Some platforms failed')));
            } else {
                console.log(colors.bold(colors.red('\n❌ ALL PLATFORMS FAILED')));
                process.exit(1);
            }
            
        } catch (error) {
            console.error(colors.bold(colors.red('\n❌ CRITICAL ERROR:')), error.message);
            process.exit(1);
        }
    })();
}