#!/usr/bin/env node

/**
 * Load Test: Concurrent State Operations
 * Tests file locking and state consistency under heavy concurrent load
 */

const LoadTestRunner = require('./base-load-test');
const { spawn } = require('child_process');
const path = require('path');

class StateOperationsLoadTest extends LoadTestRunner {
    constructor(options = {}) {
        super('state-operations', {
            concurrency: options.concurrency || 20,
            duration: options.duration || 30000, // 30 seconds
            ...options
        });
        
        this.stateManagerPath = path.join(__dirname, '..', '.claude', 'scripts', 'pipeline-state-manager.js');
        this.operations = [
            'start-phase',
            'complete-phase', 
            'checkpoint',
            'update-metrics',
            'validate'
        ];
        this.phases = ['writer', 'illustrator', 'builder', 'qa', 'publisher'];
    }
    
    async runTest() {
        // Mix of different concurrent operations
        const tasks = [];
        
        // Group 1: Rapid phase transitions (10 processes)
        for (let i = 0; i < 10; i++) {
            tasks.push(this.runPhaseTransitions(i));
        }
        
        // Group 2: Checkpoint creators (5 processes)
        for (let i = 0; i < 5; i++) {
            tasks.push(this.runCheckpointCreation(i));
        }
        
        // Group 3: State readers (5 processes)
        for (let i = 0; i < 5; i++) {
            tasks.push(this.runStateReading(i));
        }
        
        await Promise.all(tasks);
    }
    
    /**
     * Rapid phase start/complete cycles
     */
    async runPhaseTransitions(id) {
        while (this.isRunning) {
            const phase = this.phases[Math.floor(Math.random() * this.phases.length)];
            
            // Start phase
            await this.trackOperation(`start-${phase}-${id}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.stateManagerPath,
                        'start',
                        phase
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Start phase failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {}); // Ignore errors for load test
            
            // Small delay
            await this.sleep(Math.random() * 100);
            
            // Complete phase
            await this.trackOperation(`complete-${phase}-${id}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.stateManagerPath,
                        'complete',
                        phase,
                        JSON.stringify({ test: true, id })
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Complete phase failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {}); // Ignore errors for load test
            
            await this.sleep(Math.random() * 500);
        }
    }
    
    /**
     * Create checkpoints frequently
     */
    async runCheckpointCreation(id) {
        let counter = 0;
        
        while (this.isRunning) {
            await this.trackOperation(`checkpoint-${id}-${counter++}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.stateManagerPath,
                        'checkpoint',
                        `load-test-${id}-${counter}`
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Checkpoint failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {}); // Ignore errors for load test
            
            await this.sleep(Math.random() * 2000 + 1000); // 1-3 seconds
        }
    }
    
    /**
     * Continuously read state
     */
    async runStateReading(id) {
        while (this.isRunning) {
            await this.trackOperation(`status-${id}`, async () => {
                return new Promise((resolve, reject) => {
                    const proc = this.spawnProcess('node', [
                        this.stateManagerPath,
                        'status'
                    ], { captureOutput: true });
                    
                    proc.on('exit', (code) => {
                        if (code === 0) {
                            resolve();
                        } else {
                            reject(new Error(`Status read failed with code ${code}`));
                        }
                    });
                });
            }).catch(() => {}); // Ignore errors for load test
            
            await this.sleep(Math.random() * 200); // Rapid reads
        }
    }
}

// CLI interface
if (require.main === module) {
    const test = new StateOperationsLoadTest({
        concurrency: parseInt(process.argv[2]) || 20,
        duration: parseInt(process.argv[3]) || 30000
    });
    
    test.start().catch(console.error);
}

module.exports = StateOperationsLoadTest;