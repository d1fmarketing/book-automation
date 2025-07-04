#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    reset: '\x1b[0m'
};

// Environment variables categorized by criticality
const CRITICAL_VARS = {
    // Core services - Pipeline won't work without these
    PERPLEXITY_API_KEY: {
        description: 'Perplexity API for deep research (used by DeepResearch agent)',
        pattern: /^pplx-/,
        example: 'pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        category: 'AI Services'
    },
    IDEOGRAM_API_KEY: {
        description: 'Ideogram API for cover and image generation (used by Illustrator agent)',
        pattern: /^(ideogram_sk_live_|[a-zA-Z0-9_-]{80,})/,
        example: 'ideogram_sk_live_xxx OR long_api_key_format',
        category: 'AI Services'
    },
    REDIS_URL: {
        description: 'Redis URL for topic buffer and caching',
        pattern: /^redis:\/\//,
        example: 'redis://localhost:6379',
        category: 'Infrastructure'
    },
    GUMROAD_ACCESS_TOKEN: {
        description: 'Gumroad API for auto-publishing ebooks',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_gumroad_token',
        category: 'Publishing'
    },
    AMAZON_ASSOCIATE_TAG: {
        description: 'Amazon affiliate tag for monetization',
        pattern: /^[a-zA-Z0-9-]+-20$/,
        example: 'your-tag-20',
        category: 'Monetization'
    }
};

const IMPORTANT_VARS = {
    // Important but not blocking - Features degraded without these
    GITHUB_TOKEN: {
        description: 'GitHub Personal Access Token for PR creation and repo management',
        pattern: /^(ghp_|github_pat_)/,
        example: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        category: 'Version Control',
        validator: async (token) => {
            // Test token validity
            const { exec } = require('child_process');
            return new Promise((resolve) => {
                exec(`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${token}" https://api.github.com/user`, (err, stdout) => {
                    resolve(stdout.trim() === '200');
                });
            });
        }
    },
    SENDGRID_API_KEY: {
        description: 'SendGrid API for email automation (future feature)',
        pattern: /^SG\./,
        example: 'SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        category: 'Email'
    },
    HOSTINGER_API_TOKEN: {
        description: 'Hostinger API for VPS deployment',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your-hostinger-token',
        category: 'Deployment'
    },
    HOSTINGER_VPS_HOST: {
        description: 'Hostinger VPS hostname',
        pattern: /^[a-zA-Z0-9.-]+$/,
        example: 'your-vps.hostinger.com',
        category: 'Deployment'
    }
};

