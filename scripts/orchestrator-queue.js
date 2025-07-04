#!/usr/bin/env node

/**
 * Queue-Based Pipeline Orchestrator
 * 
 * Uses BullMQ for distributed job processing
 * Enables parallel execution and better error handling
 */

const { getQueueManager } = require('../src/queue/QueueManager');
const WorkerPool = require('../src/queue/WorkerPool');
const path = require('path');
const fs = require('fs').promises;
const sanitizeTopic = require('../utils/sanitize-topic');

class QueueOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = {
            maxAttempts: 3,
            parallel: {
                chapters: 4,
                research: 2
            },
            timeout: {
                plan: 60000,      // 1 minute
                research: 120000, // 2 minutes
                chapter: 180000,  // 3 minutes per chapter
                format: 60000,    // 1 minute
                qa: 60000        // 1 minute
            },
            ...options
        };
        
        this.queueManager = null;
        this.workerPool = null;
        this.bookDir = null;
        this.pipelineJobId = null;
    }

    async initialize() {
        console.log('🚀 QUEUE-BASED PIPELINE ORCHESTRATOR\n');
        console.log('=' .repeat(60));
        console.log(`Topic: ${this.topic}`);
        console.log(`Parallel chapters: ${this.options.parallel.chapters}`);
        console.log('=' .repeat(60) + '\n');
        
        // Initialize queue manager
        this.queueManager = getQueueManager({
            queues: {
                pipeline: { concurrency: 1 },
                research: { concurrency: this.options.parallel.research },
                writer: { concurrency: this.options.parallel.chapters },
                formatter: { concurrency: 2 },
                qa: { concurrency: 2 }
            }
        });
        
        await this.queueManager.connect();
        
        // Initialize worker pool
        this.workerPool = new WorkerPool(this.queueManager, {
            workerConfig: {
                pipeline: { count: 1, concurrency: 1 },
                research: { count: 2, concurrency: 1 },
                writer: { count: this.options.parallel.chapters, concurrency: 2 },
                formatter: { count: 2, concurrency: 1 },
                qa: { count: 2, concurrency: 1 }
            }
        });
        
        await this.workerPool.start();
        
        // Set up event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Job completion tracking
        this.queueManager.on('job:completed', ({ queue, jobId, result }) => {
            console.log(`✅ [${queue}] Job ${jobId} completed`);
        });
        
        this.queueManager.on('job:failed', ({ queue, jobId, error }) => {
            console.error(`❌ [${queue}] Job ${jobId} failed: ${error}`);
        });
        
        this.queueManager.on('job:progress', ({ queue, jobId, progress }) => {
            console.log(`📊 [${queue}] Job ${jobId} progress: ${progress}%`);
        });
        
        // Worker monitoring
        this.queueManager.on('workers:stats', (stats) => {
            for (const [queue, queueStats] of Object.entries(stats)) {
                if (queueStats.utilization > 80) {
                    console.log(`⚡ ${queue}: ${queueStats.utilization}% utilized`);
                }
            }
        });
    }

    async run() {
        try {
            await this.initialize();
            
            // Create main pipeline job
            this.pipelineJobId = `pipeline-${Date.now()}`;
            
            // Execute pipeline stages
            await this.executePlan();
            await this.executeResearch();
            await this.executeWriting();
            await this.executePolishing();
            await this.executeIllustration();
            await this.executeFormatting();
            await this.executeQA();
            
            // Get final statistics
            const stats = await this.queueManager.getGlobalStats();
            
            console.log('\n' + '=' .repeat(60));
            console.log('✅ PIPELINE COMPLETE!');
            console.log('=' .repeat(60));
            console.log('\n📊 FINAL STATISTICS:');
            console.log(`   Total jobs processed: ${stats.global.processed}`);
            console.log(`   Failed jobs: ${stats.global.failed}`);
            console.log(`   Book directory: ${this.bookDir}`);
            
            return {
                success: true,
                bookDir: this.bookDir,
                stats: stats.global
            };
            
        } catch (error) {
            console.error('\n❌ PIPELINE FAILED:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    async executePlan() {
        console.log('\n📋 Stage: PLANNING');
        
        const job = await this.queueManager.addJob('pipeline', 'plan', {
            topic: this.topic,
            bookStyle: 'how-to',
            chapters: 10
        }, {
            timeout: this.options.timeout.plan
        });
        
        const result = await job.waitUntilFinished(this.queueManager.events.pipeline);
        
        if (!result.success) {
            throw new Error('Planning failed');
        }
        
        // Extract book directory from planner result
        const topicSlug = sanitizeTopic(this.topic);
        this.bookDir = path.join('build/ebooks', topicSlug);
        
        console.log(`   ✅ Outline created: ${this.bookDir}`);
    }

    async executeResearch() {
        console.log('\n🔍 Stage: RESEARCH');
        
        const job = await this.queueManager.addJob('research', 'deep-research', {
            topic: this.topic
        }, {
            timeout: this.options.timeout.research
        });
        
        const result = await job.waitUntilFinished(this.queueManager.events.research);
        
        if (!result.success) {
            throw new Error('Research failed');
        }
        
        console.log(`   ✅ Research completed`);
    }

    async executeWriting() {
        console.log('\n✍️  Stage: WRITING');
        
        // Load outline
        const outlinePath = path.join(this.bookDir, 'outline.json');
        const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
        outline.outputDir = this.bookDir;
        
        // Create jobs for all chapters
        const chapterJobs = [];
        for (let i = 0; i < outline.chapters.length; i++) {
            const job = await this.queueManager.addJob('writer', 'write-chapter', {
                outline,
                chapterNumber: i + 1,
                options: {
                    style: 'conversational',
                    includeResearch: true
                }
            }, {
                timeout: this.options.timeout.chapter,
                jobId: `chapter-${i + 1}-${Date.now()}`
            });
            
            chapterJobs.push(job);
            console.log(`   📝 Queued chapter ${i + 1}: ${outline.chapters[i].title}`);
        }
        
        // Wait for all chapters to complete
        console.log(`   ⏳ Writing ${chapterJobs.length} chapters in parallel...`);
        
        const results = await Promise.all(
            chapterJobs.map(job => 
                job.waitUntilFinished(this.queueManager.events.writer)
            )
        );
        
        // Check results
        const failed = results.filter(r => !r.result?.success);
        if (failed.length > 0) {
            throw new Error(`${failed.length} chapters failed to generate`);
        }
        
        console.log(`   ✅ All ${outline.chapters.length} chapters written`);
    }

    async executePolishing() {
        console.log('\n✨ Stage: POLISHING');
        
        const job = await this.queueManager.addJob('formatter', 'polish', {
            bookDir: this.bookDir,
            options: {
                brandVoice: 'conversational',
                preserveData: true
            }
        }, {
            timeout: this.options.timeout.format
        });
        
        await job.waitUntilFinished(this.queueManager.events.formatter);
        console.log(`   ✅ Content polished`);
    }

    async executeIllustration() {
        console.log('\n🎨 Stage: ILLUSTRATION');
        
        const job = await this.queueManager.addJob('formatter', 'illustrate', {
            bookDir: this.bookDir
        }, {
            timeout: this.options.timeout.format
        });
        
        await job.waitUntilFinished(this.queueManager.events.formatter);
        console.log(`   ✅ Images generated`);
    }

    async executeFormatting() {
        console.log('\n📄 Stage: FORMATTING');
        
        const job = await this.queueManager.addJob('formatter', 'format-html', {
            bookDir: this.bookDir,
            options: {
                template: 'professional',
                features: {
                    toc: true,
                    darkMode: true,
                    readingProgress: true
                }
            }
        }, {
            timeout: this.options.timeout.format
        });
        
        const result = await job.waitUntilFinished(this.queueManager.events.formatter);
        
        if (!result.result?.success) {
            throw new Error('HTML formatting failed');
        }
        
        console.log(`   ✅ HTML generated`);
    }

    async executeQA() {
        console.log('\n🔍 Stage: QUALITY ASSURANCE');
        
        // Run fact checking and HTML QA in parallel
        const qaJobs = [
            this.queueManager.addJob('qa', 'fact-check', {
                type: 'fact-check',
                target: this.bookDir,
                options: { strictMode: true }
            }, {
                timeout: this.options.timeout.qa
            }),
            
            this.queueManager.addJob('qa', 'html-qa', {
                type: 'html-qa',
                target: path.join(this.bookDir, 'html', 'index.html'),
                options: { lighthouse: 90 }
            }, {
                timeout: this.options.timeout.qa
            })
        ];
        
        const [factCheckJob, htmlQAJob] = await Promise.all(qaJobs);
        
        console.log('   ⏳ Running QA checks in parallel...');
        
        const [factResult, htmlResult] = await Promise.all([
            factCheckJob.waitUntilFinished(this.queueManager.events.qa),
            htmlQAJob.waitUntilFinished(this.queueManager.events.qa)
        ]);
        
        // Check results
        if (factResult.result?.summary?.FACT_CHECK_NEEDED) {
            console.warn('   ⚠️  Manual fact-check needed');
        } else {
            console.log('   ✅ Fact check passed');
        }
        
        if (htmlResult.result?.failed > 0) {
            throw new Error(`HTML QA failed: ${htmlResult.result.failed} issues`);
        }
        
        console.log('   ✅ HTML QA passed');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        if (this.workerPool) {
            await this.workerPool.shutdown();
        }
        
        if (this.queueManager) {
            // Clean old completed jobs
            await this.queueManager.cleanJobs('pipeline', 0, 100, 'completed');
            await this.queueManager.cleanJobs('writer', 0, 100, 'completed');
            
            await this.queueManager.shutdown();
        }
    }

    /**
     * Monitor pipeline progress
     */
    async monitorProgress() {
        const interval = setInterval(async () => {
            const stats = await this.queueManager.getGlobalStats();
            
            console.log('\n📊 Pipeline Progress:');
            console.log(`   Active: ${stats.global.active}`);
            console.log(`   Waiting: ${stats.global.waiting}`);
            console.log(`   Completed: ${stats.global.processed}`);
            console.log(`   Failed: ${stats.global.failed}`);
            
            if (stats.global.active === 0 && stats.global.waiting === 0) {
                clearInterval(interval);
            }
        }, 5000);
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let topic = process.env.EBOOK_TOPIC;
    let monitor = false;
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--topic' && i + 1 < args.length) {
            topic = args[i + 1];
            i++;
        } else if (args[i] === '--monitor') {
            monitor = true;
        } else if (!args[i].startsWith('--')) {
            topic = args[i];
        }
    }
    
    if (!topic) {
        console.error('Usage: node orchestrator-queue.js "Topic"');
        console.error('   or: node orchestrator-queue.js --topic "Topic" [--monitor]');
        process.exit(1);
    }
    
    const orchestrator = new QueueOrchestrator(topic, {
        parallel: {
            chapters: parseInt(process.env.MAX_WORKERS) || 4
        }
    });
    
    if (monitor) {
        orchestrator.monitorProgress();
    }
    
    orchestrator.run()
        .then(result => {
            console.log('\n✅ Pipeline completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Pipeline failed:', error);
            process.exit(1);
        });
}

module.exports = QueueOrchestrator;