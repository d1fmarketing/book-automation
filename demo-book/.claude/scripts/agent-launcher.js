#!/usr/bin/env node

/**
 * Agent Launcher for Claude Elite
 * Launches and manages autonomous agents
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// ANSI colors
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`
};

// Available agents
const AGENTS = {
  ProductOptimizer: {
    path: 'agents/src/ProductOptimizer.ts',
    description: 'Optimizes product titles and descriptions',
    args: ['--dry-run', '--limit']
  }
  // Add more agents here as they're created
};

// Show available agents
function showAgents() {
  console.log(colors.blue('\n🤖 Available Agents\n'));
  
  Object.entries(AGENTS).forEach(([name, config]) => {
    console.log(colors.green(`  ${name}`));
    console.log(colors.gray(`    ${config.description}`));
    if (config.args.length > 0) {
      console.log(colors.gray(`    Options: ${config.args.join(', ')}`));
    }
  });
  
  console.log('\nUsage:');
  console.log('  claude /agent <agent-name> [options]');
  console.log('\nExamples:');
  console.log('  claude /agent ProductOptimizer --dry-run');
  console.log('  claude /agent ProductOptimizer --limit 5');
}

// Launch an agent
async function launchAgent(agentName, args) {
  const agent = AGENTS[agentName];
  
  if (!agent) {
    console.error(colors.red(`Unknown agent: ${agentName}`));
    showAgents();
    process.exit(1);
  }
  
  const agentPath = path.join(process.cwd(), agent.path);
  
  // Check if agent exists
  try {
    await fs.access(agentPath);
  } catch (error) {
    console.error(colors.red(`Agent file not found: ${agentPath}`));
    console.log(colors.yellow('Building agents...'));
    
    // Try to build TypeScript agents
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: path.join(process.cwd(), 'agents'),
      stdio: 'inherit'
    });
    
    await new Promise((resolve) => {
      buildProcess.on('exit', resolve);
    });
  }
  
  console.log(colors.blue(`\n🚀 Launching ${agentName}...\n`));
  
  // Determine how to run the agent
  let command, commandArgs;
  
  if (agentPath.endsWith('.ts')) {
    // TypeScript - use ts-node
    command = 'npx';
    commandArgs = ['ts-node', agentPath, ...args];
  } else if (agentPath.endsWith('.js')) {
    // JavaScript
    command = 'node';
    commandArgs = [agentPath, ...args];
  } else if (agentPath.endsWith('.py')) {
    // Python
    command = 'python3';
    commandArgs = [agentPath, ...args];
  } else {
    console.error(colors.red('Unsupported agent type'));
    process.exit(1);
  }
  
  // Launch the agent
  const agentProcess = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  agentProcess.on('error', (error) => {
    console.error(colors.red(`Failed to launch agent: ${error.message}`));
    process.exit(1);
  });
  
  agentProcess.on('exit', (code) => {
    if (code === 0) {
      console.log(colors.green(`\n✅ Agent completed successfully`));
    } else {
      console.log(colors.red(`\n❌ Agent exited with code ${code}`));
    }
    process.exit(code || 0);
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const agentName = args[0];
  const agentArgs = args.slice(1);
  
  if (!agentName || agentName === '--help' || agentName === '-h') {
    showAgents();
    process.exit(0);
  }
  
  await launchAgent(agentName, agentArgs);
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('Fatal error:'), error);
    process.exit(1);
  });
}