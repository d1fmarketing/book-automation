#!/usr/bin/env node

/**
 * Load Test Runner
 * Executes load tests individually or all together
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

const tests = {
    state: {
        name: 'State Operations',
        file: 'load-test-state-operations.js',
        description: 'Tests file locking and state consistency',
        concurrency: 20,
        duration: 30000
    },
    websocket: {
        name: 'WebSocket Storm',
        file: 'load-test-websocket.js',
        description: 'Tests WebSocket auth and rate limiting',
        concurrency: 50,
        duration: 30000,
        requiresMonitor: true
    },
    trash: {
        name: 'Trash Operations',
        file: 'load-test-trash.js',
        description: 'Tests concurrent trash operations',
        concurrency: 20,
        duration: 30000
    }
};

async function runTest(testKey, options = {}) {
    const test = tests[testKey];
    if (!test) {
        console.error(colors.red(`Unknown test: ${testKey}`));
        return false;
    }
    
    console.log(colors.blue(`\n🧪 Running ${test.name} Load Test`));
    console.log(colors.gray(`   ${test.description}`));
    console.log(colors.gray(`   Concurrency: ${options.concurrency || test.concurrency}`));
    console.log(colors.gray(`   Duration: ${(options.duration || test.duration) / 1000}s\n`));
    
    if (test.requiresMonitor) {
        console.log(colors.yellow('⚠️  Note: This test requires the monitor to be running'));
        console.log(colors.gray('   Run: MONITOR_TOKEN=test-token-12345 node .claude/scripts/mcp-pipeline-monitor.js\n'));
    }
    
    return new Promise((resolve) => {
        const proc = spawn('node', [
            path.join(__dirname, test.file),
            options.concurrency || test.concurrency,
            options.duration || test.duration
        ], {
            stdio: 'inherit'
        });
        
        proc.on('exit', (code) => {
            if (code === 0) {
                console.log(colors.green(`\n✅ ${test.name} completed successfully`));
                resolve(true);
            } else {
                console.log(colors.red(`\n❌ ${test.name} failed with code ${code}`));
                resolve(false);
            }
        });
    });
}

async function runAllTests() {
    console.log(colors.blue('🚀 Running All Load Tests\n'));
    
    const results = {};
    
    for (const [key, test] of Object.entries(tests)) {
        if (test.requiresMonitor) {
            console.log(colors.yellow(`\n⏭️  Skipping ${test.name} (requires monitor)\n`));
            results[key] = 'skipped';
            continue;
        }
        
        const success = await runTest(key);
        results[key] = success ? 'passed' : 'failed';
        
        // Pause between tests
        if (Object.keys(results).length < Object.keys(tests).length) {
            console.log(colors.gray('\n⏸️  Pausing 5 seconds before next test...\n'));
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    // Summary
    console.log(colors.blue('\n📊 Load Test Summary\n'));
    for (const [key, result] of Object.entries(results)) {
        const test = tests[key];
        const icon = result === 'passed' ? '✅' : result === 'failed' ? '❌' : '⏭️';
        const color = result === 'passed' ? colors.green : result === 'failed' ? colors.red : colors.yellow;
        console.log(`${icon} ${test.name}: ${color(result)}`);
    }
}

async function quickTest() {
    console.log(colors.blue('⚡ Running Quick Load Test (10s each)\n'));
    
    const quickOptions = {
        duration: 10000,
        concurrency: 10
    };
    
    // Run state operations test
    await runTest('state', quickOptions);
    
    console.log(colors.gray('\n⏸️  Pausing 3 seconds...\n'));
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run trash operations test
    await runTest('trash', quickOptions);
    
    console.log(colors.green('\n✅ Quick load test complete!'));
}

async function setupLoadTests() {
    console.log(colors.blue('🔧 Setting up load tests...\n'));
    
    // Ensure pipeline state exists
    const stateFile = path.join(__dirname, '..', 'pipeline-state.json');
    try {
        await fs.access(stateFile);
    } catch {
        console.log('Creating initial pipeline state...');
        const initialState = {
            session_id: `load-test-${Date.now()}`,
            current_phase: null,
            phases: {},
            checkpoints: [],
            metrics: {
                total_time: 0,
                phase_times: {}
            }
        };
        await fs.writeFile(stateFile, JSON.stringify(initialState, null, 2));
    }
    
    console.log(colors.green('✅ Setup complete!'));
}

// CLI interface
async function main() {
    const command = process.argv[2];
    
    if (!command || command === '--help' || command === '-h') {
        console.log(`
${colors.blue('Load Test Runner')}

Usage:
  node run-load-tests.js <command> [options]

Commands:
  all              Run all load tests
  quick            Run quick 10-second tests
  state            Run state operations test
  websocket        Run WebSocket storm test
  trash            Run trash operations test
  setup            Setup test environment

Options:
  --concurrency N  Override concurrency level
  --duration N     Override duration in milliseconds

Examples:
  node run-load-tests.js quick
  node run-load-tests.js state --concurrency 50 --duration 60000
  node run-load-tests.js all
        `);
        process.exit(0);
    }
    
    // Parse options
    const options = {};
    for (let i = 3; i < process.argv.length; i += 2) {
        const key = process.argv[i].replace('--', '');
        const value = process.argv[i + 1];
        options[key] = parseInt(value) || value;
    }
    
    try {
        switch (command) {
            case 'setup':
                await setupLoadTests();
                break;
                
            case 'all':
                await setupLoadTests();
                await runAllTests();
                break;
                
            case 'quick':
                await setupLoadTests();
                await quickTest();
                break;
                
            case 'state':
            case 'websocket':
            case 'trash':
                await setupLoadTests();
                await runTest(command, options);
                break;
                
            default:
                console.error(colors.red(`Unknown command: ${command}`));
                process.exit(1);
        }
    } catch (error) {
        console.error(colors.red('Error:'), error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}