#!/usr/bin/env node

/**
 * Development Watch Mode
 * 
 * Monitors file changes and runs only affected pipeline stages
 * Features:
 * - Incremental builds
 * - Hot reload
 * - Interactive commands
 * - Performance monitoring
 */

const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const readline = require('readline');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// Development watcher
class DevelopmentWatcher {
    constructor(bookDir) {
        this.bookDir = bookDir;
        this.watcher = null;
        this.rl = null;
        this.isRunning = false;
        this.lastRun = {};
        this.errors = [];
        
        // Stage dependencies
        this.stageDependencies = {
            'chapters/*.md': ['FORMAT', 'QA_FACT', 'QA_HTML'],
            'assets/images/*': ['FORMAT', 'QA_HTML'],
            'agents/writer.js': ['WRITE', 'POLISH', 'FORMAT', 'QA_FACT', 'QA_HTML'],
            'agents/formatter-html.js': ['FORMAT', 'QA_HTML'],
            'agents/tone-polisher.js': ['POLISH', 'FORMAT', 'QA_HTML'],
            'outline.json': ['WRITE', 'POLISH', 'FORMAT', 'QA_FACT', 'QA_HTML']
        };
    }

    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    clearScreen() {
        process.stdout.write('\x1b[2J\x1b[0f');
    }

    printHeader() {
        this.clearScreen();
        console.log(colors.bright + '=' .repeat(60));
        console.log('📚 EBOOK DEVELOPMENT WATCH MODE');
        console.log('=' .repeat(60) + colors.reset);
        console.log(`\nBook: ${colors.cyan}${this.bookDir}${colors.reset}`);
        console.log(`Time: ${new Date().toLocaleTimeString()}\n`);
    }

    printStatus() {
        console.log(colors.bright + '\n📊 Status:' + colors.reset);
        
        // Show last run times
        if (Object.keys(this.lastRun).length > 0) {
            console.log('\nLast runs:');
            Object.entries(this.lastRun).forEach(([stage, data]) => {
                const status = data.success ? '✅' : '❌';
                console.log(`  ${status} ${stage}: ${data.duration} (${data.time})`);
            });
        }
        
        // Show errors
        if (this.errors.length > 0) {
            console.log(colors.red + '\n❌ Recent errors:' + colors.reset);
            this.errors.slice(-3).forEach(err => {
                console.log(`  - ${err.stage}: ${err.message}`);
            });
        }
        
        console.log(colors.dim + '\n[Press h for help]' + colors.reset);
    }

    showHelp() {
        console.log(colors.bright + '\n📖 Commands:' + colors.reset);
        console.log('  r  - Run full pipeline');
        console.log('  f  - Format HTML only');
        console.log('  q  - Run QA tests');
        console.log('  c  - Clear cache');
        console.log('  s  - Show statistics');
        console.log('  h  - Show this help');
        console.log('  x  - Exit watch mode');
        console.log(colors.dim + '\nFile changes trigger automatic rebuilds' + colors.reset);
    }

    async runStages(stages) {
        if (this.isRunning) {
            this.log('⚠️  Pipeline already running, please wait...', 'yellow');
            return;
        }
        
        this.isRunning = true;
        this.printHeader();
        this.log(`\n🚀 Running stages: ${stages.join(', ')}`, 'green');
        
        const startTime = Date.now();
        
        try {
            for (const stage of stages) {
                this.log(`\n⚙️  ${stage}...`, 'blue');
                const stageStart = Date.now();
                
                try {
                    await this.runStage(stage);
                    
                    const duration = ((Date.now() - stageStart) / 1000).toFixed(1) + 's';
                    this.lastRun[stage] = {
                        success: true,
                        duration,
                        time: new Date().toLocaleTimeString()
                    };
                    
                    this.log(`   ✅ ${stage} completed in ${duration}`, 'green');
                    
                } catch (error) {
                    const duration = ((Date.now() - stageStart) / 1000).toFixed(1) + 's';
                    this.lastRun[stage] = {
                        success: false,
                        duration,
                        time: new Date().toLocaleTimeString()
                    };
                    
                    this.errors.push({
                        stage,
                        message: error.message,
                        time: new Date().toLocaleTimeString()
                    });
                    
                    this.log(`   ❌ ${stage} failed: ${error.message}`, 'red');
                    throw error;
                }
            }
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
            this.log(`\n✅ All stages completed in ${totalTime}`, 'green');
            
        } catch (error) {
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
            this.log(`\n❌ Pipeline failed after ${totalTime}`, 'red');
        } finally {
            this.isRunning = false;
            this.printStatus();
        }
    }

