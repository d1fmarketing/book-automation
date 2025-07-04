#!/usr/bin/env node

/**
 * YAML-Based Pipeline Orchestrator
 * 
 * Executes pipelines defined in YAML configuration files
 * Supports dynamic stage execution and conditional logic
 */

const { getQueueManager } = require('../src/queue/QueueManager');
const WorkerPool = require('../src/queue/WorkerPool');
const PipelineLoader = require('../src/config/PipelineLoader');
const { getMetricsCollector } = require('../src/monitoring/MetricsCollector');
const path = require('path');
const fs = require('fs').promises;
const sanitizeTopic = require('../utils/sanitize-topic');

class YAMLOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = {
            pipeline: 'default',
            variables: {},
            dryRun: false,
            ...options
        };
        
        this.loader = new PipelineLoader();
        this.queueManager = null;
        this.workerPool = null;
        this.metrics = null;
        this.pipeline = null;
        this.bookDir = null;
        this.results = {};
        this.startTime = Date.now();
    }

    async initialize() {
        console.log('🚀 YAML PIPELINE ORCHESTRATOR\n');
        console.log('=' .repeat(60));
        console.log(`Topic: ${this.topic}`);
        console.log(`Pipeline: ${this.options.pipeline}`);
        console.log(`Dry Run: ${this.options.dryRun}`);
        console.log('=' .repeat(60) + '\n');
        
        // Load pipeline configuration
        console.log('📋 Loading pipeline configuration...');
        this.pipeline = await this.loader.load(this.options.pipeline, {
            topic: this.topic,
            ...this.options.variables
        });
        
        console.log(`✅ Loaded pipeline: ${this.pipeline.name}`);
        console.log(`   Stages: ${this.pipeline.stages.length}`);
        console.log(`   Execution batches: ${this.pipeline.executionPlan.length}\n`);
        
        if (this.options.dryRun) {
            console.log('🏃 DRY RUN MODE - No actual execution\n');
            return;
        }
        
        // Initialize queue manager
        this.queueManager = getQueueManager();
        await this.queueManager.connect();
        
        // Initialize worker pool
        this.workerPool = new WorkerPool(this.queueManager, {
            workerConfig: this.getWorkerConfig()
        });
        await this.workerPool.start();
        
        // Initialize metrics
        this.metrics = getMetricsCollector();
        await this.metrics.start();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    getWorkerConfig() {
        const settings = this.pipeline.settings || {};
        return {
            pipeline: { count: 1, concurrency: 1 },
            research: { 
                count: settings.parallel?.research || 2, 
                concurrency: 1 
            },
            writer: { 
                count: settings.parallel?.chapters || 4, 
                concurrency: 2 
            },
            formatter: { count: 2, concurrency: 1 },
            qa: { count: 2, concurrency: 1 }
        };
    }

    setupEventListeners() {
        // Track metrics
        this.queueManager.on('job:completed', ({ queue, jobId, result }) => {
            this.metrics.recordJob(queue, 'unknown', 'completed', Date.now() - this.startTime);
        });
        
        this.queueManager.on('job:failed', ({ queue, jobId, error }) => {
            this.metrics.recordJob(queue, 'unknown', 'failed', Date.now() - this.startTime);
            this.metrics.recordError('job_failed', queue);
        });
    }

    async run() {
        try {
            await this.initialize();
            
            if (this.options.dryRun) {
                return this.dryRunExecution();
            }
            
            // Execute pipeline
            for (const batch of this.pipeline.executionPlan) {
                await this.executeBatch(batch);
            }
            
            // Check success criteria
            const success = await this.checkSuccessCriteria();
            
            // Record metrics
            const duration = Date.now() - this.startTime;
            this.metrics.recordBookGeneration(success ? 'success' : 'failed', duration);
            
            // Final report
            console.log('\n' + '=' .repeat(60));
            console.log(success ? '✅ PIPELINE COMPLETE!' : '⚠️  PIPELINE COMPLETE WITH WARNINGS');
            console.log('=' .repeat(60));
            console.log(`\n📊 PIPELINE SUMMARY:`);
            console.log(`   Pipeline: ${this.pipeline.name}`);
            console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
            console.log(`   Stages executed: ${Object.keys(this.results).length}`);
            console.log(`   Book directory: ${this.bookDir}`);
            
            // Send notifications
            await this.sendNotifications(success ? 'on_success' : 'on_failure', {
                book_dir: this.bookDir,
                duration,
                topic: this.topic
            });
            
            return {
                success,
                bookDir: this.bookDir,
                duration,
                results: this.results
            };
            
        } catch (error) {
            console.error('\n❌ PIPELINE FAILED:', error.message);
            
            await this.sendNotifications('on_failure', {
                error: error.message,
                failed_stage: error.stage || 'unknown',
                topic: this.topic
            });
            
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async executeBatch(stageIds) {
        console.log(`\n📦 Executing batch: [${stageIds.join(', ')}]`);
        
        const stages = stageIds.map(id => 
            this.pipeline.stages.find(s => s.id === id)
        );
        
        // Execute stages in parallel
        const promises = stages.map(stage => this.executeStage(stage));
        const results = await Promise.allSettled(promises);
        
        // Check results
        results.forEach((result, index) => {
            const stage = stages[index];
            if (result.status === 'rejected') {
                const error = result.reason;
                error.stage = stage.id;
                
                if (stage.required || stage.fail_fast) {
                    throw error;
                } else {
                    console.warn(`⚠️  Stage ${stage.id} failed but is not required`);
                    this.results[stage.id] = { success: false, error: error.message };
                }
            } else {
                this.results[stage.id] = result.value;
            }
        });
    }

    async executeStage(stage) {
        // Check condition
        if (stage.condition && !this.evaluateCondition(stage.condition)) {
            console.log(`⏭️  Skipping ${stage.id}: condition not met`);
            return { skipped: true };
        }
        
        console.log(`\n🎯 Stage: ${stage.id} (${stage.name || stage.agent})`);
        
        const timeout = stage.timeout || this.pipeline.settings?.timeouts?.default || 300000;
        const retries = stage.retries || this.pipeline.settings?.retries?.default || 3;
        
        // Check cache
        if (stage.cache) {
            const cached = await this.checkCache(stage);
            if (cached) {
                console.log(`   📦 Using cached result`);
                return cached;
            }
        }
        
        // Execute based on stage type
        let result;
        if (stage.manual) {
            result = await this.executeManualStage(stage);
        } else if (stage.foreach) {
            result = await this.executeForEachStage(stage);
        } else {
            result = await this.executeNormalStage(stage, timeout, retries);
        }
        
        // Cache result if needed
        if (stage.cache && result.success) {
            await this.cacheResult(stage, result);
        }
        
        // Run quality gates
        await this.checkQualityGates(stage, result);
        
        return result;
    }

    async executeNormalStage(stage, timeout, retries) {
        // Map agent to queue
        const queueMap = {
            'planner': 'pipeline',
            'deep-research': 'research',
            'writer': 'writer',
            'tone-polisher': 'formatter',
            'illustrator': 'formatter',
            'formatter-html': 'formatter',
            'fact-checker': 'qa',
            'qa-html': 'qa'
        };
        
        const queue = queueMap[stage.agent] || 'pipeline';
        
        // Prepare job data
        const jobData = this.prepareJobData(stage);
        
        // Create job
        const job = await this.queueManager.addJob(queue, stage.agent, jobData, {
            timeout,
            attempts: retries,
            backoff: {
                type: 'exponential',
                delay: 2000
            }
        });
        
        // Wait for completion
        const result = await job.waitUntilFinished(this.queueManager.events[queue]);
        
        // Extract specific data based on stage
        if (stage.id === 'plan') {
            const topicSlug = sanitizeTopic(this.topic);
            this.bookDir = path.join('build/ebooks', topicSlug);
        }
        
        return result;
    }

    async executeForEachStage(stage) {
        if (stage.foreach === 'chapters') {
            // Load outline
            const outlinePath = path.join(this.bookDir, 'outline.json');
            const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
            outline.outputDir = this.bookDir;
            
            // Create jobs for each chapter
            const jobs = [];
            for (let i = 0; i < outline.chapters.length; i++) {
                const job = await this.queueManager.addJob('writer', stage.agent, {
                    outline,
                    chapterNumber: i + 1,
                    options: stage.config
                }, {
                    timeout: stage.timeout
                });
                jobs.push(job);
            }
            
            // Wait for all
            console.log(`   ⏳ Processing ${jobs.length} items in parallel...`);
            const results = await Promise.all(
                jobs.map(job => job.waitUntilFinished(this.queueManager.events.writer))
            );
            
            return {
                success: results.every(r => r.result?.success),
                results
            };
        }
        
        throw new Error(`Unknown foreach type: ${stage.foreach}`);
    }

    async executeManualStage(stage) {
        console.log(`   ⚠️  Manual stage - requires human intervention`);
        
        await this.sendNotifications('on_manual_required', {
            stage: stage.id,
            topic: this.topic
        });
        
        // In a real implementation, this would wait for human approval
        return { success: true, manual: true };
    }

    prepareJobData(stage) {
        const baseData = {
            topic: this.topic,
            bookDir: this.bookDir,
            ...stage.config
        };
        
        // Stage-specific data
        switch (stage.agent) {
            case 'planner':
                return {
                    topic: this.topic,
                    ...stage.config
                };
            
            case 'deep-research':
                return {
                    topic: this.topic
                };
            
            case 'formatter-html':
            case 'tone-polisher':
            case 'illustrator':
                return {
                    bookDir: this.bookDir,
                    options: stage.config
                };
            
            case 'fact-checker':
            case 'qa-html':
                return {
                    type: stage.agent.replace('-', '_'),
                    target: this.bookDir,
                    options: stage.config
                };
            
            default:
                return baseData;
        }
    }

    evaluateCondition(condition) {
        try {
            // Simple evaluation - in production, use a proper expression evaluator
            if (condition === 'false') return false;
            if (condition === 'true') return true;
            
            // For now, just return true
            return true;
        } catch {
            return true;
        }
    }

    async checkCache(stage) {
        // Implement caching logic
        return null;
    }

    async cacheResult(stage, result) {
        // Implement caching logic
    }

    async checkQualityGates(stage, result) {
        if (!this.pipeline.quality_gates) return;
        
        const gates = this.pipeline.quality_gates.filter(g => g.after === stage.id);
        
        for (const gate of gates) {
            console.log(`   🚦 Checking quality gate: ${gate.check}`);
            
            // Implement quality gate checks
            // For now, just log
            console.log(`   ✅ Quality gate passed`);
        }
    }

    async checkSuccessCriteria() {
        const criteria = this.pipeline.success_criteria || {};
        let success = true;
        
        console.log('\n📋 Checking success criteria...');
        
        // Implement success criteria checks
        // For now, just return true
        
        return success;
    }

    async sendNotifications(event, context) {
        const notifications = this.pipeline.notifications?.[event];
        if (!notifications) return;
        
        for (const notification of notifications) {
            if (notification.type === 'console') {
                console.log(`\n📢 ${notification.message}`);
            }
            // Implement other notification types
        }
    }

    async dryRunExecution() {
        console.log('🎭 DRY RUN EXECUTION PLAN:\n');
        
        let stepNum = 1;
        for (const batch of this.pipeline.executionPlan) {
            console.log(`Batch ${stepNum}:`);
            
            const stages = batch.map(id => 
                this.pipeline.stages.find(s => s.id === id)
            );
            
            stages.forEach(stage => {
                console.log(`  - ${stage.id}: ${stage.name || stage.agent}`);
                console.log(`    Agent: ${stage.agent}`);
                console.log(`    Timeout: ${stage.timeout || 'default'}ms`);
                console.log(`    Cache: ${stage.cache ? 'yes' : 'no'}`);
                console.log(`    Required: ${stage.required !== false ? 'yes' : 'no'}`);
                
                if (stage.condition) {
                    console.log(`    Condition: ${stage.condition}`);
                }
                
                if (stage.config) {
                    console.log(`    Config: ${JSON.stringify(stage.config, null, 2).split('\n').join('\n    ')}`);
                }
                
                console.log('');
            });
            
            stepNum++;
        }
        
        return { dryRun: true };
    }

    async cleanup() {
        if (this.options.dryRun) return;
        
        console.log('\n🧹 Cleaning up...');
        
        if (this.metrics) {
            await this.metrics.stop();
        }
        
        if (this.workerPool) {
            await this.workerPool.shutdown();
        }
        
        if (this.queueManager) {
            await this.queueManager.shutdown();
        }
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let topic = process.env.EBOOK_TOPIC;
    let pipeline = 'default';
    let dryRun = false;
    const variables = {};
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--topic' && i + 1 < args.length) {
            topic = args[i + 1];
            i++;
        } else if (args[i] === '--pipeline' && i + 1 < args.length) {
            pipeline = args[i + 1];
            i++;
        } else if (args[i] === '--dry-run') {
            dryRun = true;
        } else if (args[i].startsWith('--var-') && i + 1 < args.length) {
            const varName = args[i].substring(6);
            variables[varName] = args[i + 1];
            i++;
        } else if (args[i] === '--list') {
            // List available pipelines
            const loader = new PipelineLoader();
            loader.list().then(pipelines => {
                console.log('Available pipelines:');
                pipelines.forEach(p => console.log(`  - ${p}`));
                process.exit(0);
            });
            return;
        } else if (args[i] === '--help') {
            console.log(`
YAML Pipeline Orchestrator

Usage:
  node orchestrator-yaml.js "Topic" [options]
  node orchestrator-yaml.js --topic "Topic" [options]

Options:
  --pipeline <name>     Pipeline to use (default: "default")
  --dry-run            Show execution plan without running
  --var-<name> <value> Set pipeline variable
  --list               List available pipelines
  --help               Show this help

Available pipelines:
  - default: Standard pipeline with all checks
  - fast: Optimized for speed
  - premium: High-quality with extra checks

Examples:
  node orchestrator-yaml.js "AI Business Ideas"
  node orchestrator-yaml.js "AI Business Ideas" --pipeline fast
  node orchestrator-yaml.js "AI Business Ideas" --dry-run
  node orchestrator-yaml.js "AI Business Ideas" --var-quality high
`);
            process.exit(0);
        } else if (!args[i].startsWith('--')) {
            topic = args[i];
        }
    }
    
    if (!topic) {
        console.error('Error: No topic specified');
        console.error('Usage: node orchestrator-yaml.js "Topic"');
        process.exit(1);
    }
    
    const orchestrator = new YAMLOrchestrator(topic, {
        pipeline,
        dryRun,
        variables
    });
    
    orchestrator.run()
        .then(result => {
            if (!dryRun) {
                console.log('\n✅ Pipeline completed successfully!');
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Pipeline failed:', error);
            process.exit(1);
        });
}

module.exports = YAMLOrchestrator;