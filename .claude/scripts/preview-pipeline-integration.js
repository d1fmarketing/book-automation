#!/usr/bin/env node

/**
 * Preview Pipeline Integration
 * Connects the live preview system with the MCP pipeline monitor
 */

const PreviewServer = require('../../preview-system/preview-server');
const PDFPreviewGenerator = require('../../preview-system/pdf-preview-generator');
const WebSocket = require('ws');
const path = require('path');

class PreviewPipelineIntegration {
    constructor(options = {}) {
        this.monitorPort = options.monitorPort || 3000;
        this.previewPort = options.previewPort || 3001;
        this.monitorWs = null;
        this.previewServer = null;
        this.authToken = options.authToken || process.env.MONITOR_TOKEN || 'test-token-12345';
    }
    
    async connect() {
        console.log('🔗 Connecting preview system to pipeline monitor...');
        
        // Connect to pipeline monitor
        const wsUrl = `ws://localhost:${this.monitorPort}/ws/monitor?token=${this.authToken}`;
        this.monitorWs = new WebSocket(wsUrl);
        
        this.monitorWs.on('open', () => {
            console.log('✅ Connected to pipeline monitor');
            this.sendMonitorUpdate('preview_connected', {
                port: this.previewPort,
                status: 'ready'
            });
        });
        
        this.monitorWs.on('error', (error) => {
            console.error('❌ Monitor connection error:', error.message);
        });
        
        this.monitorWs.on('close', () => {
            console.log('⚠️  Disconnected from pipeline monitor');
        });
    }
    
    sendMonitorUpdate(type, data) {
        if (this.monitorWs && this.monitorWs.readyState === WebSocket.OPEN) {
            this.monitorWs.send(JSON.stringify({
                type: 'command',
                command: 'custom_event',
                args: {
                    event_type: type,
                    data
                }
            }));
        }
    }
    
    async generateWithPreview(options = {}) {
        console.log('🚀 Starting PDF generation with preview and monitoring...\n');
        
        // Connect to monitor
        await this.connect();
        
        // Notify monitor of PDF generation start
        this.sendMonitorUpdate('pdf_generation_start', {
            preset: options.preset || 'main',
            preview_enabled: true
        });
        
        // Create enhanced generator with hooks
        const generator = new PDFPreviewGenerator({
            ...options,
            enablePreview: true,
            previewPort: this.previewPort,
            
            // Add hooks for monitor updates
            onProgress: (progress) => {
                this.sendMonitorUpdate('pdf_progress', progress);
            },
            
            onPageComplete: (pageNum) => {
                this.sendMonitorUpdate('pdf_page_complete', {
                    page: pageNum,
                    preview_url: `http://localhost:${this.previewPort}/preview/page-${pageNum}.png`
                });
            },
            
            onComplete: (result) => {
                this.sendMonitorUpdate('pdf_generation_complete', {
                    path: result.outputPath,
                    pages: result.totalPages,
                    duration: result.duration,
                    preview_url: `http://localhost:${this.previewPort}/`
                });
            }
        });
        
        // Override some methods to add monitoring
        const originalStartPreview = generator.startPreviewServer.bind(generator);
        generator.startPreviewServer = async function() {
            const result = await originalStartPreview();
            this.sendMonitorUpdate('preview_server_started', {
                port: this.previewPort,
                url: `http://localhost:${this.previewPort}`
            });
            return result;
        }.bind(this);
        
        const originalCapturePage = generator.capturePage.bind(generator);
        generator.capturePage = async function(pageNum, pageHeight) {
            const result = await originalCapturePage(pageNum, pageHeight);
            
            // Send update to monitor
            this.sendMonitorUpdate('preview_page_captured', {
                page: pageNum,
                total: this.totalPages
            });
            
            return result;
        }.bind(generator);
        
        try {
            // Generate PDF
            await generator.generate();
            
            console.log('\n✅ PDF generated with preview and monitoring!');
            console.log(`📺 Preview: http://localhost:${this.previewPort}`);
            console.log(`📊 Monitor: http://localhost:${this.monitorPort}`);
            
        } catch (error) {
            this.sendMonitorUpdate('pdf_generation_error', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

// CLI usage
if (require.main === module) {
    const integration = new PreviewPipelineIntegration({
        monitorPort: process.env.MONITOR_PORT || 3000,
        previewPort: process.env.PREVIEW_PORT || 3001,
        authToken: process.env.MONITOR_TOKEN
    });
    
    const options = {
        preset: process.argv.includes('--preset') ? 
            process.argv[process.argv.indexOf('--preset') + 1] : 'main',
        verbose: process.argv.includes('-v') || process.argv.includes('--verbose')
    };
    
    integration.generateWithPreview(options).catch(console.error);
}

module.exports = PreviewPipelineIntegration;