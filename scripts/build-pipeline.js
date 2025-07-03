#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runCommand(command, args = [], description = '') {
    console.log(`\n🚀 ${description || command}`);
    
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { 
            shell: true,
            stdio: 'inherit',
            env: { ...process.env, PYTHONPATH: `src:/Users/d1f/Library/Python/3.9/lib/python/site-packages` }
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${description || command} completed`);
                resolve(code);
            } else {
                console.log(`❌ ${description || command} failed with code ${code}`);
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        proc.on('error', (err) => {
            console.log(`❌ Error: ${err.message}`);
            reject(err);
        });
    });
}

async function runPipeline() {
    console.log('\n🤖 Simplified Pipeline - Generating PDF');
    console.log('=' .repeat(50));

    try {
        // Run content agent
        await runCommand(
            '/usr/bin/python3',
            ['-m', 'src.ebook_pipeline.agents.content_agent_enhanced', 'pipeline-book'],
            'Content Agent - Processing chapters and generating images'
        );

        // Run build script
        await runCommand(
            'node',
            ['scripts/generate-pdf-unified.js', '--preset=main'],
            'Build Script - Generating PDF'
        );

        console.log('\n✨ PIPELINE COMPLETED SUCCESSFULLY! ✨');
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

runPipeline();

