#!/usr/bin/env node

/**
 * Test WebSocket authentication for MCP monitor
 */

const WebSocket = require('ws');

async function testAuth() {
    console.log('Testing WebSocket authentication...\n');
    
    // Test 1: Connect without token (should fail if auth is required)
    console.log('Test 1: Connect without token');
    try {
        const ws1 = new WebSocket('ws://localhost:8765');
        let receivedData = false;
        
        await new Promise((resolve, reject) => {
            ws1.on('open', () => {
                console.log('⚠️  Connected (waiting for timeout)');
                
                // Try to send a ping
                ws1.send(JSON.stringify({ type: 'ping' }));
            });
            
            ws1.on('message', (data) => {
                receivedData = true;
                console.log('❌ Received data without auth:', data.toString().substring(0, 50));
            });
            
            ws1.on('close', (code, reason) => {
                if (code === 1008 && reason === 'Unauthorized') {
                    console.log(`✅ Connection closed correctly: ${reason}`);
                } else {
                    console.log(`⚠️  Connection closed: code=${code}, reason=${reason}`);
                }
                resolve();
            });
            
            ws1.on('error', (error) => {
                console.log(`❌ Connection error: ${error.message}`);
                resolve();
            });
            
            setTimeout(() => {
                if (ws1.readyState === WebSocket.OPEN) {
                    if (!receivedData) {
                        console.log('✅ No data received (good)');
                    }
                    ws1.close();
                }
                resolve();
            }, 2000);
        });
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\nTest 2: Connect with token in URL');
    try {
        const ws2 = new WebSocket('ws://localhost:8765?token=test123');
        
        await new Promise((resolve, reject) => {
            ws2.on('open', () => {
                console.log('✅ Connected with URL token');
                
                // Wait for initial data
                ws2.on('message', (data) => {
                    const msg = JSON.parse(data);
                    if (msg.type === 'full_update') {
                        console.log('✅ Received initial state');
                    }
                });
                
                setTimeout(() => {
                    ws2.close();
                    resolve();
                }, 1000);
            });
            
            ws2.on('close', (code, reason) => {
                if (code === 1008) {
                    console.log(`❌ Connection rejected: ${reason}`);
                }
                resolve();
            });
            
            ws2.on('error', (error) => {
                console.log(`❌ Connection error: ${error.message}`);
                resolve();
            });
        });
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\nTest 3: Connect and authenticate via message');
    try {
        const ws3 = new WebSocket('ws://localhost:8765');
        
        await new Promise((resolve, reject) => {
            ws3.on('open', () => {
                console.log('✅ Connected');
                
                // Send auth message
                ws3.send(JSON.stringify({
                    type: 'auth',
                    token: 'test123'
                }));
                console.log('📤 Sent auth message');
            });
            
            ws3.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'auth_success') {
                    console.log('✅ Authentication successful');
                } else if (msg.type === 'full_update') {
                    console.log('✅ Received initial state');
                    ws3.close();
                    resolve();
                }
            });
            
            ws3.on('close', (code, reason) => {
                if (code === 1008) {
                    console.log(`❌ Connection rejected: ${reason}`);
                }
                resolve();
            });
            
            ws3.on('error', (error) => {
                console.log(`❌ Connection error: ${error.message}`);
                resolve();
            });
            
            setTimeout(() => resolve(), 2000);
        });
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\nTest 4: Connect with wrong token');
    try {
        const ws4 = new WebSocket('ws://localhost:8765?token=wrongtoken');
        
        await new Promise((resolve, reject) => {
            ws4.on('open', () => {
                console.log('⚠️  Connected');
            });
            
            ws4.on('message', (data) => {
                console.log('❌ Should not receive data with wrong token');
            });
            
            ws4.on('close', (code, reason) => {
                if (code === 1008 && reason === 'Unauthorized') {
                    console.log(`✅ Connection rejected correctly: ${reason}`);
                } else {
                    console.log(`⚠️  Connection closed: code=${code}, reason=${reason}`);
                }
                resolve();
            });
            
            ws4.on('error', (error) => {
                console.log(`❌ Connection error: ${error.message}`);
                resolve();
            });
            
            setTimeout(() => {
                if (ws4.readyState === WebSocket.OPEN) {
                    console.log('❌ Connection still open with wrong token');
                    ws4.close();
                }
                resolve();
            }, 2000);
        });
    } catch (error) {
        console.log(`✅ Connection rejected: ${error.message}`);
    }
    
    console.log('\n✅ All tests completed!');
    process.exit(0);
}

// Check if monitor is running
const testWs = new WebSocket('ws://localhost:8765');
testWs.on('error', (error) => {
    console.error('❌ MCP Monitor is not running!');
    console.log('Start it with: MCP_MONITOR_TOKEN=test123 node .claude/scripts/mcp-pipeline-monitor.js');
    process.exit(1);
});

testWs.on('open', () => {
    testWs.close();
    setTimeout(testAuth, 100);
});