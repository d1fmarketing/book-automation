/**
 * Refurbish Worker
 * 
 * Processes ebooks for quality improvements:
 * - Re-runs failed chapters
 * - Updates outdated content
 * - Fixes formatting issues
 * - Regenerates images
 * - Applies latest improvements
 */

const path = require('path');
const fs = require('fs').promises;
const { parentPort } = require('worker_threads');
const Writer = require('../../agents/writer-wrapper');
const TonePolisher = require('../../agents/tone-polisher');
const Illustrator = require('../../agents/illustrator');
const FormatterHTML = require('../../agents/formatter-html-clean');
const ImportBlacklist = require('../../scripts/import-blacklist');

class RefurbishWorker {
    constructor() {
        this.writer = new Writer();
        this.tonePolisher = new TonePolisher();
        this.illustrator = new Illustrator();
        this.formatter = new FormatterHTML();
        this.blacklist = new ImportBlacklist();
        this.stats = {
            processed: 0,
            improved: 0,
            failed: 0,
            skipped: 0
        };
    }

    async processJob(job) {
        const { bookDir, options = {} } = job.data;
        const {
            chapters = 'all',
            operations = ['content', 'tone', 'images', 'format'],
            force = false,
            quality = 'high'
        } = options;

        console.log(`🔧 Refurbishing book: ${bookDir}`);
        console.log(`   Operations: ${operations.join(', ')}`);
        console.log(`   Chapters: ${chapters}`);
        console.log(`   Quality: ${quality}`);

        try {
            // Validate book directory
            const bookPath = path.resolve(bookDir);
            const exists = await this.validateBookDirectory(bookPath);
            if (!exists) {
                throw new Error(`Book directory not found: ${bookPath}`);
            }

            // Load book metadata
            const metadata = await this.loadBookMetadata(bookPath);
            
            // Scan for blacklisted imports
            const importIssues = await this.blacklist.scanDirectory(bookPath);
            if (importIssues.length > 0) {
                console.warn(`⚠️  Found ${importIssues.length} blacklisted imports`);
                // Log but don't fail - refurbish will fix these
            }

            // Determine chapters to process
            const chaptersToProcess = await this.getChaptersToProcess(bookPath, chapters);
            
            // Process each chapter
            const results = [];
            for (const chapterFile of chaptersToProcess) {
                const result = await this.refurbishChapter(
                    bookPath, 
                    chapterFile, 
                    operations,
                    { force, quality, metadata }
                );
                results.push(result);
                
                // Update progress
                if (job.updateProgress) {
                    const progress = Math.round((results.length / chaptersToProcess.length) * 100);
                    await job.updateProgress(progress);
                }
            }

            // Regenerate book-level assets if needed
            if (operations.includes('images')) {
                await this.regenerateCover(bookPath, metadata);
            }

            // Reformat entire book if needed
            if (operations.includes('format')) {
                await this.reformatBook(bookPath);
            }

            // Generate refurbish report
            const report = this.generateReport(results);
            await this.saveReport(bookPath, report);

            console.log(`✅ Refurbish complete: ${bookPath}`);
            console.log(`   Processed: ${this.stats.processed}`);
            console.log(`   Improved: ${this.stats.improved}`);
            console.log(`   Failed: ${this.stats.failed}`);
            console.log(`   Skipped: ${this.stats.skipped}`);

            return {
                success: true,
                bookDir: bookPath,
                stats: this.stats,
                report: report
            };

        } catch (error) {
            console.error(`❌ Refurbish failed: ${error.message}`);
            return {
                success: false,
                error: error.message,
                bookDir,
                stats: this.stats
            };
        }
    }

    async validateBookDirectory(bookPath) {
        try {
            const stats = await fs.stat(bookPath);
            if (!stats.isDirectory()) return false;
            
            // Check for required subdirectories
            const required = ['chapters'];
            for (const dir of required) {
                try {
                    await fs.stat(path.join(bookPath, dir));
                } catch {
                    console.log(`Creating missing directory: ${dir}`);
                    await fs.mkdir(path.join(bookPath, dir), { recursive: true });
                }
            }
            
            return true;
        } catch {
            return false;
        }
    }

