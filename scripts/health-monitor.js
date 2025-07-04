#!/usr/bin/env node

/**
 * Health Monitor for Ebook Automation Pipeline
 * Monitors system health and sends alerts to Slack
 */

const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:4000';
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || 300000; // 5 minutes
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Health check results
const healthChecks = {
    dashboard: { status: 'unknown', lastCheck: null, error: null },
    redis: { status: 'unknown', lastCheck: null, error: null },
    queues: { status: 'unknown', lastCheck: null, error: null },
    workers: { status: 'unknown', lastCheck: null, error: null },
    diskSpace: { status: 'unknown', lastCheck: null, error: null }
};

// Check dashboard health
async function checkDashboard() {
    try {
        const response = await axios.get(`${DASHBOARD_URL}/health`, { timeout: 5000 });
        healthChecks.dashboard = {
            status: response.data.status === 'ok' ? 'healthy' : 'unhealthy',
            lastCheck: new Date(),
            error: null,
            uptime: response.data.uptime
        };
        return true;
    } catch (error) {
        healthChecks.dashboard = {
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error.message
        };
        return false;
    }
}

// Check Redis connection
async function checkRedis() {
    try {
        const { getQueueManager } = require('../src/queue/QueueManager');
        const qm = getQueueManager();
        await qm.connect();
        
        healthChecks.redis = {
            status: 'healthy',
            lastCheck: new Date(),
            error: null
        };
        
        // Also check queue stats
        const stats = await qm.getStats();
        let totalJobs = 0;
        let failedJobs = 0;
        
        Object.values(stats).forEach(queue => {
            totalJobs += (queue.waiting || 0) + (queue.active || 0) + (queue.completed || 0);
            failedJobs += queue.failed || 0;
        });
        
        healthChecks.queues = {
            status: failedJobs > 100 ? 'warning' : 'healthy',
            lastCheck: new Date(),
            error: null,
            totalJobs,
            failedJobs,
            stats
        };
        
        await qm.shutdown();
        return true;
    } catch (error) {
        healthChecks.redis = {
            status: 'unhealthy',
            lastCheck: new Date(),
            error: error.message
        };
        return false;
    }
}

// Check PM2 workers
async function checkWorkers() {
    try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        
        const refurbishWorker = processes.find(p => p.name === 'refurbish-worker');
        const adminDashboard = processes.find(p => p.name === 'admin-dashboard');
        
        const workers = {
            refurbish: refurbishWorker ? refurbishWorker.pm2_env.status : 'not found',
            admin: adminDashboard ? adminDashboard.pm2_env.status : 'not found'
        };
        
        const allHealthy = Object.values(workers).every(status => status === 'online');
        
        healthChecks.workers = {
            status: allHealthy ? 'healthy' : 'unhealthy',
            lastCheck: new Date(),
            error: null,
            workers
        };
        
        return allHealthy;
    } catch (error) {
        healthChecks.workers = {
            status: 'unknown',
            lastCheck: new Date(),
            error: error.message
        };
        return false;
    }
}

// Check disk space
async function checkDiskSpace() {
    try {
        const { stdout } = await execAsync("df -h . | tail -1 | awk '{print $5}' | sed 's/%//'");
        const usagePercent = parseInt(stdout.trim());
        
        healthChecks.diskSpace = {
            status: usagePercent > 90 ? 'critical' : usagePercent > 80 ? 'warning' : 'healthy',
            lastCheck: new Date(),
            error: null,
            usage: usagePercent
        };
        
        return usagePercent < 90;
    } catch (error) {
        healthChecks.diskSpace = {
            status: 'unknown',
            lastCheck: new Date(),
            error: error.message
        };
        return false;
    }
}

// Send alert to Slack
async function sendSlackAlert(message, type = 'warning') {
    if (!SLACK_WEBHOOK_URL) {
        console.log('⚠️  No Slack webhook configured, logging locally:', message);
        return;
    }
    
    const color = type === 'error' ? '#ff0000' : type === 'warning' ? '#ff9900' : '#00ff00';
    
    try {
        await axios.post(SLACK_WEBHOOK_URL, {
            attachments: [{
                color,
                title: `🚨 Ebook Pipeline Health Alert`,
                text: message,
                fields: Object.entries(healthChecks).map(([check, result]) => ({
                    title: check.charAt(0).toUpperCase() + check.slice(1),
                    value: `Status: ${result.status}${result.error ? `\nError: ${result.error}` : ''}`,
                    short: true
                })),
                timestamp: Math.floor(Date.now() / 1000)
            }]
        });
    } catch (error) {
        console.error('Failed to send Slack alert:', error.message);
    }
}

// Run all health checks
async function runHealthChecks() {
    console.log(`🏥 Running health checks at ${new Date().toISOString()}`);
    
    const results = await Promise.all([
        checkDashboard(),
        checkRedis(),
        checkWorkers(),
        checkDiskSpace()
    ]);
    
    const allHealthy = results.every(r => r === true);
    const hasErrors = Object.values(healthChecks).some(check => check.status === 'unhealthy' || check.status === 'critical');
    const hasWarnings = Object.values(healthChecks).some(check => check.status === 'warning');
    
    if (hasErrors) {
        const errorMessages = Object.entries(healthChecks)
            .filter(([_, check]) => check.status === 'unhealthy' || check.status === 'critical')
            .map(([name, check]) => `${name}: ${check.error || check.status}`)
            .join('\n');
            
        await sendSlackAlert(`🔴 Critical issues detected:\n${errorMessages}`, 'error');
    } else if (hasWarnings) {
        const warningMessages = Object.entries(healthChecks)
            .filter(([_, check]) => check.status === 'warning')
            .map(([name, check]) => `${name}: ${check.status}`)
            .join('\n');
            
        await sendSlackAlert(`⚠️ Warnings detected:\n${warningMessages}`, 'warning');
    }
    
    // Log summary
    console.log('\n📊 Health Check Summary:');
    Object.entries(healthChecks).forEach(([check, result]) => {
        const icon = result.status === 'healthy' ? '✅' : 
                    result.status === 'warning' ? '⚠️' : '❌';
        console.log(`   ${icon} ${check}: ${result.status}`);
    });
    
    return allHealthy;
}

// Main monitoring loop
async function startMonitoring() {
    console.log('🚀 Starting Ebook Pipeline Health Monitor');
    console.log(`   Dashboard URL: ${DASHBOARD_URL}`);
    console.log(`   Check Interval: ${CHECK_INTERVAL / 1000}s`);
    console.log(`   Slack Webhook: ${SLACK_WEBHOOK_URL ? 'Configured' : 'Not configured'}`);
    console.log('');
    
    // Run initial check
    await runHealthChecks();
    
    // Schedule periodic checks
    setInterval(runHealthChecks, CHECK_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n📛 Health monitor shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n📛 Health monitor interrupted...');
    process.exit(0);
});

// Export for cron usage
module.exports = { runHealthChecks, healthChecks };

// Start monitoring if run directly
if (require.main === module) {
    startMonitoring();
}