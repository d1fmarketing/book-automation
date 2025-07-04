/**
 * Dead Letter Queue Handler
 * 
 * Manages failed jobs with recovery strategies
 * Provides inspection and retry capabilities
 */

const { Queue, Worker, QueueEvents } = require('bullmq');
const { getMetricsCollector } = require('../monitoring/MetricsCollector');
const { getCostTracker } = require('../cost/CostTracker');
const path = require('path');
const fs = require('fs').promises;

class DeadLetterQueue {
    constructor(options = {}) {
        this.options = {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            },
            maxRetries: 3,
            backoffDelay: 5000, // 5 seconds
            dlqPrefix: 'dlq:',
            failureThreshold: 5, // Move to DLQ after 5 failures
            retentionDays: 30,
            notifications: {
                enabled: true,
                webhookUrl: process.env.DLQ_WEBHOOK_URL,
                emailTo: process.env.DLQ_EMAIL_TO
            },
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.costTracker = getCostTracker();
        this.dlqQueues = new Map();
        this.dlqWorkers = new Map();
        this.failureAnalysis = new Map();
    }

    /**
     * Initialize DLQ for a queue
     */
    async initializeForQueue(queueName) {
        const dlqName = `${this.options.dlqPrefix}${queueName}`;
        
        // Create DLQ queue
        const dlq = new Queue(dlqName, {
            connection: this.options.connection,
            defaultJobOptions: {
                removeOnComplete: false,
                removeOnFail: false,
                attempts: 1 // DLQ jobs don't auto-retry
            }
        });
        
        this.dlqQueues.set(queueName, dlq);
        
        // Create DLQ worker for manual processing
        const worker = new Worker(
            dlqName,
            async (job) => this.processDLQJob(job, queueName),
            {
                connection: this.options.connection,
                autorun: false // Manual processing only
            }
        );
        
        this.dlqWorkers.set(queueName, worker);
        
        console.log(`🏴 DLQ initialized for queue: ${queueName}`);
    }

    /**
     * Move failed job to DLQ
     */
    async moveToDeadLetter(job, error, originalQueue) {
        try {
            const dlqName = `${this.options.dlqPrefix}${originalQueue}`;
            let dlq = this.dlqQueues.get(originalQueue);
            
            if (!dlq) {
                await this.initializeForQueue(originalQueue);
                dlq = this.dlqQueues.get(originalQueue);
            }
            
            // Prepare DLQ job data
            const dlqJobData = {
                originalId: job.id,
                originalQueue,
                originalData: job.data,
                failureReason: error.message,
                failureStack: error.stack,
                attempts: job.attemptsMade,
                failedAt: new Date().toISOString(),
                processingHistory: await this.getJobHistory(job),
                cost: await this.calculateJobCost(job)
            };
            
            // Add to DLQ
            const dlqJob = await dlq.add('failed-job', dlqJobData, {
                delay: this.options.backoffDelay
            });
            
            // Record metrics
            this.metrics.recordJob(originalQueue, job.name, 'dead-letter');
            
            // Analyze failure pattern
            await this.analyzeFailure(originalQueue, error);
            
            // Send notifications if enabled
            await this.sendNotification({
                type: 'job-dead-letter',
                queue: originalQueue,
                jobId: job.id,
                error: error.message,
                dlqJobId: dlqJob.id
            });
            
            console.log(`☠️ Job ${job.id} moved to DLQ: ${dlqName}`);
            
            return dlqJob;
            
        } catch (dlqError) {
            console.error('Failed to move job to DLQ:', dlqError);
            this.metrics.recordError('dlq_move_failed', originalQueue);
            throw dlqError;
        }
    }

    /**
     * Process DLQ job (manual retry)
     */
    async processDLQJob(job, originalQueueName) {
        console.log(`🔄 Processing DLQ job ${job.id} from ${originalQueueName}`);
        
        try {
            // Get original queue
            const QueueManager = require('./QueueManager');
            const queueManager = QueueManager.getQueueManager();
            const originalQueue = queueManager.queues[originalQueueName];
            
            if (!originalQueue) {
                throw new Error(`Original queue ${originalQueueName} not found`);
            }
            
            // Create new job in original queue with special handling
            const newJob = await originalQueue.add(
                job.data.originalData.name || 'retry',
                {
                    ...job.data.originalData,
                    _dlqRetry: true,
                    _dlqJobId: job.id,
                    _retryCount: (job.data.originalData._retryCount || 0) + 1
                },
                {
                    attempts: this.options.maxRetries,
                    backoff: {
                        type: 'exponential',
                        delay: this.options.backoffDelay
                    }
                }
            );
            
            // Mark DLQ job as processed
            await job.updateData({
                ...job.data,
                retriedAt: new Date().toISOString(),
                newJobId: newJob.id,
                status: 'retried'
            });
            
            console.log(`✅ DLQ job ${job.id} retried as ${newJob.id}`);
            
            return {
                success: true,
                newJobId: newJob.id
            };
            
        } catch (error) {
            console.error(`Failed to process DLQ job ${job.id}:`, error);
            
            await job.updateData({
                ...job.data,
                lastRetryError: error.message,
                lastRetryAt: new Date().toISOString(),
                status: 'retry-failed'
            });
            
            throw error;
        }
    }

