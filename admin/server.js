#!/usr/bin/env node

/**
 * Admin Dashboard Backend
 * Porta 4000 - API REST + WebSocket
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Importar serviços existentes
const { getQueueManager } = require('../src/queue/QueueManager');
const { getMetricsCollector } = require('../src/monitoring/MetricsCollector');
const { getRateLimiter } = require('../src/middleware/RateLimiter');
const { getBackupManager } = require('../src/backup/BackupManager');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configurações
const PORT = process.env.ADMIN_PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-prod';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Auth middleware
const authMiddleware = require('./middleware/auth');

// Serviços
let queueManager;
let metricsCollector;
let rateLimiter;
let backupManager;

// WebSocket clients
const wsClients = new Set();

// Inicializar serviços
async function initServices() {
    console.log('🚀 Inicializando serviços admin...');
    
    queueManager = getQueueManager();
    metricsCollector = getMetricsCollector();
    rateLimiter = getRateLimiter();
    backupManager = getBackupManager();
    
    // Conectar o QueueManager ao Redis
    await queueManager.connect();
    
    // Hook nos eventos do QueueManager para WebSocket
    setupQueueHooks();
    
    console.log('✅ Serviços prontos');
}

// Hook nos eventos da queue para emitir via WebSocket
function setupQueueHooks() {
    // Job events
    queueManager.on('job:created', (data) => {
        io.emit('job:created', data);
        io.emit('log', `[QUEUE] Job criado: ${data.queue} - ${data.jobId}`);
    });
    
    queueManager.on('job:completed', (data) => {
        io.emit('job:completed', data);
        io.emit('log', `[QUEUE] ✅ Job completado: ${data.queue} - ${data.jobId}`);
    });
    
    queueManager.on('job:failed', (data) => {
        io.emit('job:failed', data);
        io.emit('error', data);
        io.emit('log', `[QUEUE] ❌ Job falhou: ${data.queue} - ${data.jobId} - ${data.error}`);
    });
    
    // Pipeline events
    queueManager.on('pipeline:started', (data) => {
        io.emit('pipeline:started', data);
        io.emit('log', `[PIPELINE] Iniciado: ${data.topic}`);
    });
    
    queueManager.on('pipeline:completed', (data) => {
        io.emit('pipeline:completed', data);
        io.emit('log', `[PIPELINE] ✅ Completado: ${data.topic}`);
        
        // Emitir path do ebook se disponível
        if (data.ebookPath) {
            io.emit('ebook', data.ebookPath);
        }
    });
    
    queueManager.on('pipeline:failed', (data) => {
        io.emit('pipeline:failed', data);
        io.emit('error', { type: 'pipeline', ...data });
        io.emit('log', `[PIPELINE] ❌ Falhou: ${data.topic} - ${data.error}`);
    });
}

// ===== ROTAS API =====

// Status geral
app.get('/api/status', async (req, res) => {
    try {
        const queueStats = await queueManager.getStats();
        const workerStats = await queueManager.getWorkerStats();
        const rateStatus = rateLimiter.getAllStatus();
        
        res.json({
            status: 'online',
            timestamp: new Date().toISOString(),
            queues: queueStats,
            workers: workerStats,
            rateLimits: rateStatus,
            connections: wsClients.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rodar pipeline
app.post('/api/pipeline/run', async (req, res) => {
    try {
        const { topic, options = {} } = req.body;
        
        if (!topic) {
            return res.status(400).json({ error: 'Topic é obrigatório' });
        }
        
        // Opções para teste rápido
        const testOptions = {
            chapters: options.chapters || 1, // Default 1 capítulo para teste
            timeout: 30000, // 30 segundos
            ...options
        };
        
        const pipelineId = await queueManager.startPipeline(topic, testOptions);
        
        io.emit('log', `[API] Pipeline iniciado: ${topic} (${pipelineId})`);
        
        res.json({
            success: true,
            pipelineId,
            topic,
            options: testOptions
        });
        
    } catch (error) {
        io.emit('error', { type: 'api', error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// Listar jobs com falha
app.get('/api/jobs/failed', async (req, res) => {
    try {
        const failed = await queueManager.getFailedJobs();
        res.json(failed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Retry job específico
app.post('/api/jobs/:id/retry', async (req, res) => {
    try {
        const { id } = req.params;
        const { queue } = req.body;
        
        const result = await queueManager.retryJob(queue, id);
        
        io.emit('log', `[API] Retry job: ${queue}/${id}`);
        
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Escalar workers
app.post('/api/workers/scale', async (req, res) => {
    try {
        const { queue, count } = req.body;
        
        // TODO: Implementar scale no WorkerPool
        io.emit('log', `[API] Scale workers: ${queue} -> ${count}`);
        
        res.json({ 
            success: true, 
            message: `Workers ${queue} escalados para ${count}` 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Métricas Prometheus
app.get('/metrics', async (req, res) => {
    try {
        const metrics = await metricsCollector.getPrometheusMetrics();
        res.set('Content-Type', 'text/plain');
        res.send(metrics);
    } catch (error) {
        res.status(500).send('Error collecting metrics');
    }
});

// Login simples (para dev)
app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    
    // Em prod, usar bcrypt e DB
    if (password === process.env.ADMIN_PASSWORD || password === 'admin123') {
        const token = jwt.sign(
            { user: 'admin', role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Senha inválida' });
    }
});

// Upload file endpoint
const multer = require('multer');
const fs = require('fs').promises;
const upload = multer({ 
    dest: 'uploads/temp/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const { type } = req.body;
        const targetDir = type === 'image' ? 'assets/images/' : 'chapters/';
        const targetPath = path.join(process.cwd(), targetDir, req.file.originalname);

        // Move file to target directory
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.rename(req.file.path, targetPath);

        io.emit('log', `[UPLOAD] File uploaded: ${req.file.originalname} to ${targetDir}`);

        res.json({
            success: true,
            path: targetPath,
            filename: req.file.originalname,
            size: req.file.size,
            type
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Refurbish queue endpoints
app.get('/api/queues/refurbish/stats', authMiddleware, async (req, res) => {
    try {
        const queue = queueManager.getQueue('refurbish');
        const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount()
        ]);

        const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10);
        
        // Calculate average processing time
        const completedJobs = jobs.filter(job => job.finishedOn);
        const avgProcessingTime = completedJobs.length > 0
            ? completedJobs.reduce((sum, job) => sum + (job.finishedOn - job.timestamp), 0) / completedJobs.length
            : 0;

        res.json({
            waiting,
            active,
            completed,
            failed,
            paused: await queue.isPaused(),
            avgProcessingTime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/queues/refurbish/pause', authMiddleware, async (req, res) => {
    try {
        const queue = queueManager.getQueue('refurbish');
        await queue.pause();
        io.emit('log', '[REFURBISH] Queue paused');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/queues/refurbish/resume', authMiddleware, async (req, res) => {
    try {
        const queue = queueManager.getQueue('refurbish');
        await queue.resume();
        io.emit('log', '[REFURBISH] Queue resumed');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/queues/refurbish/retry/:jobId', authMiddleware, async (req, res) => {
    try {
        const { jobId } = req.params;
        const queue = queueManager.getQueue('refurbish');
        const job = await queue.getJob(jobId);
        
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        await job.retry();
        io.emit('log', `[REFURBISH] Job ${jobId} retried`);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== WEBSOCKET =====

io.on('connection', (socket) => {
    console.log('👤 Cliente conectado:', socket.id);
    wsClients.add(socket);
    
    // Enviar status inicial
    socket.emit('connected', { 
        id: socket.id,
        timestamp: new Date().toISOString()
    });
    
    socket.on('disconnect', () => {
        console.log('👤 Cliente desconectado:', socket.id);
        wsClients.delete(socket);
    });
    
    // Comandos via WebSocket
    socket.on('command', async (data) => {
        const { action, payload } = data;
        
        try {
            switch (action) {
                case 'get-stats':
                    const stats = await queueManager.getStats();
                    socket.emit('stats', stats);
                    break;
                    
                case 'clear-failed':
                    await queueManager.clearFailedJobs();
                    socket.emit('log', '[WS] Jobs com falha limpos');
                    break;
                    
                default:
                    socket.emit('error', { message: 'Comando desconhecido' });
            }
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
    
    // Refurbish queue events
    socket.on('get-refurbish-stats', async () => {
        try {
            const queue = queueManager.getQueue('refurbish');
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount()
            ]);

            const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 10);
            
            // Calculate average processing time
            const completedJobs = jobs.filter(job => job.finishedOn);
            const avgProcessingTime = completedJobs.length > 0
                ? completedJobs.reduce((sum, job) => sum + (job.finishedOn - job.timestamp), 0) / completedJobs.length
                : 0;

            socket.emit('refurbish-stats', {
                waiting,
                active,
                completed,
                failed,
                paused: await queue.isPaused(),
                avgProcessingTime
            });
            
            // Send recent jobs
            const recentJobs = jobs.map(job => ({
                id: job.id,
                bookPath: job.data.bookPath,
                operations: job.data.operations,
                status: job.getState(),
                createdAt: job.timestamp,
                completedAt: job.finishedOn,
                duration: job.finishedOn ? job.finishedOn - job.timestamp : null,
                error: job.failedReason,
                progress: job.progress
            }));
            
            recentJobs.forEach(job => {
                socket.emit('refurbish-job-update', job);
            });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
});

// ===== HELPERS =====

// Broadcast log para todos os clientes
function broadcastLog(message) {
    io.emit('log', `[${new Date().toISOString()}] ${message}`);
}

// Broadcast erro
function broadcastError(error) {
    io.emit('error', {
        timestamp: new Date().toISOString(),
        message: error.message || error,
        stack: error.stack
    });
}

// Exportar funções para uso em outros módulos
global.adminLog = broadcastLog;
global.adminError = broadcastError;

// ===== START SERVER =====

async function start() {
    try {
        await initServices();
        
        server.listen(PORT, () => {
            console.log(`🎛️ Admin Dashboard rodando em http://localhost:${PORT}`);
            console.log(`🔌 WebSocket pronto em ws://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Erro ao iniciar admin:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📛 Desligando admin server...');
    server.close(() => {
        console.log('✅ Admin server fechado');
        process.exit(0);
    });
});

// Iniciar
if (require.main === module) {
    start();
}

module.exports = { app, io };