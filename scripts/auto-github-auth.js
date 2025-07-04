#!/usr/bin/env node

/**
 * Automatic GitHub Authentication Recovery
 * 
 * This script automatically recovers GitHub auth from multiple sources
 * and is called by other scripts when they need GitHub access.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

// Test if a GitHub token is valid
async function testGitHubToken(token) {
    try {
        const response = execSync(
            `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token ${token}" https://api.github.com/user`,
            { encoding: 'utf8' }
        ).trim();
        return response === '200';
    } catch (error) {
        return false;
    }
}

// Get token from API Vault
function getTokenFromVault() {
    try {
        const vaultPath = '/Users/d1f/Desktop/.api-vault/api-manager.sh';
        if (!fs.existsSync(vaultPath)) return null;
        
        const token = execSync(`${vaultPath} get github token`, { encoding: 'utf8' }).trim();
        return token || null;
    } catch (error) {
        return null;
    }
}

// Get token from .env.local
function getTokenFromEnvLocal() {
    try {
        const envPath = path.join(process.cwd(), '.env.local');
        if (!fs.existsSync(envPath)) return null;
        
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^GITHUB_TOKEN=(.+)$/m);
        return match ? match[1].replace(/["']/g, '') : null;
    } catch (error) {
        return null;
    }
}

// Get token from gh CLI
function getTokenFromGhCli() {
    try {
        const token = execSync('gh auth token 2>/dev/null', { encoding: 'utf8' }).trim();
        return token || null;
    } catch (error) {
        return null;
    }
}

// Save token to all locations
function saveTokenEverywhere(token) {
    // Save to environment
    process.env.GITHUB_TOKEN = token;
    
    // Save to .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('GITHUB_TOKEN=')) {
            content = content.replace(/^GITHUB_TOKEN=.*/m, `GITHUB_TOKEN=${token}`);
        } else {
            content += `\nGITHUB_TOKEN=${token}\n`;
        }
        fs.writeFileSync(envPath, content);
    }
    
    // Save to API Vault
    try {
        const vaultPath = '/Users/d1f/Desktop/.api-vault/api-manager.sh';
        if (fs.existsSync(vaultPath)) {
            execSync(`${vaultPath} save github token "${token}" book-automation`, { stdio: 'ignore' });
        }
    } catch (error) {
        // Ignore vault errors
    }
    
    // Configure gh CLI
    try {
        execSync(`echo "${token}" | gh auth login --with-token 2>/dev/null`, { stdio: 'ignore' });
    } catch (error) {
        // Ignore gh CLI errors
    }
}

// Main function to get or recover token
async function ensureGitHubAuth() {
    console.log(`${colors.yellow}🔍 Checking GitHub authentication...${colors.reset}`);
    
    // Check existing environment variable
    if (process.env.GITHUB_TOKEN) {
        if (await testGitHubToken(process.env.GITHUB_TOKEN)) {
            console.log(`${colors.green}✅ Using existing GITHUB_TOKEN${colors.reset}`);
            return process.env.GITHUB_TOKEN;
        }
    }
    
    // Try to recover from various sources
    const sources = [
        { name: '.env.local', getter: getTokenFromEnvLocal },
        { name: 'API Vault', getter: getTokenFromVault },
        { name: 'gh CLI', getter: getTokenFromGhCli }
    ];
    
    for (const source of sources) {
        console.log(`   Checking ${source.name}...`);
        const token = source.getter();
        if (token && await testGitHubToken(token)) {
            console.log(`${colors.green}✅ Found valid token in ${source.name}${colors.reset}`);
            saveTokenEverywhere(token);
            process.env.GITHUB_TOKEN = token;
            return token;
        }
    }
    
    // No valid token found
    console.log(`${colors.red}❌ No valid GitHub token found${colors.reset}`);
    console.log('\nTo fix this issue:');
    console.log('1. Run: ./scripts/github-auth-helper.sh setup');
    console.log('2. Or set GITHUB_TOKEN environment variable');
    console.log('3. Or run: gh auth login');
    
    throw new Error('GitHub authentication required');
}

// Export for use in other scripts
module.exports = { ensureGitHubAuth };

// Run if called directly
if (require.main === module) {
    ensureGitHubAuth()
        .then(token => {
            console.log(`\n${colors.green}✅ GitHub auth configured successfully${colors.reset}`);
            console.log(`Token: ${token.substring(0, 10)}...${token.substring(token.length - 4)}`);
            process.exit(0);
        })
        .catch(error => {
            console.error(`\n${colors.red}❌ ${error.message}${colors.reset}`);
            process.exit(1);
        });
}