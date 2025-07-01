#!/usr/bin/env node

/**
 * Simple file-based locking mechanism
 * Prevents concurrent access to critical files
 */

const fs = require('fs').promises;
const path = require('path');

class FileLock {
    constructor(filePath, options = {}) {
        this.filePath = filePath;
        this.lockPath = filePath + '.lock';
        this.timeout = options.timeout || 30000; // 30 seconds default
        this.retryInterval = options.retryInterval || 100; // 100ms
        this.maxRetries = options.maxRetries || 50; // 5 seconds total
        this.pid = process.pid;
        this.hostname = require('os').hostname();
    }

    /**
     * Acquire lock with retry logic
     */
    async acquire() {
        let retries = 0;
        
        while (retries < this.maxRetries) {
            try {
                // Try to create lock file exclusively
                await this.createLock();
                return true;
            } catch (error) {
                // Lock exists, check if it's stale
                if (await this.isLockStale()) {
                    await this.forceUnlock();
                    continue;
                }
                
                // Wait and retry
                retries++;
                if (retries >= this.maxRetries) {
                    throw new Error(`Failed to acquire lock after ${retries} attempts`);
                }
                
                await this.sleep(this.retryInterval * Math.min(retries, 10)); // Exponential backoff
            }
        }
        
        return false;
    }

    /**
     * Create lock file atomically
     */
    async createLock() {
        const lockData = {
            pid: this.pid,
            hostname: this.hostname,
            timestamp: Date.now(),
            file: this.filePath
        };
        
        // Use exclusive flag to prevent race conditions
        await fs.writeFile(this.lockPath, JSON.stringify(lockData, null, 2), { flag: 'wx' });
    }

    /**
     * Check if lock is stale (older than timeout)
     */
    async isLockStale() {
        try {
            const lockContent = await fs.readFile(this.lockPath, 'utf8');
            const lockData = JSON.parse(lockContent);
            
            const age = Date.now() - lockData.timestamp;
            
            // Check if lock is too old
            if (age > this.timeout) {
                return true;
            }
            
            // Check if process is still running (same host only)
            if (lockData.hostname === this.hostname) {
                return !this.isProcessRunning(lockData.pid);
            }
            
            return false;
        } catch {
            // Can't read lock file, assume it's stale
            return true;
        }
    }

    /**
     * Check if a process is running
     */
    isProcessRunning(pid) {
        try {
            // Send signal 0 to check if process exists
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Release lock
     */
    async release() {
        try {
            // Verify we own the lock before releasing
            const lockContent = await fs.readFile(this.lockPath, 'utf8');
            const lockData = JSON.parse(lockContent);
            
            if (lockData.pid === this.pid && lockData.hostname === this.hostname) {
                await fs.unlink(this.lockPath);
                return true;
            } else {
                console.warn('Attempted to release lock not owned by this process');
                return false;
            }
        } catch (error) {
            // Lock doesn't exist or can't be read
            return false;
        }
    }

    /**
     * Force unlock (use with caution)
     */
    async forceUnlock() {
        try {
            await fs.unlink(this.lockPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Execute function with lock
     */
    async withLock(fn) {
        let lockAcquired = false;
        
        try {
            lockAcquired = await this.acquire();
            
            if (!lockAcquired) {
                throw new Error('Failed to acquire lock');
            }
            
            // Execute the function
            const result = await fn();
            
            return result;
        } finally {
            if (lockAcquired) {
                await this.release();
            }
        }
    }

    /**
     * Get lock info
     */
    async getLockInfo() {
        try {
            const lockContent = await fs.readFile(this.lockPath, 'utf8');
            const lockData = JSON.parse(lockContent);
            
            return {
                ...lockData,
                age: Date.now() - lockData.timestamp,
                isStale: await this.isLockStale()
            };
        } catch {
            return null;
        }
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Clean up stale locks in a directory
     */
    static async cleanStaleLocks(directory, timeout = 30000) {
        try {
            const files = await fs.readdir(directory);
            const lockFiles = files.filter(f => f.endsWith('.lock'));
            
            let cleaned = 0;
            
            for (const lockFile of lockFiles) {
                const lockPath = path.join(directory, lockFile);
                const lock = new FileLock(lockPath.replace('.lock', ''), { timeout });
                
                if (await lock.isLockStale()) {
                    await lock.forceUnlock();
                    cleaned++;
                }
            }
            
            return cleaned;
        } catch (error) {
            console.error('Error cleaning stale locks:', error);
            return 0;
        }
    }
}

// CLI interface for testing
if (require.main === module) {
    const command = process.argv[2];
    const filePath = process.argv[3];
    
    if (!command || !filePath) {
        console.log(`
File Lock Utility

Usage:
  node file-lock.js <command> <file>

Commands:
  acquire <file>    Acquire lock on file
  release <file>    Release lock on file
  info <file>       Show lock information
  test <file>       Test lock with concurrent access
  clean <dir>       Clean stale locks in directory
        `);
        process.exit(1);
    }
    
    const lock = new FileLock(filePath);
    
    (async () => {
        switch (command) {
            case 'acquire':
                if (await lock.acquire()) {
                    console.log('✅ Lock acquired');
                    console.log('Press Ctrl+C to release...');
                    
                    // Keep process running
                    process.on('SIGINT', async () => {
                        await lock.release();
                        console.log('Lock released');
                        process.exit(0);
                    });
                    
                    // Prevent exit
                    await new Promise(() => {});
                } else {
                    console.log('❌ Failed to acquire lock');
                }
                break;
                
            case 'release':
                if (await lock.release()) {
                    console.log('✅ Lock released');
                } else {
                    console.log('❌ Failed to release lock');
                }
                break;
                
            case 'info':
                const info = await lock.getLockInfo();
                if (info) {
                    console.log('Lock Information:');
                    console.log(JSON.stringify(info, null, 2));
                } else {
                    console.log('No lock found');
                }
                break;
                
            case 'test':
                console.log('Testing concurrent access...');
                
                // Simulate concurrent access
                const promises = [];
                for (let i = 0; i < 5; i++) {
                    promises.push(
                        lock.withLock(async () => {
                            console.log(`Process ${i} has lock`);
                            await lock.sleep(1000);
                            console.log(`Process ${i} releasing lock`);
                        }).catch(err => console.log(`Process ${i} failed: ${err.message}`))
                    );
                }
                
                await Promise.all(promises);
                console.log('Test complete');
                break;
                
            case 'clean':
                const cleaned = await FileLock.cleanStaleLocks(filePath);
                console.log(`Cleaned ${cleaned} stale locks`);
                break;
        }
    })().catch(console.error);
}

module.exports = FileLock;