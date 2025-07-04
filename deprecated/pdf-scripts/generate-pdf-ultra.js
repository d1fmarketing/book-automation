#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const preset = require('./pdf-presets/ultra-clean.js');

async function generatePDF() {
    console.log('\n🚀 GERADOR ULTRA LIMPO\n');
    
    // Combinar capítulos
    const chapters = fs.readdirSync('chapters')
        .filter(f => f.endsWith('.md'))
        .sort()
        .map(f => fs.readFileSync(path.join('chapters', f), 'utf8'))
        .join('\n\n<div style="page-break-after: always;"></div>\n\n');
    
    // Processar
    const processedMarkdown = preset.processMarkdown(chapters);
    const htmlContent = marked.parse(processedMarkdown);
    
    // HTML
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>The Claude Elite Pipeline</title>' +
                 '<style>' + preset.css + '</style></head><body>' + htmlContent + '</body></html>';
    
    // Salvar HTML
    fs.mkdirSync('build/temp', { recursive: true });
    fs.writeFileSync('build/temp/ultra-clean.html', html);
    
    // Gerar PDF
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    fs.mkdirSync('build/dist', { recursive: true });
    await page.pdf({
        path: 'build/dist/ebook-ultra-clean.pdf',
        ...preset.options
    });
    
    await browser.close();
    console.log('✅ PDF gerado: build/dist/ebook-ultra-clean.pdf\n');
}

generatePDF().catch(console.error);
