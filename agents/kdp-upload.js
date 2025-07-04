#!/usr/bin/env node

/**
 * KDPUpload Agent
 * 
 * Automates the process of uploading ebooks to Amazon KDP (Kindle Direct Publishing)
 * using browser automation since Amazon doesn't provide a public API.
 * 
 * Usage:
 *   agentcli call kdp.upload --pdf="path/to/ebook.pdf" --cover="path/to/cover.jpg"
 *   node agents/kdp-upload.js --book-dir="build/my-ebook" --publish
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// KDP configuration
const KDP_CONFIG = {
    urls: {
        login: 'https://kdp.amazon.com/en_US/',
        bookshelf: 'https://kdp.amazon.com/en_US/bookshelf',
        createNew: 'https://kdp.amazon.com/en_US/title-setup/kindle/new',
        paperback: 'https://kdp.amazon.com/en_US/title-setup/paperback/new'
    },
    
    categories: {
        'Business/Money': [
            'Business & Money > Entrepreneurship',
            'Business & Money > Small Business & Entrepreneurship'
        ],
        'AI/Technology': [
            'Computers & Technology > Computer Science',
            'Computers & Technology > AI & Machine Learning'
        ],
        'Health/Fitness': [
            'Health, Fitness & Dieting > Diets & Weight Loss',
            'Health, Fitness & Dieting > Exercise & Fitness'
        ],
        'Self-Help': [
            'Self-Help > Personal Transformation',
            'Self-Help > Success'
        ],
        'E-commerce': [
            'Business & Money > E-commerce',
            'Computers & Technology > Web Development'
        ]
    },
    
    royaltyOptions: {
        '35%': { min: 0.99, max: 2.98 },
        '70%': { min: 2.99, max: 9.99 }
    },
    
    territories: {
        worldwide: 'All territories',
        selected: ['US', 'UK', 'DE', 'FR', 'ES', 'IT', 'NL', 'JP', 'BR', 'CA', 'MX', 'AU', 'IN']
    }
};

// Form field selectors
const SELECTORS = {
    // Login page
    email: '#ap_email',
    password: '#ap_password',
    signInButton: '#signInSubmit',
    
    // Book details
    bookTitle: '#data-print-book-title',
    subtitle: '#data-print-book-subtitle',
    author: '#data-print-book-primary-author-first-name',
    authorLast: '#data-print-book-primary-author-last-name',
    description: '#data-print-book-description',
    
    // Publishing rights
    publishingRights: 'input[name="publishing-rights"]',
    
    // Categories
    addCategory: 'button[data-action="add-category"]',
    categorySearch: 'input[placeholder*="Search"]',
    
    // Keywords
    keywords: 'input[data-test="keywords-input"]',
    
    // Manuscript upload
    uploadManuscript: 'input[type="file"][accept*="pdf"]',
    uploadCover: 'input[type="file"][accept*="image"]',
    
    // Pricing
    priceInput: 'input[data-test="list-price-input"]',
    royaltyPlan: 'input[name="royalty-plan"]',
    
    // Actions
    saveAsDraft: 'button[data-test="save-as-draft"]',
    publishButton: 'button[data-test="publish"]',
    continueButton: 'button[data-test="continue"]'
};

class KDPUpload {
    constructor(options = {}) {
        this.email = options.email || process.env.KDP_EMAIL;
        this.password = options.password || process.env.KDP_PASSWORD;
        this.headless = options.headless !== false;
        this.screenshot = options.screenshot !== false;
        this.draftOnly = options.draftOnly || false;
        this.debugMode = options.debug || false;
        
        if (!this.email || !this.password) {
            throw new Error('KDP credentials required. Set KDP_EMAIL and KDP_PASSWORD');
        }
        
        this.browser = null;
        this.page = null;
        this.screenshotDir = 'build/kdp-screenshots';
    }

    async uploadBook(bookData, options = {}) {
        console.log('📚 Starting KDP Upload Process');
        console.log(`📖 Book: ${bookData.title}`);
        console.log(`✍️  Author: ${bookData.author}`);
        console.log('');
        
        try {
            // Initialize browser
            await this.initBrowser();
            
            // Login to KDP
            await this.login();
            
            // Navigate to create new book
            await this.navigateToCreateBook(options.paperback);
            
            // Fill book details
            await this.fillBookDetails(bookData);
            
            // Upload files
            await this.uploadFiles(bookData);
            
            // Set pricing
            await this.setPricing(bookData);
            
            // Save or publish
            const result = await this.finalizeUpload(options.publish && !this.draftOnly);
            
            console.log('\n✅ KDP Upload Complete!');
            console.log(`📊 Status: ${result.status}`);
            if (result.asin) {
                console.log(`🔖 ASIN: ${result.asin}`);
                console.log(`🔗 URL: ${result.url}`);
            }
            
            return {
                success: true,
                ...result
            };
            
        } catch (error) {
            console.error('❌ KDP Upload failed:', error.message);
            
            if (this.screenshot && this.page) {
                await this.takeScreenshot('error');
            }
            
            return {
                success: false,
                error: error.message,
                screenshots: await this.getScreenshots()
            };
            
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async initBrowser() {
        console.log('🌐 Launching browser...');
        
        this.browser = await puppeteer.launch({
            headless: this.headless,
            defaultViewport: { width: 1280, height: 800 },
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
        
        this.page = await this.browser.newPage();
        
        // Set user agent to avoid detection
        await this.page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        
        // Enable request interception for debugging
        if (this.debugMode) {
            await this.page.setRequestInterception(true);
            this.page.on('request', (request) => {
                console.log('>', request.method(), request.url());
                request.continue();
            });
        }
        
        // Create screenshot directory
        if (this.screenshot) {
            await fs.mkdir(this.screenshotDir, { recursive: true });
        }
    }

    async login() {
        console.log('🔐 Logging in to KDP...');
        
        await this.page.goto(KDP_CONFIG.urls.login, { waitUntil: 'networkidle0' });
        
        // Check if already logged in
        if (this.page.url().includes('bookshelf')) {
            console.log('   ✅ Already logged in');
            return;
        }
        
        // Fill login form
        await this.page.waitForSelector(SELECTORS.email, { visible: true });
        await this.page.type(SELECTORS.email, this.email);
        
        // Check if password field is visible (might need to click continue first)
        const passwordVisible = await this.page.$(SELECTORS.password);
        if (!passwordVisible) {
            await this.page.click('#continue');
            await this.page.waitForSelector(SELECTORS.password, { visible: true });
        }
        
        await this.page.type(SELECTORS.password, this.password);
        
        if (this.screenshot) {
            await this.takeScreenshot('login-form');
        }
        
        // Submit login
        await Promise.all([
            this.page.click(SELECTORS.signInButton),
            this.page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        
        // Check for 2FA
        if (this.page.url().includes('signin/verify')) {
            console.log('   ⚠️  2FA required. Please complete in browser.');
            if (!this.headless) {
                await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 120000 });
            } else {
                throw new Error('2FA required. Run with --no-headless to complete manually.');
            }
        }
        
        // Verify login success
        if (!this.page.url().includes('bookshelf')) {
            throw new Error('Login failed. Check credentials.');
        }
        
        console.log('   ✅ Login successful');
        
        if (this.screenshot) {
            await this.takeScreenshot('bookshelf');
        }
    }

    async navigateToCreateBook(paperback = false) {
        console.log(`📝 Creating new ${paperback ? 'paperback' : 'Kindle eBook'}...`);
        
        const createUrl = paperback ? KDP_CONFIG.urls.paperback : KDP_CONFIG.urls.createNew;
        await this.page.goto(createUrl, { waitUntil: 'networkidle0' });
        
        // Wait for form to load
        await this.page.waitForSelector(SELECTORS.bookTitle, { visible: true });
        
        console.log('   ✅ Create book form loaded');
    }

    async fillBookDetails(bookData) {
        console.log('📋 Filling book details...');
        
        // Title and subtitle
        await this.clearAndType(SELECTORS.bookTitle, bookData.title);
        if (bookData.subtitle) {
            await this.clearAndType(SELECTORS.subtitle, bookData.subtitle);
        }
        
        // Author name
        const authorParts = bookData.author.split(' ');
        const firstName = authorParts[0];
        const lastName = authorParts.slice(1).join(' ') || firstName;
        
        await this.clearAndType(SELECTORS.author, firstName);
        await this.clearAndType(SELECTORS.authorLast, lastName);
        
        // Description
        await this.clearAndType(SELECTORS.description, bookData.description || bookData.summary);
        
        // Publishing rights
        await this.page.click(`${SELECTORS.publishingRights}[value="own-copyright"]`);
        
        // Categories
        await this.selectCategories(bookData);
        
        // Keywords
        await this.addKeywords(bookData);
        
        if (this.screenshot) {
            await this.takeScreenshot('book-details');
        }
        
        // Save progress
        await this.clickAndWait(SELECTORS.saveAsDraft);
        
        console.log('   ✅ Book details saved');
    }

    async selectCategories(bookData) {
        console.log('   📂 Selecting categories...');
        
        const niche = bookData.niche || 'Business/Money';
        const categories = KDP_CONFIG.categories[niche] || KDP_CONFIG.categories['Business/Money'];
        
        for (let i = 0; i < Math.min(2, categories.length); i++) {
            try {
                // Click add category button
                await this.page.click(SELECTORS.addCategory);
                await this.page.waitForTimeout(1000);
                
                // Search for category
                const searchInput = await this.page.waitForSelector(SELECTORS.categorySearch);
                await searchInput.type(categories[i]);
                await this.page.waitForTimeout(1500);
                
                // Select first result
                const firstResult = await this.page.$('.category-browser-result');
                if (firstResult) {
                    await firstResult.click();
                    console.log(`      ✅ Added: ${categories[i]}`);
                }
                
            } catch (error) {
                console.log(`      ⚠️  Failed to add category: ${categories[i]}`);
            }
        }
    }

    async addKeywords(bookData) {
        console.log('   🏷️  Adding keywords...');
        
        const keywords = bookData.keywords || [];
        const keywordInputs = await this.page.$$(SELECTORS.keywords);
        
        for (let i = 0; i < Math.min(7, keywords.length); i++) {
            if (keywordInputs[i]) {
                await keywordInputs[i].type(keywords[i]);
                console.log(`      ✅ Keyword ${i + 1}: ${keywords[i]}`);
            }
        }
    }

    async uploadFiles(bookData) {
        console.log('📤 Uploading files...');
        
        // Navigate to content section
        await this.clickAndWait(SELECTORS.continueButton);
        await this.page.waitForSelector(SELECTORS.uploadManuscript, { visible: true });
        
        // Upload manuscript
        if (bookData.pdfPath) {
            console.log('   📄 Uploading manuscript...');
            const manuscriptInput = await this.page.$(SELECTORS.uploadManuscript);
            await manuscriptInput.uploadFile(bookData.pdfPath);
            
            // Wait for upload to complete
            await this.page.waitForTimeout(5000);
            console.log('   ✅ Manuscript uploaded');
        }
        
        // Upload cover
        if (bookData.coverPath) {
            console.log('   🎨 Uploading cover...');
            const coverInput = await this.page.$(SELECTORS.uploadCover);
            await coverInput.uploadFile(bookData.coverPath);
            
            // Wait for upload to complete
            await this.page.waitForTimeout(5000);
            console.log('   ✅ Cover uploaded');
        }
        
        if (this.screenshot) {
            await this.takeScreenshot('files-uploaded');
        }
        
        // Save progress
        await this.clickAndWait(SELECTORS.saveAsDraft);
    }

    async setPricing(bookData) {
        console.log('💰 Setting pricing...');
        
        // Navigate to pricing section
        await this.clickAndWait(SELECTORS.continueButton);
        await this.page.waitForSelector(SELECTORS.priceInput, { visible: true });
        
        const price = bookData.price || 9.99;
        
        // Select royalty plan
        const royaltyPlan = price >= 2.99 && price <= 9.99 ? '70' : '35';
        await this.page.click(`${SELECTORS.royaltyPlan}[value="${royaltyPlan}"]`);
        console.log(`   📊 Royalty plan: ${royaltyPlan}%`);
        
        // Set price
        await this.clearAndType(SELECTORS.priceInput, price.toString());
        console.log(`   💵 Price: $${price}`);
        
        // Territory rights (default to worldwide)
        const territoryRadio = await this.page.$('input[value="all-territories"]');
        if (territoryRadio) {
            await territoryRadio.click();
            console.log('   🌍 Territory: Worldwide');
        }
        
        // KDP Select enrollment (optional)
        if (bookData.kdpSelect) {
            const kdpSelectCheckbox = await this.page.$('input[name="kdp-select-enrollment"]');
            if (kdpSelectCheckbox) {
                await kdpSelectCheckbox.click();
                console.log('   📚 Enrolled in KDP Select');
            }
        }
        
        if (this.screenshot) {
            await this.takeScreenshot('pricing-set');
        }
        
        // Save progress
        await this.clickAndWait(SELECTORS.saveAsDraft);
    }

    async finalizeUpload(publish = false) {
        console.log(`\n🏁 Finalizing upload (${publish ? 'Publishing' : 'Saving as draft'})...`);
        
        if (publish && !this.draftOnly) {
            // Click publish button
            const publishBtn = await this.page.$(SELECTORS.publishButton);
            if (publishBtn) {
                await this.clickAndWait(SELECTORS.publishButton);
                
                // Wait for confirmation
                await this.page.waitForTimeout(5000);
                
                // Check for success message
                const successMessage = await this.page.$('.success-message');
                if (successMessage) {
                    console.log('   ✅ Book published successfully!');
                    
                    // Extract ASIN if available
                    const asin = await this.extractASIN();
                    
                    return {
                        status: 'published',
                        asin,
                        url: asin ? `https://www.amazon.com/dp/${asin}` : null,
                        message: 'Book is live on Amazon KDP'
                    };
                }
            }
        }
        
        // Save as draft
        console.log('   💾 Saving as draft...');
        
        return {
            status: 'draft',
            message: 'Book saved as draft in KDP',
            nextSteps: [
                'Review book details in KDP dashboard',
                'Preview the book',
                'Click publish when ready'
            ]
        };
    }

    async extractASIN() {
        try {
            // Look for ASIN in various places
            const asinElement = await this.page.$('[data-asin]');
            if (asinElement) {
                return await asinElement.evaluate(el => el.getAttribute('data-asin'));
            }
            
            // Check URL
            const url = this.page.url();
            const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
            if (asinMatch) {
                return asinMatch[1];
            }
            
            // Check page content
            const pageContent = await this.page.content();
            const contentMatch = pageContent.match(/ASIN[:\s]+([A-Z0-9]{10})/);
            if (contentMatch) {
                return contentMatch[1];
            }
            
        } catch (error) {
            console.log('   ⚠️  Could not extract ASIN');
        }
        
        return null;
    }

    async clearAndType(selector, text) {
        const element = await this.page.waitForSelector(selector, { visible: true });
        await element.click({ clickCount: 3 }); // Select all
        await element.type(text);
    }

    async clickAndWait(selector, options = {}) {
        const element = await this.page.waitForSelector(selector, { visible: true });
        await Promise.all([
            element.click(),
            this.page.waitForNavigation({ waitUntil: 'networkidle0', ...options })
        ]);
    }

    async takeScreenshot(name) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}-${name}.png`;
        const filepath = path.join(this.screenshotDir, filename);
        
        await this.page.screenshot({ path: filepath, fullPage: true });
        console.log(`   📸 Screenshot: ${filename}`);
    }

    async getScreenshots() {
        try {
            const files = await fs.readdir(this.screenshotDir);
            return files.filter(f => f.endsWith('.png'));
        } catch {
            return [];
        }
    }

    async loadBookData(bookDir) {
        const bookData = {
            title: '',
            subtitle: '',
            author: '',
            description: '',
            keywords: [],
            niche: 'Business/Money',
            price: 9.99,
            pdfPath: null,
            coverPath: null
        };
        
        // Load metadata
        try {
            const metadataPath = path.join(bookDir, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            Object.assign(bookData, metadata);
        } catch {
            console.warn('No metadata.json found');
        }
        
        // Find PDF
        try {
            const files = await fs.readdir(path.join(bookDir, 'dist'));
            const pdfFile = files.find(f => f.endsWith('.pdf'));
            if (pdfFile) {
                bookData.pdfPath = path.join(bookDir, 'dist', pdfFile);
            }
        } catch {
            console.warn('No PDF found in dist/');
        }
        
        // Find cover
        try {
            const coverPath = path.join(bookDir, 'assets', 'images', 'cover.jpg');
            await fs.access(coverPath);
            bookData.coverPath = coverPath;
        } catch {
            try {
                const coverPath = path.join(bookDir, 'assets', 'images', 'cover.png');
                await fs.access(coverPath);
                bookData.coverPath = coverPath;
            } catch {
                console.warn('No cover image found');
            }
        }
        
        return bookData;
    }

    async validateBookData(bookData) {
        const errors = [];
        
        if (!bookData.title) errors.push('Title is required');
        if (!bookData.author) errors.push('Author is required');
        if (!bookData.description || bookData.description.length < 10) {
            errors.push('Description must be at least 10 characters');
        }
        if (!bookData.pdfPath) errors.push('PDF file is required');
        if (!bookData.coverPath) errors.push('Cover image is required');
        
        if (bookData.keywords.length === 0) {
            console.warn('⚠️  No keywords provided. Consider adding for better discoverability.');
        }
        
        if (errors.length > 0) {
            throw new Error(`Validation failed:\n${errors.join('\n')}`);
        }
        
        return true;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options['book-dir'] && !options.pdf) {
        console.error('Usage: kdp-upload.js --book-dir="path/to/book" [options]');
        console.error('   or: kdp-upload.js --pdf="ebook.pdf" --cover="cover.jpg" --title="My Book"');
        console.error('\nOptions:');
        console.error('  --publish        Publish immediately (default: save as draft)');
        console.error('  --paperback      Create paperback instead of Kindle ebook');
        console.error('  --no-headless    Show browser window');
        console.error('  --debug          Enable debug mode');
        console.error('  --price          Set book price (default: 9.99)');
        console.error('  --kdp-select     Enroll in KDP Select');
        process.exit(1);
    }
    
    const uploader = new KDPUpload({
        headless: options.headless !== 'false',
        debug: options.debug === true,
        draftOnly: options['draft-only'] === true
    });
    
    (async () => {
        try {
            let bookData;
            
            if (options['book-dir']) {
                // Load from book directory
                bookData = await uploader.loadBookData(options['book-dir']);
            } else {
                // Use command line arguments
                bookData = {
                    title: options.title || 'Untitled Book',
                    subtitle: options.subtitle,
                    author: options.author || 'Unknown Author',
                    description: options.description || 'A great book.',
                    keywords: options.keywords ? options.keywords.split(',') : [],
                    niche: options.niche || 'Business/Money',
                    price: parseFloat(options.price) || 9.99,
                    pdfPath: options.pdf,
                    coverPath: options.cover,
                    kdpSelect: options['kdp-select'] === true
                };
            }
            
            // Validate
            await uploader.validateBookData(bookData);
            
            // Upload
            const result = await uploader.uploadBook(bookData, {
                publish: options.publish === true,
                paperback: options.paperback === true
            });
            
            console.log('\nResult:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = KDPUpload;