    /**
     * Get job processing history
     */
    async getJobHistory(job) {
        const history = [];
        
        // Get job logs if available
        const logs = await job.getQueueEvents();
        
        // Build history from attempts
        for (let i = 0; i < job.attemptsMade; i++) {
            history.push({
                attempt: i + 1,
                timestamp: job.processedOn + (i * this.options.backoffDelay),
                duration: job.duration || 'unknown',
                error: i === job.attemptsMade - 1 ? job.failedReason : 'retried'
            });
        }
        
        return history;
    }

    /**
     * Calculate job processing cost
     */
    async calculateJobCost(job) {
        // Estimate based on job type and attempts
        const costPerAttempt = {
            'deep-research': 0.10,
            'writer': 0.15,
            'illustrator': 0.08,
            'formatter-html': 0.02,
            'fact-checker': 0.05
        };
        
        const baseCost = costPerAttempt[job.name] || 0.05;
        const totalCost = baseCost * job.attemptsMade;
        
        return {
            estimated: totalCost,
            attempts: job.attemptsMade,
            perAttempt: baseCost
        };
    }

    /**
     * Analyze failure patterns
     */
    async analyzeFailure(queueName, error) {
        const key = `${queueName}:${error.code || 'UNKNOWN'}`;
        
        if (!this.failureAnalysis.has(key)) {
            this.failureAnalysis.set(key, {
                count: 0,
                firstSeen: new Date(),
                lastSeen: new Date(),
                examples: []
            });
        }
        
        const analysis = this.failureAnalysis.get(key);
        analysis.count++;
        analysis.lastSeen = new Date();
        
        if (analysis.examples.length < 5) {
            analysis.examples.push({
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join('\n'),
                timestamp: new Date()
            });
        }
        
        // Alert on recurring failures
        if (analysis.count > 10 && analysis.count % 10 === 0) {
            await this.sendNotification({
                type: 'recurring-failure',
                queue: queueName,
                errorCode: error.code,
                count: analysis.count,
                examples: analysis.examples
            });
        }
    }

