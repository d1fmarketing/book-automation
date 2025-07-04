/**
 * Connection Pool Manager
 * 
 * Manages connection pools for various services
 * Optimizes API connections and prevents exhaustion
 */

const { Anthropic } = require('@anthropic-ai/sdk');
const axios = require('axios');
const { getMetricsCollector } = require('../monitoring/MetricsCollector');

class ConnectionPool {
    constructor(options = {}) {
        this.options = {
            anthropic: {
                maxConnections: 5,
                apiKey: process.env.ANTHROPIC_API_KEY
            },
            perplexity: {
                maxConnections: 3,
                apiKey: process.env.PERPLEXITY_API_KEY,
                baseURL: 'https://api.perplexity.ai'
            },
            ideogram: {
                maxConnections: 2,
                apiKey: process.env.IDEOGRAM_API_KEY,
                baseURL: 'https://api.ideogram.ai'
            },
            http: {
                maxSockets: 50,
                maxFreeSockets: 10,
                timeout: 30000,
                keepAlive: true,
                keepAliveMsecs: 1000
            },
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.pools = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        // Initialize Anthropic pool
        this.pools.anthropic = this.createAnthropicPool();
        
        // Initialize HTTP pools for other services
        this.pools.perplexity = this.createHTTPPool('perplexity');
        this.pools.ideogram = this.createHTTPPool('ideogram');
        this.pools.general = this.createHTTPPool('general');
        
        this.initialized = true;
        console.log('✅ Connection pools initialized');
    }

    createAnthropicPool() {
        const pool = [];
        const config = this.options.anthropic;
        
        // Create connection instances
        for (let i = 0; i < config.maxConnections; i++) {
            pool.push({
                id: i,
                client: new Anthropic({
                    apiKey: config.apiKey,
                    maxRetries: 3,
                    timeout: 60000 // 1 minute
                }),
                inUse: false,
                lastUsed: null,
                requestCount: 0
            });
        }
        
        return {
            connections: pool,
            waitQueue: [],
            activeCount: 0
        };
    }

    createHTTPPool(service) {
        const config = this.options[service] || this.options.http;
        
        // Create axios instance with connection pooling
        const agent = new (require('http').Agent)({
            maxSockets: config.maxSockets || this.options.http.maxSockets,
            maxFreeSockets: config.maxFreeSockets || this.options.http.maxFreeSockets,
            timeout: config.timeout || this.options.http.timeout,
            keepAlive: true,
            keepAliveMsecs: 1000
        });
        
        const httpsAgent = new (require('https').Agent)({
            maxSockets: config.maxSockets || this.options.http.maxSockets,
            maxFreeSockets: config.maxFreeSockets || this.options.http.maxFreeSockets,
            timeout: config.timeout || this.options.http.timeout,
            keepAlive: true,
            keepAliveMsecs: 1000
        });
        
        return axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout || this.options.http.timeout,
            httpAgent: agent,
            httpsAgent: httpsAgent,
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json'
            },
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });
    }

    /**
     * Get an Anthropic client from the pool
     */
    async getAnthropicClient() {
        if (!this.initialized) await this.initialize();
        
        const pool = this.pools.anthropic;
        const startTime = Date.now();
        
        // Find available connection
        let connection = pool.connections.find(c => !c.inUse);
        
        if (!connection) {
            // All connections in use, wait for one
            console.log('⏳ All Anthropic connections in use, waiting...');
            
            connection = await new Promise((resolve) => {
                pool.waitQueue.push(resolve);
            });
        }
        
        // Mark as in use
        connection.inUse = true;
        connection.lastUsed = Date.now();
        connection.requestCount++;
        pool.activeCount++;
        
        // Record wait time
        const waitTime = Date.now() - startTime;
        if (waitTime > 100) {
            this.metrics.recordAPICall('anthropic', 'pool_wait', 'delayed', waitTime);
        }
        
        // Return wrapped client
        return {
            client: connection.client,
            release: () => this.releaseAnthropicClient(connection)
        };
    }

    releaseAnthropicClient(connection) {
        const pool = this.pools.anthropic;
        
        // Mark as available
        connection.inUse = false;
        pool.activeCount--;
        
        // Check wait queue
        if (pool.waitQueue.length > 0) {
            const waiting = pool.waitQueue.shift();
            waiting(connection);
        }
        
        // Log pool stats periodically
        if (connection.requestCount % 100 === 0) {
            console.log(`📊 Anthropic pool stats: ${pool.activeCount}/${this.options.anthropic.maxConnections} active`);
        }
    }

    /**
     * Get HTTP client for a service
     */
    getHTTPClient(service = 'general') {
        if (!this.initialized) {
            throw new Error('Connection pool not initialized');
        }
        
        return this.pools[service] || this.pools.general;
    }

    /**
     * Execute request with retry and circuit breaking
     */
    async request(service, config) {
        const client = this.getHTTPClient(service);
        const startTime = Date.now();
        
        try {
            const response = await client(config);
            
            // Record metrics
            this.metrics.recordAPICall(
                service,
                config.url || config.method,
                response.status < 400 ? 'success' : 'error',
                Date.now() - startTime
            );
            
            return response;
            
        } catch (error) {
            // Record error
            this.metrics.recordAPICall(
                service,
                config.url || config.method,
                'error',
                Date.now() - startTime
            );
            
            // Handle specific errors
            if (error.code === 'ECONNABORTED') {
                throw new Error('Request timeout');
            }
            
            if (error.response?.status === 429) {
                const retryAfter = error.response.headers['retry-after'];
                error.code = 'RATE_LIMIT';
                error.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
            }
            
            throw error;
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        const stats = {
            anthropic: {
                total: this.options.anthropic.maxConnections,
                active: this.pools.anthropic?.activeCount || 0,
                waiting: this.pools.anthropic?.waitQueue.length || 0
            },
            http: {}
        };
        
        // Get HTTP agent stats
        ['perplexity', 'ideogram', 'general'].forEach(service => {
            const pool = this.pools[service];
            if (pool?.defaults?.httpAgent) {
                const sockets = pool.defaults.httpAgent.sockets;
                stats.http[service] = {
                    activeSockets: Object.values(sockets).flat().length
                };
            }
        });
        
        return stats;
    }

    /**
     * Close all connections
     */
    async close() {
        // Close HTTP agents
        for (const [name, pool] of Object.entries(this.pools)) {
            if (pool.defaults?.httpAgent) {
                pool.defaults.httpAgent.destroy();
            }
            if (pool.defaults?.httpsAgent) {
                pool.defaults.httpsAgent.destroy();
            }
        }
        
        console.log('🚪 Connection pools closed');
    }
}

// Singleton instance
let instance;

function getConnectionPool(options) {
    if (!instance) {
        instance = new ConnectionPool(options);
    }
    return instance;
}

module.exports = {
    ConnectionPool,
    getConnectionPool
};