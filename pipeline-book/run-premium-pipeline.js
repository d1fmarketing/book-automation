#!/usr/bin/env node

/**
 * Premium Pipeline Runner - Executes the full 5-agent pipeline with visual enhancements
 * This creates a professional, visually stunning ebook
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

async function runPremiumPipeline() {
    console.log('🎨 Starting Premium Ebook Pipeline with Visual Enhancements');
    console.log('===========================================================\n');
    
    // Check if we're in the right directory
    const cwd = process.cwd();
    const pipelineBookPath = path.join(cwd, 'pipeline-book');
    
    // Change to parent directory to access Python modules
    process.chdir(path.dirname(cwd));
    
    try {
        // Run the premium pipeline controller
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        
        const pipelineProcess = spawn(pythonCmd, [
            '-m', 'src.ebook_pipeline.pipeline_controller_premium',
            'pipeline-book',  // Project path
            '--publish', 'local', 'kdp' // Publishing platforms
        ], {
            stdio: 'inherit',
            env: { ...process.env, PYTHONPATH: '.' }
        });
        
        // Handle process completion
        await new Promise((resolve, reject) => {
            pipelineProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Pipeline process exited with code ${code}`));
                }
            });
            
            pipelineProcess.on('error', (err) => {
                reject(err);
            });
        });
        
        console.log('\n✅ Premium Pipeline completed successfully!');
        
        // Show results
        const metricsDir = path.join(pipelineBookPath, 'build', 'metrics');
        const files = await fs.readdir(metricsDir);
        const latestMetric = files
            .filter(f => f.startsWith('premium_pipeline_'))
            .sort()
            .pop();
            
        if (latestMetric) {
            const metricsPath = path.join(metricsDir, latestMetric);
            const metrics = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
            
            console.log('\n📊 Pipeline Metrics:');
            console.log(`   Total Time: ${metrics.total_time.toFixed(2)} seconds`);
            console.log(`   Quality Attempts: ${metrics.quality_attempts}`);
            console.log(`   Quality Passed: ${metrics.quality_passed ? '✅' : '❌'}`);
            
            console.log('\n🎨 Premium Features Applied:');
            Object.entries(metrics.premium_features).forEach(([feature, enabled]) => {
                console.log(`   ${enabled ? '✅' : '❌'} ${feature.replace(/_/g, ' ')}`);
            });
            
            console.log('\n📕 Output Files:');
            console.log(`   PDF: ${metrics.pdf_path}`);
            
            if (metrics.published_to && metrics.published_to.length > 0) {
                console.log(`   Published to: ${metrics.published_to.join(', ')}`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Premium Pipeline failed:', error.message);
        process.exit(1);
    } finally {
        // Change back to original directory
        process.chdir(cwd);
    }
}

// Run if called directly
if (require.main === module) {
    runPremiumPipeline().catch(console.error);
}

module.exports = { runPremiumPipeline };