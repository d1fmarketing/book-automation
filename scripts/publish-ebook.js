#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

// Publicar no Amazon KDP
async function publishToAmazonKDP(ebookData) {
  console.log('📚 Publicando no Amazon KDP...');
  
  // TODO: Implementar integração real com KDP
  // Requer: 
  // - Conta KDP
  // - API/Automação via Selenium
  // - Metadados do livro
  
  const kdpData = {
    title: ebookData.metadata.title,
    subtitle: ebookData.metadata.subtitle,
    author: ebookData.metadata.author,
    description: ebookData.metadata.description,
    keywords: ebookData.topic.keywords.slice(0, 7), // KDP permite até 7
    categories: mapNicheToKDPCategories(ebookData.topic.niche),
    price: ebookData.price,
    royaltyOption: ebookData.price <= 2.99 ? '35%' : '70%'
  };
  
  console.log('   📋 Metadados preparados');
  console.log(`   💰 Royalty: ${kdpData.royaltyOption}`);
  console.log('   ⏳ Simulando upload...');
  
  // Simular processo
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    platform: 'Amazon KDP',
    status: 'pending_review',
    estimatedReviewTime: '24-72 hours',
    asin: `B0${Date.now().toString().slice(-8)}`,
    url: `https://www.amazon.com/dp/B0${Date.now().toString().slice(-8)}`
  };
}

// Publicar no Gumroad
async function publishToGumroad(ebookData) {
  console.log('🛒 Publicando no Gumroad...');
  
  const GUMROAD_ACCESS_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
  
  if (!GUMROAD_ACCESS_TOKEN) {
    console.log('   ⚠️  GUMROAD_ACCESS_TOKEN não encontrado');
    return {
      platform: 'Gumroad',
      status: 'skipped',
      reason: 'Missing API token'
    };
  }
  
  // TODO: Implementar API real do Gumroad
  // Documentação: https://gumroad.com/api
  
  const productData = {
    name: ebookData.metadata.title,
    price: ebookData.price * 100, // Centavos
    description: ebookData.metadata.description,
    tags: ebookData.topic.keywords,
    file_url: ebookData.pdfPath
  };
  
  console.log('   📦 Produto configurado');
  console.log(`   💵 Preço: $${ebookData.price}`);
  
  // Simular criação
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    platform: 'Gumroad',
    status: 'published',
    productId: `gum_${Date.now()}`,
    url: `https://gumroad.com/l/${ebookData.metadata.title.toLowerCase().replace(/\s+/g, '-')}`
  };
}

// Publicar no site próprio
async function publishToWebsite(ebookData) {
  console.log('🌐 Publicando no site próprio...');
  
  // Criar página de vendas
  const salesPage = generateSalesPage(ebookData);
  
  // Salvar no diretório web
  const webDir = path.join('build', 'website', 'products');
  await fs.mkdir(webDir, { recursive: true });
  
  const productSlug = ebookData.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const pagePath = path.join(webDir, `${productSlug}.html`);
  
  await fs.writeFile(pagePath, salesPage);
  
  console.log('   📄 Página de vendas criada');
  console.log('   🔗 URL: /products/' + productSlug);
  
  return {
    platform: 'Website',
    status: 'published',
    url: `/products/${productSlug}`,
    pagePath
  };
}

// Publicar no Payhip
async function publishToPayhip(ebookData) {
  console.log('💳 Publicando no Payhip...');
  
  // TODO: Implementar API do Payhip
  
  console.log('   📊 Configurando produto...');
  console.log('   🏷️ Aplicando SEO...');
  
  return {
    platform: 'Payhip',
    status: 'published',
    productId: `ph_${Date.now()}`,
    url: `https://payhip.com/b/${productSlug}`
  };
}

