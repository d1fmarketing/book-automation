#!/usr/bin/env node

/**
 * Verify Package Dependencies
 * Checks that all required packages are declared and installed
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DependencyVerifier {
    constructor() {
        this.packageJsonPath = path.join(process.cwd(), 'package.json');
        this.nodeModulesPath = path.join(process.cwd(), 'node_modules');
        this.claudeScriptsDir = path.join(process.cwd(), '.claude', 'scripts');
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Run all verification checks
     */
    async verify() {
        console.log('🔍 Verifying Package Dependencies\n');

        // Load package.json
        const packageJson = await this.loadPackageJson();
        if (!packageJson) return false;

        // Check all declared dependencies are installed
        await this.checkInstalledDependencies(packageJson);

        // Check for undeclared dependencies in Claude scripts
        await this.checkUndeclaredDependencies(packageJson);

        // Check for version conflicts
        await this.checkVersionConflicts();

        // Check Node.js version
        await this.checkNodeVersion(packageJson);

        // Print report
        this.printReport();

        return this.errors.length === 0;
    }

    /**
     * Load and validate package.json
     */
    async loadPackageJson() {
        try {
            const content = await fs.readFile(this.packageJsonPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            this.errors.push(`Failed to load package.json: ${error.message}`);
            return null;
        }
    }

    /**
     * Check that all declared dependencies are installed
     */
    async checkInstalledDependencies(packageJson) {
        console.log('Checking installed dependencies...');

        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };

        for (const [pkg, version] of Object.entries(allDeps)) {
            const modulePath = path.join(this.nodeModulesPath, pkg);
            
            try {
                await fs.access(modulePath);
                
                // Check version matches
                try {
                    const installedPkgPath = path.join(modulePath, 'package.json');
                    const installedPkg = JSON.parse(await fs.readFile(installedPkgPath, 'utf8'));
                    
                    if (!this.versionMatches(version, installedPkg.version)) {
                        this.warnings.push(
                            `Version mismatch for ${pkg}: ` +
                            `declared ${version}, installed ${installedPkg.version}`
                        );
                    }
                } catch {
                    // Can't read package.json, skip version check
                }
            } catch {
                this.errors.push(`Package not installed: ${pkg}`);
            }
        }
    }

    /**
     * Check for undeclared dependencies
     */
    async checkUndeclaredDependencies(packageJson) {
        console.log('Checking for undeclared dependencies...');

        const declaredDeps = new Set([
            ...Object.keys(packageJson.dependencies || {}),
            ...Object.keys(packageJson.devDependencies || {})
        ]);

        // Node.js built-in modules
        const builtinModules = new Set([
            'fs', 'path', 'crypto', 'util', 'os', 'child_process',
            'readline', 'http', 'https', 'stream', 'events', 'buffer',
            'querystring', 'url', 'assert', 'process'
        ]);

        // Find all require statements in Claude scripts
        const requires = new Set();
        const scriptsDir = this.claudeScriptsDir;
        
        try {
            const files = await fs.readdir(scriptsDir);
            
            for (const file of files) {
                if (!file.endsWith('.js')) continue;
                
                const content = await fs.readFile(path.join(scriptsDir, file), 'utf8');
                
                // Match require statements
                const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
                let match;
                
                while ((match = requireRegex.exec(content)) !== null) {
                    const module = match[1];
                    
                    // Skip relative paths and built-in modules
                    if (!module.startsWith('.') && !module.startsWith('/') && !builtinModules.has(module)) {
                        requires.add(module);
                    }
                }
            }
        } catch (error) {
            this.warnings.push(`Failed to scan Claude scripts: ${error.message}`);
        }

        // Check if all requires are declared
        for (const req of requires) {
            if (!declaredDeps.has(req)) {
                this.errors.push(`Undeclared dependency in Claude scripts: ${req}`);
            }
        }
    }

    /**
     * Check for version conflicts
     */
    async checkVersionConflicts() {
        console.log('Checking for version conflicts...');

        try {
            // Run npm ls to check for conflicts
            const { stdout, stderr } = await execAsync('npm ls --json 2>/dev/null || true');
            
            try {
                const tree = JSON.parse(stdout);
                if (tree.problems && tree.problems.length > 0) {
                    for (const problem of tree.problems) {
                        if (problem.includes('peer dep')) {
                            this.warnings.push(`Peer dependency issue: ${problem}`);
                        } else {
                            this.errors.push(`Dependency conflict: ${problem}`);
                        }
                    }
                }
            } catch {
                // JSON parse failed, check stderr
                if (stderr && stderr.includes('missing:')) {
                    this.errors.push('Some dependencies are missing. Run: npm install');
                }
            }
        } catch (error) {
            this.warnings.push('Could not check for version conflicts');
        }
    }

    /**
     * Check Node.js version
     */
    async checkNodeVersion(packageJson) {
        console.log('Checking Node.js version...');

        if (!packageJson.engines || !packageJson.engines.node) {
            this.warnings.push('No Node.js version specified in package.json');
            return;
        }

        const requiredVersion = packageJson.engines.node;
        const currentVersion = process.version;

        if (!this.versionInRange(currentVersion, requiredVersion)) {
            this.errors.push(
                `Node.js version mismatch: ` +
                `required ${requiredVersion}, current ${currentVersion}`
            );
        }
    }

    /**
     * Check if version matches requirement
     */
    versionMatches(required, installed) {
        // Simple check - in production use semver package
        if (required.startsWith('^') || required.startsWith('~')) {
            const reqBase = required.substring(1);
            return installed.startsWith(reqBase.split('.')[0]);
        }
        return required === installed;
    }

    /**
     * Check if version is in range
     */
    versionInRange(current, required) {
        // Simple check for >= 
        if (required.startsWith('>=')) {
            const reqVersion = required.substring(2);
            return current.substring(1) >= reqVersion;
        }
        return true;
    }

    /**
     * Print verification report
     */
    printReport() {
        console.log('\n=== Dependency Verification Report ===\n');

        if (this.errors.length > 0) {
            console.log('❌ Errors found:');
            for (const error of this.errors) {
                console.log(`   • ${error}`);
            }
            console.log();
        }

        if (this.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            for (const warning of this.warnings) {
                console.log(`   • ${warning}`);
            }
            console.log();
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ All dependencies verified successfully!');
        }

        // Recommendations
        if (this.errors.length > 0) {
            console.log('📋 Recommendations:');
            console.log('   1. Run: npm install');
            console.log('   2. Check for missing dependencies in package.json');
            console.log('   3. Resolve any version conflicts');
        }
    }
}

// Additional check for Claude-specific requirements
async function checkClaudeRequirements() {
    console.log('\nChecking Claude Elite specific requirements...');
    
    const requirements = {
        'WebSocket support': 'ws',
        'YAML parsing': 'js-yaml',
        'Terminal colors': 'chalk',
        'Environment variables': 'dotenv',
        'PDF generation': 'puppeteer'
    };

    const missing = [];
    
    for (const [feature, pkg] of Object.entries(requirements)) {
        try {
            require.resolve(pkg);
            console.log(`✅ ${feature}: ${pkg} is available`);
        } catch {
            missing.push(`${feature} (${pkg})`);
            console.log(`❌ ${feature}: ${pkg} is missing`);
        }
    }

    if (missing.length > 0) {
        console.log('\n⚠️  Missing packages for Claude Elite features:');
        console.log('   Run: npm install');
    }
}

// CLI interface
if (require.main === module) {
    const verifier = new DependencyVerifier();

    (async () => {
        const valid = await verifier.verify();
        await checkClaudeRequirements();
        
        process.exit(valid ? 0 : 1);
    })().catch(error => {
        console.error('Verification failed:', error);
        process.exit(1);
    });
}

module.exports = DependencyVerifier;