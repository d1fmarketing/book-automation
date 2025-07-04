#!/usr/bin/env node

/**
 * Production Server Starter
 * 
 * Starts the main application server with health checks
 * and graceful shutdown handling
 */

const express = require('express');
const { getQueueManager } = require('../src/queue/QueueManager');
const { getMetricsCollector } = require('../src/monitoring/MetricsCollector');
const { getRateLimiter } = require('../src/middleware/RateLimiter');
const WorkerPool = require('../src/queue/WorkerPool');

const app = express();
const PORT = process.env.API_PORT || 3000;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize services
let queueManager;
let workerPool;
let metricsCollector;
let rateLimiter;
let isShuttingDown = false;

async function initializeServices() {
    console.log('🚀 Initializing services...');
    
    // Initialize queue manager
    queueManager = getQueueManager();
    await queueManager.initialize();
    
    // Initialize metrics collector
    metricsCollector = getMetricsCollector();
    metricsCollector.start();
    
    // Initialize rate limiter
    rateLimiter = getRateLimiter();
    
    // Initialize worker pool if not in worker mode
    if (!process.env.WORKER_MODE) {
        workerPool = new WorkerPool(queueManager);
        await workerPool.start();
    }
    
    console.log('✅ Services initialized');
}

// Health check endpoint
app.get('/health', (req, res) => {
    if (isShuttingDown) {
        return res.status(503).json({ status: 'shutting_down' });
    }
    
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
            queue: queueManager ? 'ready' : 'not_ready',
            workers: workerPool ? 'ready' : 'not_applicable',
            metrics: metricsCollector ? 'ready' : 'not_ready'
        },
        memory: process.memoryUsage()
    };
    
    res.json(health);
});

// API endpoints
app.post('/api/pipeline/start', async (req, res) => {
    try {
        const { topic, options } = req.body;
        
        if (!topic) {
            return res.status(400).json({ error: 'Topic is required' });
        }
        
        // Check rate limits
        const rateCheck = await rateLimiter.checkLimit('api', 'request');
        if (!rateCheck.allowed) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                resetIn: rateCheck.resetIn
            });
        }
        
        // Start pipeline
        const pipelineId = await queueManager.startPipeline(topic, options);
        
        // Record usage
        await rateLimiter.recordUsage('api', 'request');
        
        res.json({
            success: true,
            pipelineId,
            message: `Pipeline started for topic: ${topic}`
        });
        
    } catch (error) {
        console.error('Pipeline start error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/pipeline/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const status = await queueManager.getPipelineStatus(id);
        
        if (!status) {
            return res.status(404).json({ error: 'Pipeline not found' });
        }
        
        res.json(status);
        
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/queue/stats', async (req, res) => {
    try {
        const stats = await queueManager.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/workers/stats', async (req, res) => {
    if (!workerPool) {
        return res.status(404).json({ error: 'Workers not available in this mode' });
    }
    
    try {
        const stats = await workerPool.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Worker stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/rate-limits', async (req, res) => {
    try {
        const status = rateLimiter.getAllStatus();
        res.json(status);
    } catch (error) {
        console.error('Rate limit status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Metrics endpoint
const metricsApp = express();
metricsApp.get('/metrics', async (req, res) => {
    try {
        const metrics = await metricsCollector.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).send('Error collecting metrics');
    }
});

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n📛 Received ${signal}, starting graceful shutdown...`);
    isShuttingDown = true;
    
    // Stop accepting new requests
    server.close(() => {
        console.log('✅ HTTP server closed');
    });
    
    metricsServer.close(() => {
        console.log('✅ Metrics server closed');
    });
    
    // Wait for ongoing requests to complete (max 30 seconds)
    setTimeout(async () => {
        try {
            // Shutdown services
            if (workerPool) {
                await workerPool.shutdown();
            }
            
            if (queueManager) {
                await queueManager.shutdown();
            }
            
            if (metricsCollector) {
                metricsCollector.stop();
            }
            
            console.log('✅ All services shut down gracefully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            process.exit(1);
        }
    }, 30000);
}

// Start servers
let server;
let metricsServer;

async function start() {
    try {
        await initializeServices();
        
        server = app.listen(PORT, () => {
            console.log(`🌐 API server listening on port ${PORT}`);
        });
        
        metricsServer = metricsApp.listen(METRICS_PORT, () => {
            console.log(`📊 Metrics server listening on port ${METRICS_PORT}`);
        });
        
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
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the application
start();