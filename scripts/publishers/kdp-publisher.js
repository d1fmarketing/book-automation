#!/usr/bin/env node

/**
 * KDP (Kindle Direct Publishing) Integration
 * Automates book publishing to Amazon KDP
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const crypto = require('crypto');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
};

class KDPPublisher {
    constructor(options = {}) {
        this.credentials = options.credentials || {};
        this.metadata = options.metadata || {};
        this.dryRun = options.dryRun || false;
        this.headless = options.headless !== false;
        this.browser = null;
        this.page = null;
    }

    async loadMetadata(metadataPath) {
        const content = await fs.readFile(metadataPath, 'utf8');
        this.metadata = yaml.load(content);
        return this.metadata;
    }

    async loadCredentials(credPath) {
        // In production, use encrypted credentials
        const content = await fs.readFile(credPath, 'utf8');
        this.credentials = JSON.parse(content);
        return this.credentials;
    }

    async launch() {
        console.log(colors.blue('🚀 Launching KDP Publisher...'));
        
        this.browser = await puppeteer.launch({
            headless: this.headless,
            defaultViewport: { width: 1920, height: 1080 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    }

    async login() {
        console.log(colors.blue('🔐 Logging into KDP...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would login with:', this.credentials.email));
            return true;
        }

        try {
            await this.page.goto('https://kdp.amazon.com', { waitUntil: 'networkidle2' });
            
            // Click sign in
            await this.page.click('a[data-action="a-signin"]');
            
            // Enter email
            await this.page.waitForSelector('#ap_email');
            await this.page.type('#ap_email', this.credentials.email);
            await this.page.click('#continue');
            
            // Enter password
            await this.page.waitForSelector('#ap_password');
            await this.page.type('#ap_password', this.credentials.password);
            await this.page.click('#signInSubmit');
            
            // Wait for dashboard
            await this.page.waitForSelector('.bookshelf-container', { timeout: 30000 });
            
            console.log(colors.green('✅ Successfully logged into KDP'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ Login failed:'), error.message);
            return false;
        }
    }

    async createNewTitle() {
        console.log(colors.blue('📚 Creating new title...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would create new title'));
            return true;
        }

        try {
            // Click "Create" button
            await this.page.click('button[data-action="create-new-title"]');
            
            // Select Paperback
            await this.page.waitForSelector('input[value="paperback"]');
            await this.page.click('input[value="paperback"]');
            
            // Continue
            await this.page.click('button[type="submit"]');
            
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to create new title:'), error.message);
            return false;
        }
    }

    async fillBookDetails() {
        console.log(colors.blue('📝 Filling book details...'));
        
        const book = this.metadata;
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would fill details:'));
            console.log(colors.gray(`    Title: ${book.title}`));
            console.log(colors.gray(`    Author: ${book.author}`));
            console.log(colors.gray(`    ISBN: ${book.isbn}`));
            return true;
        }

        try {
            // Language
            await this.page.select('#data-print-book-language', book.language || 'en');
            
            // Book Title
            await this.page.type('#data-print-book-title', book.title);
            
            // Subtitle (if any)
            if (book.subtitle) {
                await this.page.type('#data-print-book-subtitle', book.subtitle);
            }
            
            // Series (if any)
            if (book.series) {
                await this.page.type('#data-print-book-series-title', book.series.name);
                await this.page.type('#data-print-book-series-number', book.series.number.toString());
            }
            
            // Edition number
            await this.page.type('#data-print-book-edition-number', book.edition || '1');
            
            // Author
            await this.page.type('#data-print-book-primary-author-first-name', book.author_first || book.author.split(' ')[0]);
            await this.page.type('#data-print-book-primary-author-last-name', book.author_last || book.author.split(' ').slice(1).join(' '));
            
            // Publisher
            await this.page.type('#data-print-book-publisher', book.publisher || book.author);
            
            // Description
            await this.page.type('#data-print-book-description', book.description);
            
            // Publishing rights
            await this.page.click('input[value="own-copyright"]');
            
            // Keywords
            if (book.keywords && book.keywords.length > 0) {
                for (let i = 0; i < Math.min(7, book.keywords.length); i++) {
                    await this.page.type(`#data-print-book-keywords-${i}`, book.keywords[i]);
                }
            }
            
            // Categories
            await this.selectCategories(book.categories || []);
            
            // Age range (if specified)
            if (book.age_range) {
                await this.page.type('#data-print-book-age-range-min', book.age_range.min.toString());
                await this.page.type('#data-print-book-age-range-max', book.age_range.max.toString());
            }
            
            console.log(colors.green('✅ Book details filled'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to fill book details:'), error.message);
            return false;
        }
    }

    async selectCategories(categories) {
        // KDP allows up to 2 categories
        for (let i = 0; i < Math.min(2, categories.length); i++) {
            await this.page.click(`#category-chooser-${i}`);
            // Navigate category tree
            // This is simplified - real implementation would navigate the tree
            await this.page.waitForTimeout(1000);
        }
    }

    async uploadManuscript(pdfPath) {
        console.log(colors.blue('📄 Uploading manuscript...'));
        
        if (this.dryRun) {
            console.log(colors.yellow(`  [DRY RUN] Would upload: ${pdfPath}`));
            const stats = await fs.stat(pdfPath);
            console.log(colors.gray(`    File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`));
            return true;
        }

        try {
            // Upload interior file
            const fileInput = await this.page.$('input[type="file"][name="interior-file"]');
            await fileInput.uploadFile(pdfPath);
            
            // Wait for processing
            await this.page.waitForSelector('.upload-success', { timeout: 120000 });
            
            console.log(colors.green('✅ Manuscript uploaded successfully'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to upload manuscript:'), error.message);
            return false;
        }
    }

    async uploadCover(coverPath) {
        console.log(colors.blue('🎨 Uploading cover...'));
        
        if (this.dryRun) {
            console.log(colors.yellow(`  [DRY RUN] Would upload cover: ${coverPath}`));
            return true;
        }

        try {
            // Check if using Cover Creator or uploading
            if (coverPath) {
                const coverInput = await this.page.$('input[type="file"][name="cover-file"]');
                await coverInput.uploadFile(coverPath);
                
                await this.page.waitForSelector('.cover-upload-success', { timeout: 60000 });
                console.log(colors.green('✅ Cover uploaded successfully'));
            } else {
                // Use Cover Creator
                await this.page.click('button[data-action="launch-cover-creator"]');
                console.log(colors.yellow('⚠️  Please complete cover in Cover Creator'));
            }
            
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to upload cover:'), error.message);
            return false;
        }
    }

    async setISBN() {
        console.log(colors.blue('📖 Setting ISBN...'));
        
        if (this.dryRun) {
            console.log(colors.yellow(`  [DRY RUN] Would set ISBN: ${this.metadata.isbn || 'Free KDP ISBN'}`));
            return true;
        }

        try {
            if (this.metadata.isbn) {
                // Use own ISBN
                await this.page.click('input[value="own-isbn"]');
                await this.page.type('#data-print-book-isbn', this.metadata.isbn);
                
                if (this.metadata.imprint) {
                    await this.page.type('#data-print-book-imprint', this.metadata.imprint);
                }
            } else {
                // Get free KDP ISBN
                await this.page.click('input[value="free-kdp-isbn"]');
            }
            
            console.log(colors.green('✅ ISBN configured'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to set ISBN:'), error.message);
            return false;
        }
    }

    async setPricing() {
        console.log(colors.blue('💰 Setting pricing...'));
        
        const pricing = this.metadata.pricing || {};
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would set pricing:'));
            console.log(colors.gray(`    US Price: $${pricing.us || '9.99'}`));
            console.log(colors.gray(`    Royalty: ${pricing.royalty || '60'}%`));
            return true;
        }

        try {
            // Select territories
            if (pricing.territories === 'all') {
                await this.page.click('input[value="all-territories"]');
            } else {
                await this.page.click('input[value="selected-territories"]');
                // Select specific territories
            }
            
            // Set primary marketplace price (US)
            await this.page.type('#data-print-book-us-price', (pricing.us || '9.99').toString());
            
            // Let KDP calculate other marketplace prices
            await this.page.click('button[data-action="calculate-prices"]');
            
            // Wait for calculation
            await this.page.waitForTimeout(2000);
            
            console.log(colors.green('✅ Pricing set'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to set pricing:'), error.message);
            return false;
        }
    }

    async previewBook() {
        console.log(colors.blue('👁️  Previewing book...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would preview book'));
            return true;
        }

        try {
            // Launch previewer
            await this.page.click('button[data-action="launch-previewer"]');
            
            // Wait for previewer to load
            await this.page.waitForSelector('.previewer-container', { timeout: 30000 });
            
            console.log(colors.green('✅ Preview launched'));
            console.log(colors.yellow('  ℹ️  Please review the preview and close when done'));
            
            // In automated mode, we'd check for issues programmatically
            await this.page.waitForTimeout(5000);
            
            return true;
        } catch (error) {
            console.error(colors.red('❌ Failed to preview:'), error.message);
            return false;
        }
    }

    async publish() {
        console.log(colors.blue('🚀 Publishing book...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would publish book'));
            console.log(colors.green('\n✅ Dry run completed successfully!'));
            return true;
        }

        try {
            // Confirm all details
            await this.page.click('input[id="terms-checkbox"]');
            
            // Publish
            await this.page.click('button[data-action="publish-book"]');
            
            // Wait for confirmation
            await this.page.waitForSelector('.publish-success', { timeout: 60000 });
            
            console.log(colors.green('\n🎉 Book published successfully!'));
            
            // Get ASIN
            const asin = await this.page.$eval('.book-asin', el => el.textContent);
            console.log(colors.blue(`   ASIN: ${asin}`));
            
            return { success: true, asin };
        } catch (error) {
            console.error(colors.red('❌ Failed to publish:'), error.message);
            return { success: false, error: error.message };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async publishBook(options = {}) {
        try {
            await this.launch();
            
            if (!this.dryRun) {
                const loggedIn = await this.login();
                if (!loggedIn) {
                    throw new Error('Failed to login to KDP');
                }
            }
            
            // Create new title
            await this.createNewTitle();
            
            // Fill details
            await this.fillBookDetails();
            
            // Upload files
            if (options.manuscriptPath) {
                await this.uploadManuscript(options.manuscriptPath);
            }
            
            if (options.coverPath) {
                await this.uploadCover(options.coverPath);
            }
            
            // ISBN
            await this.setISBN();
            
            // Pricing
            await this.setPricing();
            
            // Preview
            if (!options.skipPreview) {
                await this.previewBook();
            }
            
            // Publish
            const result = await this.publish();
            
            return result;
        } catch (error) {
            console.error(colors.red('❌ Publishing failed:'), error.message);
            throw error;
        } finally {
            await this.close();
        }
    }

    // Utility methods
    async updateBookPrice(asin, newPrice) {
        console.log(colors.blue(`💰 Updating price for ASIN ${asin}...`));
        // Implementation for price updates
    }

    async checkSalesReport() {
        console.log(colors.blue('📊 Checking sales report...'));
        // Implementation for sales reporting
    }

    async updateBookDetails(asin, updates) {
        console.log(colors.blue(`📝 Updating book details for ASIN ${asin}...`));
        // Implementation for updating existing books
    }
}

module.exports = KDPPublisher;

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
        .option('manuscript', {
            alias: 'p',
            description: 'Path to PDF manuscript',
            type: 'string',
            default: 'build/dist/ebook.pdf'
        })
        .option('cover', {
            alias: 'c',
            description: 'Path to cover image',
            type: 'string'
        })
        .option('credentials', {
            description: 'Path to KDP credentials',
            type: 'string',
            default: 'config/kdp-credentials.json'
        })
        .option('dry-run', {
            alias: 'd',
            description: 'Perform a dry run without publishing',
            type: 'boolean',
            default: false
        })
        .option('headless', {
            description: 'Run in headless mode',
            type: 'boolean',
            default: false
        })
        .help()
        .argv;
    
    (async () => {
        const publisher = new KDPPublisher({
            dryRun: argv.dryRun,
            headless: argv.headless
        });
        
        try {
            // Load metadata
            await publisher.loadMetadata(argv.metadata);
            
            // Load credentials (if not dry run)
            if (!argv.dryRun) {
                await publisher.loadCredentials(argv.credentials);
            }
            
            // Publish
            const result = await publisher.publishBook({
                manuscriptPath: argv.manuscript,
                coverPath: argv.cover,
                skipPreview: argv.dryRun
            });
            
            if (result.success) {
                console.log(colors.green('\n✅ Publishing completed successfully!'));
                if (result.asin) {
                    console.log(colors.blue(`   ASIN: ${result.asin}`));
                }
            }
        } catch (error) {
            console.error(colors.red('\n❌ Publishing failed:'), error.message);
            process.exit(1);
        }
    })();
}