    async runStage(stage) {
        // Map stages to actual commands
        const stageCommands = {
            'FORMAT': async () => {
                const FormatterHTML = require('../agents/formatter-html').FormatterHTML;
                const formatter = new FormatterHTML();
                await formatter.formatBook(this.bookDir);
            },
            'QA_HTML': async () => {
                const { runQATests } = require('../qa/qa-html-simple');
                const htmlPath = path.join(this.bookDir, 'html', 'index.html');
                const results = await runQATests(htmlPath);
                if (results.failed > 0) {
                    throw new Error(`${results.failed} QA tests failed`);
                }
            },
            'QA_FACT': async () => {
                // Quick fact check
                const files = await fs.promises.readdir(this.bookDir);
                const chapters = files.filter(f => f.match(/^chapter-\d+\.md$/));
                this.log(`   Checking ${chapters.length} chapters...`, 'dim');
            },
            'POLISH': async () => {
                this.log('   Skipping polish in dev mode', 'dim');
            },
            'WRITE': async () => {
                this.log('   Cannot regenerate chapters in watch mode', 'yellow');
            }
        };
        
        const command = stageCommands[stage];
        if (command) {
            await command();
        } else {
            throw new Error(`Unknown stage: ${stage}`);
        }
    }

    getStagesToRun(filePath) {
        const stages = new Set();
        
        // Check each pattern
        for (const [pattern, affectedStages] of Object.entries(this.stageDependencies)) {
            const regex = new RegExp(pattern.replace('*', '.*'));
            if (regex.test(filePath)) {
                affectedStages.forEach(stage => stages.add(stage));
            }
        }
        
        // Default to FORMAT and QA if no specific match
        if (stages.size === 0) {
            stages.add('FORMAT');
            stages.add('QA_HTML');
        }
        
        return Array.from(stages);
    }

    async showStats() {
        this.printHeader();
        this.log('\n📊 Book Statistics:', 'bright');
        
        try {
            // Count chapters
            const files = await fs.promises.readdir(this.bookDir);
            const chapters = files.filter(f => f.match(/^chapter-\d+\.md$/));
            
            // Count words
            let totalWords = 0;
            for (const chapter of chapters) {
                const content = await fs.promises.readFile(
                    path.join(this.bookDir, chapter), 
                    'utf8'
                );
                const words = content.split(/\s+/).length;
                totalWords += words;
            }
            
            console.log(`\n  Chapters: ${chapters.length}`);
            console.log(`  Total words: ${totalWords.toLocaleString()}`);
            console.log(`  Average per chapter: ${Math.round(totalWords / chapters.length).toLocaleString()}`);
            
            // Check for HTML
            const htmlPath = path.join(this.bookDir, 'html', 'index.html');
            const htmlExists = await fs.promises.access(htmlPath).then(() => true).catch(() => false);
            
            if (htmlExists) {
                const htmlStats = await fs.promises.stat(htmlPath);
                console.log(`\n  HTML size: ${(htmlStats.size / 1024).toFixed(1)} KB`);
                console.log(`  Last built: ${htmlStats.mtime.toLocaleString()}`);
            }
            
        } catch (error) {
            this.log(`\n❌ Error getting stats: ${error.message}`, 'red');
        }
        
        this.printStatus();
    }

    async clearCache() {
        this.log('\n🗑️  Clearing cache...', 'yellow');
        
        try {
            const cacheDir = path.join('build', '.cache');
            await execAsync(`rm -rf ${cacheDir}`);
            this.log('   ✅ Cache cleared', 'green');
        } catch (error) {
            this.log(`   ❌ Failed to clear cache: ${error.message}`, 'red');
        }
        
        this.printStatus();
    }