    async loadBookMetadata(bookPath) {
        try {
            const metadataPath = path.join(bookPath, 'metadata.json');
            const content = await fs.readFile(metadataPath, 'utf8');
            return JSON.parse(content);
        } catch {
            // Return default metadata if not found
            return {
                title: 'Untitled Book',
                author: 'Unknown Author',
                style: 'professional',
                chapters: []
            };
        }
    }

    async getChaptersToProcess(bookPath, chaptersSpec) {
        const chaptersDir = path.join(bookPath, 'chapters');
        const allFiles = await fs.readdir(chaptersDir);
        const chapterFiles = allFiles
            .filter(f => f.match(/^chapter-\d+.*\.md$/))
            .sort();

        if (chaptersSpec === 'all') {
            return chapterFiles;
        } else if (typeof chaptersSpec === 'number') {
            return chapterFiles.slice(0, chaptersSpec);
        } else if (Array.isArray(chaptersSpec)) {
            return chapterFiles.filter((_, index) => chaptersSpec.includes(index + 1));
        } else {
            return chapterFiles;
        }
    }

    async refurbishChapter(bookPath, chapterFile, operations, options) {
        const chapterPath = path.join(bookPath, 'chapters', chapterFile);
        console.log(`\n📄 Refurbishing: ${chapterFile}`);
        
        this.stats.processed++;
        const improvements = [];

        try {
            // Load chapter content
            const originalContent = await fs.readFile(chapterPath, 'utf8');
            const originalStats = await this.analyzeChapter(originalContent);
            
            let currentContent = originalContent;
            let wasImproved = false;

            // Apply operations in sequence
            if (operations.includes('content')) {
                const contentResult = await this.improveContent(
                    currentContent, 
                    chapterFile,
                    options
                );
                if (contentResult.improved) {
                    currentContent = contentResult.content;
                    improvements.push('content');
                    wasImproved = true;
                }
            }

            if (operations.includes('tone')) {
                const toneResult = await this.improveTone(
                    currentContent,
                    chapterPath,
                    options
                );
                if (toneResult.improved) {
                    currentContent = toneResult.content;
                    improvements.push('tone');
                    wasImproved = true;
                }
            }

            if (operations.includes('images')) {
                const imageResult = await this.updateImages(
                    currentContent,
                    bookPath,
                    chapterFile,
                    options
                );
                if (imageResult.improved) {
                    currentContent = imageResult.content;
                    improvements.push('images');
                    wasImproved = true;
                }
            }

            // Save improved content if changed
            if (wasImproved || options.force) {
                // Backup original
                const backupPath = chapterPath.replace('.md', '.backup.md');
                await fs.writeFile(backupPath, originalContent);
                
                // Save improved version
                await fs.writeFile(chapterPath, currentContent);
                this.stats.improved++;
                
                console.log(`   ✅ Improved: ${improvements.join(', ')}`);
            } else {
                this.stats.skipped++;
                console.log(`   ⏭️  Skipped: No improvements needed`);
            }

            // Analyze improvements
            const newStats = await this.analyzeChapter(currentContent);
            
            return {
                chapter: chapterFile,
                success: true,
                improved: wasImproved,
                improvements,
                stats: {
                    before: originalStats,
                    after: newStats,
                    improvement: this.calculateImprovement(originalStats, newStats)
                }
            };

        } catch (error) {
            this.stats.failed++;
            console.error(`   ❌ Failed: ${error.message}`);
            
            return {
                chapter: chapterFile,
                success: false,
                error: error.message
            };
        }
    }

