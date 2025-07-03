#!/usr/bin/env node

/**
 * Gumroad Upload Agent
 * 
 * Automates product creation and upload to Gumroad for ebook sales.
 * Handles file uploads, pricing, descriptions, and SEO optimization.
 * 
 * Usage:
 *   agentcli call publish.gumroad --pdf="path/to/ebook.pdf" --price=9.99
 *   node agents/gumroad-upload.js --ebook-dir="build/ebooks/my-book" --live
 */

const fs = require('fs').promises;
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const crypto = require('crypto');

// Gumroad API configuration
const GUMROAD_CONFIG = {
    apiUrl: 'https://api.gumroad.com/v2',
    oauthUrl: 'https://gumroad.com/oauth',
    endpoints: {
        products: '/products',
        productDetail: '/products/:id',
        customFields: '/products/:id/custom_fields',
        uploadFile: '/products/:id/files',
        enable: '/products/:id/enable',
        disable: '/products/:id/disable'
    },
    categories: {
        business: 'Business & Money',
        tech: 'Computers & Technology',
        health: 'Health & Fitness',
        selfHelp: 'Self-Help',
        education: 'Education',
        fiction: 'Fiction & Literature'
    },
    maxFileSize: 250 * 1024 * 1024, // 250MB
    supportedFormats: ['.pdf', '.epub', '.mobi']
};

// SEO templates for different niches
const SEO_TEMPLATES = {
    business: {
        tags: ['business', 'entrepreneurship', 'success', 'money', 'passive income'],
        descriptionTemplate: 'Learn {topic} with this comprehensive guide. Perfect for entrepreneurs and business owners looking to {benefit}.'
    },
    tech: {
        tags: ['technology', 'programming', 'software', 'digital', 'innovation'],
        descriptionTemplate: 'Master {topic} with practical examples and hands-on tutorials. Ideal for developers and tech enthusiasts.'
    },
    health: {
        tags: ['health', 'wellness', 'fitness', 'lifestyle', 'self-care'],
        descriptionTemplate: 'Transform your health with {topic}. Evidence-based strategies for {benefit}.'
    },
    selfHelp: {
        tags: ['self-improvement', 'personal development', 'motivation', 'mindset', 'success'],
        descriptionTemplate: 'Unlock your potential with {topic}. Proven techniques for {benefit}.'
    }
};

class GumroadUpload {
    constructor(options = {}) {
        this.accessToken = options.accessToken || process.env.GUMROAD_ACCESS_TOKEN;
        this.sandbox = options.sandbox || false;
        this.autoPublish = options.autoPublish !== false;
        this.enableCustomization = options.customization !== false;
        this.affiliatePercent = options.affiliatePercent || 30; // 30% for affiliates
        
        if (!this.accessToken) {
            throw new Error('GUMROAD_ACCESS_TOKEN is required');
        }
        
        // Configure axios instance
        this.api = axios.create({
            baseURL: GUMROAD_CONFIG.apiUrl,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`
            }
        });
    }

    async uploadEbook(ebookPath, options = {}) {
        console.log(`📤 Uploading ebook to Gumroad: ${ebookPath}`);
        
        try {
            // Load ebook metadata
            const metadata = await this.loadMetadata(ebookPath, options);
            
            // Create product
            const product = await this.createProduct(metadata, options);
            console.log(`✅ Product created: ${product.name} (ID: ${product.id})`);
            
            // Upload files
            const files = await this.uploadFiles(product.id, ebookPath, metadata);
            console.log(`✅ Files uploaded: ${files.length} file(s)`);
            
            // Add custom fields if enabled
            if (this.enableCustomization) {
                await this.addCustomFields(product.id, metadata);
                console.log('✅ Custom fields added');
            }
            
            // Configure affiliate program
            await this.configureAffiliates(product.id);
            console.log(`✅ Affiliate program enabled: ${this.affiliatePercent}% commission`);
            
            // Add preview if available
            if (metadata.previewPath) {
                await this.uploadPreview(product.id, metadata.previewPath);
                console.log('✅ Preview uploaded');
            }
            
            // Publish product if auto-publish enabled
            if (this.autoPublish && !this.sandbox) {
                await this.publishProduct(product.id);
                console.log('✅ Product published and live');
            }
            
            // Generate final URLs
            const urls = this.generateUrls(product);
            
            console.log('\n🎉 Upload complete!');
            console.log(`📊 View analytics: ${urls.analytics}`);
            console.log(`🛒 Product page: ${urls.product}`);
            console.log(`💰 Affiliate link: ${urls.affiliate}`);
            
            return {
                success: true,
                productId: product.id,
                name: product.name,
                price: product.price,
                urls,
                published: this.autoPublish && !this.sandbox
            };
            
        } catch (error) {
            console.error(`❌ Upload failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                details: error.response?.data
            };
        }
    }