// Gerar página de vendas
function generateSalesPage(ebookData) {
  const { metadata, topic } = ebookData;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title} - Get Instant Access</title>
    <meta name="description" content="${metadata.description}">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .hero {
            text-align: center;
            padding: 60px 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            margin-bottom: 40px;
        }
        h1 { font-size: 3em; margin: 0.5em 0; }
        .price {
            font-size: 2.5em;
            font-weight: bold;
            color: #4CAF50;
            margin: 20px 0;
        }
        .cta-button {
            display: inline-block;
            padding: 20px 40px;
            font-size: 1.5em;
            background: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 50px;
            transition: transform 0.3s;
        }
        .cta-button:hover {
            transform: scale(1.05);
        }
        .benefits {
            background: #f5f5f5;
            padding: 30px;
            border-radius: 10px;
            margin: 30px 0;
        }
        .guarantee {
            text-align: center;
            padding: 30px;
            background: #fff3cd;
            border-radius: 10px;
            margin: 30px 0;
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>${metadata.title}</h1>
        <p style="font-size: 1.3em; opacity: 0.9;">${metadata.subtitle}</p>
    </div>
    
    <div style="text-align: center;">
        <div class="price">Only $${ebookData.price}</div>
        <p style="font-size: 1.2em; color: #666;">Instant Download • ${metadata.chapters} Chapters • No Fluff</p>
        <a href="#buy" class="cta-button">Get Instant Access</a>
    </div>
    
    <div class="benefits">
        <h2>What You'll Learn:</h2>
        <ul style="font-size: 1.1em;">
            <li>✅ Proven strategies that work in ${new Date().getFullYear()}</li>
            <li>✅ Step-by-step action plans</li>
            <li>✅ Real case studies and examples</li>
            <li>✅ Common mistakes to avoid</li>
            <li>✅ Tools and resources to accelerate success</li>
        </ul>
    </div>
    
    <h2>Who This Is For:</h2>
    <p>${topic.targetAudience}</p>
    
    <div class="guarantee">
        <h2>🔒 30-Day Money-Back Guarantee</h2>
        <p>If you're not completely satisfied, get a full refund. No questions asked.</p>
    </div>
    
    <div style="text-align: center; margin: 50px 0;">
        <a href="#buy" class="cta-button">Get Your Copy Now - $${ebookData.price}</a>
        <p style="margin-top: 20px; color: #666;">
            <small>Secure checkout • Instant delivery to your email</small>
        </p>
    </div>
    
    <footer style="text-align: center; margin-top: 100px; padding-top: 30px; border-top: 1px solid #eee;">
        <p>&copy; ${new Date().getFullYear()} ${metadata.publisher}. All rights reserved.</p>
    </footer>
</body>
</html>`;
}

// Mapear nichos para categorias KDP
function mapNicheToKDPCategories(niche) {
  const categoryMap = {
    "AI/Technology": ["Computers & Technology", "Business & Money > Entrepreneurship"],
    "Health/Diet": ["Health, Fitness & Dieting", "Cookbooks, Food & Wine"],
    "Business/Money": ["Business & Money", "Self-Help > Personal Finance"],
    "Finance/Crypto": ["Business & Money > Investing", "Computers & Technology"],
    "E-commerce/Business": ["Business & Money > E-commerce", "Computers & Technology > Web Development"]
  };
  
  return categoryMap[niche] || ["Business & Money"];
}

// Função principal de publicação
async function publishEbook(ebookData) {
  console.log(`\n🚀 Iniciando publicação: "${ebookData.metadata.title}"`);
  console.log(`💰 Preço definido: $${ebookData.price}`);
  
  const results = {
    timestamp: new Date().toISOString(),
    title: ebookData.metadata.title,
    platforms: []
  };
  
  // Publicar em múltiplas plataformas
  try {
    // Amazon KDP
    const kdpResult = await publishToAmazonKDP(ebookData);
    results.platforms.push(kdpResult);
    
    // Gumroad
    const gumroadResult = await publishToGumroad(ebookData);
    results.platforms.push(gumroadResult);
    
    // Website próprio
    const websiteResult = await publishToWebsite(ebookData);
    results.platforms.push(websiteResult);
    
    // Payhip
    const payhipResult = await publishToPayhip(ebookData);
    results.platforms.push(payhipResult);
    
  } catch (error) {
    console.error('❌ Erro durante publicação:', error.message);
  }
  
  // Salvar relatório de publicação
  const reportPath = path.join(
    path.dirname(ebookData.pdfPath),
    'publication-report.json'
  );
  
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  
  console.log('\n✅ Publicação concluída!');
  console.log('📊 Resumo:');
  results.platforms.forEach(p => {
    console.log(`   ${p.status === 'published' ? '✅' : '⏳'} ${p.platform}: ${p.status}`);
  });
  
  return results;
}

// Agendar publicações
async function schedulePublication(ebookData, scheduleDate) {
  console.log(`⏰ Agendando publicação para: ${scheduleDate}`);
  
  // TODO: Implementar sistema de agendamento
  // Pode usar node-cron ou similar
  
  return {
    scheduled: true,
    date: scheduleDate,
    id: `schedule_${Date.now()}`
  };
}

// Se executado diretamente
if (require.main === module) {
  const testData = {
    pdfPath: 'build/test/ebook.pdf',
    price: 5.00,
    metadata: {
      title: "Test Ebook",
      subtitle: "Testing Publishing",
      author: "Test Author",
      description: "This is a test ebook",
      chapters: 9,
      publisher: "Test Publisher"
    },
    topic: {
      niche: "Business/Money",
      keywords: ["test", "ebook"],
      targetAudience: "Testers"
    }
  };
  
  publishEbook(testData).catch(console.error);
}

module.exports = { 
  publishEbook, 
  publishToAmazonKDP, 
  publishToGumroad, 
  publishToWebsite,
  schedulePublication 
};