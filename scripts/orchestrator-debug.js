#!/usr/bin/env node

/**
 * Debug Orchestrator
 * 
 * Minimal pipeline for testing agent integration
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DebugOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = options;
        this.workDir = options.workDir || `build/debug-${Date.now()}`;
        this.agents = {
            planner: path.join(__dirname, '../agents/planner-debug.js'),
            writer: path.join(__dirname, '../agents/writer-debug.js'),
            formatter: path.join(__dirname, '../agents/formatter-html-clean.js')
        };
    }
    
    async initialize() {
        console.log(`🚀 Starting debug pipeline for: ${this.topic}`);
        await fs.mkdir(this.workDir, { recursive: true });
        await fs.mkdir(path.join(this.workDir, 'chapters'), { recursive: true });
    }
    
    async runAgent(agentPath, args) {
        return new Promise((resolve, reject) => {
            console.log(`\n🤖 Running: node ${path.basename(agentPath)} ${args.join(' ')}`);
            
            const startTime = Date.now();
            const child = spawn('node', [agentPath, ...args], {
                stdio: 'inherit'
            });
            
            child.on('close', (code) => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                if (code === 0) {
                    console.log(`✅ Completed in ${duration}s`);
                    resolve();
                } else {
                    reject(new Error(`Agent failed with code ${code}`));
                }
            });
            
            child.on('error', reject);
        });
    }
    
    async run(job = null) {
        try {
            await this.initialize();
            
            // Step 1: Plan
            console.log('\n📋 STEP 1: Planning');
            if (job) await job.updateProgress({ stage: 'planning', percent: 10, message: 'Creating outline...' });
            
            const outlinePath = path.join(this.workDir, 'outline.json');
            await this.runAgent(this.agents.planner, [
                this.topic,
                '--output', outlinePath,
                '--chapters', this.options.chapters || '3'
            ]);
            
            // Step 2: Write chapters
            console.log('\n✍️  STEP 2: Writing Chapters');
            if (job) await job.updateProgress({ stage: 'writing', percent: 30, message: 'Writing chapters...' });
            
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            const chaptersDir = path.join(this.workDir, 'chapters');
            
            for (let i = 0; i < outline.chapters.length; i++) {
                const chapter = outline.chapters[i];
                const progress = 30 + (40 * (i + 1) / outline.chapters.length);
                if (job) await job.updateProgress({ 
                    stage: 'writing', 
                    percent: Math.round(progress), 
                    message: `Writing chapter ${chapter.number}...` 
                });
                
                await this.runAgent(this.agents.writer, [
                    '--outline', outlinePath,
                    '--chapter', chapter.number.toString(),
                    '--output', chaptersDir
                ]);
            }
            
            // Move chapters to book root for formatter
            const files = await fs.readdir(chaptersDir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    await fs.copyFile(
                        path.join(chaptersDir, file),
                        path.join(this.workDir, file)
                    );
                }
            }
            
            // Step 3: Format HTML
            console.log('\n📚 STEP 3: Formatting HTML');
            if (job) await job.updateProgress({ stage: 'formatting', percent: 80, message: 'Formatting HTML...' });
            
            await this.runAgent(this.agents.formatter, [this.workDir]);
            
            // Final report
            console.log('\n✅ PIPELINE COMPLETE!');
            console.log(`📁 Output directory: ${this.workDir}`);
            console.log(`📄 HTML: ${path.join(this.workDir, 'html/index.html')}`);
            
            return {
                success: true,
                outputDir: this.workDir,
                htmlPath: path.join(this.workDir, 'html/index.html')
            };
            
        } catch (error) {
            console.error('\n❌ Pipeline failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Debug Orchestrator

Usage:
  node orchestrator-debug.js <topic> [options]

Options:
  --chapters <n>     Number of chapters (default: 3)
  --workdir <path>   Working directory

Example:
  node orchestrator-debug.js "Test Book" --chapters 2
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const topic = args[0];
    const options = {};
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'chapters') {
                options.chapters = value;
            } else if (key === 'workdir') {
                options.workDir = value;
            }
        }
    }
    
    const orchestrator = new DebugOrchestrator(topic, options);
    
    orchestrator.run().then(result => {
        if (!result.success) {
            process.exit(1);
        }
    });
}

module.exports = DebugOrchestrator;