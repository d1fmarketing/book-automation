#!/usr/bin/env node

/**
 * Gemini Worker Starter
 * 
 * Workers que usam Google Gemini 2.5 Pro para geração de conteúdo
 */

const { Worker } = require('bullmq');
const { getQueueManager } = require('../src/queue/QueueManager');

let queueManager;
const workers = [];

async function startWorkers() {
    console.log('🚀 Iniciando workers com Gemini 2.5 Pro...');
    
    // Verificar API keys
    const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    
    console.log('🔑 API Keys:');
    console.log(`  - Gemini: ${geminiKey ? '✅ Configurada' : '⚠️  Não configurada (usando fallback)'}`);
    console.log(`  - Anthropic: ${anthropicKey ? '✅ Configurada' : '⚠️  Não configurada (usando debug planner)'}`);
    
    // Conectar queue manager
    queueManager = getQueueManager();
    await queueManager.connect();
    
    // Criar worker para pipeline principal
    const pipelineWorker = new Worker('pipeline', async (job) => {
        console.log(`\n🔧 Processing pipeline job: ${job.id}`);
        console.log(`📋 Topic: ${job.data.topic}`);
        console.log(`📚 Chapters: ${job.data.chapters}`);
        console.log(`✍️  Style: ${job.data.style}`);
        
        try {
            // Usar o Gemini orchestrator
            const GeminiOrchestrator = require('./orchestrator-gemini');
            const orchestrator = new GeminiOrchestrator(job.data.topic, {
                chapters: job.data.chapters || 10,
                style: job.data.style || 'business',
                workDir: `build/pipeline-${job.data.pipelineId}`
            });
            
            // Adicionar progress updates
            await job.updateProgress({ stage: 'starting', percent: 0 });
            
            // Executar pipeline
            const result = await orchestrator.run(job);
            
            if (result.success) {
                await job.updateProgress({ stage: 'completed', percent: 100 });
                console.log(`✅ Pipeline job ${job.id} completed`);
                return {
                    success: true,
                    pipelineId: job.data.pipelineId,
                    outputDir: result.outputDir,
                    htmlPath: result.htmlPath
                };
            } else {
                throw new Error(result.error || 'Pipeline failed');
            }
            
        } catch (error) {
            console.error(`❌ Pipeline job ${job.id} failed:`, error.message);
            throw error;
        }
    }, {
        connection: queueManager.connection.duplicate(),
        concurrency: 1,
        stalledInterval: 30000, // 30 segundos
        maxStalledCount: 3
    });
    
    workers.push(pipelineWorker);
    
    // Criar workers para outras queues (por enquanto apenas logging)
    const queues = ['research', 'writer', 'formatter', 'qa'];
    
    for (const queueName of queues) {
        const worker = new Worker(queueName, async (job) => {
            console.log(`\n🔧 Processing ${queueName} job: ${job.id}`);
            console.log(`📦 Data:`, JSON.stringify(job.data, null, 2));
            
            // Simular processamento
            await new Promise(resolve => setTimeout(resolve, 500));
            
            console.log(`✅ ${queueName} job ${job.id} completed`);
            return { success: true };
        }, {
            connection: queueManager.connection.duplicate(),
            concurrency: 2
        });
        
        workers.push(worker);
    }
    
    console.log(`\n✅ ${workers.length} workers iniciados`);
    console.log('📊 Workers ativos:');
    console.log('  - pipeline: 1 worker (Gemini orchestrator)');
    console.log('  - research: 2 workers');
    console.log('  - writer: 2 workers');
    console.log('  - formatter: 2 workers');
    console.log('  - qa: 2 workers');
    console.log('\n⏳ Aguardando jobs...');
    
    // Handlers de shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

async function shutdown() {
    console.log('\n📛 Desligando workers...');
    
    for (const worker of workers) {
        await worker.close();
    }
    
    if (queueManager) {
        await queueManager.shutdown();
    }
    
    console.log('✅ Workers desligados');
    process.exit(0);
}

// Iniciar
startWorkers().catch(error => {
    console.error('❌ Erro ao iniciar workers:', error);
    process.exit(1);
});