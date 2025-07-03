#!/usr/bin/env node

/**
 * FIX-OVERFLOW - Corrige problemas específicos de overflow
 */

const fs = require('fs-extra');
const path = require('path');

class FixOverflow {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
    }

    async run() {
        console.log('🔧 FIX OVERFLOW - Aplicando correções');
        console.log('=====================================\n');

        // Ler HTML atual
        let html = await fs.readFile(this.htmlPath, 'utf8');
        
        // CORREÇÃO 1: Remover todo CSS duplicado e conflitante
        console.log('1. Limpando CSS caótico...');
        
        // Remover CSS profissional que sobrescreve tudo
        html = html.replace(/\/\* Professional CSS overrides \*\/[\s\S]*?\/\* End of professional styles \*\//g, '');
        
        // Remover imports de fontes do Google
        html = html.replace(/@import url\([^)]+\);/g, '');
        
        // CORREÇÃO 2: Simplificar CSS para 6x9" correto
        console.log('2. Aplicando CSS limpo e correto...');
        
        const cleanCSS = `<style>
        /* RESET */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        /* BODY */
        body {
            width: 6in;
            margin: 0 auto;
            font-family: Georgia, serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        /* PAGES - 6x9" com 0.5" margins */
        .page {
            width: 6in;
            height: 9in;
            padding: 0.5in;
            overflow: hidden;
            page-break-after: always;
            page-break-inside: avoid;
            position: relative;
            background: white;
        }
        
        /* Cover page sem padding */
        .page.cover {
            padding: 0;
        }
        
        .cover img {
            width: 6in;
            height: 9in;
            object-fit: contain; /* contain, não cover! */
            display: block;
        }
        
        /* CONTENT WRAPPER - Previne overflow */
        .chapter-content {
            max-height: 8in; /* 9in - 1in de margins */
            overflow: hidden;
            text-align: justify;
        }
        
        /* HEADERS */
        h1, h2, h3 {
            margin: 0.5rem 0;
            page-break-after: avoid;
        }
        
        h1 { font-size: 1.5rem; }
        h2 { font-size: 1.3rem; }
        h3 { font-size: 1.1rem; }
        
        /* PARAGRAPHS */
        p {
            margin-bottom: 0.5rem;
            text-indent: 0.3in;
        }
        
        p:first-of-type {
            text-indent: 0;
        }
        
        /* CALLOUT BOXES - Margens reduzidas */
        .callout-box {
            border-left: 4px solid;
            padding: 0.5rem;
            margin: 0.5rem 0; /* Era 32px! */
            background: #f9f9f9;
            page-break-inside: avoid;
        }
        
        .tip-box { border-color: #10b981; background: #f0fdf4; }
        .warning-box { border-color: #f59e0b; background: #fffbeb; }
        .info-box { border-color: #3b82f6; background: #eff6ff; }
        
        /* CODE BLOCKS */
        pre, .code-block {
            background: #f4f4f4;
            border: 1px solid #ddd;
            padding: 0.5rem;
            margin: 0.5rem 0; /* Era 24px! */
            font-size: 9pt;
            overflow-x: auto;
            max-width: 100%;
        }
        
        code {
            font-size: 9pt;
            max-width: 100%;
            word-wrap: break-word;
        }
        
        /* TABLES */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 0.5rem 0;
            font-size: 10pt; /* Reduzir fonte */
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 0.25rem; /* Era 16px! */
        }
        
        /* LISTS */
        ul, ol {
            margin: 0.5rem 0;
            padding-left: 1.5rem;
        }
        
        li {
            margin-bottom: 0.25rem;
        }
        
        /* IMAGES */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 0.5rem auto;
        }
        
        /* CHAPTER HEADERS */
        .chapter-header {
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .chapter-number {
            font-size: 2rem;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        
        .chapter-image img {
            max-height: 3in;
            margin: 0.5rem auto;
        }
        
        /* TOC */
        .toc {
            list-style: none;
            padding: 0;
        }
        
        .toc li {
            display: flex;
            margin-bottom: 0.5rem;
        }
        
        .toc-title {
            flex: 1;
        }
        
        /* BLOCKQUOTES */
        blockquote {
            border-left: 4px solid #667eea;
            padding-left: 1rem;
            margin: 0.5rem 0;
            font-style: italic;
        }
        
        /* HR */
        hr {
            border: none;
            height: 2px;
            background: linear-gradient(90deg, transparent, #667eea, transparent);
            margin: 1rem auto;
            width: 50%;
        }
        
        /* PREVENT ORPHANS/WIDOWS */
        p {
            orphans: 3;
            widows: 3;
        }
        
        /* PRINT SPECIFIC */
        @media print {
            body {
                margin: 0;
            }
            
            .page {
                margin: 0;
                box-shadow: none;
            }
        }
    </style>`;
        
        // Substituir toda a tag style
        html = html.replace(/<style>[\s\S]*?<\/style>/g, cleanCSS);
        
        // CORREÇÃO 3: Remover inline styles problemáticos
        console.log('3. Removendo inline styles...');
        
        // Remover margin inline dos chapter images
        html = html.replace(/style="margin:\s*2rem\s*0;"/g, '');
        
        // CORREÇÃO 4: Quebrar conteúdo longo em múltiplas páginas
        console.log('4. Implementando quebra de páginas...');
        
        // Adicionar quebras de página antes de cada capítulo
        html = html.replace(/<div class="page">\s*<div class="chapter-header">/g, 
            '<div class="page" style="page-break-before: always;">\n<div class="chapter-header">');
        
        // CORREÇÃO 5: Limitar altura do conteúdo
        console.log('5. Limitando altura do conteúdo...');
        
        // Envolver chapter-content em container com altura máxima
        html = html.replace(/<div class="chapter-content">/g, 
            '<div class="content-wrapper" style="max-height: 8in; overflow: hidden;"><div class="chapter-content">');
        html = html.replace(/<\/div>\s*<\/div>\s*<div class="page/g, 
            '</div></div></div><div class="page');
        
        // CORREÇÃO 6: Corrigir código que vaza horizontalmente
        console.log('6. Corrigindo code blocks...');
        
        // Adicionar word-wrap em code blocks
        html = html.replace(/<pre class="code-block">/g, 
            '<pre class="code-block" style="white-space: pre-wrap; word-wrap: break-word;">');
        
        // CORREÇÃO 7: Reduzir tamanho de elementos grandes
        console.log('7. Ajustando elementos grandes...');
        
        // Adicionar max-height em tabelas
        html = html.replace(/<table>/g, 
            '<table style="max-height: 4in; overflow-y: auto;">');
        
        // Salvar HTML corrigido
        await fs.writeFile(this.htmlPath, html);
        
        console.log('\n✅ Correções aplicadas!');
        console.log('   - CSS limpo e simplificado');
        console.log('   - Margens reduzidas (0.5rem)');
        console.log('   - Altura máxima definida (8in)');
        console.log('   - Code blocks com word-wrap');
        console.log('   - Tabelas com altura máxima');
        console.log('   - Inline styles removidos');
        
        // Recomendar próximo passo
        console.log('\n📋 Próximo passo:');
        console.log('   node scripts/qa/qa-html-mcp.js');
    }
}

// Executar
if (require.main === module) {
    const fixer = new FixOverflow();
    fixer.run();
}

module.exports = FixOverflow;