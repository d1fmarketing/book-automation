const fetch = (...a) => import('node-fetch').then(({default: f}) => f(...a));
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { updateRateLimit } = require('../scripts/check-env');
const { createCircuitBreaker, fallbacks } = require('../utils/circuit-breaker');

// Cache configuration
const CACHE_DIR = path.join(__dirname, '../context/cache');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Create cache directory if it doesn't exist
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Generate cache key from topic
function getCacheKey(topic) {
  return crypto.createHash('md5').update(topic.toLowerCase()).digest('hex');
}

// Get cached research if available and not expired
async function getCachedResearch(topic) {
  const cacheKey = getCacheKey(topic);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  try {
    const cacheData = await fs.readFile(cachePath, 'utf-8');
    const cached = JSON.parse(cacheData);
    
    // Check if cache is still valid
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      console.log(`📦 Using cached research (${Math.floor(age / 1000 / 60)} minutes old)`);
      return cached.data;
    } else {
      console.log(`🗑️  Cache expired (${Math.floor(age / 1000 / 60 / 60)} hours old)`);
    }
  } catch (error) {
    // Cache miss or error
  }
  
  return null;
}

// Save research to cache
async function saveToCache(topic, data) {
  await ensureCacheDir();
  
  const cacheKey = getCacheKey(topic);
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  
  const cacheData = {
    topic,
    timestamp: Date.now(),
    data
  };
  
  await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
  console.log(`💾 Research cached for 24 hours`);
}

// Create circuit breaker for Perplexity API
const perplexityBreaker = createCircuitBreaker('perplexity', {
  timeout: 30000, // 30 seconds
  failureThreshold: 3,
  resetTimeout: 120000, // 2 minutes
  fallback: (topic) => {
    console.log('⚡ Using fallback research for:', topic);
    return fallbacks.research(topic);
  }
});

// Make API call with circuit breaker
async function callPerplexityAPI(topic) {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.PERPLEXITY_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful research assistant. Provide factual, well-sourced information with specific statistics and data points.'
        },
        {
          role: 'user',
          content: `Provide deep factual research on "${topic}" for an ebook. Include:
1. A comprehensive summary (350 characters) with key statistics
2. List 5 relevant URLs/sources with recent data
3. Extract 3 key bullet points with specific facts, numbers, or statistics

Focus on recent data (2024-2025) and credible sources.`
        }
      ],
      temperature: 0.1,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const error = await response.text();
    
    // Check for rate limit error
    if (response.status === 429) {
      throw new Error(`Rate limited: ${error}`);
    }
    
    // Check for quota exceeded
    if (response.status === 403 && error.toLowerCase().includes('quota')) {
      console.error('❌ Perplexity quota exceeded!');
      // Return a flag instead of throwing to allow pipeline to continue
      return {
        summary: `FACT CHECK NEEDED: Research quota exceeded for topic "${topic}". Manual fact-checking required before publication.`,
        links: [`https://www.google.com/search?q=${encodeURIComponent(topic)}`],
        bullets: ['Research quota exceeded - manual verification needed'],
        quotaExceeded: true
      };
    }
    
    throw new Error(`Perplexity API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Update rate limit tracking
  updateRateLimit('perplexity');
  
  // Parse the response
  const lines = content.split('\n').filter(line => line.trim());
  
  // Extract structured data
  let summary = '';
  let links = [];
  let bullets = [];
  
  let section = '';
  for (const line of lines) {
    if (line.toLowerCase().includes('summary:') || line.match(/^(comprehensive )?summary:/i)) {
      section = 'summary';
      summary = line.replace(/^.*?summary:\s*/i, '').trim();
    } else if (line.toLowerCase().includes('sources:') || line.toLowerCase().includes('urls:') || line.match(/^\d+\./)) {
      section = 'links';
      if (line.match(/^\d+\./)) {
        const url = line.replace(/^\d+\.\s*/, '').trim();
        if (url.startsWith('http')) {
          links.push(url);
        } else if (url.includes('http')) {
          // Extract URL from text
          const match = url.match(/(https?:\/\/[^\s]+)/);
          if (match) links.push(match[1]);
        }
      }
    } else if (line.toLowerCase().includes('bullet') || line.toLowerCase().includes('key points:') || line.startsWith('•') || line.startsWith('-')) {
      section = 'bullets';
      if (line.startsWith('•') || line.startsWith('-')) {
        bullets.push(line.replace(/^[•-]\s*/, '').trim());
      }
    } else {
      // Continue with current section
      if (section === 'summary' && line.trim()) {
        summary += ' ' + line.trim();
      } else if (section === 'links' && line.match(/^\d+\./)) {
        const url = line.replace(/^\d+\.\s*/, '').trim();
        if (url.includes('http')) {
          const match = url.match(/(https?:\/\/[^\s]+)/);
          if (match) links.push(match[1]);
        }
      } else if (section === 'bullets' && (line.startsWith('•') || line.startsWith('-') || line.match(/^\d+\./))) {
        bullets.push(line.replace(/^[•\-\d\.]\s*/, '').trim());
      }
    }
  }
  
  // Fallback parsing if structured extraction failed
  if (!summary || links.length === 0 || bullets.length === 0) {
    summary = summary || content.slice(0, 350);
    if (links.length === 0) {
      links = content.match(/https?:\/\/[^\s]+/g) || [];
    }
    if (bullets.length === 0) {
      bullets = lines.filter(l => l.startsWith('•') || l.startsWith('-')).slice(0, 3);
    }
  }
  
  // Ensure we have at least some content
  summary = summary.slice(0, 350);
  links = links.slice(0, 5);
  bullets = bullets.filter(b => b.length > 10).slice(0, 3);
  
  // Pad if necessary
  while (links.length < 3) {
    links.push(`https://www.google.com/search?q=${encodeURIComponent(topic + ' ' + (links.length + 1))}`);
  }
  while (bullets.length < 3) {
    bullets.push(`Key insight ${bullets.length + 1} about ${topic}`);
  }
  
  const result = { 
    summary: summary || `Comprehensive research on ${topic} covering key aspects and recent developments.`,
    links, 
    bullets 
  };
  
  console.log('✅ Research completed successfully');
  return result;
}

// Deep research with caching and circuit breaker
async function deepResearchCached({ topic, useCache = true }) {
  // Check cache first
  if (useCache) {
    const cached = await getCachedResearch(topic);
    if (cached) {
      return cached;
    }
  }
  
  console.log(`🔍 Fetching fresh research for: "${topic}"`);
  
  try {
    // Use circuit breaker to call API
    const result = await perplexityBreaker.fire(
      () => callPerplexityAPI(topic),
      topic
    );
    
    // Save to cache if successful and not a fallback
    if (!result.error) {
      await saveToCache(topic, result);
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Research failed:', error.message);
    
    // If circuit breaker provided fallback, it will be returned
    // Otherwise, throw the error
    throw error;
  }
}

// Clean up old cache entries
async function cleanupCache() {
  try {
    await ensureCacheDir();
    const files = await fs.readdir(CACHE_DIR);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(CACHE_DIR, file);
        const stat = await fs.stat(filePath);
        const age = Date.now() - stat.mtime.getTime();
        
        if (age > CACHE_TTL * 2) { // Delete files older than 2x TTL
          await fs.unlink(filePath);
          console.log(`🗑️  Deleted old cache: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

// Export main function
module.exports = deepResearchCached;

// Also export utilities for testing
module.exports.getCachedResearch = getCachedResearch;
module.exports.cleanupCache = cleanupCache;
module.exports.perplexityBreaker = perplexityBreaker;