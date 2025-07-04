#!/usr/bin/env node

/**
 * Hybrid Orchestrator
 * 
 * Usa agentes reais quando disponíveis, fallback para debug
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class HybridOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = options;
        this.workDir = options.workDir || `build/hybrid-${Date.now()}`;
        
        // Configurar agentes - usar reais quando USE_REAL_AGENTS=true
        const useReal = process.env.USE_REAL_AGENTS === 'true';
        
        this.agents = {
            planner: useReal 
                ? path.join(__dirname, '../agents/planner-wrapper.js')
                : path.join(__dirname, '../agents/planner-debug.js'),
            writer: path.join(__dirname, '../agents/writer-wrapper.js'), // Usa Anthropic
            formatter: path.join(__dirname, '../agents/formatter-html-clean.js') // Sempre real
        };
        
        console.log(`📋 Using ${useReal ? 'REAL' : 'DEBUG'} planner`);
    }
    
    async initialize() {
        console.log(`🚀 Starting hybrid pipeline for: ${this.topic}`);
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
            
            // Ajustar capítulos para mínimo de 5 se usando planner real
            const chapters = this.options.chapters || 5;
            const minChapters = process.env.USE_REAL_AGENTS === 'true' ? 5 : 1;
            const finalChapters = Math.max(chapters, minChapters);
            
            await this.runAgent(this.agents.planner, [
                this.topic,
                '--output', outlinePath,
                '--chapters', finalChapters.toString(),
                '--style', this.options.style || 'business'
            ], 30000); // 30s timeout para planner
            
            // Step 2: Write chapters
            console.log('\n✍️  STEP 2: Writing Chapters');
            if (job) await job.updateProgress({ stage: 'writing', percent: 30, message: 'Writing chapters...' });
            
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            const chaptersDir = path.join(this.workDir, 'chapters');
            
            // Limitar capítulos se especificado
            const chaptersToWrite = Math.min(outline.chapters.length, this.options.chapters || outline.chapters.length);
            
            for (let i = 0; i < chaptersToWrite; i++) {
                const chapter = outline.chapters[i];
                const progress = 30 + (40 * (i + 1) / chaptersToWrite);
                if (job) await job.updateProgress({ 
                    stage: 'writing', 
                    percent: Math.round(progress), 
                    message: `Writing chapter ${chapter.number}...` 
                });
                
                await this.runAgent(this.agents.writer, [
                    '--outline', outlinePath,
                    '--chapter', chapter.number.toString(),
                    '--output', chaptersDir
                ], 60000); // 60s timeout por capítulo
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
Hybrid Orchestrator

Usage:
  node orchestrator-hybrid.js <topic> [options]

Options:
  --chapters <n>     Number of chapters
  --style <type>     Book style
  --workdir <path>   Working directory

Environment:
  USE_REAL_AGENTS=true   Use real planner instead of debug

Example:
  USE_REAL_AGENTS=true node orchestrator-hybrid.js "AI Guide" --chapters 5
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
    
    const orchestrator = new HybridOrchestrator(topic, options);
    
    orchestrator.run().then(result => {
        if (!result.success) {
            process.exit(1);
        }
    });
}

module.exports = HybridOrchestrator;