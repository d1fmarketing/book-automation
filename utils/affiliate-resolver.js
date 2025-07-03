const crypto = require('crypto');

class AffiliateResolver {
  constructor(config = {}) {
    this.config = {
      amazonTag: config.amazonTag || process.env.AMAZON_AFFILIATE_TAG || 'your-tag-20',
      region: config.region || 'US',
      cacheTimeout: config.cacheTimeout || 24 * 60 * 60 * 1000, // 24 hours
      rateLimit: config.rateLimit || 1000, // 1 request per second
      chunkSize: config.chunkSize || 8000, // 8k chars per chunk
      ...config
    };
    
    this.cache = new Map();
    this.lastRequestTime = 0;
    
    // Amazon blacklist terms - products that violate Amazon Associates terms
    this.blacklist = [
      'adult', 'porn', 'xxx', 'sex toy', 'vibrator', 'dildo',
      'weapon', 'gun', 'ammunition', 'explosive',
      'drug', 'marijuana', 'cannabis', 'cbd', 'hemp',
      'tobacco', 'cigarette', 'vape', 'e-cigarette',
      'alcohol', 'liquor', 'beer', 'wine',
      'gambling', 'casino', 'lottery', 'betting',
      'prescription', 'medication', 'pharmaceutical',
      'counterfeit', 'fake', 'replica', 'knockoff'
    ];
    
    // Regional Amazon domains
    this.amazonDomains = {
      US: 'amazon.com',
      UK: 'amazon.co.uk',
      CA: 'amazon.ca',
      DE: 'amazon.de',
      FR: 'amazon.fr',
      IT: 'amazon.it',
      ES: 'amazon.es',
      JP: 'amazon.co.jp',
      IN: 'amazon.in',
      BR: 'amazon.com.br',
      MX: 'amazon.com.mx',
      AU: 'amazon.com.au'
    };
  }
  
  // Add affiliate disclosure after TOC
  addDisclosure(html) {
    const disclosure = `
    <div class="affiliate-disclosure" style="
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 5px;
      padding: 15px;
      margin: 20px 0;
      font-size: 0.9em;
      color: #495057;
    ">
      <p><strong>Affiliate Disclosure:</strong> As an Amazon Associate, we earn from qualifying purchases. 
      This means that if you click on a link to Amazon and make a purchase, we may receive a small commission 
      at no extra cost to you. This helps support our work in creating quality content. Thank you for your support!</p>
    </div>`;
    
    // Try to add after TOC
    const tocPatterns = [
      /<div[^>]*class=[^>]*toc[^>]*>[\s\S]*?<\/div>/i,
      /<nav[^>]*class=[^>]*toc[^>]*>[\s\S]*?<\/nav>/i,
      /<h[1-6][^>]*>.*?table of contents.*?<\/h[1-6]>[\s\S]*?<\/(?:ul|ol|div)>/i
    ];
    
    for (const pattern of tocPatterns) {
      if (pattern.test(html)) {
        return html.replace(pattern, (match) => match + disclosure);
      }
    }
    
    // If no TOC found, add after first h1 or h2
    const headerPattern = /<h[12][^>]*>.*?<\/h[12]>/i;
    if (headerPattern.test(html)) {
      return html.replace(headerPattern, (match) => match + disclosure);
    }
    
    // Fallback: add at the beginning of body content
    return disclosure + html;
  }
  
  // Check if content contains blacklisted terms
  containsBlacklistedTerms(content) {
    const contentLower = content.toLowerCase();
    for (const term of this.blacklist) {
      if (contentLower.includes(term)) {
        return term;
      }
    }
    return null;
  }
  
  // Extract product info from Amazon URL
  extractProductInfo(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extract ASIN (Amazon Standard Identification Number)
      const asinMatch = pathname.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/i);
      const asin = asinMatch ? (asinMatch[1] || asinMatch[2]) : null;
      
