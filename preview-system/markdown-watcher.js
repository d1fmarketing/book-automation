#!/usr/bin/env node

/**
 * Markdown Hot-Reload Watcher
 * Watches for changes in markdown files and triggers rebuilds
 */

const chokidar = require('chokidar');
const path = require('path');
const EventEmitter = require('events');
const fs = require('fs').promises;
const debounce = require('lodash.debounce');

class MarkdownWatcher extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.watchPaths = options.watchPaths || ['chapters/*.md', 'metadata.yaml'];
        this.ignoreInitial = options.ignoreInitial !== false;
        this.debounceWait = options.debounceWait || 500;
        this.verbose = options.verbose || false;
        
        this.watcher = null;
        this.isReady = false;
        
        // Debounced rebuild function
        this.triggerRebuild = debounce(this._rebuild.bind(this), this.debounceWait);
    }
    
    start() {
        console.log('👁️  Starting markdown file watcher...');
        
        this.watcher = chokidar.watch(this.watchPaths, {
            ignoreInitial: this.ignoreInitial,
            persistent: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });
        
        this.watcher
            .on('ready', () => {
                this.isReady = true;
                console.log('✅ File watcher ready');
                console.log('   Watching:', this.watchPaths.join(', '));
                this.emit('ready');
            })
            .on('add', (filePath) => this._handleFileEvent('add', filePath))
            .on('change', (filePath) => this._handleFileEvent('change', filePath))
            .on('unlink', (filePath) => this._handleFileEvent('unlink', filePath))
            .on('error', (error) => {
                console.error('❌ Watcher error:', error);
                this.emit('error', error);
            });
    }
    
    stop() {
        if (this.watcher) {
            console.log('🛑 Stopping file watcher...');
            this.watcher.close();
            this.watcher = null;
            this.isReady = false;
        }
    }
    
    _handleFileEvent(event, filePath) {
        if (!this.isReady && event !== 'add') return;
        
        const relativePath = path.relative(process.cwd(), filePath);
        
        if (this.verbose) {
            console.log(`📝 File ${event}: ${relativePath}`);
        }
        
        // Emit specific event
        this.emit('file:' + event, {
            event,
            path: filePath,
            relativePath,
            timestamp: Date.now()
        });
        
        // Trigger rebuild
        this.triggerRebuild({
            trigger: relativePath,
            event
        });
    }
    
    async _rebuild(changeInfo) {
        console.log(`🔄 Rebuilding due to ${changeInfo.event} in ${changeInfo.trigger}...`);
        
        try {
            // Get list of changed files since last rebuild
            const changes = {
                trigger: changeInfo.trigger,
                event: changeInfo.event,
                timestamp: Date.now()
            };
            
            // Emit rebuild event
            this.emit('rebuild', changes);
            
        } catch (error) {
            console.error('❌ Rebuild error:', error);
            this.emit('error', error);
        }
    }
    
    getWatchedPaths() {
        if (!this.watcher) return [];
        return Object.keys(this.watcher.getWatched());
    }
}

// Export for use in preview server
module.exports = MarkdownWatcher;

// CLI usage
if (require.main === module) {
    const watcher = new MarkdownWatcher({
        verbose: process.argv.includes('-v') || process.argv.includes('--verbose'),
        watchPaths: [
            'chapters/*.md',
            'metadata.yaml',
            'assets/css/*.css'
        ]
    });
    
    watcher.on('rebuild', (changes) => {
        console.log('🏗️  Rebuild triggered:', changes);
        // In CLI mode, just log the changes
        // The preview server will handle actual rebuilding
    });
    
    watcher.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down watcher...');
        watcher.stop();
        process.exit(0);
    });
}