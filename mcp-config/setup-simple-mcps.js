#!/usr/bin/env node

/**
 * Simple MCP Setup
 * 
 * Configura MCPs usando versões já compiladas e npx
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Paths
const CLAUDE_CONFIG_PATH = path.join(
    os.homedir(),
    'Library/Application Support/Claude/claude_desktop_config.json'
);

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
    console.log('🚀 Configurando MCPs para Book Automation\n');
    
    // Backup
    const config = JSON.parse(fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8'));
    const backupPath = CLAUDE_CONFIG_PATH + '.backup-' + Date.now();
    fs.writeFileSync(backupPath, JSON.stringify(config, null, 2));
    console.log(`📋 Backup salvo em: ${backupPath}\n`);
    
    // 1. Migrar browserbase para Anthropic
    const browserbaseKey = 'github.com/browserbase/mcp-server-browserbase/tree/main/stagehand';
    if (config.mcpServers[browserbaseKey]) {
        console.log('🔄 Migrando browserbase de OpenAI para Anthropic...');
        delete config.mcpServers[browserbaseKey].env.OPENAI_API_KEY;
        config.mcpServers[browserbaseKey].env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        console.log('  ✅ Migrado para usar Anthropic\n');
    }
    
    // 2. Adicionar MCPs úteis para o projeto
    console.log('📦 Adicionando MCPs para Book Automation...\n');
    
    // Filesystem - usar o existente
    if (!config.mcpServers['book-automation-filesystem']) {
        config.mcpServers['book-automation-filesystem'] = {
            autoApprove: ['read_file', 'write_file', 'list_directory'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-filesystem',
                path.join(__dirname, '..')
            ],
            env: {},
            transportType: 'stdio'
        };
        console.log('  ✅ Filesystem MCP adicionado');
    }
    
    // Memory - usar npx
    if (!config.mcpServers['book-automation-memory']) {
        config.mcpServers['book-automation-memory'] = {
            autoApprove: ['store_memory', 'retrieve_memory'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-memory'
            ],
            env: {
                MEMORY_FILE_PATH: path.join(__dirname, '..', 'mcp-data', 'memory.json')
            },
            transportType: 'stdio'
        };
        console.log('  ✅ Memory MCP adicionado');
    }
    
    // GitHub - usar npx
    if (!config.mcpServers['book-automation-github']) {
        config.mcpServers['book-automation-github'] = {
            autoApprove: ['create_pr', 'list_issues', 'create_repository'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-github'
            ],
            env: {
                GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN
            },
            transportType: 'stdio'
        };
        console.log('  ✅ GitHub MCP adicionado');
    }
    
    // Brave Search - para pesquisa de conteúdo
    if (!config.mcpServers['book-automation-search']) {
        config.mcpServers['book-automation-search'] = {
            autoApprove: ['search'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-brave-search'
            ],
            env: {
                BRAVE_API_KEY: 'BSAAUX6uV_s0t-1i8BLaNZY5ls9jiYS' // Já tem no config original
            },
            transportType: 'stdio'
        };
        console.log('  ✅ Brave Search MCP adicionado');
    }
    
    // Puppeteer - para gerar PDFs
    if (!config.mcpServers['book-automation-puppeteer']) {
        config.mcpServers['book-automation-puppeteer'] = {
            autoApprove: ['screenshot', 'pdf'],
            disabled: false,
            timeout: 120,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-puppeteer'
            ],
            env: {},
            transportType: 'stdio'
        };
        console.log('  ✅ Puppeteer MCP adicionado');
    }
    
    // Sequential Thinking - usar o existente
    if (!config.mcpServers['book-automation-thinking']) {
        config.mcpServers['book-automation-thinking'] = {
            autoApprove: ['sequentialthinking'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: [
                '-y',
                '@modelcontextprotocol/server-sequential-thinking'
            ],
            env: {},
            transportType: 'stdio'
        };
        console.log('  ✅ Sequential Thinking MCP adicionado');
    }
    
    // Salvar configuração
    fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log('\n✅ Configuração atualizada com sucesso!');
    
    // Criar diretório para dados MCP
    const mcpDataDir = path.join(__dirname, '..', 'mcp-data');
    fs.mkdirSync(mcpDataDir, { recursive: true });
    
    // Criar documentação
    const docs = `# MCPs Configurados para Book Automation

## MCPs Ativos

### 1. Anthropic
- Geração de texto
- Análise de conteúdo
- Reescrita de capítulos

### 2. Filesystem
- Leitura/escrita de arquivos
- Gerenciamento de capítulos
- Acesso a templates

### 3. Memory
- Persistência de contexto
- Rastreamento de progresso
- Armazenamento de metadados do livro

### 4. GitHub
- Criação de PRs
- Versionamento
- Gerenciamento de releases

### 5. Brave Search
- Pesquisa de conteúdo
- Verificação de fatos
- Pesquisa de referências

### 6. Puppeteer
- Geração de PDFs
- Screenshots de preview
- Automação de browser

### 7. Sequential Thinking
- Planejamento estruturado
- Decomposição de tarefas
- Criação de outlines

## Uso no Projeto

### Para criar um novo livro:
1. Use Memory para armazenar conceito
2. Use Sequential Thinking para planejar
3. Use Filesystem para criar estrutura
4. Use Anthropic para gerar conteúdo
5. Use GitHub para versionar
6. Use Puppeteer para gerar PDF

### Para pesquisar tópicos:
1. Use Brave Search para encontrar informação
2. Use Anthropic para analisar e resumir
3. Use Memory para guardar insights

## Comandos Úteis

\`\`\`bash
# Reiniciar Claude para aplicar mudanças
# macOS: Cmd+Q e reabrir

# Verificar logs MCP
tail -f ~/Library/Logs/Claude/*.log

# Testar MCP individual
npx @modelcontextprotocol/inspector
\`\`\`
`;
    
    fs.writeFileSync(path.join(__dirname, '..', 'MCP-SETUP.md'), docs);
    console.log('📚 Documentação criada: MCP-SETUP.md');
    
    console.log('\n🔄 Por favor, reinicie o Claude Desktop para aplicar as mudanças.');
    
    // Mostrar resumo
    console.log('\n📊 Resumo:');
    console.log('  - Browserbase migrado para Anthropic API');
    console.log('  - 6 MCPs configurados para o projeto');
    console.log('  - Todos usando npx (sem necessidade de instalação local)');
    console.log('  - Configuração otimizada para automação de ebooks');
}

main().catch(console.error);