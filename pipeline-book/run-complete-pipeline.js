#!/usr/bin/env node

/**
 * Run Complete Pipeline - Executes all 5 agents in sequence
 * This is the main entry point for the integrated pipeline system
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const WebSocket = require('ws');

// Configuration
const PYTHON_PATH = 'python3';
const PIPELINE_MODULE = 'ebook_pipeline.pipeline_controller';
const PROJECT_PATH = __dirname;
const WEBSOCKET_URL = 'ws://localhost:8765';

// ANSI colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

/**
 * Print colored message
 */
function log(message, color = '') {
    console.log(`${color}${message}${colors.reset}`);
}

/**
 * Connect to WebSocket for real-time monitoring
 */
async function connectWebSocket() {
    return new Promise((resolve) => {
        const ws = new WebSocket(WEBSOCKET_URL);
        
        ws.on('open', () => {
            log('✅ Connected to WebSocket server', colors.green);
            
            // Register as monitoring client
            ws.send(JSON.stringify({
                type: 'register',
                source: 'pipeline-monitor',
                target: 'websocket_manager',
                data: { client_type: 'monitor' }
            }));
            
            resolve(ws);
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                handleWebSocketMessage(message);
            } catch (e) {
                // Ignore parsing errors
            }
        });
        
        ws.on('error', () => {
            log('⚠️  WebSocket connection failed (monitoring disabled)', colors.yellow);
            resolve(null);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
    });
}

/**
 * Handle WebSocket messages for real-time updates
 */
function handleWebSocketMessage(message) {
    if (message.type === 'status' && message.data) {
        const { status, agent } = message.data;
        
        // Agent status updates
        if (agent && status) {
            const agentColors = {
                content: colors.blue,
                format: colors.magenta,
                quality: colors.yellow,
                publish: colors.green,
                monitor: colors.cyan
            };
            
            const statusEmojis = {
                running: '🔄',
                completed: '✅',
                error: '❌',
                idle: '⏸️'
            };
            
            const color = agentColors[agent] || '';
            const emoji = statusEmojis[status] || '•';
            
            log(`${emoji} ${agent.toUpperCase()} Agent: ${status}`, color);
        }
    } else if (message.type === 'event' && message.data.event === 'pipeline_progress') {
        const { progress_percent, current_stage } = message.data;
        log(`📊 Progress: ${progress_percent.toFixed(1)}% - ${current_stage}`, colors.bright);
    }
}

/**
 * Run the Python pipeline controller
 */
async function runPipeline(platforms = ['local']) {
    return new Promise((resolve, reject) => {
        log('\n🚀 Starting Claude Elite Pipeline with 5 Integrated Agents\n', colors.bright + colors.cyan);
        
        // Build command
        const args = [
            '-m', PIPELINE_MODULE,
            PROJECT_PATH,
            '--platforms', ...platforms
        ];
        
        log(`📁 Project: ${PROJECT_PATH}`, colors.blue);
        log(`🌐 Platforms: ${platforms.join(', ')}`, colors.blue);
        log('\n' + '='.repeat(60) + '\n', colors.bright);
        
        // Spawn Python process
        const pythonProcess = spawn(PYTHON_PATH, args, {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, PYTHONPATH: path.join(__dirname, '..', 'src') }
        });
        
        // Handle stdout
        pythonProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                // Color code different stages
                if (output.includes('STAGE 1:')) {
                    log(output, colors.bright + colors.blue);
                } else if (output.includes('STAGE 2:')) {
                    log(output, colors.bright + colors.magenta);
                } else if (output.includes('STAGE 3:')) {
                    log(output, colors.bright + colors.yellow);
                } else if (output.includes('STAGE 4:')) {
                    log(output, colors.bright + colors.green);
                } else if (output.includes('PIPELINE COMPLETE!')) {
                    log(output, colors.bright + colors.green);
                } else if (output.includes('✅')) {
                    log(output, colors.green);
                } else if (output.includes('❌')) {
                    log(output, colors.red);
                } else {
                    console.log(output);
                }
            }
        });
        
        // Handle stderr
        pythonProcess.stderr.on('data', (data) => {
            const error = data.toString().trim();
            if (error && !error.includes('WARNING')) {
                log(error, colors.red);
            }
        });
        
        // Handle process completion
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Pipeline failed with code ${code}`));
            }
        });
        
        // Handle errors
        pythonProcess.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Main execution
 */
async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);
        const platforms = args.length > 0 ? args : ['local'];
        
        // Show banner
        console.log('\n' + '='.repeat(60));
        log('   CLAUDE ELITE PIPELINE - 5 AGENTS INTEGRATED SYSTEM', colors.bright + colors.cyan);
        console.log('='.repeat(60) + '\n');
        
        log('🤖 Agents:', colors.bright);
        log('   1. Content Agent - Process chapters and generate HTML', colors.blue);
        log('   2. Format Agent - Create professional PDF', colors.magenta);
        log('   3. Quality Agent - Validate and ensure perfection', colors.yellow);
        log('   4. Monitor Agent - Real-time tracking and metrics', colors.cyan);
        log('   5. Publish Agent - Multi-platform distribution', colors.green);
        console.log();
        
        // Connect to WebSocket for monitoring (optional)
        const ws = await connectWebSocket();
        
        // Run the pipeline
        const startTime = Date.now();
        await runPipeline(platforms);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        // Close WebSocket
        if (ws) {
            ws.close();
        }
        
        // Read and display results
        const resultPath = path.join(PROJECT_PATH, 'build', 'pipeline-result.json');
        if (fs.existsSync(resultPath)) {
            const result = await fs.readJson(resultPath);
            
            console.log('\n' + '='.repeat(60));
            log('   ✅ PIPELINE EXECUTION COMPLETE!', colors.bright + colors.green);
            console.log('='.repeat(60) + '\n');
            
            log('📊 Summary:', colors.bright);
            log(`   Duration: ${duration} seconds`);
            log(`   Status: ${result.status}`, result.status === 'success' ? colors.green : colors.red);
            
            if (result.statistics) {
                log(`   Chapters: ${result.statistics.chapters}`);
                log(`   Words: ${result.statistics.total_words}`);
                log(`   PDF Size: ${result.statistics.pdf_size_mb.toFixed(2)} MB`);
                log(`   Quality Checks: ${result.statistics.quality_attempts}`);
                log(`   Published To: ${result.statistics.platforms_published} platform(s)`);
            }
            
            if (result.final_pdf) {
                console.log();
                log(`📖 Final PDF: ${result.final_pdf}`, colors.bright + colors.green);
            }
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
        log('🎉 Success! Your ebook has been created using all 5 agents!', colors.bright + colors.green);
        console.log();
        
    } catch (error) {
        console.error();
        log('❌ Pipeline execution failed:', colors.bright + colors.red);
        log(error.message, colors.red);
        
        // Check common issues
        if (error.message.includes('No module named')) {
            log('\n💡 Tip: Make sure you have installed Python dependencies:', colors.yellow);
            log('   cd .. && pip install -r requirements.txt', colors.yellow);
        } else if (error.message.includes('ENOENT')) {
            log('\n💡 Tip: Make sure Python 3 is installed and in PATH', colors.yellow);
        }
        
        process.exit(1);
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { runPipeline };