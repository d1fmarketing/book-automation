#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const { researchTrendingTopics } = require('./research-topics');
const { generateEbookContent } = require('./generate-content');
const { createCover } = require('./create-cover');
const { publishEbook } = require('./publish-ebook');
const deepResearch = require('../agents/deep-research');
const RedisTopicBuffer = require('../utils/redis-topic-buffer');
const { callAgentWithRetry } = require('../utils/agentcli-retry-wrapper');

// Pipeline principal de automação
async function runAutomationPipeline(options = {}) {
  const startTime = Date.now();
  console.log('🚀 MÁQUINA DE FAZER DINHEIRO - PIPELINE DE AUTOMAÇÃO\n');
  console.log('=' .repeat(60));
  
  try {
    // Configurações
    const config = {
      dailyTarget: options.dailyTarget || 1,
      pricePoint: options.pricePoint || 5.00,
      autoPublish: options.autoPublish !== false,
      generateCover: options.generateCover !== false,
      ...options
    };
    
    console.log('⚙️  Configurações:');
    console.log(`   📚 Meta diária: ${config.dailyTarget} ebook(s)`);
    console.log(`   💵 Preço de venda: $${config.pricePoint}`);
    console.log(`   🌐 Auto-publicar: ${config.autoPublish ? 'Sim' : 'Não'}`);
    console.log('');
    
    // 1. PESQUISAR TÓPICOS
    console.log('📊 FASE 1: Pesquisando tópicos lucrativos...');
    console.log('-'.repeat(40));
    const topics = await researchTrendingTopics();
    
    // Check if we have any topics left after buffer filtering
    if (topics.length === 0) {
      console.log('⚠️  Nenhum tópico novo encontrado (todos já foram processados recentemente)');
      console.log('   Aguarde algumas horas ou limpe o buffer Redis');
      return null;
    }
    
    const selectedTopic = topics[0]; // Pegar o mais promissor
    
    // 2. VALIDAR VIABILIDADE
    console.log('\n💡 FASE 2: Validando viabilidade...');
    console.log('-'.repeat(40));
    console.log(`Tópico selecionado: "${selectedTopic.title}"`);
    console.log(`Potencial de lucro: ${selectedTopic.potential}`);
    console.log(`Demanda estimada: ${selectedTopic.estimatedDemand} buscas/mês`);
    
    const projectedRevenue = selectedTopic.estimatedDemand * 0.01 * config.pricePoint; // 1% conversão
    console.log(`💰 Receita projetada: $${projectedRevenue.toFixed(2)}/mês`);
    
    // 2.5. PESQUISA PROFUNDA (PERPLEXITY)
    console.log('\n🔍 FASE 2.5: Pesquisa profunda com Perplexity...');
    console.log('-'.repeat(40));
    
    let research = null;
    try {
      research = await deepResearch({ topic: selectedTopic.title });
      
      // Criar diretório context se não existir
      await fs.mkdir('context', { recursive: true });
      
      // Salvar pesquisa em YAML
      const researchYaml = yaml.dump({
        topic: selectedTopic.title,
        timestamp: new Date().toISOString(),
        summary: research.summary,
        links: research.links,
        bullets: research.bullets
      });
      
      await fs.writeFile('context/research.yaml', researchYaml);
      
      console.log('✅ Pesquisa concluída:');
      console.log(`   📝 Resumo: ${research.summary.slice(0, 100)}...`);
      console.log(`   🔗 Links encontrados: ${research.links.length}`);
      console.log(`   💡 Insights principais: ${research.bullets.length}`);
    } catch (error) {
      console.log('⚠️  Pesquisa Perplexity falhou, continuando sem dados adicionais');
      console.log(`   Erro: ${error.message}`);
    }
    
    // 3. GERAR CONTEÚDO
    console.log('\n📝 FASE 3: Gerando conteúdo de alta qualidade...');
    console.log('-'.repeat(40));
    const bookData = await generateEbookContent(selectedTopic, { ...config, research });
    
    // 4. CRIAR CAPA
    let coverPath = null;
    if (config.generateCover) {
      console.log('\n🎨 FASE 4: Criando capa profissional...');
      console.log('-'.repeat(40));
      coverPath = await createCover(selectedTopic, bookData);
    }
    
    // 5. GERAR PDF FINAL
    console.log('\n📄 FASE 5: Gerando PDF profissional...');
    console.log('-'.repeat(40));
    
    // Preparar metadata para o PDF
    const metadata = {
      ...bookData.metadata,
      coverPath,
      generatedAt: new Date().toISOString()
    };
    
    // Salvar metadata
    await fs.writeFile(
      path.join(bookData.bookDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // TODO: Integrar com generate-pdf-ultra.js
    const pdfPath = path.join(bookData.bookDir, 'final', `${selectedTopic.title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
    await fs.mkdir(path.dirname(pdfPath), { recursive: true });
    
    console.log(`✅ PDF será gerado em: ${pdfPath}`);
    
    // 6. PUBLICAR
    let publishResults = null;
    if (config.autoPublish) {
      console.log('\n🌐 FASE 6: Publicando em múltiplas plataformas...');
      console.log('-'.repeat(40));
      publishResults = await publishEbook({
        pdfPath,
        topic: selectedTopic,
        metadata,
        price: config.pricePoint
      });
    }
    
    // 7. RELATÓRIO FINAL
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);
    
    console.log('\n✅ PIPELINE COMPLETO!');
    console.log('=' .repeat(60));
    console.log('\n📊 RESUMO DO EBOOK GERADO:');
    console.log(`   📖 Título: ${selectedTopic.title}`);
    console.log(`   📁 Nicho: ${selectedTopic.niche}`);
    console.log(`   📄 Capítulos: ${bookData.chapters.length}`);
    console.log(`   💰 Preço: $${config.pricePoint}`);
    console.log(`   ⏱️  Tempo total: ${duration} minutos`);
    
    if (publishResults) {
      console.log('\n🌐 PUBLICADO EM:');
      publishResults.platforms.forEach(platform => {
        console.log(`   ✅ ${platform.name} - ${platform.url || 'Processando...'}`);
      });
      
      console.log('\n💵 PROJEÇÃO DE RECEITA:');
      console.log(`   Diária: $${(projectedRevenue / 30).toFixed(2)}`);
      console.log(`   Mensal: $${projectedRevenue.toFixed(2)}`);
      console.log(`   Anual: $${(projectedRevenue * 12).toFixed(2)}`);
    }
    
    // Salvar relatório
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration} minutes`,
      topic: selectedTopic,
      bookData: {
        title: bookData.metadata.title,
        chapters: bookData.chapters.length,
        wordCount: bookData.metadata.wordCount || 'TBD'
      },
      projectedRevenue: {
        daily: (projectedRevenue / 30).toFixed(2),
        monthly: projectedRevenue.toFixed(2),
        annual: (projectedRevenue * 12).toFixed(2)
      },
      publishResults
    };
    
    await fs.mkdir('build/reports', { recursive: true });
    await fs.writeFile(
      `build/reports/pipeline-report-${Date.now()}.json`,
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Relatório salvo em: build/reports/');
    
    // Add topic to Redis buffer to prevent reprocessing
    const topicBuffer = new RedisTopicBuffer();
    await topicBuffer.addTopic(selectedTopic.title);
    await topicBuffer.disconnect();
    console.log('✅ Tópico adicionado ao buffer Redis (não será reprocessado por 48h)');
    
    return report;
    
  } catch (error) {
    console.error('\n❌ ERRO NO PIPELINE:', error.message);
    throw error;
  }
}

// Executar múltiplos ebooks em paralelo
async function runBatchPipeline(count = 5) {
  console.log(`🏭 MODO FÁBRICA: Gerando ${count} ebooks em paralelo...\n`);
  
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(
      runAutomationPipeline({
        batchIndex: i,
        autoPublish: false // Revisar antes de publicar em lote
      })
    );
  }
  
  const results = await Promise.all(promises);
  
  console.log('\n📊 RESUMO DO LOTE:');
  console.log(`   Total gerado: ${results.length} ebooks`);
  console.log(`   Receita potencial total: $${
    results.reduce((sum, r) => sum + parseFloat(r.projectedRevenue.monthly), 0).toFixed(2)
  }/mês`);
  
  return results;
}

// Se executado diretamente
if (require.main === module) {
  // Verificar argumentos
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 1;
  
  if (count === 1) {
    runAutomationPipeline().catch(console.error);
  } else {
    runBatchPipeline(count).catch(console.error);
  }
}

module.exports = { runAutomationPipeline, runBatchPipeline };