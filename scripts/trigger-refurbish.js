#!/usr/bin/env node

/**
 * Trigger Refurbish
 * 
 * CLI tool to initiate refurbishment of ebooks
 * Can be run manually or scheduled via cron
 */

const path = require('path');
const fs = require('fs').promises;
const { getQueueManager } = require('../src/queue/QueueManager');

class RefurbishTrigger {
    constructor() {
        this.queueManager = null;
    }
    
    async initialize() {
        this.queueManager = getQueueManager();
        await this.queueManager.connect();
    }
    
    async triggerRefurbish(bookDir, options = {}) {
        console.log(`🔧 Triggering refurbish for: ${bookDir}`);
        
        try {
            // Validate book directory
            const bookPath = path.resolve(bookDir);
            const stats = await fs.stat(bookPath);
            if (!stats.isDirectory()) {
                throw new Error('Not a directory');
            }
            
            // Check if book needs refurbishing
            const needsRefurbish = await this.checkIfNeeded(bookPath, options);
            if (!needsRefurbish && !options.force) {
                console.log('✅ Book is up to date, no refurbish needed');
                return { status: 'skipped', reason: 'up_to_date' };
            }
            
            // Create refurbish job
            const jobData = {
                bookDir: bookPath,
                options: {
                    chapters: options.chapters || 'all',
                    operations: options.operations || ['content', 'tone', 'images', 'format'],
                    force: options.force || false,
                    quality: options.quality || 'high',
                    priority: options.priority || 'normal'
                }
            };
            
            // Add to refurbish queue
            const job = await this.queueManager.addJob(
                'refurbish',
                'refurbish-book',
                jobData,
                {
                    priority: options.priority === 'high' ? 1 : 10,
                    removeOnComplete: false,
                    removeOnFail: false
                }
            );
            
            console.log(`✅ Refurbish job created: ${job.id}`);
            console.log(`   Queue: refurbish`);
            console.log(`   Priority: ${options.priority || 'normal'}`);
            console.log(`   Operations: ${jobData.options.operations.join(', ')}`);
            
            // Wait for completion if requested
            if (options.wait) {
                console.log('\n⏳ Waiting for completion...');
                const result = await job.waitUntilFinished(
                    this.queueManager.events,
                    options.timeout || 300000 // 5 minutes default
                );
                
                console.log('\n✅ Refurbish completed:');
                console.log(JSON.stringify(result, null, 2));
                
                return result;
            }
            
            return {
                status: 'queued',
                jobId: job.id,
                queue: 'refurbish',
                bookDir: bookPath
            };
            
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return {
                status: 'error',
                error: error.message
            };
        }
    }
    
    async checkIfNeeded(bookPath, options) {
        // Check various criteria to determine if refurbish is needed
        const checks = [];
        
        // 1. Check for error markers
        const errorMarkers = [
            '[object Object]',
            '<hundefined>',
            'undefined',
            'TODO:',
            'FIXME:'
        ];
        
        const chaptersDir = path.join(bookPath, 'chapters');
        try {
            const files = await fs.readdir(chaptersDir);
            for (const file of files) {
                if (!file.endsWith('.md')) continue;
                
                const content = await fs.readFile(path.join(chaptersDir, file), 'utf8');
                for (const marker of errorMarkers) {
                    if (content.includes(marker)) {
                        checks.push(`Found "${marker}" in ${file}`);
                    }
                }
            }
        } catch (error) {
            checks.push(`Cannot read chapters: ${error.message}`);
        }
        
        // 2. Check for missing images
        try {
            const imagesDir = path.join(bookPath, 'assets', 'images');
            const imageFiles = await fs.readdir(imagesDir);
            if (imageFiles.length === 0) {
                checks.push('No images found');
            }
            if (!imageFiles.includes('cover.png')) {
                checks.push('Missing cover image');
            }
        } catch {
            checks.push('Images directory not found');
        }
        
        // 3. Check last build date
        try {
            const htmlPath = path.join(bookPath, 'html', 'index.html');
            const htmlStats = await fs.stat(htmlPath);
            const hoursSinceLastBuild = (Date.now() - htmlStats.mtime) / (1000 * 60 * 60);
            
            if (hoursSinceLastBuild > 24 * 7) { // Older than 7 days
                checks.push(`Last build ${Math.round(hoursSinceLastBuild / 24)} days ago`);
            }
        } catch {
            checks.push('No HTML build found');
        }
        
        // 4. Check for quality issues
        try {
            const reportPath = path.join(bookPath, 'qa-report.json');
            const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
            
            if (report.issues && report.issues.length > 0) {
                checks.push(`${report.issues.length} QA issues found`);
            }
        } catch {
            // No QA report is OK
        }
        
        if (checks.length > 0) {
            console.log('\n📋 Refurbish needed:');
            checks.forEach(check => console.log(`   - ${check}`));
            return true;
        }
        
        return false;
    }
    
