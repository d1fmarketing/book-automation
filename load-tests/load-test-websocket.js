#!/usr/bin/env node

/**
 * Load Test: WebSocket Connection Storm
 * Tests WebSocket authentication, rate limiting, and connection handling under load
 */

const LoadTestRunner = require('./base-load-test');
const WebSocket = require('ws');

class WebSocketLoadTest extends LoadTestRunner {
    constructor(options = {}) {
        super('websocket-storm', {
            concurrency: options.concurrency || 50,
            duration: options.duration || 30000, // 30 seconds
            ...options
        });
        
        this.wsUrl = options.wsUrl || 'ws://localhost:4001';
        this.validToken = options.token || process.env.MONITOR_TOKEN || 'test-token-12345';
        this.connections = [];
        this.messageStats = {
            sent: 0,
            received: 0,
            unauthorized: 0,
            authenticated: 0
        };
    }
    
    async runTest() {
        // Ensure monitor is running
        await this.ensureMonitorRunning();
        
        // Mix of different connection types
        const tasks = [];
        
        // Group 1: Valid authenticated connections (20)
        for (let i = 0; i < 20; i++) {
            tasks.push(this.createAuthenticatedConnection(i));
        }
        
        // Group 2: Invalid token connections (10)
        for (let i = 0; i < 10; i++) {
            tasks.push(this.createInvalidTokenConnection(i));
        }
        
        // Group 3: No auth connections (10)
        for (let i = 0; i < 10; i++) {
            tasks.push(this.createUnauthenticatedConnection(i));
        }
        
        // Group 4: Rapid connect/disconnect (10)
        for (let i = 0; i < 10; i++) {
            tasks.push(this.rapidConnectDisconnect(i));
        }
        
        await Promise.all(tasks);
    }
    
    async ensureMonitorRunning() {
        // Try to connect to check if monitor is running
        return new Promise((resolve) => {
            const testWs = new WebSocket(this.wsUrl);
            
            testWs.on('open', () => {
                testWs.close();
                console.log('✅ Monitor is running');
                resolve();
            });
            
            testWs.on('error', () => {
                console.log('⚠️  Monitor not running, please start it first');
                console.log('   Run: MONITOR_TOKEN=test-token-12345 node .claude/scripts/mcp-pipeline-monitor.js');
                process.exit(1);
            });
        });
    }
    
