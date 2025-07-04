/**
 * API Rate Limiter
 * 
 * Intelligent rate limiting to prevent API quota exhaustion
 * Supports per-service limits with adaptive throttling
 */

const { getMetricsCollector } = require('../monitoring/MetricsCollector');
const { getCostTracker } = require('../cost/CostTracker');
const EventEmitter = require('events');

class RateLimiter extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.options = {
            limits: {
                anthropic: {
                    requests: {
                        perMinute: 50,
                        perHour: 1000,
                        perDay: 10000
                    },
                    tokens: {
                        perMinute: 100000,
                        perHour: 2000000,
                        perDay: 20000000
                    }
                },
                openai: {
                    requests: {
                        perMinute: 60,
                        perHour: 3000,
                        perDay: 50000
                    },
                    tokens: {
                        perMinute: 150000,
                        perHour: 3000000,
                        perDay: 30000000
                    }
                },
                perplexity: {
                    requests: {
                        perMinute: 10,
                        perHour: 100,
                        perDay: 500
                    }
                },
                ideogram: {
                    requests: {
                        perMinute: 5,
                        perHour: 50,
                        perDay: 200
                    }
                },
                deepseek: {
                    requests: {
                        perMinute: 100,
                        perHour: 2000,
                        perDay: 20000
                    },
                    tokens: {
                        perMinute: 200000,
                        perHour: 4000000,
                        perDay: 40000000
                    }
                }
            },
            adaptiveThrottling: {
                enabled: true,
                slowdownThreshold: 0.8,  // Slow down at 80% usage
                pauseThreshold: 0.95,    // Pause at 95% usage
                recoveryRate: 0.1        // Recover 10% per check
            },
            quotaAlerts: {
                enabled: true,
                thresholds: [0.5, 0.75, 0.9, 0.95],
                webhookUrl: process.env.QUOTA_ALERT_WEBHOOK
            },
            windowSize: {
                minute: 60 * 1000,
                hour: 60 * 60 * 1000,
                day: 24 * 60 * 60 * 1000
            },
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.costTracker = getCostTracker();
        this.usage = new Map();
        this.throttleState = new Map();
        this.alertsSent = new Map();
        
        // Initialize usage tracking
        this.initializeUsageTracking();
        
