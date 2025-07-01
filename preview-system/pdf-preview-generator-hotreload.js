#!/usr/bin/env node

/**
 * PDF Generator with Hot-Reload Support
 * Extends the preview generator with file watching
 */

const PDFPreviewGenerator = require('./pdf-preview-generator');
const MarkdownWatcher = require('./markdown-watcher');
const path = require('path');

class PDFPreviewGeneratorHotReload extends PDFPreviewGenerator {
    constructor(options = {}) {
        super(options);
        
        this.enableHotReload = options.enableHotReload !== false;
        this.watcher = null;
        this.isGenerating = false;
        this.pendingRebuild = false;
    }
    
    async generate() {
        // Start with normal generation
        await super.generate();
        
        // Setup hot-reload if enabled
        if (this.enableHotReload && this.enablePreview) {
            await this.setupHotReload();
        }
    }
    
    async setupHotReload() {
        console.log('\n🔥 Setting up hot-reload for markdown files...');
        
        this.watcher = new MarkdownWatcher({
            verbose: this.verbose,
            debounceWait: 1000, // Wait 1 second after changes stop
            watchPaths: [
                'chapters/*.md',
                'metadata.yaml',
                'assets/css/*.css',
                'assets/images/*'
            ]
        });
        
        this.watcher.on('rebuild', async (changes) => {
            if (this.isGenerating) {
                console.log('⏳ Generation in progress, queueing rebuild...');
                this.pendingRebuild = true;
                return;
            }
            
            await this.handleRebuild(changes);
        });
        
        this.watcher.on('error', (error) => {
            console.error('❌ Hot-reload error:', error);
        });
        
        this.watcher.start();
        
        console.log('✅ Hot-reload enabled! Changes will trigger automatic rebuilds.');
        console.log('   Tip: Keep the preview page open to see updates in real-time\n');
    }
    
    async handleRebuild(changes) {
        console.log(`\n🔄 Hot-reload: Rebuilding PDF (triggered by ${changes.trigger})...`);
        
        this.isGenerating = true;
        const startTime = Date.now();
        
        try {
            // Notify preview server of rebuild start
            if (this.previewServer) {
                await this.previewServer.startBuild({
                    id: Date.now(),
                    totalPages: this.totalPages,
                    hotReload: true,
                    trigger: changes.trigger
                });
            }
            
            // Re-load content
            const metadata = await this.loadMetadata();
            const chapters = await this.loadChapters();
            
            // Re-estimate pages
            this.totalPages = this.estimateTotalPages(chapters);
            
            // Close existing browser if any
            if (this.browser) {
                await this.browser.close();
            }
            
            // Regenerate PDF
            await this.generatePDF(metadata, chapters);
            
            const duration = Date.now() - startTime;
            console.log(`✅ Hot-reload complete in ${(duration / 1000).toFixed(1)}s`);
            
            // Notify clients to refresh
            if (this.previewServer) {
                this.previewServer.broadcast({
                    type: 'hot_reload_complete',
                    data: {
                        duration,
                        trigger: changes.trigger,
                        totalPages: this.totalPages
                    }
                });
            }
            
        } catch (error) {
            console.error('❌ Hot-reload failed:', error);
            
            if (this.previewServer) {
                this.previewServer.broadcast({
                    type: 'hot_reload_error',
                    data: {
                        error: error.message,
                        trigger: changes.trigger
                    }
                });
            }
        } finally {
            this.isGenerating = false;
            
            // Check for pending rebuild
            if (this.pendingRebuild) {
                this.pendingRebuild = false;
                console.log('🔄 Processing pending rebuild...');
                await this.handleRebuild({ trigger: 'pending changes' });
            }
        }
    }
    
    async cleanup() {
        if (this.watcher) {
            this.watcher.stop();
        }
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// CLI interface
if (require.main === module) {
    const generator = new PDFPreviewGeneratorHotReload({
        verbose: process.argv.includes('-v') || process.argv.includes('--verbose'),
        preset: process.argv.find(arg => arg.startsWith('--preset='))?.split('=')[1] || 'main',
        enablePreview: !process.argv.includes('--no-preview'),
        enableHotReload: !process.argv.includes('--no-hot-reload'),
        previewPort: parseInt(process.argv.find(arg => arg.startsWith('--preview-port='))?.split('=')[1] || '3001')
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n\n👋 Shutting down gracefully...');
        await generator.cleanup();
        process.exit(0);
    });
    
    generator.generate().catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = PDFPreviewGeneratorHotReload;