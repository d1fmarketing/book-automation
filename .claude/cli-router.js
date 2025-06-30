#!/usr/bin/env node

/**
 * Claude Elite CLI Router
 * Maps slash commands to their implementations
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
// Simple color codes instead of chalk
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Command registry
const COMMANDS = {
  // Core commands
  '/init': {
    script: '.claude/scripts/init-project.sh',
    description: 'Initialize Claude Elite in current project'
  },
  '/mcp': {
    script: '.claude/scripts/mcp-manager.js',
    description: 'Manage MCP connections'
  },
  '/todo': {
    script: '.claude/scripts/todo-manager.js',
    description: 'Manage project tasks'
  },
  '/rollback': {
    script: '.claude/scripts/emergency-rollback.sh',
    description: 'Emergency rollback procedures'
  },
  
  // Quick actions
  '/fix': {
    script: '.claude/scripts/quick-fix.sh',
    description: 'Quick fix menu for common issues'
  },
  '/build': {
    script: 'npm run build:instrumented',
    type: 'npm',
    description: 'Build with observability'
  },
  '/test': {
    script: 'npm test',
    type: 'npm',
    description: 'Run all tests'
  },
  
  // Agent commands
  '/agent': {
    script: '.claude/scripts/agent-launcher.js',
    description: 'Launch autonomous agents'
  },
  
  // Performance commands
  '/perf': {
    script: '.claude/scripts/perf-check.js',
    description: 'Performance analysis'
  },
  '/cache': {
    script: '.claude/scripts/cache-stats.js',
    description: 'Cache statistics and management'
  }
};

// Help text
function showHelp() {
  console.log(colors.blue('🤖 Claude Elite Commands\n'));
  console.log('Usage: claude <command> [args]\n');
  console.log('Commands:');
  
  Object.entries(COMMANDS).forEach(([cmd, info]) => {
    console.log(`  ${colors.green(cmd.padEnd(12))} ${info.description}`);
  });
  
  console.log('\nExamples:');
  console.log('  claude /init');
  console.log('  claude /todo add "Implement caching"');
  console.log('  claude /mcp list');
  console.log('  claude /agent ProductOptimizer --dry-run');
}

// Execute command
async function executeCommand(command, args) {
  const cmdInfo = COMMANDS[command];
  
  if (!cmdInfo) {
    console.error(colors.red(`Unknown command: ${command}`));
    console.log(colors.yellow('\nDid you mean one of these?'));
    const similar = Object.keys(COMMANDS).filter(cmd => 
      cmd.includes(command.slice(1)) || command.includes(cmd.slice(1))
    );
    similar.forEach(cmd => console.log(`  ${cmd}`));
    process.exit(1);
  }
  
  // Check if script exists
  if (cmdInfo.type !== 'npm') {
    const scriptPath = path.resolve(cmdInfo.script);
    try {
      await fs.access(scriptPath);
    } catch (error) {
      console.error(colors.red(`Script not found: ${scriptPath}`));
      console.log(colors.yellow('Creating stub...'));
      
      // Create stub script
      const stubContent = `#!/bin/bash
# ${cmdInfo.description}
# TODO: Implement ${command}

echo "🚧 ${command} - Not yet implemented"
echo "Args: $@"
`;
      
      await fs.mkdir(path.dirname(scriptPath), { recursive: true });
      await fs.writeFile(scriptPath, stubContent);
      await fs.chmod(scriptPath, 0o755);
      
      console.log(colors.green(`Created stub at: ${scriptPath}`));
    }
  }
  
  // Execute the command
  console.log(colors.blue(`Executing: ${command} ${args.join(' ')}`));
  
  let child;
  if (cmdInfo.type === 'npm') {
    // Execute npm script
    child = spawn('npm', ['run', cmdInfo.script.split(' ')[2]], {
      stdio: 'inherit',
      shell: true
    });
  } else if (cmdInfo.script.endsWith('.js')) {
    // Execute Node.js script
    child = spawn('node', [cmdInfo.script, ...args], {
      stdio: 'inherit'
    });
  } else {
    // Execute shell script
    child = spawn(cmdInfo.script, args, {
      stdio: 'inherit',
      shell: true
    });
  }
  
  child.on('error', (error) => {
    console.error(colors.red(`Failed to execute: ${error.message}`));
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  
  // Ensure command starts with /
  const normalizedCommand = command.startsWith('/') ? command : `/${command}`;
  
  await executeCommand(normalizedCommand, commandArgs);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { executeCommand, COMMANDS };