      // Extract product title from URL if available
      const titleMatch = pathname.match(/\/([^\/]+)\/dp\//);
      const title = titleMatch ? decodeURIComponent(titleMatch[1].replace(/-/g, ' ')) : '';
      
      return { asin, title };
    } catch (error) {
      return { asin: null, title: '' };
    }
  }
  
  // Build affiliate URL with proper tracking
  buildAffiliateUrl(originalUrl, productInfo) {
    const { asin } = productInfo;
    const domain = this.amazonDomains[this.config.region] || this.amazonDomains.US;
    
    if (asin) {
      // Clean affiliate URL format
      return `https://${domain}/dp/${asin}?tag=${this.config.amazonTag}`;
    }
    
    // Fallback: add tag parameter to original URL
    try {
      const url = new URL(originalUrl);
      url.searchParams.set('tag', this.config.amazonTag);
      return url.toString();
    } catch (error) {
      return originalUrl;
    }
  }
  
  // Process a single Amazon link
  async processLink(link) {
    // Check cache first
    const cacheKey = link.href;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.result;
    }
    
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.config.rateLimit - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();
    
    // Extract product info
    const productInfo = this.extractProductInfo(link.href);
    
    // Check blacklist
    const blacklistedTerm = this.containsBlacklistedTerms(link.textContent + productInfo.title);
    if (blacklistedTerm) {
      console.warn(`⚠️ Skipping blacklisted product (contains "${blacklistedTerm}"): ${link.href}`);
      return {
        skip: true,
        reason: `blacklisted term: ${blacklistedTerm}`
      };
    }
    
    // Build affiliate URL
    const affiliateUrl = this.buildAffiliateUrl(link.href, productInfo);
    
    // Cache result
    const result = {
      originalUrl: link.href,
      affiliateUrl,
      asin: productInfo.asin,
      processed: true
    };
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
  
  // Process HTML content in chunks
  async processHtml(html) {
    let processedHtml = html;
    const chunks = [];
    
    // Split HTML into chunks if needed
    if (html.length > this.config.chunkSize) {
      for (let i = 0; i < html.length; i += this.config.chunkSize) {
        chunks.push(html.slice(i, i + this.config.chunkSize));
      }
    } else {
      chunks.push(html);
    }
    
    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      chunks[i] = await this.processChunk(chunks[i]);
    }
    
    processedHtml = chunks.join('');
    
    // Add disclosure if affiliate links were added
    if (processedHtml.includes('data-aff="true"')) {
      processedHtml = this.addDisclosure(processedHtml);
    }
    
    return processedHtml;
  }
  
  // Process a single chunk of HTML
  async processChunk(htmlChunk) {
    // Find all Amazon links in the chunk
    const amazonLinkPattern = /<a[^>]*href=["']([^"']*amazon\.[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const matches = [...htmlChunk.matchAll(amazonLinkPattern)];
    
    if (matches.length === 0) {
      return htmlChunk;
    }
    
    let processedChunk = htmlChunk;
    
    for (const match of matches) {
      const [fullMatch, href, linkContent] = match;
      
      // Skip if already processed
      if (fullMatch.includes('data-aff=')) {
        continue;
      }
      
      const link = {
        href,
        textContent: linkContent.replace(/<[^>]*>/g, '') // Strip HTML tags
      };
      
      try {
        const result = await this.processLink(link);
        
        if (result.skip) {
          // Remove the link entirely if blacklisted
          processedChunk = processedChunk.replace(fullMatch, linkContent);
        } else if (result.processed) {
          // Replace with affiliate link
          const newLink = fullMatch
            .replace(href, result.affiliateUrl)
            .replace('<a', '<a data-aff="true" rel="sponsored noopener" target="_blank"');
          
          processedChunk = processedChunk.replace(fullMatch, newLink);
        }
      } catch (error) {
        console.error(`Error processing link ${href}:`, error.message);
      }
    }
    
    return processedChunk;
  }
  
  // Clear cache
  clearCache() {
    this.cache.clear();
  }
  
  // Get cache statistics
  getCacheStats() {
    const validEntries = Array.from(this.cache.entries()).filter(
      ([key, value]) => Date.now() - value.timestamp < this.config.cacheTimeout
    );
    
    return {
      totalEntries: this.cache.size,
      validEntries: validEntries.length,
      expiredEntries: this.cache.size - validEntries.length,
      cacheTimeout: this.config.cacheTimeout
    };
  }
}

module.exports = AffiliateResolver;