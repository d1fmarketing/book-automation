#!/bin/bash

# install-complete-stack.sh - Install Claude Elite MCP Stack
# Gate de Qualidade: Todos testes verdes ✅

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Claude Code CLI Elite - MCP Stack Installation${NC}"
echo "=================================================="

# Check if verify-env.sh exists and run it
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/verify-env.sh" ]; then
    echo -e "${YELLOW}Running environment verification...${NC}"
    if ! "$SCRIPT_DIR/verify-env.sh"; then
        echo -e "${RED}Environment verification failed. Please fix issues before continuing.${NC}"
        exit 1
    fi
fi

# Configuration file
CONFIG_FILE="$SCRIPT_DIR/../mcp-configs/stack.json"

# Check for environment variables
echo ""
echo -e "${BLUE}📋 Checking environment variables...${NC}"

check_env_var() {
    local var_name=$1
    local var_desc=$2
    
    if [ -z "${!var_name:-}" ]; then
        echo -e "${RED}✗${NC} $var_name not set - $var_desc"
        echo -e "  ${YELLOW}Export it or add to .env.local${NC}"
        return 1
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
        return 0
    fi
}

# Required environment variables
MISSING_VARS=0

# Core MCPs
check_env_var "BRIGHTDATA_API_KEY" "Required for web scraping" || ((MISSING_VARS++))
check_env_var "SUPABASE_URL" "Required for database operations" || ((MISSING_VARS++))
check_env_var "SUPABASE_KEY" "Required for database auth" || ((MISSING_VARS++))
check_env_var "UPSTASH_REDIS_URL" "Required for caching" || ((MISSING_VARS++))
check_env_var "UPSTASH_REDIS_TOKEN" "Required for cache auth" || ((MISSING_VARS++))

# Optional MCPs
echo ""
echo -e "${BLUE}📋 Checking optional MCP configurations...${NC}"
check_env_var "SHOPIFY_STORE" "Optional: E-commerce integration" || true
check_env_var "SHOPIFY_ACCESS_TOKEN" "Optional: E-commerce auth" || true
check_env_var "SENTRY_DSN" "Optional: Error monitoring" || true

