/**
 * Worker Pool Manager
 * 
 * Manages multiple workers for different job types
 * Handles worker lifecycle and monitoring
 */

const { Worker } = require('bullmq');
const os = require('os');
const JobProcessor = require('./JobProcessor');

class WorkerPool {
    constructor(queueManager, options = {}) {
        this.queueManager = queueManager;
        this.options = {
            maxWorkers: os.cpus().length,
            workerConfig: {
                pipeline: { concurrency: 1, count: 1 },
                research: { concurrency: 1, count: 2 },
                writer: { concurrency: 2, count: 4 },
                formatter: { concurrency: 1, count: 2 },
                qa: { concurrency: 1, count: 2 }
            },
            ...options
        };
        
        this.workers = new Map();
        this.processors = JobProcessor.createProcessors();
        this.isRunning = false;
        this.workerIdCounter = 0;
    }

    /**
     * Start all workers
     */
    async start() {
        if (this.isRunning) {
            console.warn('⚠️  Worker pool already running');
            return;
        }
        
        console.log('🚀 Starting worker pool...');
        console.log(`🖥️  Max workers: ${this.options.maxWorkers}`);
        
        this.isRunning = true;
        
        // Create workers for each queue type
        for (const [queueName, config] of Object.entries(this.options.workerConfig)) {
            await this.createWorkers(queueName, config);
        }
        
        // Set up monitoring
        this.startMonitoring();
        
        console.log('✅ Worker pool started');
    }

    /**
     * Create workers for a specific queue
     */
    async createWorkers(queueName, config) {
        const { count = 1, concurrency = 1 } = config;
        const workers = [];
        
        console.log(`👷 Creating ${count} workers for ${queueName} (concurrency: ${concurrency})`);
        
        for (let i = 0; i < count; i++) {
            const worker = await this.createWorker(queueName, concurrency, i);
            workers.push(worker);
        }
        
        this.workers.set(queueName, workers);
    }

    /**
     * Create a single worker
     */
    async createWorker(queueName, concurrency, index) {
        const processor = this.processors[queueName];
        if (!processor) {
            throw new Error(`No processor found for queue: ${queueName}`);
        }
        
        // Wrap processor with timeout
        const timeoutProcessor = JobProcessor.createSandboxedProcessor(
            processor,
            this.options.timeout || 300000
        );
        
        // Create worker
        const worker = new Worker(
            queueName,
            timeoutProcessor,
            {
                connection: this.queueManager.connection.duplicate(),
                concurrency,
                name: `${queueName}-worker-${index}`,
                // Add rate limiting
                limiter: {
                    max: 100,
                    duration: 60000 // 100 jobs per minute
                }
            }
        );
        
        // Set up worker events
        this.setupWorkerEvents(worker, queueName, index);
        
        return worker;
    }

    /**
     * Set up event handlers for a worker
     */
    setupWorkerEvents(worker, queueName, index) {
        const workerName = `${queueName}-${index}`;
        
        worker.on('completed', (job) => {
            console.log(`✅ [${workerName}] Completed job ${job.id}`);
            this.queueManager.emit('worker:completed', {
                worker: workerName,
                job: job.id,
                queue: queueName
            });
        });
        
        worker.on('failed', (job, error) => {
            console.error(`❌ [${workerName}] Failed job ${job.id}:`, error.message);
            this.queueManager.emit('worker:failed', {
                worker: workerName,
                job: job.id,
                queue: queueName,
                error: error.message
            });
        });
        
        worker.on('error', (error) => {
            console.error(`💥 [${workerName}] Worker error:`, error);
            this.queueManager.emit('worker:error', {
                worker: workerName,
                queue: queueName,
                error: error.message
            });
        });
        
        worker.on('stalled', (jobId) => {
            console.warn(`⚠️  [${workerName}] Job ${jobId} stalled`);
            this.queueManager.emit('worker:stalled', {
                worker: workerName,
                job: jobId,
                queue: queueName
            });
        });
        
        worker.on('drained', () => {
            console.log(`🏁 [${workerName}] Queue drained`);
        });
    }

    /**
     * Start monitoring workers
     */
    startMonitoring() {
        // Monitor worker health every 30 seconds
        this.monitorInterval = setInterval(async () => {
            const stats = await this.getStats();
            this.queueManager.emit('workers:stats', stats);
            
            // Log if any workers are struggling
            for (const [queue, queueStats] of Object.entries(stats)) {
                if (queueStats.utilization > 90) {
                    console.warn(`⚠️  High load on ${queue} workers (${queueStats.utilization}%)`);
                }
            }
        }, 30000);
    }

    /**
     * Get worker statistics
     */
    async getStats() {
        const stats = {};
        
        for (const [queueName, workers] of this.workers.entries()) {
            const workerStats = await Promise.all(
                workers.map(async (worker) => ({
                    name: worker.name,
                    isRunning: !worker.closed,
                    isPaused: worker.isPaused(),
                    jobCount: await worker.getJobCounts()
                }))
            );
            
            const totalActive = workerStats.reduce(
                (sum, w) => sum + (w.jobCount?.active || 0),
                0
            );
            
            const totalCapacity = workers.reduce(
                (sum, w) => sum + w.concurrency,
                0
            );
            
            stats[queueName] = {
                workers: workerStats,
                totalWorkers: workers.length,
                activeJobs: totalActive,
                capacity: totalCapacity,
                utilization: Math.round((totalActive / totalCapacity) * 100)
            };
        }
        
        return stats;
    }

