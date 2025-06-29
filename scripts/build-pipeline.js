#!/usr/bin/env node

/**
 * Build Pipeline v1.0 - Orchestrates the complete book generation pipeline
 * Flow: Writer → Image → Build → QA (with MCP visual loop)
 */

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

class PipelineOrchestrator {
    constructor() {
        this.maxRetries = 3;
        this.currentRetry = 0;
        this.pipelineState = {
            status: 'starting',
            phases: {
                writer: { status: 'pending', output: null },
                image: { status: 'pending', output: null },
                build: { status: 'pending', output: null },
                qa: { status: 'pending', output: null }
            },
            startTime: new Date().toISOString(),
            errors: []
        };
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

        // Phase 1: Writer Agent (if chapters don't exist)
        const chaptersExist = fs.existsSync(path.join(__dirname, '..', 'chapters')) && 
                            fs.readdirSync(path.join(__dirname, '..', 'chapters')).length > 0;
        
        if (!chaptersExist) {
            const writerSuccess = await this.executePhase(
                'writer',
                'python3',
                ['-m', 'ebook_pipeline.agents.ai_writer_agent'],
                'AI Writer Agent - Generating chapters'
            );
            if (!writerSuccess) return this.handleFailure('writer');
        } else {
            console.log('📚 Chapters already exist, skipping writer phase');
            this.pipelineState.phases.writer.status = 'skipped';
        }

        // Phase 2: Image Agent - Generate images with Ideogram
        const imageSuccess = await this.executePhase(
            'image',
            'make',
            ['generate-images'],
            'Image Agent - Generating AI images'
        );
        if (!imageSuccess) return this.handleFailure('image');

        // Phase 3: Build Agent - Generate PDF/EPUB
        const buildSuccess = await this.executePhase(
            'build',
            'node',
            ['scripts/generate-clean-pdf.js'],
            'Build Agent - Generating PDF'
        );
        if (!buildSuccess) return this.handleFailure('build');

        // Phase 4: QA Agent with MCP visualization
        const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'ebook-clean.pdf');
        if (!fs.existsSync(pdfPath)) {
            console.log('❌ PDF not found at expected location');
            return this.handleFailure('build');
        }

        const qaSuccess = await this.executePhase(
            'qa',
            'node',
            ['scripts/qa-agent.js', pdfPath],
            'QA Agent - Validating PDF quality'
        );

        if (!qaSuccess) {
            // QA failed, check if we should retry
            if (this.currentRetry < this.maxRetries) {
                this.currentRetry++;
                console.log(`\n🔄 QA failed. Retrying pipeline (${this.currentRetry}/${this.maxRetries})...`);
                
                // Reset build and QA phases for retry
                this.pipelineState.phases.build.status = 'pending';
                this.pipelineState.phases.qa.status = 'pending';
                
                // Run build and QA again
                return this.runPipeline();
            } else {
                return this.handleFailure('qa', true);
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
            version: '1.0',
            pdf: pdfPath,
            retries: this.currentRetry,
            duration: this.calculateDuration()
        }, null, 2));
    }

    handleFailure(phase, needsHuman = false) {
        this.pipelineState.status = needsHuman ? 'needs-human' : 'failed';
        
        console.log(`\n❌ PIPELINE FAILED AT PHASE: ${phase.toUpperCase()}`);
        
        if (needsHuman) {
            console.log('🙋 Human intervention required after max retries');
        }
        
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
        
        // Check Python
        try {
            await this.runCommand('python3', ['--version'], 'Checking Python');
        } catch {
            console.log('❌ Python 3 not found');
            process.exit(1);
        }
        
        // Check if MCP browser tools are available (optional for now)
        // This would be expanded in a full implementation
        
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