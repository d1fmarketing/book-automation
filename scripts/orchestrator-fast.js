#!/usr/bin/env node

/**
 * Fast Pipeline Orchestrator
 * 
 * Optimized version with:
 * - Parallel processing
 * - Performance monitoring
 * - Incremental caching
 * - Timeout controls
 * - Better error recovery
 */

const fs = require('fs').promises;
const path = require('path');
const { Worker } = require('worker_threads');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const sanitizeTopic = require('../utils/sanitize-topic');

// Performance monitoring
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.startTimes = {};
    }

    start(label) {
        this.startTimes[label] = process.hrtime.bigint();
        console.log(`⏱️  [${label}] Started at ${new Date().toISOString()}`);
    }

    end(label) {
        if (!this.startTimes[label]) return;
        
        const endTime = process.hrtime.bigint();
        const durationMs = Number((endTime - this.startTimes[label]) / 1000000n);
        
        this.metrics[label] = {
            duration: durationMs,
            durationReadable: this.formatDuration(durationMs),
            timestamp: new Date().toISOString()
        };
        
        console.log(`⏱️  [${label}] Completed in ${this.metrics[label].durationReadable}`);
        delete this.startTimes[label];
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    }

    getReport() {
        const totalTime = Object.values(this.metrics)
            .reduce((sum, m) => sum + m.duration, 0);
        
        return {
            totalTime: this.formatDuration(totalTime),
            stages: this.metrics,
            bottlenecks: Object.entries(this.metrics)
                .sort((a, b) => b[1].duration - a[1].duration)
                .slice(0, 3)
                .map(([stage, data]) => ({
                    stage,
                    duration: data.durationReadable
                }))
        };
    }
}

// Cache manager for incremental builds
class CacheManager {
    constructor(cacheDir = 'build/.cache') {
        this.cacheDir = cacheDir;
        this.manifest = null;
    }

    async init() {
        await fs.mkdir(this.cacheDir, { recursive: true });
        await this.loadManifest();
    }

    async loadManifest() {
        try {
            const data = await fs.readFile(path.join(this.cacheDir, 'manifest.json'), 'utf8');
            this.manifest = JSON.parse(data);
        } catch {
            this.manifest = {
                version: '1.0',
                entries: {},
                created: new Date().toISOString()
            };
        }
    }

    async saveManifest() {
        await fs.writeFile(
            path.join(this.cacheDir, 'manifest.json'),
            JSON.stringify(this.manifest, null, 2)
        );
    }

    getCacheKey(stage, input) {
        const content = JSON.stringify(input);
        const hash = require('crypto').createHash('md5').update(content).digest('hex');
        return `${stage}-${hash}`;
    }

