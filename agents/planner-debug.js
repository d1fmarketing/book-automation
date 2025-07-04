#!/usr/bin/env node

/**
 * Planner Agent - Debug Version
 * 
 * Simple test version for debugging the pipeline
 */

const fs = require('fs').promises;
const path = require('path');

class PlannerDebug {
    async createOutline(topic, options = {}) {
        console.log(`📋 Creating debug outline for: ${topic}`);
        
        const outline = {
            title: topic,
            author: options.author || "Test Author",
            description: `A comprehensive guide to ${topic}`,
            language: "en",
            theme: "business",
            chapters: []
        };
        
        // Generate simple test chapters
        const chapterCount = options.chapters || 5;
        for (let i = 1; i <= chapterCount; i++) {
            outline.chapters.push({
                number: i,
                title: `Chapter ${i}: ${topic} Part ${i}`,
                description: `Learn about ${topic} in chapter ${i}`,
                keyPoints: [
                    `Introduction to Part ${i}`,
                    `Core Concepts`,
                    `Practical Applications`,
                    `Summary`
                ],
                sections: [
                    `Introduction to Part ${i}`,
                    `Core Concepts`,
                    `Practical Applications`,
                    `Summary`
                ]
            });
        }
        
        // Save the outline
        const outputPath = options.outputPath || 'build/outline.json';
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, JSON.stringify(outline, null, 2));
        
        console.log(`✅ Debug outline saved to: ${outputPath}`);
        
        return {
            success: true,
            path: outputPath,
            outline: outline
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Planner Debug Agent

Usage:
  node planner-debug.js <topic> [options]

Options:
  --output <path>    Output path for outline.json
  --chapters <n>     Number of chapters (default: 5)
  --author <name>    Author name
        `);
        process.exit(0);
    }
    
    // Parse arguments
    let topic = null;
    const options = {};
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'output') {
                options.outputPath = value;
            } else if (key === 'chapters') {
                options.chapters = parseInt(value);
            } else if (key === 'author') {
                options.author = value;
            }
        } else if (!topic) {
            topic = arg;
        }
    }
    
    if (!topic) {
        console.error('Error: Topic is required');
        process.exit(1);
    }
    
    const planner = new PlannerDebug();
    
    planner.createOutline(topic, options)
        .then(result => {
            if (!result.success) {
                console.error('Failed:', result.error);
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = PlannerDebug;