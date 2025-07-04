#!/usr/bin/env node

/**
 * Migrate and Setup MCPs
 * 
 * 1. Migra browserbase de OpenAI para Anthropic
 * 2. Copia MCPs existentes para o projeto
 * 3. Instala novos MCPs recomendados
 * 4. Atualiza configuração do Claude Desktop
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const MCP_SERVERS_DIR = path.join(PROJECT_ROOT, 'mcp-servers');
const CLAUDE_CONFIG_PATH = path.join(
    os.homedir(),
    'Library/Application Support/Claude/claude_desktop_config.json'
);

// Load environment variables
require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });

// MCPs to copy from existing installation
const MCPS_TO_COPY = [
    {
        name: 'filesystem',
        source: '/Users/d1f/Desktop/ZZ777/mcp-files/servers/src/filesystem',
        needsNpmInstall: true
    },
    {
        name: 'memory',
        source: '/Users/d1f/Desktop/ZZ777/mcp-files/servers/src/memory',
        needsNpmInstall: true
    },
    {
        name: 'github',
        source: '/Users/d1f/Desktop/ZZ777/mcp-files/servers/src/github',
        needsNpmInstall: true
    },
    {
        name: 'redis',
        source: '/Users/d1f/Desktop/ZZ777/mcp-files/servers/src/redis',
        needsNpmInstall: true
    },
    {
        name: 'puppeteer',
        source: '/Users/d1f/Desktop/ZZ777/mcp-files/servers/src/puppeteer',
        needsNpmInstall: true
    },
    {
        name: 'sequentialthinking',
        source: '/Users/d1f/mcp-servers/sequentialthinking',
        needsNpmInstall: false
    }
];

// New MCPs to install via npm
const MCPS_TO_INSTALL = [
    '@modelcontextprotocol/server-sqlite',
    '@modelcontextprotocol/server-fetch',
    '@modelcontextprotocol/server-time'
];

// Optional MCPs for future use
const OPTIONAL_MCPS = [
    '@modelcontextprotocol/server-gdrive',
    '@modelcontextprotocol/server-postgres',
    '@modelcontextprotocol/server-sentry'
];

async function main() {
    console.log('🚀 Starting MCP Migration and Setup\n');
    
    // Step 1: Backup current config
    await backupConfig();
    
    // Step 2: Copy existing MCPs
    await copyExistingMCPs();
    
    // Step 3: Install new MCPs
    await installNewMCPs();
    
    // Step 4: Update Claude config
    await updateClaudeConfig();
    
    // Step 5: Create documentation
    await createDocumentation();
    
    console.log('\n✅ MCP Migration and Setup Complete!');
    console.log('🔄 Please restart Claude Desktop to apply changes.');
}

async function backupConfig() {
    console.log('📋 Backing up Claude config...');
    
    try {
        const config = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
        const backupPath = CLAUDE_CONFIG_PATH + '.backup-' + Date.now();
        fs.writeFileSync(backupPath, config);
        console.log(`  ✅ Backup saved to: ${backupPath}`);
    } catch (error) {
        console.error('  ❌ Failed to backup config:', error.message);
    }
}

async function copyExistingMCPs() {
    console.log('\n📦 Copying existing MCPs to project...');
    
    for (const mcp of MCPS_TO_COPY) {
        console.log(`\n  📂 Copying ${mcp.name}...`);
        const targetDir = path.join(MCP_SERVERS_DIR, mcp.name);
        
        try {
            // Check if source exists
            if (!fs.existsSync(mcp.source)) {
                console.log(`    ⚠️  Source not found: ${mcp.source}`);
                continue;
            }
            
            // Create target directory
            fs.mkdirSync(targetDir, { recursive: true });
            
            // Copy files
            execSync(`cp -r ${mcp.source}/* ${targetDir}/`, { stdio: 'inherit' });
            console.log(`    ✅ Copied to: ${targetDir}`);
            
            // Install dependencies if needed
            if (mcp.needsNpmInstall && fs.existsSync(path.join(targetDir, 'package.json'))) {
                console.log(`    📦 Installing dependencies...`);
                execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
                
                // Build if needed
                if (fs.existsSync(path.join(targetDir, 'tsconfig.json'))) {
                    console.log(`    🔨 Building TypeScript...`);
                    execSync('npm run build', { cwd: targetDir, stdio: 'inherit' });
                }
            }
            
        } catch (error) {
            console.error(`    ❌ Failed to copy ${mcp.name}:`, error.message);
        }
    }
}

async function installNewMCPs() {
    console.log('\n📥 Installing new MCPs...');
    
    for (const mcpPackage of MCPS_TO_INSTALL) {
        console.log(`\n  📦 Installing ${mcpPackage}...`);
        
        try {
            // Install globally for now (can be changed to local)
            execSync(`npm install -g ${mcpPackage}`, { stdio: 'inherit' });
            console.log(`    ✅ Installed: ${mcpPackage}`);
        } catch (error) {
            console.error(`    ❌ Failed to install ${mcpPackage}:`, error.message);
        }
    }
}

async function updateClaudeConfig() {
    console.log('\n🔧 Updating Claude Desktop configuration...');
    
    try {
        // Read current config
        const configContent = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
        const config = JSON.parse(configContent);
        
        // Update browserbase to use Anthropic instead of OpenAI
        const browserbaseKey = 'github.com/browserbase/mcp-server-browserbase/tree/main/stagehand';
        if (config.mcpServers[browserbaseKey]) {
            console.log('  🔄 Migrating browserbase from OpenAI to Anthropic...');
            
            // Remove OpenAI key and add Anthropic key
            delete config.mcpServers[browserbaseKey].env.OPENAI_API_KEY;
            config.mcpServers[browserbaseKey].env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
            
            console.log('    ✅ Browserbase migrated to use Anthropic');
        }
        
        // Add local MCP servers
        console.log('  📍 Adding local MCP servers...');
        
        // Filesystem MCP
        config.mcpServers['book-automation-filesystem'] = {
            autoApprove: ['read_file', 'write_file', 'list_directory'],
            disabled: false,
            timeout: 60,
            command: 'node',
            args: [path.join(MCP_SERVERS_DIR, 'filesystem/dist/index.js'), PROJECT_ROOT],
            env: {},
            transportType: 'stdio'
        };
        
        // Memory MCP
        config.mcpServers['book-automation-memory'] = {
            autoApprove: ['store_memory', 'retrieve_memory'],
            disabled: false,
            timeout: 60,
            command: 'node',
            args: [path.join(MCP_SERVERS_DIR, 'memory/dist/index.js')],
            env: {
                MEMORY_FILE_PATH: path.join(PROJECT_ROOT, 'mcp-data/memory.json')
            },
            transportType: 'stdio'
        };
        
        // GitHub MCP
        config.mcpServers['book-automation-github'] = {
            autoApprove: ['create_pr', 'list_issues'],
            disabled: false,
            timeout: 60,
            command: 'node',
            args: [path.join(MCP_SERVERS_DIR, 'github/dist/index.js')],
            env: {
                GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN
            },
            transportType: 'stdio'
        };
        
        // Redis MCP
        config.mcpServers['book-automation-redis'] = {
            autoApprove: ['get', 'set', 'del'],
            disabled: false,
            timeout: 60,
            command: 'node',
            args: [path.join(MCP_SERVERS_DIR, 'redis/build/index.js')],
            env: {
                REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
            },
            transportType: 'stdio'
        };
        
        // SQLite MCP (for book metadata)
        config.mcpServers['book-automation-sqlite'] = {
            autoApprove: ['query', 'execute'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-sqlite', path.join(PROJECT_ROOT, 'mcp-data/books.db')],
            env: {},
            transportType: 'stdio'
        };
        
        // Fetch MCP (for web research)
        config.mcpServers['book-automation-fetch'] = {
            autoApprove: ['fetch'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-fetch'],
            env: {},
            transportType: 'stdio'
        };
        
        // Time MCP (for scheduling)
        config.mcpServers['book-automation-time'] = {
            autoApprove: ['get_current_time', 'schedule_task'],
            disabled: false,
            timeout: 60,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-time'],
            env: {},
            transportType: 'stdio'
        };
        
        // Save updated config
        fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2));
        console.log('  ✅ Configuration updated successfully');
        
    } catch (error) {
        console.error('  ❌ Failed to update config:', error.message);
    }
}

async function createDocumentation() {
    console.log('\n📚 Creating MCP documentation...');
    
    const docs = `# MCP Servers for Book Automation

## Installed MCPs

### Core MCPs (Always Active)

1. **filesystem** - File management
   - Read/write chapters
   - Manage book structure
   - Access templates

2. **memory** - Context persistence
   - Remember book details across sessions
   - Track writing progress
   - Store character/plot information

3. **github** - Version control
   - Create PRs for book releases
   - Track issues/feedback
   - Manage versions

4. **redis** - Queue management
   - Monitor pipeline jobs
   - Track processing status
   - Cache frequent data

5. **anthropic** - AI text generation
   - Generate chapters
   - Rewrite content
   - Analyze text quality

### Utility MCPs

6. **sqlite** - Book metadata
   - Store book information
   - Track sales/downloads
   - Manage author details

7. **fetch** - Web research
   - Research topics
   - Gather reference material
   - Check facts

8. **time** - Scheduling
   - Schedule pipeline runs
   - Track deadlines
   - Time-based automation

9. **puppeteer** - PDF generation
   - Convert HTML to PDF
   - Screenshot previews
   - Browser automation

10. **sequentialthinking** - Planning
    - Break down complex tasks
    - Create structured outlines
    - Step-by-step reasoning

## Usage Examples

### Creating a new book
\`\`\`
1. Use memory MCP to store book concept
2. Use sequentialthinking to plan chapters
3. Use filesystem to create chapter files
4. Use anthropic to generate content
5. Use github to version control
\`\`\`

### Researching topics
\`\`\`
1. Use fetch MCP to gather web content
2. Use anthropic to analyze and summarize
3. Use memory to store key findings
4. Use sqlite to track sources
\`\`\`

### Publishing workflow
\`\`\`
1. Use filesystem to read final chapters
2. Use puppeteer to generate PDF
3. Use github to create release
4. Use sqlite to update book status
\`\`\`

## Configuration

All MCPs are configured in Claude Desktop settings.
API keys are loaded from the project's .env file.

To add new MCPs:
1. Install via npm
2. Run \`node mcp-config/migrate-and-setup-mcps.js\`
3. Restart Claude Desktop
`;
    
    fs.writeFileSync(path.join(PROJECT_ROOT, 'MCP-GUIDE.md'), docs);
    console.log('  ✅ Documentation created: MCP-GUIDE.md');
}

// Create mcp-data directory
fs.mkdirSync(path.join(PROJECT_ROOT, 'mcp-data'), { recursive: true });

// Run main function
main().catch(console.error);