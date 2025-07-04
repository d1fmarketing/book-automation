const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { spawn } = require('child_process');
const axios = require('axios');
const WebSocket = require('ws');
const path = require('path');

describe('Admin Dashboard Integration', () => {
    let serverProcess;
    let serverPort;
    const BASE_URL = 'http://localhost';
    
    beforeAll(async () => {
        // Find available port
        const net = require('net');
        serverPort = await new Promise((resolve) => {
            const srv = net.createServer();
            srv.listen(0, () => {
                const port = srv.address().port;
                srv.close(() => resolve(port));
            });
        });
        
        // Start server on ephemeral port
        return new Promise((resolve, reject) => {
            const env = { ...process.env, ADMIN_PORT: serverPort, NODE_ENV: 'test' };
            serverProcess = spawn('node', ['server.js'], {
                cwd: path.join(__dirname, '..'),
                env,
                detached: false
            });
            
            let startupOutput = '';
            
            serverProcess.stdout.on('data', (data) => {
                startupOutput += data.toString();
                if (startupOutput.includes('Admin Dashboard rodando')) {
                    resolve();
                }
            });
            
            serverProcess.stderr.on('data', (data) => {
                console.error('Server error:', data.toString());
            });
            
            serverProcess.on('error', reject);
            
            // Timeout if server doesn't start
            setTimeout(() => reject(new Error('Server startup timeout')), 10000);
        });
    }, 15000);
    
    afterAll(async () => {
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    });
    
    test('Health endpoint returns OK', async () => {
        const response = await axios.get(`${BASE_URL}:${serverPort}/health`);
        expect(response.status).toBe(200);
        expect(response.data.status).toBe('ok');
        expect(response.data.uptime).toBeGreaterThan(0);
    });
    
    test('Root endpoint returns dashboard info', async () => {
        const response = await axios.get(`${BASE_URL}:${serverPort}/`);
        expect(response.status).toBe(200);
        expect(response.data.name).toBe('Ebook Pipeline Admin Dashboard');
        expect(response.data.status).toBe('running');
    });
    
    test('API status endpoint returns system info', async () => {
        const response = await axios.get(`${BASE_URL}:${serverPort}/api/status`);
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('status', 'online');
        expect(response.data).toHaveProperty('queues');
        expect(response.data).toHaveProperty('workers');
        expect(response.data).toHaveProperty('connections');
    });
    
    test('WebSocket connection works', async () => {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(`ws://localhost:${serverPort}/socket.io/?EIO=4&transport=websocket`);
            
            ws.on('open', () => {
                ws.close();
                resolve();
            });
            
            ws.on('error', reject);
            
            setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
        });
    });
    
    test('Dashboard handles port conflicts gracefully', async () => {
        // Try to start another server on same port (should fail gracefully)
        const testServer = require('net').createServer();
        
        try {
            await new Promise((resolve, reject) => {
                testServer.once('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        resolve(); // Expected behavior
                    } else {
                        reject(err);
                    }
                });
                testServer.listen(serverPort);
            });
        } finally {
            testServer.close();
        }
    });
    
    test('Ping script can find running dashboard', async () => {
        const { pingDashboard } = require('../scripts/ping-dashboard.js');
        const result = await pingDashboard(serverPort);
        expect(result.success).toBe(true);
        expect(result.port).toBe(serverPort);
        expect(result.statusCode).toBe(200);
    });
});