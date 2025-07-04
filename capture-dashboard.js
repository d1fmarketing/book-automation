#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

async function captureDashboard() {
    console.log('🔍 Iniciando captura visual da dashboard...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Capturar logs do console
        const consoleLogs = [];
        const consoleErrors = [];
        
        page.on('console', msg => {
            const text = msg.text();
            consoleLogs.push(`[${msg.type()}] ${text}`);
            console.log(`Console [${msg.type()}]:`, text);
        });
        
        page.on('pageerror', error => {
            consoleErrors.push(error.message);
            console.log('❌ Erro na página:', error.message);
        });
        
        // Set viewport
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });
        
        console.log('📡 Navegando para http://localhost:3000...');
        
        try {
            await page.goto('http://localhost:3000', { 
                waitUntil: 'networkidle2', 
                timeout: 30000 
            });
        } catch (error) {
            console.error('❌ Erro ao carregar a página:', error.message);
            return;
        }
        
        // Aguardar React renderizar
        console.log('⏳ Aguardando React renderizar...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Criar diretório para screenshots
        const screenshotDir = path.join(__dirname, 'dashboard-screenshots');
        await fs.mkdir(screenshotDir, { recursive: true });
        
        // Capturar screenshot
        const screenshotPath = path.join(screenshotDir, `dashboard-${Date.now()}.png`);
        await page.screenshot({
            path: screenshotPath,
            fullPage: true
        });
        console.log(`\n📸 Screenshot salvo em: ${screenshotPath}`);
        
        // Analisar conteúdo da página
        const pageAnalysis = await page.evaluate(() => {
            const root = document.getElementById('root');
            const body = document.body;
            
            // Pegar texto visível
            const visibleText = body.innerText || '';
            
            // Verificar se há elementos React
            const reactElements = document.querySelectorAll('[data-reactroot], [data-react-root], #root > *');
            
            // Pegar primeiros 1000 caracteres do HTML
            const htmlSnippet = body.innerHTML.substring(0, 1000);
            
            // Verificar estilos
            const rootStyles = root ? window.getComputedStyle(root) : null;
            const bodyStyles = window.getComputedStyle(body);
            
            return {
                hasRoot: !!root,
                rootHTML: root ? root.innerHTML.substring(0, 500) : 'ROOT NÃO ENCONTRADO',
                visibleText: visibleText.substring(0, 500),
                textLength: visibleText.length,
                reactElementsCount: reactElements.length,
                htmlSnippet,
                backgroundColor: bodyStyles.backgroundColor,
                rootDisplay: rootStyles?.display,
                rootVisibility: rootStyles?.visibility,
                hasVisibleContent: visibleText.trim().length > 0
            };
        });
        
        console.log('\n📊 ANÁLISE DA PÁGINA:');
        console.log('=' .repeat(50));
        console.log(`✓ Root element existe: ${pageAnalysis.hasRoot ? 'SIM' : 'NÃO'}`);
        console.log(`✓ Elementos React encontrados: ${pageAnalysis.reactElementsCount}`);
        console.log(`✓ Texto visível: ${pageAnalysis.textLength} caracteres`);
        console.log(`✓ Background color: ${pageAnalysis.backgroundColor}`);
        console.log(`✓ Root display: ${pageAnalysis.rootDisplay}`);
        console.log(`✓ Root visibility: ${pageAnalysis.rootVisibility}`);
        
        console.log('\n📝 TEXTO VISÍVEL:');
        console.log('-'.repeat(50));
        if (pageAnalysis.visibleText) {
            console.log(pageAnalysis.visibleText);
        } else {
            console.log('❌ NENHUM TEXTO VISÍVEL - PÁGINA ESTÁ EM BRANCO!');
        }
        
        console.log('\n🔧 HTML DO ROOT:');
        console.log('-'.repeat(50));
        console.log(pageAnalysis.rootHTML);
        
        console.log('\n📋 LOGS DO CONSOLE:');
        console.log('-'.repeat(50));
        consoleLogs.forEach(log => console.log(log));
        
        if (consoleErrors.length > 0) {
            console.log('\n❌ ERROS DO CONSOLE:');
            console.log('-'.repeat(50));
            consoleErrors.forEach(error => console.log(error));
        }
        
        // Diagnóstico final
        console.log('\n🏁 DIAGNÓSTICO FINAL:');
        console.log('=' .repeat(50));
        
        if (!pageAnalysis.hasVisibleContent) {
            console.log('❌ DASHBOARD ESTÁ EM BRANCO!');
            console.log('\nPossíveis causas:');
            console.log('1. Erro de JavaScript impedindo renderização');
            console.log('2. CSS escondendo conteúdo');
            console.log('3. React não está montando os componentes');
            console.log('4. Problema com importações ou dependências');
        } else {
            console.log('✅ Dashboard tem conteúdo visível');
            console.log(`   Texto encontrado: "${pageAnalysis.visibleText.substring(0, 100)}..."`);
        }
        
        // Salvar relatório
        const reportPath = path.join(screenshotDir, `dashboard-report-${Date.now()}.json`);
        await fs.writeFile(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            analysis: pageAnalysis,
            consoleLogs,
            consoleErrors,
            screenshotPath
        }, null, 2));
        
        console.log(`\n💾 Relatório salvo em: ${reportPath}`);
        
    } catch (error) {
        console.error('❌ Erro durante captura:', error);
    } finally {
        await browser.close();
    }
}

// Executar
captureDashboard().catch(console.error);