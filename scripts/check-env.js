#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// Required environment variables
const REQUIRED_VARS = {
    PERPLEXITY_API_KEY: {
        description: 'Perplexity API for deep research',
        pattern: /^pplx-/,
        example: 'pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        critical: true
    },
    IDEOGRAM_API_KEY: {
        description: 'Ideogram API for image generation',
        pattern: /^[a-zA-Z0-9_-]{40,}/,
        example: 'u7PZqXOCwN6hwZCaMvZJR3Wi1_4bfQeBHE8JLpMA3w4',
        critical: true
    },
    AMAZON_AFFILIATE_TAG: {
        description: 'Amazon affiliate tag for monetization',
        pattern: /^[a-zA-Z0-9-]+-20$/,
        example: 'your-tag-20',
        critical: true
    },
    REDIS_URL: {
        description: 'Redis URL for topic buffer',
        pattern: /^redis:\/\//,
        example: 'redis://localhost:6379',
        critical: false
    }
};

// Optional but recommended
const OPTIONAL_VARS = {
    ANTHROPIC_API_KEY: {
        description: 'Anthropic API for chat widget (optional if using CLI)',
        pattern: /^sk-ant-/,
        example: 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    },
    GUMROAD_API_KEY: {
        description: 'Gumroad API for auto-publishing',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_gumroad_key'
    }
};

// Rate limit tracking file
const RATE_LIMIT_FILE = path.join(__dirname, '../.env.runtime');

// Load environment variables
require('dotenv').config();

// Check rate limits
async function checkRateLimits() {
    console.log('\n📊 Checking Rate Limits & Quotas...\n');
    
    let rateLimits = {};
    if (fs.existsSync(RATE_LIMIT_FILE)) {
        try {
            const content = fs.readFileSync(RATE_LIMIT_FILE, 'utf-8');
            content.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    rateLimits[key.trim()] = value.trim();
                }
            });
        } catch (error) {
            console.log(`${colors.yellow}⚠️  Could not read rate limit file${colors.reset}`);
        }
    }
    
    // Check Perplexity rate limit
    const lastPerplexityCall = rateLimits.LAST_PERPLEXITY_CALL ? 
        parseInt(rateLimits.LAST_PERPLEXITY_CALL) : 0;
    const timeSinceLastCall = Date.now() - lastPerplexityCall;
    const minInterval = 60000; // 60 seconds
    
    if (timeSinceLastCall < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastCall) / 1000);
        console.log(`${colors.yellow}⚠️  Perplexity rate limit: Wait ${waitTime}s before next call${colors.reset}`);
        return false;
    }
    
    // Check Perplexity quota (estimate based on usage)
    const perplexityCallsToday = parseInt(rateLimits.PERPLEXITY_CALLS_TODAY || '0');
    const quotaPercentage = (perplexityCallsToday / 500) * 100; // Assuming 500 calls/day limit
    
    if (quotaPercentage >= 90) {
        console.log(`${colors.red}❌ Perplexity quota critical: ${quotaPercentage.toFixed(1)}% used${colors.reset}`);
        return false;
    } else if (quotaPercentage >= 70) {
        console.log(`${colors.yellow}⚠️  Perplexity quota warning: ${quotaPercentage.toFixed(1)}% used${colors.reset}`);
    } else {
        console.log(`${colors.green}✅ Perplexity quota OK: ${quotaPercentage.toFixed(1)}% used${colors.reset}`);
    }
    
    console.log(`${colors.green}✅ Rate limits OK (last call: ${Math.floor(timeSinceLastCall / 1000)}s ago)${colors.reset}`);
    return quotaPercentage < 90;
}

// Update rate limit timestamp
function updateRateLimit(service) {
    let rateLimits = {};
    
    if (fs.existsSync(RATE_LIMIT_FILE)) {
        try {
            const content = fs.readFileSync(RATE_LIMIT_FILE, 'utf-8');
            content.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    rateLimits[key.trim()] = value.trim();
                }
            });
        } catch (error) {
            // Ignore read errors
        }
    }
    
    rateLimits[`LAST_${service.toUpperCase()}_CALL`] = Date.now().toString();
    
    const content = Object.entries(rateLimits)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    fs.writeFileSync(RATE_LIMIT_FILE, content);
}

