#!/usr/bin/env node

/**
 * Optimized Pipeline Orchestrator
 * 
 * High-performance pipeline with caching and optimizations
 */

const ReviewOrchestrator = require('./orchestrator-with-review');
const { getSmartCache } = require('../src/cache/SmartCache');
const { getConnectionPool } = require('../src/pool/ConnectionPool');
const OptimizedWorker = require('../src/workers/OptimizedWorker');
const WorkerPool = require('../src/queue/WorkerPool');

class OptimizedOrchestrator extends ReviewOrchestrator {
    constructor(topic, options = {}) {
        super(topic, {
            ...options,
            optimizations: {
                cache: true,
                connectionPool: true,
                parallelChapters: 6, // Increased from 4
                batchSize: 10,
                prefetch: 2,
                ...options.optimizations
            }
        });
        
        this.cache = null;
        this.connectionPool = null;
    }

    async initialize() {
        console.log('🚀 OPTIMIZED PIPELINE ORCHESTRATOR\n');
        
        // Initialize optimizations first
        if (this.options.optimizations.cache) {
            console.log('📦 Initializing smart cache...');
            this.cache = getSmartCache();
            await this.cache.connect();
        }
        
        if (this.options.optimizations.connectionPool) {
            console.log('🌊 Initializing connection pools...');
            this.connectionPool = getConnectionPool();
            await this.connectionPool.initialize();
        }
        
        // Initialize parent
        await super.initialize();
        
        // Override worker pool with optimized configuration
        if (this.workerPool) {
            await this.workerPool.shutdown();
        }
        
        this.workerPool = new WorkerPool(this.queueManager, {
            workerConfig: this.getOptimizedWorkerConfig(),
            workerClass: OptimizedWorker
        });
        await this.workerPool.start();
        
        console.log('✅ Optimizations enabled\n');
    }

    getOptimizedWorkerConfig() {
        const settings = this.pipeline?.settings || {};
        const opts = this.options.optimizations;
        
        return {
            pipeline: { 
                count: 1, 
                concurrency: 1,
                processor: this.createOptimizedProcessor('pipeline')
            },
            research: { 
                count: settings.parallel?.research || 2, 
                concurrency: 2,
                processor: this.createOptimizedProcessor('research'),
                cacheConfig: {
                    ttl: 86400 // 24 hours for research
                }
            },
            writer: { 
                count: opts.parallelChapters || 6, 
                concurrency: 3,
                processor: this.createOptimizedProcessor('writer'),
                prefetch: opts.prefetch
            },
            formatter: { 
                count: 4, 
                concurrency: 2,
                processor: this.createOptimizedProcessor('formatter')
            },
            qa: { 
                count: 2, 
                concurrency: 1,
                processor: this.createOptimizedProcessor('qa')
            }
        };
    }

    createOptimizedProcessor(queueName) {
        return async (job, context) => {
            // Get original processor
            const processor = require('../src/queue/JobProcessor').processors[queueName];
            
            // Wrap with optimizations
            return await this.optimizeProcessor(processor, job, context);
        };
    }

    async optimizeProcessor(processor, job, context) {
        // Add connection pool to context
        if (this.connectionPool) {
            context.connectionPool = this.connectionPool;
        }
        
        // Add cache to context
        if (this.cache) {
            context.cache = this.cache;
        }
        
        // Execute processor
        return await processor(job, context);
    }

    async executeBatch(stageIds) {
        console.log(`\n📦 Executing optimized batch: [${stageIds.join(', ')}]`);
        
        // Pre-warm caches for parallel stages
        if (this.cache) {
            await this.prewarmCaches(stageIds);
        }
        
        // Execute with parent logic
        return await super.executeBatch(stageIds);
    }

    async prewarmCaches(stageIds) {
        const stages = stageIds.map(id => 
            this.pipeline.stages.find(s => s.id === id)
        );
        
        // Identify cacheable data
        const cachePromises = [];
        
        for (const stage of stages) {
            if (stage.agent === 'writer' && this.bookDir) {
                // Pre-load outline for writers
                cachePromises.push(
                    this.cache.wrap(
                        `outline:${this.bookDir}`,
                        async () => {
                            const outlinePath = require('path').join(this.bookDir, 'outline.json');
                            return JSON.parse(await require('fs').promises.readFile(outlinePath, 'utf8'));
                        },
                        { ttl: 3600 }
                    )
                );
            }
            
            if (stage.agent === 'deep-research') {
                // Check if research is already cached
                const cacheKey = `research:${this.topic}`;
                cachePromises.push(
                    this.cache.get(cacheKey).then(cached => {
                        if (cached) {
                            console.log('📦 Research already cached, skipping API call');
                        }
                    })
                );
            }
        }
        
        if (cachePromises.length > 0) {
            console.log(`🔥 Pre-warming ${cachePromises.length} caches...`);
            await Promise.allSettled(cachePromises);
        }
    }

