#!/usr/bin/env node

/**
 * Test Pipeline with Real Orchestrator
 * 
 * Testa o pipeline com o orchestrator conectado
 */

const axios = require('axios');

async function testPipelineReal() {
    const API_URL = 'http://localhost:4000/api';
    
    try {
        console.log('🚀 Testando Pipeline com Orchestrator Real\n');
        
        // 1. Iniciar pipeline
        console.log('1️⃣ Iniciando pipeline...');
        const pipelineRes = await axios.post(`${API_URL}/pipeline/run`, {
            topic: 'Quick Test Book',
            chapters: 2,
            style: 'business'
        });
        
        const pipelineId = pipelineRes.data.pipelineId;
        console.log(`✅ Pipeline iniciado: ${pipelineId}`);
        
        // 2. Monitorar progresso
        console.log('\n2️⃣ Monitorando progresso...');
        let lastStatus = null;
        
        for (let i = 0; i < 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const statusRes = await axios.get(`${API_URL}/status`);
            const pipeline = statusRes.data.queues.queues.pipeline;
            
            const status = `Active: ${pipeline.active} | Waiting: ${pipeline.waiting} | Completed: ${pipeline.completed} | Failed: ${pipeline.failed}`;
            
            if (status !== lastStatus) {
                console.log(`⏱️  ${new Date().toLocaleTimeString()} - ${status}`);
                lastStatus = status;
            }
            
            // Se completou ou falhou
            if (pipeline.active === 0 && pipeline.waiting === 0 && i > 5) {
                if (pipeline.failed > 0) {
                    console.error('\n❌ Pipeline falhou!');
                    
                    // Buscar detalhes dos jobs falhos
                    const failedRes = await axios.get(`${API_URL}/jobs/failed`);
                    console.error('Jobs falhos:', JSON.stringify(failedRes.data, null, 2));
                } else {
                    console.log('\n✅ Pipeline completado com sucesso!');
                    
                    // Verificar arquivos gerados
                    const { exec } = require('child_process');
                    exec(`find build/pipeline-${pipelineId} -type f | head -20`, (err, stdout) => {
                        if (stdout) {
                            console.log('\n📁 Arquivos gerados:');
                            console.log(stdout);
                        }
                    });
                }
                break;
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

testPipelineReal();