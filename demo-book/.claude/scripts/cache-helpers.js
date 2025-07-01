#!/usr/bin/env node

/**
 * Claude Elite Smart Cache Helpers
 * Optimizes API usage and improves performance through intelligent caching
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class CacheManager {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', 'cache');
        this.metadataFile = path.join(this.cacheDir, 'metadata.json');
        this.maxCacheSize = 100 * 1024 * 1024; // 100MB
        this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    }

    async init() {
        await fs.mkdir(this.cacheDir, { recursive: true });
        await this.loadMetadata();
    }

    async loadMetadata() {
        try {
            const data = await fs.readFile(this.metadataFile, 'utf8');
            this.metadata = JSON.parse(data);
        } catch {
            this.metadata = {
                entries: {},
                totalSize: 0,
                hitCount: 0,
                missCount: 0
            };
        }
    }

    async saveMetadata() {
        await fs.writeFile(this.metadataFile, JSON.stringify(this.metadata, null, 2));
    }

    generateKey(type, data) {
        const hash = crypto.createHash('sha256');
        hash.update(type);
        hash.update(JSON.stringify(data));
        return hash.digest('hex');
    }

    async get(type, keyData) {
        const key = this.generateKey(type, keyData);
        const entry = this.metadata.entries[key];

        if (!entry) {
            this.metadata.missCount++;
            await this.saveMetadata();
            return null;
        }

        // Check if expired
        if (Date.now() - entry.created > this.maxAge) {
            await this.remove(key);
            this.metadata.missCount++;
            await this.saveMetadata();
            return null;
        }

        try {
            const filePath = path.join(this.cacheDir, key);
            const data = await fs.readFile(filePath, 'utf8');
            
            this.metadata.hitCount++;
            entry.lastAccessed = Date.now();
            entry.accessCount++;
            await this.saveMetadata();
            
            return JSON.parse(data);
        } catch (error) {
            console.error('Cache read error:', error);
            await this.remove(key);
            return null;
        }
    }

    async set(type, keyData, value) {
        const key = this.generateKey(type, keyData);
        const data = JSON.stringify(value);
        const size = Buffer.byteLength(data);

        // Check cache size limit
        if (this.metadata.totalSize + size > this.maxCacheSize) {
            await this.evictOldest();
        }

        const filePath = path.join(this.cacheDir, key);
        await fs.writeFile(filePath, data);

        this.metadata.entries[key] = {
            type,
            size,
            created: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 1
        };

        this.metadata.totalSize += size;
        await this.saveMetadata();
    }

    async remove(key) {
        const entry = this.metadata.entries[key];
        if (!entry) return;

        try {
            const filePath = path.join(this.cacheDir, key);
            await fs.unlink(filePath);
        } catch {}

        this.metadata.totalSize -= entry.size;
        delete this.metadata.entries[key];
    }

    async evictOldest() {
        const entries = Object.entries(this.metadata.entries);
        
        // Sort by last accessed time
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest 20% of entries
        const toRemove = Math.ceil(entries.length * 0.2);
        
        for (let i = 0; i < toRemove; i++) {
            await this.remove(entries[i][0]);
        }
    }

    async clear() {
        const files = await fs.readdir(this.cacheDir);
        
        for (const file of files) {
            if (file !== 'metadata.json') {
                await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
            }
        }

        this.metadata = {
            entries: {},
            totalSize: 0,
            hitCount: 0,
            missCount: 0
        };
        
        await this.saveMetadata();
    }

    async stats() {
        const totalEntries = Object.keys(this.metadata.entries).length;
        const hitRate = this.metadata.hitCount / (this.metadata.hitCount + this.metadata.missCount) || 0;
        
        return {
            totalEntries,
            totalSize: this.formatSize(this.metadata.totalSize),
            hitCount: this.metadata.hitCount,
            missCount: this.metadata.missCount,
            hitRate: `${(hitRate * 100).toFixed(2)}%`,
            cacheTypes: this.getCacheTypeStats()
        };
    }

    getCacheTypeStats() {
        const types = {};
        
        for (const entry of Object.values(this.metadata.entries)) {
            types[entry.type] = (types[entry.type] || 0) + 1;
        }
        
        return types;
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size > 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
}

// CLI Interface
async function main() {
    const cache = new CacheManager();
    await cache.init();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'stats':
            const stats = await cache.stats();
            console.log('\n📊 Cache Statistics\n');
            console.log(`Total Entries: ${stats.totalEntries}`);
            console.log(`Total Size: ${stats.totalSize}`);
            console.log(`Hit Rate: ${stats.hitRate}`);
            console.log(`Hits: ${stats.hitCount}`);
            console.log(`Misses: ${stats.missCount}`);
            console.log('\nCache Types:');
            for (const [type, count] of Object.entries(stats.cacheTypes)) {
                console.log(`  ${type}: ${count}`);
            }
            break;
            
        case 'clear':
            await cache.clear();
            console.log('✅ Cache cleared successfully');
            break;
            
        case 'test':
            // Test cache functionality
            console.log('🧪 Testing cache...');
            
            const testKey = { test: 'data', timestamp: Date.now() };
            const testValue = { result: 'success', data: [1, 2, 3] };
            
            await cache.set('test', testKey, testValue);
            console.log('✅ Set test value');
            
            const retrieved = await cache.get('test', testKey);
            console.log('✅ Retrieved:', retrieved);
            
            const hitRate = await cache.stats();
            console.log('✅ Stats:', hitRate);
            break;
            
        default:
            console.log(`
Claude Elite Cache Manager

Usage:
  node cache-helpers.js <command>

Commands:
  stats    Show cache statistics
  clear    Clear all cache entries
  test     Test cache functionality

Cache Location: ${cache.cacheDir}
            `);
    }
}

// Export for use in other modules
module.exports = CacheManager;

// Run CLI if executed directly
if (require.main === module) {
    main().catch(console.error);
}