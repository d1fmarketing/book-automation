#!/usr/bin/env node

/**
 * Worker Pool Starter
 * 
 * Starts dedicated worker processes for job processing
 */

const { getQueueManager } = require('../src/queue/QueueManager');
const WorkerPool = require('../src/queue/WorkerPool');
const { getMetricsCollector } = require('../src/monitoring/MetricsCollector');
const { getRateLimiter } = require('../src/middleware/RateLimiter');

let queueManager;
let workerPool;
let metricsCollector;
let rateLimiter;
let isShuttingDown = false;

async function initializeServices() {
    console.log('🚀 Initializing worker services...');
    
    // Initialize queue manager
    queueManager = getQueueManager();
    await queueManager.connect();
    
    // Initialize metrics collector
    metricsCollector = getMetricsCollector();
    metricsCollector.start();
    
    // Initialize rate limiter
    rateLimiter = getRateLimiter();
    
    // Initialize worker pool
    const workerConfig = {
        maxWorkers: parseInt(process.env.MAX_WORKERS) || 8,
        workerConfig: {
            pipeline: { 
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 1, 
                count: 1 
            },
            research: { 
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 1, 
                count: Math.ceil((parseInt(process.env.MAX_WORKERS) || 8) * 0.25)
            },
            writer: { 
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 2, 
                count: Math.ceil((parseInt(process.env.MAX_WORKERS) || 8) * 0.4)
            },
            formatter: { 
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 1, 
                count: Math.ceil((parseInt(process.env.MAX_WORKERS) || 8) * 0.2)
            },
            qa: { 
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 1, 
                count: Math.ceil((parseInt(process.env.MAX_WORKERS) || 8) * 0.15)
            },
            refurbish: {
                concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 1,
                count: 1
            }
        }
    };
    
    workerPool = new WorkerPool(queueManager, workerConfig);
    await workerPool.start();
    
    console.log('✅ Worker services initialized');
    console.log(`👷 Total workers: ${process.env.MAX_WORKERS || 8}`);
}

// Monitor worker health
function startHealthMonitoring() {
    setInterval(async () => {
        if (isShuttingDown) return;
        
        try {
            const stats = await workerPool.getStats();
            
            // Log high-level stats
            console.log(`📊 Worker stats at ${new Date().toISOString()}`);
            
            for (const [queue, queueStats] of Object.entries(stats)) {
                if (queueStats.utilization > 0) {
                    console.log(`  ${queue}: ${queueStats.activeJobs}/${queueStats.capacity} jobs (${queueStats.utilization}% utilized)`);
                }
            }
            
            // Check for issues
            for (const [queue, queueStats] of Object.entries(stats)) {
                if (queueStats.utilization > 90) {
                    console.warn(`⚠️  High load on ${queue} workers`);
                }
            }
            
        } catch (error) {
            console.error('Health check error:', error);
        }
    }, 60000); // Every minute
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);
    isShuttingDown = true;
    
    // Wait for ongoing jobs to complete (max 5 minutes)
    const shutdownTimeout = setTimeout(async () => {
        console.warn('⚠️  Shutdown timeout reached, forcing exit');
        process.exit(1);
    }, 300000);
    
    try {
        // Pause workers to stop accepting new jobs
        await workerPool.pause();
        console.log('⏸️  Workers paused');
        
        // Wait for active jobs to complete
        let attempts = 0;
        while (attempts < 30) { // 30 seconds max
            const stats = await workerPool.getStats();
            let totalActive = 0;
            
            for (const queueStats of Object.values(stats)) {
                totalActive += queueStats.activeJobs;
            }
            
            if (totalActive === 0) {
                break;
            }
            
            console.log(`⏳ Waiting for ${totalActive} active jobs to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }
        
        // Shutdown services
        await workerPool.shutdown();
        console.log('✅ Worker pool shut down');
        
        if (queueManager) {
            await queueManager.shutdown();
            console.log('✅ Queue manager shut down');
        }
        
        if (metricsCollector) {
            metricsCollector.stop();
            console.log('✅ Metrics collector stopped');
        }
        
        clearTimeout(shutdownTimeout);
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Auto-scaling based on load
async function startAutoScaling() {
    if (process.env.AUTO_SCALING_ENABLED !== 'true') {
        return;
    }
    
    const { AutoScaler } = require('../src/workers/AutoScaler');
    const autoScaler = new AutoScaler(workerPool, queueManager);
    
    await autoScaler.start();
    console.log('🔄 Auto-scaling enabled');
}

// Start workers
async function start() {
    try {
        await initializeServices();
        
        // Start health monitoring
        startHealthMonitoring();
        
        // Start auto-scaling if enabled
        await startAutoScaling();
        
        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught errors
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught exception:', error);
            gracefulShutdown('uncaughtException');
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
        
        console.log('✅ Worker pool is running');
        console.log('Press Ctrl+C to shutdown gracefully');
        
    } catch (error) {
        console.error('❌ Failed to start workers:', error);
        process.exit(1);
    }
}

// Start the workers
start();