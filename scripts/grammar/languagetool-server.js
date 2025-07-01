#!/usr/bin/env node

/**
 * LanguageTool Server Manager
 * Manages the LanguageTool Docker container
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const axios = require('axios');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
};

class LanguageToolServer {
    constructor() {
        this.dockerComposePath = path.join(__dirname, 'docker-compose.yml');
        this.apiUrl = 'http://localhost:8081/v2';
        this.maxRetries = 30;
        this.retryDelay = 2000;
    }

    async checkDocker() {
        return new Promise((resolve) => {
            exec('docker --version', (error) => {
                if (error) {
                    console.error(colors.red('❌ Docker is not installed'));
                    console.log(colors.yellow('Please install Docker from https://docker.com'));
                    resolve(false);
                } else {
                    console.log(colors.green('✅ Docker is installed'));
                    resolve(true);
                }
            });
        });
    }

    async isRunning() {
        try {
            const response = await axios.get(`${this.apiUrl}/languages`, { timeout: 1000 });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    async start() {
        console.log(colors.blue('🚀 Starting LanguageTool server...'));
        
        // Check if already running
        if (await this.isRunning()) {
            console.log(colors.yellow('⚠️  Server is already running'));
            return true;
        }

        // Check Docker
        if (!await this.checkDocker()) {
            return false;
        }

        // Start with docker-compose
        const dockerCompose = spawn('docker-compose', [
            '-f', this.dockerComposePath,
            'up', '-d'
        ], {
            stdio: 'inherit',
            cwd: path.dirname(this.dockerComposePath)
        });

        return new Promise((resolve) => {
            dockerCompose.on('close', async (code) => {
                if (code !== 0) {
                    console.error(colors.red('❌ Failed to start Docker container'));
                    resolve(false);
                } else {
                    console.log(colors.green('✅ Docker container started'));
                    console.log(colors.blue('⏳ Waiting for server to be ready...'));
                    
                    // Wait for server to be ready
                    const ready = await this.waitForServer();
                    if (ready) {
                        console.log(colors.green('✅ LanguageTool server is ready!'));
                        console.log(colors.gray(`   API: ${this.apiUrl}`));
                    }
                    resolve(ready);
                }
            });
        });
    }

    async stop() {
        console.log(colors.blue('🛑 Stopping LanguageTool server...'));
        
        const dockerCompose = spawn('docker-compose', [
            '-f', this.dockerComposePath,
            'down'
        ], {
            stdio: 'inherit',
            cwd: path.dirname(this.dockerComposePath)
        });

        return new Promise((resolve) => {
            dockerCompose.on('close', (code) => {
                if (code === 0) {
                    console.log(colors.green('✅ Server stopped'));
                    resolve(true);
                } else {
                    console.error(colors.red('❌ Failed to stop server'));
                    resolve(false);
                }
            });
        });
    }

    async restart() {
        await this.stop();
        await new Promise(resolve => setTimeout(resolve, 2000));
        return await this.start();
    }

    async waitForServer() {
        for (let i = 0; i < this.maxRetries; i++) {
            if (await this.isRunning()) {
                return true;
            }
            
            process.stdout.write(colors.gray('.'));
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
        
        console.log();
        console.error(colors.red('❌ Server failed to start'));
        return false;
    }

    async status() {
        console.log(colors.blue('📊 Checking server status...'));
        
        if (await this.isRunning()) {
            try {
                const response = await axios.get(`${this.apiUrl}/languages`);
                const languages = response.data.map(lang => lang.code);
                
                console.log(colors.green('✅ Server is running'));
                console.log(colors.gray(`   URL: ${this.apiUrl}`));
                console.log(colors.gray(`   Languages: ${languages.length}`));
                console.log(colors.gray(`   Available: ${languages.slice(0, 10).join(', ')}...`));
                
                // Check specific language support
                if (languages.includes('pt-BR')) {
                    console.log(colors.green('   ✅ Portuguese (Brazil) is supported'));
                }
                if (languages.includes('en-US')) {
                    console.log(colors.green('   ✅ English (US) is supported'));
                }
                
                return true;
            } catch (error) {
                console.error(colors.red('❌ Error checking server status'));
                return false;
            }
        } else {
            console.log(colors.yellow('⚠️  Server is not running'));
            console.log(colors.gray('   Start with: npm run grammar:server'));
            return false;
        }
    }

    async logs() {
        console.log(colors.blue('📋 Showing server logs...'));
        
        const dockerCompose = spawn('docker-compose', [
            '-f', this.dockerComposePath,
            'logs', '-f', '--tail=100'
        ], {
            stdio: 'inherit',
            cwd: path.dirname(this.dockerComposePath)
        });

        // Handle Ctrl+C
        process.on('SIGINT', () => {
            dockerCompose.kill();
            process.exit(0);
        });
    }

    async downloadNgrams(language = 'pt') {
        console.log(colors.blue(`📥 Downloading n-gram data for ${language}...`));
        console.log(colors.yellow('⚠️  This improves grammar suggestions but requires ~8GB of space'));
        
        // Instructions for manual download
        console.log('\nTo download n-gram data:');
        console.log('1. Visit: https://languagetool.org/download/ngram-data/');
        console.log(`2. Download: ngrams-${language}-20150817.zip`);
        console.log('3. Extract to: scripts/grammar/ngrams/');
        console.log('4. Uncomment the volume mount in docker-compose.yml');
        console.log('5. Restart the server');
    }
}

// CLI usage
if (require.main === module) {
    const server = new LanguageToolServer();
    const command = process.argv[2] || 'start';
    
    (async () => {
        switch (command) {
            case 'start':
                await server.start();
                break;
                
            case 'stop':
                await server.stop();
                break;
                
            case 'restart':
                await server.restart();
                break;
                
            case 'status':
                await server.status();
                break;
                
            case 'logs':
                await server.logs();
                break;
                
            case 'download-ngrams':
                await server.downloadNgrams(process.argv[3]);
                break;
                
            default:
                console.log('Usage: languagetool-server.js [start|stop|restart|status|logs|download-ngrams]');
                process.exit(1);
        }
    })();
}

module.exports = LanguageToolServer;