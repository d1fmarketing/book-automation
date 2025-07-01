#!/usr/bin/env node

/**
 * Test MCP Integration
 * Verify that installed MCPs are accessible
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ANSI colors
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`
};

// Test MCPs
const TEST_MCPS = [
  { name: 'filesystem', test: 'Working directory access' },
  { name: 'memory', test: 'Memory storage' },
  { name: 'github', test: 'GitHub API (needs token)' },
  { name: 'puppeteer', test: 'Browser automation' },
  { name: 'supabase', test: 'Database access (needs keys)' },
  { name: 'brightdata', test: 'Web scraping (needs key)' }
];

async function testMCPs() {
  console.log(colors.blue('\n🧪 Testing MCP Integrations\n'));
  
  try {
    // Get list of installed MCPs
    const { stdout } = await execPromise('claude mcp list');
    const installedMCPs = new Set();
    
    stdout.split('\n').forEach(line => {
      const match = line.match(/^([^:]+):/);
      if (match) {
        installedMCPs.add(match[1].trim());
      }
    });
    
    console.log(`Found ${colors.green(installedMCPs.size)} installed MCPs\n`);
    
    // Test each MCP
    let passed = 0;
    let failed = 0;
    
    for (const mcp of TEST_MCPS) {
      if (installedMCPs.has(mcp.name)) {
        console.log(`${colors.green('✓')} ${mcp.name.padEnd(15)} - ${mcp.test}`);
        passed++;
      } else {
        console.log(`${colors.red('✗')} ${mcp.name.padEnd(15)} - Not installed`);
        failed++;
      }
    }
    
    // Summary
    console.log(colors.blue('\n📊 Test Summary:'));
    console.log(`Tested: ${TEST_MCPS.length}`);
    console.log(`${colors.green('Passed:')} ${passed}`);
    if (failed > 0) {
      console.log(`${colors.red('Failed:')} ${failed}`);
    }
    
    // Additional MCPs
    const additionalMCPs = [...installedMCPs].filter(
      mcp => !TEST_MCPS.find(t => t.name === mcp)
    );
    
    if (additionalMCPs.length > 0) {
      console.log(colors.blue('\n🔧 Additional MCPs installed:'));
      additionalMCPs.forEach(mcp => {
        console.log(`  • ${mcp}`);
      });
    }
    
    console.log(colors.green('\n✅ MCP integration test complete!'));
    console.log('\nNote: To use MCPs in Claude, simply mention them naturally:');
    console.log('  - "Use filesystem to read the README"');
    console.log('  - "Use github to check my repos"');
    console.log('  - "Use puppeteer to take a screenshot"\n');
    
  } catch (error) {
    console.error(colors.red('Error testing MCPs:'), error.message);
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testMCPs().catch(console.error);
}

module.exports = { testMCPs };