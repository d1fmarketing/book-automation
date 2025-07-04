/**
 * Job Processor
 * 
 * Processes different types of jobs in the ebook pipeline
 * Maps job types to agent implementations
 */

const path = require('path');
const fs = require('fs').promises;

class JobProcessor {
    constructor(options = {}) {
        this.options = {
            agentsPath: path.join(__dirname, '../../agents'),
            timeout: 300000, // 5 minutes default
            ...options
        };
        
        // Cache agent instances
        this.agents = {};
        
        // Job type to agent mapping
        this.agentMapping = {
            'plan': 'planner',
            'research': 'deep-research',
            'write-chapter': 'writer',
            'polish': 'tone-polisher',
            'illustrate': 'illustrator',
            'format': 'formatter-html',
            'fact-check': 'fact-checker',
            'affiliate': 'affiliate-injector',
            'qa-html': '../qa/qa-html-mcp',
            'refurbish-book': '../workers/refurbish-worker'
        };
    }

    /**
     * Main processor function for workers
     */
    async process(job) {
        const { name, data, opts } = job;
        const startTime = Date.now();
        
        console.log(`\n🔧 Processing job ${job.id}: ${name}`);
        console.log(`📊 Queue: ${job.queueName}`);
        console.log(`🎯 Attempt: ${job.attemptsMade + 1}/${opts.attempts || 3}`);
        
        try {
            // Update job progress
            await job.updateProgress(0);
            
            // Process based on job type
            let result;
            switch (job.queueName) {
                case 'pipeline':
                    result = await this.processPipelineJob(job);
                    break;
                case 'research':
                    result = await this.processResearchJob(job);
                    break;
                case 'writer':
                    result = await this.processWriterJob(job);
                    break;
                case 'formatter':
                    result = await this.processFormatterJob(job);
                    break;
                case 'qa':
                    result = await this.processQAJob(job);
                    break;
                case 'refurbish':
                    result = await this.processRefurbishJob(job);
                    break;
                default:
                    throw new Error(`Unknown queue type: ${job.queueName}`);
            }
            
            // Calculate duration
            const duration = Date.now() - startTime;
            
            // Log success
            console.log(`✅ Job ${job.id} completed in ${(duration / 1000).toFixed(1)}s`);
            
            // Return result with metadata
            return {
                success: true,
                result,
                duration,
                timestamp: Date.now()
            };
            
        } catch (error) {
            // Log error
            console.error(`❌ Job ${job.id} failed:`, error.message);
            
            // Add error context
            error.jobId = job.id;
            error.jobName = name;
            error.attemptsMade = job.attemptsMade;
            
            // Re-throw for BullMQ to handle
            throw error;
        }
    }

    /**
     * Process pipeline orchestration jobs
     */
    async processPipelineJob(job) {
        const { topic, options = {} } = job.data;
        
        await job.updateProgress(10);
        
        // This would typically create child jobs for each stage
        // For now, return a plan
        return {
            topic,
            stages: ['plan', 'research', 'write', 'format', 'qa'],
            options
        };
    }

    /**
     * Process research jobs
     */
    async processResearchJob(job) {
        const { topic } = job.data;
        
        await job.updateProgress(20);
        
        // Load research agent
        const research = await this.loadAgent('research');
        
        await job.updateProgress(50);
        
        // Execute research
        const result = await research({ topic });
        
        await job.updateProgress(100);
        
        return result;
    }

    /**
     * Process writer jobs
     */
    async processWriterJob(job) {
        const { outline, chapterNumber, options = {} } = job.data;
        
        await job.updateProgress(10);
        
        // Load writer agent
        const writerModule = await this.loadAgent('write-chapter');
        
        if (!writerModule.Writer) {
            throw new Error('Writer module does not export Writer class');
        }
        
        await job.updateProgress(20);
        
        // Create writer instance
        const Writer = writerModule.Writer;
        const writer = new Writer({
            style: options.style || 'conversational',
            includeResearch: options.includeResearch !== false
        });
        
        await job.updateProgress(30);
        
        // Generate chapter
        const result = await writer.generateChapter(outline, chapterNumber, options);
        
        await job.updateProgress(90);
        
        // Save chapter if successful
        if (result.success && result.content) {
            const chapterFile = path.join(
                outline.outputDir,
                `chapter-${String(chapterNumber).padStart(2, '0')}.md`
            );
            await fs.writeFile(chapterFile, result.content);
        }
        
        await job.updateProgress(100);
        
        return result;
    }

    /**
     * Process formatter jobs
     */
    async processFormatterJob(job) {
        const { bookDir, options = {} } = job.data;
        
        await job.updateProgress(10);
        
        // Load formatter agent
        const FormatterHTML = await this.loadAgent('format');
        const formatter = new FormatterHTML(options);
        
        await job.updateProgress(30);
        
        // Format book
        const result = await formatter.formatBook(bookDir);
        
        await job.updateProgress(100);
        
        return result;
    }

    /**
     * Process QA jobs
     */
    async processQAJob(job) {
        const { type, target, options = {} } = job.data;
        
        await job.updateProgress(10);
        
        let result;
        
        switch (type) {
            case 'fact-check': {
                const FactChecker = await this.loadAgent('fact-check');
                const checker = new FactChecker(options);
                result = await checker.checkBook(target);
                break;
            }
            
            case 'html-qa': {
                const { runQATests } = await this.loadAgent('qa-html');
                result = await runQATests(target);
                break;
            }
            
            default:
                throw new Error(`Unknown QA type: ${type}`);
        }
        
        await job.updateProgress(100);
        
        return result;
    }

    /**
     * Process refurbish jobs
     */
    async processRefurbishJob(job) {
        const { bookDir, options = {} } = job.data;
        
        await job.updateProgress(5);
        
        // Load refurbish worker
        const RefurbishWorker = await this.loadAgent('refurbish-book');
        const worker = new RefurbishWorker();
        
        await job.updateProgress(10);
        
        // Process the refurbish job
        const result = await worker.processJob(job);
        
        await job.updateProgress(100);
        
        return result;
    }

    /**
     * Load an agent module
     */
    async loadAgent(agentType) {
        // Check cache
        if (this.agents[agentType]) {
            return this.agents[agentType];
        }
        
        // Get agent path
        const agentPath = this.agentMapping[agentType];
        if (!agentPath) {
            throw new Error(`Unknown agent type: ${agentType}`);
        }
        
        // Load module
        const fullPath = path.join(this.options.agentsPath, agentPath);
        const agent = require(fullPath);
        
        // Cache for reuse
        this.agents[agentType] = agent;
        
        return agent;
    }

    /**
     * Create processor functions for different queues
     */
    static createProcessors() {
        const processor = new JobProcessor();
        
        return {
            pipeline: processor.process.bind(processor),
            research: processor.process.bind(processor),
            writer: processor.process.bind(processor),
            formatter: processor.process.bind(processor),
            qa: processor.process.bind(processor),
            refurbish: processor.process.bind(processor)
        };
    }

    /**
     * Create a sandboxed processor with timeout
     */
    static createSandboxedProcessor(processor, timeout = 300000) {
        return async (job) => {
            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Job timeout after ${timeout}ms`));
                }, timeout);
            });
            
            // Race between processor and timeout
            try {
                return await Promise.race([
                    processor(job),
                    timeoutPromise
                ]);
            } catch (error) {
                // Add timeout flag if it was a timeout
                if (error.message.includes('timeout')) {
                    error.isTimeout = true;
                }
                throw error;
            }
        };
    }
}

module.exports = JobProcessor;