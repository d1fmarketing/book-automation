#!/usr/bin/env node

/**
 * Grammar and Style Checker
 * Integrates LanguageTool for comprehensive grammar checking
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const marked = require('marked');
const chalk = require('chalk');
const matter = require('gray-matter');

// ANSI colors for chalk v5
const colors = {
    green: chalk.green,
    red: chalk.red,
    yellow: chalk.yellow,
    blue: chalk.blue,
    gray: chalk.gray,
    bold: chalk.bold
};

class GrammarChecker {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || process.env.LANGUAGETOOL_API || 'http://localhost:8081/v2';
        this.language = options.language || 'pt-BR';
        this.enabledRules = options.enabledRules || [];
        this.disabledRules = options.disabledRules || [
            'WHITESPACE_RULE',
            'UPPERCASE_SENTENCE_START' // Often false positive in markdown
        ];
        this.customDictionary = [];
        this.maxTextLength = 20000; // LanguageTool limit
        this.results = [];
    }

    async loadConfig(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf8');
            const config = yaml.load(content);
            
            if (config.grammar) {
                this.language = config.grammar.language || this.language;
                this.enabledRules = config.grammar.enabled_rules || this.enabledRules;
                this.disabledRules = config.grammar.disabled_rules || this.disabledRules;
                
                // Load custom dictionary
                if (config.grammar.custom_dictionary) {
                    await this.loadCustomDictionary(config.grammar.custom_dictionary);
                }
            }
            
            return config;
        } catch (error) {
            console.warn(colors.yellow('⚠️  No grammar config found, using defaults'));
            return {};
        }
    }

    async loadCustomDictionary(dictPath) {
        try {
            const content = await fs.readFile(dictPath, 'utf8');
            this.customDictionary = content.split('\n')
                .map(word => word.trim())
                .filter(word => word.length > 0);
            console.log(colors.green(`✅ Loaded ${this.customDictionary.length} custom words`));
        } catch (error) {
            console.warn(colors.yellow('⚠️  Could not load custom dictionary'));
        }
    }

    async checkServer() {
        try {
            const response = await axios.get(`${this.apiUrl}/languages`);
            const languages = response.data.map(lang => lang.code);
            
            if (!languages.includes(this.language)) {
                console.error(colors.red(`❌ Language ${this.language} not supported`));
                console.log(colors.gray('Available languages:', languages.join(', ')));
                return false;
            }
            
            console.log(colors.green('✅ LanguageTool server is running'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ LanguageTool server not accessible'));
            console.log(colors.yellow('Start it with: npm run grammar:server'));
            return false;
        }
    }

    async checkText(text, context = {}) {
        // Remove markdown formatting for checking
        const plainText = this.markdownToPlainText(text);
        
        // Split text if too long
        const chunks = this.splitText(plainText);
        const allMatches = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const offset = chunks.slice(0, i).reduce((sum, c) => sum + c.length, 0);
            
            try {
                const params = new URLSearchParams({
                    text: chunk,
                    language: this.language,
                    enabledRules: this.enabledRules.join(','),
                    disabledRules: this.disabledRules.join(','),
                    enabledCategories: 'GRAMMAR,STYLE,PUNCTUATION',
                    level: 'picky'
                });
                
                const response = await axios.post(
                    `${this.apiUrl}/check`,
                    params.toString(),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );
                
                // Adjust offsets and filter matches
                const matches = response.data.matches
                    .filter(match => !this.shouldIgnoreMatch(match, plainText))
                    .map(match => ({
                        ...match,
                        offset: match.offset + offset,
                        contextOffset: match.context.offset
                    }));
                
                allMatches.push(...matches);
            } catch (error) {
                console.error(colors.red('❌ Grammar check failed:'), error.message);
            }
        }
        
        return {
            matches: allMatches,
            stats: this.calculateStats(allMatches)
        };
    }

    markdownToPlainText(markdown) {
        // Remove frontmatter
        const { content } = matter(markdown);
        
        // Convert markdown to plain text
        let text = content;
        
        // Remove code blocks
        text = text.replace(/```[\s\S]*?```/g, '');
        text = text.replace(/`[^`]+`/g, '');
        
        // Remove images
        text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
        
        // Remove links but keep text
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        
        // Remove emphasis markers
        text = text.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1');
        
        // Remove headers
        text = text.replace(/^#+\s+/gm, '');
        
        // Remove horizontal rules
        text = text.replace(/^-{3,}$/gm, '');
        
        // Remove blockquotes
        text = text.replace(/^>\s+/gm, '');
        
        // Remove list markers
        text = text.replace(/^[*+-]\s+/gm, '');
        text = text.replace(/^\d+\.\s+/gm, '');
        
        return text.trim();
    }

    splitText(text) {
        const chunks = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if (currentChunk.length + sentence.length > this.maxTextLength) {
                if (currentChunk) {
                    chunks.push(currentChunk.trim());
                }
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
        
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks;
    }

    shouldIgnoreMatch(match, text) {
        // Ignore if in custom dictionary
        const matchedWord = text.substring(match.offset, match.offset + match.length);
        if (this.customDictionary.includes(matchedWord.toLowerCase())) {
            return true;
        }
        
        // Ignore specific rule IDs that cause false positives
        const ignoredRules = [
            'MORFOLOGIK_RULE_PT_BR', // Often flags proper names
            'PT_AGREEMENT_REPLACE', // Sometimes wrong for creative writing
        ];
        
        if (ignoredRules.includes(match.rule.id)) {
            return true;
        }
        
        // Check context for false positives
        if (this.isFalsePositive(match, text)) {
            return true;
        }
        
        return false;
    }

    isFalsePositive(match, text) {
        // Custom logic to detect false positives
        // For example, character names, made-up words in fiction, etc.
        
        // If it's a capitalized word (potential name)
        const word = text.substring(match.offset, match.offset + match.length);
        if (word[0] === word[0].toUpperCase() && match.rule.category.id === 'TYPOS') {
            // Might be a character name
            return true;
        }
        
        return false;
    }

    calculateStats(matches) {
        const stats = {
            total: matches.length,
            byCategory: {},
            bySeverity: {
                error: 0,
                warning: 0,
                suggestion: 0,
                style: 0
            }
        };
        
        for (const match of matches) {
            // By category
            const category = match.rule.category.name;
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            
            // By severity (approximate)
            if (match.rule.category.id === 'GRAMMAR' || match.rule.category.id === 'TYPOS') {
                stats.bySeverity.error++;
            } else if (match.rule.category.id === 'PUNCTUATION') {
                stats.bySeverity.warning++;
            } else if (match.rule.category.id === 'STYLE') {
                stats.bySeverity.style++;
            } else {
                stats.bySeverity.suggestion++;
            }
        }
        
        return stats;
    }

    async checkFile(filePath, options = {}) {
        console.log(colors.blue(`\n📝 Checking: ${path.basename(filePath)}`));
        
        const content = await fs.readFile(filePath, 'utf8');
        const result = await this.checkText(content);
        
        result.file = filePath;
        this.results.push(result);
        
        if (options.verbose || result.matches.length > 0) {
            this.displayResults(result, options);
        }
        
        return result;
    }

    displayResults(result, options = {}) {
        const { matches, stats } = result;
        
        if (matches.length === 0) {
            console.log(colors.green('  ✅ No issues found'));
            return;
        }
        
        console.log(colors.yellow(`  ⚠️  Found ${matches.length} issues:`));
        
        // Group by severity
        const grouped = {
            errors: matches.filter(m => 
                m.rule.category.id === 'GRAMMAR' || m.rule.category.id === 'TYPOS'
            ),
            warnings: matches.filter(m => 
                m.rule.category.id === 'PUNCTUATION'
            ),
            style: matches.filter(m => 
                m.rule.category.id === 'STYLE'
            )
        };
        
        // Display errors first
        if (grouped.errors.length > 0) {
            console.log(colors.red(`\n  Errors (${grouped.errors.length}):`));
            grouped.errors.slice(0, options.limit || 5).forEach(match => {
                this.displayMatch(match, 'error');
            });
        }
        
        // Then warnings
        if (grouped.warnings.length > 0) {
            console.log(colors.yellow(`\n  Warnings (${grouped.warnings.length}):`));
            grouped.warnings.slice(0, options.limit || 3).forEach(match => {
                this.displayMatch(match, 'warning');
            });
        }
        
        // Then style suggestions
        if (grouped.style.length > 0 && options.showStyle !== false) {
            console.log(colors.blue(`\n  Style (${grouped.style.length}):`));
            grouped.style.slice(0, options.limit || 3).forEach(match => {
                this.displayMatch(match, 'style');
            });
        }
        
        // Summary
        if (matches.length > 10) {
            console.log(colors.gray(`\n  ... and ${matches.length - 10} more issues`));
        }
    }

    displayMatch(match, type = 'error') {
        const icon = type === 'error' ? '❌' : type === 'warning' ? '⚠️ ' : '💡';
        const color = type === 'error' ? 'red' : type === 'warning' ? 'yellow' : 'blue';
        
        console.log(colors[color](`    ${icon} ${match.message}`));
        
        // Show context
        const context = match.context.text;
        const errorStart = match.context.offset;
        const errorEnd = errorStart + match.context.length;
        
        const before = context.substring(0, errorStart);
        const error = context.substring(errorStart, errorEnd);
        const after = context.substring(errorEnd);
        
        console.log(colors.gray(`       "${before}`) + 
                   colors.red.underline(error) + 
                   colors.gray(`${after}"`));
        
        // Show suggestions
        if (match.replacements.length > 0) {
            const suggestions = match.replacements.slice(0, 3).map(r => r.value).join(', ');
            console.log(colors.green(`       → Suggestions: ${suggestions}`));
        }
        
        console.log();
    }

    async checkAllChapters(pattern = 'chapters/*.md') {
        const glob = require('glob');
        const files = glob.sync(pattern).sort();
        
        console.log(colors.bold.blue('\n🔍 Grammar & Style Check\n'));
        console.log(colors.gray(`Language: ${this.language}`));
        console.log(colors.gray(`Files: ${files.length}\n`));
        
        for (const file of files) {
            await this.checkFile(file);
        }
        
        this.displaySummary();
        
        return this.results;
    }

    displaySummary() {
        console.log(colors.bold.blue('\n📊 Summary\n'));
        
        let totalIssues = 0;
        let errorCount = 0;
        let warningCount = 0;
        let styleCount = 0;
        
        for (const result of this.results) {
            totalIssues += result.stats.total;
            errorCount += result.stats.bySeverity.error;
            warningCount += result.stats.bySeverity.warning;
            styleCount += result.stats.bySeverity.style;
        }
        
        if (totalIssues === 0) {
            console.log(colors.green('✅ No grammar issues found! Your writing is clean.'));
        } else {
            console.log(`Total issues: ${totalIssues}`);
            if (errorCount > 0) console.log(colors.red(`  Errors: ${errorCount}`));
            if (warningCount > 0) console.log(colors.yellow(`  Warnings: ${warningCount}`));
            if (styleCount > 0) console.log(colors.blue(`  Style: ${styleCount}`));
            
            // Category breakdown
            const allCategories = {};
            for (const result of this.results) {
                for (const [cat, count] of Object.entries(result.stats.byCategory)) {
                    allCategories[cat] = (allCategories[cat] || 0) + count;
                }
            }
            
            console.log('\nBy category:');
            for (const [cat, count] of Object.entries(allCategories)) {
                console.log(`  ${cat}: ${count}`);
            }
        }
    }

    async generateReport(outputPath = 'build/reports/grammar-report.html') {
        console.log(colors.blue('\n📄 Generating grammar report...'));
        
        const html = this.generateHTMLReport();
        
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html, 'utf8');
        
        console.log(colors.green(`✅ Report saved to: ${outputPath}`));
        return outputPath;
    }

    generateHTMLReport() {
        const totalIssues = this.results.reduce((sum, r) => sum + r.stats.total, 0);
        
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Grammar & Style Report</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1, h2, h3 { color: #2c3e50; }
        .summary {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .stat { 
            display: inline-block;
            margin-right: 30px;
            font-size: 18px;
        }
        .error { color: #e74c3c; }
        .warning { color: #f39c12; }
        .style { color: #3498db; }
        .success { color: #27ae60; }
        .file-section {
            margin-bottom: 40px;
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        .file-header {
            background: #2c3e50;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
        }
        .file-content { padding: 20px; }
        .issue {
            margin-bottom: 20px;
            padding: 15px;
            border-left: 4px solid;
            background: #f8f9fa;
        }
        .issue.error { border-color: #e74c3c; }
        .issue.warning { border-color: #f39c12; }
        .issue.style { border-color: #3498db; }
        .context {
            margin: 10px 0;
            padding: 10px;
            background: white;
            border: 1px solid #ddd;
            font-family: monospace;
        }
        .error-text { 
            color: #e74c3c;
            text-decoration: underline;
            font-weight: bold;
        }
        .suggestion {
            color: #27ae60;
            font-style: italic;
        }
        .rule-info {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <h1>Grammar & Style Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <div class="stat">Total Issues: <strong>${totalIssues}</strong></div>
        ${this.generateSummaryStats()}
    </div>
    ${this.generateFileReports()}
</body>
</html>`;
        
        return html;
    }

    generateSummaryStats() {
        let errorCount = 0;
        let warningCount = 0;
        let styleCount = 0;
        
        for (const result of this.results) {
            errorCount += result.stats.bySeverity.error;
            warningCount += result.stats.bySeverity.warning;
            styleCount += result.stats.bySeverity.style;
        }
        
        let html = '';
        if (errorCount > 0) html += `<div class="stat error">Errors: ${errorCount}</div>`;
        if (warningCount > 0) html += `<div class="stat warning">Warnings: ${warningCount}</div>`;
        if (styleCount > 0) html += `<div class="stat style">Style: ${styleCount}</div>`;
        
        return html;
    }

    generateFileReports() {
        let html = '';
        
        for (const result of this.results) {
            if (result.matches.length === 0) continue;
            
            html += `
<div class="file-section">
    <div class="file-header">${path.basename(result.file)}</div>
    <div class="file-content">
        ${this.generateIssueList(result.matches)}
    </div>
</div>`;
        }
        
        return html;
    }

    generateIssueList(matches) {
        let html = '';
        
        for (const match of matches) {
            const type = this.getMatchType(match);
            const context = this.highlightError(match);
            const suggestions = match.replacements
                .slice(0, 3)
                .map(r => r.value)
                .join(', ');
            
            html += `
<div class="issue ${type}">
    <strong>${match.message}</strong>
    <div class="context">${context}</div>
    ${suggestions ? `<div class="suggestion">Suggestions: ${suggestions}</div>` : ''}
    <div class="rule-info">Rule: ${match.rule.id} | Category: ${match.rule.category.name}</div>
</div>`;
        }
        
        return html;
    }

    getMatchType(match) {
        if (match.rule.category.id === 'GRAMMAR' || match.rule.category.id === 'TYPOS') {
            return 'error';
        } else if (match.rule.category.id === 'PUNCTUATION') {
            return 'warning';
        } else {
            return 'style';
        }
    }

    highlightError(match) {
        const context = match.context.text;
        const errorStart = match.context.offset;
        const errorEnd = errorStart + match.context.length;
        
        const before = this.escapeHtml(context.substring(0, errorStart));
        const error = this.escapeHtml(context.substring(errorStart, errorEnd));
        const after = this.escapeHtml(context.substring(errorEnd));
        
        return `${before}<span class="error-text">${error}</span>${after}`;
    }

    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    async autoFix(filePath, options = {}) {
        console.log(colors.blue(`\n🔧 Auto-fixing: ${path.basename(filePath)}`));
        
        const content = await fs.readFile(filePath, 'utf8');
        const result = await this.checkText(content);
        
        if (result.matches.length === 0) {
            console.log(colors.green('  ✅ No issues to fix'));
            return { fixed: 0, content };
        }
        
        // Sort matches by offset (descending) to avoid position shifts
        const sortedMatches = result.matches.sort((a, b) => b.offset - a.offset);
        
        let fixedContent = content;
        let fixedCount = 0;
        
        for (const match of sortedMatches) {
            // Only auto-fix certain types of issues
            if (this.canAutoFix(match) && match.replacements.length > 0) {
                const replacement = match.replacements[0].value;
                
                // Find the match in the original content
                const startPos = this.findPositionInOriginal(content, match);
                if (startPos !== -1) {
                    const endPos = startPos + match.length;
                    fixedContent = 
                        fixedContent.substring(0, startPos) +
                        replacement +
                        fixedContent.substring(endPos);
                    fixedCount++;
                }
            }
        }
        
        if (fixedCount > 0 && !options.dryRun) {
            await fs.writeFile(filePath, fixedContent, 'utf8');
            console.log(colors.green(`  ✅ Fixed ${fixedCount} issues`));
        } else if (options.dryRun) {
            console.log(colors.yellow(`  Would fix ${fixedCount} issues (dry run)`));
        }
        
        return { fixed: fixedCount, content: fixedContent };
    }

    canAutoFix(match) {
        // Only auto-fix simple, unambiguous issues
        const autoFixableRules = [
            'REPEATED_WORDS', // Double words
            'COMMA_PARENTHESIS_WHITESPACE', // Space after comma
            'DOUBLE_PUNCTUATION', // Double punctuation
            'UPPERCASE_SENTENCE_START', // Sentence start
            'UNPAIRED_BRACKETS', // Unpaired brackets
        ];
        
        return autoFixableRules.includes(match.rule.id) &&
               match.replacements.length === 1; // Only one clear fix
    }

    findPositionInOriginal(originalText, match) {
        // This is simplified - in production, use proper mapping
        const plainText = this.markdownToPlainText(originalText);
        return match.offset; // This needs proper implementation
    }
}

module.exports = GrammarChecker;

// CLI usage
if (require.main === module) {
    const yargs = require('yargs/yargs');
    const { hideBin } = require('yargs/helpers');
    
    const argv = yargs(hideBin(process.argv))
        .command('check [files..]', 'Check grammar in files', {
            files: {
                describe: 'Files to check',
                type: 'array',
                default: ['chapters/*.md']
            }
        })
        .option('config', {
            alias: 'c',
            describe: 'Config file path',
            type: 'string',
            default: 'metadata.yaml'
        })
        .option('language', {
            alias: 'l',
            describe: 'Language code',
            type: 'string',
            default: 'pt-BR'
        })
        .option('report', {
            alias: 'r',
            describe: 'Generate HTML report',
            type: 'boolean',
            default: false
        })
        .option('fix', {
            alias: 'f',
            describe: 'Auto-fix simple issues',
            type: 'boolean',
            default: false
        })
        .option('api', {
            describe: 'LanguageTool API URL',
            type: 'string'
        })
        .help()
        .argv;
    
    (async () => {
        const checker = new GrammarChecker({
            language: argv.language,
            apiUrl: argv.api
        });
        
        // Load config
        await checker.loadConfig(argv.config);
        
        // Check server
        const serverOk = await checker.checkServer();
        if (!serverOk) {
            process.exit(1);
        }
        
        // Check files
        if (argv.fix) {
            // Auto-fix mode
            for (const pattern of argv.files) {
                const glob = require('glob');
                const files = glob.sync(pattern);
                for (const file of files) {
                    await checker.autoFix(file);
                }
            }
        } else {
            // Check mode
            for (const pattern of argv.files) {
                await checker.checkAllChapters(pattern);
            }
            
            // Generate report
            if (argv.report) {
                await checker.generateReport();
            }
        }
        
        // Exit with error if issues found
        const hasErrors = checker.results.some(r => r.stats.bySeverity.error > 0);
        process.exit(hasErrors ? 1 : 0);
    })();
}