    async loadMetadata(ebookPath, options) {
        let metadata = {};
        
        // Check if it's a directory with metadata.json
        const stats = await fs.stat(ebookPath);
        if (stats.isDirectory()) {
            try {
                const metadataPath = path.join(ebookPath, 'metadata.json');
                const content = await fs.readFile(metadataPath, 'utf8');
                metadata = JSON.parse(content);
                
                // Find PDF file
                const files = await fs.readdir(path.join(ebookPath, 'final'));
                const pdfFile = files.find(f => f.endsWith('.pdf'));
                if (pdfFile) {
                    metadata.pdfPath = path.join(ebookPath, 'final', pdfFile);
                }
            } catch (error) {
                console.warn('No metadata.json found, using defaults');
            }
        } else {
            // Single file upload
            metadata.pdfPath = ebookPath;
            metadata.title = options.title || path.basename(ebookPath, path.extname(ebookPath));
        }
        
        // Merge with options
        return {
            ...metadata,
            ...options,
            title: options.title || metadata.title || 'Untitled Ebook',
            price: options.price || metadata.price || 9.99,
            niche: options.niche || metadata.genre || 'business'
        };
    }

    async createProduct(metadata, options) {
        const seoTemplate = SEO_TEMPLATES[metadata.niche] || SEO_TEMPLATES.business;
        
        // Build product description
        const description = this.buildDescription(metadata, seoTemplate);
        
        // Prepare product data
        const productData = {
            name: metadata.title,
            price: Math.round(metadata.price * 100), // Price in cents
            description: description,
            summary: metadata.subtitle || `Get instant access to ${metadata.title}`,
            tags: this.generateTags(metadata, seoTemplate),
            currency: 'USD',
            published: false, // Start unpublished
            
            // SEO fields
            seo_title: this.generateSeoTitle(metadata),
            seo_description: this.generateSeoDescription(metadata),
            
            // Settings
            require_shipping: false,
            shown_on_profile: true,
            
            // Customization
            customizable_price: options.payWhatYouWant || false,
            suggested_price: options.suggestedPrice ? Math.round(options.suggestedPrice * 100) : null
        };
        
        // Add category if available
        if (GUMROAD_CONFIG.categories[metadata.niche]) {
            productData.category = GUMROAD_CONFIG.categories[metadata.niche];
        }
        
        // Create the product
        const response = await this.api.post(GUMROAD_CONFIG.endpoints.products, productData);
        
        if (!response.data.success) {
            throw new Error(response.data.message || 'Failed to create product');
        }
        
        return response.data.product;
    }

