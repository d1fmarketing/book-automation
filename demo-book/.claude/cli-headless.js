#!/usr/bin/env node

/**
 * Claude Elite CLI - Headless Command Handler
 * Provides slash command functionality for Claude AI interactions
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class ClaudeEliteCLI {
    constructor() {
        this.commandsPath = path.join(__dirname, 'commands');
        this.commands = new Map();
        this.aliases = new Map();
    }

    /**
     * Initialize the CLI by loading all commands
     */
    async init() {
        try {
            await this.loadCommands();
            await this.processCommand();
        } catch (error) {
            this.error(`Fatal error: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Load all command modules from the commands directory
     */
    async loadCommands() {
        try {
            const files = await fs.readdir(this.commandsPath);
            
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const commandName = file.replace('.js', '');
                    const commandPath = path.join(this.commandsPath, file);
                    
                    try {
                        const command = require(commandPath);
                        this.commands.set(commandName, command);
                        
                        // Register aliases
                        if (command.aliases) {
                            command.aliases.forEach(alias => {
                                this.aliases.set(alias, commandName);
                            });
                        }
                    } catch (error) {
                        this.warn(`Failed to load command ${commandName}: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.warn('No commands directory found. Creating default commands...');
                await this.createDefaultCommands();
            } else {
                throw error;
            }
        }
    }

    /**
     * Create default command structure if missing
     */
    async createDefaultCommands() {
        await fs.mkdir(this.commandsPath, { recursive: true });
        
        // Create a sample help command
        const helpCommand = `module.exports = {
    name: 'help',
    description: 'Show available commands',
    aliases: ['h', '?'],
    
    async execute(args, cli) {
        cli.log('\\n🚀 Claude Elite Commands:\\n');
        
        for (const [name, command] of cli.commands) {
            const aliases = command.aliases ? \` (\${command.aliases.join(', ')})\` : '';
            cli.log(\`  /\${name}\${aliases} - \${command.description || 'No description'}\`);
        }
        
        cli.log('\\n📚 Usage: claude /<command> [args]\\n');
    }
};`;
        
        await fs.writeFile(path.join(this.commandsPath, 'help.js'), helpCommand);
        await this.loadCommands();
    }

    /**
     * Process the command from command line arguments
     */
    async processCommand() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            // No command provided, show help
            const helpCommand = this.commands.get('help');
            if (helpCommand) {
                await helpCommand.execute([], this);
            } else {
                this.log('No commands available. Run "claude /init" to set up.');
            }
            return;
        }

        const commandArg = args[0];
        
        // Check if it's a slash command
        if (!commandArg.startsWith('/')) {
            this.error(`Invalid command format. Use: claude /<command>`);
            process.exit(1);
        }

        const commandName = commandArg.substring(1);
        const commandArgs = args.slice(1);

        // Resolve command (check aliases)
        const resolvedCommand = this.aliases.get(commandName) || commandName;
        const command = this.commands.get(resolvedCommand);

        if (!command) {
            this.error(`Unknown command: /${commandName}`);
            this.log('Run "claude /help" to see available commands.');
            process.exit(1);
        }

        try {
            await command.execute(commandArgs, this);
        } catch (error) {
            this.error(`Command failed: ${error.message}`);
            if (process.env.DEBUG) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    /**
     * Utility: Execute a shell command
     */
    async exec(command, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, {
                shell: true,
                stdio: options.stdio || 'inherit',
                cwd: options.cwd || process.cwd(),
                ...options
            });

            let stdout = '';
            let stderr = '';

            if (options.capture) {
                child.stdout?.on('data', (data) => { stdout += data; });
                child.stderr?.on('data', (data) => { stderr += data; });
            }

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                } else {
                    resolve({ stdout, stderr, code });
                }
            });

            child.on('error', reject);
        });
    }

    /**
     * Utility: Read JSON file
     */
    async readJSON(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * Utility: Write JSON file
     */
    async writeJSON(filePath, data, indent = 2) {
        await fs.writeFile(filePath, JSON.stringify(data, null, indent));
    }

    /**
     * Utility: Check if file exists
     */
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Logging utilities
     */
    log(message) {
        console.log(message);
    }

    success(message) {
        console.log(`✅ ${message}`);
    }

    error(message) {
        console.error(`❌ ${message}`);
    }

    warn(message) {
        console.warn(`⚠️  ${message}`);
    }

    info(message) {
        console.log(`ℹ️  ${message}`);
    }
}

// Run CLI if executed directly
if (require.main === module) {
    const cli = new ClaudeEliteCLI();
    cli.init();
}

module.exports = ClaudeEliteCLI;