    async executeForEachStage(stage) {
        if (stage.foreach === 'chapters') {
            // Optimized chapter processing
            const outline = await this.getOutline();
            const chapters = outline.chapters;
            
            // Batch chapters for better throughput
            const batchSize = this.options.optimizations.batchSize || 10;
            const batches = [];
            
            for (let i = 0; i < chapters.length; i += batchSize) {
                batches.push(chapters.slice(i, i + batchSize));
            }
            
            console.log(`📚 Processing ${chapters.length} chapters in ${batches.length} batches...`);
            
            const results = [];
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length}: ${batch.length} chapters`);
                
                // Create jobs for batch
                const jobs = [];
                for (let i = 0; i < batch.length; i++) {
                    const chapterIndex = batchIndex * batchSize + i;
                    const job = await this.queueManager.addJob('writer', stage.agent, {
                        outline,
                        chapterNumber: chapterIndex + 1,
                        options: stage.config,
                        optimization: {
                            batch: batchIndex,
                            useCache: true
                        }
                    }, {
                        timeout: stage.timeout,
                        priority: batches.length - batchIndex // Higher priority for earlier batches
                    });
                    jobs.push(job);
                }
                
                // Wait for batch to complete
                const batchResults = await Promise.all(
                    jobs.map(job => job.waitUntilFinished(this.queueManager.events.writer))
                );
                
                results.push(...batchResults);
                
                // Brief pause between batches to prevent overload
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            return {
                success: results.every(r => r.result?.success),
                results
            };
        }
        
        return super.executeForEachStage(stage);
    }

    async getOutline() {
        // Cache the outline
        return await this.cache.wrap(
            `outline:${this.bookDir}`,
            async () => {
                const outlinePath = require('path').join(this.bookDir, 'outline.json');
                const outline = JSON.parse(await require('fs').promises.readFile(outlinePath, 'utf8'));
                outline.outputDir = this.bookDir;
                return outline;
            },
            { ttl: 3600 }
        );
    }

    async cleanup() {
        // Show performance stats
        console.log('\n📊 Performance Statistics:');
        
        if (this.cache) {
            const cacheStats = this.cache.getStats();
            console.log('\n📦 Cache Performance:');
            console.log(`   Memory: ${cacheStats.memory.hits}/${cacheStats.memory.hits + cacheStats.memory.misses} hits`);
            console.log(`   Size: ${cacheStats.memory.size}/${cacheStats.memory.maxSize}`);
        }
        
        if (this.connectionPool) {
            const poolStats = this.connectionPool.getStats();
            console.log('\n🌊 Connection Pool:');
            console.log(`   Anthropic: ${poolStats.anthropic.active}/${poolStats.anthropic.total} active`);
            console.log(`   Waiting: ${poolStats.anthropic.waiting}`);
        }
        
        // Cleanup
        await super.cleanup();
        
        if (this.cache) {
            await this.cache.disconnect();
        }
        
        if (this.connectionPool) {
            await this.connectionPool.close();
        }
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let topic = process.env.EBOOK_TOPIC;
    let pipeline = 'premium';
    let skipReview = false;
    let dryRun = false;
    const variables = {};
    const optimizations = {};
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--topic' && i + 1 < args.length) {
            topic = args[i + 1];
            i++;
        } else if (args[i] === '--pipeline' && i + 1 < args.length) {
            pipeline = args[i + 1];
            i++;
        } else if (args[i] === '--skip-review') {
            skipReview = true;
        } else if (args[i] === '--dry-run') {
            dryRun = true;
        } else if (args[i] === '--no-cache') {
            optimizations.cache = false;
        } else if (args[i] === '--parallel' && i + 1 < args.length) {
            optimizations.parallelChapters = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--batch-size' && i + 1 < args.length) {
            optimizations.batchSize = parseInt(args[i + 1]);
            i++;
        } else if (args[i].startsWith('--var-') && i + 1 < args.length) {
            const varName = args[i].substring(6);
            variables[varName] = args[i + 1];
            i++;
        } else if (args[i] === '--help') {
            console.log(`
Optimized Pipeline Orchestrator

Usage:
  node orchestrator-optimized.js "Topic" [options]
  node orchestrator-optimized.js --topic "Topic" [options]

Options:
  --pipeline <name>      Pipeline to use (default: "premium")
  --skip-review         Skip human review PR creation
  --dry-run             Show execution plan without running
  --no-cache            Disable smart caching
  --parallel <n>        Number of parallel chapter writers (default: 6)
  --batch-size <n>      Chapter batch size (default: 10)
  --var-<name> <value>  Set pipeline variable
  --help                Show this help

Optimizations:
  - Smart caching for research and chapters
  - Connection pooling for API calls
  - Parallel chapter processing
  - Batch execution for better throughput
  - Cache pre-warming

Examples:
  node orchestrator-optimized.js "AI Business Ideas"
  node orchestrator-optimized.js "AI Business Ideas" --parallel 8
  node orchestrator-optimized.js "AI Business Ideas" --no-cache --skip-review
`);
            process.exit(0);
        } else if (!args[i].startsWith('--')) {
            topic = args[i];
        }
    }
    
    if (!topic) {
        console.error('Error: No topic specified');
        console.error('Usage: node orchestrator-optimized.js "Topic"');
        process.exit(1);
    }
    
    const orchestrator = new OptimizedOrchestrator(topic, {
        pipeline,
        skipReview,
        dryRun,
        variables,
        optimizations
    });
    
    orchestrator.run()
        .then(result => {
            if (!dryRun) {
                console.log('\n✅ Optimized pipeline completed successfully!');
                console.log(`⏱️  Total time: ${((result.duration || 0) / 1000 / 60).toFixed(1)} minutes`);
                if (result.reviewUrl) {
                    console.log(`📝 Review your book at: ${result.reviewUrl}`);
                }
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Pipeline failed:', error);
            process.exit(1);
        });
}

module.exports = OptimizedOrchestrator;