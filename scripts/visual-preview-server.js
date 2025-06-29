#!/usr/bin/env node
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

// WebSocket for hot reload
const wss = new WebSocket.Server({ port: 3001 });

// Serve static files
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/build', express.static(path.join(__dirname, '../build')));
app.use('/preview', express.static(path.join(__dirname, '../build/preview')));

// Main preview page
app.get('/', async (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ADHD Book Visual Preview</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f0f0;
        }
        
        .header {
            background: linear-gradient(135deg, #4ECDC4 0%, #95E1D3 100%);
            color: white;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .controls {
            background: white;
            padding: 20px;
            display: flex;
            gap: 20px;
            align-items: center;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        
        .button {
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .button-primary {
            background: #4ECDC4;
            color: white;
        }
        
        .button-secondary {
            background: #FF6B6B;
            color: white;
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .container {
            display: flex;
            height: calc(100vh - 140px);
            gap: 20px;
            padding: 20px;
        }
        
        .panel {
            flex: 1;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            display: flex;
            flex-direction: column;
        }
        
        .panel-header {
            background: #333;
            color: white;
            padding: 15px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .panel-content {
            flex: 1;
            overflow: auto;
            position: relative;
        }
        
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
        
        .status {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #2ecc71;
            color: white;
            border-radius: 5px;
            display: none;
        }
        
        .debug-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            display: none;
            z-index: 1000;
            font-family: monospace;
            font-size: 12px;
            overflow: auto;
            max-height: 50%;
        }
        
        .toggle-debug {
            font-size: 12px;
            padding: 5px 10px;
            background: #666;
            border: none;
            color: white;
            border-radius: 3px;
            cursor: pointer;
        }
        
        .pdf-pages {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
            padding: 20px;
        }
        
        .pdf-page {
            background: white;
            border-radius: 5px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: transform 0.3s ease;
        }
        
        .pdf-page:hover {
            transform: scale(1.05);
        }
        
        .pdf-page img {
            width: 100%;
            height: auto;
            display: block;
        }
        
        .pdf-page-number {
            text-align: center;
            padding: 10px;
            background: #f8f8f8;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 ADHD Book Visual Preview</h1>
        <p>Real-time preview with hot reload</p>
    </div>
    
    <div class="controls">
        <button class="button button-primary" onclick="regeneratePDF()">🔄 Regenerate PDF</button>
        <button class="button button-secondary" onclick="regenerateHTML()">🔄 Regenerate HTML</button>
        <button class="button button-primary" onclick="openInBrowser()">🌐 Open HTML in Browser</button>
        <button class="button button-secondary" onclick="showDebugInfo()">🐛 Debug CSS</button>
        <span id="status"></span>
    </div>
    
    <div class="container">
        <div class="panel">
            <div class="panel-header">
                <span>📄 HTML Preview</span>
                <button class="toggle-debug" onclick="toggleDebug('html')">Debug</button>
            </div>
            <div class="panel-content">
                <div id="html-debug" class="debug-overlay"></div>
                <iframe id="html-preview" src="/preview/html"></iframe>
            </div>
        </div>
        
        <div class="panel">
            <div class="panel-header">
                <span>📖 PDF Pages</span>
                <button class="toggle-debug" onclick="toggleDebug('pdf')">Debug</button>
            </div>
            <div class="panel-content">
                <div id="pdf-debug" class="debug-overlay"></div>
                <div id="pdf-pages" class="pdf-pages"></div>
            </div>
        </div>
    </div>
    
    <div class="status" id="update-status">Updated!</div>
    
    <script>
        // WebSocket connection for hot reload
        const ws = new WebSocket('ws://localhost:3001');
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'reload') {
                console.log('Reloading preview...');
                document.getElementById('html-preview').src = '/preview/html?' + Date.now();
                loadPDFPages();
                showStatus('Updated!');
            }
        };
        
        function regeneratePDF() {
            showStatus('Regenerating PDF...');
            fetch('/api/regenerate-pdf')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        loadPDFPages();
                        showStatus('PDF regenerated!');
                    }
                });
        }
        
        function regenerateHTML() {
            showStatus('Regenerating HTML...');
            fetch('/api/regenerate-html')
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        document.getElementById('html-preview').src = '/preview/html?' + Date.now();
                        showStatus('HTML regenerated!');
                    }
                });
        }
        
        function openInBrowser() {
            window.open('/preview/html', '_blank');
        }
        
        function showDebugInfo() {
            fetch('/api/debug-css')
                .then(res => res.json())
                .then(data => {
                    alert('Check console for CSS debug info');
                    console.log(data);
                });
        }
        
        function toggleDebug(panel) {
            const debugEl = document.getElementById(panel + '-debug');
            if (debugEl.style.display === 'block') {
                debugEl.style.display = 'none';
            } else {
                // Load debug info
                fetch('/api/debug-' + panel)
                    .then(res => res.json())
                    .then(data => {
                        debugEl.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                        debugEl.style.display = 'block';
                    });
            }
        }
        
        function showStatus(message) {
            const status = document.getElementById('update-status');
            status.textContent = message;
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
        
        function loadPDFPages() {
            fetch('/api/pdf-pages')
                .then(res => res.json())
                .then(data => {
                    const container = document.getElementById('pdf-pages');
                    container.innerHTML = data.pages.map((page, i) => \`
                        <div class="pdf-page" onclick="window.open('/preview/\${page}', '_blank')">
                            <img src="/preview/\${page}" alt="Page \${i + 1}">
                            <div class="pdf-page-number">Page \${i + 1}</div>
                        </div>
                    \`).join('');
                });
        }
        
        // Initial load
        loadPDFPages();
    </script>
</body>
</html>
    `;
    
    res.send(html);
});

// Preview HTML
app.get('/preview/html', async (req, res) => {
    const htmlPath = path.join(__dirname, '../build/temp/adhd-book-fixed.html');
    if (await fs.pathExists(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.send('<h1>HTML not generated yet. Click "Regenerate HTML" to create it.</h1>');
    }
});

// API endpoints
app.get('/api/regenerate-pdf', (req, res) => {
    exec('DEBUG=1 node scripts/generate-adhd-pdf-fixed.js', (error, stdout, stderr) => {
        if (error) {
            res.json({ success: false, error: error.message });
        } else {
            // Generate PDF preview images
            exec('pdftoppm -png -r 150 build/dist/tdah-descomplicado-fixed.pdf build/preview/page', () => {
                res.json({ success: true });
                // Notify clients
                wss.clients.forEach(client => {
                    client.send(JSON.stringify({ type: 'reload' }));
                });
            });
        }
    });
});

app.get('/api/regenerate-html', (req, res) => {
    exec('DEBUG=1 node scripts/generate-adhd-pdf-fixed.js', (error) => {
        res.json({ success: !error });
        // Notify clients
        wss.clients.forEach(client => {
            client.send(JSON.stringify({ type: 'reload' }));
        });
    });
});

app.get('/api/pdf-pages', async (req, res) => {
    const previewDir = path.join(__dirname, '../build/preview');
    try {
        const files = await fs.readdir(previewDir);
        const pages = files.filter(f => f.startsWith('page-') && f.endsWith('.png')).sort();
        res.json({ pages });
    } catch (error) {
        res.json({ pages: [] });
    }
});

app.get('/api/debug-css', async (req, res) => {
    const cssPath = path.join(__dirname, '../assets/css/adhd-ebook-styles.css');
    const css = await fs.readFile(cssPath, 'utf8');
    
    // Analyze CSS
    const analysis = {
        totalRules: (css.match(/{[^}]*}/g) || []).length,
        colorVariables: (css.match(/--[\w-]+:\s*#[\w]+/g) || []),
        specialClasses: (css.match(/\.(tip-box|warning-box|checklist|chapter)[^{]*/g) || []),
        printRules: (css.match(/@media\s+print[^{]*{[^}]*}/g) || [])
    };
    
    res.json(analysis);
});

app.get('/api/debug-html', async (req, res) => {
    const htmlPath = path.join(__dirname, '../build/temp/adhd-book-fixed.html');
    if (await fs.pathExists(htmlPath)) {
        const html = await fs.readFile(htmlPath, 'utf8');
        res.json({
            size: html.length,
            images: (html.match(/<img[^>]*>/g) || []).length,
            chapters: (html.match(/class="chapter"/g) || []).length,
            tipBoxes: (html.match(/class="tip-box"/g) || []).length,
            warningBoxes: (html.match(/class="warning-box"/g) || []).length
        });
    } else {
        res.json({ error: 'HTML not found' });
    }
});

app.get('/api/debug-pdf', async (req, res) => {
    const pdfPath = path.join(__dirname, '../build/dist/tdah-descomplicado-fixed.pdf');
    if (await fs.pathExists(pdfPath)) {
        const stats = await fs.stat(pdfPath);
        res.json({
            size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
            created: stats.mtime,
            pages: 88 // From previous analysis
        });
    } else {
        res.json({ error: 'PDF not found' });
    }
});

// Watch for changes
const watcher = chokidar.watch([
    'chapters/*.md',
    'assets/css/*.css',
    'scripts/generate-adhd-pdf-fixed.js'
], {
    ignored: /node_modules/,
    persistent: true
});

watcher.on('change', (path) => {
    console.log(`File changed: ${path}`);
    // Notify all connected clients
    wss.clients.forEach(client => {
        client.send(JSON.stringify({ type: 'reload', file: path }));
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Visual Preview Server running at http://localhost:${PORT}`);
    console.log('📁 Watching for changes...');
    console.log('\nFeatures:');
    console.log('  - Split screen HTML/PDF preview');
    console.log('  - Hot reload on file changes');
    console.log('  - CSS debug information');
    console.log('  - PDF page previews');
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});