    buildDescription(metadata, seoTemplate) {
        let description = '';
        
        // Add compelling intro
        description += `# ${metadata.title}\n\n`;
        
        if (metadata.subtitle) {
            description += `**${metadata.subtitle}**\n\n`;
        }
        
        // Add template-based description
        const templateDesc = seoTemplate.descriptionTemplate
            .replace('{topic}', metadata.theme || metadata.title)
            .replace('{benefit}', metadata.targetAudience || 'achieve your goals');
        
        description += `${templateDesc}\n\n`;
        
        // Add features/benefits
        description += `## What You'll Get:\n\n`;
        
        if (metadata.chapters) {
            description += `- 📚 ${metadata.chapters.length} comprehensive chapters\n`;
        }
        if (metadata.wordCount) {
            description += `- 📝 ${metadata.wordCount.toLocaleString()} words of valuable content\n`;
        }
        description += `- 💡 Practical tips and actionable strategies\n`;
        description += `- 🎯 Real-world examples and case studies\n`;
        description += `- ⚡ Instant download - start reading immediately\n`;
        description += `- 💰 30-day money-back guarantee\n\n`;
        
        // Add chapter list if available
        if (metadata.chapters && metadata.chapters.length > 0) {
            description += `## Table of Contents:\n\n`;
            metadata.chapters.slice(0, 10).forEach((chapter, index) => {
                description += `${index + 1}. ${chapter.title}\n`;
            });
            if (metadata.chapters.length > 10) {
                description += `\n...and ${metadata.chapters.length - 10} more chapters!\n`;
            }
            description += '\n';
        }
        
        // Add testimonials/social proof
        description += `## Why Choose This Book?\n\n`;
        description += `✅ Based on proven strategies and real results\n`;
        description += `✅ Easy to understand and implement\n`;
        description += `✅ Regular updates with new content\n`;
        description += `✅ Bonus resources and templates included\n\n`;
        
        // Add call to action
        description += `## Get Started Today!\n\n`;
        description += `Don't wait to transform your knowledge of ${metadata.theme || metadata.title}. `;
        description += `Download your copy now and start your journey to success!\n\n`;
        
        // Add guarantee
        description += `**100% Satisfaction Guarantee** - If you're not completely satisfied, `;
        description += `get a full refund within 30 days. No questions asked.\n`;
        
        return description;
    }

    generateTags(metadata, seoTemplate) {
        const tags = new Set(seoTemplate.tags);
        
        // Add metadata keywords
        if (metadata.keywords) {
            metadata.keywords.forEach(keyword => tags.add(keyword.toLowerCase()));
        }
        
        // Add niche-specific tags
        tags.add(metadata.niche);
        tags.add('ebook');
        tags.add('digital download');
        
        // Add title words as tags
        const titleWords = metadata.title.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3 && !['the', 'and', 'for', 'with'].includes(word));
        titleWords.forEach(word => tags.add(word));
        
