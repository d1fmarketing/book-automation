#!/usr/bin/env node

/**
 * Illustrator Agent
 * 
 * Generates images for ebooks using Ideogram API
 * Includes 429 retry handling and response caching
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { getRateLimiter } = require('../src/middleware/RateLimiter');

class Illustrator {
    constructor(options = {}) {
        this.apiKey = process.env.IDEOGRAM_API_KEY || process.env.IDEO_API_KEY;
        this.style = options.style || 'professional';
        this.baseUrl = 'https://api.ideogram.ai/v1';
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: options.maxRetries || 5,
            initialDelay: options.initialDelay || 1000,
            maxDelay: options.maxDelay || 60000,
            backoffMultiplier: options.backoffMultiplier || 2
        };
        
        // Cache configuration
        this.cacheConfig = {
            enabled: options.cacheEnabled !== false,
            ttl: options.cacheTTL || 24 * 60 * 60 * 1000, // 24 hours
            dir: options.cacheDir || path.join(__dirname, '../.cache/ideogram')
        };
        
        // Rate limiter
        this.rateLimiter = null;
        
        // Initialize cache directory
        this.initCache();
    }
    
    async initCache() {
        if (this.cacheConfig.enabled) {
            await fs.mkdir(this.cacheConfig.dir, { recursive: true });
        }
    }
    
    async initialize() {
        if (!this.rateLimiter) {
            this.rateLimiter = getRateLimiter();
        }
    }

    async generateBookImages(bookDir) {
        console.log(`🎨 Generating images for book in: ${bookDir}`);
        
        try {
            await this.initialize();
            
            // Create assets directory
            const assetsDir = path.join(bookDir, 'assets', 'images');
            await fs.mkdir(assetsDir, { recursive: true });
            
            // Load book metadata for context
            const metadata = await this.loadBookMetadata(bookDir);
            
            // Generate cover image
            const coverPath = path.join(assetsDir, 'cover.png');
            const coverPrompt = this.createCoverPrompt(metadata);
            const coverImage = await this.generateImage(coverPrompt, {
                aspect_ratio: '2:3', // Book cover ratio
                style_type: 'photographic'
            });
            
            if (coverImage) {
                await fs.writeFile(coverPath, coverImage);
                console.log(`   ✅ Cover image created: ${coverPath}`);
            } else {
                // Fallback to placeholder
                await this.createPlaceholderCover(coverPath, metadata);
            }
            
            // Generate chapter images if needed
            const chapters = await this.getChapterList(bookDir);
            const generatedImages = [];
            
            for (let i = 0; i < Math.min(chapters.length, 3); i++) {
                const chapterData = await this.loadChapter(bookDir, chapters[i]);
                const chapterPrompt = this.createChapterPrompt(chapterData, i + 1);
                
                const chapterImagePath = path.join(assetsDir, `chapter-${i + 1}.png`);
                const chapterImage = await this.generateImage(chapterPrompt, {
                    aspect_ratio: '16:9',
                    style_type: this.style
                });
                
                if (chapterImage) {
                    await fs.writeFile(chapterImagePath, chapterImage);
                    console.log(`   ✅ Chapter ${i + 1} image created`);
                    generatedImages.push(chapterImagePath);
                }
            }
            
            return {
                success: true,
                images: {
                    cover: coverPath,
                    chapters: generatedImages.length,
                    generated: generatedImages
                }
            };
            
        } catch (error) {
            console.error('❌ Error generating images:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async generateImage(prompt, options = {}) {
        // Check cache first
        const cacheKey = this.getCacheKey(prompt, options);
        const cachedImage = await this.getFromCache(cacheKey);
        
        if (cachedImage) {
            console.log('   📦 Using cached image');
            return cachedImage;
        }
        
        // Check rate limits
        if (this.rateLimiter) {
            const canProceed = await this.rateLimiter.checkLimit('ideogram', 'request');
            if (!canProceed.allowed) {
                console.warn(`   ⚠️  Rate limit reached: ${canProceed.reason}`);
                return null;
            }
        }
        
        // API implementation with retry logic
        if (!this.apiKey) {
            console.warn('   ⚠️  No Ideogram API key - using placeholder');
            return null;
        }
        
        const requestData = {
            prompt,
            aspect_ratio: options.aspect_ratio || '1:1',
            model: 'V_2',
            magic_prompt_option: 'AUTO',
            style_type: options.style_type || this.style,
            ...options
        };
        
        try {
            const response = await this.makeRequestWithRetry('/generate', requestData);
            
            if (response && response.data && response.data.length > 0) {
                const imageUrl = response.data[0].url;
                const imageBuffer = await this.downloadImage(imageUrl);
                
                // Cache the result
                await this.saveToCache(cacheKey, imageBuffer);
                
                // Track usage
                if (this.rateLimiter) {
                    await this.rateLimiter.recordUsage('ideogram', {
                        requests: 1
                    });
                }
                
                return imageBuffer;
            }
            
            return null;
            
        } catch (error) {
            console.error(`   ❌ Failed to generate image: ${error.message}`);
            return null;
        }
    }
    
    async makeRequestWithRetry(endpoint, data, retryCount = 0) {
        try {
            const response = await axios.post(
                `${this.baseUrl}${endpoint}`,
                data,
                {
                    headers: {
                        'Api-Key': this.apiKey,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );
            
            return response.data;
            
        } catch (error) {
            // Handle 429 rate limit errors
            if (error.response && error.response.status === 429) {
                if (retryCount < this.retryConfig.maxRetries) {
                    const delay = this.calculateBackoff(retryCount);
                    console.log(`   ⏳ Rate limited - waiting ${delay}ms before retry ${retryCount + 1}`);
                    
                    await this.sleep(delay);
                    return this.makeRequestWithRetry(endpoint, data, retryCount + 1);
                } else {
                    throw new Error('Max retries exceeded for rate limit');
                }
            }
            
            // Handle other retryable errors
            if (this.isRetryableError(error) && retryCount < this.retryConfig.maxRetries) {
                const delay = this.calculateBackoff(retryCount);
                console.log(`   🔄 Retrying after ${delay}ms (attempt ${retryCount + 1})`);
                
                await this.sleep(delay);
                return this.makeRequestWithRetry(endpoint, data, retryCount + 1);
            }
            
            throw error;
        }
    }
    
    calculateBackoff(retryCount) {
        const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount),
            this.retryConfig.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return Math.floor(delay + jitter);
    }
    
    isRetryableError(error) {
        if (!error.response) {
            // Network errors are retryable
            return true;
        }
        
        const status = error.response.status;
        // Retry on 5xx errors and specific 4xx errors
        return status >= 500 || status === 429 || status === 408;
    }
    
    async downloadImage(url) {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        return Buffer.from(response.data);
    }
    
    getCacheKey(prompt, options) {
        const data = JSON.stringify({ prompt, options });
        return crypto.createHash('md5').update(data).digest('hex');
    }
    
    async getFromCache(key) {
        if (!this.cacheConfig.enabled) return null;
        
        try {
            const cachePath = path.join(this.cacheConfig.dir, `${key}.png`);
            const stats = await fs.stat(cachePath);
            
            // Check if cache is still valid
            const age = Date.now() - stats.mtime.getTime();
            if (age > this.cacheConfig.ttl) {
                await fs.unlink(cachePath);
                return null;
            }
            
            return await fs.readFile(cachePath);
        } catch {
            return null;
        }
    }
    
    async saveToCache(key, buffer) {
        if (!this.cacheConfig.enabled) return;
        
        try {
            const cachePath = path.join(this.cacheConfig.dir, `${key}.png`);
            await fs.writeFile(cachePath, buffer);
        } catch (error) {
            console.warn(`Failed to cache image: ${error.message}`);
        }
    }
    
    createCoverPrompt(metadata) {
        const title = metadata.title || 'Untitled Book';
        const genre = metadata.genre || 'business';
        const style = metadata.coverStyle || this.style;
        
        return `Professional book cover for "${title}". ${genre} genre. ${style} style. High quality, eye-catching design suitable for ebook marketplaces. No text or typography.`;
    }
    
    createChapterPrompt(chapterData, chapterNumber) {
        const theme = this.extractChapterTheme(chapterData);
        return `Illustration for book chapter ${chapterNumber}: ${theme}. ${this.style} style. Professional quality, relevant to content.`;
    }
    
    extractChapterTheme(chapterData) {
        // Extract theme from chapter title or first paragraph
        const lines = chapterData.split('\n');
        const titleLine = lines.find(line => line.startsWith('#'));
        
        if (titleLine) {
            return titleLine.replace(/^#+\s*/, '').trim();
        }
        
        return 'Business concept illustration';
    }
    
    async loadBookMetadata(bookDir) {
        try {
            const metadataPath = path.join(bookDir, 'metadata.json');
            const content = await fs.readFile(metadataPath, 'utf8');
            return JSON.parse(content);
        } catch {
            return {
                title: 'Untitled Book',
                genre: 'business',
                style: 'professional'
            };
        }
    }
    
    async loadChapter(bookDir, chapterFile) {
        try {
            const chapterPath = path.join(bookDir, chapterFile);
            return await fs.readFile(chapterPath, 'utf8');
        } catch {
            return '';
        }
    }
    
    async createPlaceholderCover(coverPath, metadata) {
        // Create a simple placeholder with base64 - same as before
        const coverPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAACWCAYAAAAouC1GAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAKpSURBVHic7d1BbhNBFATQmggJCYkFB+AAnIAbcAJuwAE4ABskFkhIiPzZzKJr3FXO+/tJafend6uqp2fGSZZlWZZlWZZlWZZlWZZlWZZlWZZlWf8lnZ2dnfd9f5EkSU7VkiQH/d3PfX+Zf3K0v5Z+7uu+78+ur6+/T51xpL8YJcnt1PWO9fcdx+dfkjSO47skL5OcT112Sr3fMcfPJUnTNE2SfE3yepIhR6r9jjl+Hvo8z/M8J3mT5N0kQ45U+x1z/Dz4JxiGYWia5kOSj5MMqar9jjl+Vn2SdV3XJPmU5PMkQ6pqv2OOn1XTXLPdbleSL0nuHnyU+6n9jjl+Vh0L27btVKdvU+13zPGz+mJhHMepKEr7HXP8PHxZfA+13zHHT2EMRRhDKMIYQhHGEIowhvh3bvPKe5J3q/2OOX4Koyp513qt0u+Y42fVLKvVS8Wu0vJuNVlt+R0//Hbfd7Xfd7Xr55+zrNplu3+zLMvLHN5yWZP8mKQNUe33qvZzGo3K6/QF6M2+789PTk6+NU2TPGJByVn4T7Y7Ozs77/v+QXenV/4Sdnp6+nNZlsdJ3iZ5keRpkiePOON/cJvDf8H5M8mPJF+SvH+0K3fO+ItQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjCGEIRxhCKMIZQhDGEIowhFGEMoQhjCEUYQyjiN+inxNLcRBYbAAAAAElFTkSuQmCC';
        
        await fs.writeFile(coverPath, Buffer.from(coverPngBase64, 'base64'));
        console.log(`   📋 Placeholder cover created: ${coverPath}`);
    }
    
    async getChapterList(bookDir) {
        try {
            const files = await fs.readdir(bookDir);
            return files.filter(f => f.match(/^chapter-\d+\.md$/)).sort();
        } catch {
            return [];
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async cleanCache() {
        if (!this.cacheConfig.enabled) return;
        
        console.log('🧹 Cleaning image cache...');
        
        try {
            const files = await fs.readdir(this.cacheConfig.dir);
            let cleaned = 0;
            
            for (const file of files) {
                const filePath = path.join(this.cacheConfig.dir, file);
                const stats = await fs.stat(filePath);
                const age = Date.now() - stats.mtime.getTime();
                
                if (age > this.cacheConfig.ttl) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            }
            
            console.log(`   ✅ Cleaned ${cleaned} expired cache entries`);
        } catch (error) {
            console.error(`   ❌ Cache cleanup failed: ${error.message}`);
        }
    }
}

// Export for use in pipeline
module.exports = Illustrator;

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Illustrator Agent - Ideogram Image Generator

Usage:
  illustrator.js <book-dir> [options]
  illustrator.js --clean-cache

Options:
  --style <type>      Image style (professional, artistic, photographic)
  --cache-ttl <ms>    Cache TTL in milliseconds
  --no-cache          Disable caching
  --api-key <key>     Ideogram API key (or set IDEOGRAM_API_KEY)

Examples:
  illustrator.js build/books/my-book
  illustrator.js build/books/my-book --style artistic
  illustrator.js --clean-cache
        `);
        process.exit(0);
    }
    
    // Parse options
    const options = {};
    let bookDir = null;
    let cleanCache = false;
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--clean-cache') {
            cleanCache = true;
        } else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[++i];
            
            switch (key) {
                case 'style':
                    options.style = value;
                    break;
                case 'cache-ttl':
                    options.cacheTTL = parseInt(value);
                    break;
                case 'no-cache':
                    options.cacheEnabled = false;
                    i--; // No value for this flag
                    break;
                case 'api-key':
                    process.env.IDEOGRAM_API_KEY = value;
                    break;
            }
        } else {
            bookDir = arg;
        }
    }
    
    const illustrator = new Illustrator(options);
    
    (async () => {
        try {
            if (cleanCache) {
                await illustrator.cleanCache();
            } else if (bookDir) {
                const result = await illustrator.generateBookImages(bookDir);
                console.log('\nResult:', JSON.stringify(result, null, 2));
                process.exit(result.success ? 0 : 1);
            } else {
                console.error('No book directory specified');
                process.exit(1);
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}