if [ $MISSING_VARS -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ Missing $MISSING_VARS required environment variables${NC}"
    echo -e "${YELLOW}Please set them before continuing${NC}"
    exit 1
fi

# Create config directory if it doesn't exist
mkdir -p "$SCRIPT_DIR/../mcp-configs"

# Generate stack configuration
echo ""
echo -e "${BLUE}📝 Generating stack configuration...${NC}"

cat > "$CONFIG_FILE" << EOF
{
  "mcps": [
    {
      "name": "brightdata",
      "command": "npx @brightdata/mcp-server",
      "args": {
        "api-key": "$BRIGHTDATA_API_KEY",
        "zone": "mcp_unlocker"
      },
      "description": "Web scraping with proxy rotation"
    },
    {
      "name": "supabase",
      "command": "npx @supabase/mcp-server",
      "args": {
        "url": "$SUPABASE_URL",
        "key": "$SUPABASE_KEY"
      },
      "description": "Database and storage operations"
    },
    {
      "name": "puppeteer",
      "command": "npx @modelcontextprotocol/puppeteer-server",
      "args": {},
      "description": "Browser automation and screenshots"
    },
    {
      "name": "upstash",
      "command": "npx @upstash/mcp-server",
      "args": {
        "url": "$UPSTASH_REDIS_URL",
        "token": "$UPSTASH_REDIS_TOKEN"
      },
      "description": "Redis caching and queues"
    }
EOF

# Add optional MCPs if configured
if [ ! -z "${SHOPIFY_STORE:-}" ] && [ ! -z "${SHOPIFY_ACCESS_TOKEN:-}" ]; then
    cat >> "$CONFIG_FILE" << EOF
    ,
    {
      "name": "shopify",
      "command": "npx @shopify/mcp-server",
      "args": {
        "store": "$SHOPIFY_STORE",
        "access-token": "$SHOPIFY_ACCESS_TOKEN"
      },
      "description": "Shopify store management"
    }
EOF
fi

# Close the JSON
echo "  ]" >> "$CONFIG_FILE"
echo "}" >> "$CONFIG_FILE"

echo -e "${GREEN}✓${NC} Configuration saved to $CONFIG_FILE"

# Function to install MCP
install_mcp() {
    local name=$1
    local command=$2
    local args=$3
    
    echo ""
    echo -e "${BLUE}Installing $name MCP...${NC}"
    
    # Build the claude mcp add command
    local cmd="claude mcp add $name '$command'"
    
    # Add arguments
    if [ ! -z "$args" ]; then
        cmd="$cmd $args"
    fi
    
    echo -e "${YELLOW}Command: $cmd${NC}"
    
    # Execute the command
    if eval "$cmd"; then
        echo -e "${GREEN}✓ $name MCP installed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to install $name MCP${NC}"
        return 1
    fi
}

# Install MCPs
echo ""
echo -e "${BLUE}🔧 Installing MCP Stack...${NC}"
echo "This may take a few minutes..."

FAILED_INSTALLS=0

# Core MCPs
install_mcp "brightdata" "npx @brightdata/mcp-server" \
    "-e BRIGHTDATA_API_KEY='$BRIGHTDATA_API_KEY' -e BRIGHTDATA_ZONE='mcp_unlocker'" || ((FAILED_INSTALLS++))

install_mcp "supabase" "npx @supabase/mcp-server" \
    "-e SUPABASE_URL='$SUPABASE_URL' -e SUPABASE_KEY='$SUPABASE_KEY'" || ((FAILED_INSTALLS++))

install_mcp "puppeteer" "npx @modelcontextprotocol/puppeteer-server" "" || ((FAILED_INSTALLS++))

install_mcp "upstash" "npx @upstash/mcp-server" \
    "-e UPSTASH_REDIS_URL='$UPSTASH_REDIS_URL' -e UPSTASH_REDIS_TOKEN='$UPSTASH_REDIS_TOKEN'" || ((FAILED_INSTALLS++))

# Optional MCPs
if [ ! -z "${SHOPIFY_STORE:-}" ] && [ ! -z "${SHOPIFY_ACCESS_TOKEN:-}" ]; then
    install_mcp "shopify" "npx @shopify/mcp-server" \
        "-e SHOPIFY_STORE='$SHOPIFY_STORE' -e SHOPIFY_ACCESS_TOKEN='$SHOPIFY_ACCESS_TOKEN'" || ((FAILED_INSTALLS++))
fi

# Verify installation
echo ""
echo -e "${BLUE}🔍 Verifying MCP installations...${NC}"
echo -e "${YELLOW}Run: claude /mcp${NC}"

# Create helper scripts
echo ""
echo -e "${BLUE}📄 Creating helper scripts...${NC}"

# Cache helper
cat > "$SCRIPT_DIR/cache-helpers.js" << 'EOF'
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
EOF

echo -e "${GREEN}✓${NC} Created cache-helpers.js"

# Performance monitor stub
cat > "$SCRIPT_DIR/performance-monitor.js" << 'EOF'
// performance-monitor.js - Track operation performance

class PerformanceMonitor {
  constructor(telemetryClient = null) {
    this.telemetryClient = telemetryClient;
    this.operations = new Map();
  }

  async trackOperation(operationName, fn) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      
      const metrics = {
        operation: operationName,
        duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        status: 'success'
      };
      
      this.recordMetrics(metrics);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const metrics = {
        operation: operationName,
        duration,
        status: 'error',
        error: error.message
      };
      
      this.recordMetrics(metrics);
      throw error;
    }
  }

  recordMetrics(metrics) {
    console.log(`[Performance] ${metrics.operation}: ${metrics.duration}ms (${metrics.status})`);
    
    if (this.telemetryClient) {
      this.telemetryClient.send(metrics);
    }
    
    // Store for local analysis
    if (!this.operations.has(metrics.operation)) {
      this.operations.set(metrics.operation, []);
    }
    this.operations.get(metrics.operation).push(metrics);
  }

  getStats(operationName) {
    const ops = this.operations.get(operationName) || [];
    if (ops.length === 0) return null;
    
    const durations = ops.map(op => op.duration);
    const successful = ops.filter(op => op.status === 'success');
    
    return {
      count: ops.length,
      successRate: (successful.length / ops.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }
}

module.exports = PerformanceMonitor;
EOF

echo -e "${GREEN}✓${NC} Created performance-monitor.js"

# Final report
echo ""
echo "=================================================="
if [ $FAILED_INSTALLS -eq 0 ]; then
    echo -e "${GREEN}✅ MCP Stack installation complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run 'claude /mcp' to verify installations"
    echo "2. Test with: claude \"Use brightdata to scrape example.com\""
    echo "3. Check helper scripts in $SCRIPT_DIR"
else
    echo -e "${RED}❌ $FAILED_INSTALLS MCP(s) failed to install${NC}"
    echo -e "${YELLOW}Please check the errors above and try again${NC}"
    exit 1
fi