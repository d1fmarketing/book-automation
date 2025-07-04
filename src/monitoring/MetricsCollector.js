/**
 * Metrics Collector
 * 
 * Collects and exposes metrics for Prometheus
 * Tracks pipeline performance, API usage, and costs
 */

const promClient = require('prom-client');
const express = require('express');

class MetricsCollector {
    constructor(options = {}) {
        this.options = {
            port: process.env.METRICS_PORT || 9464,
            prefix: 'ebook_pipeline_',
            ...options
        };
        
        // Create registry
        this.register = new promClient.Registry();
        
        // Add default labels
        this.register.setDefaultLabels({
            app: 'ebook-pipeline',
            env: process.env.NODE_ENV || 'development'
        });
        
        // Enable default metrics
        promClient.collectDefaultMetrics({ register: this.register });
        
        // Initialize custom metrics
        this.initializeMetrics();
        
        // Express app for metrics endpoint
        this.app = null;
        this.server = null;
    }

    initializeMetrics() {
        // Pipeline metrics
        this.metrics = {
            // Job counters
            jobsTotal: new promClient.Counter({
                name: `${this.options.prefix}jobs_total`,
                help: 'Total number of jobs processed',
                labelNames: ['queue', 'status'],
                registers: [this.register]
            }),
            
            // Job duration histogram
            jobDuration: new promClient.Histogram({
                name: `${this.options.prefix}job_duration_seconds`,
                help: 'Job processing duration in seconds',
                labelNames: ['queue', 'job_type'],
                buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
                registers: [this.register]
            }),
            
            // Queue metrics
            queueSize: new promClient.Gauge({
                name: `${this.options.prefix}queue_size`,
                help: 'Current queue size',
                labelNames: ['queue', 'state'],
                registers: [this.register]
            }),
            
            // Worker metrics
            workersActive: new promClient.Gauge({
                name: `${this.options.prefix}workers_active`,
                help: 'Number of active workers',
                labelNames: ['queue'],
                registers: [this.register]
            }),
            
            // API metrics
            apiCalls: new promClient.Counter({
                name: `${this.options.prefix}api_calls_total`,
                help: 'Total API calls made',
                labelNames: ['service', 'endpoint', 'status'],
                registers: [this.register]
            }),
            
            apiLatency: new promClient.Histogram({
                name: `${this.options.prefix}api_latency_seconds`,
                help: 'API call latency in seconds',
                labelNames: ['service', 'endpoint'],
                buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
                registers: [this.register]
            }),
            
            // Token usage
            tokensUsed: new promClient.Counter({
                name: `${this.options.prefix}tokens_used_total`,
                help: 'Total tokens consumed',
                labelNames: ['service', 'model'],
                registers: [this.register]
            }),
            
            // Cost tracking
            apiCost: new promClient.Counter({
                name: `${this.options.prefix}api_cost_cents`,
                help: 'API costs in cents',
                labelNames: ['service', 'resource'],
                registers: [this.register]
            }),
            
            // Book generation metrics
            booksGenerated: new promClient.Counter({
                name: `${this.options.prefix}books_generated_total`,
                help: 'Total books generated',
                labelNames: ['status'],
                registers: [this.register]
            }),
            
            bookGenerationTime: new promClient.Histogram({
                name: `${this.options.prefix}book_generation_seconds`,
                help: 'Book generation time in seconds',
                buckets: [60, 120, 300, 600, 900, 1200, 1800],
                registers: [this.register]
            }),
            
            // Chapter metrics
            chaptersGenerated: new promClient.Counter({
                name: `${this.options.prefix}chapters_generated_total`,
                help: 'Total chapters generated',
                labelNames: ['status'],
                registers: [this.register]
            }),
            
            chapterWordCount: new promClient.Histogram({
                name: `${this.options.prefix}chapter_word_count`,
                help: 'Word count distribution for chapters',
                buckets: [500, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
                registers: [this.register]
            }),
            
            // Cache metrics
            cacheHits: new promClient.Counter({
                name: `${this.options.prefix}cache_hits_total`,
                help: 'Cache hit count',
                labelNames: ['cache_type'],
                registers: [this.register]
            }),
            
            cacheMisses: new promClient.Counter({
                name: `${this.options.prefix}cache_misses_total`,
                help: 'Cache miss count',
                labelNames: ['cache_type'],
                registers: [this.register]
            }),
            
            // Error metrics
            errors: new promClient.Counter({
                name: `${this.options.prefix}errors_total`,
                help: 'Total errors',
                labelNames: ['type', 'stage'],
                registers: [this.register]
            }),
            
            // Circuit breaker metrics
            circuitBreakerState: new promClient.Gauge({
                name: `${this.options.prefix}circuit_breaker_state`,
                help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
                labelNames: ['service'],
                registers: [this.register]
            })
        };
    }

    /**
     * Record job metrics
     */
    recordJob(queue, jobType, status, duration) {
        this.metrics.jobsTotal.inc({ queue, status });
        
        if (duration) {
            this.metrics.jobDuration.observe({ queue, job_type: jobType }, duration / 1000);
        }
    }

    /**
     * Update queue metrics
     */
    updateQueueMetrics(queueStats) {
        for (const [queueName, stats] of Object.entries(queueStats)) {
            this.metrics.queueSize.set({ queue: queueName, state: 'waiting' }, stats.waiting);
            this.metrics.queueSize.set({ queue: queueName, state: 'active' }, stats.active);
            this.metrics.queueSize.set({ queue: queueName, state: 'delayed' }, stats.delayed);
            this.metrics.queueSize.set({ queue: queueName, state: 'failed' }, stats.failed);
        }
    }

    /**
     * Update worker metrics
     */
    updateWorkerMetrics(workerStats) {
        for (const [queueName, stats] of Object.entries(workerStats)) {
            this.metrics.workersActive.set({ queue: queueName }, stats.activeJobs);
        }
    }

    /**
     * Record API call
     */
    recordAPICall(service, endpoint, status, latency) {
        this.metrics.apiCalls.inc({ service, endpoint, status });
        
        if (latency) {
            this.metrics.apiLatency.observe({ service, endpoint }, latency / 1000);
        }
    }

    /**
     * Record token usage
     */
    recordTokenUsage(service, model, tokens) {
        this.metrics.tokensUsed.inc({ service, model }, tokens);
    }

    /**
     * Record API cost
     */
    recordAPICost(service, resource, costCents) {
        this.metrics.apiCost.inc({ service, resource }, costCents);
    }

    /**
     * Record book generation
     */
    recordBookGeneration(status, duration) {
        this.metrics.booksGenerated.inc({ status });
        
        if (duration && status === 'success') {
            this.metrics.bookGenerationTime.observe(duration / 1000);
        }
    }

    /**
     * Record chapter generation
     */
    recordChapterGeneration(status, wordCount) {
        this.metrics.chaptersGenerated.inc({ status });
        
        if (wordCount && status === 'success') {
            this.metrics.chapterWordCount.observe(wordCount);
        }
    }

    /**
     * Record cache hit/miss
     */
    recordCacheHit(cacheType) {
        this.metrics.cacheHits.inc({ cache_type: cacheType });
    }

    recordCacheMiss(cacheType) {
        this.metrics.cacheMisses.inc({ cache_type: cacheType });
    }

    /**
     * Record error
     */
    recordError(type, stage) {
        this.metrics.errors.inc({ type, stage });
    }

    /**
     * Update circuit breaker state
     */
    updateCircuitBreakerState(service, state) {
        const stateValue = {
            'CLOSED': 0,
            'OPEN': 1,
            'HALF_OPEN': 2
        }[state] || 0;
        
        this.metrics.circuitBreakerState.set({ service }, stateValue);
    }

    /**
     * Start metrics server
     */
    async start() {
        if (this.server) {
            console.warn('⚠️  Metrics server already running');
            return;
        }
        
        this.app = express();
        
        // Metrics endpoint
        this.app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', this.register.contentType);
                res.end(await this.register.metrics());
            } catch (error) {
                res.status(500).end(error.message);
            }
        });
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', uptime: process.uptime() });
        });
        
        // Start server
        this.server = this.app.listen(this.options.port, () => {
            console.log(`📊 Metrics server listening on port ${this.options.port}`);
            console.log(`   Prometheus endpoint: http://localhost:${this.options.port}/metrics`);
        });
    }

    /**
     * Stop metrics server
     */
    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
            this.server = null;
            this.app = null;
            console.log('📊 Metrics server stopped');
        }
    }

    /**
     * Get current metrics as JSON
     */
    async getMetricsJSON() {
        const metrics = await this.register.getMetricsAsJSON();
        return metrics;
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.register.resetMetrics();
    }
}

// Singleton instance
let instance;

function getMetricsCollector(options) {
    if (!instance) {
        instance = new MetricsCollector(options);
    }
    return instance;
}

module.exports = {
    MetricsCollector,
    getMetricsCollector
};