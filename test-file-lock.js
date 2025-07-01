#!/usr/bin/env node

/**
 * Test file locking for race conditions
 */

const FileLock = require('./.claude/scripts/file-lock');
const { spawn } = require('child_process');
const fs = require('fs').promises;

async function testConcurrentLocks() {
    console.log('🔒 Testing File Lock Race Conditions\n');
    
    const testFile = 'test-lock-target.txt';
    await fs.writeFile(testFile, 'test content');
    
    // Test 1: Two processes trying to acquire lock simultaneously
    console.log('Test 1: Concurrent lock acquisition');
    
    const results = [];
    const startTime = Date.now();
    
    // Spawn 3 child processes that try to acquire lock at same time
    for (let i = 0; i < 3; i++) {
        const child = spawn('node', ['-e', `
            const FileLock = require('./.claude/scripts/file-lock');
            const lock = new FileLock('${testFile}', { maxRetries: 5 });
            
            (async () => {
                const start = Date.now();
                try {
                    const acquired = await lock.acquire();
                    if (acquired) {
                        console.log('ACQUIRED:' + ${i} + ':' + (Date.now() - start));
                        // Hold lock for 1 second
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await lock.release();
                        console.log('RELEASED:' + ${i});
                    } else {
                        console.log('FAILED:' + ${i});
                    }
                } catch (error) {
                    console.log('ERROR:' + ${i} + ':' + error.message);
                }
            })();
        `]);
        
        child.stdout.on('data', (data) => {
            const msg = data.toString().trim();
            results.push(msg);
            console.log(`  Process ${i}: ${msg}`);
        });
        
        child.stderr.on('data', (data) => {
            console.error(`  Process ${i} ERROR: ${data}`);
        });
    }
    
    // Wait for all processes to complete
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Analyze results
    const acquired = results.filter(r => r.startsWith('ACQUIRED')).length;
    const failed = results.filter(r => r.startsWith('FAILED') || r.startsWith('ERROR')).length;
    
    console.log(`\nResults: ${acquired} acquired, ${failed} failed`);
    
    if (acquired === 1 && failed >= 2) {
        console.log('✅ PASS: Only one process acquired lock');
    } else {
        console.log('❌ FAIL: Multiple processes acquired lock or unexpected results');
    }
    
    // Cleanup
    await fs.unlink(testFile).catch(() => {});
    await fs.unlink(testFile + '.lock').catch(() => {});
    
    // Test 2: Rapid sequential acquisition
    console.log('\nTest 2: Rapid sequential lock/unlock');
    
    const lock = new FileLock(testFile);
    let successCount = 0;
    
    for (let i = 0; i < 10; i++) {
        if (await lock.acquire()) {
            successCount++;
            await lock.release();
        }
    }
    
    console.log(`  Successful lock/unlock cycles: ${successCount}/10`);
    console.log(successCount === 10 ? '✅ PASS' : '❌ FAIL');
    
    // Test 3: Stale lock cleanup
    console.log('\nTest 3: Stale lock detection');
    
    // Create a stale lock
    const staleLock = {
        pid: 99999,
        hostname: 'fake-host',
        timestamp: Date.now() - 60000, // 1 minute old
        file: testFile
    };
    await fs.writeFile(testFile + '.lock', JSON.stringify(staleLock));
    
    const lock2 = new FileLock(testFile, { timeout: 30000 });
    const acquired2 = await lock2.acquire();
    
    console.log(acquired2 ? '✅ PASS: Stale lock was cleaned' : '❌ FAIL: Could not clean stale lock');
    
    if (acquired2) {
        await lock2.release();
    }
    
    // Final cleanup
    await fs.unlink(testFile).catch(() => {});
    await fs.unlink(testFile + '.lock').catch(() => {});
    
    console.log('\n🎯 File lock testing complete');
}

if (require.main === module) {
    testConcurrentLocks().catch(console.error);
}