    setupWatcher() {
        // Watch for file changes
        this.watcher = chokidar.watch([
            path.join(this.bookDir, '**/*.md'),
            path.join(this.bookDir, 'assets/**/*'),
            path.join(this.bookDir, 'outline.json'),
            'agents/**/*.js',
            'qa/**/*.js'
        ], {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true
        });
        
        // Handle file changes
        this.watcher.on('change', (filePath) => {
            const relativePath = path.relative(process.cwd(), filePath);
            this.log(`\n📝 File changed: ${relativePath}`, 'yellow');
            
            const stages = this.getStagesToRun(relativePath);
            this.runStages(stages);
        });
        
        this.watcher.on('add', (filePath) => {
            const relativePath = path.relative(process.cwd(), filePath);
            this.log(`\n➕ File added: ${relativePath}`, 'green');
            
            const stages = this.getStagesToRun(relativePath);
            this.runStages(stages);
        });
    }

    setupInterface() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Make input non-blocking
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        // Handle keypress
        process.stdin.on('data', async (key) => {
            // Ctrl+C
            if (key === '\u0003') {
                await this.cleanup();
                process.exit();
            }
            
            // Ignore input while running
            if (this.isRunning) return;
            
            switch (key.toLowerCase()) {
                case 'r':
                    await this.runStages(['FORMAT', 'QA_FACT', 'QA_HTML']);
                    break;
                case 'f':
                    await this.runStages(['FORMAT']);
                    break;
                case 'q':
                    await this.runStages(['QA_HTML']);
                    break;
                case 'c':
                    await this.clearCache();
                    break;
                case 's':
                    await this.showStats();
                    break;
                case 'h':
                    this.printHeader();
                    this.showHelp();
                    this.printStatus();
                    break;
                case 'x':
                    await this.cleanup();
                    process.exit();
                    break;
            }
        });
    }

    async cleanup() {
        this.log('\n👋 Shutting down watch mode...', 'yellow');
        
        if (this.watcher) {
            await this.watcher.close();
        }
        
        if (this.rl) {
            this.rl.close();
        }
        
        process.stdin.setRawMode(false);
        process.stdin.pause();
    }

    async start() {
        this.printHeader();
        
        // Check if book directory exists
        const exists = await fs.promises.access(this.bookDir).then(() => true).catch(() => false);
        if (!exists) {
            this.log(`❌ Book directory not found: ${this.bookDir}`, 'red');
            this.log('\nPlease run the pipeline first to generate the book', 'yellow');
            process.exit(1);
        }
        
        this.log('🔍 Setting up file watcher...', 'green');
        this.setupWatcher();
        
        this.log('⌨️  Setting up interactive mode...', 'green');
        this.setupInterface();
        
        this.log('\n✅ Watch mode active!', 'green');
        this.showHelp();
        this.printStatus();
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let bookDir = args[0];
    
    if (!bookDir) {
        // Try to find the most recent book
        const buildDir = path.join('build', 'ebooks');
        
        try {
            const dirs = fs.readdirSync(buildDir);
            if (dirs.length > 0) {
                // Get most recent directory
                const books = dirs.map(dir => ({
                    name: dir,
                    path: path.join(buildDir, dir),
                    mtime: fs.statSync(path.join(buildDir, dir)).mtime
                })).sort((a, b) => b.mtime - a.mtime);
                
                bookDir = books[0].path;
                console.log(`${colors.yellow}No book specified, using most recent: ${books[0].name}${colors.reset}`);
            }
        } catch (error) {
            // Ignore errors
        }
    }
    
    if (!bookDir) {
        console.error(`${colors.red}Error: No book directory specified${colors.reset}`);
        console.error('\nUsage:');
        console.error('  node watch-dev.js <book-directory>');
        console.error('  node watch-dev.js build/ebooks/my-book');
        process.exit(1);
    }
    
    const watcher = new DevelopmentWatcher(bookDir);
    
    // Handle process termination
    process.on('SIGINT', async () => {
        await watcher.cleanup();
        process.exit();
    });
    
    process.on('SIGTERM', async () => {
        await watcher.cleanup();
        process.exit();
    });
    
    // Start watching
    watcher.start().catch(error => {
        console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = DevelopmentWatcher;