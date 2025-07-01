#!/usr/bin/env node

/**
 * Grammar Report Generator
 * Creates detailed grammar and style reports in various formats
 */

const fs = require('fs').promises;
const path = require('path');
const marked = require('marked');

class GrammarReportGenerator {
    constructor(results = []) {
        this.results = results;
        this.timestamp = new Date().toISOString();
    }

    async generateHTML(outputPath = 'build/reports/grammar-report.html') {
        const html = this.createHTMLReport();
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html, 'utf8');
        return outputPath;
    }

    async generateMarkdown(outputPath = 'build/reports/grammar-report.md') {
        const markdown = this.createMarkdownReport();
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, markdown, 'utf8');
        return outputPath;
    }

    async generateJSON(outputPath = 'build/reports/grammar-report.json') {
        const report = {
            timestamp: this.timestamp,
            summary: this.getSummaryStats(),
            files: this.results,
            topIssues: this.getTopIssues()
        };
        
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
        return outputPath;
    }

    createHTMLReport() {
        const summary = this.getSummaryStats();
        const topIssues = this.getTopIssues();
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grammar & Style Report - ${new Date(this.timestamp).toLocaleDateString()}</title>
    <style>
        :root {
            --primary: #2563eb;
            --error: #dc2626;
            --warning: #f59e0b;
            --success: #10b981;
            --info: #3b82f6;
            --bg: #f9fafb;
            --text: #111827;
            --border: #e5e7eb;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--text);
            background: var(--bg);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        header {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        h1 {
            color: var(--primary);
            margin-bottom: 1rem;
        }
        
        .metadata {
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .stat-label {
            color: #6b7280;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .error .stat-value { color: var(--error); }
        .warning .stat-value { color: var(--warning); }
        .info .stat-value { color: var(--info); }
        .success .stat-value { color: var(--success); }
        
        .section {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        h2 {
            color: var(--primary);
            margin-bottom: 1.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--border);
        }
        
        .issue-list {
            list-style: none;
        }
        
        .issue {
            padding: 1rem;
            margin-bottom: 1rem;
            border-left: 4px solid;
            background: var(--bg);
            border-radius: 4px;
        }
        
        .issue.error { border-color: var(--error); }
        .issue.warning { border-color: var(--warning); }
        .issue.info { border-color: var(--info); }
        
        .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
        }
        
        .issue-message {
            font-weight: 600;
        }
        
        .issue-location {
            font-size: 0.875rem;
            color: #6b7280;
        }
        
        .issue-context {
            padding: 0.5rem;
            background: white;
            border: 1px solid var(--border);
            border-radius: 4px;
            margin: 0.5rem 0;
            font-family: monospace;
            font-size: 0.875rem;
            overflow-x: auto;
        }
        
        .error-text {
            color: var(--error);
            font-weight: 700;
            text-decoration: underline;
        }
        
        .suggestion {
            color: var(--success);
            font-style: italic;
            font-size: 0.875rem;
        }
        
        .top-issues {
            margin-bottom: 2rem;
        }
        
        .issue-count {
            display: inline-block;
            background: var(--error);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            margin-left: 0.5rem;
        }
        
        .file-report {
            margin-bottom: 3rem;
        }
        
        .file-header {
            background: var(--primary);
            color: white;
            padding: 1rem;
            border-radius: 4px 4px 0 0;
            font-weight: 600;
        }
        
        .file-content {
            border: 1px solid var(--border);
            border-top: none;
            padding: 1rem;
            border-radius: 0 0 4px 4px;
        }
        
        .no-issues {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
        }
        
        .charts {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .chart {
            text-align: center;
        }
        
        @media print {
            body { background: white; }
            .container { padding: 0; }
            .section, .stat-card { box-shadow: none; border: 1px solid var(--border); }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Grammar & Style Report</h1>
            <div class="metadata">
                Generated on ${new Date(this.timestamp).toLocaleString()}<br>
                ${summary.totalFiles} files analyzed
            </div>
        </header>
        
        <div class="summary">
            <div class="stat-card ${summary.totalErrors > 0 ? 'error' : 'success'}">
                <div class="stat-value">${summary.totalErrors}</div>
                <div class="stat-label">Errors</div>
            </div>
            <div class="stat-card ${summary.totalWarnings > 0 ? 'warning' : 'success'}">
                <div class="stat-value">${summary.totalWarnings}</div>
                <div class="stat-label">Warnings</div>
            </div>
            <div class="stat-card info">
                <div class="stat-value">${summary.totalStyle}</div>
                <div class="stat-label">Style Issues</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${summary.totalIssues}</div>
                <div class="stat-label">Total Issues</div>
            </div>
        </div>
        
        ${topIssues.length > 0 ? this.createTopIssuesHTML(topIssues) : ''}
        
        <div class="section">
            <h2>Issues by File</h2>
            ${this.createFileReportsHTML()}
        </div>
    </div>
</body>
</html>`;
    }

    createTopIssuesHTML(topIssues) {
        return `
        <div class="section top-issues">
            <h2>Most Common Issues</h2>
            <ul class="issue-list">
                ${topIssues.map(issue => `
                    <li class="issue ${this.getIssueType(issue)}">
                        <div class="issue-header">
                            <span class="issue-message">${issue.message}</span>
                            <span class="issue-count">${issue.count}</span>
                        </div>
                        <div class="suggestion">Rule: ${issue.ruleId}</div>
                    </li>
                `).join('')}
            </ul>
        </div>`;
    }

    createFileReportsHTML() {
        return this.results.map(result => {
            if (!result.matches || result.matches.length === 0) {
                return `
                <div class="file-report">
                    <div class="file-header">${path.basename(result.file)}</div>
                    <div class="file-content">
                        <div class="no-issues">✅ No issues found</div>
                    </div>
                </div>`;
            }
            
            return `
            <div class="file-report">
                <div class="file-header">
                    ${path.basename(result.file)} 
                    <span style="float: right">${result.matches.length} issues</span>
                </div>
                <div class="file-content">
                    <ul class="issue-list">
                        ${result.matches.slice(0, 10).map(match => this.createIssueHTML(match)).join('')}
                    </ul>
                    ${result.matches.length > 10 ? `
                        <div style="text-align: center; color: #6b7280; padding: 1rem;">
                            ... and ${result.matches.length - 10} more issues
                        </div>
                    ` : ''}
                </div>
            </div>`;
        }).join('');
    }

    createIssueHTML(match) {
        const type = this.getMatchType(match);
        const context = this.highlightError(match);
        const suggestions = match.replacements.slice(0, 3).map(r => r.value).join(', ');
        
        return `
        <li class="issue ${type}">
            <div class="issue-header">
                <span class="issue-message">${match.message}</span>
                <span class="issue-location">Line ~${this.estimateLine(match)}</span>
            </div>
            <div class="issue-context">${context}</div>
            ${suggestions ? `<div class="suggestion">Suggestions: ${suggestions}</div>` : ''}
        </li>`;
    }

    createMarkdownReport() {
        const summary = this.getSummaryStats();
        const topIssues = this.getTopIssues();
        
        let md = `# Grammar & Style Report\n\n`;
        md += `Generated on: ${new Date(this.timestamp).toLocaleString()}\n\n`;
        
        md += `## Summary\n\n`;
        md += `- **Total Files**: ${summary.totalFiles}\n`;
        md += `- **Total Issues**: ${summary.totalIssues}\n`;
        md += `- **Errors**: ${summary.totalErrors}\n`;
        md += `- **Warnings**: ${summary.totalWarnings}\n`;
        md += `- **Style Issues**: ${summary.totalStyle}\n\n`;
        
        if (topIssues.length > 0) {
            md += `## Most Common Issues\n\n`;
            topIssues.forEach(issue => {
                md += `- **${issue.message}** (${issue.count} occurrences)\n`;
                md += `  - Rule: \`${issue.ruleId}\`\n`;
            });
            md += '\n';
        }
        
        md += `## Issues by File\n\n`;
        
        this.results.forEach(result => {
            md += `### ${path.basename(result.file)}\n\n`;
            
            if (!result.matches || result.matches.length === 0) {
                md += `✅ No issues found\n\n`;
                return;
            }
            
            md += `Found ${result.matches.length} issues:\n\n`;
            
            result.matches.slice(0, 20).forEach((match, i) => {
                md += `${i + 1}. **${match.message}**\n`;
                md += `   - Context: "${match.context.text}"\n`;
                if (match.replacements.length > 0) {
                    const suggestions = match.replacements.slice(0, 3).map(r => r.value).join(', ');
                    md += `   - Suggestions: ${suggestions}\n`;
                }
                md += '\n';
            });
            
            if (result.matches.length > 20) {
                md += `... and ${result.matches.length - 20} more issues\n\n`;
            }
        });
        
        return md;
    }

    getSummaryStats() {
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalStyle = 0;
        let totalIssues = 0;
        let filesWithIssues = 0;
        
        this.results.forEach(result => {
            if (result.stats) {
                totalErrors += result.stats.bySeverity.error || 0;
                totalWarnings += result.stats.bySeverity.warning || 0;
                totalStyle += result.stats.bySeverity.style || 0;
                totalIssues += result.stats.total || 0;
                if (result.stats.total > 0) filesWithIssues++;
            }
        });
        
        return {
            totalFiles: this.results.length,
            filesWithIssues,
            totalIssues,
            totalErrors,
            totalWarnings,
            totalStyle
        };
    }

    getTopIssues(limit = 10) {
        const issueCounts = {};
        
        this.results.forEach(result => {
            if (result.matches) {
                result.matches.forEach(match => {
                    const key = `${match.rule.id}:${match.message}`;
                    if (!issueCounts[key]) {
                        issueCounts[key] = {
                            ruleId: match.rule.id,
                            message: match.message,
                            category: match.rule.category.name,
                            count: 0
                        };
                    }
                    issueCounts[key].count++;
                });
            }
        });
        
        return Object.values(issueCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    getMatchType(match) {
        if (match.rule.category.id === 'GRAMMAR' || match.rule.category.id === 'TYPOS') {
            return 'error';
        } else if (match.rule.category.id === 'PUNCTUATION') {
            return 'warning';
        } else {
            return 'info';
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

    estimateLine(match) {
        // Very rough estimate based on offset
        return Math.floor(match.offset / 80) + 1;
    }
}

module.exports = GrammarReportGenerator;