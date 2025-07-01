#!/usr/bin/env node

/**
 * Live Preview Server
 * Provides real-time PDF preview during generation
 */

const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');

class PreviewServer {
    constructor(options = {}) {
        this.port = options.port || 3001;
        this.authToken = options.authToken || process.env.PREVIEW_TOKEN || 'preview-token-12345';
        this.previewDir = path.join(__dirname, 'previews');
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server, path: '/ws/preview' });
        
        this.clients = new Set();
        this.currentBuild = {
            id: null,
            totalPages: 0,
            currentPage: 0,
            chapters: [],
            startTime: null,
            status: 'idle'
        };
        
        this.setupExpress();
        this.setupWebSocket();
    }
    
    setupExpress() {
        // CORS for local development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            next();
        });
        
        // Serve static files
        this.app.use('/preview', express.static(this.previewDir));
        this.app.use('/ui', express.static(path.join(__dirname)));
        
        // API endpoints
        this.app.get('/api/status', (req, res) => {
            res.json(this.currentBuild);
        });
        
        // API endpoint for build updates
        this.app.use(express.json());
        this.app.post('/api/update', async (req, res) => {
            const { type, data } = req.body;
            
            switch(type) {
                case 'build_start':
                    await this.startBuild(data);
                    break;
                case 'progress':
                    await this.updateProgress(data);
                    break;
                case 'page_ready':
                    await this.addPagePreview(data.page, data.path);
                    break;
                case 'build_complete':
                    await this.completeBuild(data.path);
                    break;
            }
            
            res.json({ success: true });
        });
        
        this.app.get('/api/preview/:page', async (req, res) => {
            const pagePath = path.join(this.previewDir, `page-${req.params.page}.png`);
            try {
                const exists = await fs.access(pagePath).then(() => true).catch(() => false);
                if (exists) {
                    res.sendFile(pagePath);
                } else {
                    res.status(404).json({ error: 'Page not found' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Main preview UI
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'preview-ui.html'));
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            
            // Check auth token
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');
            
            if (this.authToken && token !== this.authToken) {
                console.log(`Unauthorized preview connection from ${clientIp}`);
                ws.close(1008, 'Unauthorized');
                return;
            }
            
            console.log(`Preview client connected from ${clientIp}`);
            this.clients.add(ws);
            
            // Send current status
            ws.send(JSON.stringify({
                type: 'status',
                data: this.currentBuild
            }));
            
            ws.on('message', (message) => {
                try {
                    const msg = JSON.parse(message);
                    this.handleClientMessage(ws, msg);
                } catch (error) {
                    console.error('Invalid message:', error);
                }
            });
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`Preview client disconnected from ${clientIp}`);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }
    
    handleClientMessage(ws, msg) {
        switch (msg.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
                
            case 'get_preview':
                this.sendPreview(ws, msg.page);
                break;
                
            case 'get_pdf':
                this.sendPdfPath(ws);
                break;
        }
    }
    
    async sendPreview(ws, pageNum) {
        const previewPath = `/preview/page-${pageNum}.png`;
        ws.send(JSON.stringify({
            type: 'preview_url',
            page: pageNum,
            url: previewPath
        }));
    }
    
    sendPdfPath(ws) {
        const pdfPath = `/preview/current.pdf`;
        ws.send(JSON.stringify({
            type: 'pdf_url',
            url: pdfPath
        }));
    }
    
    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }
    
    // Called by PDF generator
    async startBuild(buildInfo) {
        this.currentBuild = {
            id: buildInfo.id || Date.now(),
            totalPages: buildInfo.totalPages || 0,
            currentPage: 0,
            chapters: buildInfo.chapters || [],
            startTime: Date.now(),
            status: 'building'
        };
        
        // Clean preview directory
        await this.cleanPreviewDir();
        
        this.broadcast({
            type: 'build_start',
            data: this.currentBuild
        });
    }
    
    async updateProgress(progressInfo) {
        this.currentBuild.currentPage = progressInfo.currentPage;
        this.currentBuild.currentChapter = progressInfo.currentChapter;
        
        if (progressInfo.totalPages) {
            this.currentBuild.totalPages = progressInfo.totalPages;
        }
        
        this.broadcast({
            type: 'progress',
            data: {
                currentPage: this.currentBuild.currentPage,
                totalPages: this.currentBuild.totalPages,
                currentChapter: this.currentBuild.currentChapter,
                percentage: (this.currentBuild.currentPage / this.currentBuild.totalPages * 100).toFixed(1)
            }
        });
    }
    
    async addPagePreview(pageNum, imagePath) {
        // Copy image to preview directory
        const destPath = path.join(this.previewDir, `page-${pageNum}.png`);
        await fs.copyFile(imagePath, destPath);
        
        this.broadcast({
            type: 'page_ready',
            data: {
                page: pageNum,
                url: `/preview/page-${pageNum}.png`
            }
        });
    }
    
    async completeBuild(pdfPath) {
        this.currentBuild.status = 'complete';
        this.currentBuild.endTime = Date.now();
        this.currentBuild.duration = this.currentBuild.endTime - this.currentBuild.startTime;
        
        // Copy final PDF
        if (pdfPath) {
            const destPath = path.join(this.previewDir, 'current.pdf');
            await fs.copyFile(pdfPath, destPath);
        }
        
        this.broadcast({
            type: 'build_complete',
            data: {
                duration: this.currentBuild.duration,
                totalPages: this.currentBuild.totalPages,
                pdfUrl: '/preview/current.pdf'
            }
        });
    }
    
    async cleanPreviewDir() {
        await fs.mkdir(this.previewDir, { recursive: true });
        
        const files = await fs.readdir(this.previewDir);
        for (const file of files) {
            if (file.endsWith('.png') || file.endsWith('.pdf')) {
                await fs.unlink(path.join(this.previewDir, file)).catch(() => {});
            }
        }
    }
    
    async start() {
        await fs.mkdir(this.previewDir, { recursive: true });
        
        this.server.listen(this.port, () => {
            console.log(`🖼️  Preview server running at http://localhost:${this.port}`);
            console.log(`   WebSocket: ws://localhost:${this.port}/ws/preview`);
            if (this.authToken) {
                console.log(`   Auth token required: ${this.authToken}`);
            }
        });
    }
    
    stop() {
        this.server.close();
        for (const client of this.clients) {
            client.close();
        }
    }
}

// Export for use by PDF generator
module.exports = PreviewServer;

// Run standalone
if (require.main === module) {
    const server = new PreviewServer({
        port: process.env.PREVIEW_PORT || 3001,
        authToken: process.env.PREVIEW_TOKEN
    });
    
    server.start().catch(console.error);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down preview server...');
        server.stop();
        process.exit(0);
    });
}