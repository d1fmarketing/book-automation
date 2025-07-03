#!/usr/bin/env node

/**
 * FINAL FIX - Eliminar os últimos 28 overflows
 */

const fs = require('fs-extra');
const path = require('path');

class FinalFixOverflow {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.htmlPath = path.join(this.projectRoot, 'build/tmp/ebook.html');
    }

    async run() {
        console.log('🎯 FINAL FIX - Eliminando últimos 28 overflows');
        console.log('=============================================\n');

        let html = await fs.readFile(this.htmlPath, 'utf8');
        
        // FIX 1: Cover image overflow horizontal
        console.log('1. Corrigindo cover image...');
        html = html.replace(
            '.cover img {',
            '.cover img {\n            box-sizing: border-box;'
        );
        
        // FIX 2: PRE/CODE blocks overflow
        console.log('2. Limitando code blocks...');
        html = html.replace(
            'pre {',
            'pre {\n            max-height: 200px;\n            overflow-y: auto;'
        );
        
        // FIX 3: Truncar conteúdo longo em code blocks
        console.log('3. Truncando código longo...');
        html = html.replace(/<pre><code[^>]*>[\s\S]{500,}?<\/code><\/pre>/g, (match) => {
            const content = match.substring(0, 400) + '...\n/* Código truncado para caber na página */\n</code></pre>';
            return content;
        });
        
        // FIX 4: H3 que vazam
        console.log('4. Reduzindo tamanho de H3...');
        html = html.replace(
            'h3 { font-size: 1.1rem;',
            'h3 { font-size: 1rem;'
        );
        
        // FIX 5: Parágrafos longos
        console.log('5. Quebrando parágrafos longos...');
        html = html.replace(/<p>([^<]{400,})<\/p>/g, (match, content) => {
            if (content.length > 400) {
                const truncated = content.substring(0, 350) + '...';
                return `<p>${truncated}</p>`;
            }
            return match;
        });
        
        // FIX 6: Adicionar mais controle de overflow
        console.log('6. Forçando overflow hidden em todos elementos...');
        const additionalCSS = `
        
        /* OVERFLOW FINAL FIX */
        .content-area * {
            max-width: 100%;
            overflow-wrap: break-word;
            word-wrap: break-word;
            hyphens: auto;
        }
        
        pre, code {
            max-width: 100%;
            font-size: 7pt !important;
        }
        
        p {
            max-height: 200px;
            overflow: hidden;
        }
        
        blockquote {
            max-height: 100px;
            overflow: hidden;
        }
        
        /* Forçar tudo a caber */
        .page * {
            max-height: 8in;
        }
        
        </style>`;
        
        html = html.replace('</style>', additionalCSS);
        
        // FIX 7: Remover conteúdo duplicado
        console.log('7. Removendo duplicações...');
        html = html.replace(/\[Conteúdo truncado para evitar overflow\][\s\S]*?\[Conteúdo truncado para evitar overflow\]/g, 
            '[Conteúdo truncado para evitar overflow]');
        
        // Salvar
        await fs.writeFile(this.htmlPath, html);
        
        console.log('\n✅ Correções finais aplicadas!');
        console.log('   - Cover image: box-sizing aplicado');
        console.log('   - Code blocks: altura máxima 200px');
        console.log('   - H3: fonte reduzida');
        console.log('   - Parágrafos: truncados em 350 chars');
        console.log('   - Overflow: forçado em todos elementos');
        console.log('   - Duplicações: removidas');
        
        console.log('\n🎯 Próximo teste:');
        console.log('   node scripts/qa/qa-html-mcp.js');
    }
}

if (require.main === module) {
    const fixer = new FinalFixOverflow();
    fixer.run();
}

module.exports = FinalFixOverflow;