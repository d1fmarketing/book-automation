/**
 * Content Consistency Test Suite
 * 
 * Tests content for consistency, completeness, and quality
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');

class ContentConsistencySuite {
    constructor(options = {}) {
        this.options = {
            thresholds: {
                minWords: 15000,
                maxDuplication: 0.05, // 5%
                minChapters: 5
            },
            ...options
        };
        
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: [],
            metrics: {},
            failures: []
        };
    }
    
    async run(workDir) {
        const chaptersDir = path.join(workDir, 'chapters');
        
        try {
            const files = await fs.readdir(chaptersDir);
            const chapters = files.filter(f => f.endsWith('.md')).sort();
            
            // Run tests
            await this.testChapterCount(chapters);
            await this.testWordCount(chaptersDir, chapters);
            await this.testChapterConsistency(chaptersDir, chapters);
            await this.testContentDuplication(chaptersDir, chapters);
            
            return this.results;
            
        } catch (error) {
            this.addFailure('Content Access', `Cannot access chapters: ${error.message}`);
            this.results.total = 1;
            this.results.failed = 1;
            return this.results;
        }
    }
    
    async testChapterCount(chapters) {
        this.results.total++;
        console.log('  🔍 Testing chapter count...');
        
        this.results.metrics.chapterCount = chapters.length;
        
        if (chapters.length >= this.options.thresholds.minChapters) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Chapter count OK: ${chapters.length}`));
        } else {
            this.results.failed++;
            this.addFailure('Chapter Count', `Only ${chapters.length} chapters (min: ${this.options.thresholds.minChapters})`);
        }
    }
    
    async testWordCount(chaptersDir, chapters) {
        this.results.total++;
        console.log('  🔍 Testing word count...');
        
        let totalWords = 0;
        
        for (const chapter of chapters) {
            const content = await fs.readFile(path.join(chaptersDir, chapter), 'utf8');
            const words = content.split(/\s+/).filter(w => w.length > 0);
            totalWords += words.length;
        }
        
        this.results.metrics.totalWords = totalWords;
        
        if (totalWords >= this.options.thresholds.minWords) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Word count OK: ${totalWords}`));
        } else {
            this.results.failed++;
            this.addFailure('Word Count', `Only ${totalWords} words (min: ${this.options.thresholds.minWords})`);
        }
    }
    
    async testChapterConsistency(chaptersDir, chapters) {
        this.results.total++;
        console.log('  🔍 Testing chapter consistency...');
        
        const issues = [];
        
        for (const chapter of chapters) {
            const content = await fs.readFile(path.join(chaptersDir, chapter), 'utf8');
            
            // Check for common issues
            if (content.includes('[object Object]')) {
                issues.push(`${chapter}: Contains [object Object]`);
            }
            if (content.includes('<hundefined>')) {
                issues.push(`${chapter}: Contains <hundefined>`);
            }
            if (!content.match(/^#\s+/m)) {
                issues.push(`${chapter}: Missing chapter heading`);
            }
        }
        
        if (issues.length === 0) {
            this.results.passed++;
            console.log(chalk.green('    ✅ Chapter consistency OK'));
        } else {
            this.results.failed++;
            this.addFailure('Chapter Consistency', issues.join('; '));
            issues.slice(0, 3).forEach(issue => {
                console.log(chalk.red(`    ❌ ${issue}`));
            });
        }
    }
    
    async testContentDuplication(chaptersDir, chapters) {
        this.results.total++;
        console.log('  🔍 Testing content duplication...');
        
        // Simple duplication check - in production use more sophisticated algorithm
        const paragraphs = new Map();
        let duplicates = 0;
        let totalParagraphs = 0;
        
        for (const chapter of chapters) {
            const content = await fs.readFile(path.join(chaptersDir, chapter), 'utf8');
            const paras = content.split('\n\n').filter(p => p.trim().length > 50);
            
            paras.forEach(para => {
                totalParagraphs++;
                const normalized = para.trim().toLowerCase();
                
                if (paragraphs.has(normalized)) {
                    duplicates++;
                } else {
                    paragraphs.set(normalized, chapter);
                }
            });
        }
        
        const duplicationRate = totalParagraphs > 0 ? duplicates / totalParagraphs : 0;
        this.results.metrics.duplicationRate = `${(duplicationRate * 100).toFixed(1)}%`;
        
        if (duplicationRate <= this.options.thresholds.maxDuplication) {
            this.results.passed++;
            console.log(chalk.green(`    ✅ Duplication rate OK: ${this.results.metrics.duplicationRate}`));
        } else {
            this.results.failed++;
            this.addFailure('Content Duplication', `High duplication: ${this.results.metrics.duplicationRate}`);
        }
    }
    
    addFailure(test, message) {
        this.results.failures.push({
            test,
            message,
            timestamp: new Date().toISOString()
        });
        console.log(chalk.red(`    ❌ ${test}: ${message}`));
    }
}

module.exports = ContentConsistencySuite;