const OPTIONAL_VARS = {
    // Nice to have enhancements
    ANTHROPIC_API_KEY: {
        description: 'Anthropic API (NOT NEEDED - Claude CLI already provides this)',
        pattern: /^sk-ant-/,
        example: 'sk-ant-xxx (REDUNDANT - DO NOT SET)',
        category: 'AI Services',
        note: '⚠️ Claude Code CLI already includes Claude access'
    },
    GEMINI_API_KEY: {
        description: 'Google Gemini Flash 2.5 for fact checking (ultra fast model)',
        pattern: /^AIzaSy/,
        example: 'AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxx',
        category: 'AI Services',
        model: 'gemini-2.5-flash'
    },
    // Social Media APIs for future marketing features
    TWITTER_API_KEY: {
        description: 'Twitter/X API for social marketing (future feature)',
        pattern: /^[a-zA-Z0-9]{25,}$/,
        example: 'your-twitter-api-key',
        category: 'Social Media'
    },
    FACEBOOK_APP_ID: {
        description: 'Facebook App ID for social marketing (future feature)',
        pattern: /^\d+$/,
        example: '1234567890123456',
        category: 'Social Media'
    },
    LINKEDIN_CLIENT_ID: {
        description: 'LinkedIn API for professional marketing (future feature)',
        pattern: /^[a-zA-Z0-9]{12,}$/,
        example: 'your_linkedin_client_id',
        category: 'Social Media'
    },
    INSTAGRAM_ACCESS_TOKEN: {
        description: 'Instagram API for visual marketing (future feature)',
        pattern: /^[a-zA-Z0-9._-]+$/,
        example: 'your_instagram_token',
        category: 'Social Media'
    },
    // Testing & Infrastructure
    LT_USERNAME: {
        description: 'LambdaTest username for cross-browser testing',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_username',
        category: 'Testing'
    },
    LT_ACCESS_KEY: {
        description: 'LambdaTest access key',
        pattern: /^LT_/,
        example: 'LT_xxxxxxxxxxxxxxxxxxxxxxxx',
        category: 'Testing'
    },
    CLOUDFLARE_API_TOKEN: {
        description: 'Cloudflare API for CDN management',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_cloudflare_token',
        category: 'Infrastructure'
    },
    // Discovery & Analytics
    PRODUCTHUNT_API_TOKEN: {
        description: 'Product Hunt API for trending topics',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_producthunt_token',
        category: 'Discovery'
    },
    PRODUCTHUNT_API_KEY: {
        description: 'Product Hunt API Key',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_producthunt_key',
        category: 'Discovery'
    },
    PRODUCTHUNT_API_SECRET: {
        description: 'Product Hunt API Secret',
        pattern: /^[a-zA-Z0-9_-]+$/,
        example: 'your_producthunt_secret',
        category: 'Discovery'
    },
    // Payment Processing
    STRIPE_SECRET_KEY: {
        description: 'Stripe for direct payment processing',
        pattern: /^sk_live_/,
        example: 'sk_live_xxx...',
        category: 'Payments'
    },
    // Enhanced Monetization
    AMAZON_ACCESS_KEY: {
        description: 'Amazon PA-API for product details',
        pattern: /^[A-Z0-9]{20}$/,
        example: 'AKIAIOSFODNN7EXAMPLE',
        category: 'Monetization'
    },
    SHAREASALE_ID: {
        description: 'ShareASale affiliate ID',
        pattern: /^\d+$/,
        example: '123456',
        category: 'Monetization'
    },
    CLICKBANK_ID: {
        description: 'ClickBank affiliate ID',
        pattern: /^[a-zA-Z0-9]+$/,
        example: 'yourname',
        category: 'Monetization'
    }
};

// Rate limit tracking file
const RATE_LIMIT_FILE = path.join(__dirname, '../.env.runtime');

// Required agents that must be discoverable
const REQUIRED_AGENTS = [
    'plan.outline',
    'research.perplexity',
    'write.chapter',
    'style.polish',
    'qa.fact',
    'opt.rewrite',
    'deploy.hostinger',
    'affiliate.inject',
    'format.html',
    'qa.html',
    'publish.gumroad',
    'browserstack.test',
    'illustrate.chapter',
    'upload.kdp',
    'price.optimize',
    'marketing.launch'
];

// Required MCP servers
const REQUIRED_MCP_SERVERS = [
    'qa.fact',
    'style.polish',
    'opt.rewrite',
    'deploy.hostinger',
    'analytics.plausible'
];

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