        // Start monitoring
        this.startMonitoring();
    }

    initializeUsageTracking() {
        for (const service of Object.keys(this.options.limits)) {
            this.usage.set(service, {
                requests: {
                    minute: [],
                    hour: [],
                    day: []
                },
                tokens: {
                    minute: [],
                    hour: [],
                    day: []
                }
            });
            
            this.throttleState.set(service, {
                throttled: false,
                paused: false,
                delay: 0,
                lastCheck: Date.now()
            });
        }
    }

    /**
     * Check if request is allowed
     */
    async checkLimit(service, type = 'request', amount = 1) {
        const now = Date.now();
        const usage = this.usage.get(service);
        const limits = this.options.limits[service];
        
        if (!usage || !limits) {
            console.warn(`⚠️  No rate limits configured for service: ${service}`);
            return { allowed: true };
        }
        
        // Clean old entries
        this.cleanOldEntries(service, now);
        
        // Get current usage
        const currentUsage = this.getCurrentUsage(service, type);
        
        // Check each time window
        const windows = ['minute', 'hour', 'day'];
        for (const window of windows) {
            const limit = limits[type === 'request' ? 'requests' : 'tokens']?.[`per${window.charAt(0).toUpperCase() + window.slice(1)}`];
            
            if (limit && currentUsage[window] + amount > limit) {
                const resetTime = this.getResetTime(service, window, now);
                
                this.metrics.recordError('rate_limit_exceeded', service);
                
                return {
                    allowed: false,
                    reason: `${window} limit exceeded`,
                    limit: limit,
                    current: currentUsage[window],
                    resetIn: resetTime - now,
                    resetAt: new Date(resetTime).toISOString()
                };
            }
        }
        
        // Check throttle state
        const throttle = this.throttleState.get(service);
        if (throttle.paused) {
            return {
                allowed: false,
                reason: 'Service paused due to high usage',
                delay: throttle.delay,
                resetIn: throttle.delay
            };
        }
        
        if (throttle.throttled && throttle.delay > 0) {
            return {
                allowed: true,
                delay: throttle.delay,
                reason: 'Throttled due to high usage'
            };
        }
        
        return { allowed: true };
    }

    /**
     * Record usage
     */
    async recordUsage(service, type = 'request', amount = 1) {
        const now = Date.now();
        const usage = this.usage.get(service);
        
        if (!usage) return;
        
        const usageType = type === 'request' ? 'requests' : 'tokens';
        
        // Add to all windows
        usage[usageType].minute.push({ timestamp: now, amount });
        usage[usageType].hour.push({ timestamp: now, amount });
        usage[usageType].day.push({ timestamp: now, amount });
        
        // Update metrics
        if (type === 'request') {
            this.metrics.recordAPICall(service, 'rate_limiter', 'tracked');
        }
        
        // Check usage levels
        await this.checkUsageLevels(service);
    }

    /**
     * Get current usage for a service
     */
    getCurrentUsage(service, type = 'request') {
        const now = Date.now();
        const usage = this.usage.get(service);
        const usageType = type === 'request' ? 'requests' : 'tokens';
        
        const result = {
            minute: 0,
            hour: 0,
            day: 0
        };
        
        if (!usage) return result;
        
        // Count usage in each window
        const windows = {
            minute: this.options.windowSize.minute,
            hour: this.options.windowSize.hour,
            day: this.options.windowSize.day
        };
        
        for (const [window, duration] of Object.entries(windows)) {
            const cutoff = now - duration;
            result[window] = usage[usageType][window]
                .filter(entry => entry.timestamp > cutoff)
                .reduce((sum, entry) => sum + entry.amount, 0);
        }
        
        return result;
    }

    /**
     * Clean old usage entries
     */
    cleanOldEntries(service, now) {
        const usage = this.usage.get(service);
        if (!usage) return;
        
        const windows = {
            minute: this.options.windowSize.minute,
            hour: this.options.windowSize.hour,
            day: this.options.windowSize.day
        };
        
        for (const [window, duration] of Object.entries(windows)) {
            const cutoff = now - duration;
            
            for (const type of ['requests', 'tokens']) {
                usage[type][window] = usage[type][window].filter(
                    entry => entry.timestamp > cutoff
                );
            }
        }
    }

    /**
     * Check usage levels and apply throttling
     */
    async checkUsageLevels(service) {
        if (!this.options.adaptiveThrottling.enabled) return;
        
        const limits = this.options.limits[service];
        const currentUsage = this.getCurrentUsage(service, 'request');
        const throttle = this.throttleState.get(service);
        
        // Calculate usage percentages
        const usagePercentages = {};
        for (const window of ['minute', 'hour', 'day']) {
            const limit = limits.requests?.[`per${window.charAt(0).toUpperCase() + window.slice(1)}`];
            if (limit) {
                usagePercentages[window] = currentUsage[window] / limit;
            }
        }
        
        // Get highest usage percentage
        const maxUsage = Math.max(...Object.values(usagePercentages));
        
        // Apply throttling based on usage
        const { slowdownThreshold, pauseThreshold } = this.options.adaptiveThrottling;
        
        if (maxUsage >= pauseThreshold) {
            // Pause service
            throttle.paused = true;
            throttle.throttled = true;
            throttle.delay = 60000; // 1 minute pause
            
            console.error(`🚫 Service ${service} PAUSED - usage at ${(maxUsage * 100).toFixed(1)}%`);
            this.emit('service:paused', { service, usage: maxUsage });
            
        } else if (maxUsage >= slowdownThreshold) {
            // Apply throttling
            throttle.throttled = true;
            throttle.paused = false;
            
            // Calculate delay based on usage
            const throttleRange = pauseThreshold - slowdownThreshold;
            const throttleLevel = (maxUsage - slowdownThreshold) / throttleRange;
            throttle.delay = Math.floor(throttleLevel * 5000); // Up to 5 second delay
            
            console.warn(`⏱️ Service ${service} throttled - usage at ${(maxUsage * 100).toFixed(1)}%`);
            this.emit('service:throttled', { service, usage: maxUsage, delay: throttle.delay });
            
        } else {
            // Remove throttling
            if (throttle.throttled) {
                console.log(`✅ Service ${service} throttling removed - usage at ${(maxUsage * 100).toFixed(1)}%`);
                this.emit('service:recovered', { service, usage: maxUsage });
            }
            
            throttle.throttled = false;
            throttle.paused = false;
            throttle.delay = 0;
        }
        
        // Send alerts
        await this.checkAlerts(service, maxUsage);
    }

    /**
     * Check and send quota alerts
     */
    async checkAlerts(service, usage) {
        if (!this.options.quotaAlerts.enabled) return;
        
        const thresholds = this.options.quotaAlerts.thresholds;
        const alertsKey = `${service}:${new Date().toDateString()}`;
        const sentAlerts = this.alertsSent.get(alertsKey) || [];
        
        for (const threshold of thresholds) {
            if (usage >= threshold && !sentAlerts.includes(threshold)) {
                await this.sendAlert(service, usage, threshold);
                sentAlerts.push(threshold);
                this.alertsSent.set(alertsKey, sentAlerts);
            }
        }
    }

    async sendAlert(service, usage, threshold) {
        const message = {
            type: 'quota_alert',
            service,
            usage: (usage * 100).toFixed(1) + '%',
            threshold: (threshold * 100) + '%',
            timestamp: new Date().toISOString(),
            limits: this.options.limits[service],
            currentUsage: this.getCurrentUsage(service)
        };
        
        console.warn(`🚨 QUOTA ALERT: ${service} at ${message.usage} (threshold: ${message.threshold})`);
        this.emit('quota:alert', message);
        
        // Send webhook if configured
        if (this.options.quotaAlerts.webhookUrl) {
            try {
                const axios = require('axios');
                await axios.post(this.options.quotaAlerts.webhookUrl, message);
            } catch (error) {
                console.error('Failed to send quota alert webhook:', error.message);
            }
        }
    }

    /**
     * Get reset time for a window
     */
    getResetTime(service, window, now) {
        const windowSize = this.options.windowSize[window];
        return now + windowSize - (now % windowSize);
    }

    /**
     * Start monitoring
     */
    startMonitoring() {
        // Check throttle states periodically
        setInterval(() => {
            this.updateThrottleStates();
        }, 10000); // Every 10 seconds
        
        // Clean old entries periodically
        setInterval(() => {
            const now = Date.now();
            for (const service of this.usage.keys()) {
                this.cleanOldEntries(service, now);
            }
        }, 60000); // Every minute
    }

    updateThrottleStates() {
        const now = Date.now();
        const { recoveryRate } = this.options.adaptiveThrottling;
        
        for (const [service, throttle] of this.throttleState) {
            if (throttle.paused && now - throttle.lastCheck > 60000) {
                // Check if we can unpause
                const usage = this.getCurrentUsage(service, 'request');
                const limits = this.options.limits[service];
                
                // Calculate current usage percentage
                let maxUsage = 0;
                for (const window of ['minute', 'hour', 'day']) {
                    const limit = limits.requests?.[`per${window.charAt(0).toUpperCase() + window.slice(1)}`];
                    if (limit) {
                        maxUsage = Math.max(maxUsage, usage[window] / limit);
                    }
                }
                
                // Unpause if usage has dropped
                if (maxUsage < this.options.adaptiveThrottling.slowdownThreshold) {
                    throttle.paused = false;
                    throttle.throttled = false;
                    throttle.delay = 0;
                    console.log(`▶️ Service ${service} unpaused - usage dropped to ${(maxUsage * 100).toFixed(1)}%`);
                }
                
                throttle.lastCheck = now;
            }
        }
    }

    /**
     * Get service status
     */
    getStatus(service) {
        const usage = this.getCurrentUsage(service);
        const limits = this.options.limits[service];
        const throttle = this.throttleState.get(service);
        
        if (!limits) {
            return { error: 'Service not configured' };
        }
        
        const status = {
            service,
            usage: {
                requests: usage,
                tokens: this.getCurrentUsage(service, 'token')
            },
            limits: limits,
            percentages: {},
            throttle: {
                throttled: throttle?.throttled || false,
                paused: throttle?.paused || false,
                delay: throttle?.delay || 0
            }
        };
        
        // Calculate percentages
        for (const window of ['minute', 'hour', 'day']) {
            const limit = limits.requests?.[`per${window.charAt(0).toUpperCase() + window.slice(1)}`];
            if (limit) {
                status.percentages[window] = (usage[window] / limit * 100).toFixed(1) + '%';
            }
        }
        
        return status;
    }

    /**
     * Get all services status
     */
    getAllStatus() {
        const status = {};
        
        for (const service of this.usage.keys()) {
            status[service] = this.getStatus(service);
        }
        
        return status;
    }

    /**
     * Reset usage for a service
     */
    resetUsage(service) {
        const usage = this.usage.get(service);
        if (usage) {
            usage.requests = { minute: [], hour: [], day: [] };
            usage.tokens = { minute: [], hour: [], day: [] };
        }
        
        const throttle = this.throttleState.get(service);
        if (throttle) {
            throttle.throttled = false;
            throttle.paused = false;
            throttle.delay = 0;
        }
        
        console.log(`🔄 Reset usage for service: ${service}`);
    }

    /**
     * Export usage data
     */
    exportUsageData() {
        const data = {
            timestamp: new Date().toISOString(),
            services: {}
        };
        
        for (const service of this.usage.keys()) {
            data.services[service] = {
                status: this.getStatus(service),
                history: {
                    requests: this.usage.get(service).requests,
                    tokens: this.usage.get(service).tokens
                }
            };
        }
        
        return data;
    }
}

// Singleton instance
let instance;

function getRateLimiter(options) {
    if (!instance) {
        instance = new RateLimiter(options);
    }
    return instance;
}

module.exports = {
    RateLimiter,
    getRateLimiter
};