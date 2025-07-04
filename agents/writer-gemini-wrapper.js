#!/usr/bin/env node

/**
 * Gemini Writer Wrapper
 * 
 * Wrapper para compatibilidade com orchestrator
 * Usa Google Gemini 2.5 Pro para geração de conteúdo
 */

const GeminiWriter = require('./writer-gemini');
const fs = require('fs').promises;
const path = require('path');

// CLI interface compatível com orchestrator
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Gemini Writer Wrapper

Usage:
  node writer-gemini-wrapper.js --outline <path> --chapter <number> [options]

Options:
  --outline <path>   Path to outline.json
  --chapter <n>      Chapter number to write
  --output <dir>     Output directory for chapters
  --style <type>     Writing style (conversational, professional, etc)
  --timeout <ms>     Timeout in milliseconds (default: 90000)
  --model <name>     Gemini model (default: gemini-2.5-pro)

Environment:
  GOOGLE_API_KEY     Required for Gemini API access
  GEMINI_API_KEY     Alternative env var for API key
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const options = {
        timeout: 90000, // 90 segundos default
        model: 'gemini-2.5-pro' // Modelo padrão: Gemini 2.5 Pro
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
            } else if (key === 'model') {
                options.model = value;
            }
        }
    }
    
    if (!options.outline || !options.chapter) {
        console.error('Error: --outline and --chapter are required');
        process.exit(1);
    }
    
    // Check API key
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚠️  GOOGLE_API_KEY/GEMINI_API_KEY not set, using fallback content');
    } else {
        console.log(`🔑 Using Gemini API with model: ${options.model}`);
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
            const writer = new GeminiWriter({
                style: options.style || 'conversational',
                bookType: outline.bookType || 'business',
                model: options.model
            });
            
            // Generate chapter
            const result = await writer.generateChapter(outline, options.chapter, {
                outputDir: options.outputDir
            });
            
            if (result.success) {
                console.log(`✅ Chapter saved to: ${result.path}`);
                
                // No need to create duplicate files - the writer already saves with proper naming
                
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

module.exports = GeminiWriter;