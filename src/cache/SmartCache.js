/**
 * Smart Cache Layer
 * 
 * Intelligent caching for expensive operations
 * Supports Redis and in-memory fallback
 */

const Redis = require('redis');
const crypto = require('crypto');
const { promisify } = require('util');
const LRU = require('lru-cache');
const { getMetricsCollector } = require('../monitoring/MetricsCollector');

class SmartCache {
    constructor(options = {}) {
        this.options = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                prefix: 'ebook:cache:',
                ttl: 3600 // 1 hour default
            },
            memory: {
                max: 500, // Max items
                maxAge: 1000 * 60 * 60, // 1 hour
                updateAgeOnGet: true
            },
            layers: ['memory', 'redis'], // Cache layers in order
            compression: true,
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.memoryCache = new LRU(this.options.memory);
        this.redisClient = null;
        this.connected = false;
    }

    async connect() {
        if (this.connected) return;
        
        try {
            // Connect to Redis
            this.redisClient = Redis.createClient({
                host: this.options.redis.host,
                port: this.options.redis.port,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.warn('⚠️  Redis connection refused, using memory cache only');
                        return undefined; // Stop retrying
                    }
                    if (options.total_retry_time > 1000 * 60) {
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });
            
            // Promisify Redis methods
            this.redis = {
                get: promisify(this.redisClient.get).bind(this.redisClient),
                set: promisify(this.redisClient.set).bind(this.redisClient),
                del: promisify(this.redisClient.del).bind(this.redisClient),
                exists: promisify(this.redisClient.exists).bind(this.redisClient),
                expire: promisify(this.redisClient.expire).bind(this.redisClient),
                keys: promisify(this.redisClient.keys).bind(this.redisClient)
            };
            
            // Wait for connection
            await new Promise((resolve, reject) => {
                this.redisClient.on('ready', () => {
                    console.log('✅ Redis cache connected');
                    this.connected = true;
                    resolve();
                });
                
                this.redisClient.on('error', (err) => {
                    console.warn('⚠️  Redis cache error:', err.message);
                    // Don't reject, just use memory cache
                    resolve();
                });
                
                setTimeout(() => resolve(), 2000); // Timeout after 2s
            });
            
        } catch (error) {
            console.warn('⚠️  Failed to connect to Redis, using memory cache only');
        }
    }

    /**
     * Get value from cache
     */
    async get(key, options = {}) {
        const fullKey = this.buildKey(key);
        const startTime = Date.now();
        
        // Try each cache layer
        for (const layer of this.options.layers) {
            try {
                const value = await this.getFromLayer(layer, fullKey);
                if (value !== null && value !== undefined) {
                    const duration = Date.now() - startTime;
                    this.metrics.recordCacheHit(layer);
                    
                    // Promote to higher layers if needed
                    if (options.promote !== false) {
                        await this.promoteToHigherLayers(layer, fullKey, value);
                    }
                    
                    return this.deserialize(value);
                }
            } catch (error) {
                console.error(`Cache ${layer} get error:`, error);
            }
        }
        
        this.metrics.recordCacheMiss('all');
        return null;
    }

    /**
     * Set value in cache
     */
    async set(key, value, options = {}) {
        const fullKey = this.buildKey(key);
        const ttl = options.ttl || this.options.redis.ttl;
        const serialized = this.serialize(value);
        
        // Set in all configured layers
        const promises = [];
        for (const layer of this.options.layers) {
            promises.push(this.setInLayer(layer, fullKey, serialized, ttl));
        }
        
        await Promise.allSettled(promises);
    }

    /**
     * Delete from cache
     */
    async del(key) {
        const fullKey = this.buildKey(key);
        
        // Delete from all layers
        const promises = [];
        for (const layer of this.options.layers) {
            promises.push(this.deleteFromLayer(layer, fullKey));
        }
        
        await Promise.allSettled(promises);
    }

    /**
     * Clear entire cache
     */
    async clear(pattern = '*') {
        // Clear memory cache
        if (pattern === '*') {
            this.memoryCache.reset();
        } else {
            // Clear matching keys
            const keys = this.memoryCache.keys();
            for (const key of keys) {
                if (this.matchesPattern(key, pattern)) {
                    this.memoryCache.del(key);
                }
            }
        }
        
        // Clear Redis cache
        if (this.connected && this.redis) {
            const keys = await this.redis.keys(`${this.options.redis.prefix}${pattern}`);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        }
    }

    /**
     * Cache wrapper for functions
     */
    async wrap(key, fn, options = {}) {
        // Check cache first
        const cached = await this.get(key);
        if (cached !== null && cached !== undefined) {
            return cached;
        }
        
        // Execute function
        const result = await fn();
        
        // Cache result
        if (result !== null && result !== undefined) {
            await this.set(key, result, options);
        }
        
        return result;
    }

    /**
     * Batch get multiple keys
     */
    async mget(keys) {
        const results = {};
        
        // Try memory cache first
        const memoryMisses = [];
        for (const key of keys) {
            const fullKey = this.buildKey(key);
            const value = this.memoryCache.get(fullKey);
            if (value !== undefined) {
                results[key] = this.deserialize(value);
                this.metrics.recordCacheHit('memory');
            } else {
                memoryMisses.push(key);
            }
        }
        
        // Try Redis for misses
        if (memoryMisses.length > 0 && this.connected && this.redis) {
            const fullKeys = memoryMisses.map(k => this.buildKey(k));
            const values = await Promise.all(fullKeys.map(k => this.redis.get(k)));
            
            for (let i = 0; i < memoryMisses.length; i++) {
                const key = memoryMisses[i];
                const value = values[i];
                if (value !== null) {
                    results[key] = this.deserialize(value);
                    this.metrics.recordCacheHit('redis');
                    
                    // Promote to memory cache
                    this.memoryCache.set(fullKeys[i], value);
                } else {
                    this.metrics.recordCacheMiss('redis');
                }
            }
        }
        
        return results;
    }

    // Private methods
    
    buildKey(key) {
        if (typeof key === 'object') {
            // Generate hash for object keys
            const hash = crypto.createHash('sha256')
                .update(JSON.stringify(key))
                .digest('hex')
                .substring(0, 16);
            return `obj:${hash}`;
        }
        return String(key);
    }

    serialize(value) {
        if (this.options.compression) {
            return JSON.stringify(value);
        }
        return value;
    }

    deserialize(value) {
        if (this.options.compression && typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    }

    async getFromLayer(layer, key) {
        switch (layer) {
            case 'memory':
                return this.memoryCache.get(key);
            
            case 'redis':
                if (this.connected && this.redis) {
                    return await this.redis.get(`${this.options.redis.prefix}${key}`);
                }
                return null;
            
            default:
                return null;
        }
    }

    async setInLayer(layer, key, value, ttl) {
        switch (layer) {
            case 'memory':
                this.memoryCache.set(key, value, ttl * 1000);
                break;
            
            case 'redis':
                if (this.connected && this.redis) {
                    await this.redis.set(
                        `${this.options.redis.prefix}${key}`,
                        value,
                        'EX',
                        ttl
                    );
                }
                break;
        }
    }

    async deleteFromLayer(layer, key) {
        switch (layer) {
            case 'memory':
                this.memoryCache.del(key);
                break;
            
            case 'redis':
                if (this.connected && this.redis) {
                    await this.redis.del(`${this.options.redis.prefix}${key}`);
                }
                break;
        }
    }

    async promoteToHigherLayers(foundLayer, key, value) {
        const layerIndex = this.options.layers.indexOf(foundLayer);
        if (layerIndex > 0) {
            // Promote to all higher priority layers
            for (let i = 0; i < layerIndex; i++) {
                await this.setInLayer(this.options.layers[i], key, value, this.options.redis.ttl);
            }
        }
    }

    matchesPattern(key, pattern) {
        // Simple glob pattern matching
        const regex = new RegExp(
            '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
        );
        return regex.test(key);
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            memory: {
                size: this.memoryCache.length,
                maxSize: this.options.memory.max,
                hits: this.memoryCache.hits || 0,
                misses: this.memoryCache.misses || 0
            },
            redis: {
                connected: this.connected
            }
        };
    }

    /**
     * Disconnect from cache
     */
    async disconnect() {
        if (this.redisClient) {
            this.redisClient.quit();
            this.connected = false;
        }
        this.memoryCache.reset();
    }
}

// Singleton instance
let instance;

function getSmartCache(options) {
    if (!instance) {
        instance = new SmartCache(options);
    }
    return instance;
}

module.exports = {
    SmartCache,
    getSmartCache
};