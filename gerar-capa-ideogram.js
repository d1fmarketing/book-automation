const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const redis = require('redis');
require('dotenv').config();

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 4,
  baseDelay: 2000, // 2 seconds
  factor: 2, // exponential backoff factor
  jitter: true
};

// Redis configuration for caching
let redisClient = null;
const CACHE_TTL = 86400; // 24 hours in seconds

// Initialize Redis client
async function initRedis() {
  if (!redisClient) {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    redisClient.on('error', (err) => {
      console.warn('Redis Client Error:', err);
      redisClient = null; // Disable caching on error
    });
    
    try {
      await redisClient.connect();
      console.log('✅ Redis connected for caching');
    } catch (error) {
      console.warn('⚠️  Redis connection failed, proceeding without cache:', error.message);
      redisClient = null;
    }
  }
  return redisClient;
}

// Calculate exponential backoff with jitter
function calculateBackoff(retryCount) {
  const baseDelay = RETRY_CONFIG.baseDelay;
  const delay = baseDelay * Math.pow(RETRY_CONFIG.factor, retryCount);
  
  if (RETRY_CONFIG.jitter) {
    // Add random jitter (0-25% of delay)
    const jitter = delay * 0.25 * Math.random();
    return Math.floor(delay + jitter);
  }
  
  return delay;
}

// Generate cache key from prompt
function generateCacheKey(prompt) {
  return `ideogram:${crypto.createHash('md5').update(prompt).digest('hex')}`;
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check cache for existing image
async function checkCache(prompt) {
  const client = await initRedis();
  if (!client) return null;
  
  try {
    const cacheKey = generateCacheKey(prompt);
    const cachedUrl = await client.get(cacheKey);
    
    if (cachedUrl) {
      console.log('🎯 Cache hit! Using cached image URL');
      return cachedUrl;
    }
  } catch (error) {
    console.warn('Cache check failed:', error.message);
  }
  
  return null;
}

// Save to cache
async function saveToCache(prompt, imageUrl) {
  const client = await initRedis();
  if (!client) return;
  
  try {
    const cacheKey = generateCacheKey(prompt);
    await client.setEx(cacheKey, CACHE_TTL, imageUrl);
    console.log('💾 Saved to cache (24h TTL)');
  } catch (error) {
    console.warn('Cache save failed:', error.message);
  }
}

// Make API request with retry logic
async function makeRequestWithRetry(requestData, retryCount = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.ideogram.ai',
      path: '/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': IDEOGRAM_API_KEY
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', async () => {
        // Check for 429 rate limit
        if (res.statusCode === 429) {
          if (retryCount < RETRY_CONFIG.maxRetries) {
            const delay = calculateBackoff(retryCount);
            console.log(`⚠️  Ideogram 429, retry #${retryCount + 1} after ${delay}ms`);
            
            await sleep(delay);
            
            try {
              const result = await makeRequestWithRetry(requestData, retryCount + 1);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(new Error(`Rate limit exceeded after ${RETRY_CONFIG.maxRetries} retries`));
          }
          return;
        }
        
        // Handle other non-success status codes
        if (res.statusCode !== 200) {
          reject(new Error(`API returned status ${res.statusCode}: ${body}`));
          return;
        }
        
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (parseError) {
          reject(new Error(`Failed to parse response: ${parseError.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      // Network errors also trigger retry
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = calculateBackoff(retryCount);
        console.log(`⚠️  Network error, retry #${retryCount + 1} after ${delay}ms`);
        
        setTimeout(async () => {
          try {
            const result = await makeRequestWithRetry(requestData, retryCount + 1);
            resolve(result);
          } catch (retryError) {
            reject(retryError);
          }
        }, delay);
      } else {
        reject(error);
      }
    });
    
    req.write(requestData);
    req.end();
  });
}

// Main function to generate cover
async function generateCover(prompt, outputPath) {
  console.log('🎨 Gerando capa com Ideogram (com retry e cache)...');
  
  // Check cache first
  const cachedUrl = await checkCache(prompt);
  if (cachedUrl) {
    await downloadImage(cachedUrl, outputPath);
    return { cached: true, url: cachedUrl };
  }
  
  // Prepare request data
  const requestData = JSON.stringify({
    image_request: {
      prompt: prompt,
      aspect_ratio: "ASPECT_10_16",  // For 6x9 book cover
      model: "V_2",
      magic_prompt_option: "AUTO"
    }
  });
  
  try {
    // Make request with retry logic
    const response = await makeRequestWithRetry(requestData);
    
    if (response.data && response.data[0]) {
      const imageUrl = response.data[0].url;
      console.log('✅ Imagem gerada:', imageUrl);
      
      // Save to cache
      await saveToCache(prompt, imageUrl);
      
      // Download image
      await downloadImage(imageUrl, outputPath);
      
      console.log('💰 Custo: ~$0.08');
      
      return { cached: false, url: imageUrl };
    } else {
      throw new Error('No image data in response');
    }
  } catch (error) {
    console.error('❌ Erro ao gerar imagem:', error.message);
    throw error;
  } finally {
    // Close Redis connection if open
    if (redisClient) {
      await redisClient.quit();
    }
  }
}

// Download image helper
async function downloadImage(url, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✅ Capa salva em: ${outputPath}`);
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(outputPath, () => {}); // Delete incomplete file
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// CLI usage
if (require.main === module) {
  const defaultPrompt = "Professional digital ebook cover design featuring flowing data streams and neural network patterns in vibrant blue and purple gradients. Title 'The Claude Elite Pipeline' in bold modern typography. Subtitle 'Mastering Automated Ebook Creation'. Futuristic, clean design optimized for digital devices. High contrast for small thumbnails.";
  
  const prompt = process.argv[2] || defaultPrompt;
  const outputPath = process.argv[3] || 'pipeline-book/assets/images/cover.jpg';
  
  generateCover(prompt, outputPath)
    .then(() => {
      console.log('✅ Cover generation complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cover generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateCover };