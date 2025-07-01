#!/usr/bin/env node

/**
 * Test trash operations
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;

const execAsync = promisify(exec);

async function testTrashOperations() {
    console.log('🗑️  Testing Trash Operations\n');
    
    // Create test file
    const testFile = 'test-trash-file.txt';
    const testContent = 'This is test content for trash operations';
    await fs.writeFile(testFile, testContent);
    console.log(`✅ Created test file: ${testFile}`);
    
    // Test 1: Move to trash
    console.log('\nTest 1: Moving file to trash...');
    try {
        const { stdout: trashOutput } = await execAsync(
            `node .claude/scripts/safe-trash.js trash "${testFile}" "Testing trash operations"`
        );
        console.log(trashOutput);
    } catch (error) {
        console.error('Failed to trash file:', error.message);
        return;
    }
    
    // Test 2: Search for file
    console.log('\nTest 2: Searching for file in trash...');
    try {
        const { stdout: findOutput } = await execAsync(
            `node .claude/scripts/safe-trash.js find "${testFile}"`
        );
        console.log(findOutput);
        
        // Extract the trash path from output
        const pathMatch = findOutput.match(/^(.+\/trash\/.+\.txt)$/m);
        if (!pathMatch) {
            console.error('Could not find trash path in output');
            return;
        }
        
        const trashPath = pathMatch[1];
        console.log(`\nFound trash path: ${trashPath}`);
        
        // Test 3: Get info
        console.log('\nTest 3: Getting item info...');
        const { stdout: infoOutput } = await execAsync(
            `node .claude/scripts/safe-trash.js info "${trashPath}"`
        );
        console.log(infoOutput);
        
        // Test 4: Restore by search
        console.log('\nTest 4: Restoring by search pattern...');
        const { stdout: restoreOutput } = await execAsync(
            `node .claude/scripts/safe-trash.js restore "${testFile}"`
        );
        console.log(restoreOutput);
        
        // Check if file was restored
        try {
            const restoredContent = await fs.readFile(testFile, 'utf8');
            if (restoredContent === testContent) {
                console.log('✅ File restored successfully with correct content');
            } else {
                console.log('❌ File content mismatch after restore');
            }
        } catch (error) {
            console.log('❌ File was not restored');
        }
        
    } catch (error) {
        console.error('Search/restore failed:', error.message);
    }
    
    // Cleanup
    await fs.unlink(testFile).catch(() => {});
    
    console.log('\n✅ Trash operations test complete');
}

if (require.main === module) {
    testTrashOperations().catch(console.error);
}