    /**
     * Create authenticated connection
     */
    async createAuthenticatedConnection(id) {
        await this.trackOperation(`auth-connection-${id}`, async () => {
            const ws = new WebSocket(`${this.wsUrl}?token=${this.validToken}`);
            
            return new Promise((resolve, reject) => {
                let authenticated = false;
                let messageCount = 0;
                
                ws.on('open', () => {
                    this.connections.push(ws);
                    
                    // Send periodic pings
                    const pingInterval = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'ping' }));
                            this.messageStats.sent++;
                        }
                    }, 1000);
                    
                    ws.pingInterval = pingInterval;
                });
                
                ws.on('message', (data) => {
                    this.messageStats.received++;
                    messageCount++;
                    
                    try {
                        const msg = JSON.parse(data);
                        if (msg.type === 'full_update' || msg.type === 'auth_success') {
                            authenticated = true;
                            this.messageStats.authenticated++;
                        }
                    } catch {}
                });
                
                ws.on('close', () => {
                    clearInterval(ws.pingInterval);
                    const index = this.connections.indexOf(ws);
                    if (index > -1) {
                        this.connections.splice(index, 1);
                    }
                    
                    if (authenticated && messageCount > 0) {
                        resolve();
                    } else {
                        reject(new Error('Connection closed without auth'));
                    }
                });
                
                ws.on('error', reject);
                
                // Keep connection open for test duration
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                }, this.duration - 5000);
            });
        }).catch(() => {});
    }
    
    /**
     * Create connection with invalid token
     */
    async createInvalidTokenConnection(id) {
        await this.trackOperation(`invalid-token-${id}`, async () => {
            const ws = new WebSocket(`${this.wsUrl}?token=invalid-token-${id}`);
            
            return new Promise((resolve, reject) => {
                let receivedData = false;
                
                ws.on('open', () => {
                    this.connections.push(ws);
                    
                    // Try to send commands
                    ws.send(JSON.stringify({ type: 'command', command: 'status' }));
                    this.messageStats.sent++;
                });
                
                ws.on('message', () => {
                    receivedData = true;
                    this.messageStats.received++;
                    // Should not receive data with invalid token
                    reject(new Error('Received data with invalid token'));
                });
                
                ws.on('close', (code) => {
                    if (!receivedData && (code === 1008 || code === 1005)) {
                        this.messageStats.unauthorized++;
                        resolve(); // Correctly rejected
                    } else {
                        reject(new Error(`Unexpected close code: ${code}`));
                    }
                });
                
                ws.on('error', () => {
                    resolve(); // Connection rejected is expected
                });
                
                // Should be rejected quickly
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                        reject(new Error('Connection not rejected'));
                    }
                }, 10000);
            });
        }).catch(() => {});
    }
    
    /**
     * Create unauthenticated connection
     */
    async createUnauthenticatedConnection(id) {
        await this.trackOperation(`unauth-connection-${id}`, async () => {
            const ws = new WebSocket(this.wsUrl);
            
            return new Promise((resolve, reject) => {
                let receivedData = false;
                let authTimeout = null;
                
                ws.on('open', () => {
                    this.connections.push(ws);
                    
                    // Should timeout after 5 seconds
                    authTimeout = setTimeout(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            reject(new Error('Auth timeout not enforced'));
                        }
                    }, 6000);
                });
                
                ws.on('message', () => {
                    receivedData = true;
                    this.messageStats.received++;
                    // Should not receive data without auth
                    reject(new Error('Received data without auth'));
                });
                
                ws.on('close', (code) => {
                    clearTimeout(authTimeout);
                    if (!receivedData && code === 1008) {
                        this.messageStats.unauthorized++;
                        resolve(); // Correctly closed
                    }
                });
                
                ws.on('error', () => {
                    clearTimeout(authTimeout);
                    resolve(); // Connection rejected is expected
                });
            });
        }).catch(() => {});
    }
    
    /**
     * Rapid connect/disconnect cycles
     */
    async rapidConnectDisconnect(id) {
        let cycles = 0;
        
        while (this.isRunning && cycles < 20) {
            await this.trackOperation(`rapid-cycle-${id}-${cycles}`, async () => {
                const ws = new WebSocket(`${this.wsUrl}?token=${this.validToken}`);
                
                return new Promise((resolve) => {
                    ws.on('open', () => {
                        // Immediately close
                        setTimeout(() => {
                            ws.close();
                        }, Math.random() * 500);
                    });
                    
                    ws.on('close', () => {
                        resolve();
                    });
                    
                    ws.on('error', () => {
                        resolve();
                    });
                    
                    // Timeout
                    setTimeout(resolve, 2000);
                });
            }).catch(() => {});
            
            cycles++;
            await this.sleep(Math.random() * 1000);
        }
    }
    
    async stop() {
        // Close all connections
        for (const ws of this.connections) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
            if (ws.pingInterval) {
                clearInterval(ws.pingInterval);
            }
        }
        
        await super.stop();
    }
    
    async generateReport() {
        const report = await super.generateReport();
        
        // Add WebSocket-specific stats
        console.log('\nWebSocket Stats:');
        console.log(`  Messages Sent: ${this.messageStats.sent}`);
        console.log(`  Messages Received: ${this.messageStats.received}`);
        console.log(`  Authenticated: ${this.messageStats.authenticated}`);
        console.log(`  Unauthorized Rejections: ${this.messageStats.unauthorized}`);
        console.log(`  Max Concurrent Connections: ${this.concurrency}`);
        
        return report;
    }
}

// CLI interface
if (require.main === module) {
    const test = new WebSocketLoadTest({
        concurrency: parseInt(process.argv[2]) || 50,
        duration: parseInt(process.argv[3]) || 30000,
        token: process.argv[4] || process.env.MONITOR_TOKEN
    });
    
    test.start().catch(console.error);
}

module.exports = WebSocketLoadTest;