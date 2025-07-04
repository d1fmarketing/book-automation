/**
 * Optimized Worker
 * 
 * High-performance worker with caching and connection pooling
 */

const { Worker } = require('bullmq');
const { getSmartCache } = require('../cache/SmartCache');
const { getMetricsCollector } = require('../monitoring/MetricsCollector');
const CircuitBreaker = require('../../utils/circuit-breaker');

class OptimizedWorker {
    constructor(queueName, processor, options = {}) {
        this.queueName = queueName;
        this.processor = processor;
        this.options = {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                maxRetriesPerRequest: 3,
                enableReadyCheck: true,
                enableOfflineQueue: true
            },
            concurrency: 2,
            autorun: true,
            stalledInterval: 30000,
            maxStalledCount: 2,
            cacheConfig: {
                ttl: 3600, // 1 hour
                keyPrefix: `worker:${queueName}:`
            },
            circuitBreaker: {
                timeout: 30000,
                resetTimeout: 60000,
                errorThreshold: 5
            },
            ...options
        };
        
        this.cache = getSmartCache();
        this.metrics = getMetricsCollector();
        this.breaker = new CircuitBreaker(this.options.circuitBreaker);
        this.worker = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        // Initialize cache
        await this.cache.connect();
        
        // Create worker
        this.worker = new Worker(
            this.queueName,
            async (job) => this.processJob(job),
            {
                connection: this.options.connection,
                concurrency: this.options.concurrency,
                autorun: this.options.autorun,
                stalledInterval: this.options.stalledInterval,
                maxStalledCount: this.options.maxStalledCount
            }
        );
        
        // Set up event handlers
        this.setupEventHandlers();
        
        this.initialized = true;
        console.log(`✅ Optimized worker initialized for queue: ${this.queueName}`);
    }

    setupEventHandlers() {
        this.worker.on('completed', (job) => {
            const duration = Date.now() - job.processedOn;
            this.metrics.recordJob(this.queueName, job.name, 'completed', duration);
            console.log(`✅ Job ${job.id} completed in ${duration}ms`);
        });
        
        this.worker.on('failed', (job, err) => {
            this.metrics.recordJob(this.queueName, job.name, 'failed');
            this.metrics.recordError('job_failed', this.queueName);
            console.error(`❌ Job ${job.id} failed:`, err.message);
        });
        
        this.worker.on('stalled', (jobId) => {
            this.metrics.recordError('job_stalled', this.queueName);
            console.warn(`⚠️  Job ${jobId} stalled`);
        });
        
        this.worker.on('error', (err) => {
            this.metrics.recordError('worker_error', this.queueName);
            console.error(`💥 Worker error:`, err);
        });
    }

    async processJob(job) {
        const startTime = Date.now();
        
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(job);
            if (cacheKey && this.shouldCache(job)) {
                const cached = await this.cache.get(cacheKey);
                if (cached) {
                    console.log(`📦 Cache hit for job ${job.id}`);
                    return cached;
                }
            }
            
            // Process with circuit breaker
            const result = await this.breaker.fire(
                async () => {
                    // Add job context for better tracking
                    const context = {
                        jobId: job.id,
                        queue: this.queueName,
                        attempt: job.attemptsMade + 1,
                        startTime
                    };
                    
                    // Call the actual processor
                    return await this.processor(job, context);
                }
            );
            
            // Cache successful results
            if (cacheKey && this.shouldCache(job) && result) {
                await this.cache.set(cacheKey, result, {
                    ttl: this.getCacheTTL(job)
                });
            }
            
            // Update circuit breaker state in metrics
            this.metrics.updateCircuitBreakerState(
                this.queueName,
                this.breaker.state
            );
            
            return result;
            
        } catch (error) {
            // Handle specific error types
            if (error.code === 'RATE_LIMIT') {
                // Rate limit error - retry with backoff
                const delay = this.calculateBackoff(job.attemptsMade);
                throw new Error(`Rate limited. Retry in ${delay}ms`);
            }
            
            if (error.code === 'TIMEOUT') {
                // Timeout error - might need to split the job
                this.metrics.recordError('job_timeout', this.queueName);
            }
            
            throw error;
        }
    }

    getCacheKey(job) {
        // Generate cache key based on job data
        if (job.data.cacheKey) {
            return job.data.cacheKey;
        }
        
        // Default cache key strategy
        switch (job.name) {
            case 'deep-research':
                return `research:${job.data.topic}`;
            
            case 'writer':
                return `chapter:${job.data.outline?.title}:${job.data.chapterNumber}`;
            
            case 'illustrator':
                return `image:${job.data.chapterNumber}:${job.data.style}`;
            
            default:
                return null; // Don't cache by default
        }
    }

    shouldCache(job) {
        // Determine if job results should be cached
        if (job.data.noCache) return false;
        
        // Cache these job types
        const cacheableJobs = [
            'deep-research',
            'writer',
            'illustrator',
            'formatter-html'
        ];
        
        return cacheableJobs.includes(job.name);
    }

    getCacheTTL(job) {
        // Job-specific cache TTLs
        const ttlMap = {
            'deep-research': 86400, // 24 hours
            'writer': 3600, // 1 hour
            'illustrator': 86400, // 24 hours
            'formatter-html': 1800 // 30 minutes
        };
        
        return ttlMap[job.name] || this.options.cacheConfig.ttl;
    }

    calculateBackoff(attempt) {
        // Exponential backoff with jitter
        const base = 1000; // 1 second
        const max = 60000; // 1 minute
        const delay = Math.min(base * Math.pow(2, attempt), max);
        const jitter = Math.random() * 0.1 * delay; // 10% jitter
        return Math.floor(delay + jitter);
    }

    async pause() {
        if (this.worker) {
            await this.worker.pause();
            console.log(`⏸️  Worker paused: ${this.queueName}`);
        }
    }

    async resume() {
        if (this.worker) {
            await this.worker.resume();
            console.log(`▶️  Worker resumed: ${this.queueName}`);
        }
    }

    async close() {
        if (this.worker) {
            await this.worker.close();
            console.log(`🚪 Worker closed: ${this.queueName}`);
        }
    }

    getStatus() {
        return {
            queue: this.queueName,
            isRunning: this.worker?.isRunning() || false,
            isPaused: this.worker?.isPaused() || false,
            concurrency: this.options.concurrency,
            circuitBreaker: {
                state: this.breaker.state,
                failures: this.breaker.failures
            },
            cache: this.cache.getStats()
        };
    }
}

module.exports = OptimizedWorker;