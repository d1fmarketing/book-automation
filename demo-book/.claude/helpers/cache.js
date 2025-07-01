/**
 * Cache Helpers for Claude Elite
 * Provides caching utilities with Upstash Redis
 */

const crypto = require('crypto');

// Load environment
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// Cache configuration
const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || '3600');
const CACHE_PREFIX = 'claude:elite:';

// In-memory fallback cache
const memoryCache = new Map();

// Initialize Redis client
let redisClient = null;

async function initRedis() {
  if (redisClient) return redisClient;
  
  const url = process.env.UPSTASH_REDIS_URL;
  const token = process.env.UPSTASH_REDIS_TOKEN;
  
  if (!url || !token) {
    console.warn('⚠️  Upstash Redis not configured, using in-memory cache');
    return null;
  }
  
  try {
    // Use fetch-based Upstash client for edge compatibility
    redisClient = {
      async get(key) {
        const response = await fetch(`${url}/get/${key}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        return data.result;
      },
      
      async set(key, value, ttl) {
        const response = await fetch(`${url}/set/${key}`, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ value, ex: ttl })
        });
        return response.ok;
      },
      
      async del(key) {
        const response = await fetch(`${url}/del/${key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        return response.ok;
      },
      
      async keys(pattern) {
        const response = await fetch(`${url}/keys/${pattern}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        return data.result || [];
      }
    };
    
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to initialize Redis:', error.message);
    return null;
  }
}

// Generate cache key
function generateKey(namespace, ...args) {
  const hash = crypto
    .createHash('md5')
    .update(args.join(':'))
    .digest('hex');
  
  return `${CACHE_PREFIX}${namespace}:${hash}`;
}

// Get from cache
async function get(namespace, ...args) {
  const key = generateKey(namespace, ...args);
  
  try {
    const redis = await initRedis();
    
    if (redis) {
      const value = await redis.get(key);
      if (value) {
        return JSON.parse(value);
      }
    } else {
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
    }
  } catch (error) {
    console.error('Cache get error:', error);
  }
  
  return null;
}

// Set in cache
async function set(namespace, args, value, ttl = CACHE_TTL) {
  const key = generateKey(namespace, ...args);
  
  try {
    const redis = await initRedis();
    
    if (redis) {
      await redis.set(key, JSON.stringify(value), ttl);
    } else {
      // Fallback to memory cache
      memoryCache.set(key, {
        value,
        expires: Date.now() + (ttl * 1000)
      });
      
      // Clean up expired entries
      if (memoryCache.size > 1000) {
        for (const [k, v] of memoryCache.entries()) {
          if (v.expires < Date.now()) {
            memoryCache.delete(k);
          }
        }
      }
    }
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

// Delete from cache
async function del(namespace, ...args) {
  const key = generateKey(namespace, ...args);
  
  try {
    const redis = await initRedis();
    
    if (redis) {
      await redis.del(key);
    } else {
      memoryCache.delete(key);
    }
  } catch (error) {
    console.error('Cache delete error:', error);
  }
}

// Clear namespace
async function clear(namespace) {
  const pattern = `${CACHE_PREFIX}${namespace}:*`;
  
  try {
    const redis = await initRedis();
    
    if (redis) {
      const keys = await redis.keys(pattern);
      for (const key of keys) {
        await redis.del(key);
      }
    } else {
      // Clear memory cache
      for (const key of memoryCache.keys()) {
        if (key.startsWith(`${CACHE_PREFIX}${namespace}:`)) {
          memoryCache.delete(key);
        }
      }
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// Cached function wrapper
function cached(fn, namespace, ttl = CACHE_TTL) {
  return async function(...args) {
    // Try to get from cache
    const cached = await get(namespace, ...args);
    if (cached !== null) {
      return cached;
    }
    
    // Execute function
    const result = await fn(...args);
    
    // Store in cache
    await set(namespace, args, result, ttl);
    
    return result;
  };
}

// Batch processing with caching
async function batchProcess(items, processor, options = {}) {
  const {
    namespace = 'batch',
    concurrency = 5,
    ttl = CACHE_TTL,
    onProgress = () => {}
  } = options;
  
  const results = [];
  const queue = [...items];
  let processed = 0;
  
  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    
    const batchPromises = batch.map(async (item) => {
      // Check cache first
      const cached = await get(namespace, item);
      if (cached !== null) {
        processed++;
        onProgress(processed, items.length);
        return { item, result: cached, cached: true };
      }
      
      // Process item
      try {
        const result = await processor(item);
        
        // Cache result
        await set(namespace, [item], result, ttl);
        
        processed++;
        onProgress(processed, items.length);
        
        return { item, result, cached: false };
      } catch (error) {
        processed++;
        onProgress(processed, items.length);
        
        return { item, error: error.message, cached: false };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

// Cache statistics
async function stats() {
  const redis = await initRedis();
  
  if (redis) {
    try {
      const keys = await redis.keys(`${CACHE_PREFIX}*`);
      return {
        type: 'redis',
        keys: keys.length,
        connected: true
      };
    } catch (error) {
      return {
        type: 'redis',
        connected: false,
        error: error.message
      };
    }
  } else {
    let totalSize = 0;
    let activeKeys = 0;
    
    for (const [key, value] of memoryCache.entries()) {
      if (value.expires > Date.now()) {
        activeKeys++;
        totalSize += JSON.stringify(value).length;
      }
    }
    
    return {
      type: 'memory',
      keys: activeKeys,
      totalKeys: memoryCache.size,
      sizeBytes: totalSize
    };
  }
}

// Export cache interface
module.exports = {
  get,
  set,
  del,
  clear,
  cached,
  batchProcess,
  stats,
  generateKey
};

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  
  async function cli() {
    switch (command) {
      case 'stats':
        const s = await stats();
        console.log('Cache Statistics:', s);
        break;
        
      case 'clear':
        const namespace = process.argv[3];
        if (!namespace) {
          console.error('Please provide a namespace to clear');
          process.exit(1);
        }
        await clear(namespace);
        console.log(`Cleared namespace: ${namespace}`);
        break;
        
      case 'test':
        console.log('Testing cache...');
        await set('test', ['key1'], { value: 'test data' }, 60);
        const result = await get('test', 'key1');
        console.log('Set and retrieved:', result);
        const s2 = await stats();
        console.log('Stats after test:', s2);
        break;
        
      default:
        console.log('Usage:');
        console.log('  node cache.js stats');
        console.log('  node cache.js clear <namespace>');
        console.log('  node cache.js test');
    }
  }
  
  cli().catch(console.error);
}