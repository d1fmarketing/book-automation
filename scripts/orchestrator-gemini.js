#!/usr/bin/env node

/**
 * Gemini Orchestrator
 * 
 * Usa Google Gemini 2.5 Pro para escrita de capítulos
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GeminiOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = options;
        this.workDir = options.workDir || `build/gemini-${Date.now()}`;
        
        // Configurar agentes
        this.agents = {
            planner: path.join(__dirname, '../agents/planner-debug.js'), // Debug planner por padrão
            writer: path.join(__dirname, '../agents/writer-gemini-wrapper.js'), // Gemini 2.5 Pro
            formatter: path.join(__dirname, '../agents/formatter-html-clean.js') // Formatter real
        };
        
        // Se USE_REAL_PLANNER=true, usar planner real
        if (process.env.USE_REAL_PLANNER === 'true') {
            this.agents.planner = path.join(__dirname, '../agents/planner-wrapper.js');
            console.log('📋 Using REAL planner with Anthropic API');
        } else {
            console.log('📋 Using DEBUG planner (no API needed)');
        }
        
        // Check Gemini API key
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (apiKey) {
            console.log('🔑 Gemini API key found - will use real content generation');
        } else {
            console.log('⚠️  No Gemini API key - will use fallback content');
        }
    }
    
    async initialize() {
        console.log(`🚀 Starting Gemini pipeline for: ${this.topic}`);
        await fs.mkdir(this.workDir, { recursive: true });
        await fs.mkdir(path.join(this.workDir, 'chapters'), { recursive: true });
    }
    
    async runAgent(agentPath, args, timeout = 30000) {
        return new Promise((resolve, reject) => {
            console.log(`\n🤖 Running: node ${path.basename(agentPath)} ${args.join(' ')}`);
            
            const startTime = Date.now();
            const child = spawn('node', [agentPath, ...args], {
                stdio: 'inherit',
                timeout: timeout
            });
            
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill('SIGKILL');
                reject(new Error(`Agent ${path.basename(agentPath)} timed out after ${timeout}ms`));
            }, timeout);
            
            child.on('close', (code) => {
                clearTimeout(timer);
                if (timedOut) return;
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                if (code === 0) {
                    console.log(`✅ Completed in ${duration}s`);
                    resolve();
                } else {
                    reject(new Error(`Agent failed with code ${code}`));
                }
            });
            
            child.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    
    async run(job = null) {
        try {
            await this.initialize();
            
            // Step 1: Plan
            console.log('\n📋 STEP 1: Planning');
            if (job) await job.updateProgress({ stage: 'planning', percent: 10, message: 'Creating outline...' });
            
            const outlinePath = path.join(this.workDir, 'outline.json');
            const chapters = this.options.chapters || 10;
            
            await this.runAgent(this.agents.planner, [
                this.topic,
                '--output', outlinePath,
                '--chapters', chapters.toString(),
                '--style', this.options.style || 'business'
            ], 30000); // 30s timeout para planner
            
            // Step 2: Write chapters with Gemini
            console.log('\n✍️  STEP 2: Writing Chapters with Gemini 2.5 Pro');
            if (job) await job.updateProgress({ stage: 'writing', percent: 30, message: 'Writing chapters with Gemini...' });
            
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            const chaptersDir = path.join(this.workDir, 'chapters');
            
            // Write all chapters
            const chaptersToWrite = Math.min(outline.chapters.length, this.options.chapters || outline.chapters.length);
            
            for (let i = 0; i < chaptersToWrite; i++) {
                const chapter = outline.chapters[i];
                const progress = 30 + (40 * (i + 1) / chaptersToWrite);
                if (job) await job.updateProgress({ 
                    stage: 'writing', 
                    percent: Math.round(progress), 
                    message: `Writing chapter ${chapter.number} with Gemini...` 
                });
                
                await this.runAgent(this.agents.writer, [
                    '--outline', outlinePath,
                    '--chapter', chapter.number.toString(),
                    '--output', chaptersDir,
                    '--model', 'gemini-2.5-pro' // Explicitamente usar 2.5 Pro
                ], 90000); // 90s timeout por capítulo
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
            
            await this.runAgent(this.agents.formatter, [this.workDir], 30000);
            
            // Final report
            console.log('\n✅ PIPELINE COMPLETE!');
            console.log(`📁 Output directory: ${this.workDir}`);
            console.log(`📄 HTML: ${path.join(this.workDir, 'html/index.html')}`);
            
            if (job) await job.updateProgress({ stage: 'completed', percent: 100, message: 'Pipeline completed!' });
            
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

// CLI interface para teste
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Gemini Orchestrator - Uses Google Gemini 2.5 Pro for writing

Usage:
  node orchestrator-gemini.js <topic> [options]

Options:
  --chapters <n>     Number of chapters (default: 10)
  --style <type>     Book style (default: business)
  --workdir <path>   Working directory

Environment Variables:
  GOOGLE_API_KEY       Required for Gemini 2.5 Pro API
  GEMINI_API_KEY       Alternative API key variable
  USE_REAL_PLANNER     Set to "true" to use Anthropic planner

Examples:
  # Use debug planner + Gemini writer
  GOOGLE_API_KEY=your_key node orchestrator-gemini.js "AI Business Guide"
  
  # Use real planner + Gemini writer
  ANTHROPIC_API_KEY=key1 GOOGLE_API_KEY=key2 USE_REAL_PLANNER=true node orchestrator-gemini.js "AI Guide"
        `);
        process.exit(0);
    }
    
    const topic = args[0];
    const options = {};
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'chapters') {
                options.chapters = parseInt(value);
            } else if (key === 'style') {
                options.style = value;
            } else if (key === 'workdir') {
                options.workDir = value;
            }
        }
    }
    
    const orchestrator = new GeminiOrchestrator(topic, options);
    
    orchestrator.run().then(result => {
        if (!result.success) {
            process.exit(1);
        }
    });
}

module.exports = GeminiOrchestrator;