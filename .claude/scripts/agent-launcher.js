#!/usr/bin/env node

/**
 * Agent Launcher for Claude Elite
 * Launches and manages autonomous agents
 */

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs').promises;

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
  console.log(chalk.blue('\n🤖 Available Agents\n'));
  
  Object.entries(AGENTS).forEach(([name, config]) => {
    console.log(chalk.green(`  ${name}`));
    console.log(chalk.gray(`    ${config.description}`));
    if (config.args.length > 0) {
      console.log(chalk.gray(`    Options: ${config.args.join(', ')}`));
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
    console.error(chalk.red(`Unknown agent: ${agentName}`));
    showAgents();
    process.exit(1);
  }
  
  const agentPath = path.join(process.cwd(), agent.path);
  
  // Check if agent exists
  try {
    await fs.access(agentPath);
  } catch (error) {
    console.error(chalk.red(`Agent file not found: ${agentPath}`));
    console.log(chalk.yellow('Building agents...'));
    
    // Try to build TypeScript agents
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: path.join(process.cwd(), 'agents'),
      stdio: 'inherit'
    });
    
    await new Promise((resolve) => {
      buildProcess.on('exit', resolve);
    });
  }
  
  console.log(chalk.blue(`\n🚀 Launching ${agentName}...\n`));
  
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
    console.error(chalk.red('Unsupported agent type'));
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
    console.error(chalk.red(`Failed to launch agent: ${error.message}`));
    process.exit(1);
  });
  
  agentProcess.on('exit', (code) => {
    if (code === 0) {
      console.log(chalk.green(`\n✅ Agent completed successfully`));
    } else {
      console.log(chalk.red(`\n❌ Agent exited with code ${code}`));
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
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}