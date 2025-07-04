#!/usr/bin/env node

/**
 * Test Pipeline End-to-End
 * 
 * Testa o pipeline completo com monitoramento
 */

const axios = require('axios');

const API_URL = 'http://localhost:4000/api';
const WS_URL = 'ws://localhost:4000';

async function testE2E() {
    try {
        console.log('🧪 Teste End-to-End do Pipeline\n');
        
        // 1. Verificar status inicial
        console.log('1️⃣ Verificando status dos serviços...');
        const statusRes = await axios.get(`${API_URL}/status`);
        console.log('✅ Admin API: Online');
        console.log(`✅ Workers ativos: ${Object.values(statusRes.data.workers).reduce((sum, w) => sum + w.count, 0)}`);
        
        // 2. Conectar WebSocket para monitorar eventos
        console.log('\n2️⃣ Conectando WebSocket para monitoramento...');
        const io = require('socket.io-client');
        const socket = io(WS_URL);
        
        const logs = [];
        const errors = [];
        
        socket.on('connect', () => {
            console.log('✅ WebSocket conectado');
        });
        
        socket.on('log', (message) => {
            logs.push(message);
            console.log(`📝 ${message}`);
        });
        
        socket.on('error', (error) => {
            errors.push(error);
            console.error(`❌ ${JSON.stringify(error)}`);
        });
        
        socket.on('job:completed', (data) => {
            console.log(`✅ Job completado: ${data.queue} - ${data.jobId}`);
        });
        
        socket.on('job:failed', (data) => {
            console.error(`❌ Job falhou: ${data.queue} - ${data.jobId} - ${data.error}`);
        });
        
        // 3. Iniciar pipeline de teste
        console.log('\n3️⃣ Iniciando pipeline de teste...');
        const pipelineRes = await axios.post(`${API_URL}/pipeline/run`, {
            topic: 'E2E Test Book - Debug Session',
            chapters: 1,
            style: 'business'
        });
        
        const pipelineId = pipelineRes.data.pipelineId;
        console.log(`✅ Pipeline iniciado: ${pipelineId}`);
        
        // 4. Monitorar progresso
        console.log('\n4️⃣ Monitorando progresso...');
        let checkCount = 0;
        const maxChecks = 30; // 30 segundos max
        
        const checkInterval = setInterval(async () => {
            checkCount++;
            
            try {
                const statsRes = await axios.get(`${API_URL}/status`);
                const queues = statsRes.data.queues.queues;
                
                // Contar jobs ativos
                const totalActive = Object.values(queues).reduce((sum, q) => sum + q.active, 0);
                const totalWaiting = Object.values(queues).reduce((sum, q) => sum + q.waiting, 0);
                const totalCompleted = Object.values(queues).reduce((sum, q) => sum + q.completed, 0);
                const totalFailed = Object.values(queues).reduce((sum, q) => sum + q.failed, 0);
                
                console.log(`\n⏱️  Check ${checkCount}/${maxChecks}`);
                console.log(`   Ativos: ${totalActive} | Esperando: ${totalWaiting} | Completados: ${totalCompleted} | Falhas: ${totalFailed}`);
                
                // Se há falhas, parar
                if (totalFailed > 0 || errors.length > 0) {
                    clearInterval(checkInterval);
                    console.error('\n❌ Pipeline falhou!');
                    console.error('Erros:', errors);
                    
                    // Buscar jobs falhos
                    const failedRes = await axios.get(`${API_URL}/jobs/failed`);
                    console.error('\nJobs falhos:', failedRes.data);
                    
                    socket.disconnect();
                    process.exit(1);
                }
                
                // Se não há mais jobs ativos ou esperando
                if (totalActive === 0 && totalWaiting === 0 && checkCount > 2) {
                    clearInterval(checkInterval);
                    
                    console.log('\n✅ Pipeline completado!');
                    console.log(`   Total de jobs processados: ${totalCompleted}`);
                    console.log(`   Tempo total: ~${checkCount} segundos`);
                    
                    // 5. Verificar resultado
                    console.log('\n5️⃣ Verificando resultado...');
                    
                    // Listar arquivos gerados
                    const { exec } = require('child_process');
                    exec(`find build -name "*.html" -o -name "*.md" | head -10`, (err, stdout) => {
                        if (stdout) {
                            console.log('📁 Arquivos gerados:');
                            console.log(stdout);
                        }
                        
                        socket.disconnect();
                        console.log('\n🎉 Teste E2E concluído com sucesso!');
                        process.exit(0);
                    });
                }
                
                if (checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    console.error('\n⏰ Timeout! Pipeline não completou em 30 segundos');
                    socket.disconnect();
                    process.exit(1);
                }
                
            } catch (error) {
                console.error('Erro ao verificar status:', error.message);
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro no teste E2E:', error.message);
        process.exit(1);
    }
}

// Verificar dependências
try {
    require('socket.io-client');
} catch {
    console.error('❌ socket.io-client não instalado');
    console.error('Execute: npm install socket.io-client');
    process.exit(1);
}

testE2E();