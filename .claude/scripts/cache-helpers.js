// cache-helpers.js - Smart caching utilities

/**
 * Get cached data or fetch if not available
 * @param {Object} cache - Cache client (e.g., upstash_mcp)
 * @param {string} key - Cache key
 * @param {Function} fetchFn - Function to fetch data if not cached
 * @param {number} ttl - Time to live in seconds (default: 3600)
 */
async function getCachedOrFetch(cache, key, fetchFn, ttl = 3600) {
  try {
    // Try to get from cache
    const cached = await cache.get(key);
    if (cached) {
      console.log(`Cache hit: ${key}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn(`Cache read error: ${err.message}`);
  }

  // Cache miss - fetch data
  console.log(`Cache miss: ${key}`);
  const data = await fetchFn();
  
  // Store in cache
  try {
    await cache.set(key, JSON.stringify(data), { ex: ttl });
  } catch (err) {
    console.warn(`Cache write error: ${err.message}`);
  }
  
  return data;
}

/**
 * Process items in batches to avoid rate limits
 * @param {Array} items - Items to process
 * @param {Function} processFn - Function to process each item
 * @param {number} batchSize - Number of items per batch
 * @param {number} delayMs - Delay between batches in milliseconds
 */
async function batchProcess(items, processFn, batchSize = 10, delayMs = 1000) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    
    const batchResults = await Promise.all(
      batch.map(item => processFn(item).catch(err => ({ error: err.message, item })))
    );
    
    results.push(...batchResults);
    
    // Delay between batches (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}

module.exports = {
  getCachedOrFetch,
  batchProcess
};
