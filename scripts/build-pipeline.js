#!/usr/bin/env node

/**
 * Build Pipeline v2.1 - Agent CLI Edition
 * Flow: Writer → Image → Build → QA (infinite loop until perfect)
 * NO local LLMs, NO SDKs - Pure Agent CLI commands only
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');

class PipelineOrchestrator {
    constructor() {
        this.pipelineState = {
            status: 'starting',
            phases: {
                writer: { status: 'pending', output: null },
                image: { status: 'pending', output: null },
                build: { status: 'pending', output: null },
                qa: { status: 'pending', output: null }
            },
            startTime: new Date().toISOString(),
            errors: [],
            qaRetries: 0,
            currentPreset: 0
        };
        this.layoutPresets = [];
        this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.join(__dirname, '..', 'pipeline-config.yaml');
            if (fs.existsSync(configPath)) {
                const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
                this.config = config;
            }
            
            const presetsPath = path.join(__dirname, '..', 'presets', 'layout-presets.yaml');
            if (fs.existsSync(presetsPath)) {
                this.layoutPresets = yaml.load(fs.readFileSync(presetsPath, 'utf8'));
            }
        } catch (error) {
            console.log('Config files not found, using defaults');
        }
    }

    async runCommand(command, args = [], description = '') {
        console.log(`\n🚀 ${description || command}`);
        
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, { 
                shell: true,
                stdio: 'inherit',
                env: { ...process.env }
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ ${description || command} completed`);
                    resolve(code);
                } else {
                    console.log(`❌ ${description || command} failed with code ${code}`);
                    reject(new Error(`Process exited with code ${code}`));
                }
            });

            proc.on('error', (err) => {
                console.log(`❌ Error: ${err.message}`);
                reject(err);
            });
        });
    }

    async executePhase(phaseName, command, args = [], description = '') {
        console.log(`\n====== PHASE: ${phaseName.toUpperCase()} ======`);
        this.pipelineState.phases[phaseName].status = 'running';
        
        try {
            await this.runCommand(command, args, description);
            this.pipelineState.phases[phaseName].status = 'completed';
            this.pipelineState.phases[phaseName].completedAt = new Date().toISOString();
            return true;
        } catch (error) {
            this.pipelineState.phases[phaseName].status = 'failed';
            this.pipelineState.phases[phaseName].error = error.message;
            this.pipelineState.errors.push({
                phase: phaseName,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return false;
        }
    }

    async runPipeline() {
        console.log('\n🤖 PIPELINE v1.0 - BOOK AUTOMATION SYSTEM');
        console.log('=' .repeat(50));

        // Phase 1: Writer Agent via Agent CLI
        const chaptersExist = fs.existsSync(path.join(__dirname, '..', 'chapters')) && 
                            fs.readdirSync(path.join(__dirname, '..', 'chapters')).length > 0;
        
        if (!chaptersExist) {
            const textModel = process.env.AGENT_CLI_TEXT_MODEL || 'claude-3-opus';
            const writerSuccess = await this.executePhase(
                'writer',
                'agentcli',
                ['call', 'writer', 
                 '--model', textModel,
                 '--outline', 'outline.yaml',
                 '--context', 'context/CONTEXT.md',
                 '--out', 'chapters/'],
                'Agent CLI Writer - Generating chapters'
            );
            if (!writerSuccess) return this.handleFailure('writer');
        } else {
            console.log('📚 Chapters already exist, skipping writer phase');
            this.pipelineState.phases.writer.status = 'skipped';
        }

        // Phase 2: Image Agent - Generate images with Ideogram via Agent CLI
        const imageSuccess = await this.executePhase(
            'image',
            'agentcli',
            ['call', 'ideogram',
             '--md', 'chapters/',
             '--palette', 'emotion',
             '--out', 'assets/images/'],
            'Agent CLI Ideogram - Generating AI images'
        );
        if (!imageSuccess) return this.handleFailure('image');

        // Phase 3: Build Agent - Generate PDF/EPUB via Agent CLI
        const cssTemplate = this.getCurrentCssTemplate();
        const buildSuccess = await this.executePhase(
            'build',
            'agentcli',
            ['call', 'builder',
             '--md', 'chapters/',
             '--img', 'assets/images/',
             '--css', cssTemplate,
             '--out', 'build/dist/'],
            'Agent CLI Builder - Generating PDF/EPUB'
        );
        if (!buildSuccess) return this.handleFailure('build');

        // Phase 4: Infinite QA Loop - Loop until perfect
        console.log('\n🔄 Starting Infinite QA Loop - Will retry until perfect');
        
        while (true) {
            const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'ebook.pdf');
            const epubPath = path.join(__dirname, '..', 'build', 'dist', 'ebook.epub');
            
            if (!fs.existsSync(pdfPath)) {
                console.log('❌ PDF not found, rebuilding...');
                this.pipelineState.phases.build.status = 'pending';
                return this.runPipeline();
            }

            const qaSuccess = await this.executePhase(
                'qa',
                'agentcli',
                ['call', 'qa',
                 '--pdf', pdfPath,
                 '--epub', epubPath],
                `QA Agent - Attempt ${this.pipelineState.qaRetries + 1}`
            );

            if (qaSuccess) {
                console.log('\n✅ QA PASSED - Book is perfect!');
                break;
            }

            // QA failed, tweak layout and rebuild
            this.pipelineState.qaRetries++;
            console.log(`\n🔧 QA failed. Tweaking layout preset and rebuilding...`);
            
            // Move to next preset
            this.currentPreset = (this.currentPreset + 1) % this.layoutPresets.length;
            
            // Rebuild with new preset
            const rebuildSuccess = await this.executePhase(
                'build',
                'agentcli',
                ['call', 'builder',
                 '--tweak', 'next'],
                `Rebuild with preset ${this.currentPreset + 1}`
            );
            
            if (!rebuildSuccess) {
                console.log('❌ Rebuild failed, retrying...');
            }
        }

        // Success!
        this.pipelineState.status = 'completed';
        this.pipelineState.completedAt = new Date().toISOString();
        
        console.log('\n✨ PIPELINE COMPLETED SUCCESSFULLY! ✨');
        console.log('=' .repeat(50));
        
        // Save final state
        await this.savePipelineState();
        
        // Output final status
        console.log(JSON.stringify({
            status: 'done',
            version: '2.1-agentcli',
            pdf: path.join(__dirname, '..', 'build', 'dist', 'ebook.pdf'),
            epub: path.join(__dirname, '..', 'build', 'dist', 'ebook.epub'),
            qaRetries: this.pipelineState.qaRetries,
            duration: this.calculateDuration()
        }, null, 2));
    }

    getCurrentCssTemplate() {
        if (this.layoutPresets.length === 0) {
            return 'templates/pdf-standard.css';
        }
        const preset = this.layoutPresets[this.currentPreset % this.layoutPresets.length];
        return preset.css || 'templates/pdf-standard.css';
    }

    handleFailure(phase) {
        this.pipelineState.status = 'failed';
        
        console.log(`\n❌ PIPELINE FAILED AT PHASE: ${phase.toUpperCase()}`);
        console.log('Fatal error - aborting pipeline');
        
        this.savePipelineState();
        process.exit(1);
    }

    calculateDuration() {
        const start = new Date(this.pipelineState.startTime);
        const end = new Date();
        const durationMs = end - start;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    }

    async savePipelineState() {
        const stateFile = path.join(__dirname, '..', 'pipeline-state.json');
        await fs.writeJson(stateFile, this.pipelineState, { spaces: 2 });
        console.log(`\n📄 Pipeline state saved to: ${stateFile}`);
    }

    async checkPrerequisites() {
        console.log('\n🔍 Checking prerequisites...');
        
        // Check Node version
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
        if (majorVersion < 20) {
            console.log(`❌ Node.js 20+ required. Current: ${nodeVersion}`);
            process.exit(1);
        }
        
        // Check for Agent CLI
        try {
            await this.runCommand('which', ['agentcli'], 'Checking Agent CLI');
        } catch {
            console.log('❌ Agent CLI not found. Please install agentcli');
            process.exit(1);
        }
        
        // Check environment variable
        if (!process.env.AGENT_CLI_TEXT_MODEL) {
            console.log('⚠️  AGENT_CLI_TEXT_MODEL not set, using default');
        }
        
        console.log('✅ All prerequisites met');
    }
}

// Main execution
async function main() {
    const orchestrator = new PipelineOrchestrator();
    
    try {
        await orchestrator.checkPrerequisites();
        await orchestrator.runPipeline();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = PipelineOrchestrator;