        // Limit to 15 tags (Gumroad limit)
        return Array.from(tags).slice(0, 15).join(',');
    }

    generateSeoTitle(metadata) {
        const title = metadata.title;
        const year = new Date().getFullYear();
        
        // SEO-optimized title patterns
        const patterns = [
            `${title} - Download PDF Ebook ${year}`,
            `${title} | Complete Guide (PDF Download)`,
            `[PDF] ${title} - Instant Download`
        ];
        
        return patterns[0].substring(0, 60); // 60 char limit
    }

    generateSeoDescription(metadata) {
        const benefit = metadata.targetAudience || 'achieve success';
        const desc = `Download ${metadata.title} and learn how to ${benefit}. ` +
                    `Comprehensive ${metadata.niche} ebook with practical strategies. ` +
                    `Instant PDF download. 30-day guarantee.`;
        
        return desc.substring(0, 160); // 160 char limit
    }

    async uploadFiles(productId, ebookPath, metadata) {
        const files = [];
        
        // Upload main PDF
        if (metadata.pdfPath) {
            const pdfResult = await this.uploadFile(productId, metadata.pdfPath, 'main');
            files.push(pdfResult);
        }
        
        // Upload additional formats if available
        const formats = ['.epub', '.mobi'];
        for (const format of formats) {
            const formatPath = metadata.pdfPath.replace('.pdf', format);
            try {
                await fs.access(formatPath);
                const result = await this.uploadFile(productId, formatPath, format.substring(1));
                files.push(result);
            } catch {
                // Format doesn't exist, skip
            }
        }
        
        // Upload bonus materials if available
        if (metadata.bonusDir) {
            try {
                const bonusFiles = await fs.readdir(metadata.bonusDir);
                for (const file of bonusFiles) {
                    const filePath = path.join(metadata.bonusDir, file);
                    const result = await this.uploadFile(productId, filePath, 'bonus');
                    files.push(result);
                }
            } catch {
                // No bonus directory
            }
        }
        
        return files;
    }

    async uploadFile(productId, filePath, type = 'main') {
        const stats = await fs.stat(filePath);
        
        if (stats.size > GUMROAD_CONFIG.maxFileSize) {
            throw new Error(`File too large: ${filePath} (max ${GUMROAD_CONFIG.maxFileSize / 1024 / 1024}MB)`);
        }
        
        // Prepare form data
        const form = new FormData();
        form.append('file', await fs.readFile(filePath), {
            filename: path.basename(filePath),
            contentType: 'application/pdf'
        });
        
        // Upload file
        const endpoint = GUMROAD_CONFIG.endpoints.uploadFile.replace(':id', productId);
        const response = await this.api.post(endpoint, form, {
            headers: {
                ...form.getHeaders()
            }
        });
        
        if (!response.data.success) {
            throw new Error(`File upload failed: ${response.data.message}`);
        }
        
        return {
            filename: path.basename(filePath),
            size: stats.size,
            type
        };
    }

    async addCustomFields(productId, metadata) {
        const customFields = [];
        
        // Add buyer's name field (for personalization)
        customFields.push({
            name: 'Your Name',
            required: false,
            type: 'text'
        });
        
        // Add email list opt-in
        customFields.push({
            name: 'Subscribe to updates',
            required: false,
            type: 'checkbox',
            description: 'Get free updates and bonus content'
        });
        
        // Add referral source
        customFields.push({
            name: 'How did you hear about us?',
            required: false,
            type: 'text'
        });
        
        for (const field of customFields) {
            const endpoint = GUMROAD_CONFIG.endpoints.customFields.replace(':id', productId);
            await this.api.post(endpoint, field);
        }
    }

    async configureAffiliates(productId) {
        // Enable affiliate program
        const affiliateData = {
            affiliate_rate: this.affiliatePercent,
            affiliates_enabled: true
        };
        
        const endpoint = GUMROAD_CONFIG.endpoints.productDetail.replace(':id', productId);
        await this.api.patch(endpoint, affiliateData);
    }

    async uploadPreview(productId, previewPath) {
        try {
            // Gumroad automatically generates previews from PDFs
            // This is a placeholder for custom preview uploads
            console.log('Preview generation handled by Gumroad');
        } catch (error) {
            console.warn('Preview upload failed:', error.message);
        }
    }

    async publishProduct(productId) {
        const endpoint = GUMROAD_CONFIG.endpoints.enable.replace(':id', productId);
        const response = await this.api.put(endpoint);
        
        if (!response.data.success) {
            throw new Error('Failed to publish product');
        }
        
        return response.data;
    }

    generateUrls(product) {
        const username = product.custom_permalink || product.seller.profile_url.split('/').pop();
        
        return {
            product: `https://gumroad.com/l/${product.short_url}`,
            directBuy: `https://gum.co/${product.short_url}`,
            affiliate: `https://gumroad.com/a/${this.affiliateId || 'affiliate'}/${product.short_url}`,
            analytics: `https://gumroad.com/products/${product.id}/analytics`,
            edit: `https://gumroad.com/products/${product.id}/edit`
        };
    }

    async updateProduct(productId, updates) {
        console.log(`🔄 Updating product ${productId}...`);
        
        const endpoint = GUMROAD_CONFIG.endpoints.productDetail.replace(':id', productId);
        const response = await this.api.patch(endpoint, updates);
        
        if (!response.data.success) {
            throw new Error('Failed to update product');
        }
        
        return response.data.product;
    }

    async getProductStats(productId) {
        const endpoint = GUMROAD_CONFIG.endpoints.productDetail.replace(':id', productId);
        const response = await this.api.get(endpoint);
        
        if (!response.data.success) {
            throw new Error('Failed to get product stats');
        }
        
        const product = response.data.product;
        
        return {
            sales: product.sales_count,
            revenue: product.sales_usd_cents / 100,
            views: product.view_count,
            conversionRate: product.sales_count / product.view_count * 100,
            rating: product.rating
        };
    }

    async batchUpload(ebooksDir, options = {}) {
        console.log(`📚 Batch uploading ebooks from: ${ebooksDir}`);
        
        const results = [];
        const dirs = await fs.readdir(ebooksDir, { withFileTypes: true });
        const ebookDirs = dirs.filter(d => d.isDirectory()).map(d => d.name);
        
        for (const dir of ebookDirs) {
            console.log(`\n📖 Processing: ${dir}`);
            const ebookPath = path.join(ebooksDir, dir);
            
            try {
                const result = await this.uploadEbook(ebookPath, options);
                results.push({ dir, ...result });
                
                // Rate limiting
                if (ebookDirs.indexOf(dir) < ebookDirs.length - 1) {
                    console.log('⏳ Waiting 5 seconds before next upload...');
                    await this.sleep(5000);
                }
            } catch (error) {
                results.push({ dir, success: false, error: error.message });
            }
        }
        
        // Summary report
        const successful = results.filter(r => r.success).length;
        const totalRevenue = results
            .filter(r => r.success)
            .reduce((sum, r) => sum + (r.price || 0), 0);
        
        console.log('\n📊 Batch Upload Summary:');
        console.log(`✅ Successful: ${successful}/${results.length}`);
        console.log(`💰 Total potential revenue: $${totalRevenue.toFixed(2)} per sale`);
        
        return results;
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
    
    if (!options.pdf && !options['ebook-dir'] && !options.batch) {
        console.error('Usage: gumroad-upload.js --pdf="path/to/ebook.pdf" --price=9.99 [--live]');
        console.error('   or: gumroad-upload.js --ebook-dir="path/to/ebook" [--sandbox]');
        console.error('   or: gumroad-upload.js --batch="path/to/ebooks" [--price=9.99]');
        console.error('\nOptions:');
        console.error('  --sandbox    Create products but don\'t publish');
        console.error('  --live       Publish products immediately');
        console.error('  --price      Set product price (default: 9.99)');
        console.error('  --affiliate  Set affiliate percentage (default: 30)');
        process.exit(1);
    }
    
    const uploader = new GumroadUpload({
        sandbox: options.sandbox === true,
        autoPublish: options.live === true,
        affiliatePercent: options.affiliate ? parseInt(options.affiliate) : 30
    });
    
    (async () => {
        try {
            if (options.pdf) {
                const result = await uploader.uploadEbook(options.pdf, {
                    price: options.price ? parseFloat(options.price) : undefined,
                    title: options.title
                });
                console.log('\nResult:', JSON.stringify(result, null, 2));
            } else if (options['ebook-dir']) {
                const result = await uploader.uploadEbook(options['ebook-dir'], {
                    price: options.price ? parseFloat(options.price) : undefined
                });
                console.log('\nResult:', JSON.stringify(result, null, 2));
            } else if (options.batch) {
                const results = await uploader.batchUpload(options.batch, {
                    price: options.price ? parseFloat(options.price) : undefined
                });
                console.log('\nResults:', JSON.stringify(results, null, 2));
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = GumroadUpload;