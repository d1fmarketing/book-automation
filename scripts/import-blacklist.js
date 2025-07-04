#!/usr/bin/env node

/**
 * Import Blacklist Manager
 * 
 * Manages a list of modules that should not be imported or used
 * in the ebook automation pipeline for security or compatibility reasons
 */

const fs = require('fs').promises;
const path = require('path');

class ImportBlacklist {
    constructor() {
        // Blacklisted modules and patterns
        this.blacklist = {
            // Security risks
            security: [
                'eval',
                'child_process.exec', // Use execFile or spawn instead
                'vm',
                'domain',
                'cluster'
            ],
            
            // Deprecated or problematic modules
            deprecated: [
                'request', // Use axios or fetch
                'request-promise',
                'node-uuid', // Use uuid
                'jade', // Use pug
                'coffee-script',
                'bower'
            ],
            
            // Heavy dependencies to avoid in agents
            heavy: [
                'puppeteer', // Only in specific build scripts
                'playwright',
                'selenium-webdriver',
                'electron',
                'sharp' // Use jimp for basic image ops
            ],
            
            // Modules that cause ESM/CJS conflicts
            esmConflicts: [
                'node-fetch@3', // Use node-fetch@2 or native fetch
                'chalk@5', // Use chalk@4
                'nanoid@4', // Use nanoid@3
                'unified@10', // Causes issues, use specific versions
                'remark@14',
                'rehype@12'
            ],
            
            // Patterns to block (regex)
            patterns: [
                /^@tensorflow\/.*/,  // Too heavy for pipeline
                /^aws-sdk$/,        // Use specific AWS service clients
                /.*-cli$/,          // CLI tools shouldn't be imported
                /^webpack.*/        // Build tools not needed in runtime
            ]
        };
        
        // Allowed alternatives
        this.alternatives = {
            'request': 'axios or native fetch',
            'request-promise': 'axios',
            'child_process.exec': 'child_process.execFile or spawn',
            'node-uuid': 'uuid',
            'jade': 'pug',
            'node-fetch@3': 'node-fetch@2 or native fetch',
            'chalk@5': 'chalk@4',
            'eval': 'Function constructor or safer alternatives',
            'sharp': 'jimp for basic operations',
            'puppeteer': 'only in build scripts, not agents'
        };
    }
    
    /**
     * Check if a module is blacklisted
     */
    isBlacklisted(moduleName) {
        // Check direct blacklist
        for (const category of Object.keys(this.blacklist)) {
            if (category === 'patterns') continue;
            
            if (this.blacklist[category].includes(moduleName)) {
                return {
                    blocked: true,
                    category,
                    module: moduleName,
                    alternative: this.alternatives[moduleName]
                };
            }
        }
        
        // Check patterns
        for (const pattern of this.blacklist.patterns) {
            if (pattern.test(moduleName)) {
                return {
                    blocked: true,
                    category: 'patterns',
                    module: moduleName,
                    pattern: pattern.toString()
                };
            }
        }
        
        return { blocked: false };
    }
    
    /**
     * Scan a file for blacklisted imports
     */
    async scanFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        const issues = [];
        
        // Regex patterns for different import styles
        const importPatterns = [
            /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
            /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /require\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/g
        ];
        
