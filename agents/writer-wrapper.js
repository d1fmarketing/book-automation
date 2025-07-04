#!/usr/bin/env node

/**
 * Writer Wrapper
 * 
 * Wrapper para compatibilidade com orchestrator
 */

const { Writer } = require('./writer.js');
const fs = require('fs').promises;
const path = require('path');

// CLI interface compatível com orchestrator-debug
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Writer Wrapper

Usage:
  node writer-wrapper.js --outline <path> --chapter <number> [options]

Options:
  --outline <path>   Path to outline.json
  --chapter <n>      Chapter number to write
  --output <dir>     Output directory for chapters
  --style <type>     Writing style (conversational, professional, etc)
  --timeout <ms>     Timeout in milliseconds (default: 90000)

Environment:
  ANTHROPIC_API_KEY   Required for real content generation
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const options = {
        timeout: 90000 // 90 segundos default
    };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'outline') {
                options.outline = value;
            } else if (key === 'chapter') {
                options.chapter = parseInt(value);
            } else if (key === 'output') {
                options.outputDir = value;
            } else if (key === 'style') {
                options.style = value;
            } else if (key === 'timeout') {
                options.timeout = parseInt(value);
            }
        }
    }
    
    if (!options.outline || !options.chapter) {
        console.error('Error: --outline and --chapter are required');
        process.exit(1);
    }
    
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  ANTHROPIC_API_KEY not set, using fallback content');
    }
    
    // Execute with timeout
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Writer timeout after ${options.timeout}ms`)), options.timeout);
    });
    
    const writerPromise = (async () => {
        try {
            // Load outline
            const outline = JSON.parse(await fs.readFile(options.outline, 'utf8'));
            
            // Set output directory in outline if specified
            if (options.outputDir) {
                outline.outputDir = options.outputDir;
            }
            
            // Create writer instance
            const writer = new Writer({
                style: options.style || 'conversational',
                bookType: outline.bookType || 'business'
            });
            
            // Generate chapter
            const result = await writer.generateChapter(outline, options.chapter, {
                outputDir: options.outputDir
            });
            
            if (result.success) {
                console.log(`✅ Chapter saved to: ${result.path}`);
                
                // Ensure it's saved in the expected location for orchestrator
                if (options.outputDir && result.path) {
                    const expectedPath = path.join(options.outputDir, `chapter-${options.chapter}.md`);
                    if (result.path !== expectedPath) {
                        await fs.mkdir(options.outputDir, { recursive: true });
                        await fs.copyFile(result.path, expectedPath);
                        console.log(`📋 Copied to: ${expectedPath}`);
                    }
                }
                
                return { success: true };
            } else {
                throw new Error(result.error || 'Writer failed');
            }
        } catch (error) {
            console.error(`❌ Writer error: ${error.message}`);
            throw error;
        }
    })();
    
    Promise.race([writerPromise, timeoutPromise])
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(`❌ Fatal error: ${error.message}`);
            process.exit(1);
        });
}

module.exports = Writer;