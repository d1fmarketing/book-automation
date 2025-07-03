const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.CONTROL_PORT || 3005;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// In-memory stores
const pipelineStore = {
    status: 'ready',
    stats: {
        successCount: 0,
        failedCount: 0,
        avgTime: 0,
        apiCost: 0,
        totalRuns: []
    },
    jobs: new Map(),
    queue: [],
    schedules: [],
    logs: [],
    apiUsage: {
        openai: { used: 0, limit: 1000 },
        perplexity: { used: 0, limit: 500 },
        ideogram: { used: 0, limit: 100 }
    }
};

// WebSocket setup
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established');
    
    // Send initial status
    ws.send(JSON.stringify({
        type: 'pipeline-status',
        payload: {
            state: pipelineStore.status,
            message: `Pipeline ${pipelineStore.status}`
        }
    }));
    
    // Send current stats
    ws.send(JSON.stringify({
        type: 'stats-update',
        payload: pipelineStore.stats
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

// WebSocket message handler
function handleWebSocketMessage(ws, data) {
    const { type, payload } = data;
    
    switch (type) {
        case 'save-config':
            saveConfiguration(payload);
            break;
        case 'get-stats':
            ws.send(JSON.stringify({
                type: 'stats-update',
                payload: pipelineStore.stats
            }));
            break;
    }
}

// Broadcast to all connected clients
function broadcast(type, payload, channel = 'all') {
    const message = JSON.stringify({ type, payload, channel });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        uptime: process.uptime(),
        connections: wss.clients.size
    });
});

