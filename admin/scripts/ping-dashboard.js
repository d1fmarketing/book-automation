#!/usr/bin/env node

/**
 * Simple health check script for the admin dashboard
 * Exits with code 0 on success, 1 on failure
 */

const http = require('http');

const TIMEOUT = 5000; // 5 second timeout
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function checkPort(port) {
    return new Promise((resolve) => {
        const testServer = require('net').createServer();
        testServer.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true); // Port is in use (good - server is running)
            } else {
                resolve(false);
            }
        });
        testServer.once('listening', () => {
            testServer.close();
            resolve(false); // Port is free (bad - server not running)
        });
        testServer.listen(port);
    });
}

async function pingDashboard(port) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: port,
            path: '/',
            method: 'GET',
            timeout: TIMEOUT
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === 200 || res.statusCode === 304) {
                resolve({ success: true, port, statusCode: res.statusCode });
            } else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function findDashboard() {
    const ports = [4000, 4001, 4002, 4003, 4004]; // Check default port + alternatives
    
    for (const port of ports) {
        if (await checkPort(port)) {
            console.log(`🔍 Found server on port ${port}, attempting ping...`);
            
            for (let retry = 0; retry < MAX_RETRIES; retry++) {
                try {
                    const result = await pingDashboard(port);
                    return result;
                } catch (err) {
                    console.log(`   Retry ${retry + 1}/${MAX_RETRIES}: ${err.message}`);
                    if (retry < MAX_RETRIES - 1) {
                        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    }
                }
            }
        }
    }
    
    return null;
}

async function main() {
    console.log('🏥 Admin Dashboard Health Check');
    console.log('================================');
    
    try {
        const result = await findDashboard();
        
        if (result) {
            console.log(`✅ Dashboard is healthy!`);
            console.log(`   Port: ${result.port}`);
            console.log(`   Status: ${result.statusCode}`);
            console.log(`   URL: http://localhost:${result.port}`);
            process.exit(0);
        } else {
            console.error('❌ Dashboard not found on any port (4000-4004)');
            console.error('   Run: npm run dev');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Health check failed:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { pingDashboard, findDashboard };