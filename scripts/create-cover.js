#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Gerar prompt otimizado para capa de ebook
function generateCoverPrompt(topic) {
  const style = "professional ebook cover design, modern, clean, eye-catching";
  
  // Prompts específicos por nicho
  const nicheStyles = {
    "AI/Technology": "futuristic, tech-inspired, blue and purple gradients, circuit patterns",
    "Health/Diet": "fresh, vibrant, healthy lifestyle, green and orange accents",
    "Business/Money": "professional, wealth-inspired, gold and dark blue, success imagery",
    "Finance/Crypto": "digital currency, blockchain patterns, modern finance, blue and gold",
    "E-commerce/Business": "online shopping, digital marketplace, purple and teal"
  };
  
  const nicheStyle = nicheStyles[topic.niche] || "professional, modern, attractive";
  
  return `${style}, ${nicheStyle}, book title "${topic.title}" prominently displayed, 
    subtitle text, author name at bottom, high quality, bestseller look, 
    dimensions 1600x2400 pixels, no mockup, flat design`;
}

// Criar capa com Ideogram AI
async function createCoverWithIdeogram(topic, outputPath) {
  const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;
  
  if (!IDEOGRAM_API_KEY) {
    console.log('⚠️  IDEOGRAM_API_KEY não encontrada');
    console.log('   Criando capa placeholder...');
    return createPlaceholderCover(topic, outputPath);
  }
  
  try {
    console.log('🎨 Gerando capa com Ideogram AI...');
    
    const prompt = generateCoverPrompt(topic);
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
    
    // TODO: Implementar chamada real para Ideogram API
    // Documentação: https://ideogram.ai/api
    
    const response = await axios.post('https://api.ideogram.ai/v1/generate', {
      prompt: prompt,
      aspect_ratio: "9:16", // Proporção para capa de livro
      model: "v1",
      magic_prompt: true
    }, {
      headers: {
        'Api-Key': IDEOGRAM_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Baixar imagem gerada
    const imageUrl = response.data.images[0].url;
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    
    await fs.writeFile(outputPath, imageResponse.data);
    console.log('✅ Capa gerada com sucesso!');
    
    return outputPath;
    
  } catch (error) {
    console.error('❌ Erro ao gerar com Ideogram:', error.message);
    return createPlaceholderCover(topic, outputPath);
  }
}

// Criar capa placeholder (fallback)
async function createPlaceholderCover(topic, outputPath) {
  console.log('🎨 Criando capa placeholder...');
  
  // HTML para capa placeholder
  const coverHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0;
      width: 1600px;
      height: 2400px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 100px;
      box-sizing: border-box;
    }
    .title {
      font-size: 120px;
      font-weight: bold;
      text-align: center;
      line-height: 1.2;
      text-shadow: 0 4px 6px rgba(0,0,0,0.3);
      margin-top: 200px;
    }
    .subtitle {
      font-size: 48px;
      text-align: center;
      opacity: 0.9;
      margin-top: 50px;
    }
    .author {
      font-size: 56px;
      text-align: center;
      margin-bottom: 100px;
    }
    .badge {
      position: absolute;
      top: 80px;
      right: 80px;
      background: gold;
      color: #333;
      padding: 20px 40px;
      border-radius: 50px;
      font-size: 36px;
      font-weight: bold;
      transform: rotate(15deg);
    }
  </style>
</head>
<body>
  <div class="badge">BESTSELLER</div>
  <div>
    <div class="title">${topic.title}</div>
    <div class="subtitle">The Complete Guide to Success</div>
  </div>
  <div class="author">Elite Publishing</div>
</body>
</html>`;
  
  // Salvar HTML temporário
  const tempHtmlPath = outputPath.replace('.png', '.html');
  await fs.writeFile(tempHtmlPath, coverHtml);
  
  // TODO: Converter HTML para PNG usando Puppeteer
  console.log('   💡 Para gerar PNG real, use Puppeteer ou ferramenta similar');
  console.log(`   📄 HTML da capa salvo em: ${tempHtmlPath}`);
  
  return tempHtmlPath;
}

// Função principal para criar capa
async function createCover(topic, bookData) {
  console.log(`🎨 Criando capa para: "${topic.title}"`);
  
  // Criar diretório de capas
  const coversDir = path.join(bookData.bookDir, 'assets', 'covers');
  await fs.mkdir(coversDir, { recursive: true });
  
  // Nome do arquivo
  const safeTitle = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const coverPath = path.join(coversDir, `${safeTitle}-cover.png`);
  
  // Tentar gerar com Ideogram ou usar placeholder
  const generatedPath = await createCoverWithIdeogram(topic, coverPath);
  
  // Criar variações da capa
  console.log('\n📐 Criando variações da capa...');
  
  const variations = [
    { name: 'thumbnail', size: '200x300' },
    { name: 'social-media', size: '1200x630' },
    { name: '3d-mockup', size: '800x1200' }
  ];
  
  for (const variation of variations) {
    const varPath = path.join(coversDir, `${safeTitle}-${variation.name}.png`);
    console.log(`   📸 ${variation.name} (${variation.size})`);
    // TODO: Implementar redimensionamento real
  }
  
  // Salvar metadados da capa
  const coverMetadata = {
    originalPath: generatedPath,
    variations,
    generatedAt: new Date().toISOString(),
    topic: topic.title,
    niche: topic.niche
  };
  
  await fs.writeFile(
    path.join(coversDir, 'cover-metadata.json'),
    JSON.stringify(coverMetadata, null, 2)
  );
  
  console.log('\n✅ Capa criada com sucesso!');
  console.log(`   📍 Localização: ${generatedPath}`);
  
  return generatedPath;
}

// Analisar cores dominantes da capa (para marketing)
async function analyzeCoverColors(coverPath) {
  // TODO: Implementar análise de cores
  return {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#ffd700'
  };
}

// Se executado diretamente
if (require.main === module) {
  const testTopic = {
    title: "AI Profits Blueprint",
    niche: "AI/Technology",
    keywords: ["ai", "profits", "automation"]
  };
  
  const testBookData = {
    bookDir: 'build/test-ebook'
  };
  
  createCover(testTopic, testBookData).catch(console.error);
}

module.exports = { createCover, generateCoverPrompt, analyzeCoverColors };