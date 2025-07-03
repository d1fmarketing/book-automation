#!/usr/bin/env node

/**
 * Illustrator Agent
 * 
 * Generates professional images for ebook chapters using Ideogram AI.
 * Creates contextually relevant visuals that enhance the reading experience.
 * 
 * Usage:
 *   agentcli call illustrator.generate --book-dir="build/my-ebook" --style="professional"
 *   node agents/illustrator.js --chapter="path/to/chapter.md" --output="path/to/image.png"
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');

// Image generation configuration
const IMAGE_CONFIG = {
    api: {
        hostname: 'api.ideogram.ai',
        endpoint: '/generate',
        models: {
            latest: 'V_2',
            fast: 'V_1',
            creative: 'V_2_TURBO'
        }
    },
    dimensions: {
        cover: { width: 1600, height: 2400, aspect: 'ASPECT_10_16' },
        chapterHeader: { width: 1920, height: 1080, aspect: 'ASPECT_16_9' },
        inline: { width: 800, height: 600, aspect: 'ASPECT_4_3' },
        social: { width: 1200, height: 630, aspect: 'ASPECT_16_9' },
        square: { width: 1024, height: 1024, aspect: 'ASPECT_1_1' }
    },
    styles: {
        professional: {
            basePrompt: 'professional business illustration, clean modern design',
            colors: 'corporate blue and gray palette, subtle gradients',
            elements: 'minimalist geometric shapes, professional icons'
        },
        technical: {
            basePrompt: 'technical diagram illustration, futuristic tech design',
            colors: 'cyan and purple gradients, neon accents',
            elements: 'circuit patterns, data flows, holographic effects'
        },
        creative: {
            basePrompt: 'creative artistic illustration, vibrant and engaging',
            colors: 'bright colorful palette, dynamic gradients',
            elements: 'abstract shapes, flowing patterns, artistic elements'
        },
        educational: {
            basePrompt: 'educational infographic style, clear and informative',
            colors: 'friendly blues and greens, high contrast',
            elements: 'icons, charts, learning symbols, clean typography'
        }
    },
    rateLimits: {
        requestsPerMinute: 10,
        delayBetweenRequests: 6000, // 6 seconds
        maxRetries: 3
    }
};

// Niche-specific visual themes
const NICHE_THEMES = {
    'AI/Technology': {
        keywords: ['neural networks', 'artificial intelligence', 'algorithms', 'data streams'],
        colors: 'blue purple cyan gradients, tech noir aesthetic',
        style: 'futuristic, high-tech, digital transformation'
    },
    'Business/Money': {
        keywords: ['growth charts', 'success metrics', 'profit graphs', 'business strategy'],
        colors: 'gold navy blue, premium professional',
        style: 'corporate, upscale, trustworthy'
    },
    'Health/Fitness': {
        keywords: ['wellness', 'vitality', 'healthy lifestyle', 'energy'],
        colors: 'green orange, fresh vibrant',
        style: 'energetic, positive, life-affirming'
    },
    'Self-Help': {
        keywords: ['personal growth', 'transformation', 'success journey', 'empowerment'],
        colors: 'warm sunset gradients, inspiring tones',
        style: 'motivational, uplifting, aspirational'
    },
    'E-commerce': {
        keywords: ['online shopping', 'digital marketplace', 'conversion', 'sales funnel'],
        colors: 'purple teal, modern e-commerce',
        style: 'digital-first, conversion-focused, modern retail'
    }
};

class Illustrator {
    constructor(options = {}) {
        this.apiKey = options.apiKey || process.env.IDEOGRAM_API_KEY;
        this.style = options.style || 'professional';
        this.model = options.model || IMAGE_CONFIG.api.models.latest;
        this.cacheDir = options.cacheDir || 'build/image-cache';
        this.generatePlaceholders = options.placeholders !== false;
        
        if (!this.apiKey) {
            console.warn('⚠️  IDEOGRAM_API_KEY not found. Will generate placeholders.');
        }
        
        this.requestCount = 0;
        this.lastRequestTime = 0;
    }

    async generateBookImages(bookDir, options = {}) {
        console.log('🎨 Starting Illustrator Agent');
        console.log(`📚 Processing book: ${bookDir}`);
        console.log(`🎯 Style: ${this.style}`);
        console.log('');
        
        try {
            // Load book metadata
            const metadata = await this.loadBookMetadata(bookDir);
            const niche = options.niche || metadata.niche || 'Business/Money';
            
            // Create image directories
            const imageDir = path.join(bookDir, 'assets', 'images');
            await fs.mkdir(imageDir, { recursive: true });
            await fs.mkdir(this.cacheDir, { recursive: true });
            
            const results = {
                cover: null,
                chapters: {},
                stats: {
                    total: 0,
                    generated: 0,
                    cached: 0,
                    placeholders: 0,
                    failed: 0
                }
            };
            
            // Generate cover image
            console.log('📖 Generating cover image...');
            results.cover = await this.generateCoverImage(metadata, imageDir, niche);
            results.stats.total++;
            if (results.cover.generated) results.stats.generated++;
            if (results.cover.cached) results.stats.cached++;
            if (results.cover.placeholder) results.stats.placeholders++;
            
            // Generate chapter images
            const chaptersDir = path.join(bookDir, 'chapters');
            const chapterFiles = await this.getChapterFiles(chaptersDir);
            
            console.log(`\n📑 Generating images for ${chapterFiles.length} chapters...`);
            
            for (const [index, chapterFile] of chapterFiles.entries()) {
                console.log(`\n📸 Chapter ${index + 1}/${chapterFiles.length}: ${chapterFile}`);
                
                const chapterPath = path.join(chaptersDir, chapterFile);
                const chapterContent = await fs.readFile(chapterPath, 'utf8');
                const chapterData = this.parseChapter(chapterContent);
                
                const chapterImages = await this.generateChapterImages(
                    chapterData,
                    imageDir,
                    niche,
                    index + 1
                );
                
                results.chapters[chapterFile] = chapterImages;
                results.stats.total += chapterImages.images.length;
                
                chapterImages.images.forEach(img => {
                    if (img.generated) results.stats.generated++;
                    if (img.cached) results.stats.cached++;
                    if (img.placeholder) results.stats.placeholders++;
                    if (img.error) results.stats.failed++;
                });
                
                // Update chapter with image references
                await this.updateChapterWithImages(chapterPath, chapterImages);
            }
            
            // Generate report
            await this.generateReport(bookDir, results);
            
            console.log('\n✅ Illustrator Agent Complete!');
            console.log('📊 Summary:');
            console.log(`   Total images: ${results.stats.total}`);
            console.log(`   Generated: ${results.stats.generated}`);
            console.log(`   From cache: ${results.stats.cached}`);
            console.log(`   Placeholders: ${results.stats.placeholders}`);
            console.log(`   Failed: ${results.stats.failed}`);
            
            return {
                success: true,
                results,
                imageDir
            };
            
        } catch (error) {
            console.error('❌ Illustrator failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadBookMetadata(bookDir) {
        try {
            const metadataPath = path.join(bookDir, 'metadata.json');
            const content = await fs.readFile(metadataPath, 'utf8');
            return JSON.parse(content);
        } catch {
            // Fallback metadata
            return {
                title: 'Untitled Book',
                author: 'Unknown Author',
                subtitle: '',
                description: ''
            };
        }
    }

    async getChapterFiles(chaptersDir) {
        try {
            const files = await fs.readdir(chaptersDir);
            return files
                .filter(f => f.endsWith('.md'))
                .sort((a, b) => {
                    const numA = parseInt(a.match(/\d+/) || '0');
                    const numB = parseInt(b.match(/\d+/) || '0');
                    return numA - numB;
                });
        } catch {
            return [];
        }
    }

    parseChapter(content) {
        const lines = content.split('\n');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : 'Chapter';
        
        // Extract key concepts from chapter
        const concepts = [];
        const headers = content.match(/^#{2,3}\s+(.+)$/gm) || [];
        headers.forEach(h => {
            const cleaned = h.replace(/^#+\s+/, '');
            concepts.push(cleaned);
        });
        
        // Extract first paragraph as context
        const paragraphs = content.match(/^[^#\n].+$/gm) || [];
        const firstParagraph = paragraphs[0] || '';
        
        return {
            title,
            concepts: concepts.slice(0, 5), // Top 5 concepts
            context: firstParagraph.slice(0, 200),
            wordCount: content.split(/\s+/).length
        };
    }

    async generateCoverImage(metadata, imageDir, niche) {
        const cacheKey = this.getCacheKey('cover', metadata.title);
        const cachedPath = path.join(this.cacheDir, `${cacheKey}.png`);
        const outputPath = path.join(imageDir, 'cover.png');
        
        // Check cache first
        if (await this.fileExists(cachedPath)) {
            console.log('   📦 Using cached cover image');
            await fs.copyFile(cachedPath, outputPath);
            return { path: outputPath, cached: true };
        }
        
        // Generate prompt
        const theme = NICHE_THEMES[niche] || NICHE_THEMES['Business/Money'];
        const styleConfig = IMAGE_CONFIG.styles[this.style];
        
        const prompt = this.buildCoverPrompt(metadata, theme, styleConfig);
        
        // Generate image
        const result = await this.generateImage(
            prompt,
            IMAGE_CONFIG.dimensions.cover,
            outputPath
        );
        
        // Cache if successful
        if (result.generated && !result.placeholder) {
            await fs.copyFile(outputPath, cachedPath);
        }
        
        return result;
    }

    buildCoverPrompt(metadata, theme, styleConfig) {
        const elements = [
            'professional ebook cover design',
            styleConfig.basePrompt,
            theme.style,
            `title "${metadata.title}" prominently displayed`,
            metadata.subtitle ? `subtitle "${metadata.subtitle}"` : '',
            'author name at bottom',
            theme.colors,
            styleConfig.colors,
            'high quality, bestseller aesthetic',
            'no mockup, flat design',
            ...theme.keywords.slice(0, 2).map(k => `subtle ${k} imagery`)
        ].filter(Boolean);
        
        return elements.join(', ');
    }

    async generateChapterImages(chapterData, imageDir, niche, chapterNum) {
        const results = {
            header: null,
            images: []
        };
        
        // Generate chapter header image
        const headerPath = path.join(imageDir, `chapter-${String(chapterNum).padStart(2, '0')}-header.png`);
        const headerPrompt = this.buildChapterHeaderPrompt(chapterData, niche);
        
        const headerResult = await this.generateImage(
            headerPrompt,
            IMAGE_CONFIG.dimensions.chapterHeader,
            headerPath
        );
        
        results.header = headerResult;
        results.images.push(headerResult);
        
        // Generate concept illustrations if chapter is long enough
        if (chapterData.wordCount > 1000 && chapterData.concepts.length > 2) {
            const conceptImage = await this.generateConceptImage(
                chapterData.concepts[0],
                imageDir,
                chapterNum,
                niche
            );
            results.images.push(conceptImage);
        }
        
        return results;
    }

    buildChapterHeaderPrompt(chapterData, niche) {
        const theme = NICHE_THEMES[niche] || NICHE_THEMES['Business/Money'];
        const styleConfig = IMAGE_CONFIG.styles[this.style];
        
        const elements = [
            'chapter header illustration',
            styleConfig.basePrompt,
            `representing "${chapterData.title}"`,
            theme.style,
            'banner format, wide aspect ratio',
            styleConfig.colors,
            theme.colors,
            'clean minimal design with space for text overlay',
            chapterData.concepts[0] ? `featuring ${chapterData.concepts[0]} concept` : ''
        ].filter(Boolean);
        
        return elements.join(', ');
    }

    async generateConceptImage(concept, imageDir, chapterNum, niche) {
        const theme = NICHE_THEMES[niche] || NICHE_THEMES['Business/Money'];
        const styleConfig = IMAGE_CONFIG.styles[this.style];
        
        const prompt = [
            'conceptual illustration',
            styleConfig.basePrompt,
            `visualizing "${concept}"`,
            theme.style,
            'clear and informative',
            styleConfig.elements,
            'suitable for inline placement in text'
        ].join(', ');
        
        const outputPath = path.join(
            imageDir,
            `chapter-${String(chapterNum).padStart(2, '0')}-concept.png`
        );
        
        return await this.generateImage(
            prompt,
            IMAGE_CONFIG.dimensions.inline,
            outputPath
        );
    }

    async generateImage(prompt, dimensions, outputPath) {
        // Rate limiting
        await this.enforceRateLimit();
        
        if (!this.apiKey) {
            return await this.generatePlaceholderImage(prompt, dimensions, outputPath);
        }
        
        try {
            console.log(`   🎨 Generating: ${prompt.slice(0, 80)}...`);
            
            const requestBody = {
                image_request: {
                    prompt,
                    aspect_ratio: dimensions.aspect,
                    model: this.model,
                    magic_prompt_option: 'AUTO',
                    style_type: 'DESIGN'
                }
            };
            
            const imageUrl = await this.callIdeogramAPI(requestBody);
            await this.downloadImage(imageUrl, outputPath);
            
            console.log(`   ✅ Generated: ${path.basename(outputPath)}`);
            
            return {
                path: outputPath,
                generated: true,
                placeholder: false,
                prompt: prompt.slice(0, 100) + '...'
            };
            
        } catch (error) {
            console.error(`   ❌ Generation failed: ${error.message}`);
            
            // Fallback to placeholder
            if (this.generatePlaceholders) {
                return await this.generatePlaceholderImage(prompt, dimensions, outputPath);
            }
            
            return {
                path: outputPath,
                error: error.message,
                generated: false
            };
        }
    }

    async callIdeogramAPI(requestBody) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: IMAGE_CONFIG.api.hostname,
                path: IMAGE_CONFIG.api.endpoint,
                method: 'POST',
                headers: {
                    'Api-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            };
            
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        
                        if (res.statusCode !== 200) {
                            throw new Error(`API Error: ${response.error || data}`);
                        }
                        
                        if (response.data && response.data[0] && response.data[0].url) {
                            resolve(response.data[0].url);
                        } else {
                            throw new Error('No image URL in response');
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            
            req.on('error', reject);
            req.write(JSON.stringify(requestBody));
            req.end();
        });
    }

    async downloadImage(url, filepath) {
        return new Promise((resolve, reject) => {
            https.get(url, async (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed: ${response.statusCode}`));
                    return;
                }
                
                const writeStream = require('fs').createWriteStream(filepath);
                
                try {
                    await pipeline(response, writeStream);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }).on('error', reject);
        });
    }

    async generatePlaceholderImage(prompt, dimensions, outputPath) {
        console.log('   🔧 Generating placeholder image');
        
        // Extract key concept from prompt
        const conceptMatch = prompt.match(/representing "([^"]+)"/);
        const concept = conceptMatch ? conceptMatch[1] : 'Placeholder';
        
        // SVG placeholder
        const svg = `
<svg width="${dimensions.width}" height="${dimensions.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="48" font-family="Arial, sans-serif">
    ${concept}
  </text>
  <text x="50%" y="60%" text-anchor="middle" fill="white" font-size="24" font-family="Arial, sans-serif" opacity="0.8">
    ${dimensions.width} × ${dimensions.height}
  </text>
</svg>`;
        
        const svgPath = outputPath.replace('.png', '.svg');
        await fs.writeFile(svgPath, svg);
        
        // In production, convert SVG to PNG using sharp or similar
        // For now, we'll use the SVG directly
        await fs.copyFile(svgPath, outputPath);
        
        return {
            path: outputPath,
            generated: true,
            placeholder: true,
            prompt: concept
        };
    }

    async updateChapterWithImages(chapterPath, images) {
        if (!images.header || images.images.length === 0) return;
        
        let content = await fs.readFile(chapterPath, 'utf8');
        
        // Add header image after title
        if (images.header && images.header.path) {
            const imageName = path.basename(images.header.path);
            const imageMarkdown = `\n![Chapter Header](../assets/images/${imageName})\n`;
            
            // Insert after first heading
            content = content.replace(/^(#\s+.+)$/m, `$1${imageMarkdown}`);
        }
        
        // Add concept images if available
        if (images.images.length > 1) {
            const conceptImage = images.images[1];
            if (conceptImage && conceptImage.path) {
                const imageName = path.basename(conceptImage.path);
                const imageMarkdown = `\n![Concept Illustration](../assets/images/${imageName})\n`;
                
                // Insert after first section
                const firstSection = content.match(/^##\s+.+$/m);
                if (firstSection) {
                    const insertIndex = content.indexOf(firstSection[0]) + firstSection[0].length;
                    content = content.slice(0, insertIndex) + imageMarkdown + content.slice(insertIndex);
                }
            }
        }
        
        await fs.writeFile(chapterPath, content);
    }

    async generateReport(bookDir, results) {
        const report = {
            timestamp: new Date().toISOString(),
            stats: results.stats,
            cover: results.cover,
            chapters: Object.entries(results.chapters).map(([file, data]) => ({
                file,
                images: data.images.length,
                generated: data.images.filter(i => i.generated && !i.placeholder).length,
                placeholders: data.images.filter(i => i.placeholder).length
            })),
            configuration: {
                style: this.style,
                model: this.model,
                apiKeyPresent: !!this.apiKey
            }
        };
        
        const reportPath = path.join(bookDir, 'assets', 'images', 'generation-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Report saved to: ${reportPath}`);
    }

    getCacheKey(...parts) {
        const combined = parts.join('-');
        return crypto.createHash('md5').update(combined).digest('hex');
    }

    async fileExists(filepath) {
        try {
            await fs.access(filepath);
            return true;
        } catch {
            return false;
        }
    }

    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < IMAGE_CONFIG.rateLimits.delayBetweenRequests) {
            const delay = IMAGE_CONFIG.rateLimits.delayBetweenRequests - timeSinceLastRequest;
            console.log(`   ⏳ Rate limiting: waiting ${(delay / 1000).toFixed(1)}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        this.lastRequestTime = Date.now();
        this.requestCount++;
    }

    async generateSocialImages(bookDir, platforms = ['twitter', 'facebook', 'instagram']) {
        console.log('\n📱 Generating social media images...');
        
        const metadata = await this.loadBookMetadata(bookDir);
        const imageDir = path.join(bookDir, 'assets', 'images', 'social');
        await fs.mkdir(imageDir, { recursive: true });
        
        const results = [];
        
        for (const platform of platforms) {
            const dimensions = platform === 'instagram' ? 
                IMAGE_CONFIG.dimensions.square : 
                IMAGE_CONFIG.dimensions.social;
            
            const outputPath = path.join(imageDir, `${platform}-share.png`);
            const prompt = this.buildSocialPrompt(metadata, platform);
            
            const result = await this.generateImage(prompt, dimensions, outputPath);
            results.push({ platform, ...result });
        }
        
        return results;
    }

    buildSocialPrompt(metadata, platform) {
        const platformStyles = {
            twitter: 'clean minimal design for Twitter/X sharing',
            facebook: 'engaging design for Facebook sharing',
            instagram: 'square format eye-catching design for Instagram'
        };
        
        return [
            'social media promotional image',
            platformStyles[platform],
            `for ebook "${metadata.title}"`,
            'compelling call to action',
            'professional quality',
            'optimized for social sharing'
        ].join(', ');
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
    
    if (!options['book-dir'] && !options.chapter) {
        console.error('Usage: illustrator.js --book-dir="path/to/book"');
        console.error('   or: illustrator.js --chapter="path/to/chapter.md" --output="image.png"');
        console.error('\nOptions:');
        console.error('  --style      Visual style (professional, technical, creative, educational)');
        console.error('  --niche      Book niche for themed images');
        console.error('  --social     Generate social media images');
        console.error('  --no-cache   Skip image cache');
        process.exit(1);
    }
    
    const illustrator = new Illustrator({
        style: options.style,
        cacheDir: options['no-cache'] ? null : undefined
    });
    
    (async () => {
        try {
            if (options['book-dir']) {
                const result = await illustrator.generateBookImages(options['book-dir'], {
                    niche: options.niche
                });
                
                if (options.social) {
                    await illustrator.generateSocialImages(options['book-dir']);
                }
                
                process.exit(result.success ? 0 : 1);
            } else if (options.chapter && options.output) {
                // Single image generation
                const content = await fs.readFile(options.chapter, 'utf8');
                const chapterData = illustrator.parseChapter(content);
                const prompt = illustrator.buildChapterHeaderPrompt(chapterData, options.niche || 'Business/Money');
                
                const result = await illustrator.generateImage(
                    prompt,
                    IMAGE_CONFIG.dimensions.chapterHeader,
                    options.output
                );
                
                console.log(result.generated ? '✅ Image generated' : '❌ Generation failed');
                process.exit(result.generated ? 0 : 1);
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = Illustrator;