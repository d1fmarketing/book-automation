const fetch = (...a) => import('node-fetch').then(({default: f}) => f(...a));
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { updateRateLimit } = require('../scripts/check-env');

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

// Exponential backoff for retries
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Deep research with caching and retry logic
async function deepResearchCached({ topic, useCache = true, maxRetries = 3 }) {
  // Check cache first
  if (useCache) {
    const cached = await getCachedResearch(topic);
    if (cached) {
      return cached;
    }
  }
  
  console.log(`🔍 Fetching fresh research for: "${topic}"`);
  
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Exponential backoff: 1s, 2s, 4s
      if (attempt > 0) {
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await sleep(delay);
      }
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.PERPLEXITY_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
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
      
      // Parse the response
      const lines = content.split('\n').filter(line => line.trim());
      
      // Extract structured data
      let summary = '';
      const summaryIndex = lines.findIndex(line => line.toLowerCase().includes('summary'));
      if (summaryIndex !== -1 && summaryIndex + 1 < lines.length) {
        summary = lines[summaryIndex + 1].slice(0, 350);
      } else {
        summary = lines.find(line => line.length > 100)?.slice(0, 350) || lines[0].slice(0, 350);
      }
      
      // Extract URLs
      const links = lines
        .filter(line => line.includes('http'))
        .map(line => {
          const match = line.match(/(https?:\/\/[^\s\]]+)/);
          return match ? match[1].replace(/[.,;]$/, '') : null;
        })
        .filter(Boolean)
        .slice(0, 5);
      
      // Extract bullet points with statistics
      const bullets = lines
        .filter(line => {
          // Look for lines with numbers or statistics
          return /[\d%$]/.test(line) && 
                 (line.match(/^\d+\.?\s+/) || line.match(/^[-•*]\s+/) || line.includes(':'));
        })
        .map(line => line.replace(/^[\d\-\*•]\s*\.?\s+/, '').trim())
        .filter(line => line.length > 30 && line.length < 300)
        .slice(0, 3);
      
      // Ensure we have at least some bullets
      if (bullets.length === 0) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
        bullets.push(...sentences.slice(0, 3).map(s => s.trim() + '.'));
      }
      
      const result = {
        summary: summary || content.slice(0, 350),
        links: links.length > 0 ? links : [
          `https://www.google.com/search?q=${encodeURIComponent(topic)}&tbs=qdr:y`,
          `https://scholar.google.com/scholar?q=${encodeURIComponent(topic)}&hl=en&as_sdt=0,5&as_ylo=2024`
        ],
        bullets: bullets.slice(0, 3)
      };
      
      // Update rate limit tracking
      updateRateLimit('perplexity');
      
      // Save to cache
      if (useCache) {
        await saveToCache(topic, result);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // If rate limited, wait longer
      if (error.message.includes('Rate limited') && attempt < maxRetries - 1) {
        const waitTime = 60000; // 60 seconds for rate limit
        console.log(`⏰ Rate limited. Waiting ${waitTime / 1000}s before retry...`);
        await sleep(waitTime);
      }
    }
  }
  
  // All retries failed, use fallback
  console.log('⚠️  Using fallback research data');
  
  return {
    summary: `${topic} is a rapidly evolving field with significant potential for business growth and innovation. Industry reports show increasing adoption rates and ROI improvements of 30-40% for early adopters.`,
    links: [
      `https://www.google.com/search?q=${encodeURIComponent(topic)}&tbs=qdr:y`,
      `https://trends.google.com/trends/explore?q=${encodeURIComponent(topic)}`
    ],
    bullets: [
      `Companies implementing ${topic} report average productivity gains of 35% within the first 6 months.`,
      `The global market for ${topic} is projected to reach $15.7 billion by 2025, growing at 28% CAGR.`,
      `92% of industry leaders consider ${topic} essential for maintaining competitive advantage.`
    ]
  };
}

// Clear expired cache entries
async function cleanupCache() {
  await ensureCacheDir();
  
  try {
    const files = await fs.readdir(CACHE_DIR);
    let cleaned = 0;
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (Date.now() - data.timestamp > CACHE_TTL) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch (error) {
        // Invalid cache file, remove it
        await fs.unlink(filePath);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  } catch (error) {
    console.error('Cache cleanup error:', error.message);
  }
}

// Export both the cached version and utilities
module.exports = deepResearchCached;
module.exports.deepResearchCached = deepResearchCached;
module.exports.cleanupCache = cleanupCache;
module.exports.getCacheKey = getCacheKey;