#!/usr/bin/env node

/**
 * Base Load Test Framework
 * Provides utilities for running concurrent load tests
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class LoadTestRunner {
    constructor(testName, options = {}) {
        this.testName = testName;
        this.concurrency = options.concurrency || 10;
        this.duration = options.duration || 60000; // 1 minute default
        this.warmup = options.warmup || 5000; // 5 second warmup
        this.reportInterval = options.reportInterval || 1000; // Report every second
        
        this.metrics = {
            startTime: null,
            endTime: null,
            operations: [],
            errors: [],
            performance: {
                min: Infinity,
                max: 0,
                avg: 0,
                p50: 0,
                p95: 0,
                p99: 0
            },
            resources: {
                cpu: [],
                memory: [],
                handles: []
            }
        };
        
        this.processes = [];
        this.isRunning = false;
    }
    
    /**
     * Start the load test
     */
    async start() {
        console.log(`\n🚀 Starting Load Test: ${this.testName}`);
        console.log(`   Concurrency: ${this.concurrency}`);
        console.log(`   Duration: ${this.duration / 1000}s`);
        console.log(`   Warmup: ${this.warmup / 1000}s\n`);
        
        this.metrics.startTime = Date.now();
        this.isRunning = true;
        
        // Start resource monitoring
        this.startResourceMonitoring();
        
        // Warmup phase
        console.log('⏳ Warmup phase...');
        await this.sleep(this.warmup);
        
        // Start reporting
        this.startReporting();
        
        // Run test
        console.log('🔥 Running load test...\n');
        const testPromise = this.runTest();
        
        // Stop after duration
        setTimeout(() => {
            this.stop();
        }, this.duration);
        
        await testPromise;
        
        this.metrics.endTime = Date.now();
        await this.generateReport();
    }
    
    /**
     * Override this method in subclasses
     */
    async runTest() {
        throw new Error('runTest() must be implemented by subclass');
    }
    
    /**
     * Spawn a process and track it
     */
    spawnProcess(command, args = [], options = {}) {
        const startTime = Date.now();
        const proc = spawn(command, args, {
            ...options,
            stdio: options.captureOutput ? 'pipe' : 'inherit'
        });
        
        const operation = {
            command,
            args,
            startTime,
            endTime: null,
            duration: null,
            exitCode: null,
            error: null,
            output: ''
        };
        
        if (options.captureOutput) {
            proc.stdout?.on('data', (data) => {
                operation.output += data.toString();
            });
            
            proc.stderr?.on('data', (data) => {
                operation.output += data.toString();
            });
        }
        
        proc.on('exit', (code) => {
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            operation.exitCode = code;
            
            if (code !== 0) {
                operation.error = `Process exited with code ${code}`;
                this.metrics.errors.push(operation);
            }
            
            this.metrics.operations.push(operation);
        });
        
        proc.on('error', (error) => {
            operation.error = error.message;
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            this.metrics.errors.push(operation);
            this.metrics.operations.push(operation);
        });
        
        this.processes.push(proc);
        return proc;
    }
    
    /**
     * Execute a function and track metrics
     */
    async trackOperation(name, fn) {
        const startTime = Date.now();
        const operation = {
            name,
            startTime,
            endTime: null,
            duration: null,
            error: null,
            result: null
        };
        
        try {
            operation.result = await fn();
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            this.metrics.operations.push(operation);
            return operation.result;
        } catch (error) {
            operation.error = error.message;
            operation.endTime = Date.now();
            operation.duration = operation.endTime - operation.startTime;
            this.metrics.errors.push(operation);
            this.metrics.operations.push(operation);
            throw error;
        }
    }
    
    /**
     * Start resource monitoring
     */
    startResourceMonitoring() {
        this.resourceInterval = setInterval(() => {
            const usage = process.cpuUsage();
            const mem = process.memoryUsage();
            
            this.metrics.resources.cpu.push({
                timestamp: Date.now(),
                user: usage.user,
                system: usage.system
            });
            
            this.metrics.resources.memory.push({
                timestamp: Date.now(),
                rss: mem.rss,
                heapTotal: mem.heapTotal,
                heapUsed: mem.heapUsed,
                external: mem.external
            });
            
            this.metrics.resources.handles.push({
                timestamp: Date.now(),
                count: process._getActiveHandles?.().length || 0
            });
        }, 1000);
    }
    
    /**
     * Start periodic reporting
     */
    startReporting() {
        this.reportInterval = setInterval(() => {
            const elapsed = (Date.now() - this.metrics.startTime) / 1000;
            const completed = this.metrics.operations.filter(op => op.endTime).length;
            const errors = this.metrics.errors.length;
            const inProgress = this.processes.filter(p => p.exitCode === null).length;
            
            const lastMem = this.metrics.resources.memory[this.metrics.resources.memory.length - 1];
            const memUsage = lastMem ? (lastMem.heapUsed / 1024 / 1024).toFixed(1) : 0;
            
            console.log(
                `[${elapsed.toFixed(1)}s] ` +
                `Completed: ${completed} | ` +
                `Errors: ${errors} | ` +
                `In Progress: ${inProgress} | ` +
                `Memory: ${memUsage}MB`
            );
        }, this.reportInterval);
    }
    
    /**
     * Stop the test
     */
    async stop() {
        console.log('\n⏹️  Stopping load test...');
        this.isRunning = false;
        
        // Stop monitoring
        clearInterval(this.resourceInterval);
        clearInterval(this.reportInterval);
        
        // Kill remaining processes
        for (const proc of this.processes) {
            if (proc.exitCode === null) {
                proc.kill('SIGTERM');
            }
        }
        
        // Wait for processes to exit
        await this.sleep(1000);
        
        // Force kill if needed
        for (const proc of this.processes) {
            if (proc.exitCode === null) {
                proc.kill('SIGKILL');
            }
        }
    }
    
    /**
     * Generate test report
     */
    async generateReport() {
        console.log('\n📊 Generating report...\n');
        
        const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
        const successful = this.metrics.operations.filter(op => !op.error).length;
        const failed = this.metrics.errors.length;
        const total = this.metrics.operations.length;
        
        // Calculate performance metrics
        const durations = this.metrics.operations
            .filter(op => op.duration && !op.error)
            .map(op => op.duration)
            .sort((a, b) => a - b);
        
        if (durations.length > 0) {
            this.metrics.performance.min = durations[0];
            this.metrics.performance.max = durations[durations.length - 1];
            this.metrics.performance.avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            this.metrics.performance.p50 = durations[Math.floor(durations.length * 0.5)];
            this.metrics.performance.p95 = durations[Math.floor(durations.length * 0.95)];
            this.metrics.performance.p99 = durations[Math.floor(durations.length * 0.99)];
        }
        
        // Peak memory usage
        const peakMemory = Math.max(...this.metrics.resources.memory.map(m => m.heapUsed));
        
        const report = {
            testName: this.testName,
            duration: `${duration.toFixed(1)}s`,
            concurrency: this.concurrency,
            operations: {
                total,
                successful,
                failed,
                successRate: `${((successful / total) * 100).toFixed(1)}%`,
                throughput: `${(total / duration).toFixed(1)} ops/sec`
            },
            performance: {
                min: `${this.metrics.performance.min}ms`,
                max: `${this.metrics.performance.max}ms`,
                avg: `${this.metrics.performance.avg.toFixed(1)}ms`,
                p50: `${this.metrics.performance.p50}ms`,
                p95: `${this.metrics.performance.p95}ms`,
                p99: `${this.metrics.performance.p99}ms`
            },
            resources: {
                peakMemory: `${(peakMemory / 1024 / 1024).toFixed(1)}MB`,
                avgHandles: Math.round(
                    this.metrics.resources.handles.reduce((a, b) => a + b.count, 0) / 
                    this.metrics.resources.handles.length
                )
            },
            errors: this.metrics.errors.slice(0, 10).map(e => ({
                command: e.command || e.name,
                error: e.error,
                duration: `${e.duration}ms`
            }))
        };
        
        // Print report
        console.log('=== LOAD TEST REPORT ===\n');
        console.log(`Test: ${report.testName}`);
        console.log(`Duration: ${report.duration}`);
        console.log(`Concurrency: ${report.concurrency}`);
        
        console.log('\nOperations:');
        console.log(`  Total: ${report.operations.total}`);
        console.log(`  Successful: ${report.operations.successful}`);
        console.log(`  Failed: ${report.operations.failed}`);
        console.log(`  Success Rate: ${report.operations.successRate}`);
        console.log(`  Throughput: ${report.operations.throughput}`);
        
        console.log('\nPerformance:');
        console.log(`  Min: ${report.performance.min}`);
        console.log(`  Max: ${report.performance.max}`);
        console.log(`  Avg: ${report.performance.avg}`);
        console.log(`  P50: ${report.performance.p50}`);
        console.log(`  P95: ${report.performance.p95}`);
        console.log(`  P99: ${report.performance.p99}`);
        
        console.log('\nResources:');
        console.log(`  Peak Memory: ${report.resources.peakMemory}`);
        console.log(`  Avg Handles: ${report.resources.avgHandles}`);
        
        if (report.errors.length > 0) {
            console.log('\nErrors (first 10):');
            report.errors.forEach((e, i) => {
                console.log(`  ${i + 1}. ${e.command}: ${e.error}`);
            });
        }
        
        // Save report
        const reportPath = path.join(
            __dirname,
            `load-test-report-${this.testName}-${Date.now()}.json`
        );
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Full report saved to: ${reportPath}`);
        
        return report;
    }
    
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Batch spawn helper
     */
    async spawnBatch(count, spawner) {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(spawner(i));
            // Small delay to avoid thundering herd
            await this.sleep(10);
        }
        return Promise.all(promises);
    }
}

module.exports = LoadTestRunner;