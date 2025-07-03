#!/usr/bin/env node

/**
 * Gera HTML de preview que MOSTRA as páginas como um livro
 */

const fs = require('fs-extra');
const path = require('path');

async function generatePreviewHTML() {
    console.log('📖 Gerando HTML de preview com layout de livro...');
    
    const inputPath = path.join(__dirname, '../build/tmp/ebook.html');
    const outputPath = path.join(__dirname, '../build/tmp/ebook-preview.html');
    
    // Ler HTML original
    const originalHTML = await fs.readFile(inputPath, 'utf8');
    
    // Adicionar CSS de preview que força visualização de páginas
    const previewCSS = `
        <style>
        /* PREVIEW MODE - Força visualização de páginas */
        body {
            background: #e5e5e5;
            padding: 20px;
            margin: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
        }
        
        .page {
            width: 6in !important;
            height: 9in !important;
            background: white !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
            margin: 0 !important;
            position: relative !important;
            overflow: hidden !important;
            display: block !important;
            box-sizing: border-box !important;
        }
        
        .page:not(.cover) {
            padding: 0.5in !important;
        }
        
        /* Numeração de páginas para preview */
        .page::after {
            content: attr(data-page);
            position: absolute;
            bottom: 10px;
            right: 15px;
            font-size: 10px;
            color: #999;
            font-family: sans-serif;
        }
        
        /* Garantir que cover ocupe página toda */
        .cover {
            padding: 0 !important;
        }
        
        .cover img {
            width: 6in !important;
            height: 9in !important;
            object-fit: cover !important;
        }
        
        /* Debug info */
        .page-info {
            position: absolute;
            top: 5px;
            left: 5px;
            background: yellow;
            padding: 2px 5px;
            font-size: 10px;
            font-family: monospace;
            z-index: 1000;
        }
        </style>
    `;
    
    // Inserir CSS de preview antes do </head>
    let previewHTML = originalHTML.replace('</head>', previewCSS + '</head>');
    
    // Adicionar números de página
    let pageNum = 1;
    previewHTML = previewHTML.replace(/<div class="page/g, () => {
        return `<div data-page="Page ${pageNum++}" class="page`;
    });
    
    // Adicionar informações de debug em cada página
    previewHTML = previewHTML.replace(/<div ([^>]*class="page[^"]*"[^>]*)>/g, (match, attrs) => {
        const pageType = attrs.includes('cover') ? 'COVER' : 
                        attrs.includes('toc') ? 'TOC' : 
                        attrs.includes('chapter') ? 'CHAPTER' : 'PAGE';
        return `${match}<div class="page-info">${pageType}</div>`;
    });
    
    // Salvar
    await fs.writeFile(outputPath, previewHTML);
    console.log(`✅ Preview salvo em: ${outputPath}`);
    console.log(`📏 Páginas encontradas: ${pageNum - 1}`);
    
    // Criar também uma versão de verificação
    const checkPath = path.join(__dirname, '../build/tmp/ebook-check.html');
    const checkHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Verificação de Imagens</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        .check { margin: 20px 0; padding: 20px; border: 1px solid #ccc; }
        .check img { max-width: 200px; margin: 10px; border: 1px solid #000; }
        .status { font-weight: bold; }
        .ok { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <h1>Verificação de Imagens do Ebook</h1>
    <div id="results"></div>
    <script>
        // Abrir o HTML original em um iframe invisível
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = 'ebook.html';
        document.body.appendChild(iframe);
        
        iframe.onload = function() {
            const doc = iframe.contentDocument;
            const images = doc.querySelectorAll('img');
            const results = document.getElementById('results');
            
            results.innerHTML = '<h2>Total de imagens: ' + images.length + '</h2>';
            
            images.forEach((img, i) => {
                const div = document.createElement('div');
                div.className = 'check';
                
                const clone = img.cloneNode();
                clone.onload = function() {
                    div.innerHTML += '<span class="status ok">✓ Carregada</span>';
                };
                clone.onerror = function() {
                    div.innerHTML += '<span class="status error">✗ ERRO!</span>';
                };
                
                div.innerHTML = '<h3>Imagem ' + (i+1) + '</h3>' +
                               '<p>Alt: ' + (img.alt || '(sem alt)') + '</p>' +
                               '<p>Tipo: ' + (img.src.startsWith('data:') ? 'Base64' : 'URL') + '</p>' +
                               '<p>Tamanho: ' + img.naturalWidth + 'x' + img.naturalHeight + '</p>';
                div.appendChild(clone);
                
                results.appendChild(div);
            });
        };
    </script>
</body>
</html>`;
    
    await fs.writeFile(checkPath, checkHTML);
    console.log(`🔍 Verificador salvo em: ${checkPath}`);
}

generatePreviewHTML().catch(console.error);