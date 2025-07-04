#!/usr/bin/env node

/**
 * Test Pipeline API
 * 
 * Testa a API do admin dashboard
 */

const axios = require('axios');

async function testPipeline() {
    const API_URL = 'http://localhost:4000/api';
    
    try {
        console.log('📡 Testando conexão com API...');
        
        // Test status
        const statusRes = await axios.get(`${API_URL}/status`);
        console.log('✅ Status:', statusRes.data);
        
        // Start pipeline
        console.log('\n🚀 Iniciando pipeline de teste...');
        const pipelineRes = await axios.post(`${API_URL}/pipeline/run`, {
            topic: 'Test Book Debug',
            chapters: 1
        });
        
        console.log('✅ Pipeline iniciado:', pipelineRes.data);
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Erro: Admin server não está rodando na porta 4000');
            console.error('Execute: cd admin && npm start');
        } else {
            console.error('❌ Erro:', error.response?.data || error.message);
        }
    }
}

testPipeline();