#!/usr/bin/env node

/**
 * Workers with Rate Limiting and Cost Tracking
 * 
 * Workers que respeitam limites de API e rastreiam custos
 */

const { Worker } = require('bullmq');
const { getQueueManager } = require('../src/queue/QueueManager');
const { getRateLimiter } = require('../src/middleware/RateLimiter');
const { getCostTracker } = require('../src/cost/CostTracker');

let queueManager;
const workers = [];

async function startWorkers() {
    console.log('🚀 Iniciando workers com rate limiting e cost tracking...');
    
    // Initialize services
    const rateLimiter = getRateLimiter();
    const costTracker = getCostTracker();
    await costTracker.initialize();
    
    // Show current limits
    console.log('\n📊 Limites configurados:');
    const anthropicStatus = rateLimiter.getStatus('anthropic');
    console.log('  Anthropic:', anthropicStatus.limits.requests);
    
    // Show current budget
    const budgets = costTracker.budgets;
    console.log('\n💰 Orçamentos:');
    console.log(`  Diário: $${budgets.daily || '∞'}`);
    console.log(`  Mensal: $${budgets.monthly || '∞'}`);
    console.log(`  Por livro: $${budgets.perBook || '∞'}`);
    
    // Connect queue manager
    queueManager = getQueueManager();
    await queueManager.connect();
    
    // Create pipeline worker with limits
    const pipelineWorker = new Worker('pipeline', async (job) => {
        console.log(`\n🔧 Processing pipeline job: ${job.id}`);
        console.log(`📋 Topic: ${job.data.topic}`);
        console.log(`📚 Chapters: ${job.data.chapters}`);
        
        try {
            // Check current spending before starting
            const spending = costTracker.getCurrentSpending();
            const budgets = costTracker.budgets;
            
            if (budgets.daily && spending.daily >= budgets.daily) {
                throw new Error(`Daily budget exceeded: $${spending.daily.toFixed(2)}`);
            }
            
            // Use orchestrator with limits
            const OrchestratorWithLimits = require('./orchestrator-with-limits');
            const orchestrator = new OrchestratorWithLimits(job.data.topic, {
                chapters: job.data.chapters || 10,
                style: job.data.style || 'business',
                workDir: `build/pipeline-${job.data.pipelineId}`
            });
            
            // Monitor rate limits during execution
            let lastAlert = 0;
            const monitorInterval = setInterval(() => {
                const status = rateLimiter.getStatus('anthropic');
                const usage = Math.max(
                    parseFloat(status.percentages.minute || 0),
                    parseFloat(status.percentages.hour || 0)
                );
                
                if (usage > 80 && Date.now() - lastAlert > 60000) {
                    console.warn(`⚠️  High API usage: ${usage}%`);
                    lastAlert = Date.now();
                    
                    job.updateProgress({
                        stage: 'writing',
                        percent: job.progress.percent || 50,
                        message: `High API usage: ${usage}% - may slow down`
                    });
                }
            }, 10000); // Check every 10 seconds
            
            // Run pipeline
            const result = await orchestrator.run(job);
            
            clearInterval(monitorInterval);
            
            if (result.success) {
                // Add cost info to result
                const sessionCost = costTracker.getCurrentSpending().session || 0;
                result.cost = sessionCost;
                result.costPerChapter = sessionCost / job.data.chapters;
                
                console.log(`✅ Pipeline completed - Cost: $${sessionCost.toFixed(4)}`);
                
                return {
                    success: true,
                    pipelineId: job.data.pipelineId,
                    outputDir: result.outputDir,
                    htmlPath: result.htmlPath,
                    cost: result.cost,
                    costPerChapter: result.costPerChapter
                };
            } else {
                throw new Error(result.error || 'Pipeline failed');
            }
            
        } catch (error) {
            console.error(`❌ Pipeline job ${job.id} failed:`, error.message);
            
            // Check if it's a budget/limit error
            if (error.message.includes('budget') || error.message.includes('limit')) {
                // Don't retry budget/limit errors
                throw Object.assign(error, { noRetry: true });
            }
            
            throw error;
        }
    }, {
        connection: queueManager.connection.duplicate(),
        concurrency: 1,
        stalledInterval: 30000,
        maxStalledCount: 3
    });
    
    // Handle job events
    pipelineWorker.on('failed', async (job, error) => {
        if (error.noRetry) {
            console.log(`🚫 Job ${job.id} will not be retried: ${error.message}`);
            // Move to dead letter queue
            // await queueManager.dlq.moveToDeadLetter(job, error, 'pipeline');
        }
    });
    
    workers.push(pipelineWorker);
    
    // Create monitoring worker
    const monitoringWorker = setInterval(async () => {
        // Get current status
        const anthropicStatus = rateLimiter.getStatus('anthropic');
        const spending = costTracker.getCurrentSpending();
        
        // Emit status update
        queueManager.emit('status:update', {
            rateLimits: {
                anthropic: anthropicStatus
            },
            costs: {
                daily: spending.daily,
                monthly: spending.monthly,
                session: spending.session
            }
        });
        
        // Check for issues
        if (anthropicStatus.throttle.paused) {
            console.error('🚫 Anthropic API is paused!');
        }
        
        const budgets = costTracker.budgets;
        if (budgets.daily && spending.daily > budgets.daily * 0.9) {
            console.warn(`⚠️  Daily budget warning: $${spending.daily.toFixed(2)} of $${budgets.daily}`);
        }
        
    }, 30000); // Every 30 seconds
    
    console.log(`\n✅ Workers iniciados com proteções:`);
    console.log('  - Rate limiting ativo');
    console.log('  - Cost tracking ativo');
    console.log('  - Circuit breakers configurados');
    console.log('  - Monitoramento em tempo real');
    console.log('\n⏳ Aguardando jobs...');
    
    // Shutdown handlers
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

async function shutdown() {
    console.log('\n📛 Desligando workers...');
    
    // Show final costs
    const costTracker = getCostTracker();
    const spending = costTracker.getCurrentSpending();
    
    console.log('\n💰 Custos finais:');
    console.log(`  Sessão: $${spending.session.toFixed(4)}`);
    console.log(`  Diário: $${spending.daily.toFixed(4)}`);
    console.log(`  Mensal: $${spending.monthly.toFixed(4)}`);
    console.log(`  Total: $${spending.total.toFixed(4)}`);
    
    // Export cost data
    try {
        const exportData = await costTracker.exportCostData('json');
        const fs = require('fs').promises;
        const exportPath = `build/costs/export-${Date.now()}.json`;
        await fs.mkdir('build/costs', { recursive: true });
        await fs.writeFile(exportPath, exportData);
        console.log(`\n📊 Dados exportados: ${exportPath}`);
    } catch (error) {
        console.error('Erro ao exportar dados:', error.message);
    }
    
    // Close workers
    for (const worker of workers) {
        await worker.close();
    }
    
    if (queueManager) {
        await queueManager.shutdown();
    }
    
    console.log('✅ Workers desligados');
    process.exit(0);
}

// Start workers
startWorkers().catch(error => {
    console.error('❌ Erro ao iniciar workers:', error);
    process.exit(1);
});