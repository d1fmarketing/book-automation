#!/usr/bin/env node

/**
 * Affiliate Injector Agent
 * 
 * Intelligently inserts relevant affiliate links into ebook content.
 * Supports multiple affiliate networks with caching and rate limiting.
 * 
 * Usage:
 *   agentcli call affiliate.inject --content="path/to/content.md" --niche="business"
 *   node agents/affiliate-injector.js --ebook-dir="build/ebooks/my-book" --networks="amazon,shareasale"
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Affiliate network configurations
const AFFILIATE_NETWORKS = {
    amazon: {
        name: 'Amazon Associates',
        baseUrl: 'https://www.amazon.com/dp/',
        tagParam: 'tag',
        defaultTag: process.env.AMAZON_ASSOCIATE_TAG || 'your-tag-20',
        categories: {
            business: ['B08N5WRWNW', 'B07FJ3S99R', 'B0731QN8FB'], // Echo, Echo Show, Kindle
            tech: ['B07ZPKN6YR', 'B08N5WRWNW', 'B089B8W9FY'],
            health: ['B07R6Y5DNX', 'B0843SBK8V', 'B07J2L5B4D'],
            finance: ['B084DWCZY6', 'B0731QN8FB', 'B07VGRJDFY']
        },
        rateLimit: 1000, // 1 request per second
        cacheTime: 86400000 // 24 hours
    },
    shareasale: {
        name: 'ShareASale',
        baseUrl: 'https://shareasale.com/r.cfm',
        merchantParam: 'Id',
        affParam: 'u',
        defaultAffId: process.env.SHAREASALE_ID || '123456',
        merchants: {
            tools: { id: '94485', name: 'Grammarly' },
            hosting: { id: '41388', name: 'WP Engine' },
            courses: { id: '78158', name: 'Udemy' }
        }
    },
    clickbank: {
        name: 'ClickBank',
        baseUrl: 'https://hop.clickbank.net',
        format: '?affiliate=AFFILIATE&vendor=VENDOR',
        defaultAffiliate: process.env.CLICKBANK_ID || 'yourname',
        products: {
            business: ['bizsucc', 'homebiz', 'profitmax'],
            health: ['dietplan', 'fitness7', 'wellness'],
            finance: ['wealthbld', 'cryptopro', 'stocktips']
        }
    },
    gumroad: {
        name: 'Gumroad',
        baseUrl: 'https://gumroad.com/l/',
        affParam: 'a',
        defaultAffId: process.env.GUMROAD_AFFILIATE_ID || 'your_aff_id',
        ownProducts: [] // Will be populated with user's own products
    }
};

// Link placement strategies
const PLACEMENT_STRATEGIES = {
    natural: {
        keywords: ['recommended', 'suggest', 'try', 'check out', 'useful', 'helpful', 'tool', 'resource'],
        density: 0.02, // 2% of paragraphs
        minWords: 50, // Minimum words between links
        preferredPositions: ['end_of_section', 'after_tip', 'resource_mention']
    },
    aggressive: {
        keywords: ['best', 'top', 'must-have', 'essential', 'powerful', 'amazing'],
        density: 0.05, // 5% of paragraphs
        minWords: 30,
        preferredPositions: ['any']
    },
    conservative: {
        keywords: ['learn more', 'additional resources', 'further reading'],
        density: 0.01, // 1% of paragraphs
        minWords: 100,
        preferredPositions: ['chapter_end', 'resources_section']
    }
};

// In-memory cache (in production, use Redis)
const affiliateCache = new Map();

class AffiliateInjector {
    constructor(options = {}) {
        this.networks = options.networks || ['amazon', 'shareasale'];
        this.strategy = options.strategy || 'natural';
        this.niche = options.niche || 'business';
        this.cloakLinks = options.cloakLinks !== false;
        this.trackingEnabled = options.tracking !== false;
        this.customProducts = options.customProducts || {};
        this.lastRequestTime = {};
    }

    async injectIntoContent(contentPath, options = {}) {
        console.log(`💰 Injecting affiliate links into: ${contentPath}`);
        
        try {
            // Read content
            const content = await fs.readFile(contentPath, 'utf8');
            
            // Parse content structure
            const structure = this.parseContent(content);
            
            // Find affiliate opportunities
            const opportunities = await this.findOpportunities(structure, options);
            
            // Generate affiliate links
            const links = await this.generateLinks(opportunities);
            
            // Inject links into content
            const enhanced = await this.injectLinks(content, links, structure);
            
            // Add disclosure if needed
            const finalContent = this.addDisclosure(enhanced, links);
            
            // Save enhanced content
            const outputPath = options.outputPath || contentPath.replace('.md', '-affiliate.md');
            await fs.writeFile(outputPath, finalContent);
            
            // Generate report
            const report = this.generateReport(links, opportunities);
            
            console.log(`✅ Injected ${links.length} affiliate links`);
            console.log(`💵 Estimated earnings potential: ${report.earningsPotential}`);
            
            return {
                success: true,
                linksInjected: links.length,
                outputPath,
                report
            };
            
        } catch (error) {
            console.error(`❌ Error injecting links: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    parseContent(content) {
        const lines = content.split('\n');
        const structure = {
            sections: [],
            paragraphs: [],
            lists: [],
            codeBlocks: [],
            existingLinks: []
        };
        
        let currentSection = null;
        let inCodeBlock = false;
        let paragraphBuffer = [];
        
        lines.forEach((line, index) => {
            // Track code blocks (don't inject in code)
            if (line.startsWith('```')) {
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock) {
                    structure.codeBlocks.push({ start: index });
                } else if (structure.codeBlocks.length > 0) {
                    structure.codeBlocks[structure.codeBlocks.length - 1].end = index;
                }
                return;
            }
            
            if (inCodeBlock) return;
            
            // Track sections
            if (line.match(/^#+\s/)) {
                currentSection = {
                    level: line.match(/^#+/)[0].length,
                    title: line.replace(/^#+\s*/, ''),
                    line: index,
                    content: []
                };
                structure.sections.push(currentSection);
                
                // Save paragraph if exists
                if (paragraphBuffer.length > 0) {
                    structure.paragraphs.push({
                        lines: [...paragraphBuffer],
                        section: structure.sections[structure.sections.length - 2] // Previous section
                    });
                    paragraphBuffer = [];
                }
            }
            // Track lists
            else if (line.match(/^[\s]*[-*+]\s/)) {
                structure.lists.push({
                    line: index,
                    content: line,
                    section: currentSection
                });
            }
            // Track existing links
            else if (line.match(/\[([^\]]+)\]\(([^)]+)\)/g)) {
                const links = line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
                for (const link of links) {
                    structure.existingLinks.push({
                        line: index,
                        text: link[1],
                        url: link[2]
                    });
                }
            }
            // Build paragraphs
            else if (line.trim() && !line.match(/^[>#|\-*+]/)) {
                paragraphBuffer.push({ line: index, content: line });
            } else if (paragraphBuffer.length > 0) {
                // End of paragraph
                structure.paragraphs.push({
                    lines: [...paragraphBuffer],
                    section: currentSection
                });
                paragraphBuffer = [];
            }
        });
        
        // Don't forget last paragraph
        if (paragraphBuffer.length > 0) {
            structure.paragraphs.push({
                lines: paragraphBuffer,
                section: currentSection
            });
        }
        
        return structure;
    }

    async findOpportunities(structure, options) {
        const strategy = PLACEMENT_STRATEGIES[this.strategy];
        const opportunities = [];
        
        // Calculate how many links to inject
        const totalParagraphs = structure.paragraphs.length;
        const targetLinks = Math.ceil(totalParagraphs * strategy.density);
        
        console.log(`📊 Found ${totalParagraphs} paragraphs, targeting ${targetLinks} affiliate links`);
        
        // Find opportunities in paragraphs
        structure.paragraphs.forEach((paragraph, index) => {
            const text = paragraph.lines.map(l => l.content).join(' ');
            const wordCount = text.split(/\s+/).length;
            
            // Skip short paragraphs
            if (wordCount < 20) return;
            
            // Check for opportunity keywords
            const hasKeyword = strategy.keywords.some(keyword => 
                text.toLowerCase().includes(keyword)
            );
            
            // Score the opportunity
            let score = 0;
            if (hasKeyword) score += 50;
            if (paragraph.section && paragraph.section.title.toLowerCase().includes('resource')) score += 30;
            if (paragraph.section && paragraph.section.title.toLowerCase().includes('tool')) score += 30;
            if (text.includes('$') || text.match(/\d+%/)) score += 20; // Money or percentage mentioned
            if (index > totalParagraphs * 0.8) score += 10; // Near end of content
            
            opportunities.push({
                type: 'paragraph',
                paragraph,
                score,
                text,
                wordCount
            });
        });
        
        // Find opportunities in lists (good for tool recommendations)
        structure.lists.forEach(list => {
            if (list.content.toLowerCase().match(/tool|resource|software|book|course/)) {
                opportunities.push({
                    type: 'list',
                    list,
                    score: 40,
                    text: list.content
                });
            }
        });
        
        // Sort by score and select top opportunities
        opportunities.sort((a, b) => b.score - a.score);
        
        // Ensure minimum spacing between links
        const selected = [];
        let lastLineNum = -strategy.minWords;
        
        for (const opp of opportunities) {
            const lineNum = opp.type === 'paragraph' ? opp.paragraph.lines[0].line : opp.list.line;
            
            if (lineNum - lastLineNum >= strategy.minWords / 10) { // Approximate words to lines
                selected.push(opp);
                lastLineNum = lineNum;
                
                if (selected.length >= targetLinks) break;
            }
        }
        
        return selected;
    }

    async generateLinks(opportunities) {
        const links = [];
        
        for (const opp of opportunities) {
            // Determine product type based on context
            const productType = this.determineProductType(opp.text);
            
            // Get relevant products
            const products = await this.getRelevantProducts(productType, opp.text);
            
            if (products.length === 0) continue;
            
            // Select best product
            const product = products[0]; // In production, use AI to match best product
            
            // Generate affiliate link
            const link = await this.createAffiliateLink(product, opp);
            
            if (link) {
                links.push({
                    ...link,
                    opportunity: opp,
                    lineNum: opp.type === 'paragraph' ? opp.paragraph.lines[0].line : opp.list.line
                });
            }
        }
        
        return links;
    }

    determineProductType(text) {
        const lower = text.toLowerCase();
        
        if (lower.match(/book|read|learn|guide|tutorial/)) return 'books';
        if (lower.match(/tool|software|app|platform|service/)) return 'tools';
        if (lower.match(/course|training|workshop|masterclass/)) return 'courses';
        if (lower.match(/host|server|domain|website/)) return 'hosting';
        
        // Default based on niche
        const nicheDefaults = {
            business: 'tools',
            tech: 'software',
            health: 'supplements',
            finance: 'services'
        };
        
        return nicheDefaults[this.niche] || 'general';
    }

    async getRelevantProducts(productType, contextText) {
        const products = [];
        
        // Check cache first
        const cacheKey = `${productType}:${this.niche}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        // Amazon products
        if (this.networks.includes('amazon')) {
            const amazonProducts = AFFILIATE_NETWORKS.amazon.categories[this.niche] || [];
            
            for (const asin of amazonProducts) {
                // In production, fetch product details from Amazon PA-API
                products.push({
                    network: 'amazon',
                    id: asin,
                    title: `Recommended ${productType}`,
                    commission: 0.04, // 4% average
                    price: 29.99 // Placeholder
                });
            }
        }
        
        // ShareASale products
        if (this.networks.includes('shareasale') && productType === 'tools') {
            const merchant = AFFILIATE_NETWORKS.shareasale.merchants.tools;
            products.push({
                network: 'shareasale',
                id: merchant.id,
                title: merchant.name,
                commission: 0.15, // 15% average
                price: 14.95
            });
        }
        
        // Custom products
        if (this.customProducts[productType]) {
            products.push(...this.customProducts[productType]);
        }
        
        // Cache results
        this.setCache(cacheKey, products);
        
        return products;
    }

    async createAffiliateLink(product, opportunity) {
        // Rate limiting
        await this.enforceRateLimit(product.network);
        
        let url, text;
        
        switch (product.network) {
            case 'amazon':
                url = `${AFFILIATE_NETWORKS.amazon.baseUrl}${product.id}?${AFFILIATE_NETWORKS.amazon.tagParam}=${AFFILIATE_NETWORKS.amazon.defaultTag}`;
                text = product.title || 'View on Amazon';
                break;
                
            case 'shareasale':
                const merchant = AFFILIATE_NETWORKS.shareasale.merchants[Object.keys(AFFILIATE_NETWORKS.shareasale.merchants).find(key => 
                    AFFILIATE_NETWORKS.shareasale.merchants[key].id === product.id
                )];
                url = `${AFFILIATE_NETWORKS.shareasale.baseUrl}?${AFFILIATE_NETWORKS.shareasale.merchantParam}=${product.id}&${AFFILIATE_NETWORKS.shareasale.affParam}=${AFFILIATE_NETWORKS.shareasale.defaultAffId}`;
                text = merchant?.name || product.title;
                break;
                
            case 'clickbank':
                url = `${AFFILIATE_NETWORKS.clickbank.baseUrl}${AFFILIATE_NETWORKS.clickbank.format}`
                    .replace('AFFILIATE', AFFILIATE_NETWORKS.clickbank.defaultAffiliate)
                    .replace('VENDOR', product.id);
                text = product.title;
                break;
                
            default:
                return null;
        }
        
        // Add tracking if enabled
        if (this.trackingEnabled) {
            url = this.addTracking(url, opportunity);
        }
        
        // Cloak link if enabled
        if (this.cloakLinks) {
            url = await this.cloakLink(url);
        }
        
        return {
            url,
            text,
            product,
            type: this.determineLinkType(opportunity)
        };
    }

    async enforceRateLimit(network) {
        const config = AFFILIATE_NETWORKS[network];
        if (!config.rateLimit) return;
        
        const now = Date.now();
        const lastRequest = this.lastRequestTime[network] || 0;
        const timeSinceLastRequest = now - lastRequest;
        
        if (timeSinceLastRequest < config.rateLimit) {
            const waitTime = config.rateLimit - timeSinceLastRequest;
            await this.sleep(waitTime);
        }
        
        this.lastRequestTime[network] = Date.now();
    }

    addTracking(url, opportunity) {
        const params = new URLSearchParams();
        params.set('utm_source', 'ebook');
        params.set('utm_medium', 'affiliate');
        params.set('utm_campaign', this.niche);
        
        // Add position tracking
        const position = opportunity.type === 'paragraph' 
            ? `p${opportunity.paragraph.lines[0].line}`
            : `l${opportunity.list.line}`;
        params.set('utm_content', position);
        
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${params.toString()}`;
    }

    async cloakLink(url) {
        // In production, use a URL shortener or redirect service
        // For now, create a simple hash-based redirect
        const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
        return `/go/${hash}`;
    }

    determineLinkType(opportunity) {
        if (opportunity.text.match(/\$\d+/)) return 'price_mention';
        if (opportunity.text.toLowerCase().includes('recommend')) return 'recommendation';
        if (opportunity.text.toLowerCase().includes('tool')) return 'tool_mention';
        if (opportunity.type === 'list') return 'resource_list';
        return 'contextual';
    }

    async injectLinks(content, links, structure) {
        const lines = content.split('\n');
        const injected = new Set();
        
        // Sort links by line number (reverse order to maintain line numbers)
        links.sort((a, b) => b.lineNum - a.lineNum);
        
        for (const link of links) {
            const lineNum = link.lineNum;
            
            // Skip if already injected in this area
            if (Array.from(injected).some(num => Math.abs(num - lineNum) < 3)) {
                continue;
            }
            
            if (link.opportunity.type === 'paragraph') {
                // Inject at end of paragraph
                const lastLine = link.opportunity.paragraph.lines[link.opportunity.paragraph.lines.length - 1];
                lines[lastLine.line] = this.injectLinkIntoLine(lines[lastLine.line], link);
                injected.add(lastLine.line);
            } else if (link.opportunity.type === 'list') {
                // Replace or append to list item
                lines[lineNum] = this.injectLinkIntoListItem(lines[lineNum], link);
                injected.add(lineNum);
            }
        }
        
        return lines.join('\n');
    }

    injectLinkIntoLine(line, link) {
        // Find natural injection point
        const patterns = [
            { regex: /\b(tool|resource|software|platform)\b/i, replacement: '$1' },
            { regex: /\b(recommend|suggest|try)\s+(\w+)/i, replacement: '$1 $2' },
            { regex: /\.$/, replacement: '' } // End of sentence
        ];
        
        for (const pattern of patterns) {
            if (line.match(pattern.regex)) {
                return line.replace(pattern.regex, `${pattern.replacement} ([${link.text}](${link.url}))`);
            }
        }
        
        // Default: append to end
        return `${line} Consider checking out [${link.text}](${link.url}){:data-aff="${link.product.network}" rel="sponsored noopener"}.`;
    }

    injectLinkIntoListItem(line, link) {
        const listMatch = line.match(/^(\s*[-*+]\s+)(.+)$/);
        if (listMatch) {
            const prefix = listMatch[1];
            const content = listMatch[2];
            
            // If it's already a link, replace it
            if (content.includes('](')) {
                return line; // Skip, don't override existing links
            }
            
            // Add link to list item
            return `${prefix}[${content}](${link.url}){:data-aff="${link.product.network}" rel="sponsored noopener"}`;
        }
        
        return line;
    }

    addDisclosure(content, links) {
        if (links.length === 0) return content;
        
        const disclosure = `
---

*Disclosure: This content contains affiliate links. As an Amazon Associate and member of other affiliate programs, we earn from qualifying purchases at no additional cost to you. We only recommend products we genuinely believe will benefit our readers. Thank you for supporting our work!*`;
        
        // Add at the beginning if not already present
        if (!content.includes('Disclosure:') && !content.includes('affiliate')) {
            const lines = content.split('\n');
            
            // Find first non-metadata line
            let insertIndex = 0;
            if (lines[0] === '---') {
                insertIndex = lines.indexOf('---', 1) + 1;
            }
            
            lines.splice(insertIndex, 0, disclosure);
            return lines.join('\n');
        }
        
        return content;
    }

    generateReport(links, opportunities) {
        const report = {
            totalOpportunities: opportunities.length,
            linksInjected: links.length,
            conversionRate: (links.length / opportunities.length * 100).toFixed(1) + '%',
            linksByType: {},
            linksByNetwork: {},
            estimatedEarnings: 0
        };
        
        // Analyze link distribution
        links.forEach(link => {
            // By type
            report.linksByType[link.type] = (report.linksByType[link.type] || 0) + 1;
            
            // By network
            report.linksByNetwork[link.product.network] = (report.linksByNetwork[link.product.network] || 0) + 1;
            
            // Estimate earnings (very rough estimate)
            const conversionRate = 0.02; // 2% conversion
            const avgOrderValue = link.product.price || 50;
            const commission = link.product.commission || 0.04;
            report.estimatedEarnings += avgOrderValue * commission * conversionRate;
        });
        
        report.earningsPotential = `$${report.estimatedEarnings.toFixed(2)} per 100 readers`;
        
        return report;
    }

    // Cache management
    getCached(key) {
        const cached = affiliateCache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > AFFILIATE_NETWORKS.amazon.cacheTime) {
            affiliateCache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    setCache(key, data) {
        affiliateCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async processEbookDirectory(ebookDir, options = {}) {
        console.log(`💰 Processing entire ebook directory: ${ebookDir}`);
        
        const results = [];
        const files = await fs.readdir(ebookDir);
        const markdownFiles = files.filter(f => f.endsWith('.md'));
        
        for (const file of markdownFiles) {
            console.log(`\n📄 Processing: ${file}`);
            const result = await this.injectIntoContent(
                path.join(ebookDir, file),
                {
                    ...options,
                    outputPath: path.join(ebookDir, file.replace('.md', '-affiliate.md'))
                }
            );
            results.push({ file, ...result });
        }
        
        // Generate summary report
        const totalLinks = results.reduce((sum, r) => sum + (r.linksInjected || 0), 0);
        const report = {
            timestamp: new Date().toISOString(),
            filesProcessed: results.length,
            totalLinksInjected: totalLinks,
            averageLinksPerFile: (totalLinks / results.length).toFixed(1),
            results
        };
        
        const reportPath = path.join(ebookDir, 'affiliate-injection-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n✅ Affiliate injection complete`);
        console.log(`📊 Total links injected: ${totalLinks}`);
        console.log(`📄 Report saved to: ${reportPath}`);
        
        return report;
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
    
    if (!options.content && !options['ebook-dir']) {
        console.error('Usage: affiliate-injector.js --content="path/to/content.md" [--niche="business"] [--strategy="natural"]');
        console.error('   or: affiliate-injector.js --ebook-dir="path/to/ebook" [--networks="amazon,shareasale"]');
        console.error('\nNetworks: amazon, shareasale, clickbank, gumroad');
        console.error('Strategies: natural, aggressive, conservative');
        console.error('Niches: business, tech, health, finance');
        process.exit(1);
    }
    
    const injector = new AffiliateInjector({
        networks: options.networks ? options.networks.split(',') : ['amazon', 'shareasale'],
        strategy: options.strategy || 'natural',
        niche: options.niche || 'business',
        cloakLinks: options.cloak !== 'false',
        tracking: options.tracking !== 'false'
    });
    
    (async () => {
        try {
            if (options.content) {
                const result = await injector.injectIntoContent(options.content, options);
                console.log('\nResult:', JSON.stringify(result, null, 2));
            } else if (options['ebook-dir']) {
                const report = await injector.processEbookDirectory(options['ebook-dir'], options);
                console.log('\nSummary:', JSON.stringify({
                    filesProcessed: report.filesProcessed,
                    totalLinksInjected: report.totalLinksInjected,
                    averageLinksPerFile: report.averageLinksPerFile
                }, null, 2));
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = AffiliateInjector;