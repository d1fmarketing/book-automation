#!/usr/bin/env node

/**
 * Planner Wrapper
 * 
 * Wrapper para usar o planner real com CLI simples
 */

const Planner = require('./planner');
const fs = require('fs').promises;
const path = require('path');

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Planner Wrapper

Usage:
  node planner-wrapper.js <topic> [options]

Options:
  --output <path>    Output path for outline.json
  --chapters <n>     Number of chapters (default: 10)
  --style <type>     Book style (how-to, business, self-help, technical)
  --timeout <ms>     Timeout in milliseconds (default: 30000)
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const topic = args[0];
    const options = {
        chapters: 10,
        style: 'business',
        timeout: 30000
    };
    
    let outputPath = 'build/outline.json';
    
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'output') {
                outputPath = value;
            } else if (key === 'chapters') {
                options.chapters = parseInt(value);
            } else if (key === 'style') {
                options.style = value;
            } else if (key === 'timeout') {
                options.timeout = parseInt(value);
            }
        }
    }
    
    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Planner timeout after ${options.timeout}ms`)), options.timeout);
    });
    
    const plannerPromise = (async () => {
        try {
            console.log(`📋 Creating outline for: ${topic}`);
            console.log(`   Style: ${options.style}`);
            console.log(`   Chapters: ${options.chapters}`);
            
            const planner = new Planner({
                bookStyle: options.style,
                depth: 'intermediate'
            });
            
            const result = await planner.createOutline(topic, {
                chapters: options.chapters,
                outputDir: path.dirname(outputPath)
            });
            
            if (result.success) {
                // Save to specified output path
                await fs.mkdir(path.dirname(outputPath), { recursive: true });
                
                // Load the generated outline
                const outlineContent = await fs.readFile(result.path, 'utf8');
                await fs.writeFile(outputPath, outlineContent);
                
                console.log(`✅ Outline saved to: ${outputPath}`);
                return { success: true };
            } else {
                throw new Error(result.error || 'Planner failed');
            }
        } catch (error) {
            console.error(`❌ Planner error: ${error.message}`);
            throw error;
        }
    })();
    
    Promise.race([plannerPromise, timeoutPromise])
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(`❌ Fatal error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = Planner;