// Main check function
async function checkEnvironment() {
    console.log('🔍 EBOOK MONEY MACHINE AI - Environment Check\n');
    console.log('=' + '='.repeat(50) + '\n');
    
    let hasErrors = false;
    let hasCriticalErrors = false;
    let hasWarnings = false;
    
    // Check required variables
    console.log('📋 Required Environment Variables:\n');
    
    for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
        const value = process.env[varName];
        
        if (!value) {
            if (config.critical) {
                console.log(`${colors.red}❌ ${varName}: MISSING (CRITICAL)${colors.reset}`);
                hasCriticalErrors = true;
            } else {
                console.log(`${colors.yellow}⚠️  ${varName}: MISSING (optional)${colors.reset}`);
                hasWarnings = true;
            }
            console.log(`   ${config.description}`);
            console.log(`   Example: ${config.example}\n`);
            if (config.critical) hasErrors = true;
        } else if (!config.pattern.test(value)) {
            console.log(`${colors.yellow}⚠️  ${varName}: INVALID FORMAT${colors.reset}`);
            console.log(`   Expected format: ${config.example}\n`);
            hasWarnings = true;
        } else {
            console.log(`${colors.green}✅ ${varName}: OK${colors.reset}`);
            const masked = value.length > 14 ? 
                `${value.substring(0, 10)}...${value.substring(value.length - 4)}` : 
                value.substring(0, 4) + '***';
            console.log(`   ${masked}\n`);
        }
    }
    
    // Check optional variables
    console.log('\n📋 Optional Environment Variables:\n');
    
    for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
        const value = process.env[varName];
        
        if (!value) {
            console.log(`${colors.yellow}⚠️  ${varName}: Not set (optional)${colors.reset}`);
            console.log(`   ${config.description}\n`);
        } else {
            console.log(`${colors.green}✅ ${varName}: OK${colors.reset}\n`);
        }
    }
    
    // Check rate limits
    const rateLimitsOk = await checkRateLimits();
    if (!rateLimitsOk) {
        hasCriticalErrors = true;
        hasErrors = true;
    }
    
    // Check Claude CLI availability
    console.log('\n🤖 Checking Claude CLI...\n');
    try {
        const { execSync } = require('child_process');
        execSync('which claude', { stdio: 'ignore' });
        console.log(`${colors.green}✅ Claude CLI: Available${colors.reset}`);
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Claude CLI: Not found in PATH${colors.reset}`);
        console.log('   Make sure you\'re running inside Claude Code CLI');
        hasWarnings = true;
    }
    
    // Summary
    console.log('\n' + '=' + '='.repeat(50) + '\n');
    
    if (hasCriticalErrors) {
        console.log(`${colors.red}❌ Environment check FAILED (CRITICAL)${colors.reset}`);
        console.log('\nCritical errors found:');
        console.log('- Missing required API keys or quota exceeded');
        console.log('- Pipeline cannot continue\n');
        process.exit(1);
    } else if (hasErrors) {
        console.log(`${colors.red}❌ Environment check FAILED${colors.reset}`);
        console.log('\nPlease set the missing environment variables in your .env file');
        process.exit(1);
    } else if (hasWarnings) {
        console.log(`${colors.yellow}⚠️  Environment check passed with warnings${colors.reset}`);
        console.log('\nThe pipeline can run but some features may be limited');
    } else {
        console.log(`${colors.green}✅ Environment check PASSED${colors.reset}`);
        console.log('\nAll systems ready for ebook generation! 🚀');
    }
    
    // Create runtime file if it doesn't exist
    if (!fs.existsSync(RATE_LIMIT_FILE)) {
        fs.writeFileSync(RATE_LIMIT_FILE, '# Runtime rate limit tracking\n');
    }
    
    return !hasErrors;
}

// Run if called directly
if (require.main === module) {
    checkEnvironment();
}

module.exports = { checkEnvironment, updateRateLimit };