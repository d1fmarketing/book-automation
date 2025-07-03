const https = require('https');
const fs = require('fs');
require('dotenv').config();

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;

const data = JSON.stringify({
  image_request: {
    prompt: "Professional digital ebook cover design featuring flowing data streams and neural network patterns in vibrant blue and purple gradients. Title 'The Claude Elite Pipeline' in bold modern typography. Subtitle 'Mastering Automated Ebook Creation'. Futuristic, clean design optimized for digital devices. High contrast for small thumbnails.",
    aspect_ratio: "ASPECT_10_16",  // For 6x9 book cover
    model: "V_2",
    magic_prompt_option: "AUTO"
  }
});

const options = {
  hostname: 'api.ideogram.ai',
  path: '/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Api-Key': IDEOGRAM_API_KEY
  }
};

console.log('🎨 Gerando capa com Ideogram...');

const req = https.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    const response = JSON.parse(body);
    
    if (response.data && response.data[0]) {
      const imageUrl = response.data[0].url;
      console.log('✅ Imagem gerada:', imageUrl);
      
      // Download image
      const file = fs.createWriteStream('pipeline-book/assets/images/cover.jpg');
      https.get(imageUrl, (imgRes) => {
        imgRes.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log('✅ Capa salva em: pipeline-book/assets/images/cover.jpg');
          console.log('💰 Custo: ~$0.08');
        });
      });
    } else {
      console.error('❌ Erro na resposta:', body);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Erro:', e);
});

req.write(data);
req.end();