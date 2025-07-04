/**
 * Auto-Scaling Workers
 * 
 * Dynamically adjusts worker count based on queue load
 * Monitors performance and scales up/down as needed
 */

const { getMetricsCollector } = require('../monitoring/MetricsCollector');
const OptimizedWorker = require('./OptimizedWorker');
const os = require('os');

class AutoScaler {
    constructor(queueManager, workerPool, options = {}) {
        this.queueManager = queueManager;
        this.workerPool = workerPool;
        this.options = {
            checkInterval: 10000, // 10 seconds
            scaleUpThreshold: {
                queueSize: 50,        // Scale up if queue > 50 jobs
                waitTime: 30000,      // Scale up if avg wait > 30s
                cpuUsage: 0.7         // Only scale if CPU < 70%
            },
            scaleDownThreshold: {
                queueSize: 10,        // Scale down if queue < 10 jobs
                idleTime: 60000,      // Scale down if idle > 60s
                minWorkers: 1         // Always keep at least 1 worker
            },
            scalingRules: {
                maxWorkers: 10,       // Max workers per queue
                scaleUpStep: 2,       // Add 2 workers at a time
                scaleDownStep: 1,     // Remove 1 worker at a time
                cooldownPeriod: 30000 // Wait 30s between scaling
            },
            memoryLimit: 0.8,         // Don't scale if memory > 80%
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.scalingHistory = new Map();
        this.queueStats = new Map();
        this.intervalId = null;
        this.isScaling = false;
    }

    start() {
        console.log('🚀 Auto-scaler started');
        
        // Start monitoring
        this.intervalId = setInterval(() => {
            this.checkAndScale().catch(err => {
                console.error('Auto-scaling error:', err);
            });
        }, this.options.checkInterval);
        
        // Initial check
        this.checkAndScale();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('🚫 Auto-scaler stopped');
    }

    async checkAndScale() {
        if (this.isScaling) {
            console.log('⏳ Scaling operation in progress, skipping check');
            return;
        }
        
        this.isScaling = true;
        
        try {
            // Get system metrics
            const systemMetrics = await this.getSystemMetrics();
            
            // Check each queue
            for (const [queueName, queue] of Object.entries(this.queueManager.queues)) {
                await this.checkQueue(queueName, queue, systemMetrics);
            }
            
        } finally {
            this.isScaling = false;
        }
    }

    async checkQueue(queueName, queue, systemMetrics) {
        // Get queue metrics
        const stats = await this.getQueueStats(queueName, queue);
        
        // Update history
        this.updateQueueHistory(queueName, stats);
        
        // Get current worker count
        const currentWorkers = this.workerPool.getWorkerCount(queueName);
        const maxWorkers = this.options.scalingRules.maxWorkers;
        
        // Check if we're in cooldown
        if (this.isInCooldown(queueName)) {
            return;
        }
        
        // Determine scaling action
        const action = this.determineScalingAction(
            queueName,
            stats,
            currentWorkers,
            systemMetrics
        );
        
        if (action === 'scale-up') {
            await this.scaleUp(queueName, currentWorkers, maxWorkers);
        } else if (action === 'scale-down') {
            await this.scaleDown(queueName, currentWorkers);
        }
    }

    async getQueueStats(queueName, queue) {
        const counts = await queue.getJobCounts();
        const waitingJobs = await queue.getWaitingCount();
        const activeJobs = await queue.getActiveCount();
        
        // Calculate average wait time
        let avgWaitTime = 0;
        if (waitingJobs > 0) {
            const oldestJob = await queue.getJobs(['waiting'], 0, 1);
            if (oldestJob.length > 0) {
                avgWaitTime = Date.now() - oldestJob[0].timestamp;
            }
        }
        
        // Get worker utilization
        const workerStats = this.workerPool.getWorkerStats(queueName);
        
        return {
            queueSize: counts.waiting + counts.active,
            waiting: counts.waiting,
            active: counts.active,
            completed: counts.completed,
            failed: counts.failed,
            avgWaitTime,
            workerUtilization: workerStats.utilization || 0,
            timestamp: Date.now()
        };
    }

    async getSystemMetrics() {
        const cpus = os.cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        
        // Calculate CPU usage
        const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b);
            const idle = cpu.times.idle;
            return acc + (1 - idle / total);
        }, 0) / cpus.length;
        
        return {
            cpuUsage,
            memoryUsage: 1 - (freeMemory / totalMemory),
            loadAverage: os.loadavg()[0], // 1-minute load average
            cpuCount: cpus.length
        };
    }

    updateQueueHistory(queueName, stats) {
        if (!this.queueStats.has(queueName)) {
            this.queueStats.set(queueName, []);
        }
        
        const history = this.queueStats.get(queueName);
        history.push(stats);
        
        // Keep last 10 minutes of data
        const tenMinutesAgo = Date.now() - 600000;
        const filtered = history.filter(s => s.timestamp > tenMinutesAgo);
        this.queueStats.set(queueName, filtered);
    }

    determineScalingAction(queueName, stats, currentWorkers, systemMetrics) {
        const history = this.queueStats.get(queueName) || [];
        
        // Need at least 3 data points for trends
        if (history.length < 3) {
            return 'none';
        }
        
        // Check scale up conditions
        if (this.shouldScaleUp(stats, history, systemMetrics)) {
            return 'scale-up';
        }
        
        // Check scale down conditions
        if (this.shouldScaleDown(stats, history, currentWorkers)) {
            return 'scale-down';
        }
        
        return 'none';
    }

    shouldScaleUp(stats, history, systemMetrics) {
        const thresholds = this.options.scaleUpThreshold;
        
        // Check system resources first
        if (systemMetrics.cpuUsage > thresholds.cpuUsage) {
            console.log(`🔋 CPU too high (${(systemMetrics.cpuUsage * 100).toFixed(1)}%), not scaling up`);
            return false;
        }
        
        if (systemMetrics.memoryUsage > this.options.memoryLimit) {
            console.log(`💧 Memory too high (${(systemMetrics.memoryUsage * 100).toFixed(1)}%), not scaling up`);
            return false;
        }
        
        // Check queue conditions
        const conditions = [
            stats.queueSize > thresholds.queueSize,
            stats.avgWaitTime > thresholds.waitTime,
            this.isQueueGrowing(history)
        ];
        
        return conditions.filter(c => c).length >= 2;
    }

    shouldScaleDown(stats, history, currentWorkers) {
        const thresholds = this.options.scaleDownThreshold;
        
        // Don't scale below minimum
        if (currentWorkers <= thresholds.minWorkers) {
            return false;
        }
        
        // Check conditions
        const conditions = [
            stats.queueSize < thresholds.queueSize,
            stats.active === 0 && this.hasBeenIdle(history, thresholds.idleTime),
            stats.workerUtilization < 0.3 // Workers less than 30% utilized
        ];
        
        return conditions.filter(c => c).length >= 2;
    }

    isQueueGrowing(history) {
        if (history.length < 3) return false;
        
        // Check trend over last 3 data points
        const recent = history.slice(-3);
        const sizes = recent.map(s => s.queueSize);
        
        // Growing if each point is larger than previous
        return sizes[1] > sizes[0] && sizes[2] > sizes[1];
    }

    hasBeenIdle(history, idleTime) {
        const idleSince = Date.now() - idleTime;
        return history
            .filter(s => s.timestamp > idleSince)
            .every(s => s.active === 0);
    }

    isInCooldown(queueName) {
        const lastScaling = this.scalingHistory.get(queueName);
        if (!lastScaling) return false;
        
        return Date.now() - lastScaling < this.options.scalingRules.cooldownPeriod;
    }

    async scaleUp(queueName, currentWorkers, maxWorkers) {
        const step = Math.min(
            this.options.scalingRules.scaleUpStep,
            maxWorkers - currentWorkers
        );
        
        if (step <= 0) {
            console.log(`🚫 ${queueName}: Already at max workers (${maxWorkers})`);
            return;
        }
        
        console.log(`📈 Scaling up ${queueName}: +${step} workers (${currentWorkers} → ${currentWorkers + step})`);
        
        try {
            // Add workers
            for (let i = 0; i < step; i++) {
                await this.workerPool.addWorker(queueName);
            }
            
            // Record scaling event
            this.scalingHistory.set(queueName, Date.now());
            
            // Emit metrics
            this.metrics.recordJob('autoscaler', 'scale-up', 'completed');
            
            // Log to monitoring
            console.log(`✅ Successfully scaled up ${queueName} to ${currentWorkers + step} workers`);
            
        } catch (error) {
            console.error(`Failed to scale up ${queueName}:`, error);
            this.metrics.recordError('autoscaler_scale_up_failed', queueName);
        }
    }

    async scaleDown(queueName, currentWorkers) {
        const step = this.options.scalingRules.scaleDownStep;
        const minWorkers = this.options.scaleDownThreshold.minWorkers;
        const newCount = Math.max(currentWorkers - step, minWorkers);
        
        if (newCount === currentWorkers) {
            return;
        }
        
        console.log(`📉 Scaling down ${queueName}: -${step} workers (${currentWorkers} → ${newCount})`);
        
        try {
            // Remove workers
            for (let i = 0; i < step; i++) {
                await this.workerPool.removeWorker(queueName);
            }
            
            // Record scaling event
            this.scalingHistory.set(queueName, Date.now());
            
            // Emit metrics
            this.metrics.recordJob('autoscaler', 'scale-down', 'completed');
            
            console.log(`✅ Successfully scaled down ${queueName} to ${newCount} workers`);
            
        } catch (error) {
            console.error(`Failed to scale down ${queueName}:`, error);
            this.metrics.recordError('autoscaler_scale_down_failed', queueName);
        }
    }

    getStatus() {
        const status = {
            enabled: this.intervalId !== null,
            queues: {},
            systemMetrics: null,
            scalingHistory: {}
        };
        
        // Get queue status
        for (const [queueName, stats] of this.queueStats) {
            const latestStats = stats[stats.length - 1] || {};
            status.queues[queueName] = {
                queueSize: latestStats.queueSize || 0,
                avgWaitTime: latestStats.avgWaitTime || 0,
                workers: this.workerPool.getWorkerCount(queueName),
                utilization: latestStats.workerUtilization || 0
            };
        }
        
        // Get scaling history
        for (const [queueName, timestamp] of this.scalingHistory) {
            status.scalingHistory[queueName] = {
                lastScaled: new Date(timestamp).toISOString(),
                inCooldown: this.isInCooldown(queueName)
            };
        }
        
        return status;
    }

    /**
     * Get scaling recommendations
     */
    async getRecommendations() {
        const recommendations = [];
        const systemMetrics = await this.getSystemMetrics();
        
        for (const [queueName, queue] of Object.entries(this.queueManager.queues)) {
            const stats = await this.getQueueStats(queueName, queue);
            const currentWorkers = this.workerPool.getWorkerCount(queueName);
            
            if (stats.queueSize > 100 && currentWorkers < 5) {
                recommendations.push({
                    queue: queueName,
                    type: 'scale-up',
                    reason: 'Large queue backlog',
                    suggestion: `Increase workers to ${Math.min(currentWorkers + 3, 10)}`
                });
            }
            
            if (stats.avgWaitTime > 60000) { // 1 minute
                recommendations.push({
                    queue: queueName,
                    type: 'scale-up',
                    reason: 'High wait times',
                    suggestion: 'Consider increasing worker count or optimizing job processing'
                });
            }
            
            if (stats.workerUtilization < 0.2 && currentWorkers > 2) {
                recommendations.push({
                    queue: queueName,
                    type: 'scale-down',
                    reason: 'Low utilization',
                    suggestion: `Reduce workers to ${Math.max(currentWorkers - 1, 1)}`
                });
            }
        }
        
        // System recommendations
        if (systemMetrics.memoryUsage > 0.9) {
            recommendations.push({
                type: 'system',
                reason: 'High memory usage',
                suggestion: 'Consider scaling down workers or increasing system memory'
            });
        }
        
        return recommendations;
    }
}

module.exports = AutoScaler;