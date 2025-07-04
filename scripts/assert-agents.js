#!/usr/bin/env node

/**
 * Assert Agents Script
 * 
 * Validates that all required agents were executed in the correct order
 * Part of the "Engenheiro Bravo" zero-tolerance pipeline
 */

const fs = require('fs');
const path = require('path');

// Required agents in exact order
const REQUIRED_AGENTS = [
  'plan.outline',
  'research.perplexity',
  'write.chapter',
  'style.polish',
  'img.illustrate',
  'format.html',
  'qa.fact',
  'aff.inject',
  'qa.html'
];

function main() {
  console.log('🔍 Validating manifest agents...\n');
  
  try {
    // Load manifest
    const manifestPath = path.join(__dirname, '..', 'build', 'run-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ ERRO: Manifest não encontrado em build/run-manifest.json');
      process.exit(1);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    // Check if all required agents are present
    const missing = REQUIRED_AGENTS.filter(agent => !manifest.steps.includes(agent));
    
    if (missing.length > 0) {
      console.error('❌ AGENTES FALTANDO:', missing.join(', '));
      console.error(`   Esperado: ${REQUIRED_AGENTS.length} agentes`);
      console.error(`   Encontrado: ${manifest.steps.length} agentes`);
      process.exit(1);
    }
    
    // Check if order is correct
    let orderCorrect = true;
    for (let i = 0; i < REQUIRED_AGENTS.length; i++) {
      if (manifest.steps[i] !== REQUIRED_AGENTS[i]) {
        orderCorrect = false;
        console.error(`❌ ORDEM INCORRETA no índice ${i}:`);
        console.error(`   Esperado: ${REQUIRED_AGENTS[i]}`);
        console.error(`   Encontrado: ${manifest.steps[i] || 'nenhum'}`);
      }
    }
    
    if (!orderCorrect) {
      console.error('\n❌ A ordem dos agentes está incorreta!');
      process.exit(1);
    }
    
    // Check total count
    if (manifest.steps.length !== REQUIRED_AGENTS.length) {
      console.error(`❌ Quantidade errada de agentes:`);
      console.error(`   Esperado: ${REQUIRED_AGENTS.length}`);
      console.error(`   Encontrado: ${manifest.steps.length}`);
      
      // Show extra agents if any
      if (manifest.steps.length > REQUIRED_AGENTS.length) {
        const extra = manifest.steps.filter(s => !REQUIRED_AGENTS.includes(s));
        console.error(`   Agentes extras: ${extra.join(', ')}`);
      }
      
      process.exit(1);
    }
    
    // Check if manifest is marked as final
    if (!manifest.final) {
      console.error('❌ Manifest não está marcado como final!');
      process.exit(1);
    }
    
    // Check QA scores
    if (!manifest.qa || !manifest.qa.lighthouse) {
      console.error('❌ QA scores não encontrados no manifest!');
      process.exit(1);
    }
    
    const lighthouseScore = manifest.qa.lighthouse * 100;
    if (lighthouseScore < 90) {
      console.error(`❌ Lighthouse score muito baixo: ${lighthouseScore}/100 (mínimo: 90)`);
      process.exit(1);
    }
    
    // Success!
    console.log('✅ Todos os 9 agentes executados corretamente');
    console.log(`✅ Ordem correta: ${REQUIRED_AGENTS.join(' → ')}`);
    console.log(`✅ Manifest marcado como final`);
    console.log(`✅ QA Score: ${lighthouseScore}/100`);
    console.log('\n🎉 Pipeline validado com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao validar manifest:', error.message);
    process.exit(1);
  }
}

// Run validation
main();