// Check agent discovery
async function checkAgentDiscovery() {
    console.log('\n🤖 Checking Agent Discovery...\n');
    
    try {
        // Get list of registered agents
        const agentListOutput = execSync('agentcli list -q 2>/dev/null || echo ""', { encoding: 'utf8' });
        const registeredAgents = agentListOutput.trim().split('\n').filter(a => a);
        
        console.log(`   Found ${registeredAgents.length} registered agents\n`);
        
        // Check each required agent
        const missingAgents = [];
        const foundAgents = [];
        
        for (const agent of REQUIRED_AGENTS) {
            if (registeredAgents.includes(agent)) {
                foundAgents.push(agent);
                console.log(`${colors.green}✅ ${agent}${colors.reset}`);
            } else {
                missingAgents.push(agent);
                console.log(`${colors.red}❌ ${agent} - NOT FOUND${colors.reset}`);
            }
        }
        
        if (missingAgents.length > 0) {
            console.log(`\n${colors.red}❌ Missing ${missingAgents.length} required agents${colors.reset}`);
            console.log('\nTo fix, ensure all agent files:');
            console.log('1. Export a proper agent function');
            console.log('2. Are registered with agentcli');
            console.log('3. Have the correct CLI name in their exports');
            return false;
        }
        
        console.log(`\n${colors.green}✅ All ${REQUIRED_AGENTS.length} required agents found${colors.reset}`);
        return true;
        
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Could not check agent discovery${colors.reset}`);
        console.log('   Make sure agentcli is available in PATH');
        return false;
    }
}

// Check MCP server registration
async function checkMCPServers() {
    console.log('\n🔌 Checking MCP Server Registration...\n');
    
    try {
        // Get list of MCP servers
        const mcpListOutput = execSync('claude mcp list 2>/dev/null || echo ""', { encoding: 'utf8' });
        const registeredServers = mcpListOutput.trim().split('\n').filter(s => s);
        
        console.log(`   Found ${registeredServers.length} registered MCP servers\n`);
        
        // Check each required server
        const missingServers = [];
        const foundServers = [];
        
        for (const server of REQUIRED_MCP_SERVERS) {
            const serverFound = registeredServers.some(line => line.includes(server));
            
            if (serverFound) {
                foundServers.push(server);
                console.log(`${colors.green}✅ ${server}${colors.reset}`);
            } else {
                missingServers.push(server);
                console.log(`${colors.red}❌ ${server} - NOT REGISTERED${colors.reset}`);
            }
        }
        
        if (missingServers.length > 0) {
            console.log(`\n${colors.red}❌ Missing ${missingServers.length} required MCP servers${colors.reset}`);
            console.log('\nTo fix, register with:');
            missingServers.forEach(server => {
                console.log(`   claude mcp add ${server} /path/to/${server}.js`);
            });
            return false;
        }
        
        console.log(`\n${colors.green}✅ All ${REQUIRED_MCP_SERVERS.length} required MCP servers registered${colors.reset}`);
        return true;
        
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Could not check MCP servers${colors.reset}`);
        console.log('   Make sure Claude CLI is available');
        return false;
    }
}