    async batchRefurbish(pattern, options = {}) {
        console.log(`🔧 Batch refurbish: ${pattern}`);
        
        const books = await this.findBooks(pattern);
        console.log(`Found ${books.length} books to refurbish`);
        
        const results = [];
        for (const book of books) {
            console.log(`\n📚 Processing: ${book}`);
            const result = await this.triggerRefurbish(book, {
                ...options,
                wait: false // Don't wait for batch jobs
            });
            results.push({ book, ...result });
        }
        
        // Summary
        console.log('\n📊 Batch Summary:');
        console.log(`   Total: ${results.length}`);
        console.log(`   Queued: ${results.filter(r => r.status === 'queued').length}`);
        console.log(`   Skipped: ${results.filter(r => r.status === 'skipped').length}`);
        console.log(`   Errors: ${results.filter(r => r.status === 'error').length}`);
        
        return results;
    }
    
    async findBooks(pattern) {
        // Simple pattern matching for book directories
        const books = [];
        const baseDir = path.resolve(pattern);
        
        try {
            const entries = await fs.readdir(baseDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const bookPath = path.join(baseDir, entry.name);
                    
                    // Check if it's a book directory
                    try {
                        await fs.stat(path.join(bookPath, 'chapters'));
                        books.push(bookPath);
                    } catch {
                        // Not a book directory
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning directory: ${error.message}`);
        }
        
        return books;
    }
    
    async cleanup() {
        if (this.queueManager) {
            await this.queueManager.shutdown();
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Refurbish Trigger

Usage:
  trigger-refurbish.js <book-dir> [options]
  trigger-refurbish.js --batch <pattern> [options]

Options:
  --chapters <n|all>      Chapters to refurbish (default: all)
  --operations <list>     Operations: content,tone,images,format
  --force                 Force refurbish even if up to date
  --quality <level>       Quality level: fast|normal|high
  --priority <level>      Job priority: low|normal|high
  --wait                  Wait for completion
  --timeout <ms>          Timeout when waiting (default: 300000)
  --batch <pattern>       Batch process multiple books

Examples:
  # Refurbish single book
  trigger-refurbish.js build/books/my-book

  # Force refurbish with high quality
  trigger-refurbish.js build/books/my-book --force --quality high

  # Refurbish only content and tone
  trigger-refurbish.js build/books/my-book --operations content,tone

  # Batch refurbish all books
  trigger-refurbish.js --batch build/books

  # Wait for completion
  trigger-refurbish.js build/books/my-book --wait
        `);
        process.exit(0);
    }
    
    const trigger = new RefurbishTrigger();
    
    (async () => {
        try {
            await trigger.initialize();
            
            // Parse options
            const options = {};
            let bookDir = null;
            let batchPattern = null;
            
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                
                if (arg.startsWith('--')) {
                    const key = arg.slice(2);
                    const value = args[i + 1];
                    
                    switch (key) {
                        case 'batch':
                            batchPattern = value;
                            i++;
                            break;
                        case 'chapters':
                            options.chapters = value === 'all' ? 'all' : parseInt(value);
                            i++;
                            break;
                        case 'operations':
                            options.operations = value.split(',');
                            i++;
                            break;
                        case 'force':
                            options.force = true;
                            break;
                        case 'quality':
                            options.quality = value;
                            i++;
                            break;
                        case 'priority':
                            options.priority = value;
                            i++;
                            break;
                        case 'wait':
                            options.wait = true;
                            break;
                        case 'timeout':
                            options.timeout = parseInt(value);
                            i++;
                            break;
                    }
                } else {
                    bookDir = arg;
                }
            }
            
            // Execute
            if (batchPattern) {
                await trigger.batchRefurbish(batchPattern, options);
            } else if (bookDir) {
                await trigger.triggerRefurbish(bookDir, options);
            } else {
                console.error('No book directory specified');
                process.exit(1);
            }
            
            // Cleanup
            await trigger.cleanup();
            process.exit(0);
            
        } catch (error) {
            console.error('Fatal error:', error);
            await trigger.cleanup();
            process.exit(1);
        }
    })();
}

module.exports = RefurbishTrigger;