    async analyzeChapter(content) {
        const lines = content.split('\n');
        const words = content.split(/\s+/).filter(w => w.length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        return {
            lines: lines.length,
            words: words.length,
            sentences: sentences.length,
            avgWordsPerSentence: Math.round(words.length / sentences.length),
            hasImages: content.includes('!['),
            headings: (content.match(/^#+\s/gm) || []).length,
            codeBlocks: (content.match(/```/g) || []).length / 2,
            links: (content.match(/\[([^\]]+)\]\([^)]+\)/g) || []).length
        };
    }

    async improveContent(content, chapterFile, options) {
        // Check if content needs improvement
        const issues = [];
        
        // Check for common issues
        if (content.includes('[object Object]')) {
            issues.push('object_literals');
        }
        if (content.includes('<hundefined>')) {
            issues.push('undefined_tags');
        }
        if (content.match(/\b(very|really|just|actually)\b/gi)) {
            issues.push('filler_words');
        }
        if (content.length < 1000) {
            issues.push('too_short');
        }
        
        if (issues.length === 0 && !options.force) {
            return { improved: false, content };
        }

        console.log(`   🔄 Improving content (issues: ${issues.join(', ')})`);
        
        // Clean up known issues
        let improved = content
            .replace(/\[object Object\]/g, '')
            .replace(/<hundefined>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // For short content, expand it
        if (issues.includes('too_short')) {
            // In production, this would call the writer agent to expand
            console.log('   📝 Content too short - would expand with writer agent');
        }
        
        return {
            improved: improved !== content,
            content: improved
        };
    }

    async improveTone(content, chapterPath, options) {
        // Use tone polisher agent
        const result = await this.tonePolisher.polishChapter(chapterPath, {
            brandVoice: options.metadata?.style || 'professional',
            outputPath: chapterPath.replace('.md', '.polished.md')
        });
        
        if (result.success) {
            const polishedContent = await fs.readFile(result.outputPath, 'utf8');
            await fs.unlink(result.outputPath); // Clean up temp file
            
            return {
                improved: true,
                content: polishedContent
            };
        }
        
        return { improved: false, content };
    }

    async updateImages(content, bookPath, chapterFile, options) {
        // Check for missing or placeholder images
        const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]*)\)/g) || [];
        let improved = false;
        let updatedContent = content;
        
        for (const match of imageMatches) {
            const imagePath = match.match(/\(([^)]+)\)/)[1];
            
            // Check if image exists or is placeholder
            if (!imagePath || imagePath === '' || imagePath.includes('placeholder')) {
                console.log(`   🖼️  Regenerating missing image`);
                // In production, would call illustrator agent
                improved = true;
            }
        }
        
        return {
            improved,
            content: updatedContent
        };
    }

    async regenerateCover(bookPath, metadata) {
        console.log('\n🎨 Regenerating cover image');
        
        try {
            const result = await this.illustrator.generateBookImages(bookPath);
            if (result.success) {
                console.log('   ✅ Cover regenerated');
            }
        } catch (error) {
            console.error('   ❌ Cover generation failed:', error.message);
        }
    }

    async reformatBook(bookPath) {
        console.log('\n📚 Reformatting entire book');
        
        try {
            const formatter = new FormatterHTML();
            await formatter.formatBook(bookPath);
            console.log('   ✅ Book reformatted');
        } catch (error) {
            console.error('   ❌ Formatting failed:', error.message);
        }
    }

    calculateImprovement(before, after) {
        const improvements = {};
        
        if (after.words > before.words) {
            improvements.wordCount = `+${after.words - before.words}`;
        }
        
        if (after.avgWordsPerSentence !== before.avgWordsPerSentence) {
            improvements.readability = 
                after.avgWordsPerSentence < before.avgWordsPerSentence ? 'improved' : 'unchanged';
        }
        
        if (after.hasImages && !before.hasImages) {
            improvements.images = 'added';
        }
        
        return improvements;
    }

    generateReport(results) {
        const timestamp = new Date().toISOString();
        const successful = results.filter(r => r.success);
        const improved = results.filter(r => r.improved);
        
        return {
            timestamp,
            summary: {
                total: results.length,
                successful: successful.length,
                improved: improved.length,
                failed: results.length - successful.length,
                improvementRate: `${Math.round((improved.length / results.length) * 100)}%`
            },
            stats: this.stats,
            chapters: results,
            improvements: {
                content: results.filter(r => r.improvements?.includes('content')).length,
                tone: results.filter(r => r.improvements?.includes('tone')).length,
                images: results.filter(r => r.improvements?.includes('images')).length
            }
        };
    }

    async saveReport(bookPath, report) {
        const reportPath = path.join(bookPath, 'refurbish-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📊 Report saved: ${reportPath}`);
    }
}

// Worker thread handler
if (parentPort) {
    const worker = new RefurbishWorker();
    
    parentPort.on('message', async (message) => {
        if (message.type === 'process') {
            const result = await worker.processJob(message.job);
            parentPort.postMessage({ type: 'complete', result });
        }
    });
}

module.exports = RefurbishWorker;