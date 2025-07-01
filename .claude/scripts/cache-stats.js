#!/usr/bin/env node

/**
 * Cache Statistics for Claude Elite
 * Shows cache usage and performance metrics
 */

const chalk = require('chalk');
const cache = require('../helpers/cache');

async function main() {
  console.log(chalk.blue('\n📊 Cache Statistics\n'));
  
  try {
    const stats = await cache.stats();
    
    if (stats.type === 'redis') {
      console.log(chalk.green('Cache Type: Upstash Redis'));
      
      if (stats.connected) {
        console.log(chalk.green(`Status: Connected ✅`));
        console.log(`Total Keys: ${stats.keys}`);
      } else {
        console.log(chalk.red(`Status: Disconnected ❌`));
        console.log(chalk.yellow(`Error: ${stats.error}`));
      }
    } else {
      console.log(chalk.yellow('Cache Type: In-Memory (Fallback)'));
      console.log(`Active Keys: ${stats.keys}`);
      console.log(`Total Keys: ${stats.totalKeys}`);
      console.log(`Memory Usage: ${(stats.sizeBytes / 1024).toFixed(2)} KB`);
      
      if (stats.keys < stats.totalKeys) {
        console.log(chalk.gray(`Expired Keys: ${stats.totalKeys - stats.keys}`));
      }
    }
    
    // Test cache performance
    console.log(chalk.blue('\n⚡ Performance Test\n'));
    
    const testData = { test: 'data', timestamp: Date.now() };
    
    // Write test
    const writeStart = Date.now();
    await cache.set('perf-test', ['test-key'], testData);
    const writeTime = Date.now() - writeStart;
    
    // Read test
    const readStart = Date.now();
    const result = await cache.get('perf-test', 'test-key');
    const readTime = Date.now() - readStart;
    
    console.log(`Write Speed: ${writeTime}ms`);
    console.log(`Read Speed: ${readTime}ms`);
    
    if (result && result.timestamp === testData.timestamp) {
      console.log(chalk.green('Data Integrity: ✅ Passed'));
    } else {
      console.log(chalk.red('Data Integrity: ❌ Failed'));
    }
    
    // Clean up
    await cache.del('perf-test', 'test-key');
    
    // Show cache configuration
    console.log(chalk.blue('\n⚙️  Configuration\n'));
    console.log(`Default TTL: ${process.env.CACHE_TTL_SECONDS || '3600'} seconds`);
    console.log(`Redis URL: ${process.env.UPSTASH_REDIS_URL ? '✅ Set' : '❌ Not set'}`);
    console.log(`Redis Token: ${process.env.UPSTASH_REDIS_TOKEN ? '✅ Set' : '❌ Not set'}`);
    
  } catch (error) {
    console.error(chalk.red('Error getting cache stats:'), error.message);
  }
}

if (require.main === module) {
  main();
}