    /**
     * Pause all workers
     */
    async pause() {
        console.log('⏸️  Pausing all workers...');
        
        const promises = [];
        for (const workers of this.workers.values()) {
            for (const worker of workers) {
                promises.push(worker.pause());
            }
        }
        
        await Promise.all(promises);
        console.log('✅ All workers paused');
    }

    /**
     * Resume all workers
     */
    async resume() {
        console.log('▶️  Resuming all workers...');
        
        const promises = [];
        for (const workers of this.workers.values()) {
            for (const worker of workers) {
                promises.push(worker.resume());
            }
        }
        
        await Promise.all(promises);
        console.log('✅ All workers resumed');
    }

    /**
     * Scale workers for a specific queue
     */
    async scaleWorkers(queueName, newCount) {
        const workers = this.workers.get(queueName);
        if (!workers) {
            throw new Error(`No workers found for queue: ${queueName}`);
        }
        
        const currentCount = workers.length;
        const config = this.options.workerConfig[queueName];
        
        if (newCount > currentCount) {
            // Scale up
            console.log(`📈 Scaling up ${queueName} workers: ${currentCount} → ${newCount}`);
            
            for (let i = currentCount; i < newCount; i++) {
                const worker = await this.createWorker(
                    queueName,
                    config.concurrency,
                    i
                );
                workers.push(worker);
            }
        } else if (newCount < currentCount) {
            // Scale down
            console.log(`📉 Scaling down ${queueName} workers: ${currentCount} → ${newCount}`);
            
            const workersToRemove = workers.splice(newCount);
            for (const worker of workersToRemove) {
                await worker.close();
            }
        }
        
        // Update config
        config.count = newCount;
    }

    /**
     * Add a single worker to a queue
     */
    async addWorker(queueName) {
        const workers = this.workers.get(queueName);
        if (!workers) {
            throw new Error(`No workers found for queue: ${queueName}`);
        }
        
        const config = this.options.workerConfig[queueName];
        const newIndex = this.workerIdCounter++;
        
        const worker = await this.createWorker(
            queueName,
            config.concurrency,
            newIndex
        );
        
        workers.push(worker);
        config.count = workers.length;
        
        console.log(`➕ Added worker to ${queueName} (total: ${workers.length})`);
        return worker;
    }

    /**
     * Remove a worker from a queue
     */
    async removeWorker(queueName) {
        const workers = this.workers.get(queueName);
        if (!workers || workers.length === 0) {
            throw new Error(`No workers to remove for queue: ${queueName}`);
        }
        
        // Remove the last worker
        const worker = workers.pop();
        await worker.close();
        
        const config = this.options.workerConfig[queueName];
        config.count = workers.length;
        
        console.log(`➖ Removed worker from ${queueName} (remaining: ${workers.length})`);
    }

    /**
     * Get worker count for a queue
     */
    getWorkerCount(queueName) {
        const workers = this.workers.get(queueName);
        return workers ? workers.length : 0;
    }

    /**
     * Get worker utilization stats
     */
    getWorkerStats(queueName) {
        const workers = this.workers.get(queueName);
        if (!workers) {
            return { utilization: 0, activeJobs: 0, totalCapacity: 0 };
        }
        
        let activeJobs = 0;
        let totalCapacity = 0;
        
        workers.forEach(worker => {
            activeJobs += worker.activeJobs || 0;
            totalCapacity += worker.concurrency;
        });
        
        return {
            utilization: totalCapacity > 0 ? activeJobs / totalCapacity : 0,
            activeJobs,
            totalCapacity,
            workerCount: workers.length
        };
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down worker pool...');
        
        this.isRunning = false;
        
        // Clear monitoring
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        // Close all workers
        const promises = [];
        for (const workers of this.workers.values()) {
            for (const worker of workers) {
                promises.push(worker.close());
            }
        }
        
        await Promise.all(promises);
        
        this.workers.clear();
        
        console.log('✅ Worker pool shutdown complete');
    }

    /**
     * Handle crash recovery
     */
    async recoverWorker(queueName, workerIndex) {
        console.log(`🔧 Recovering crashed worker: ${queueName}-${workerIndex}`);
        
        const workers = this.workers.get(queueName);
        if (!workers || !workers[workerIndex]) {
            console.error(`Worker not found: ${queueName}-${workerIndex}`);
            return;
        }
        
        // Close the crashed worker
        try {
            await workers[workerIndex].close();
        } catch (error) {
            // Ignore errors when closing crashed worker
        }
        
        // Create a new worker
        const config = this.options.workerConfig[queueName];
        const newWorker = await this.createWorker(
            queueName,
            config.concurrency,
            workerIndex
        );
        
        // Replace in array
        workers[workerIndex] = newWorker;
        
        console.log(`✅ Worker recovered: ${queueName}-${workerIndex}`);
    }
}

module.exports = WorkerPool;