// Pipeline control
app.post('/api/pipeline/start', async (req, res) => {
    try {
        const { mode = 'full' } = req.body;
        
        // Create job
        const jobId = `job-${Date.now()}`;
        const job = {
            id: jobId,
            mode,
            status: 'queued',
            started: new Date().toISOString(),
            phases: {}
        };
        
        pipelineStore.jobs.set(jobId, job);
        pipelineStore.queue.push(jobId);
        
        // Start pipeline
        startPipeline(jobId, mode);
        
        res.json({ success: true, jobId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pipeline/stop', async (req, res) => {
    try {
        const { emergency = false } = req.body;
        
        if (emergency) {
            // Kill all running processes
            await execAsync('pkill -f "node.*automation-pipeline"').catch(() => {});
            await execAsync('pkill -f "node.*generate-content"').catch(() => {});
            
            // Clear queue
            pipelineStore.queue = [];
            
            // Update all running jobs
            pipelineStore.jobs.forEach((job) => {
                if (job.status === 'running') {
                    job.status = 'stopped';
                    job.error = 'Emergency stop executed';
                }
            });
        }
        
        pipelineStore.status = 'stopped';
        broadcast('pipeline-status', {
            state: 'error',
            message: 'Pipeline stopped'
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pipeline/phase/:phase', async (req, res) => {
    try {
        const { phase } = req.params;
        
        // Create phase-specific job
        const jobId = `${phase}-${Date.now()}`;
        const job = {
            id: jobId,
            phase,
            status: 'running',
            started: new Date().toISOString()
        };
        
        pipelineStore.jobs.set(jobId, job);
        
        // Run specific phase
        runPhase(jobId, phase);
        
        res.json({ success: true, jobId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch mode
app.post('/api/pipeline/batch', async (req, res) => {
    try {
        const { count, parallel, topicMode, delay } = req.body;
        
        const jobIds = [];
        for (let i = 0; i < count; i++) {
            const jobId = `batch-${Date.now()}-${i}`;
            const job = {
                id: jobId,
                mode: 'batch',
                batchIndex: i,
                status: 'queued',
                created: new Date().toISOString()
            };
            
            pipelineStore.jobs.set(jobId, job);
            pipelineStore.queue.push(jobId);
            jobIds.push(jobId);
        }
        
        // Start batch processor
        processBatchQueue(parallel, delay);
        
        res.json({ success: true, jobIds });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Queue management
app.get('/api/queue', (req, res) => {
    const jobs = pipelineStore.queue.map(jobId => {
        const job = pipelineStore.jobs.get(jobId);
        return {
            id: jobId,
            topic: job.topic || 'Pending',
            status: job.status,
            progress: calculateProgress(job),
            started: job.started,
            duration: job.duration
        };
    });
    
    res.json({ jobs });
});

app.post('/api/queue/clear', (req, res) => {
    pipelineStore.queue = pipelineStore.queue.filter(jobId => {
        const job = pipelineStore.jobs.get(jobId);
        return job && job.status === 'running';
    });
    
    res.json({ success: true });
});

app.post('/api/queue/pause', (req, res) => {
    pipelineStore.status = 'paused';
    broadcast('pipeline-status', {
        state: 'warning',
        message: 'Pipeline paused'
    });
    
    res.json({ success: true });
});

// Job management
app.get('/api/jobs/:jobId', (req, res) => {
    const job = pipelineStore.jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
});

app.post('/api/jobs/:jobId/cancel', (req, res) => {
    const job = pipelineStore.jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    
    job.status = 'cancelled';
    job.cancelled = new Date().toISOString();
    
    // Remove from queue
    pipelineStore.queue = pipelineStore.queue.filter(id => id !== req.params.jobId);
    
    res.json({ success: true });
});

// Performance data
app.get('/api/performance', (req, res) => {
    const recentRuns = pipelineStore.stats.totalRuns.slice(-50);
    
    const data = {
        labels: recentRuns.map((run, i) => `Run ${i + 1}`),
        durations: recentRuns.map(run => run.duration),
        costs: recentRuns.map(run => run.cost)
    };
    
    res.json(data);
});

// API key testing
app.post('/api/test-key', async (req, res) => {
    const { service, key } = req.body;
    
    try {
        // Simulate API key testing
        const valid = await testAPIKey(service, key);
        res.json({ success: valid, service });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Schedule management
app.get('/api/schedules', (req, res) => {
    res.json(pipelineStore.schedules);
});

app.post('/api/schedules', (req, res) => {
    const schedule = req.body;
    pipelineStore.schedules.push(schedule);
    res.json({ success: true, id: schedule.id });
});

// History
app.get('/api/history', async (req, res) => {
    try {
        // Read from build/reports directory
        const reports = await fs.readdir('build/reports').catch(() => []);
        const history = await Promise.all(
            reports
                .filter(file => file.endsWith('.json'))
                .slice(-20)
                .map(async (file) => {
                    const content = await fs.readFile(path.join('build/reports', file), 'utf8');
                    return JSON.parse(content);
                })
        );
        
        res.json(history);
    } catch (error) {
        res.json([]);
    }
});

// Optimizer endpoint - triggers title/meta optimization after 7 days
app.post('/api/optimizer/run', async (req, res) => {
    try {
        const { ebookDir, force = false } = req.body;
        
        if (!ebookDir) {
            return res.status(400).json({ error: 'ebookDir is required' });
        }
        
        const jobId = `optimize-${Date.now()}`;
        const job = {
            id: jobId,
            type: 'optimization',
            ebookDir,
            status: 'running',
            started: new Date().toISOString()
        };
        
        pipelineStore.jobs.set(jobId, job);
        
        // Run optimizer agent
        const command = force 
            ? `node agents/optimizer.js --ebook-dir="${ebookDir}" --days-old=0`
            : `node agents/optimizer.js --ebook-dir="${ebookDir}"`;
        
        execAsync(command)
            .then(({ stdout }) => {
                job.status = 'completed';
                job.output = stdout;
                job.completed = new Date().toISOString();
                
                broadcast('job-update', {
                    jobId,
                    status: 'completed',
                    message: 'Optimization complete'
                });
            })
            .catch((error) => {
                job.status = 'failed';
                job.error = error.message;
                
                broadcast('job-update', {
                    jobId,
                    status: 'failed',
                    message: 'Optimization failed'
                });
            });
        
        res.json({ success: true, jobId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buffer flush endpoint - processes queued topics immediately
app.post('/api/buffer/flush', async (req, res) => {
    try {
        const { limit = 10 } = req.body;
        
        // Get topics from buffer (could be Redis in production)
        const topics = pipelineStore.queue
            .filter(jobId => {
                const job = pipelineStore.jobs.get(jobId);
                return job && job.status === 'queued' && job.topic;
            })
            .slice(0, limit)
            .map(jobId => {
                const job = pipelineStore.jobs.get(jobId);
                return job.topic;
            });
        
        if (topics.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No topics in buffer',
                processed: 0 
            });
        }
        
        // Process each topic
        const results = [];
        for (const topic of topics) {
            const jobId = `flush-${Date.now()}-${topics.indexOf(topic)}`;
            const job = {
                id: jobId,
                mode: 'buffer-flush',
                topic,
                status: 'queued',
                created: new Date().toISOString()
            };
            
            pipelineStore.jobs.set(jobId, job);
            results.push(jobId);
            
            // Start pipeline for this topic
            startPipeline(jobId, 'full');
        }
        
        res.json({ 
            success: true, 
            processed: topics.length,
            topics,
            jobIds: results
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deployment status endpoint
app.get('/api/deployment/status', async (req, res) => {
    try {
        const HostingerDeploy = require('../agents/hostinger-deploy');
        const deployer = new HostingerDeploy();
        const status = await deployer.getDeploymentStatus();
        
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Deploy to Hostinger endpoint
app.post('/api/deployment/deploy', async (req, res) => {
    try {
        const { ebookDir, skipDNS = false, force = false } = req.body;
        
        if (!ebookDir) {
            return res.status(400).json({ error: 'ebookDir is required' });
        }
        
        const jobId = `deploy-${Date.now()}`;
        const job = {
            id: jobId,
            type: 'deployment',
            ebookDir,
            status: 'running',
            started: new Date().toISOString()
        };
        
        pipelineStore.jobs.set(jobId, job);
        
        broadcast('deployment-status', {
            jobId,
            status: 'starting',
            message: 'Initiating deployment'
        });
        
        // Run deployment
        const HostingerDeploy = require('../agents/hostinger-deploy');
        const deployer = new HostingerDeploy();
        
        deployer.deploy(ebookDir, { skipDNS, force })
            .then((result) => {
                job.status = 'completed';
                job.result = result;
                job.completed = new Date().toISOString();
                
                broadcast('deployment-status', {
                    jobId,
                    status: 'completed',
                    result,
                    message: 'Deployment successful'
                });
            })
            .catch((error) => {
                job.status = 'failed';
                job.error = error.message;
                
                broadcast('deployment-status', {
                    jobId,
                    status: 'failed',
                    error: error.message,
                    message: 'Deployment failed'
                });
            });
        
        res.json({ success: true, jobId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Topic buffer management
app.get('/api/buffer/topics', (req, res) => {
    // In production, this would fetch from Redis
    const topics = pipelineStore.queue
        .map(jobId => pipelineStore.jobs.get(jobId))
        .filter(job => job && job.topic)
        .map(job => ({
            topic: job.topic,
            added: job.created,
            status: job.status
        }));
    
    res.json({ topics, count: topics.length });
});

app.post('/api/buffer/add', (req, res) => {
    const { topic } = req.body;
    
    if (!topic) {
        return res.status(400).json({ error: 'topic is required' });
    }
    
    const jobId = `buffer-${Date.now()}`;
    const job = {
        id: jobId,
        topic,
        status: 'queued',
        created: new Date().toISOString()
    };
    
    pipelineStore.jobs.set(jobId, job);
    pipelineStore.queue.push(jobId);
    
    res.json({ success: true, jobId, position: pipelineStore.queue.length });
});

// Helper functions

async function startPipeline(jobId, mode) {
    const job = pipelineStore.jobs.get(jobId);
    job.status = 'running';
    
    broadcast('pipeline-status', {
        state: 'running',
        message: 'Pipeline running'
    });
    
    try {
        // Execute automation pipeline
        const { stdout, stderr } = await execAsync('node scripts/automation-pipeline.js');
        
        job.status = 'completed';
        job.output = stdout;
        job.completed = new Date().toISOString();
        job.duration = Math.round((Date.now() - new Date(job.started)) / 1000 / 60);
        
        // Update stats
        pipelineStore.stats.successCount++;
        pipelineStore.stats.totalRuns.push({
            duration: job.duration,
            cost: Math.random() * 5 + 10 // Simulated cost
        });
        updateAverageTime();
        
        broadcast('pipeline-status', {
            state: 'success',
            message: 'Pipeline completed'
        });
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        pipelineStore.stats.failedCount++;
        
        broadcast('pipeline-status', {
            state: 'error',
            message: 'Pipeline failed'
        });
    }
    
    // Remove from queue
    pipelineStore.queue = pipelineStore.queue.filter(id => id !== jobId);
}

async function runPhase(jobId, phase) {
    const job = pipelineStore.jobs.get(jobId);
    
    broadcast('phase-update', {
        phase,
        status: 'running'
    });
    
    try {
        // Map phase to script
        const phaseScripts = {
            'research': 'scripts/research-topics.js',
            'deep-research': 'agents/deep-research.js',
            'content': 'scripts/generate-content.js',
            'images': 'scripts/create-cover.js',
            'qa': 'scripts/qa-ultra-simple.js',
            'publish': 'scripts/publish-ebook.js'
        };
        
        const script = phaseScripts[phase];
        if (script) {
            await execAsync(`node ${script}`);
        }
        
        job.status = 'completed';
        
        broadcast('phase-update', {
            phase,
            status: 'completed'
        });
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        
        broadcast('phase-update', {
            phase,
            status: 'error'
        });
    }
}

async function processBatchQueue(parallel, delay) {
    const running = new Set();
    
    while (pipelineStore.queue.length > 0 || running.size > 0) {
        // Start new jobs if under parallel limit
        while (running.size < parallel && pipelineStore.queue.length > 0) {
            const jobId = pipelineStore.queue.shift();
            running.add(jobId);
            
            startPipeline(jobId, 'batch').then(() => {
                running.delete(jobId);
            });
            
            // Delay between starts
            if (delay > 0) {
                await new Promise(resolve => setTimeout(resolve, delay * 1000));
            }
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function calculateProgress(job) {
    if (!job.phases) return 0;
    
    const phases = ['research', 'deep-research', 'content', 'images', 'qa', 'publish'];
    const completed = phases.filter(phase => 
        job.phases[phase] && job.phases[phase].status === 'completed'
    ).length;
    
    return Math.round((completed / phases.length) * 100);
}

function updateAverageTime() {
    const runs = pipelineStore.stats.totalRuns;
    if (runs.length === 0) return;
    
    const totalTime = runs.reduce((sum, run) => sum + run.duration, 0);
    pipelineStore.stats.avgTime = Math.round(totalTime / runs.length);
    
    const totalCost = runs.reduce((sum, run) => sum + run.cost, 0);
    pipelineStore.stats.apiCost = totalCost;
}

async function testAPIKey(service, key) {
    // Simulate API key validation
    // In production, this would make actual API calls
    return key && key.length > 10;
}

function saveConfiguration(config) {
    // Save configuration to file
    fs.writeFile(
        path.join(__dirname, 'config.json'),
        JSON.stringify(config, null, 2)
    ).catch(console.error);
}

// Add log entry
function addLog(level, message) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message
    };
    
    pipelineStore.logs.unshift(entry);
    if (pipelineStore.logs.length > 1000) {
        pipelineStore.logs = pipelineStore.logs.slice(0, 1000);
    }
    
    broadcast('log-entry', entry);
}

// Simulate API usage updates
setInterval(() => {
    // Simulate API usage
    Object.keys(pipelineStore.apiUsage).forEach(service => {
        const usage = pipelineStore.apiUsage[service];
        if (Math.random() > 0.7 && usage.used < usage.limit) {
            usage.used += Math.floor(Math.random() * 5) + 1;
        }
    });
    
    broadcast('api-usage', pipelineStore.apiUsage);
}, 10000);

// Demo mode - simulate activity
if (process.env.DEMO_MODE === 'true') {
    setInterval(() => {
        // Simulate random log entries
        const levels = ['info', 'warning', 'error'];
        const messages = [
            'Pipeline phase completed',
            'API call successful',
            'Cache hit for topic research',
            'Rate limit warning',
            'Retry attempt 2/3',
            'Job added to queue'
        ];
        
        const level = levels[Math.floor(Math.random() * levels.length)];
        const message = messages[Math.floor(Math.random() * messages.length)];
        addLog(level, message);
    }, 5000);
}

// Server startup
const server = app.listen(PORT, () => {
    console.log(`🎛️  Control Panel server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    wss.clients.forEach(client => client.close());
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});