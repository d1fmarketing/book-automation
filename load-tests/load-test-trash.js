#!/usr/bin/env node

/**
 * Load Test: Trash Operations
 * Tests concurrent trash operations including move, search, and restore
 */

const LoadTestRunner = require('./base-load-test');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class TrashOperationsLoadTest extends LoadTestRunner {
    constructor(options = {}) {
        super('trash-operations', {
            concurrency: options.concurrency || 20,
            duration: options.duration || 30000, // 30 seconds
            ...options
        });
        
        this.trashScriptPath = path.join(__dirname, '..', '.claude', 'scripts', 'safe-trash.js');
        this.testFilesDir = path.join(__dirname, 'test-files');
        this.createdFiles = new Set();
    }
    
    async runTest() {
        // Create test files directory
        await fs.mkdir(this.testFilesDir, { recursive: true });
        
        // Mix of different operations
        const tasks = [];
        
        // Group 1: File creators and trashers (8 processes)
        for (let i = 0; i < 8; i++) {
            tasks.push(this.runCreateAndTrash(i));
        }
        
        // Group 2: Search operations (6 processes)
        for (let i = 0; i < 6; i++) {
            tasks.push(this.runSearchOperations(i));
        }
        
        // Group 3: Restore operations (4 processes)
        for (let i = 0; i < 4; i++) {
            tasks.push(this.runRestoreOperations(i));
        }
        
        // Group 4: Directory operations (2 processes)
        for (let i = 0; i < 2; i++) {
            tasks.push(this.runDirectoryOperations(i));
        }
        
        await Promise.all(tasks);
    }
    
    /**
     * Create files and move to trash
     */
    async runCreateAndTrash(id) {
        let counter = 0;
        
        while (this.isRunning) {
            const filename = `test-file-${id}-${counter++}-${crypto.randomBytes(4).toString('hex')}.txt`;
            const filepath = path.join(this.testFilesDir, filename);
            
            // Create file
            await this.trackOperation(`create-${filename}`, async () => {
                const content = `Test content ${id} ${counter}\n`.repeat(Math.floor(Math.random() * 100));
                await fs.writeFile(filepath, content);
                this.createdFiles.add(filepath);
            }).catch(() => {});
            
            // Small delay
            await this.sleep(Math.random() * 100);
            
            // Trash file
            await this.trackOperation(`trash-${filename}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.trashScriptPath,
                        'trash',
                        filepath,
                        `Load test ${id}-${counter}`
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            this.createdFiles.delete(filepath);
                            resolve();
                        } else {
                            reject(new Error(`Trash failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {});
            
            await this.sleep(Math.random() * 500);
        }
    }
    
    /**
     * Search for files in trash
     */
    async runSearchOperations(id) {
        const searchTerms = ['test-file', 'load-test', `${id}`, '.txt', 'file'];
        
        while (this.isRunning) {
            const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
            
            await this.trackOperation(`search-${term}-${id}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.trashScriptPath,
                        'find',
                        term
                    ], { captureOutput: true });
                    
                    let output = '';
                    proc.stdout?.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            // Count results
                            const matches = output.match(/Found \d+ item/);
                            resolve(matches ? matches[0] : 'No results');
                        } else {
                            reject(new Error(`Search failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {});
            
            await this.sleep(Math.random() * 300);
        }
    }
    
    /**
     * Restore files from trash
     */
    async runRestoreOperations(id) {
        while (this.isRunning) {
            // First find something to restore
            const searchResult = await this.trackOperation(`restore-search-${id}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.trashScriptPath,
                        'find',
                        `test-file-${id}`
                    ], { captureOutput: true });
                    
                    let output = '';
                    proc.stdout?.on('data', (data) => {
                        output += data.toString();
                    });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            // Extract first file path
                            const match = output.match(/^(\/.*\.txt)$/m);
                            resolve(match ? match[1] : null);
                        } else {
                            resolve(null);
                        }
                    });
                });
            }).catch(() => null);
            
            if (searchResult) {
                // Try to restore
                await this.trackOperation(`restore-${path.basename(searchResult)}`, async () => {
                    return new Promise((resolve, reject) => {
                        const proc = this.spawnProcess('node', [
                            this.trashScriptPath,
                            'restore',
                            searchResult,
                            path.join(this.testFilesDir, `restored-${Date.now()}.txt`)
                        ], { captureOutput: true });
                        
                        proc.on('exit', (code) => {
                            if (code === 0) {
                                resolve();
                            } else {
                                reject(new Error(`Restore failed with code ${code}`));
                            }
                        });
                    });
                }).catch(() => {});
            }
            
            await this.sleep(Math.random() * 2000 + 1000);
        }
    }
    
    /**
     * Directory operations (create and trash directories)
     */
    async runDirectoryOperations(id) {
        let counter = 0;
        
        while (this.isRunning) {
            const dirname = `test-dir-${id}-${counter++}`;
            const dirpath = path.join(this.testFilesDir, dirname);
            
            // Create directory with files
            await this.trackOperation(`create-dir-${dirname}`, async () => {
                await fs.mkdir(dirpath, { recursive: true });
                
                // Add some files
                for (let i = 0; i < 5; i++) {
                    await fs.writeFile(
                        path.join(dirpath, `file-${i}.txt`),
                        `Content ${i}`
                    );
                }
                
                this.createdFiles.add(dirpath);
            }).catch(() => {});
            
            await this.sleep(Math.random() * 1000);
            
            // Trash directory
            await this.trackOperation(`trash-dir-${dirname}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.trashScriptPath,
                        'trash',
                        dirpath,
                        `Load test dir ${id}-${counter}`
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            this.createdFiles.delete(dirpath);
                            resolve();
                        } else {
                            reject(new Error(`Dir trash failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {});
            
            await this.sleep(Math.random() * 3000 + 2000);
        }
    }
    
    async stop() {
        await super.stop();
        
        // Cleanup created files
        for (const file of this.createdFiles) {
            try {
                await fs.unlink(file);
            } catch {
                try {
                    await fs.rm(file, { recursive: true, force: true });
                } catch {}
            }
        }
        
        // Remove test directory
        try {
            await fs.rm(this.testFilesDir, { recursive: true, force: true });
        } catch {}
    }
}

// CLI interface
if (require.main === module) {
    const test = new TrashOperationsLoadTest({
        concurrency: parseInt(process.argv[2]) || 20,
        duration: parseInt(process.argv[3]) || 30000
    });
    
    test.start().catch(console.error);
}

module.exports = TrashOperationsLoadTest;