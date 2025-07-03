#!/usr/bin/env node

/**
 * Environment Checker
 * Verifies all required dependencies for the eBook pipeline
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs-extra');
const path = require('path');
const semver = require('semver');

const execAsync = promisify(exec);

// Color codes for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m'
};

class EnvironmentChecker {
    constructor() {
        this.results = {
            passed: [],
            failed: [],
            warnings: []
        };
    }

    async run() {
        console.log(`${colors.blue}🔍 eBook Pipeline Environment Checker${colors.reset}\n`);
        console.log('Checking all required dependencies...\n');

        // Core requirements
        await this.checkNode();
        await this.checkNpm();
        await this.checkPython();
        await this.checkPip();

        // PDF tools
        await this.checkGhostscript();
        await this.checkQpdf();
        await this.checkPdftoppm();

        // Optional but recommended
        await this.checkPuppeteer();
        await this.checkImageMagick();

        // Node packages
        await this.checkNodePackages();

        // Python packages
        await this.checkPythonPackages();

        // Display results
        this.displayResults();
    }

    async checkCommand(command, versionFlag = '--version', requiredVersion = null, displayName = null) {
        const name = displayName || command;
        try {
            const { stdout } = await execAsync(`${command} ${versionFlag}`);
            const version = stdout.trim().split('\n')[0];
            
            if (requiredVersion) {
                const currentVersion = this.extractVersion(version);
                if (currentVersion && !semver.gte(currentVersion, requiredVersion)) {
                    this.results.warnings.push({
                        name,
                        message: `Found ${currentVersion}, but ${requiredVersion}+ recommended`,
                        version
                    });
                    return;
                }
            }
            
            this.results.passed.push({
                name,
                version
            });
        } catch (error) {
            this.results.failed.push({
                name,
                error: `Not found. Please install ${name}`,
                install: this.getInstallCommand(command)
            });
        }
    }

    extractVersion(versionString) {
        const match = versionString.match(/(\d+\.\d+\.\d+)/);
        return match ? match[1] : null;
    }

    getInstallCommand(tool) {
        const installCommands = {
            'node': 'Visit https://nodejs.org or use nvm',
            'python3': 'Visit https://python.org or use pyenv',
            'ghostscript': 'macOS: brew install ghostscript\nUbuntu: sudo apt-get install ghostscript',
            'qpdf': 'macOS: brew install qpdf\nUbuntu: sudo apt-get install qpdf',
            'pdftoppm': 'macOS: brew install poppler\nUbuntu: sudo apt-get install poppler-utils',
            'convert': 'macOS: brew install imagemagick\nUbuntu: sudo apt-get install imagemagick'
        };
        return installCommands[tool] || `Please install ${tool}`;
    }

    async checkNode() {
        await this.checkCommand('node', '--version', '20.0.0', 'Node.js');
    }

    async checkNpm() {
        await this.checkCommand('npm', '--version', '8.0.0', 'npm');
    }

    async checkPython() {
        await this.checkCommand('python3', '--version', '3.9.0', 'Python');
    }

    async checkPip() {
        await this.checkCommand('pip3', '--version', null, 'pip');
    }

    async checkGhostscript() {
        await this.checkCommand('gs', '--version', null, 'Ghostscript');
    }

    async checkQpdf() {
        await this.checkCommand('qpdf', '--version', null, 'qpdf');
    }

    async checkPdftoppm() {
        await this.checkCommand('pdftoppm', '-v', null, 'pdftoppm (poppler)');
    }

    async checkImageMagick() {
        await this.checkCommand('convert', '--version', null, 'ImageMagick');
    }

    async checkPuppeteer() {
        try {
            const puppeteerPath = path.join(process.cwd(), 'node_modules', 'puppeteer');
            if (await fs.pathExists(puppeteerPath)) {
                this.results.passed.push({
                    name: 'Puppeteer',
                    version: 'Installed'
                });
            } else {
                throw new Error('Not installed');
            }
        } catch {
            this.results.warnings.push({
                name: 'Puppeteer',
                message: 'Not installed. Run: npm install'
            });
        }
    }

    async checkNodePackages() {
        const requiredPackages = [
            'puppeteer',
            'marked',
            'js-yaml',
            'sharp',
            'fs-extra'
        ];

        console.log('\nChecking Node.js packages...');
        
        for (const pkg of requiredPackages) {
            try {
                require.resolve(pkg);
                this.results.passed.push({
                    name: `npm: ${pkg}`,
                    version: 'Installed'
                });
            } catch {
                this.results.failed.push({
                    name: `npm: ${pkg}`,
                    error: 'Not installed',
                    install: 'npm install'
                });
            }
        }
    }

    async checkPythonPackages() {
        const requiredPackages = [
            'PyYAML',
            'python-frontmatter',
            'click',
            'rich',
            'markdown',
            'openai',
            'requests'
        ];

        console.log('\nChecking Python packages...');
        
        const packageMap = {
            'PyYAML': 'yaml',
            'python-frontmatter': 'frontmatter',
            'click': 'click',
            'rich': 'rich',
            'markdown': 'markdown',
            'openai': 'openai',
            'requests': 'requests'
        };
        
        for (const pkg of requiredPackages) {
            const importName = packageMap[pkg] || pkg.toLowerCase().replace('-', '_');
            try {
                await execAsync(`python3 -c "import ${importName}"`);
                this.results.passed.push({
                    name: `pip: ${pkg}`,
                    version: 'Installed'
                });
            } catch {
                this.results.failed.push({
                    name: `pip: ${pkg}`,
                    error: 'Not installed',
                    install: 'pip3 install -r requirements.txt'
                });
            }
        }
    }

    displayResults() {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.blue}📊 Environment Check Results${colors.reset}`);
        console.log('='.repeat(60) + '\n');

        // Passed checks
        if (this.results.passed.length > 0) {
            console.log(`${colors.green}✅ Passed (${this.results.passed.length})${colors.reset}`);
            this.results.passed.forEach(item => {
                console.log(`   ${colors.green}✓${colors.reset} ${item.name}: ${item.version}`);
            });
            console.log();
        }

        // Warnings
        if (this.results.warnings.length > 0) {
            console.log(`${colors.yellow}⚠️  Warnings (${this.results.warnings.length})${colors.reset}`);
            this.results.warnings.forEach(item => {
                console.log(`   ${colors.yellow}!${colors.reset} ${item.name}: ${item.message}`);
            });
            console.log();
        }

        // Failed checks
        if (this.results.failed.length > 0) {
            console.log(`${colors.red}❌ Failed (${this.results.failed.length})${colors.reset}`);
            this.results.failed.forEach(item => {
                console.log(`   ${colors.red}✗${colors.reset} ${item.name}: ${item.error}`);
                if (item.install) {
                    console.log(`     Install: ${item.install}`);
                }
            });
            console.log();
        }

        // Summary
        console.log('='.repeat(60));
        if (this.results.failed.length === 0) {
            console.log(`${colors.green}✅ All required dependencies are installed!${colors.reset}`);
            console.log(`${colors.green}🎉 Your environment is ready for the eBook pipeline.${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ Missing ${this.results.failed.length} required dependencies.${colors.reset}`);
            console.log(`${colors.yellow}Please install the missing dependencies and run this check again.${colors.reset}`);
            
            // Quick install commands
            console.log('\n📋 Quick Install Commands:');
            console.log('\nmacOS:');
            console.log('  brew install ghostscript qpdf poppler imagemagick');
            console.log('  npm install');
            console.log('  pip3 install -r requirements.txt');
            
            console.log('\nUbuntu/Debian:');
            console.log('  sudo apt-get install ghostscript qpdf poppler-utils imagemagick');
            console.log('  npm install');
            console.log('  pip3 install -r requirements.txt');
            
            process.exit(1);
        }
    }
}

// Run the checker
if (require.main === module) {
    const checker = new EnvironmentChecker();
    checker.run().catch(console.error);
}

module.exports = EnvironmentChecker;