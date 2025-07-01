#!/usr/bin/env node

const SafeTrash = require('./.claude/scripts/safe-trash');

async function testSearch() {
    console.log('Testing trash search...\n');
    
    const trash = new SafeTrash();
    console.log('Trash root:', trash.trashRoot);
    
    // Direct search
    const results = await trash.findInTrash('test-trash-file');
    
    console.log(`Found ${results.length} results`);
    
    if (results.length > 0) {
        results.forEach(r => {
            console.log('\nResult:');
            console.log('  Path:', r.path);
            console.log('  Name:', r.name);
            console.log('  Original Name:', r.originalName);
            console.log('  Metadata:', r.metadata);
        });
    }
    
    // Also try to list what's in trash
    console.log('\n\nListing trash contents:');
    const fs = require('fs').promises;
    const path = require('path');
    
    async function listDir(dir, indent = '') {
        try {
            const items = await fs.readdir(dir);
            for (const item of items) {
                console.log(indent + item);
                const fullPath = path.join(dir, item);
                const stats = await fs.stat(fullPath);
                if (stats.isDirectory() && !item.endsWith('.meta')) {
                    await listDir(fullPath, indent + '  ');
                }
            }
        } catch (error) {
            console.log(indent + '(error: ' + error.message + ')');
        }
    }
    
    await listDir(trash.trashRoot);
}

testSearch().catch(console.error);