    async get(stage, input) {
        const key = this.getCacheKey(stage, input);
        const entry = this.manifest.entries[key];
        
        if (!entry) return null;
        
        // Check if cache is still valid (24 hours)
        const age = Date.now() - new Date(entry.timestamp).getTime();
        if (age > 24 * 60 * 60 * 1000) {
            delete this.manifest.entries[key];
            return null;
        }
        
        try {
            const data = await fs.readFile(path.join(this.cacheDir, entry.file), 'utf8');
            console.log(`   📦 Cache hit for ${stage}`);
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    async set(stage, input, output) {
        const key = this.getCacheKey(stage, input);
        const filename = `${key}.json`;
        
        await fs.writeFile(
            path.join(this.cacheDir, filename),
            JSON.stringify(output, null, 2)
        );
        
        this.manifest.entries[key] = {
            file: filename,
            timestamp: new Date().toISOString(),
            stage
        };
        
        await this.saveManifest();
    }

    async clear() {
        const files = await fs.readdir(this.cacheDir);
        await Promise.all(
            files.map(file => fs.unlink(path.join(this.cacheDir, file)))
        );
        this.manifest = {
            version: '1.0',
            entries: {},
            created: new Date().toISOString()
        };
        await this.saveManifest();
    }
}

// Timeout wrapper for agents
async function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Timeout after ${timeoutMs}ms: ${label}`));
        }, timeoutMs);
    });
    
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Fast Orchestrator
class FastPipelineOrchestrator {
    constructor(topic, options = {}) {
        this.topic = topic;
        this.options = options;
        this.monitor = new PerformanceMonitor();
        this.cache = new CacheManager(options.cacheDir);
        this.bookDir = null;
        this.results = {};
        this.errors = [];
        
        // Configuration
        this.timeouts = {
            PLAN: 30000,      // 30s
            RESEARCH: 120000, // 2m
            WRITE: 300000,    // 5m total for all chapters
            POLISH: 120000,   // 2m
            ILLUSTRATE: 60000,// 1m
            FORMAT: 30000,    // 30s
            QA_FACT: 60000,   // 1m
            AFFILIATE: 30000, // 30s
            QA_HTML: 60000    // 1m
        };
        
        this.parallelConfig = {
            maxChapterWorkers: 4,  // Write 4 chapters in parallel
            batchSize: 3          // Process in batches
        };
    }

    async initialize() {
        await this.cache.init();
        await fs.mkdir('build', { recursive: true });
        await fs.mkdir('build/logs', { recursive: true });
        
        // Create performance log
        this.perfLogPath = path.join('build/logs', `perf-${Date.now()}.json`);
    }

    async runStage(stageName, fn) {
        console.log(`\n🚀 Stage: ${stageName}`);
        this.monitor.start(stageName);
        
        try {
            // Check cache first
            const cacheKey = { stage: stageName, topic: this.topic };
            const cached = await this.cache.get(stageName, cacheKey);
            
            if (cached && !this.options.noCache) {
                this.results[stageName] = cached;
                this.monitor.end(stageName);
                return cached;
            }
            
            // Run with timeout
            const timeout = this.timeouts[stageName] || 60000;
            const result = await withTimeout(fn(), timeout, stageName);
            
            // Cache successful results
            if (result.success !== false) {
                await this.cache.set(stageName, cacheKey, result);
            }
            
            this.results[stageName] = result;
            this.monitor.end(stageName);
            return result;
            
        } catch (error) {
            this.monitor.end(stageName);
            console.error(`   ❌ ${stageName} failed: ${error.message}`);
            this.errors.push({ stage: stageName, error: error.message });
            throw error;
        }
    }

    // Agent implementations with caching and timeouts
    async runPlan() {
        const Planner = require('../agents/planner');
        const planner = new Planner({ bookStyle: 'how-to', depth: 'intermediate' });
        const topicSlug = sanitizeTopic(this.topic);
        
        const result = await planner.createOutline(this.topic, {
            chapters: 10,
            outputDir: `build/ebooks/${topicSlug}`
        });
        
        if (!result.success) throw new Error(result.error);
        this.bookDir = result.outline.outputDir;
        return result;
    }

    async runResearch() {
        const deepResearch = require('../agents/deep-research');
        const research = await deepResearch({ topic: this.topic });
        
        // Save research context
        await fs.mkdir('context', { recursive: true });
        await fs.writeFile('context/research.yaml', 
            `topic: ${this.topic}\nsummary: ${research.summary}\nlinks:\n${research.links.map(l => `  - ${l}`).join('\n')}`
        );
        
        return research;
    }

    async runWriteParallel() {
        console.log(`   📝 Writing chapters in parallel (${this.parallelConfig.maxChapterWorkers} workers)`);
        
        const writerModule = require('../agents/writer');
        const Writer = writerModule.Writer;
        const writer = new Writer({ style: 'conversational', includeResearch: true });
        
        // Load outline
        const outlinePath = path.join(this.bookDir, 'outline.json');
        const outline = JSON.parse(await fs.readFile(outlinePath, 'utf8'));
        outline.outputDir = this.bookDir;
        
        // Split chapters into batches
        const chapters = outline.chapters;
        const batches = [];
        for (let i = 0; i < chapters.length; i += this.parallelConfig.batchSize) {
            batches.push(chapters.slice(i, i + this.parallelConfig.batchSize));
        }
        
        const results = [];
        
        // Process batches sequentially, chapters within batch in parallel
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`   📚 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} chapters)`);
            
            const batchPromises = batch.map(async (chapter) => {
                try {
                    const result = await writer.generateChapter(outline, chapter.number);
                    
                    if (result.success && result.content) {
                        const chapterFile = path.join(this.bookDir, `chapter-${String(chapter.number).padStart(2, '0')}.md`);
                        await fs.writeFile(chapterFile, result.content);
                    }
                    
                    return result;
                } catch (error) {
                    console.error(`   ❌ Chapter ${chapter.number} failed: ${error.message}`);
                    return { success: false, error: error.message, chapterNumber: chapter.number };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        // Check if all chapters succeeded
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            throw new Error(`${failed.length} chapters failed to generate`);
        }
        
        return { success: true, results };
    }

    async runPolish() {
        const TonePolisher = require('../agents/tone-polisher');
        const polisher = new TonePolisher({ brandVoice: 'conversational', preserveData: true });
        return await polisher.polishBook(this.bookDir);
    }

    async runIllustrate() {
        const Illustrator = require('../agents/illustrator');
        const illustrator = new Illustrator();
        const result = await illustrator.generateBookImages(this.bookDir);
        
        // Verify cover
        const coverPath = path.join(this.bookDir, 'assets', 'images', 'cover.png');
        const stats = await fs.stat(coverPath);
        if (stats.size < 100) {
            throw new Error('Cover image too small');
        }
        
        return result;
    }

    async runFormat() {
        const formatterModule = require('../agents/formatter-html');
        let result;
        
        if (formatterModule.FormatterHTML) {
            const FormatterHTML = formatterModule.FormatterHTML;
            const formatter = new FormatterHTML();
            result = await formatter.formatBook(this.bookDir);
        } else if (typeof formatterModule === 'function') {
            const htmlContent = await formatterModule();
            const htmlDir = path.join(this.bookDir, 'html');
            await fs.mkdir(htmlDir, { recursive: true });
            await fs.writeFile(path.join(htmlDir, 'index.html'), htmlContent);
            result = { success: true, outputDir: htmlDir };
        }
        
        // Quick validation
        const htmlPath = path.join(this.bookDir, 'html', 'index.html');
        const htmlContent = await fs.readFile(htmlPath, 'utf8');
        
        if (htmlContent.includes('[object Object]')) {
            throw new Error('HTML contains [object Object]');
        }
        
        if (htmlContent.includes('<hundefined')) {
            throw new Error('HTML contains <hundefined> tags');
        }
        
        return result;
    }

    async runFactCheck() {
        const FactChecker = require('../agents/fact-checker');
        const checker = new FactChecker({ maxCalls: 5, strictMode: true });
        const result = await checker.checkBook(this.bookDir);
        
        if (result.summary.FACT_CHECK_NEEDED) {
            throw new Error('Manual fact-check needed');
        }
        
        return result;
    }

    async runAffiliate() {
        const AffiliateInjector = require('../agents/affiliate-injector');
        const injector = new AffiliateInjector({ 
            networks: ['amazon', 'shareasale'],
            strategy: 'natural'
        });
        return await injector.processEbookDirectory(this.bookDir);
    }

    async runQAHTML() {
        // Use simplified QA for speed
        const { runQATests } = require('../qa/qa-html-simple');
        const htmlPath = path.join(this.bookDir, 'html', 'index.html');
        const qaResults = await runQATests(htmlPath);
        
        if (qaResults.failed > 0) {
            throw new Error(`QA tests failed: ${qaResults.failed} failures`);
        }
        
        return qaResults;
    }

    async run() {
        console.log('🚀 FAST PIPELINE ORCHESTRATOR\n');
        console.log('=' .repeat(60));
        console.log(`Topic: ${this.topic}`);
        console.log(`Cache: ${this.options.noCache ? 'Disabled' : 'Enabled'}`);
        console.log(`Parallel: ${this.parallelConfig.maxChapterWorkers} workers`);
        console.log('=' .repeat(60));

        this.monitor.start('TOTAL');
        
        try {
            await this.initialize();
            
            // Stage 1: Planning
            await this.runStage('PLAN', () => this.runPlan());
            
            // Stage 2: Research (can cache)
            await this.runStage('RESEARCH', () => this.runResearch());
            
            // Stage 3: Write chapters in parallel
            await this.runStage('WRITE', () => this.runWriteParallel());
            
            // Stage 4: Polish and Illustrate in parallel
            const [polishResult, illustrateResult] = await Promise.all([
                this.runStage('POLISH', () => this.runPolish()),
                this.runStage('ILLUSTRATE', () => this.runIllustrate())
            ]);
            
            // Stage 5: Format HTML
            await this.runStage('FORMAT', () => this.runFormat());
            
            // Stage 6: QA and Affiliate in parallel
            const [factResult, affiliateResult] = await Promise.all([
                this.runStage('QA_FACT', () => this.runFactCheck()),
                this.runStage('AFFILIATE', () => this.runAffiliate())
            ]);
            
            // Stage 7: Final HTML QA
            await this.runStage('QA_HTML', () => this.runQAHTML());
            
            this.monitor.end('TOTAL');
            
            // Generate performance report
            const perfReport = this.monitor.getReport();
            await fs.writeFile(this.perfLogPath, JSON.stringify(perfReport, null, 2));
            
            // Final report
            console.log('\n' + '=' .repeat(60));
            console.log('✅ PIPELINE COMPLETE!');
            console.log('=' .repeat(60));
            console.log(`\n📊 PERFORMANCE REPORT:`);
            console.log(`   Total time: ${perfReport.totalTime}`);
            console.log(`   Book directory: ${this.bookDir}`);
            console.log(`\n🐌 Top bottlenecks:`);
            perfReport.bottlenecks.forEach(b => {
                console.log(`   - ${b.stage}: ${b.duration}`);
            });
            console.log(`\n📈 Full report: ${this.perfLogPath}`);
            
            return {
                success: true,
                bookDir: this.bookDir,
                performance: perfReport,
                errors: this.errors
            };
            
        } catch (error) {
            this.monitor.end('TOTAL');
            console.error('\n❌ PIPELINE FAILED:', error.message);
            
            // Save error report
            const errorReport = {
                error: error.message,
                stage: this.monitor.startTimes,
                performance: this.monitor.getReport(),
                errors: this.errors
            };
            
            await fs.writeFile(
                path.join('build/logs', `error-${Date.now()}.json`),
                JSON.stringify(errorReport, null, 2)
            );
            
            throw error;
        }
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let topic = process.env.EBOOK_TOPIC;
    let noCache = false;
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--topic' && i + 1 < args.length) {
            topic = args[i + 1];
            i++;
        } else if (args[i] === '--no-cache') {
            noCache = true;
        } else if (args[i] === '--help') {
            console.log(`
Fast Pipeline Orchestrator

Usage:
  node orchestrator-fast.js "Topic"
  node orchestrator-fast.js --topic "Topic" [options]

Options:
  --no-cache     Disable caching (force regeneration)
  --help         Show this help message

Environment:
  EBOOK_TOPIC    Topic to generate (alternative to CLI arg)
`);
            process.exit(0);
        } else if (!args[i].startsWith('--')) {
            topic = args[i];
        }
    }
    
    if (!topic) {
        console.error('Error: No topic specified');
        console.error('Usage: node orchestrator-fast.js "Topic"');
        process.exit(1);
    }
    
    const orchestrator = new FastPipelineOrchestrator(topic, { noCache });
    
    orchestrator.run().catch(error => {
        console.error('\n💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = FastPipelineOrchestrator;