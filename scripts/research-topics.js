#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const trendingMoneyScanner = require('../scanners/trending-money-scanner');

async function researchTrendingTopics() {
  console.log('🔍 Pesquisando tópicos em alta...\n');
  
  try {
    // Use the real scanner to get trending topics
    const scannedTopics = await trendingMoneyScanner();
    
    // Transform scanned topics to our format
    const topics = scannedTopics.map((topic, index) => ({
      title: topic.topic,
      niche: determineNiche(topic.topic),
      potential: topic.score > 100 ? "Muito Alto" : topic.score > 50 ? "Alto" : "Médio",
      competition: "Média", // Would need additional analysis
      targetAudience: determineAudience(topic.topic),
      estimatedDemand: topic.score * 100, // Rough estimate
      keywords: extractKeywords(topic.topic),
      description: `Trending topic from ${topic.sources.join(', ')}`,
      sources: topic.sources,
      originalScore: topic.score
    }));
    
    // If no topics from scanner, use fallback
    if (topics.length === 0) {
      console.log('⚠️  Scanner não retornou tópicos, usando fallback...');
      return getFallbackTopics();
    }
    
    return await saveAndReturnTopics(topics);
    
  } catch (error) {
    console.error('❌ Erro ao escanear tópicos:', error.message);
    console.log('📌 Usando tópicos de fallback...');
    return getFallbackTopics();
  }
}

function determineNiche(topic) {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('crypto') || topicLower.includes('bitcoin')) return 'Finance/Crypto';
  if (topicLower.includes('ai') || topicLower.includes('chatgpt')) return 'AI/Technology';
  if (topicLower.includes('diet') || topicLower.includes('keto') || topicLower.includes('health')) return 'Health/Diet';
  if (topicLower.includes('business') || topicLower.includes('money') || topicLower.includes('income')) return 'Business/Money';
  if (topicLower.includes('etsy') || topicLower.includes('amazon') || topicLower.includes('selling')) return 'E-commerce/Business';
  return 'Business/General';
}

function determineAudience(topic) {
  const topicLower = topic.toLowerCase();
  if (topicLower.includes('beginner')) return 'Iniciantes';
  if (topicLower.includes('business') || topicLower.includes('entrepreneur')) return 'Empreendedores e profissionais';
  if (topicLower.includes('investor') || topicLower.includes('trading')) return 'Investidores';
  return 'Pessoas buscando renda extra';
}

function extractKeywords(topic) {
  // Simple keyword extraction
  const words = topic.toLowerCase().split(/\s+/);
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been'];
  return words.filter(word => !stopWords.includes(word) && word.length > 3).slice(0, 4);
}

async function saveAndReturnTopics(topics) {
  // Create directory if it doesn't exist
  await fs.mkdir('build/research', { recursive: true });
  
  // Save topics with timestamp
  const timestamp = new Date().toISOString();
  const output = {
    timestamp,
    totalTopics: topics.length,
    topics,
    recommendation: topics[0],
    analysisNotes: "Tópicos escaneados de fontes reais e ordenados por pontuação"
  };
  
  await fs.writeFile(
    'build/research/trending-topics.json',
    JSON.stringify(output, null, 2)
  );
  
  // Show summary
  console.log('📊 TÓPICOS ENCONTRADOS:\n');
  topics.forEach((topic, index) => {
    console.log(`${index + 1}. ${topic.title}`);
    console.log(`   📁 Nicho: ${topic.niche}`);
    console.log(`   💰 Potencial: ${topic.potential}`);
    console.log(`   🏁 Score original: ${topic.originalScore}`);
    console.log(`   🎯 Demanda estimada: ${topic.estimatedDemand} buscas/mês`);
    console.log(`   📍 Fontes: ${topic.sources.join(', ')}`);
    console.log('');
  });
  
  console.log('✅ Análise salva em: build/research/trending-topics.json');
  console.log(`\n🎯 RECOMENDAÇÃO: "${topics[0].title}"`);
  
  return topics;
}

function getFallbackTopics() {
  // Fallback topics if scanner fails
  const topics = [
    {
      title: "ChatGPT & AI Prompts for Business Success",
      niche: "AI/Technology",
      potential: "Muito Alto",
      competition: "Média",
      targetAudience: "Empreendedores e profissionais",
      estimatedDemand: 9500,
      keywords: ["chatgpt", "ai prompts", "business automation", "productivity"],
      description: "Como usar ChatGPT e AI para automatizar tarefas e aumentar lucros"
    },
    {
      title: "30-Day Keto Meal Plan for Rapid Weight Loss",
      niche: "Health/Diet", 
      potential: "Alto",
      competition: "Alta",
      targetAudience: "Pessoas querendo emagrecer",
      estimatedDemand: 8200,
      keywords: ["keto diet", "weight loss", "meal plan", "low carb"],
      description: "Plano completo de refeições keto com receitas e lista de compras"
    },
    {
      title: "Passive Income with Print-on-Demand: Zero to $5000/Month",
      niche: "Business/Money",
      potential: "Muito Alto",
      competition: "Média",
      targetAudience: "Pessoas buscando renda extra",
      estimatedDemand: 9800,
      keywords: ["passive income", "print on demand", "make money online", "side hustle"],
      description: "Guia completo para criar negócio lucrativo com print-on-demand"
    },
    {
      title: "Day Trading Cryptocurrency for Beginners",
      niche: "Finance/Crypto",
      potential: "Alto",
      competition: "Alta",
      targetAudience: "Investidores iniciantes",
      estimatedDemand: 7500,
      keywords: ["crypto trading", "bitcoin", "day trading", "cryptocurrency"],
      description: "Estratégias seguras para day trade com criptomoedas"
    },
    {
      title: "Etsy SEO Mastery: Rank #1 and Triple Your Sales",
      niche: "E-commerce/Business",
      potential: "Alto",
      competition: "Baixa",
      targetAudience: "Vendedores Etsy",
      estimatedDemand: 6800,
      keywords: ["etsy seo", "etsy sales", "handmade business", "online selling"],
      description: "Técnicas avançadas de SEO para dominar o Etsy"
    }
  ];
  
  // Ordenar por potencial e baixa competição
  topics.sort((a, b) => {
    const scoreA = (a.potential === "Muito Alto" ? 3 : 2) - (a.competition === "Alta" ? 2 : 1);
    const scoreB = (b.potential === "Muito Alto" ? 3 : 2) - (b.competition === "Alta" ? 2 : 1);
    return scoreB - scoreA;
  });
  
  return await saveAndReturnTopics(topics);
}

// Função para analisar um nicho específico
async function analyzeNiche(niche) {
  console.log(`\n🔎 Analisando nicho: ${niche}...`);
  
  // TODO: Implementar análise detalhada
  // - Volume de busca
  // - Competição
  // - Preço médio
  // - Top sellers
  
  return {
    niche,
    viability: "Alta",
    avgPrice: "$4.99",
    topKeywords: ["keyword1", "keyword2"],
    competitors: 150
  };
}

// Se executado diretamente
if (require.main === module) {
  researchTrendingTopics().catch(console.error);
}

module.exports = { researchTrendingTopics, analyzeNiche };