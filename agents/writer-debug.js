#!/usr/bin/env node

/**
 * Writer Agent - Debug Version
 * 
 * Simple test version for debugging the pipeline
 */

const fs = require('fs').promises;
const path = require('path');

class WriterDebug {
    async writeChapter(outline, chapterNumber, options = {}) {
        console.log(`✍️  Writing debug chapter ${chapterNumber}`);
        
        // Load outline if it's a path
        if (typeof outline === 'string') {
            outline = JSON.parse(await fs.readFile(outline, 'utf8'));
        }
        
        const chapter = outline.chapters.find(ch => ch.number === chapterNumber);
        if (!chapter) {
            throw new Error(`Chapter ${chapterNumber} not found in outline`);
        }
        
        // Generate test content
        let content = `# ${chapter.title}\n\n`;
        content += `${chapter.description || chapter.summary || ''}\n\n`;
        
        // Add sections or key points
        const sections = chapter.sections || chapter.keyPoints || ['Introduction', 'Main Content', 'Summary'];
        for (const section of sections) {
            content += `## ${section}\n\n`;
            content += `This is the content for ${section}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. `;
            content += `Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n`;
            
            // Add some variety
            if (section.includes('Introduction')) {
                content += `In this section, we'll explore the fundamentals of ${chapter.title.toLowerCase()}. `;
                content += `You'll learn the key concepts that form the foundation of our discussion.\n\n`;
            } else if (section.includes('Core Concepts')) {
                content += `### Key Concept 1\n\nFirst important concept explained here.\n\n`;
                content += `### Key Concept 2\n\nSecond important concept explained here.\n\n`;
            } else if (section.includes('Practical')) {
                content += `Here's a practical example:\n\n`;
                content += `\`\`\`javascript\n// Example code\nfunction example() {\n    console.log("Hello, World!");\n}\n\`\`\`\n\n`;
            }
        }
        
        // Add conclusion
        content += `## Chapter Summary\n\n`;
        content += `In this chapter, we covered the essential aspects of ${chapter.title.toLowerCase()}. `;
        content += `Remember these key takeaways as you move forward.\n`;
        
        // Save the chapter
        const outputDir = options.outputDir || path.dirname(outline.path || 'build');
        const chapterPath = path.join(outputDir, `chapter-${chapterNumber}.md`);
        
        await fs.mkdir(outputDir, { recursive: true });
        await fs.writeFile(chapterPath, content);
        
        console.log(`✅ Debug chapter saved to: ${chapterPath}`);
        
        return {
            success: true,
            path: chapterPath,
            wordCount: content.split(/\s+/).length
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Writer Debug Agent

Usage:
  node writer-debug.js --outline <path> --chapter <number> [options]

Options:
  --outline <path>   Path to outline.json
  --chapter <n>      Chapter number to write
  --output <dir>     Output directory for chapters
        `);
        process.exit(0);
    }
    
    // Parse arguments
    const options = {};
    
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
            }
        }
    }
    
    if (!options.outline || !options.chapter) {
        console.error('Error: --outline and --chapter are required');
        process.exit(1);
    }
    
    const writer = new WriterDebug();
    
    writer.writeChapter(options.outline, options.chapter, options)
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

module.exports = WriterDebug;