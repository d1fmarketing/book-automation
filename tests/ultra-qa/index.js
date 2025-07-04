#!/usr/bin/env node

/**
 * Ultra-QA Test Suite
 * 
 * Comprehensive quality assurance tests for the ebook automation pipeline
 * Tests HTML validation, PDF quality, content consistency, and performance
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer');
const chalk = require('chalk');

// Test categories
const TEST_SUITES = {
    html: require('./suites/html-validation'),
    pdf: require('./suites/pdf-quality'),
    content: require('./suites/content-consistency'),
    performance: require('./suites/performance-benchmarks'),
    accessibility: require('./suites/accessibility-checks'),
    security: require('./suites/security-audit')
};

class UltraQA {
    constructor(options = {}) {
        this.options = {
            workDir: options.workDir || 'build/test-book',
            outputDir: options.outputDir || 'test-results/ultra-qa',
            suites: options.suites || Object.keys(TEST_SUITES),
            verbose: options.verbose || false,
            failFast: options.failFast || false,
            thresholds: {
                html: {
                    errors: 0,
                    warnings: 5
                },
                pdf: {
                    minPages: 10,
                    maxFileSize: 10 * 1024 * 1024, // 10MB
                    minQuality: 90
                },
                performance: {
                    buildTime: 60000, // 1 minute
                    memoryUsage: 512 * 1024 * 1024 // 512MB
                },
                accessibility: {
                    wcagLevel: 'AA',
                    minScore: 90
                },
                content: {
                    minWords: 15000,
                    maxDuplication: 0.05 // 5%
                },
                security: {
                    highVulnerabilities: 0,
                    mediumVulnerabilities: 3
                }
            },
            ...options
        };
        
        this.results = {
            timestamp: new Date().toISOString(),
            suites: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            }
        };
    }
    
    async run() {
        console.log(chalk.bold.blue('\n🚀 Ultra-QA Test Suite\n'));
        console.log(`📁 Testing: ${this.options.workDir}`);
        console.log(`📊 Suites: ${this.options.suites.join(', ')}\n`);
        
        const startTime = Date.now();
        
        try {
            // Ensure output directory exists
            await fs.mkdir(this.options.outputDir, { recursive: true });
            
            // Validate test directory exists
            await this.validateTestDirectory();
            
            // Run each test suite
            for (const suiteName of this.options.suites) {
                if (!TEST_SUITES[suiteName]) {
                    console.warn(chalk.yellow(`⚠️  Unknown suite: ${suiteName}`));
                    continue;
                }
                
                console.log(chalk.bold(`\n📋 Running ${suiteName} tests...\n`));
                
                try {
                    const suite = new TEST_SUITES[suiteName](this.options);
                    const suiteResults = await suite.run(this.options.workDir);
                    
                    this.results.suites[suiteName] = suiteResults;
                    this.updateSummary(suiteResults);
                    
                    // Print suite results
                    this.printSuiteResults(suiteName, suiteResults);
                    
                    // Fail fast if enabled
                    if (this.options.failFast && suiteResults.failed > 0) {
                        throw new Error(`Suite ${suiteName} failed with ${suiteResults.failed} failures`);
                    }
                    
                } catch (error) {
                    console.error(chalk.red(`❌ Suite ${suiteName} crashed: ${error.message}`));
                    this.results.suites[suiteName] = {
                        error: error.message,
                        status: 'crashed'
                    };
                    
                    if (this.options.failFast) {
                        throw error;
                    }
                }
            }
            
            // Calculate total duration
            this.results.summary.duration = Date.now() - startTime;
            
            // Generate reports
            await this.generateReports();
            
            // Print final summary
            this.printFinalSummary();
            
            // Return success/failure
            return this.results.summary.failed === 0;
            
        } catch (error) {
            console.error(chalk.red(`\n💥 Ultra-QA failed: ${error.message}`));
            this.results.error = error.message;
            this.results.summary.duration = Date.now() - startTime;
            
            await this.saveResults();
            return false;
        }
    }
    
    async validateTestDirectory() {
        try {
            const stats = await fs.stat(this.options.workDir);
            if (!stats.isDirectory()) {
                throw new Error('Not a directory');
            }
            
            // Check for required files
            const requiredFiles = ['metadata.json'];
            const requiredDirs = ['chapters', 'html'];
            
            for (const file of requiredFiles) {
                try {
                    await fs.stat(path.join(this.options.workDir, file));
                } catch {
                    console.warn(chalk.yellow(`⚠️  Missing required file: ${file}`));
                }
            }
            
            for (const dir of requiredDirs) {
                try {
                    await fs.stat(path.join(this.options.workDir, dir));
                } catch {
                    console.warn(chalk.yellow(`⚠️  Missing required directory: ${dir}`));
                }
            }
            
        } catch (error) {
            throw new Error(`Test directory not found: ${this.options.workDir}`);
        }
    }
    
    updateSummary(suiteResults) {
        this.results.summary.total += suiteResults.total || 0;
        this.results.summary.passed += suiteResults.passed || 0;
        this.results.summary.failed += suiteResults.failed || 0;
        this.results.summary.skipped += suiteResults.skipped || 0;
    }
    
    printSuiteResults(suiteName, results) {
        if (results.error) {
            console.log(chalk.red(`  ❌ Suite crashed: ${results.error}`));
            return;
        }
        
        console.log(chalk.cyan(`  Total tests: ${results.total || 0}`));
        console.log(chalk.green(`  ✅ Passed: ${results.passed || 0}`));
        
        if (results.failed > 0) {
            console.log(chalk.red(`  ❌ Failed: ${results.failed}`));
        }
        
        if (results.skipped > 0) {
            console.log(chalk.yellow(`  ⏭️  Skipped: ${results.skipped}`));
        }
        
        // Print key metrics
        if (results.metrics) {
            console.log(chalk.dim('\n  Key Metrics:'));
            Object.entries(results.metrics).forEach(([key, value]) => {
                console.log(chalk.dim(`    ${key}: ${value}`));
            });
        }
        
        // Print failures if verbose
        if (this.options.verbose && results.failures) {
            console.log(chalk.red('\n  Failures:'));
            results.failures.forEach(failure => {
                console.log(chalk.red(`    - ${failure.test}: ${failure.message}`));
            });
        }
    }
    
    async generateReports() {
        // Save raw results
        await this.saveResults();
        
        // Generate HTML report
        await this.generateHTMLReport();
        
        // Generate JUnit XML for CI integration
        await this.generateJUnitReport();
        
        // Generate coverage report if available
        if (this.hasCoverageData()) {
            await this.generateCoverageReport();
        }
    }
    
    async saveResults() {
        const resultsPath = path.join(this.options.outputDir, 'results.json');
        await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
        console.log(chalk.dim(`\n📄 Results saved: ${resultsPath}`));
    }
    
    async generateHTMLReport() {
        const html = this.buildHTMLReport();
        const htmlPath = path.join(this.options.outputDir, 'report.html');
        await fs.writeFile(htmlPath, html);
        console.log(chalk.dim(`📄 HTML report: ${htmlPath}`));
    }
    
    buildHTMLReport() {
        const { summary, suites } = this.results;
        const passRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : 0;
        
        return `<!DOCTYPE html>
<html>
<head>
    <title>Ultra-QA Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { flex: 1; padding: 15px; background: #f8f9fa; border-radius: 4px; text-align: center; }
        .stat.passed { background: #d4edda; color: #155724; }
        .stat.failed { background: #f8d7da; color: #721c24; }
        .suite { margin: 20px 0; padding: 15px; border: 1px solid #dee2e6; border-radius: 4px; }
        .suite.passed { border-color: #28a745; }
        .suite.failed { border-color: #dc3545; }
        .metrics { margin-top: 10px; font-size: 14px; color: #666; }
        .failures { margin-top: 10px; padding: 10px; background: #f8d7da; border-radius: 4px; }
        .failure { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Ultra-QA Test Report</h1>
        <p>Generated: ${new Date(this.results.timestamp).toLocaleString()}</p>
        <p>Duration: ${(summary.duration / 1000).toFixed(1)}s</p>
        
        <div class="summary">
            <div class="stat">
                <h3>Total Tests</h3>
                <div style="font-size: 24px;">${summary.total}</div>
            </div>
            <div class="stat passed">
                <h3>Passed</h3>
                <div style="font-size: 24px;">${summary.passed}</div>
            </div>
            <div class="stat failed">
                <h3>Failed</h3>
                <div style="font-size: 24px;">${summary.failed}</div>
            </div>
            <div class="stat">
                <h3>Pass Rate</h3>
                <div style="font-size: 24px;">${passRate}%</div>
            </div>
        </div>
        
        <h2>Test Suites</h2>
        ${Object.entries(suites).map(([name, suite]) => `
            <div class="suite ${suite.failed > 0 ? 'failed' : 'passed'}">
                <h3>${name.charAt(0).toUpperCase() + name.slice(1)} Tests</h3>
                ${suite.error ? `<p style="color: red;">❌ ${suite.error}</p>` : `
                    <p>Total: ${suite.total}, Passed: ${suite.passed}, Failed: ${suite.failed}</p>
                    ${suite.metrics ? `
                        <div class="metrics">
                            ${Object.entries(suite.metrics).map(([key, value]) => 
                                `<div>${key}: ${value}</div>`
                            ).join('')}
                        </div>
                    ` : ''}
                    ${suite.failures && suite.failures.length > 0 ? `
                        <div class="failures">
                            <strong>Failures:</strong>
                            ${suite.failures.map(f => 
                                `<div class="failure">• ${f.test}: ${f.message}</div>`
                            ).join('')}
                        </div>
                    ` : ''}
                `}
            </div>
        `).join('')}
    </div>
</body>
</html>`;
    }
    
    async generateJUnitReport() {
        const junit = this.buildJUnitXML();
        const junitPath = path.join(this.options.outputDir, 'junit.xml');
        await fs.writeFile(junitPath, junit);
        console.log(chalk.dim(`📄 JUnit report: ${junitPath}`));
    }
    
    buildJUnitXML() {
        const { summary, suites } = this.results;
        
        const testcases = [];
        
        Object.entries(suites).forEach(([suiteName, suite]) => {
            if (suite.tests) {
                suite.tests.forEach(test => {
                    testcases.push(`
        <testcase name="${test.name}" classname="${suiteName}" time="${test.duration || 0}">
            ${test.status === 'failed' ? `
                <failure message="${this.escapeXML(test.message || 'Test failed')}" type="AssertionError">
                    ${this.escapeXML(test.stack || '')}
                </failure>
            ` : ''}
            ${test.status === 'skipped' ? '<skipped/>' : ''}
        </testcase>`);
                });
            }
        });
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Ultra-QA" tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">
    <testsuite name="Ultra-QA Test Suite" tests="${summary.total}" failures="${summary.failed}" time="${summary.duration / 1000}">
        ${testcases.join('\n')}
    </testsuite>
</testsuites>`;
    }
    
    escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    hasCoverageData() {
        return Object.values(this.results.suites).some(suite => suite.coverage);
    }
    
    async generateCoverageReport() {
        // Placeholder for coverage report generation
        console.log(chalk.dim('📄 Coverage report: (not implemented)'));
    }
    
    printFinalSummary() {
        const { summary } = this.results;
        const passRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : 0;
        
        console.log(chalk.bold('\n📊 Final Summary\n'));
        console.log(`  Total tests: ${summary.total}`);
        console.log(`  ✅ Passed: ${summary.passed}`);
        console.log(`  ❌ Failed: ${summary.failed}`);
        console.log(`  ⏭️  Skipped: ${summary.skipped}`);
        console.log(`  ⏱️  Duration: ${(summary.duration / 1000).toFixed(1)}s`);
        console.log(`  📈 Pass rate: ${passRate}%`);
        
        if (summary.failed === 0) {
            console.log(chalk.green.bold('\n✨ All tests passed! ✨'));
        } else {
            console.log(chalk.red.bold(`\n❌ ${summary.failed} tests failed`));
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Ultra-QA Test Suite

Usage:
  ultra-qa <book-dir> [options]

Options:
  --suites <list>      Test suites to run (html,pdf,content,performance,accessibility,security)
  --output <dir>       Output directory for results
  --verbose            Show detailed test output
  --fail-fast          Stop on first failure
  --threshold <json>   Custom thresholds JSON file

Examples:
  ultra-qa build/my-book
  ultra-qa build/my-book --suites html,pdf
  ultra-qa build/my-book --verbose --fail-fast
        `);
        process.exit(0);
    }
    
    const bookDir = args[0];
    const options = {
        workDir: bookDir
    };
    
    // Parse options
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--suites' && args[i + 1]) {
            options.suites = args[++i].split(',');
        } else if (arg === '--output' && args[i + 1]) {
            options.outputDir = args[++i];
        } else if (arg === '--verbose') {
            options.verbose = true;
        } else if (arg === '--fail-fast') {
            options.failFast = true;
        } else if (arg === '--threshold' && args[i + 1]) {
            try {
                const thresholdFile = args[++i];
                const thresholds = JSON.parse(fs.readFileSync(thresholdFile, 'utf8'));
                options.thresholds = { ...options.thresholds, ...thresholds };
            } catch (error) {
                console.error(`Failed to load thresholds: ${error.message}`);
            }
        }
    }
    
    const qa = new UltraQA(options);
    
    qa.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = UltraQA;