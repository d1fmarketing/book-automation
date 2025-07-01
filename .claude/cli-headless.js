#!/usr/bin/env node

/**
 * Claude Elite CLI - Headless Mode Support
 * Enables piping, streaming, and programmatic usage
 */

const readline = require('readline');
const { executeCommand, COMMANDS } = require('./cli-router.js');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: null,
    args: [],
    json: false,
    quiet: false,
    help: false,
    stdin: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--json' || arg === '-j') {
      options.json = true;
    } else if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--stdin' || arg === '-') {
      options.stdin = true;
    } else if (arg.startsWith('/') && !options.command) {
      options.command = arg;
      options.args = args.slice(i + 1);
      break;
    } else if (!options.command) {
      // Allow commands without / prefix
      const cmdWithSlash = `/${arg}`;
      if (COMMANDS[cmdWithSlash]) {
        options.command = cmdWithSlash;
        options.args = args.slice(i + 1);
        break;
      }
    }
  }

  return options;
}

// Read from stdin
async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      input += line + '\n';
    });

    rl.on('close', () => {
      resolve(input.trim());
    });
  });
}

// Output formatter
function output(data, options) {
  if (options.quiet) return;
  
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'object') {
    console.log(data.message || JSON.stringify(data));
  } else {
    console.log(data);
  }
}

// Enhanced help with examples
function showHelp() {
  console.log(`
Claude Elite CLI - Headless Mode

Usage: claude [options] <command> [args]

Options:
  --json, -j     Output in JSON format
  --quiet, -q    Suppress output
  --stdin, -     Read input from stdin
  --help, -h     Show this help

Commands:
  ${Object.entries(COMMANDS).map(([cmd, info]) => 
    `${cmd.padEnd(15)} ${info.description}`
  ).join('\n  ')}

Examples:
  # Basic usage
  claude /todo list
  claude todo add "New task"

  # Piping
  echo "Fix bug in parser" | claude todo add -
  cat tasks.txt | claude --stdin /todo add

  # JSON output
  claude --json /todo list | jq '.pending'

  # Chaining
  claude /todo list | grep "high" | claude /agent process -

  # Batch processing
  find . -name "*.js" | claude /analyze --stdin
`);
}

// Process a single command
async function processCommand(options, input = '') {
  try {
    // Handle stdin input
    if (options.stdin && input) {
      options.args.unshift(input);
    }

    // Special handling for certain commands
    switch (options.command) {
      case '/analyze':
        // Analyze piped input
        return analyzeInput(input, options);
        
      case '/process':
        // Process in batch
        return processBatch(input.split('\n'), options);
        
      default:
        // Execute normal command
        await executeCommand(options.command, options.args);
    }
  } catch (error) {
    if (options.json) {
      output({ error: error.message }, options);
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Analyze input (for piped content)
async function analyzeInput(input, options) {
  const lines = input.split('\n').filter(l => l.trim());
  const analysis = {
    lines: lines.length,
    words: input.split(/\s+/).length,
    characters: input.length,
    commands: lines.filter(l => l.startsWith('/')).length
  };
  
  output(analysis, options);
  return analysis;
}

// Process batch of items
async function processBatch(items, options) {
  const results = [];
  
  for (const item of items) {
    if (!item.trim()) continue;
    
    try {
      // Parse item as command if it starts with /
      if (item.startsWith('/')) {
        const [cmd, ...args] = item.split(' ');
        await executeCommand(cmd, args);
        results.push({ item, status: 'success' });
      } else {
        // Process as data
        results.push({ item, status: 'processed' });
      }
    } catch (error) {
      results.push({ item, status: 'error', error: error.message });
    }
  }
  
  output(results, options);
  return results;
}

// Main entry point
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Read stdin if needed
  let input = '';
  if (options.stdin || !process.stdin.isTTY) {
    input = await readStdin();
  }

  // If no command but have input, try to parse command from input
  if (!options.command && input) {
    const firstLine = input.split('\n')[0].trim();
    if (firstLine.startsWith('/')) {
      const [cmd, ...args] = firstLine.split(' ');
      options.command = cmd;
      options.args = args;
      input = input.split('\n').slice(1).join('\n');
    }
  }

  // Still no command? Show help
  if (!options.command) {
    showHelp();
    process.exit(0);
  }

  // Process the command
  await processCommand(options, input);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

// Export for testing
module.exports = {
  parseArgs,
  readStdin,
  processCommand,
  analyzeInput,
  processBatch
};

// Run if executed directly
if (require.main === module) {
  main();
}