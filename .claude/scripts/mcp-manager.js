#!/usr/bin/env node

/**
 * MCP Manager for Claude Elite
 * Manages Model Context Protocol connections
 */

const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

const execAsync = promisify(exec);

// Load environment variables
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

// MCP configurations
const MCP_CONFIGS = {
  brightdata: {
    name: 'Bright Data',
    command: 'npx @brightdata/mcp-server',
    env: ['BRIGHTDATA_API_KEY'],
    description: 'Web scraping and browser automation'
  },
  supabase: {
    name: 'Supabase',
    command: 'npx @supabase/mcp-server',
    env: ['SUPABASE_URL', 'SUPABASE_KEY'],
    description: 'Database and realtime subscriptions'
  },
  puppeteer: {
    name: 'Puppeteer',
    command: 'node src/mcp/puppeteer/dist/index.js',
    env: [],
    description: 'Browser automation and screenshots',
    local: true
  },
  upstash: {
    name: 'Upstash Redis',
    command: 'npx @upstash/mcp-server',
    env: ['UPSTASH_REDIS_URL', 'UPSTASH_REDIS_TOKEN'],
    description: 'Caching and rate limiting'
  },
  shopify: {
    name: 'Shopify',
    command: 'npx @shopify/mcp-server',
    env: ['SHOPIFY_ADMIN_ACCESS_TOKEN', 'SHOPIFY_STORE_DOMAIN'],
    description: 'E-commerce operations',
    optional: true
  }
};

// Check if MCP is available
async function checkMCPAvailable() {
  try {
    await execAsync('claude --version');
    return true;
  } catch (error) {
    console.error(chalk.red('Claude CLI not found. Please install it first.'));
    console.log(chalk.yellow('Visit: https://claude.ai/download'));
    return false;
  }
}

