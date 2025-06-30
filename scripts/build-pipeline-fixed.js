#!/usr/bin/env node

/**
 * Build Pipeline v3.0 - Versão Corrigida
 * Usa mocks ou comandos reais, sem depender de agentcli inexistente
 */

const { spawn, execSync } = require('child_process');
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
        console.log('\n🤖 PIPELINE v3.0 - BOOK AUTOMATION SYSTEM (FIXED)');
        console.log('=' .repeat(50));

        // Phase 1: Writer - Check if chapters exist
        const chaptersExist = fs.existsSync(path.join(__dirname, '..', 'chapters')) && 
                            fs.readdirSync(path.join(__dirname, '..', 'chapters')).filter(f => f.endsWith('.md')).length > 0;
        
        if (!chaptersExist) {
            console.log('📝 No chapters found. Please create chapters using:');
            console.log('   - Claude MCP to write files in chapters/');
            console.log('   - Or create manually');
            this.pipelineState.phases.writer.status = 'skipped';
        } else {
            console.log('📚 Chapters already exist, proceeding...');
            this.pipelineState.phases.writer.status = 'skipped';
        }

        // Phase 2: Image - Generate cover if needed
        const coverPath = path.join(__dirname, '..', 'assets', 'images', 'cover.jpg');
        if (!fs.existsSync(coverPath)) {
            console.log('🎨 Generating cover image...');
            
            // Use mock if available
            const mockPath = path.join(__dirname, 'mock', 'agentcli');
            if (fs.existsSync(mockPath)) {
                await this.executePhase(
                    'image',
                    mockPath,
                    ['call', 'ideogram'],
                    'Mock Image Generation'
                );
            } else {
                // Create placeholder
                fs.ensureDirSync(path.dirname(coverPath));
                try {
                    execSync(`convert -size 1600x2400 xc:darkblue -fill white -pointsize 80 -gravity center -annotate +0+0 "E-BOOK" ${coverPath}`, { stdio: 'ignore' });
                    console.log('✅ Cover created with ImageMagick');
                } catch (e) {
                    // Create empty file as fallback
                    fs.writeFileSync(coverPath, '');
                    console.log('⚠️  Created empty cover.jpg');
                }
                this.pipelineState.phases.image.status = 'completed';
            }
        } else {
            console.log('✅ Cover image already exists');
            this.pipelineState.phases.image.status = 'skipped';
        }

        // Phase 3: Build - Generate PDF/EPUB (THIS ACTUALLY WORKS)
        console.log('\n📚 Building PDF/EPUB...');
        const buildSuccess = await this.executePhase(
            'build',
            'npm',
            ['run', 'build:pdf'],
            'Building PDF and EPUB'
        );
        if (!buildSuccess) return this.handleFailure('build');

        // Phase 4: QA - Simple check if files exist
        console.log('\n👁️  Running QA checks...');
        
        const pdfPath = path.join(__dirname, '..', 'build', 'dist', 'ebook.pdf');
        const epubPath = path.join(__dirname, '..', 'build', 'dist', 'ebook.epub');
        
        if (fs.existsSync(pdfPath) && fs.existsSync(epubPath)) {
            console.log('✅ PDF and EPUB generated successfully!');
            this.pipelineState.phases.qa.status = 'completed';
        } else {
            console.log('❌ Build outputs not found');
            return this.handleFailure('qa');
        }

        // Success!
        this.pipelineState.status = 'completed';
        this.pipelineState.completedAt = new Date().toISOString();
        
        console.log('\n✨ PIPELINE COMPLETED SUCCESSFULLY! ✨');
        console.log('=' .repeat(50));
        console.log(`📄 PDF: ${pdfPath}`);
        console.log(`📘 EPUB: ${epubPath}`);
        
        // Save final state
        await this.savePipelineState();
        
        // Output final status
        console.log('\n' + JSON.stringify({
            status: 'done',
            version: '3.0-fixed',
            pdf: pdfPath,
            epub: epubPath,
            duration: this.calculateDuration()
        }, null, 2));
    }

    handleFailure(phase) {
        this.pipelineState.status = 'failed';
        
        console.log(`\n❌ PIPELINE FAILED AT PHASE: ${phase.toUpperCase()}`);
        console.log('Please check the errors above');
        
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
        
        console.log('✅ Node.js version OK');
        
        // Check npm packages
        try {
            require('puppeteer');
            console.log('✅ Puppeteer installed');
        } catch {
            console.log('⚠️  Puppeteer not found, run: npm install');
        }
        
        console.log('✅ Prerequisites check complete');
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