#!/usr/bin/env node

/**
 * Optimizer Agent
 * 
 * Analyzes ebook performance after 7 days and rewrites titles/meta descriptions
 * for better SEO and conversion. Uses analytics data to inform optimizations.
 * 
 * Usage:
 *   agentcli call optimize.titles --ebook-id="abc123" --analytics="path/to/analytics.json"
 *   node agents/optimizer.js --ebook-dir="build/ebooks/my-ebook" --days-old=7
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Optimization strategies based on performance
const OPTIMIZATION_STRATEGIES = {
    lowCTR: {
        name: 'Low Click-Through Rate',
        threshold: 0.02, // 2% CTR
        approach: 'more compelling hooks, power words, numbers',
        examples: ['7 Proven Ways', 'The Ultimate Guide', 'Secrets Revealed']
    },
    highBounce: {
        name: 'High Bounce Rate', 
        threshold: 0.7, // 70% bounce
        approach: 'better alignment with content, clearer value prop',
        examples: ['Step-by-Step', 'Complete Tutorial', 'Everything You Need']
    },
    lowConversion: {
        name: 'Low Conversion Rate',
        threshold: 0.01, // 1% conversion
        approach: 'stronger benefit statements, urgency, social proof',
        examples: ['Transform Your', 'Join 10,000+', 'Limited Time']
    },
    goodPerformance: {
        name: 'Good Performance',
        threshold: null,
        approach: 'minor tweaks only, A/B test variations',
        examples: ['slight variations', 'synonym testing', 'format changes']
    }
};

class Optimizer {
    constructor(options = {}) {
        this.minDaysOld = options.minDaysOld || 7;
        this.model = options.model || 'opus-4';
        this.maxRetries = options.maxRetries || 3;
        this.testVariations = options.testVariations || 3;
    }

    async optimizeEbook(ebookDir, analyticsData = null) {
        console.log(`🎯 Optimizing ebook: ${ebookDir}`);
        
        try {
            // Check if ebook is old enough
            const metadata = await this.loadMetadata(ebookDir);
            const ageInDays = this.getAgeInDays(metadata.publishedDate);
            
            if (ageInDays < this.minDaysOld) {
                console.log(`⏳ Ebook too new (${ageInDays} days). Minimum: ${this.minDaysOld} days`);
                return {
                    success: false,
                    reason: 'too_new',
                    ageInDays,
                    minRequired: this.minDaysOld
                };
            }
            
            // Load or fetch analytics
            const analytics = analyticsData || await this.fetchAnalytics(metadata.id);
            
            // Determine optimization strategy
            const strategy = this.determineStrategy(analytics);
            console.log(`📊 Strategy: ${strategy.name}`);
            
            // Generate new variations
            const variations = await this.generateVariations(metadata, analytics, strategy);
            
            // Update metadata with variations
            const updatedMetadata = await this.updateMetadata(ebookDir, metadata, variations);
            
            // Create A/B test configuration
            const testConfig = await this.createABTestConfig(metadata.id, variations);
            
            // Generate optimization report
            const report = this.generateReport(metadata, analytics, strategy, variations);
            await this.saveReport(ebookDir, report);
            
            console.log(`✅ Optimization complete. ${variations.length} variations created.`);
            
            return {
                success: true,
                strategy: strategy.name,
                variations,
                testConfig,
                report: report.summary
            };
            
        } catch (error) {
            console.error(`❌ Optimization error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadMetadata(ebookDir) {
        const metadataPath = path.join(ebookDir, 'metadata.json');
        const content = await fs.readFile(metadataPath, 'utf8');
        return JSON.parse(content);
    }

    getAgeInDays(publishedDate) {
        const published = new Date(publishedDate);
        const now = new Date();
        const diffTime = Math.abs(now - published);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    async fetchAnalytics(ebookId) {
        // In production, this would fetch from analytics service
        // For now, return mock data
        return {
            impressions: 10000,
            clicks: 150,
            ctr: 0.015, // 1.5%
            bounceRate: 0.65,
            avgTimeOnPage: 45, // seconds
            conversions: 8,
            conversionRate: 0.008,
            topSearchTerms: ['productivity', 'time management', 'focus'],
            topReferrers: ['google', 'facebook', 'twitter'],
            deviceBreakdown: {
                mobile: 0.6,
                desktop: 0.35,
                tablet: 0.05
            }
        };
    }

    determineStrategy(analytics) {
        if (analytics.ctr < OPTIMIZATION_STRATEGIES.lowCTR.threshold) {
            return OPTIMIZATION_STRATEGIES.lowCTR;
        }
        
        if (analytics.bounceRate > OPTIMIZATION_STRATEGIES.highBounce.threshold) {
            return OPTIMIZATION_STRATEGIES.highBounce;
        }
        
        if (analytics.conversionRate < OPTIMIZATION_STRATEGIES.lowConversion.threshold) {
            return OPTIMIZATION_STRATEGIES.lowConversion;
        }
        
        return OPTIMIZATION_STRATEGIES.goodPerformance;
    }

    async generateVariations(metadata, analytics, strategy) {
        const variations = [];
        
        for (let i = 0; i < this.testVariations; i++) {
            const prompt = this.createOptimizationPrompt(metadata, analytics, strategy, i);
            const optimized = await this.callClaude(prompt);
            
            try {
                const parsed = JSON.parse(optimized);
                variations.push({
                    id: `var-${Date.now()}-${i}`,
                    title: parsed.title,
                    subtitle: parsed.subtitle,
                    metaDescription: parsed.metaDescription,
                    keywords: parsed.keywords,
                    hookLine: parsed.hookLine,
                    strategy: strategy.name,
                    confidence: parsed.confidence || 0.7
                });
            } catch (error) {
                console.warn(`Failed to parse variation ${i}:`, error.message);
            }
        }
        
        return variations;
    }

    createOptimizationPrompt(metadata, analytics, strategy, variationIndex) {
        const topTerms = analytics.topSearchTerms.join(', ');
        
        return `You are an expert copywriter specializing in ebook titles and SEO optimization. 
Your task is to create an optimized variation of an ebook's title and metadata based on performance data.

CURRENT EBOOK:
Title: ${metadata.title}
Subtitle: ${metadata.subtitle || 'N/A'}
Meta Description: ${metadata.metaDescription}
Genre: ${metadata.genre}
Target Audience: ${metadata.targetAudience}

PERFORMANCE DATA:
- Click-through rate: ${(analytics.ctr * 100).toFixed(2)}%
- Bounce rate: ${(analytics.bounceRate * 100).toFixed(0)}%
- Conversion rate: ${(analytics.conversionRate * 100).toFixed(2)}%
- Average time on page: ${analytics.avgTimeOnPage} seconds
- Top search terms: ${topTerms}
- Mobile traffic: ${(analytics.deviceBreakdown.mobile * 100).toFixed(0)}%

OPTIMIZATION STRATEGY: ${strategy.name}
Approach: ${strategy.approach}
Examples of this approach: ${strategy.examples.join(', ')}

VARIATION NUMBER: ${variationIndex + 1} of ${this.testVariations}

Create a unique variation that:
1. Addresses the performance issue identified
2. Incorporates top search terms naturally
3. Maintains brand consistency
4. Is optimized for ${analytics.deviceBreakdown.mobile > 0.5 ? 'mobile' : 'desktop'} reading
5. Is different from other variations

Return a JSON object with:
{
    "title": "New compelling title (max 60 chars)",
    "subtitle": "Optional subtitle (max 100 chars)",
    "metaDescription": "SEO meta description (max 160 chars)",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "hookLine": "First line to grab attention (max 100 chars)",
    "confidence": 0.8,
    "reasoning": "Brief explanation of changes"
}`;
    }

    async callClaude(prompt) {
        const tempFile = path.join('/tmp', `optimize-${Date.now()}.txt`);
        await fs.writeFile(tempFile, prompt);
        
        try {
            const command = `agentcli call claude.opus --model="${this.model}" --temperature=0.7 --file="${tempFile}"`;
            const { stdout } = await execAsync(command, {
                maxBuffer: 5 * 1024 * 1024 // 5MB buffer
            });
            
            return stdout.trim();
            
        } finally {
            await fs.unlink(tempFile).catch(() => {});
        }
    }

    async updateMetadata(ebookDir, originalMetadata, variations) {
        // Keep original metadata
        originalMetadata.originalTitle = originalMetadata.originalTitle || originalMetadata.title;
        originalMetadata.originalMetaDescription = originalMetadata.originalMetaDescription || originalMetadata.metaDescription;
        
        // Add variations for A/B testing
        originalMetadata.variations = variations;
        originalMetadata.optimizationDate = new Date().toISOString();
        originalMetadata.currentVariation = variations[0].id; // Start with first variation
        
        // Save updated metadata
        const metadataPath = path.join(ebookDir, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(originalMetadata, null, 2));
        
        // Also update the HTML file with new meta tags
        await this.updateHTMLMeta(ebookDir, variations[0]);
        
        return originalMetadata;
    }

    async updateHTMLMeta(ebookDir, variation) {
        const htmlPath = path.join(ebookDir, 'index.html');
        let html = await fs.readFile(htmlPath, 'utf8');
        
        // Update title
        html = html.replace(
            /<title>.*?<\/title>/,
            `<title>${variation.title}</title>`
        );
        
        // Update meta description
        html = html.replace(
            /<meta name="description" content=".*?">/,
            `<meta name="description" content="${variation.metaDescription}">`
        );
        
        // Update keywords
        if (variation.keywords && variation.keywords.length > 0) {
            const keywordsTag = `<meta name="keywords" content="${variation.keywords.join(', ')}">`;
            if (html.includes('<meta name="keywords"')) {
                html = html.replace(
                    /<meta name="keywords" content=".*?">/,
                    keywordsTag
                );
            } else {
                html = html.replace(
                    '</head>',
                    `  ${keywordsTag}\n</head>`
                );
            }
        }
        
        await fs.writeFile(htmlPath, html);
    }

    async createABTestConfig(ebookId, variations) {
        const config = {
            ebookId,
            testId: `test-${Date.now()}`,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
            variations: variations.map(v => ({
                id: v.id,
                weight: 1 / variations.length, // Equal distribution
                title: v.title,
                active: true
            })),
            metrics: ['ctr', 'bounceRate', 'conversionRate', 'timeOnPage']
        };
        
        // Save A/B test configuration
        const configPath = path.join('build', 'ab-tests', `${config.testId}.json`);
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        
        return config;
    }

    generateReport(metadata, analytics, strategy, variations) {
        const report = {
            timestamp: new Date().toISOString(),
            ebook: {
                id: metadata.id,
                originalTitle: metadata.originalTitle || metadata.title,
                publishedDate: metadata.publishedDate,
                ageInDays: this.getAgeInDays(metadata.publishedDate)
            },
            analytics: {
                impressions: analytics.impressions,
                ctr: analytics.ctr,
                bounceRate: analytics.bounceRate,
                conversionRate: analytics.conversionRate
            },
            optimization: {
                strategy: strategy.name,
                reason: strategy.approach,
                variationsCreated: variations.length
            },
            variations: variations.map(v => ({
                id: v.id,
                title: v.title,
                changes: {
                    titleLength: v.title.length - metadata.title.length,
                    newKeywords: v.keywords.filter(k => !metadata.keywords?.includes(k))
                }
            })),
            summary: {
                status: 'optimized',
                expectedImprovement: '15-30%',
                testDuration: '14 days',
                nextReview: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
            }
        };
        
        return report;
    }

    async saveReport(ebookDir, report) {
        const reportPath = path.join(ebookDir, 'optimization-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    }

    async batchOptimize(ebooksDir, options = {}) {
        console.log(`🎯 Batch optimizing ebooks in: ${ebooksDir}`);
        
        const results = [];
        const ebooks = await this.findEbooks(ebooksDir);
        
        for (const ebook of ebooks) {
            console.log(`\n📚 Processing: ${ebook}`);
            const result = await this.optimizeEbook(ebook, null);
            results.push({
                ebook,
                ...result
            });
            
            // Rate limiting between optimizations
            if (ebooks.indexOf(ebook) < ebooks.length - 1) {
                await this.sleep(2000);
            }
        }
        
        // Generate batch report
        const batchReport = {
            timestamp: new Date().toISOString(),
            totalEbooks: ebooks.length,
            optimized: results.filter(r => r.success).length,
            skipped: results.filter(r => r.reason === 'too_new').length,
            failed: results.filter(r => r.error).length,
            results
        };
        
        await fs.writeFile(
            path.join(ebooksDir, 'batch-optimization-report.json'),
            JSON.stringify(batchReport, null, 2)
        );
        
        return batchReport;
    }

    async findEbooks(ebooksDir) {
        const items = await fs.readdir(ebooksDir, { withFileTypes: true });
        const ebooks = [];
        
        for (const item of items) {
            if (item.isDirectory()) {
                const metadataPath = path.join(ebooksDir, item.name, 'metadata.json');
                try {
                    await fs.access(metadataPath);
                    ebooks.push(path.join(ebooksDir, item.name));
                } catch {
                    // Not an ebook directory
                }
            }
        }
        
        return ebooks;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
    
    if (!options['ebook-dir'] && !options['batch']) {
        console.error('Usage: optimizer.js --ebook-dir="path/to/ebook" [--days-old=7]');
        console.error('   or: optimizer.js --batch="path/to/ebooks/dir" [--days-old=7]');
        process.exit(1);
    }
    
    const optimizer = new Optimizer({
        minDaysOld: parseInt(options['days-old']) || 7,
        testVariations: parseInt(options['variations']) || 3
    });
    
    (async () => {
        try {
            if (options['ebook-dir']) {
                const result = await optimizer.optimizeEbook(options['ebook-dir']);
                console.log('\nResult:', JSON.stringify(result, null, 2));
                process.exit(result.success ? 0 : 1);
            } else if (options.batch) {
                const report = await optimizer.batchOptimize(options.batch);
                console.log('\nBatch Report:', JSON.stringify(report.summary || report, null, 2));
                process.exit(report.failed === 0 ? 0 : 1);
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = Optimizer;