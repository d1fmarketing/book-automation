#!/usr/bin/env node

/**
 * Quick smoke test for critical components
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`✅ ${name}`);
            passed++;
        } else {
            console.log(`❌ ${name}`);
            failed++;
        }
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        failed++;
    }
}

console.log('🚀 Quick Smoke Test\n');

// 1. Core dependencies
test('Node.js v20+', () => {
    const version = process.version;
    return version.startsWith('v20') || version.startsWith('v21');
});

test('Redis running', () => {
    const { execSync } = require('child_process');
    try {
        execSync('pgrep redis-server', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
});

// 2. Project structure
test('Agents directory exists', () => fs.existsSync('agents'));
test('Scripts directory exists', () => fs.existsSync('scripts'));
test('Queue system exists', () => fs.existsSync('src/queue/QueueManager.js'));
test('Workers directory exists', () => fs.existsSync('src/workers'));

// 3. Key files
test('.env file exists', () => fs.existsSync('.env'));
test('Hybrid orchestrator exists', () => fs.existsSync('scripts/orchestrator-hybrid.js'));
test('Refurbish worker exists', () => fs.existsSync('src/workers/refurbish-worker.js'));
test('Import blacklist exists', () => fs.existsSync('scripts/import-blacklist.js'));
test('Ultra-QA tests exist', () => fs.existsSync('tests/ultra-qa/index.js'));
test('Admin dashboard exists', () => fs.existsSync('admin/server.js'));

// 4. Key agents
const agents = ['planner', 'writer', 'formatter-html-clean', 'illustrator', 'affiliate-injector'];
agents.forEach(agent => {
    test(`Agent ${agent} exists`, () => 
        fs.existsSync(`agents/${agent}.js`) || 
        fs.existsSync(`agents/${agent}-wrapper.js`) ||
        fs.existsSync(`agents/${agent}-debug.js`)
    );
});

// 5. Queue configuration
test('Queue config includes refurbish', () => {
    try {
        const queueManager = fs.readFileSync('src/queue/QueueManager.js', 'utf8');
        return queueManager.includes('refurbish:');
    } catch {
        return false;
    }
});

// 6. Test imports
test('Can load QueueManager', () => {
    try {
        require('../src/queue/QueueManager');
        return true;
    } catch {
        return false;
    }
});

test('Can load RefurbishWorker', () => {
    try {
        require('../src/workers/refurbish-worker');
        return true;
    } catch {
        return false;
    }
});

// Summary
console.log('\n📊 Summary:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);
console.log(`   Pass Rate: ${Math.round(passed / (passed + failed) * 100)}%`);

if (failed === 0) {
    console.log('\n✨ All tests passed!');
    process.exit(0);
} else {
    console.log('\n⚠️  Some tests failed');
    process.exit(1);
}