// Check environment variables
function checkEnvVars(mcp) {
  const config = MCP_CONFIGS[mcp];
  const missing = [];
  
  for (const envVar of config.env) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

// List MCPs and their status
async function listMCPs() {
  console.log(chalk.blue('\n🔌 MCP Status\n'));
  
  // Check Claude CLI
  const cliAvailable = await checkMCPAvailable();
  if (!cliAvailable) return;
  
  // Get current MCP list from Claude
  let activeMCPs = [];
  try {
    const { stdout } = await execAsync('claude mcp list');
    activeMCPs = stdout.toLowerCase();
  } catch (error) {
    console.log(chalk.yellow('Unable to get active MCPs'));
  }
  
  // Check each MCP
  for (const [key, config] of Object.entries(MCP_CONFIGS)) {
    const isActive = activeMCPs.includes(key);
    const { valid, missing } = checkEnvVars(key);
    
    let status;
    let statusColor;
    
    if (isActive) {
      status = '✅ Active';
      statusColor = 'green';
    } else if (!valid) {
      status = '❌ Missing credentials';
      statusColor = 'red';
    } else if (config.optional) {
      status = '⏸️  Optional';
      statusColor = 'gray';
    } else {
      status = '⏹️  Ready to install';
      statusColor = 'yellow';
    }
    
    console.log(chalk[statusColor](`${status} ${config.name}`));
    console.log(chalk.gray(`     ${config.description}`));
    
    if (!valid && missing.length > 0) {
      console.log(chalk.red(`     Missing: ${missing.join(', ')}`));
    }
  }
  
  console.log('');
}

// Install a specific MCP
async function installMCP(mcpName) {
  const config = MCP_CONFIGS[mcpName];
  
  if (!config) {
    console.error(chalk.red(`Unknown MCP: ${mcpName}`));
    console.log(chalk.yellow('Available MCPs:'), Object.keys(MCP_CONFIGS).join(', '));
    return;
  }
  
  console.log(chalk.blue(`\n📦 Installing ${config.name}...\n`));
  
  // Check environment
  const { valid, missing } = checkEnvVars(mcpName);
  if (!valid) {
    console.error(chalk.red('Missing environment variables:'));
    missing.forEach(v => console.log(`  - ${v}`));
    console.log(chalk.yellow('\nAdd these to .env.local and try again'));
    return;
  }
  
  // Build command
  let installCmd = `claude mcp add ${mcpName} '${config.command}'`;
  
  // Add environment arguments
  for (const envVar of config.env) {
    const value = process.env[envVar];
    const argName = envVar.toLowerCase().replace(/_/g, '-');
    installCmd += ` --${argName}='${value}'`;
  }
  
  console.log(chalk.gray('Executing:'), installCmd.replace(/='[^']+'/g, '=***'));
  
  // Execute installation
  try {
    const { stdout, stderr } = await execAsync(installCmd);
    console.log(stdout);
    if (stderr) console.error(chalk.yellow(stderr));
    console.log(chalk.green(`\n✅ ${config.name} installed successfully!`));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to install ${config.name}:`));
    console.error(error.message);
  }
}

// Install all MCPs
async function installAll() {
  console.log(chalk.blue('\n🚀 Installing all MCPs...\n'));
  
  const toInstall = Object.keys(MCP_CONFIGS).filter(mcp => {
    const config = MCP_CONFIGS[mcp];
    const { valid } = checkEnvVars(mcp);
    return valid && !config.optional;
  });
  
  for (const mcp of toInstall) {
    await installMCP(mcp);
    console.log(''); // Add spacing
  }
  
  console.log(chalk.green('\n✅ Installation complete!'));
  await listMCPs();
}

// Remove an MCP
async function removeMCP(mcpName) {
  const config = MCP_CONFIGS[mcpName];
  
  if (!config) {
    console.error(chalk.red(`Unknown MCP: ${mcpName}`));
    return;
  }
  
  console.log(chalk.yellow(`\n🗑️  Removing ${config.name}...\n`));
  
  try {
    const { stdout, stderr } = await execAsync(`claude mcp remove ${mcpName}`);
    console.log(stdout);
    if (stderr) console.error(chalk.yellow(stderr));
    console.log(chalk.green(`\n✅ ${config.name} removed`));
  } catch (error) {
    console.error(chalk.red(`\n❌ Failed to remove ${config.name}:`));
    console.error(error.message);
  }
}

// Test MCP connection
async function testMCP(mcpName) {
  const config = MCP_CONFIGS[mcpName];
  
  if (!config) {
    console.error(chalk.red(`Unknown MCP: ${mcpName}`));
    return;
  }
  
  console.log(chalk.blue(`\n🧪 Testing ${config.name}...\n`));
  
  // Simple test based on MCP type
  switch (mcpName) {
    case 'brightdata':
      console.log('Testing web scraping...');
      // Add actual test here
      break;
      
    case 'supabase':
      console.log('Testing database connection...');
      // Add actual test here
      break;
      
    case 'puppeteer':
      console.log('Testing browser automation...');
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('https://example.com');
        const title = await page.title();
        await browser.close();
        console.log(chalk.green(`✅ Browser test successful! Title: ${title}`));
      } catch (error) {
        console.error(chalk.red('❌ Browser test failed:'), error.message);
      }
      break;
      
    case 'upstash':
      console.log('Testing Redis connection...');
      // Add actual test here
      break;
      
    default:
      console.log(chalk.yellow('No test available for this MCP'));
  }
}

// Show help
function showHelp() {
  console.log(chalk.blue('🔌 MCP Manager\n'));
  console.log('Usage: claude /mcp <action> [args]\n');
  console.log('Actions:');
  console.log('  list           Show all MCPs and their status');
  console.log('  install <mcp>  Install a specific MCP');
  console.log('  install-all    Install all available MCPs');
  console.log('  remove <mcp>   Remove an MCP');
  console.log('  test <mcp>     Test MCP connection');
  console.log('\nAvailable MCPs:');
  Object.entries(MCP_CONFIGS).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(12)} ${config.description}`);
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'list';
  const mcpName = args[1];
  
  if (action === '--help' || action === '-h') {
    showHelp();
    process.exit(0);
  }
  
  switch (action) {
    case 'list':
      await listMCPs();
      break;
      
    case 'install':
      if (!mcpName) {
        console.error(chalk.red('Please specify an MCP to install'));
        showHelp();
        process.exit(1);
      }
      await installMCP(mcpName);
      break;
      
    case 'install-all':
      await installAll();
      break;
      
    case 'remove':
      if (!mcpName) {
        console.error(chalk.red('Please specify an MCP to remove'));
        showHelp();
        process.exit(1);
      }
      await removeMCP(mcpName);
      break;
      
    case 'test':
      if (!mcpName) {
        console.error(chalk.red('Please specify an MCP to test'));
        showHelp();
        process.exit(1);
      }
      await testMCP(mcpName);
      break;
      
    default:
      console.error(chalk.red(`Unknown action: ${action}`));
      showHelp();
      process.exit(1);
  }
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}