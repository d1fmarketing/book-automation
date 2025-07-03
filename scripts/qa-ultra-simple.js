#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pdfPath = process.argv[2] || 'build/dist/ebook-ultra-clean.pdf';

console.log('\n🔍 QA Visual Ultra Simples\n');

if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF não encontrado:', pdfPath);
    process.exit(1);
}

// Converter páginas
const outputDir = 'build/qa';
fs.mkdirSync(outputDir, { recursive: true });

try {
    execSync('pdftoppm -png -f 1 -l 5 -r 150 "' + pdfPath + '" "' + outputDir + '/page"');
    console.log('✅ Screenshots gerados em:', outputDir);
    
    // Listar páginas
    const pages = fs.readdirSync(outputDir).filter(f => f.endsWith('.png')).sort();
    
    console.log('\n📄 Páginas disponíveis:');
    pages.forEach(page => {
        const size = fs.statSync(path.join(outputDir, page)).size;
        console.log('   - ' + page + ' (' + (size/1024).toFixed(1) + ' KB)');
    });
    
} catch (err) {
    console.error('❌ Erro ao gerar screenshots:', err.message);
}
