#!/usr/bin/env node

/**
 * Grammar Check CLI
 * Command-line interface for grammar checking
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const ora = require('ora');
const { XMLBuilder } = require('xmlbuilder2');

const GrammarChecker = require('./grammar-checker');
const GrammarReportGenerator = require('./grammar-report-generator');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 [files] [options]')
    .positional('files', {
        describe: 'Files or glob patterns to check',
        type: 'string',
        default: 'chapters/*.md'
    })
    .option('fix', {
        alias: 'f',
        describe: 'Auto-fix simple issues',
        type: 'boolean',
        default: false
    })
    .option('report', {
        alias: 'r',
        describe: 'Generate detailed report',
        type: 'boolean',
        default: false
    })
    .option('format', {
        describe: 'Report format (html, markdown, json)',
        type: 'string',
        default: 'html',
        choices: ['html', 'markdown', 'json']
    })
    .option('language', {
        alias: 'l',
        describe: 'Language code',
        type: 'string',
        default: 'pt-BR'
    })
    .option('api-url', {
        describe: 'LanguageTool API URL',
        type: 'string',
        default: 'http://localhost:8081/v2'
    })
    .option('threshold', {
        alias: 't',
        describe: 'Maximum errors before failing',
        type: 'number',
        default: 10
    })
    .option('quiet', {
        alias: 'q',
        describe: 'Minimal output',
        type: 'boolean',
        default: false
    })
    .help()
    .argv;

async function checkGrammar() {
    const spinner = !argv.quiet ? ora('Initializing grammar checker...').start() : null;
    
    try {
        // Initialize checker
        const checker = new GrammarChecker({
            apiUrl: argv.apiUrl,
            language: argv.language
        });
        
        // Check if server is available
        if (!await checker.checkServer()) {
            if (spinner) spinner.fail('LanguageTool server not available');
            console.error(colors.red('\n❌ LanguageTool server is not running'));
            console.log(colors.yellow('Start it with: npm run grammar:server'));
            process.exit(1);
        }
        
        // Get files to check
        const pattern = argv._ && argv._.length > 0 ? argv._[0] : argv.files;
        const files = glob.sync(pattern);
        
        if (files.length === 0) {
            if (spinner) spinner.fail('No files found');
            console.error(colors.red(`No files matching pattern: ${pattern}`));
            process.exit(1);
        }
        
        if (spinner) spinner.succeed(`Found ${files.length} files to check`);
        
        // Check each file
        const results = [];
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalFixed = 0;
        
        for (const file of files) {
            if (!argv.quiet) {
                console.log(colors.blue(`\n📝 Checking ${path.basename(file)}...`));
            }
            
            const content = await fs.readFile(file, 'utf8');
            const result = await checker.checkText(content, { file });
            
            // Auto-fix if requested
            let fixedContent = content;
            let fixedCount = 0;
            
            if (argv.fix && result.matches.length > 0) {
                [fixedContent, fixedCount] = await checker.autoFixSimpleIssues(content);
                if (fixedCount > 0) {
                    await fs.writeFile(file, fixedContent, 'utf8');
                    totalFixed += fixedCount;
                    if (!argv.quiet) {
                        console.log(colors.green(`   ✅ Fixed ${fixedCount} issues`));
                    }
                }
            }
            
            // Recheck if we fixed anything
            const finalResult = fixedCount > 0 
                ? await checker.checkText(fixedContent, { file })
                : result;
            
            // Display results
            if (!argv.quiet) {
                displayFileResults(file, finalResult);
            }
            
            // Count issues
            if (finalResult.stats) {
                totalErrors += finalResult.stats.bySeverity.error || 0;
                totalWarnings += finalResult.stats.bySeverity.warning || 0;
            }
            
            results.push({
                file,
                ...finalResult
            });
        }
        
        // Summary
        console.log(colors.bold('\n📊 Summary:'));
        console.log(`   Total files checked: ${files.length}`);
        console.log(`   ${colors.red(`Errors: ${totalErrors}`)}`);
        console.log(`   ${colors.yellow(`Warnings: ${totalWarnings}`)}`);
        if (argv.fix) {
            console.log(`   ${colors.green(`Auto-fixed: ${totalFixed}`)}`);
        }
        
        // Generate report if requested
        if (argv.report) {
            await generateReport(results);
        }
        
        // Check threshold
        if (totalErrors > argv.threshold) {
            console.error(colors.red(`\n❌ Too many errors (${totalErrors} > ${argv.threshold})`));
            process.exit(1);
        }
        
        console.log(colors.green('\n✅ Grammar check completed!'));
        
    } catch (error) {
        if (spinner) spinner.fail('Grammar check failed');
        console.error(colors.red('\n❌ Error:'), error.message);
        process.exit(1);
    }
}

function displayFileResults(file, result) {
    if (!result.matches || result.matches.length === 0) {
        console.log(colors.green('   ✅ No issues found'));
        return;
    }
    
    console.log(`   Found ${result.matches.length} issues:`);
    
    // Show first 5 issues
    result.matches.slice(0, 5).forEach((match, i) => {
        const type = getMatchType(match);
        const typeSymbol = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
        
        console.log(`\n   ${typeSymbol} ${colors.bold(match.message)}`);
        console.log(colors.gray(`      Context: "${match.context.text}"`));
        
        if (match.replacements.length > 0) {
            const suggestions = match.replacements.slice(0, 3).map(r => r.value).join(', ');
            console.log(colors.green(`      Suggestions: ${suggestions}`));
        }
    });
    
    if (result.matches.length > 5) {
        console.log(colors.gray(`\n   ... and ${result.matches.length - 5} more issues`));
    }
}

function getMatchType(match) {
    const categoryId = match.rule.category.id;
    if (categoryId === 'GRAMMAR' || categoryId === 'TYPOS') return 'error';
    if (categoryId === 'PUNCTUATION') return 'warning';
    return 'info';
}

async function generateReport(results) {
    const generator = new GrammarReportGenerator(results);
    
    console.log(colors.blue('\n📝 Generating report...'));
    
    let reportPath;
    switch (argv.format) {
        case 'json':
            reportPath = await generator.generateJSON();
            break;
        case 'markdown':
            reportPath = await generator.generateMarkdown();
            break;
        case 'html':
        default:
            reportPath = await generator.generateHTML();
            break;
    }
    
    console.log(colors.green(`✅ Report generated: ${reportPath}`));
}

// Run the checker
checkGrammar();