// Main check function
async function checkEnvironment() {
    console.log('🔍 EBOOK MONEY MACHINE AI - Environment Check\n');
    console.log('=' + '='.repeat(50) + '\n');
    
    let hasErrors = false;
    let hasCriticalErrors = false;
    let hasWarnings = false;
    
    // Check CRITICAL variables first
    console.log('🚨 Critical Environment Variables (Required):\n');
    
    for (const [varName, config] of Object.entries(CRITICAL_VARS)) {
        const value = process.env[varName];
        
        if (!value) {
            console.log(`${colors.red}❌ ${varName}: MISSING (CRITICAL)${colors.reset}`);
            console.log(`   ${config.description}`);
            console.log(`   Category: ${config.category}`);
            console.log(`   Example: ${config.example}\n`);
            hasCriticalErrors = true;
            hasErrors = true;
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
    
    // Check IMPORTANT variables
    console.log('\n⚡ Important Environment Variables (Recommended):\n');
    
    for (const [varName, config] of Object.entries(IMPORTANT_VARS)) {
        const value = process.env[varName];
        
        if (!value) {
            console.log(`${colors.yellow}⚠️  ${varName}: MISSING${colors.reset}`);
            console.log(`   ${config.description}`);
            console.log(`   Category: ${config.category}`);
            console.log(`   Example: ${config.example}\n`);
            hasWarnings = true;
        } else if (config.pattern && !config.pattern.test(value)) {
            console.log(`${colors.yellow}⚠️  ${varName}: INVALID FORMAT${colors.reset}`);
            console.log(`   Expected format: ${config.example}\n`);
            hasWarnings = true;
        } else {
            // Special validation for GitHub token
            if (varName === 'GITHUB_TOKEN' && config.validator) {
                const isValid = await config.validator(value);
                if (!isValid) {
                    console.log(`${colors.red}❌ ${varName}: INVALID OR EXPIRED${colors.reset}`);
                    console.log(`   Token exists but failed authentication test`);
                    console.log(`   Run: ./scripts/github-auth-helper.sh fix\n`);
                    hasErrors = true;
                } else {
                    console.log(`${colors.green}✅ ${varName}: OK (verified)${colors.reset}`);
                    const masked = value.length > 14 ? 
                        `${value.substring(0, 10)}...${value.substring(value.length - 4)}` : 
                        value.substring(0, 4) + '***';
                    console.log(`   ${masked}\n`);
                }
            } else {
                console.log(`${colors.green}✅ ${varName}: OK${colors.reset}`);
                const masked = value.length > 14 ? 
                    `${value.substring(0, 10)}...${value.substring(value.length - 4)}` : 
                    value.substring(0, 4) + '***';
                console.log(`   ${masked}\n`);
            }
        }
    }
    
    // Check OPTIONAL variables
    console.log('\n🔧 Optional Environment Variables (Enhancements):\n');
    
    for (const [varName, config] of Object.entries(OPTIONAL_VARS)) {
        const value = process.env[varName];
        
        if (!value) {
            console.log(`${colors.yellow}⚠️  ${varName}: Not configured${colors.reset}`);
            console.log(`   ${config.description}`);
            console.log(`   Category: ${config.category}\n`);
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
        execSync('which claude', { stdio: 'ignore' });
        console.log(`${colors.green}✅ Claude CLI: Available${colors.reset}`);
    } catch (error) {
        console.log(`${colors.yellow}⚠️  Claude CLI: Not found in PATH${colors.reset}`);
        console.log('   Make sure you\'re running inside Claude Code CLI');
        hasWarnings = true;
    }
    
    // Check agent discovery
    const agentsOk = await checkAgentDiscovery();
    if (!agentsOk) {
        hasCriticalErrors = true;
        hasErrors = true;
    }
    
    // Check MCP servers
    const mcpOk = await checkMCPServers();
    if (!mcpOk) {
        hasWarnings = true; // MCP is optional but recommended
    }
    
    // Summary
    console.log('\n' + '=' + '='.repeat(50) + '\n');
    
    if (hasCriticalErrors) {
        console.log(`${colors.red}❌ Environment check FAILED (CRITICAL)${colors.reset}`);
        console.log('\nCritical errors found:');
        console.log('- Missing required API keys or quota exceeded');
        console.log('- Pipeline cannot continue\n');
        console.log('📚 Setup Guide: See API_SETUP_GUIDE.md for detailed instructions');
        process.exit(1);
    } else if (hasErrors) {
        console.log(`${colors.red}❌ Environment check FAILED${colors.reset}`);
        console.log('\nPlease set the missing environment variables in your .env file');
        console.log('📚 Setup Guide: See API_SETUP_GUIDE.md for detailed instructions');
        process.exit(1);
    } else if (hasWarnings) {
        console.log(`${colors.yellow}⚠️  Environment check passed with warnings${colors.reset}`);
        console.log('\nThe pipeline can run but some features may be limited:');
        console.log('- Marketing automation requires social media APIs');
        console.log('- Email notifications require SendGrid');
        console.log('- Cross-browser testing requires BrowserStack');
        console.log('\n📚 Setup Guide: See API_SETUP_GUIDE.md for API setup instructions');
    } else {
        console.log(`${colors.green}✅ Environment check PASSED${colors.reset}`);
        console.log('\nAll systems ready for ebook generation! 🚀');
        console.log('\n📊 API Status:');
        console.log(`   - Critical APIs: ${Object.keys(CRITICAL_VARS).length} configured`);
        console.log(`   - Important APIs: ${Object.keys(IMPORTANT_VARS).filter(k => process.env[k]).length}/${Object.keys(IMPORTANT_VARS).length} configured`);
        console.log(`   - Optional APIs: ${Object.keys(OPTIONAL_VARS).filter(k => process.env[k]).length}/${Object.keys(OPTIONAL_VARS).length} configured`);
    }
    
    // Create runtime file if it doesn't exist
    if (!fs.existsSync(RATE_LIMIT_FILE)) {
        fs.writeFileSync(RATE_LIMIT_FILE, '# Runtime rate limit tracking\n');
    }
    
    return !hasErrors;
}

// Run if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--agents')) {
        // Only check agents
        checkAgentDiscovery().then(ok => {
            process.exit(ok ? 0 : 1);
        });
    } else if (args.includes('--mcp')) {
        // Only check MCP
        checkMCPServers().then(ok => {
            process.exit(ok ? 0 : 1);
        });
    } else {
        // Full environment check
        checkEnvironment();
    }
}

module.exports = { checkEnvironment, updateRateLimit };