    /**
     * Get DLQ statistics
     */
    async getStatistics() {
        const stats = {
            queues: {},
            totalJobs: 0,
            failurePatterns: [],
            estimatedCost: 0
        };
        
        for (const [queueName, dlq] of this.dlqQueues) {
            const counts = await dlq.getJobCounts();
            
            stats.queues[queueName] = {
                waiting: counts.waiting,
                active: counts.active,
                completed: counts.completed,
                failed: counts.failed,
                total: counts.waiting + counts.active + counts.completed + counts.failed
            };
            
            stats.totalJobs += stats.queues[queueName].total;
            
            // Get sample jobs for cost estimation
            const jobs = await dlq.getJobs(['waiting', 'completed', 'failed'], 0, 10);
            for (const job of jobs) {
                if (job.data.cost) {
                    stats.estimatedCost += job.data.cost.estimated || 0;
                }
            }
        }
        
        // Convert failure analysis to array
        stats.failurePatterns = Array.from(this.failureAnalysis.entries())
            .map(([key, value]) => ({ pattern: key, ...value }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        
        return stats;
    }

    /**
     * Get failed jobs for inspection
     */
    async getFailedJobs(queueName, options = {}) {
        const dlq = this.dlqQueues.get(queueName);
        if (!dlq) {
            throw new Error(`DLQ not found for queue: ${queueName}`);
        }
        
        const {
            start = 0,
            end = 20,
            order = 'desc'
        } = options;
        
        const jobs = await dlq.getJobs(['waiting', 'failed'], start, end);
        
        // Sort by failure time
        jobs.sort((a, b) => {
            const timeA = new Date(a.data.failedAt).getTime();
            const timeB = new Date(b.data.failedAt).getTime();
            return order === 'desc' ? timeB - timeA : timeA - timeB;
        });
        
        return jobs.map(job => ({
            id: job.id,
            originalId: job.data.originalId,
            queue: job.data.originalQueue,
            failedAt: job.data.failedAt,
            reason: job.data.failureReason,
            attempts: job.data.attempts,
            cost: job.data.cost,
            canRetry: job.data.status !== 'retry-failed',
            data: job.data.originalData
        }));
    }

    /**
     * Retry specific DLQ job
     */
    async retryJob(queueName, jobId) {
        const dlq = this.dlqQueues.get(queueName);
        if (!dlq) {
            throw new Error(`DLQ not found for queue: ${queueName}`);
        }
        
        const job = await dlq.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found in DLQ`);
        }
        
        // Process the job
        const worker = this.dlqWorkers.get(queueName);
        const result = await this.processDLQJob(job, queueName);
        
        // Remove from DLQ if successful
        if (result.success) {
            await job.remove();
        }
        
        return result;
    }

    /**
     * Retry all jobs in DLQ
     */
    async retryAll(queueName, options = {}) {
        const { batchSize = 10, delay = 1000 } = options;
        const dlq = this.dlqQueues.get(queueName);
        
        if (!dlq) {
            throw new Error(`DLQ not found for queue: ${queueName}`);
        }
        
        const jobs = await dlq.getJobs(['waiting', 'failed']);
        const results = {
            total: jobs.length,
            successful: 0,
            failed: 0,
            errors: []
        };
        
        // Process in batches
        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            
            const batchResults = await Promise.allSettled(
                batch.map(job => this.retryJob(queueName, job.id))
            );
            
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.successful++;
                } else {
                    results.failed++;
                    results.errors.push({
                        jobId: batch[index].id,
                        error: result.reason.message
                    });
                }
            });
            
            // Delay between batches
            if (i + batchSize < jobs.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return results;
    }

    /**
     * Clean old DLQ jobs
     */
    async cleanup(olderThanDays = null) {
        const retentionDays = olderThanDays || this.options.retentionDays;
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        let totalRemoved = 0;
        
        for (const [queueName, dlq] of this.dlqQueues) {
            const jobs = await dlq.getJobs(['completed', 'failed']);
            
            for (const job of jobs) {
                const failedAt = new Date(job.data.failedAt).getTime();
                if (failedAt < cutoffTime) {
                    await job.remove();
                    totalRemoved++;
                }
            }
        }
        
        console.log(`🧹 Removed ${totalRemoved} old DLQ jobs`);
        return totalRemoved;
    }

    /**
     * Send notification about DLQ events
     */
    async sendNotification(data) {
        if (!this.options.notifications.enabled) return;
        
        try {
            if (this.options.notifications.webhookUrl) {
                // Send webhook notification
                const axios = require('axios');
                await axios.post(this.options.notifications.webhookUrl, {
                    event: data.type,
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development',
                    ...data
                });
            }
            
            // Log critical events
            if (data.type === 'recurring-failure' || data.type === 'job-dead-letter') {
                console.error(`🚨 DLQ Alert: ${data.type} in queue ${data.queue}`);
            }
            
        } catch (error) {
            console.error('Failed to send DLQ notification:', error.message);
        }
    }

    /**
     * Export DLQ data for analysis
     */
    async exportData(options = {}) {
        const { format = 'json', includeJobData = false } = options;
        const stats = await this.getStatistics();
        const exportData = {
            timestamp: new Date().toISOString(),
            statistics: stats,
            jobs: {}
        };
        
        if (includeJobData) {
            for (const queueName of this.dlqQueues.keys()) {
                exportData.jobs[queueName] = await this.getFailedJobs(queueName, {
                    start: 0,
                    end: 1000
                });
            }
        }
        
        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            // Convert to CSV format
            let csv = 'Queue,Job ID,Failed At,Reason,Attempts,Cost\n';
            
            for (const [queue, jobs] of Object.entries(exportData.jobs)) {
                for (const job of jobs) {
                    csv += `${queue},${job.id},${job.failedAt},"${job.reason}",${job.attempts},${job.cost?.estimated || 0}\n`;
                }
            }
            
            return csv;
        }
        
        return exportData;
    }
}

// Singleton instance
let instance;

function getDeadLetterQueue(options) {
    if (!instance) {
        instance = new DeadLetterQueue(options);
    }
    return instance;
}

module.exports = {
    DeadLetterQueue,
    getDeadLetterQueue
};