        for (const pattern of importPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const moduleName = match[1];
                const result = this.isBlacklisted(moduleName);
                
                if (result.blocked) {
                    issues.push({
                        file: filePath,
                        line: content.substring(0, match.index).split('\n').length,
                        ...result
                    });
                }
            }
        }
        
        return issues;
    }
    
    /**
     * Scan directory recursively
     */
    async scanDirectory(dir, options = {}) {
        const { 
            ignore = ['node_modules', '.git', 'build', 'dist'],
            extensions = ['.js', '.mjs', '.jsx', '.ts', '.tsx']
        } = options;
        
        const issues = [];
        
        async function scan(currentDir) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory()) {
                    if (!ignore.includes(entry.name)) {
                        await scan(fullPath);
                    }
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.includes(ext)) {
                        const fileIssues = await this.scanFile(fullPath);
                        issues.push(...fileIssues);
                    }
                }
            }
        }
        
        await scan(dir);
        return issues;
    }
    
    /**
     * Generate report of blacklisted imports
     */
    generateReport(issues) {
        if (issues.length === 0) {
            return {
                status: 'clean',
                message: 'No blacklisted imports found',
                issues: []
            };
        }
        
        const byCategory = {};
        const byFile = {};
        
        for (const issue of issues) {
            // Group by category
            if (!byCategory[issue.category]) {
                byCategory[issue.category] = [];
            }
            byCategory[issue.category].push(issue);
            
            // Group by file
            if (!byFile[issue.file]) {
                byFile[issue.file] = [];
            }
            byFile[issue.file].push(issue);
        }
        
        return {
            status: 'issues_found',
            message: `Found ${issues.length} blacklisted imports in ${Object.keys(byFile).length} files`,
            summary: {
                total: issues.length,
                byCategory: Object.fromEntries(
                    Object.entries(byCategory).map(([cat, items]) => [cat, items.length])
                ),
                files: Object.keys(byFile).length
            },
            issues,
            byCategory,
            byFile
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Import Blacklist Scanner

Usage:
  import-blacklist.js <command> [options]

Commands:
  scan <path>     Scan directory or file for blacklisted imports
  check <module>  Check if a specific module is blacklisted
  list            List all blacklisted modules

Options:
  --json         Output in JSON format
  --fix          Suggest fixes (not implemented yet)

Examples:
  node import-blacklist.js scan .
  node import-blacklist.js check puppeteer
  node import-blacklist.js list --json
        `);
        process.exit(0);
    }
    
    const blacklist = new ImportBlacklist();
    const command = args[0];
    const jsonOutput = args.includes('--json');
    
    (async () => {
        try {
            if (command === 'scan') {
                const targetPath = args[1] || '.';
                console.log(`Scanning ${targetPath} for blacklisted imports...`);
                
                const issues = await blacklist.scanDirectory(targetPath);
                const report = blacklist.generateReport(issues);
                
                if (jsonOutput) {
                    console.log(JSON.stringify(report, null, 2));
                } else {
                    console.log(`\nStatus: ${report.status}`);
                    console.log(report.message);
                    
                    if (issues.length > 0) {
                        console.log('\nIssues found:');
                        for (const issue of issues) {
                            console.log(`  ${issue.file}:${issue.line} - ${issue.module} (${issue.category})`);
                            if (issue.alternative) {
                                console.log(`    → Use: ${issue.alternative}`);
                            }
                        }
                    }
                }
                
                process.exit(issues.length > 0 ? 1 : 0);
                
            } else if (command === 'check') {
                const moduleName = args[1];
                if (!moduleName) {
                    console.error('Module name required');
                    process.exit(1);
                }
                
                const result = blacklist.isBlacklisted(moduleName);
                
                if (jsonOutput) {
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    if (result.blocked) {
                        console.log(`❌ ${moduleName} is blacklisted (${result.category})`);
                        if (result.alternative) {
                            console.log(`   Alternative: ${result.alternative}`);
                        }
                    } else {
                        console.log(`✅ ${moduleName} is allowed`);
                    }
                }
                
                process.exit(result.blocked ? 1 : 0);
                
            } else if (command === 'list') {
                const allModules = [];
                
                for (const [category, modules] of Object.entries(blacklist.blacklist)) {
                    if (category === 'patterns') continue;
                    for (const module of modules) {
                        allModules.push({ module, category });
                    }
                }
                
                if (jsonOutput) {
                    console.log(JSON.stringify({
                        modules: allModules,
                        patterns: blacklist.blacklist.patterns.map(p => p.toString()),
                        alternatives: blacklist.alternatives
                    }, null, 2));
                } else {
                    console.log('Blacklisted modules:\n');
                    
                    for (const [category, modules] of Object.entries(blacklist.blacklist)) {
                        if (category === 'patterns') continue;
                        console.log(`${category}:`);
                        for (const module of modules) {
                            console.log(`  - ${module}`);
                            if (blacklist.alternatives[module]) {
                                console.log(`    → ${blacklist.alternatives[module]}`);
                            }
                        }
                        console.log();
                    }
                    
                    console.log('Patterns:');
                    for (const pattern of blacklist.blacklist.patterns) {
                        console.log(`  - ${pattern}`);
                    }
                }
                
            } else {
                console.error(`Unknown command: ${command}`);
                process.exit(1);
            }
            
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = ImportBlacklist;