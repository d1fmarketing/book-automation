/**
 * HTML Validation Test Suite
 * 
 * Tests HTML output for validity, structure, and quality
 */

const fs = require('fs').promises;
const path = require('path');
const { JSDOM } = require('jsdom');
const validator = require('html-validator');
const chalk = require('chalk');

class HTMLValidationSuite {
    constructor(options = {}) {
        this.options = {
            thresholds: {
                errors: 0,
                warnings: 5,
                minHeadings: 5,
                maxHeadingLevel: 3,
                minParagraphs: 20,
                minImages: 1,
                maxBrokenLinks: 0,
                maxEmptyElements: 3
            },
            ...options
        };
        
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: [],
            metrics: {},
            failures: []
        };
    }
    
    async run(workDir) {
        const htmlDir = path.join(workDir, 'html');
        const htmlFile = path.join(htmlDir, 'index.html');
        
        try {
            // Check if HTML exists
            const htmlContent = await fs.readFile(htmlFile, 'utf8');
            
            // Run all tests
            await this.testHTMLValidity(htmlContent, htmlFile);
            await this.testDocumentStructure(htmlContent);
            await this.testHeadingHierarchy(htmlContent);
            await this.testImageIntegrity(htmlContent, htmlDir);
            await this.testLinkIntegrity(htmlContent);
            await this.testMetaTags(htmlContent);
            await this.testAccessibilityBasics(htmlContent);
            await this.testContentQuality(htmlContent);
            
            return this.results;
            
        } catch (error) {
            this.addFailure('HTML File Access', `Cannot read HTML file: ${error.message}`);
            return this.results;
        }
    }
    
    async testHTMLValidity(htmlContent, filePath) {
        this.results.total++;
        console.log('  🔍 Testing HTML validity...');
        
        try {
            const result = await validator({
                data: htmlContent,
                format: 'json'
            });
            
            const errors = result.messages.filter(m => m.type === 'error');
            const warnings = result.messages.filter(m => m.type === 'warning' || m.type === 'info');
            
            this.results.metrics.htmlErrors = errors.length;
            this.results.metrics.htmlWarnings = warnings.length;
            
            if (errors.length <= this.options.thresholds.errors) {
                this.results.passed++;
                console.log(chalk.green(`    ✅ HTML valid (${errors.length} errors)`));
            } else {
                this.results.failed++;
                this.addFailure('HTML Validity', `Found ${errors.length} errors (max: ${this.options.thresholds.errors})`);
                
                if (this.options.verbose) {
                    errors.slice(0, 5).forEach(err => {
                        console.log(chalk.red(`      Line ${err.line}: ${err.message}`));
                    });
                }
            }
            
            if (warnings.length > this.options.thresholds.warnings) {
                console.log(chalk.yellow(`    ⚠️  ${warnings.length} warnings (threshold: ${this.options.thresholds.warnings})`));
            }
            
        } catch (error) {
            this.results.failed++;
            this.addFailure('HTML Validity', `Validation failed: ${error.message}`);
        }
    }
    
    async testDocumentStructure(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing document structure...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const checks = [
            { 
                name: 'DOCTYPE', 
                test: () => htmlContent.startsWith('<!DOCTYPE html>'),
                message: 'Missing or invalid DOCTYPE'
            },
            {
                name: 'Title',
                test: () => document.title && document.title.length > 0,
                message: 'Missing <title> tag'
            },
            {
                name: 'Meta Charset',
                test: () => document.querySelector('meta[charset]'),
                message: 'Missing charset meta tag'
            },
            {
                name: 'Language',
                test: () => document.documentElement.getAttribute('lang'),
                message: 'Missing lang attribute on <html>'
            },
            {
                name: 'Main Content',
                test: () => document.querySelector('main, [role="main"]'),
                message: 'Missing <main> element or role="main"'
            }
        ];
        
        let structurePassed = true;
        
        checks.forEach(check => {
            if (check.test()) {
                console.log(chalk.green(`    ✅ ${check.name}`));
            } else {
                structurePassed = false;
                console.log(chalk.red(`    ❌ ${check.name}: ${check.message}`));
            }
        });
        
        if (structurePassed) {
            this.results.passed++;
        } else {
            this.results.failed++;
            this.addFailure('Document Structure', 'Missing required structural elements');
        }
    }
    
    async testHeadingHierarchy(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing heading hierarchy...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        this.results.metrics.headingCount = headings.length;
        
        let issues = [];
        
        // Check minimum headings
        if (headings.length < this.options.thresholds.minHeadings) {
            issues.push(`Only ${headings.length} headings found (min: ${this.options.thresholds.minHeadings})`);
        }
        
        // Check heading hierarchy
        let lastLevel = 0;
        let skippedLevels = false;
        
        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName[1]);
            
            if (level > lastLevel + 1 && lastLevel !== 0) {
                skippedLevels = true;
                issues.push(`Skipped heading level at index ${index}: h${lastLevel} → h${level}`);
            }
            
            lastLevel = level;
        });
        
        // Check for multiple h1s
        const h1Count = document.querySelectorAll('h1').length;
        if (h1Count > 1) {
            issues.push(`Multiple h1 tags found (${h1Count})`);
        } else if (h1Count === 0) {
            issues.push('No h1 tag found');
        }
        
        if (issues.length === 0) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Heading hierarchy valid (${headings.length} headings)`));
        } else {
            this.results.failed++;
            this.addFailure('Heading Hierarchy', issues.join('; '));
            issues.forEach(issue => {
                console.log(chalk.red(`    ❌ ${issue}`));
            });
        }
    }
    
    async testImageIntegrity(htmlContent, htmlDir) {
        this.results.total++;
        console.log('  🔍 Testing image integrity...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const images = Array.from(document.querySelectorAll('img'));
        this.results.metrics.imageCount = images.length;
        
        let missingAlt = 0;
        let brokenImages = 0;
        let emptyAlt = 0;
        
        for (const img of images) {
            // Check alt text
            if (!img.hasAttribute('alt')) {
                missingAlt++;
            } else if (img.getAttribute('alt').trim() === '') {
                emptyAlt++;
            }
            
            // Check if image exists (for local images)
            const src = img.getAttribute('src');
            if (src && !src.startsWith('data:') && !src.startsWith('http')) {
                const imagePath = path.join(htmlDir, src);
                try {
                    await fs.stat(imagePath);
                } catch {
                    brokenImages++;
                }
            }
        }
        
        const issues = [];
        
        if (images.length < this.options.thresholds.minImages) {
            issues.push(`Only ${images.length} images found (min: ${this.options.thresholds.minImages})`);
        }
        
        if (missingAlt > 0) {
            issues.push(`${missingAlt} images missing alt attribute`);
        }
        
        if (emptyAlt > images.length / 2) {
            issues.push(`${emptyAlt} images have empty alt text`);
        }
        
        if (brokenImages > 0) {
            issues.push(`${brokenImages} broken image references`);
        }
        
        if (issues.length === 0) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Image integrity good (${images.length} images)`));
        } else {
            this.results.failed++;
            this.addFailure('Image Integrity', issues.join('; '));
            issues.forEach(issue => {
                console.log(chalk.red(`    ❌ ${issue}`));
            });
        }
    }
    
    async testLinkIntegrity(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing link integrity...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const links = Array.from(document.querySelectorAll('a'));
        this.results.metrics.linkCount = links.length;
        
        let emptyLinks = 0;
        let noHref = 0;
        let fragmentOnly = 0;
        let external = 0;
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            
            if (!href) {
                noHref++;
            } else if (href === '' || href === '#') {
                emptyLinks++;
            } else if (href.startsWith('#')) {
                fragmentOnly++;
            } else if (href.startsWith('http')) {
                external++;
            }
        });
        
        this.results.metrics.externalLinks = external;
        
        const issues = [];
        
        if (noHref > 0) {
            issues.push(`${noHref} links without href attribute`);
        }
        
        if (emptyLinks > this.options.thresholds.maxBrokenLinks) {
            issues.push(`${emptyLinks} empty links found`);
        }
        
        if (issues.length === 0) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Link integrity good (${links.length} links, ${external} external)`));
        } else {
            this.results.failed++;
            this.addFailure('Link Integrity', issues.join('; '));
            issues.forEach(issue => {
                console.log(chalk.red(`    ❌ ${issue}`));
            });
        }
    }
    
    async testMetaTags(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing meta tags...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const requiredMeta = [
            { name: 'description', selector: 'meta[name="description"]' },
            { name: 'viewport', selector: 'meta[name="viewport"]' },
            { name: 'author', selector: 'meta[name="author"]' }
        ];
        
        const recommendedMeta = [
            { name: 'og:title', selector: 'meta[property="og:title"]' },
            { name: 'og:description', selector: 'meta[property="og:description"]' },
            { name: 'twitter:card', selector: 'meta[name="twitter:card"]' }
        ];
        
        let missingRequired = [];
        let missingRecommended = [];
        
        requiredMeta.forEach(meta => {
            if (!document.querySelector(meta.selector)) {
                missingRequired.push(meta.name);
            }
        });
        
        recommendedMeta.forEach(meta => {
            if (!document.querySelector(meta.selector)) {
                missingRecommended.push(meta.name);
            }
        });
        
        if (missingRequired.length === 0) {
            this.results.passed++;
            console.log(chalk.green('    ✅ All required meta tags present'));
            
            if (missingRecommended.length > 0) {
                console.log(chalk.yellow(`    ⚠️  Missing recommended: ${missingRecommended.join(', ')}`));
            }
        } else {
            this.results.failed++;
            this.addFailure('Meta Tags', `Missing required: ${missingRequired.join(', ')}`);
            console.log(chalk.red(`    ❌ Missing required: ${missingRequired.join(', ')}`));
        }
    }
    
    async testAccessibilityBasics(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing basic accessibility...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        const checks = [
            {
                name: 'Skip to content link',
                test: () => document.querySelector('a[href="#main"], a[href="#content"]'),
                severity: 'warning'
            },
            {
                name: 'Form labels',
                test: () => {
                    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
                    if (inputs.length === 0) return true;
                    
                    return Array.from(inputs).every(input => 
                        input.getAttribute('aria-label') || 
                        input.getAttribute('aria-labelledby') ||
                        document.querySelector(`label[for="${input.id}"]`)
                    );
                },
                severity: 'error'
            },
            {
                name: 'Button text',
                test: () => {
                    const buttons = document.querySelectorAll('button');
                    return Array.from(buttons).every(btn => 
                        btn.textContent.trim() || btn.getAttribute('aria-label')
                    );
                },
                severity: 'error'
            }
        ];
        
        let failed = false;
        const issues = [];
        
        checks.forEach(check => {
            if (!check.test()) {
                if (check.severity === 'error') {
                    failed = true;
                    issues.push(check.name);
                    console.log(chalk.red(`    ❌ ${check.name}`));
                } else {
                    console.log(chalk.yellow(`    ⚠️  ${check.name}`));
                }
            } else {
                console.log(chalk.green(`    ✅ ${check.name}`));
            }
        });
        
        if (!failed) {
            this.results.passed++;
        } else {
            this.results.failed++;
            this.addFailure('Accessibility Basics', `Failed: ${issues.join(', ')}`);
        }
    }
    
    async testContentQuality(htmlContent) {
        this.results.total++;
        console.log('  🔍 Testing content quality...');
        
        const dom = new JSDOM(htmlContent);
        const document = dom.window.document;
        
        // Remove script and style content
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        const textContent = document.body.textContent;
        const words = textContent.split(/\s+/).filter(w => w.length > 0);
        
        this.results.metrics.wordCount = words.length;
        this.results.metrics.paragraphCount = document.querySelectorAll('p').length;
        
        const issues = [];
        
        // Check minimum content
        if (words.length < 100) {
            issues.push(`Only ${words.length} words found`);
        }
        
        if (document.querySelectorAll('p').length < this.options.thresholds.minParagraphs) {
            issues.push(`Only ${document.querySelectorAll('p').length} paragraphs (min: ${this.options.thresholds.minParagraphs})`);
        }
        
        // Check for Lorem Ipsum
        if (textContent.toLowerCase().includes('lorem ipsum')) {
            issues.push('Contains placeholder text (Lorem Ipsum)');
        }
        
        // Check for empty elements
        const emptyElements = Array.from(document.querySelectorAll('p, div, span'))
            .filter(el => el.textContent.trim() === '' && el.children.length === 0);
        
        if (emptyElements.length > this.options.thresholds.maxEmptyElements) {
            issues.push(`${emptyElements.length} empty elements found`);
        }
        
        if (issues.length === 0) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Content quality good (${words.length} words)`));
        } else {
            this.results.failed++;
            this.addFailure('Content Quality', issues.join('; '));
            issues.forEach(issue => {
                console.log(chalk.red(`    ❌ ${issue}`));
            });
        }
    }
    
    addFailure(test, message) {
        this.results.failures.push({
            test,
            message,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = HTMLValidationSuite;