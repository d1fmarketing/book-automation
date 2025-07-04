#!/usr/bin/env node

/**
 * Writer Agent
 * 
 * High-quality content generation using Claude Opus 4.
 * Generates chapter-by-chapter content with context awareness and consistency.
 * 
 * Usage:
 *   agentcli call writer.generate --outline="path/to/outline.json" --chapter=1
 *   node agents/writer.js --outline="outline.json" --style="conversational"
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const yaml = require('js-yaml');

// Writing styles and configurations
const WRITING_STYLES = {
    conversational: {
        tone: "friendly and engaging",
        readingLevel: "8th grade",
        sentenceLength: "varied, mostly short",
        examples: "personal anecdotes and relatable scenarios",
        voice: "active voice, direct address (you/your)"
    },
    professional: {
        tone: "authoritative and informative",
        readingLevel: "college level",
        sentenceLength: "medium to complex",
        examples: "case studies and industry examples",
        voice: "mix of active and passive, third person"
    },
    academic: {
        tone: "scholarly and analytical",
        readingLevel: "graduate level",
        sentenceLength: "complex with subordinate clauses",
        examples: "research citations and data",
        voice: "primarily passive voice, formal"
    },
    storytelling: {
        tone: "narrative and immersive",
        readingLevel: "general audience",
        sentenceLength: "varied for rhythm",
        examples: "stories and metaphors",
        voice: "active voice, descriptive"
    }
};

// Chapter templates for different book types
const CHAPTER_TEMPLATES = {
    howTo: {
        structure: ["Introduction", "Problem Overview", "Step-by-Step Solution", "Common Mistakes", "Advanced Tips", "Action Steps"],
        wordCount: { min: 2000, target: 3000, max: 4000 }
    },
    business: {
        structure: ["Hook", "Core Concept", "Real-World Application", "Case Studies", "Implementation", "Key Takeaways"],
        wordCount: { min: 2500, target: 3500, max: 4500 }
    },
    selfHelp: {
        structure: ["Opening Story", "Main Principle", "Why It Matters", "How to Apply", "Exercises", "Chapter Summary"],
        wordCount: { min: 2000, target: 2500, max: 3000 }
    },
    technical: {
        structure: ["Overview", "Background", "Core Concepts", "Implementation", "Code Examples", "Best Practices", "Summary"],
        wordCount: { min: 3000, target: 4000, max: 5000 }
    }
};

class Writer {
    constructor(options = {}) {
        this.style = options.style || 'conversational';
        this.model = options.model || 'opus-4';
        this.bookType = options.bookType || 'howTo';
        this.includeResearch = options.includeResearch !== false;
        this.contextWindow = options.contextWindow || 3; // Remember last 3 chapters
    }

    async generateChapter(outline, chapterNumber, options = {}) {
        console.log(`✍️  Writing Chapter ${chapterNumber}: ${outline.chapters[chapterNumber - 1].title}`);
        
        try {
            // Load context (previous chapters, research, etc.)
            const context = await this.loadContext(outline, chapterNumber);
            
            // Get chapter details
            const chapter = outline.chapters[chapterNumber - 1];
            const template = CHAPTER_TEMPLATES[this.bookType];
            const style = WRITING_STYLES[this.style];
            
            // Create writing prompt
            const prompt = this.createChapterPrompt(chapter, context, style, template, options);
            
            // Generate content
            const content = await this.callClaude(prompt);
            
            // Validate and enhance content
            const enhanced = await this.enhanceContent(content, chapter, context);
            
            // Save chapter
            const chapterPath = await this.saveChapter(enhanced, outline, chapterNumber);
            
            // Update context for next chapters
            await this.updateContext(outline, chapterNumber, enhanced);
            
            console.log(`✅ Chapter ${chapterNumber} completed: ${this.getWordCount(enhanced)} words`);
            
            return {
                success: true,
                chapterNumber,
                title: chapter.title,
                wordCount: this.getWordCount(enhanced),
                path: chapterPath,
                content: enhanced
            };
            
        } catch (error) {
            console.error(`❌ Error writing chapter ${chapterNumber}: ${error.message}`);
            return {
                success: false,
                chapterNumber,
                error: error.message
            };
        }
    }

    async loadContext(outline, currentChapter) {
        const context = {
            bookTitle: outline.title,
            bookTheme: outline.theme || 'general',
            targetAudience: outline.targetAudience || 'general readers',
            previousChapters: [],
            research: null,
            guidelines: outline.guidelines || []
        };
        
        // Load previous chapters for context
        const startChapter = Math.max(1, currentChapter - this.contextWindow);
        for (let i = startChapter; i < currentChapter; i++) {
            try {
                const chapterFile = `chapter-${String(i).padStart(2, '0')}.md`;
                const chapterPath = path.join(outline.outputDir || 'chapters', chapterFile);
                const content = await fs.readFile(chapterPath, 'utf8');
                
                context.previousChapters.push({
                    number: i,
                    title: outline.chapters[i - 1].title,
                    summary: this.summarizeChapter(content)
                });
            } catch (error) {
                // Chapter doesn't exist yet
            }
        }
        
        // Load research if available
        try {
            const researchPath = path.join('context', 'research.yaml');
            const researchContent = await fs.readFile(researchPath, 'utf8');
            context.research = yaml.load(researchContent);
        } catch (error) {
            // No research available
        }
        
        return context;
    }

    createChapterPrompt(chapter, context, style, template, options) {
        const previousContext = context.previousChapters.length > 0
            ? `\nPREVIOUS CHAPTERS CONTEXT:\n${context.previousChapters.map(ch => 
                `Chapter ${ch.number} - ${ch.title}: ${ch.summary}`
              ).join('\n\n')}`
            : '';
        
        const researchContext = context.research
            ? `\nRESEARCH INSIGHTS:\n- ${context.research.bullets.join('\n- ')}\n\nRelevant Sources:\n${context.research.links.slice(0, 3).join('\n')}`
            : '';
        
        const structureGuide = template.structure.map((section, i) => 
            `${i + 1}. ${section}`
        ).join('\n');
        
        return `You are an expert writer creating Chapter ${chapter.number} of a ${context.bookTheme} book titled "${context.bookTitle}".

CHAPTER DETAILS:
Title: ${chapter.title}
Key Points to Cover:
${chapter.keyPoints.map(point => `- ${point}`).join('\n')}

WRITING STYLE:
- Tone: ${style.tone}
- Reading Level: ${style.readingLevel}
- Sentence Structure: ${style.sentenceLength}
- Examples: ${style.examples}
- Voice: ${style.voice}

TARGET AUDIENCE: ${context.targetAudience}

${previousContext}

${researchContext}

CHAPTER STRUCTURE TO FOLLOW:
${structureGuide}

WORD COUNT: Target ${template.wordCount.target} words (minimum ${template.wordCount.min}, maximum ${template.wordCount.max})

IMPORTANT GUIDELINES:
1. Start with a compelling hook that draws readers in
2. Use concrete examples and actionable advice
3. Include relevant statistics or data when appropriate
4. End with clear action steps or key takeaways
5. Maintain consistency with previous chapters
6. Use subheadings to break up content (## for main sections, ### for subsections)
7. Include at least one practical exercise or reflection question
8. ${options.includeAffiliateHooks ? 'Naturally mention 2-3 places where tools/resources could help (for later affiliate links)' : 'Focus on valuable content without promotional elements'}

${context.guidelines.length > 0 ? `\nBOOK-SPECIFIC GUIDELINES:\n${context.guidelines.map(g => `- ${g}`).join('\n')}` : ''}

Write the complete chapter content in Markdown format. Make it engaging, valuable, and actionable.`;
    }

    async callClaude(prompt) {
        const tempFile = path.join('/tmp', `writer-${Date.now()}.txt`);
        await fs.writeFile(tempFile, prompt);
        
        try {
            const command = `agentcli call claude.opus --model="${this.model}" --temperature=0.7 --max-tokens=8000 --file="${tempFile}"`;
            const { stdout, stderr } = await execAsync(command, {
                maxBuffer: 20 * 1024 * 1024 // 20MB buffer for long chapters
            });
            
            if (stderr) {
                console.warn('Writer warning:', stderr);
            }
            
            return stdout.trim();
            
        } finally {
            await fs.unlink(tempFile).catch(() => {});
        }
    }

    async enhanceContent(content, chapter, context) {
        // Add chapter metadata
        let enhanced = `---
chapter: ${chapter.number}
title: "${chapter.title}"
words: ${this.getWordCount(content)}
status: draft
---

# Chapter ${chapter.number}: ${chapter.title}

`;
        
        // Add the generated content
        enhanced += content;
        
        // Add consistent elements based on book type
        if (this.bookType === 'howTo' || this.bookType === 'selfHelp') {
            if (!content.includes('## Key Takeaways') && !content.includes('## Summary')) {
                enhanced += '\n\n## Key Takeaways\n\n';
                enhanced += this.extractKeyTakeaways(content);
            }
        }
        
        // Add navigation hints (for later HTML conversion)
        enhanced += '\n\n---\n\n';
        if (chapter.number > 1) {
            enhanced += `[← Previous Chapter](chapter-${String(chapter.number - 1).padStart(2, '0')}.md) | `;
        }
        enhanced += `[Table of Contents](index.md)`;
        if (chapter.number < context.bookTitle.chapters?.length) {
            enhanced += ` | [Next Chapter →](chapter-${String(chapter.number + 1).padStart(2, '0')}.md)`;
        }
        
        return enhanced;
    }

    extractKeyTakeaways(content) {
        // Simple extraction of key points from content
        const lines = content.split('\n');
        const keyPoints = [];
        
        // Look for important sentences (containing keywords)
        const keywords = ['important', 'remember', 'key', 'essential', 'critical', 'must', 'should'];
        
        lines.forEach(line => {
            if (keywords.some(keyword => line.toLowerCase().includes(keyword)) && line.length > 50) {
                // Clean up the line and add as a takeaway
                const cleaned = line.replace(/^[#\-*\s]+/, '').trim();
                if (cleaned && !keyPoints.some(point => point.includes(cleaned.substring(0, 30)))) {
                    keyPoints.push(cleaned);
                }
            }
        });
        
        // Limit to 3-5 key takeaways
        return keyPoints.slice(0, 5).map(point => `- ${point}`).join('\n');
    }

    summarizeChapter(content) {
        // Extract first paragraph and key headings for summary
        const lines = content.split('\n').filter(line => line.trim());
        const firstParagraph = lines.find(line => line.length > 100 && !line.startsWith('#'));
        const headings = lines.filter(line => line.startsWith('##')).map(h => h.replace(/^#+\s*/, ''));
        
        let summary = firstParagraph ? firstParagraph.substring(0, 200) + '...' : '';
        if (headings.length > 0) {
            summary += ` Covers: ${headings.slice(0, 3).join(', ')}.`;
        }
        
        return summary || 'Chapter content summary not available.';
    }

    getWordCount(content) {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    }

    async saveChapter(content, outline, chapterNumber) {
        const outputDir = outline.outputDir || 'chapters';
        await fs.mkdir(outputDir, { recursive: true });
        
        const filename = `chapter-${String(chapterNumber).padStart(2, '0')}.md`;
        const filepath = path.join(outputDir, filename);
        
        await fs.writeFile(filepath, content);
        
        return filepath;
    }

    async updateContext(outline, chapterNumber, content) {
        // Update a context file that tracks chapter completion
        const contextPath = path.join('context', 'writing-progress.json');
        
        let progress = {};
        try {
            const existing = await fs.readFile(contextPath, 'utf8');
            progress = JSON.parse(existing);
        } catch {
            // File doesn't exist yet
        }
        
        if (!progress[outline.id || outline.title]) {
            progress[outline.id || outline.title] = {
                title: outline.title,
                chapters: {}
            };
        }
        
        progress[outline.id || outline.title].chapters[chapterNumber] = {
            completed: new Date().toISOString(),
            wordCount: this.getWordCount(content),
            title: outline.chapters[chapterNumber - 1].title
        };
        
        await fs.mkdir('context', { recursive: true });
        await fs.writeFile(contextPath, JSON.stringify(progress, null, 2));
    }

    async generateBook(outline, options = {}) {
        console.log(`📚 Generating complete book: ${outline.title}`);
        console.log(`📝 Total chapters: ${outline.chapters.length}`);
        
        const results = [];
        
        for (let i = 1; i <= outline.chapters.length; i++) {
            console.log(`\n--- Chapter ${i}/${outline.chapters.length} ---`);
            
            const result = await this.generateChapter(outline, i, options);
            results.push(result);
            
            if (!result.success) {
                console.error(`Failed to generate chapter ${i}, stopping book generation`);
                break;
            }
            
            // Add delay between chapters to avoid rate limits
            if (i < outline.chapters.length) {
                console.log('⏳ Waiting 5 seconds before next chapter...');
                await this.sleep(5000);
            }
        }
        
        // Generate book summary
        const successfulChapters = results.filter(r => r.success);
        const totalWords = successfulChapters.reduce((sum, r) => sum + r.wordCount, 0);
        
        const summary = {
            bookTitle: outline.title,
            timestamp: new Date().toISOString(),
            chaptersGenerated: successfulChapters.length,
            totalChapters: outline.chapters.length,
            totalWords,
            averageWordsPerChapter: Math.round(totalWords / successfulChapters.length),
            style: this.style,
            bookType: this.bookType,
            results
        };
        
        // Save summary
        const summaryPath = path.join(outline.outputDir || 'chapters', 'book-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log('\n📊 Book Generation Summary:');
        console.log(`✅ Chapters completed: ${successfulChapters.length}/${outline.chapters.length}`);
        console.log(`📝 Total word count: ${totalWords.toLocaleString()}`);
        console.log(`📄 Average chapter length: ${summary.averageWordsPerChapter.toLocaleString()} words`);
        
        return summary;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options.outline) {
        console.error('Usage: writer.js --outline="path/to/outline.json" [--chapter=N] [--style="conversational"]');
        console.error('Styles: conversational, professional, academic, storytelling');
        console.error('Book types: howTo, business, selfHelp, technical');
        process.exit(1);
    }
    
    (async () => {
        try {
            // Load outline
            const outlineContent = await fs.readFile(options.outline, 'utf8');
            const outline = JSON.parse(outlineContent);
            
            // Create writer instance
            const writer = new Writer({
                style: options.style || 'conversational',
                bookType: options.bookType || outline.bookType || 'howTo',
                includeResearch: options.research !== 'false'
            });
            
            if (options.chapter) {
                // Generate single chapter
                const chapterNum = parseInt(options.chapter);
                const result = await writer.generateChapter(outline, chapterNum, options);
                console.log('\nResult:', JSON.stringify(result, null, 2));
            } else {
                // Generate entire book
                const summary = await writer.generateBook(outline, options);
                console.log('\nComplete summary saved to:', path.join(outline.outputDir || 'chapters', 'book-summary.json'));
            }
            
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = Writer;