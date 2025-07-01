#!/usr/bin/env node

/**
 * MCP Dashboard for Claude Elite
 * Visual dashboard for all installed MCPs
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ANSI colors
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  magenta: (text) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// MCP Categories and metadata
const MCP_METADATA = {
  // Databases
  'postgres': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'PostgreSQL database operations',
    example: 'Query and manage PostgreSQL databases',
    needs: ['POSTGRES_URL']
  },
  'sqlite': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'SQLite database operations',
    example: 'Local SQLite database management',
    needs: []
  },
  'redis': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'Redis cache operations',
    example: 'Cache data and manage Redis',
    needs: ['REDIS_URL']
  },
  'redis-mcp': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'Redis cache operations',
    example: 'Cache data and manage Redis',
    needs: ['REDIS_URL']
  },
  'supabase': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'Supabase database & storage',
    example: 'Realtime database and file storage',
    needs: ['SUPABASE_URL', 'SUPABASE_KEY']
  },
  'upstash': { 
    category: 'Databases', 
    icon: '🗄️', 
    description: 'Upstash Redis serverless',
    example: 'Serverless Redis cache',
    needs: ['UPSTASH_REDIS_URL', 'UPSTASH_REDIS_TOKEN']
  },

  // APIs & Integrations
  'github': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'GitHub API integration',
    example: 'Manage repos, issues, PRs',
    needs: ['GITHUB_TOKEN']
  },
  'gitlab': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'GitLab API integration',
    example: 'GitLab projects and MRs',
    needs: ['GITLAB_TOKEN']
  },
  'slack': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Slack workspace integration',
    example: 'Send messages, manage channels',
    needs: ['SLACK_TOKEN']
  },
  'notion': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Notion workspace integration',
    example: 'Manage Notion pages and databases',
    needs: ['NOTION_API_KEY']
  },
  'notion-local': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Notion workspace (local build)',
    example: 'Manage Notion pages and databases',
    needs: ['NOTION_API_KEY']
  },
  'shopify': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Shopify store management',
    example: 'Products, orders, customers',
    needs: ['SHOPIFY_STORE', 'SHOPIFY_ACCESS_TOKEN']
  },
  'shopify-local': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Shopify store (local build)',
    example: 'Products, orders, customers',
    needs: ['SHOPIFY_STORE', 'SHOPIFY_ACCESS_TOKEN']
  },
  'zapier': { 
    category: 'APIs', 
    icon: '🌐', 
    description: 'Zapier automation',
    example: 'Trigger zaps and workflows',
    needs: []
  },

  // Tools & Utilities
  'filesystem': { 
    category: 'Tools', 
    icon: '🔧', 
    description: 'File system operations',
    example: 'Read, write, manage files',
    needs: []
  },
  'memory': { 
    category: 'Tools', 
    icon: '🔧', 
    description: 'Persistent memory storage',
    example: 'Store and recall information',
    needs: []
  },
  'time-mcp': { 
    category: 'Tools', 
    icon: '🔧', 
    description: 'Time and timezone operations',
    example: 'Date/time calculations',
    needs: []
  },
  'fetch': { 
    category: 'Tools', 
    icon: '🔧', 
    description: 'HTTP requests and APIs',
    example: 'Make web requests',
    needs: []
  },
  'git-mcp': { 
    category: 'Tools', 
    icon: '🔧', 
    description: 'Git version control',
    example: 'Git operations',
    needs: []
  },

  // Web & Browser
  'puppeteer': { 
    category: 'Web', 
    icon: '🌍', 
    description: 'Browser automation',
    example: 'Screenshots, PDFs, scraping',
    needs: []
  },
  'browser-tools': { 
    category: 'Web', 
    icon: '🌍', 
    description: 'Browser debugging tools',
    example: 'Inspect, debug web pages',
    needs: []
  },
  'brave-search': { 
    category: 'Web', 
    icon: '🌍', 
    description: 'Brave search engine',
    example: 'Web search',
    needs: ['BRAVE_SEARCH_API_KEY']
  },
  'brightdata': { 
    category: 'Web', 
    icon: '🌍', 
    description: 'Web scraping proxy',
    example: 'Scrape websites at scale',
    needs: ['BRIGHTDATA_API_KEY']
  },
  'oxylabs': { 
    category: 'Web', 
    icon: '🌍', 
    description: 'Web scraping service',
    example: 'Advanced web scraping',
    needs: ['OXYLABS_USERNAME', 'OXYLABS_PASSWORD']
  },

  // Cloud & Storage
  'gdrive': { 
    category: 'Cloud', 
    icon: '☁️', 
    description: 'Google Drive integration',
    example: 'Manage Google Drive files',
    needs: ['GOOGLE_CREDENTIALS']
  },
  'aws-kb': { 
    category: 'Cloud', 
    icon: '☁️', 
    description: 'AWS Knowledge Base',
    example: 'AWS documentation search',
    needs: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']
  },

  // Analytics & Monitoring
  'sentry': { 
    category: 'Analytics', 
    icon: '📊', 
    description: 'Error tracking',
    example: 'Monitor errors and issues',
    needs: ['SENTRY_DSN']
  },

  // Special Purpose
  'sequential': { 
    category: 'Special', 
    icon: '🚀', 
    description: 'Sequential thinking mode',
    example: 'Step-by-step processing',
    needs: []
  },
  'everything': { 
    category: 'Special', 
    icon: '🚀', 
    description: 'Universal search',
    example: 'Search across everything',
    needs: []
  },
  'everart': { 
    category: 'Special', 
    icon: '🚀', 
    description: 'AI art generation',
    example: 'Generate images',
    needs: ['EVERART_API_KEY']
  },
  'google-maps': { 
    category: 'Special', 
    icon: '🚀', 
    description: 'Maps and location',
    example: 'Geocoding, directions',
    needs: ['GOOGLE_MAPS_API_KEY']
  }
};

// Get all installed MCPs
async function getInstalledMCPs() {
  try {
    const { stdout } = await execPromise('claude mcp list');
    const lines = stdout.trim().split('\n');
    const mcps = [];
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const [_, name, command] = match;
        mcps.push({ name: name.trim(), command: command.trim() });
      }
    });
    
    return mcps;
  } catch (error) {
    console.error(colors.red('Error getting MCP list:'), error.message);
    return [];
  }
}

// Group MCPs by category
function groupByCategory(mcps) {
  const grouped = {
    'Databases': [],
    'APIs': [],
    'Tools': [],
    'Web': [],
    'Cloud': [],
    'Analytics': [],
    'Special': [],
    'Unknown': []
  };
  
  mcps.forEach(mcp => {
    const metadata = MCP_METADATA[mcp.name] || {};
    const category = metadata.category || 'Unknown';
    grouped[category].push({ ...mcp, ...metadata });
  });
  
  // Remove empty categories
  Object.keys(grouped).forEach(key => {
    if (grouped[key].length === 0) {
      delete grouped[key];
    }
  });
  
  return grouped;
}

// Display dashboard
async function displayDashboard() {
  console.clear();
  console.log(colors.bold(colors.magenta(`
╔═══════════════════════════════════════════════════════════╗
║                  🎯 MCP DASHBOARD ELITE                   ║
╚═══════════════════════════════════════════════════════════╝
`)));
  
  const mcps = await getInstalledMCPs();
  const grouped = groupByCategory(mcps);
  
  console.log(colors.cyan(`Total MCPs installed: ${mcps.length}\n`));
  
  // Display by category
  Object.entries(grouped).forEach(([category, categoryMcps]) => {
    const icon = categoryMcps[0]?.icon || '📦';
    console.log(colors.bold(`\n${icon} ${category} (${categoryMcps.length})`));
    console.log(colors.gray('─'.repeat(50)));
    
    categoryMcps.forEach(mcp => {
      console.log(`\n  ${colors.green('●')} ${colors.bold(mcp.name)}`);
      if (mcp.description) {
        console.log(`     ${colors.gray(mcp.description)}`);
      }
      if (mcp.example) {
        console.log(`     ${colors.cyan('Example:')} ${mcp.example}`);
      }
      if (mcp.needs && mcp.needs.length > 0) {
        const hasAll = mcp.needs.every(key => process.env[key]);
        const status = hasAll ? colors.green('✓') : colors.yellow('⚠');
        console.log(`     ${colors.yellow('Needs:')} ${mcp.needs.join(', ')} ${status}`);
      }
      console.log(`     ${colors.gray('Command:')} ${mcp.command.substring(0, 50)}...`);
    });
  });
  
  // Quick stats
  console.log(colors.bold(`\n\n📊 Quick Stats:`));
  console.log(colors.gray('─'.repeat(50)));
  
  const stats = {
    'Total MCPs': mcps.length,
    'Categories': Object.keys(grouped).length,
    'Needs Config': mcps.filter(m => {
      const meta = MCP_METADATA[m.name];
      return meta?.needs?.length > 0;
    }).length
  };
  
  Object.entries(stats).forEach(([key, value]) => {
    console.log(`${key.padEnd(15)} ${colors.cyan(value)}`);
  });
  
  // Usage tips
  console.log(colors.bold(`\n\n💡 Usage Tips:`));
  console.log(colors.gray('─'.repeat(50)));
  console.log('• Use MCPs directly in Claude with natural language');
  console.log('• Example: "Use github to create a new issue"');
  console.log('• Example: "Use puppeteer to take a screenshot"');
  console.log('• Run "claude mcp list" for raw list');
  console.log('• Add missing API keys to .env.local');
  
  console.log(colors.gray('\n─'.repeat(60)));
  console.log(colors.gray('Claude Elite MCP Dashboard v1.0'));
}

// Interactive mode
async function interactive() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  await displayDashboard();
  
  console.log('\n\nPress Enter to refresh, or Ctrl+C to exit...');
  
  rl.on('line', async () => {
    await displayDashboard();
    console.log('\n\nPress Enter to refresh, or Ctrl+C to exit...');
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--once') || args.includes('-o')) {
    await displayDashboard();
  } else {
    await interactive();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { getInstalledMCPs, groupByCategory, displayDashboard };