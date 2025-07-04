#!/usr/bin/env node

/**
 * Configure MCP APIs
 * 
 * Atualiza apenas os MCPs que precisam de API keys para economizar custos
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Caminho do config do Claude
const configPath = path.join(
    os.homedir(),
    'Library/Application Support/Claude/claude_desktop_config.json'
);

// Carregar .env
require('dotenv').config();

// MCPs que NÃO devem ser alterados (não precisam de API)
const SKIP_MCPS = [
    'sequentialthinking',
    'filesystem',
    'memory',
    'puppeteer',
    'redis',
    'everything',
    'github.com/firebase/genkit',
    'zapier'
];

// Mapeamento de MCPs para variáveis de ambiente
const MCP_ENV_MAPPING = {
    'github': {
        'GITHUB_PERSONAL_ACCESS_TOKEN': process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN
    },
    'everart': {
        'EVERART_API_KEY': process.env.EVERART_API_KEY
    },
    'aws-kb': {
        'AWS_REGION': process.env.AWS_REGION || 'us-east-1',
        'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
        'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY
    }
};

async function updateMCPConfig() {
    console.log('🔧 Configurando APIs dos MCPs...\n');
    
    // Ler config existente
    let config;
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(configContent);
    } catch (error) {
        console.error('❌ Erro ao ler config do Claude:', error.message);
        return;
    }
    
    // Backup do config original
    const backupPath = configPath + '.backup-' + Date.now();
    fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
    console.log(`📋 Backup salvo em: ${backupPath}\n`);
    
    let updated = false;
    
    // Atualizar apenas MCPs necessários
    for (const [mcpName, mcpConfig] of Object.entries(config.mcpServers || {})) {
        // Pular MCPs que não precisam de API
        const shouldSkip = SKIP_MCPS.some(skip => mcpName.includes(skip));
        if (shouldSkip) {
            console.log(`⏭️  Pulando ${mcpName} (não precisa de API)`);
            continue;
        }
        
        // Verificar se temos mapeamento para este MCP
        const envMapping = MCP_ENV_MAPPING[mcpName] || 
                          MCP_ENV_MAPPING[mcpName.split('/').pop()];
        
        if (envMapping) {
            console.log(`\n📦 Configurando ${mcpName}:`);
            
            for (const [envKey, envValue] of Object.entries(envMapping)) {
                if (envValue) {
                    if (!mcpConfig.env) mcpConfig.env = {};
                    
                    const oldValue = mcpConfig.env[envKey];
                    if (oldValue !== envValue) {
                        mcpConfig.env[envKey] = envValue;
                        console.log(`  ✅ ${envKey} = ${envValue.substring(0, 10)}...`);
                        updated = true;
                    } else {
                        console.log(`  ℹ️  ${envKey} já configurada`);
                    }
                } else {
                    console.log(`  ⚠️  ${envKey} não encontrada no .env`);
                }
            }
        }
    }
    
    // Adicionar Anthropic MCP se não existir
    if (!config.mcpServers['anthropic']) {
        console.log('\n📦 Adicionando Anthropic MCP:');
        
        if (process.env.ANTHROPIC_API_KEY) {
            config.mcpServers['anthropic'] = {
                "autoApprove": ["generate_text", "analyze_text"],
                "disabled": false,
                "timeout": 60,
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-anthropic"],
                "env": {
                    "ANTHROPIC_API_KEY": process.env.ANTHROPIC_API_KEY
                },
                "transportType": "stdio"
            };
            console.log('  ✅ Anthropic MCP configurado');
            updated = true;
        } else {
            console.log('  ⚠️  ANTHROPIC_API_KEY não encontrada no .env');
        }
    }
    
    // Salvar config atualizado
    if (updated) {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('\n✅ Configuração atualizada com sucesso!');
        console.log('🔄 Reinicie o Claude Desktop para aplicar as mudanças.');
    } else {
        console.log('\n✅ Nenhuma atualização necessária.');
    }
    
    // Mostrar resumo
    console.log('\n📊 Resumo dos MCPs:');
    console.log('  - MCPs sem API (mantidos): ' + SKIP_MCPS.length);
    console.log('  - MCPs com API configurada: ' + Object.keys(MCP_ENV_MAPPING).length);
    
    // Verificar APIs disponíveis no .env
    console.log('\n🔑 APIs disponíveis no .env:');
    const apis = [
        'ANTHROPIC_API_KEY',
        'GEMINI_API_KEY',
        'GITHUB_TOKEN',
        'EVERART_API_KEY',
        'AWS_ACCESS_KEY_ID'
    ];
    
    for (const api of apis) {
        if (process.env[api]) {
            console.log(`  ✅ ${api}`);
        } else {
            console.log(`  ❌ ${api}`);
        }
    }
}

// Executar
updateMCPConfig().catch(console.error);