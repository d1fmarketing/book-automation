/**
 * Queue Manager
 * 
 * Central management for all job queues using BullMQ
 * Handles job creation, monitoring, and lifecycle management
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const EventEmitter = require('events');
const { getDeadLetterQueue } = require('./DeadLetterQueue');

class QueueManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD,
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                ...options.redis
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: {
                    age: 24 * 3600, // 24 hours
                    count: 1000
                },
                removeOnFail: false, // Manter jobs falhos para debug
                // TIMEOUT FIX: Timeouts apropriados por tipo de job
                stalledInterval: 30000, // 30 seconds
                timeout: 300000, // 5 minutos default (pipeline completo)
                ...options.defaultJobOptions
            },
            queues: {
                pipeline: { 
                    concurrency: 1,
                    defaultJobOptions: { timeout: 300000 } // 5 min para pipeline completo
                },
                research: { 
                    concurrency: 2,
                    defaultJobOptions: { timeout: 60000 } // 1 min por pesquisa
                },
                writer: { 
                    concurrency: 4,
                    defaultJobOptions: { timeout: 90000 } // 1.5 min por capítulo
                },
                formatter: { 
                    concurrency: 2,
                    defaultJobOptions: { timeout: 30000 } // 30s para formatar
                },
                qa: { 
                    concurrency: 2,
                    defaultJobOptions: { timeout: 30000 } // 30s para QA
                },
                refurbish: {
                    concurrency: 1,
                    defaultJobOptions: { timeout: 600000 } // 10 min para refurbish completo
                },
                ...options.queues
            }
        };
        
        this.connection = null;
        this.queues = {};
        this.workers = {};
        this.events = {};
        this.dlq = null;
        this.metrics = {
            processed: 0,
            failed: 0,
            active: 0,
            waiting: 0,
            delayed: 0,
            deadLetter: 0
        };
    }

    async connect() {
        console.log('🔌 Connecting to Redis...');
        
        try {
            // Create Redis connection
            this.connection = new Redis(this.options.redis);
            
            await this.connection.ping();
            console.log('✅ Redis connected');
            
            // Initialize queues
            await this.initializeQueues();
            
            // Initialize Dead Letter Queue
            this.dlq = getDeadLetterQueue({
                connection: this.options.redis
            });
            
            // Set up global event monitoring
            this.setupGlobalEvents();
            
            return true;
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            throw error;
        }
    }

    async initializeQueues() {
        for (const [name, config] of Object.entries(this.options.queues)) {
            await this.createQueue(name, config);
        }
    }

    async createQueue(name, config = {}) {
        if (this.queues[name]) {
            console.warn(`⚠️  Queue "${name}" already exists`);
            return this.queues[name];
        }
        
        console.log(`📦 Creating queue: ${name}`);
        
        // Create queue
        const queue = new Queue(name, {
            connection: this.connection.duplicate(),
            defaultJobOptions: {
                ...this.options.defaultJobOptions,
                ...config.defaultJobOptions
            }
        });
        
        // Create queue events listener
        const queueEvents = new QueueEvents(name, {
            connection: this.connection.duplicate()
        });
        
        // Store references
        this.queues[name] = queue;
        this.events[name] = queueEvents;
        
        // Set up queue-specific events
        this.setupQueueEvents(name, queueEvents);
        
        return queue;
    }

    setupQueueEvents(queueName, queueEvents) {
        queueEvents.on('completed', ({ jobId, returnvalue }) => {
            this.metrics.processed++;
            this.emit('job:completed', { queue: queueName, jobId, result: returnvalue });
            console.log(`✅ [${queueName}] Job ${jobId} completed`);
        });
        
        queueEvents.on('failed', async ({ jobId, failedReason }) => {
            this.metrics.failed++;
            this.emit('job:failed', { queue: queueName, jobId, error: failedReason });
            console.error(`❌ [${queueName}] Job ${jobId} failed: ${failedReason}`);
            
            // Check if job should go to DLQ
            try {
                const job = await this.queues[queueName].getJob(jobId);
                if (job && job.attemptsMade >= (job.opts.attempts || this.options.defaultJobOptions.attempts)) {
                    // Move to DLQ after max attempts
                    await this.dlq.moveToDeadLetter(job, new Error(failedReason), queueName);
                    this.metrics.deadLetter++;
                }
            } catch (dlqError) {
                console.error(`Failed to move job to DLQ:`, dlqError);
            }
        });
        
        queueEvents.on('active', ({ jobId, prev }) => {
            this.metrics.active++;
            this.emit('job:active', { queue: queueName, jobId });
            console.log(`⚡ [${queueName}] Job ${jobId} started`);
        });
        
        queueEvents.on('progress', ({ jobId, data }) => {
            this.emit('job:progress', { queue: queueName, jobId, progress: data });
        });
    }

    setupGlobalEvents() {
        // Monitor overall queue health
        setInterval(async () => {
            const stats = await this.getGlobalStats();
            this.emit('stats:update', stats);
        }, 5000);
    }

    /**
     * Add a job to a queue
     */
    async addJob(queueName, jobName, data, options = {}) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        const job = await queue.add(jobName, data, {
            ...options,
            // Add correlation ID for tracing
            jobId: options.jobId || `${queueName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        });
        
        console.log(`➕ Added job ${job.id} to ${queueName}`);
        return job;
    }

    /**
     * Add multiple jobs in bulk
     */
    async addBulkJobs(queueName, jobs) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        const jobsToAdd = jobs.map(job => ({
            name: job.name,
            data: job.data,
            opts: {
                ...this.options.defaultJobOptions,
                ...job.options
            }
        }));
        
        const results = await queue.addBulk(jobsToAdd);
        console.log(`➕ Added ${results.length} jobs to ${queueName}`);
        return results;
    }

    /**
     * Create a flow (job with dependencies)
     */
    async addFlow(flow) {
        const { name, steps, options = {} } = flow;
        
        // Convert steps to BullMQ flow format
        const flowSteps = steps.map(step => ({
            name: step.name,
            data: step.data,
            queueName: step.queue || 'pipeline',
            opts: {
                ...this.options.defaultJobOptions,
                ...step.options
            },
            children: step.children ? step.children.map(child => this.addFlow(child)) : []
        }));
        
        // Add to pipeline queue as a flow
        const queue = this.queues.pipeline;
        const job = await queue.add(name, { flow: flowSteps }, {
            ...options,
            delay: 0
        });
        
        console.log(`🌊 Added flow ${name} with ${steps.length} steps`);
        return job;
    }

    /**
     * Pause a queue
     */
    async pauseQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        await queue.pause();
        console.log(`⏸️  Paused queue: ${queueName}`);
    }

    /**
     * Resume a queue
     */
    async resumeQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        await queue.resume();
        console.log(`▶️  Resumed queue: ${queueName}`);
    }

    /**
     * Get a specific queue instance
     */
    getQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        return queue;
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount()
        ]);
        
        return {
            name: queueName,
            waiting,
            active,
            completed,
            failed,
            delayed,
            isPaused: await queue.isPaused()
        };
    }

    /**
     * Get global statistics
     */
    async getGlobalStats() {
        const stats = {};
        
        for (const queueName of Object.keys(this.queues)) {
            stats[queueName] = await this.getQueueStats(queueName);
        }
        
        return {
            queues: stats,
            global: {
                processed: this.metrics.processed,
                failed: this.metrics.failed,
                active: Object.values(stats).reduce((sum, q) => sum + q.active, 0),
                waiting: Object.values(stats).reduce((sum, q) => sum + q.waiting, 0),
                delayed: Object.values(stats).reduce((sum, q) => sum + q.delayed, 0)
            }
        };
    }

    /**
     * Clean completed jobs
     */
    async cleanJobs(queueName, grace = 0, limit = 100, status = 'completed') {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        const jobs = await queue.clean(grace, limit, status);
        console.log(`🧹 Cleaned ${jobs.length} ${status} jobs from ${queueName}`);
        return jobs;
    }

    /**
     * Drain a queue (remove all jobs)
     */
    async drainQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue "${queueName}" not found`);
        }
        
        await queue.drain();
        console.log(`🚰 Drained queue: ${queueName}`);
    }

    /**
     * Get stats (alias for getGlobalStats)
     */
    async getStats() {
        return this.getGlobalStats();
    }

    /**
     * Get worker statistics
     */
    async getWorkerStats() {
        // TODO: Implement when WorkerPool is available
        return {
            pipeline: { count: 1, active: 0 },
            research: { count: 2, active: 0 },
            writer: { count: 4, active: 0 },
            formatter: { count: 2, active: 0 },
            qa: { count: 2, active: 0 }
        };
    }

    /**
     * Get all failed jobs
     */
    async getFailedJobs() {
        const failed = [];
        
        for (const [queueName, queue] of Object.entries(this.queues)) {
            const jobs = await queue.getFailed();
            
            for (const job of jobs) {
                failed.push({
                    queue: queueName,
                    id: job.id,
                    name: job.name,
                    data: job.data,
                    failedReason: job.failedReason,
                    attemptsMade: job.attemptsMade,
                    timestamp: job.timestamp,
                    finishedOn: job.finishedOn
                });
            }
        }
        
        return failed;
    }

    /**
     * Retry a specific job
     */
    async retryJob(queueName, jobId) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found in queue ${queueName}`);
        }
        
        // Retry the job
        await job.retry();
        
        this.emit('job:retry', {
            queue: queueName,
            jobId: jobId
        });
        
        return { success: true, jobId };
    }

    /**
     * Clear all failed jobs
     */
    async clearFailedJobs() {
        for (const [queueName, queue] of Object.entries(this.queues)) {
            await queue.clean(0, 'failed');
        }
        
        this.emit('failed:cleared');
        return { success: true };
    }

    /**
     * Start a new pipeline
     */
    async startPipeline(topic, options = {}) {
        const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create pipeline job
        const job = await this.addJob('pipeline', 'start-pipeline', {
            pipelineId,
            topic,
            chapters: options.chapters || 10,
            style: options.style || 'business',
            ...options
        });
        
        this.emit('pipeline:started', {
            pipelineId,
            topic,
            jobId: job.id
        });
        
        return pipelineId;
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down queue manager...');
        
        // Close all workers
        for (const worker of Object.values(this.workers)) {
            await worker.close();
        }
        
        // Close all queue events
        for (const events of Object.values(this.events)) {
            await events.close();
        }
        
        // Close all queues
        for (const queue of Object.values(this.queues)) {
            await queue.close();
        }
        
        // Close Redis connection
        if (this.connection) {
            await this.connection.quit();
        }
        
        console.log('✅ Queue manager shutdown complete');
    }

    /**
     * Create a worker for a queue
     */
    createWorker(queueName, processor, options = {}) {
        const config = this.options.queues[queueName] || {};
        
        const worker = new Worker(
            queueName,
            processor,
            {
                connection: this.connection.duplicate(),
                concurrency: config.concurrency || 1,
                ...options
            }
        );
        
        // Set up worker events
        worker.on('completed', (job) => {
            console.log(`✅ [${queueName}] Worker completed job ${job.id}`);
        });
        
        worker.on('failed', (job, error) => {
            console.error(`❌ [${queueName}] Worker failed job ${job.id}:`, error.message);
        });
        
        worker.on('error', (error) => {
            console.error(`💥 [${queueName}] Worker error:`, error);
        });
        
        this.workers[queueName] = worker;
        console.log(`👷 Created worker for ${queueName} (concurrency: ${worker.concurrency})`);
        
        return worker;
    }
}

// Singleton instance
let instance;

function getQueueManager(options) {
    if (!instance) {
        instance = new QueueManager(options);
    }
    return instance;
}

module.exports = {
    QueueManager,
    getQueueManager
};