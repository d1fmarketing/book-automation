#!/usr/bin/env node

/**
 * Simple Worker Starter
 * 
 * Versão simplificada sem WorkerPool para debug
 */

const { Worker } = require('bullmq');
const { getQueueManager } = require('../src/queue/QueueManager');

let queueManager;
const workers = [];

async function startWorkers() {
    console.log('🚀 Iniciando workers simples...');
    
    // Conectar queue manager
    queueManager = getQueueManager();
    await queueManager.connect();
    
    // Criar worker para pipeline
    const pipelineWorker = new Worker('pipeline', async (job) => {
        console.log(`\n🔧 Processing pipeline job: ${job.id}`);
        console.log(`📋 Topic: ${job.data.topic}`);
        console.log(`📚 Chapters: ${job.data.chapters}`);
        
        try {
            // Usar o orchestrator híbrido com writer Anthropic
            const HybridOrchestrator = require('./orchestrator-hybrid');
            const orchestrator = new HybridOrchestrator(job.data.topic, {
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
        concurrency: 1
    });
    
    workers.push(pipelineWorker);
    
    // Criar workers para outras queues (simulados por enquanto)
    const queues = ['research', 'writer', 'formatter', 'qa'];
    
    for (const queueName of queues) {
        const worker = new Worker(queueName, async (job) => {
            console.log(`\n🔧 Processing ${queueName} job: ${job.id}`);
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log(`✅ ${queueName} job ${job.id} completed`);
            return { success: true };
        }, {
            connection: queueManager.connection.duplicate(),
            concurrency: 2
        });
        
        workers.push(worker);
    }
    
    console.log(`✅ ${workers.length} workers iniciados`);
    
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