#!/usr/bin/env node

/**
 * Planner Agent
 * 
 * Creates detailed book outlines based on research and topic analysis.
 * Determines optimal chapter structure, key points, and content flow.
 * 
 * Usage:
 *   agentcli call planner.outline --topic="AI for Business" --research="research.yaml"
 *   node agents/planner.js --topic="Passive Income" --chapters=10 --style="how-to"
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const yaml = require('js-yaml');

// Book structure templates
const BOOK_STRUCTURES = {
    'how-to': {
        intro: ["Why This Matters", "What You'll Learn", "How to Use This Book"],
        body: ["Foundation", "Core Concepts", "Implementation", "Advanced Strategies", "Troubleshooting"],
        conclusion: ["Putting It All Together", "Next Steps", "Resources"],
        chapterCount: { min: 8, ideal: 10, max: 12 }
    },
    'business': {
        intro: ["The Problem", "The Opportunity", "The Solution Overview"],
        body: ["Market Analysis", "Strategy", "Execution", "Scaling", "Case Studies"],
        conclusion: ["Future Trends", "Action Plan", "Success Metrics"],
        chapterCount: { min: 10, ideal: 12, max: 15 }
    },
    'self-help': {
        intro: ["Your Journey Starts Here", "Understanding the Challenge", "The Path Forward"],
        body: ["Self-Assessment", "Core Principles", "Daily Practices", "Overcoming Obstacles", "Building Momentum"],
        conclusion: ["Transformation Complete", "Maintaining Progress", "Helping Others"],
        chapterCount: { min: 8, ideal: 10, max: 12 }
    },
    'technical': {
        intro: ["Prerequisites", "What We're Building", "Tools and Setup"],
        body: ["Fundamentals", "Core Implementation", "Advanced Features", "Optimization", "Deployment"],
        conclusion: ["Best Practices", "Maintenance", "Further Learning"],
        chapterCount: { min: 10, ideal: 15, max: 20 }
    },
    'story-driven': {
        intro: ["The Hook", "Setting the Stage", "Meet the Players"],
        body: ["The Journey Begins", "Rising Action", "The Turning Point", "The Climax", "Resolution"],
        conclusion: ["Lessons Learned", "Applying the Story", "Your Own Journey"],
        chapterCount: { min: 8, ideal: 10, max: 12 }
    }
};

// Content depth configurations
const CONTENT_DEPTH = {
    beginner: {
        explanation: "simple and clear",
        examples: "basic, relatable",
        terminology: "avoid jargon",
        prerequisites: "none"
    },
    intermediate: {
        explanation: "detailed with context",
        examples: "practical applications",
        terminology: "introduce technical terms",
        prerequisites: "basic knowledge assumed"
    },
    advanced: {
        explanation: "comprehensive and nuanced",
        examples: "complex scenarios",
        terminology: "industry-specific",
        prerequisites: "significant experience"
    }
};

class Planner {
    constructor(options = {}) {
        this.model = options.model || 'opus-4';
        this.bookStyle = options.bookStyle || 'how-to';
        this.depth = options.depth || 'intermediate';
        this.includeExercises = options.includeExercises !== false;
        this.includeResearch = options.includeResearch !== false;
    }

    async createOutline(topic, options = {}) {
        console.log(`📋 Creating book outline for: ${topic}`);
        
        try {
            // Load research if available
            const research = await this.loadResearch(options.researchPath);
            
            // Analyze topic and determine best approach
            const analysis = await this.analyzeTopic(topic, research);
            
            // Generate book metadata
            const metadata = this.generateMetadata(topic, analysis, options);
            
            // Create chapter structure
            const chapters = await this.generateChapterStructure(topic, analysis, metadata, research);
            
            // Add supporting elements
            const outline = {
                id: `outline-${Date.now()}`,
                timestamp: new Date().toISOString(),
                ...metadata,
                analysis,
                chapters,
                guidelines: this.generateGuidelines(analysis, metadata),
                resources: this.generateResourceList(topic, research),
                outputDir: options.outputDir || `chapters/${this.sanitizeTitle(metadata.title)}`
            };
            
            // Validate outline
            const validation = this.validateOutline(outline);
            if (!validation.valid) {
                throw new Error(`Outline validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Save outline
            const outlinePath = await this.saveOutline(outline, options);
            
            console.log(`✅ Outline created successfully`);
            console.log(`📚 Title: ${outline.title}`);
            console.log(`📖 Chapters: ${outline.chapters.length}`);
            console.log(`🎯 Target audience: ${outline.targetAudience}`);
            
            return {
                success: true,
                outline,
                path: outlinePath,
                summary: this.generateOutlineSummary(outline)
            };
            
        } catch (error) {
            console.error(`❌ Error creating outline: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async loadResearch(researchPath) {
        if (!researchPath) {
            // Try default location
            researchPath = path.join('context', 'research.yaml');
        }
        
        try {
            const content = await fs.readFile(researchPath, 'utf8');
            return yaml.load(content);
        } catch (error) {
            console.log('📝 No research file found, proceeding without external research');
            return null;
        }
    }

    async analyzeTopic(topic, research) {
        const prompt = `Analyze this topic for a book outline: "${topic}"

${research ? `RESEARCH INSIGHTS:\n${research.summary}\n\nKey Points:\n${research.bullets.join('\n')}\n` : ''}

Provide a JSON analysis with:
{
    "primaryTheme": "main subject area",
    "subThemes": ["related topics"],
    "targetAudience": {
        "primary": "main audience",
        "secondary": ["other potential readers"],
        "level": "beginner/intermediate/advanced"
    },
    "marketPosition": {
        "uniqueAngle": "what makes this different",
        "competingBooks": ["similar titles"],
        "gap": "what gap this fills"
    },
    "contentType": "how-to/business/self-help/technical/story-driven",
    "estimatedLength": "short (< 20k words) / medium (20-50k) / long (> 50k)",
    "monetizationPotential": ["affiliate opportunities", "upsell products", "course potential"]
}`;

        const response = await this.callClaude(prompt);
        
        try {
            return JSON.parse(response);
        } catch (error) {
            console.warn('Failed to parse analysis, using defaults');
            return {
                primaryTheme: topic,
                subThemes: [],
                targetAudience: {
                    primary: "general readers interested in " + topic,
                    secondary: ["professionals", "students"],
                    level: "intermediate"
                },
                contentType: this.bookStyle,
                estimatedLength: "medium",
                monetizationPotential: ["related tools", "consulting services"]
            };
        }
    }

    generateMetadata(topic, analysis, options) {
        const structure = BOOK_STRUCTURES[analysis.contentType || this.bookStyle];
        const targetChapters = options.chapters || structure.chapterCount.ideal;
        
        return {
            title: this.generateTitle(topic, analysis),
            subtitle: this.generateSubtitle(topic, analysis),
            author: options.author || "AI Author",
            genre: analysis.contentType || this.bookStyle,
            targetAudience: analysis.targetAudience.primary,
            audienceLevel: analysis.targetAudience.level || this.depth,
            theme: analysis.primaryTheme,
            keywords: [analysis.primaryTheme, ...analysis.subThemes].slice(0, 10),
            targetWordCount: this.calculateTargetWordCount(analysis.estimatedLength),
            chapterCount: targetChapters,
            bookType: analysis.contentType || this.bookStyle,
            publishDate: new Date().toISOString().split('T')[0]
        };
    }

    generateTitle(topic, analysis) {
        // Simple title generation - in production, this would use AI
        const templates = [
            `The Complete Guide to ${topic}`,
            `${topic}: A Practical Approach`,
            `Mastering ${topic}`,
            `${topic} Made Simple`,
            `The ${topic} Handbook`
        ];
        
        return templates[Math.floor(Math.random() * templates.length)];
    }

    generateSubtitle(topic, analysis) {
        const angle = analysis.marketPosition?.uniqueAngle || "practical strategies";
        return `Discover ${angle} for ${analysis.targetAudience.primary}`;
    }

    calculateTargetWordCount(estimatedLength) {
        const lengths = {
            'short': 20000,
            'medium': 35000,
            'long': 60000
        };
        
        return lengths[estimatedLength] || lengths.medium;
    }

    async generateChapterStructure(topic, analysis, metadata, research) {
        const structure = BOOK_STRUCTURES[metadata.bookType];
        const depth = CONTENT_DEPTH[metadata.audienceLevel];
        
        const prompt = `Create a detailed chapter structure for a ${metadata.bookType} book about "${topic}".

BOOK DETAILS:
Title: ${metadata.title}
Target Audience: ${metadata.targetAudience}
Audience Level: ${metadata.audienceLevel}
Total Chapters: ${metadata.chapterCount}

STRUCTURAL GUIDELINES:
- Introduction chapters should cover: ${structure.intro.join(', ')}
- Body chapters should cover: ${structure.body.join(', ')}
- Conclusion chapters should cover: ${structure.conclusion.join(', ')}

CONTENT REQUIREMENTS:
- Explanation style: ${depth.explanation}
- Example types: ${depth.examples}
- Technical level: ${depth.terminology}

${research ? `\nRESEARCH TO INCORPORATE:\n${research.bullets.join('\n')}\n` : ''}

Create a JSON array of chapters with this structure for each:
[
    {
        "number": 1,
        "title": "Chapter Title",
        "type": "introduction/body/conclusion",
        "summary": "Brief chapter description",
        "keyPoints": ["main point 1", "main point 2", "main point 3"],
        "exercises": ["practical exercise 1", "exercise 2"],
        "estimatedWords": 3000,
        "affiliateOpportunities": ["tool or resource that could be recommended"]
    }
]

Ensure the chapters flow logically and build upon each other. Include ${metadata.chapterCount} chapters total.`;

        const response = await this.callClaude(prompt);
        
        try {
            const chapters = JSON.parse(response);
            
            // Validate and enhance chapters
            return chapters.map((chapter, index) => ({
                ...chapter,
                number: index + 1,
                type: this.determineChapterType(index, chapters.length),
                estimatedWords: chapter.estimatedWords || Math.floor(metadata.targetWordCount / metadata.chapterCount),
                exercises: this.includeExercises ? (chapter.exercises || []) : [],
                affiliateOpportunities: chapter.affiliateOpportunities || []
            }));
        } catch (error) {
            console.error('Failed to parse chapter structure, generating default');
            return this.generateDefaultChapters(topic, metadata);
        }
    }

    determineChapterType(index, total) {
        if (index === 0) return 'introduction';
        if (index >= total - 2) return 'conclusion';
        return 'body';
    }

    generateDefaultChapters(topic, metadata) {
        const structure = BOOK_STRUCTURES[metadata.bookType];
        const chapters = [];
        
        // Introduction
        chapters.push({
            number: 1,
            title: `Introduction to ${topic}`,
            type: 'introduction',
            summary: `An overview of ${topic} and what readers will learn`,
            keyPoints: structure.intro,
            exercises: [],
            estimatedWords: 2500
        });
        
        // Body chapters
        const bodyCount = metadata.chapterCount - 3; // minus intro and 2 conclusion chapters
        structure.body.slice(0, bodyCount).forEach((theme, index) => {
            chapters.push({
                number: index + 2,
                title: `${theme} in ${topic}`,
                type: 'body',
                summary: `Exploring ${theme.toLowerCase()} aspects of ${topic}`,
                keyPoints: [`Understanding ${theme}`, `Applying ${theme}`, `Common mistakes`],
                exercises: [`Practice ${theme.toLowerCase()}`],
                estimatedWords: Math.floor(metadata.targetWordCount / metadata.chapterCount)
            });
        });
        
        // Conclusion chapters
        structure.conclusion.slice(0, 2).forEach((theme, index) => {
            chapters.push({
                number: chapters.length + 1,
                title: theme,
                type: 'conclusion',
                summary: `${theme} for your ${topic} journey`,
                keyPoints: [`Review key concepts`, `Plan next steps`, `Continue learning`],
                exercises: [],
                estimatedWords: 2000
            });
        });
        
        return chapters;
    }

    generateGuidelines(analysis, metadata) {
        const guidelines = [
            `Write for ${metadata.targetAudience} at ${metadata.audienceLevel} level`,
            `Maintain a ${metadata.bookType} style throughout`,
            `Include practical examples and real-world applications`,
            `Ensure each chapter builds on previous knowledge`
        ];
        
        if (analysis.marketPosition?.uniqueAngle) {
            guidelines.push(`Emphasize the unique angle: ${analysis.marketPosition.uniqueAngle}`);
        }
        
        if (this.includeExercises) {
            guidelines.push('Include hands-on exercises in each body chapter');
        }
        
        return guidelines;
    }

    generateResourceList(topic, research) {
        const resources = {
            tools: [],
            references: [],
            furtherReading: []
        };
        
        if (research && research.links) {
            resources.references = research.links.slice(0, 10);
        }
        
        // Add topic-specific resource suggestions
        resources.tools.push(
            `Online ${topic} communities`,
            `${topic} practice tools`,
            `Professional ${topic} software`
        );
        
        resources.furtherReading.push(
            `Advanced ${topic} techniques`,
            `${topic} case studies`,
            `Industry reports on ${topic}`
        );
        
        return resources;
    }

    validateOutline(outline) {
        const errors = [];
        
        if (!outline.title || outline.title.length < 3) {
            errors.push('Title too short');
        }
        
        if (!outline.chapters || outline.chapters.length < 5) {
            errors.push('Too few chapters (minimum 5)');
        }
        
        const totalWords = outline.chapters.reduce((sum, ch) => sum + (ch.estimatedWords || 0), 0);
        if (totalWords < 15000) {
            errors.push('Total word count too low (minimum 15,000)');
        }
        
        // Check chapter structure
        const hasIntro = outline.chapters.some(ch => ch.type === 'introduction');
        const hasConclusion = outline.chapters.some(ch => ch.type === 'conclusion');
        
        if (!hasIntro) errors.push('Missing introduction chapter');
        if (!hasConclusion) errors.push('Missing conclusion chapter');
        
        return {
            valid: errors.length === 0,
            errors,
            warnings: []
        };
    }

    generateOutlineSummary(outline) {
        const totalWords = outline.chapters.reduce((sum, ch) => sum + ch.estimatedWords, 0);
        const types = outline.chapters.reduce((acc, ch) => {
            acc[ch.type] = (acc[ch.type] || 0) + 1;
            return acc;
        }, {});
        
        return {
            title: outline.title,
            chapters: outline.chapters.length,
            estimatedWords: totalWords,
            estimatedPages: Math.round(totalWords / 250),
            chapterBreakdown: types,
            topics: outline.chapters.map(ch => ch.title),
            primaryAudience: outline.targetAudience,
            readingLevel: outline.audienceLevel
        };
    }

    async saveOutline(outline, options) {
        const filename = options.filename || `outline-${this.sanitizeTitle(outline.title)}.json`;
        const dir = options.outputDir || 'outlines';
        
        await fs.mkdir(dir, { recursive: true });
        const filepath = path.join(dir, filename);
        
        await fs.writeFile(filepath, JSON.stringify(outline, null, 2));
        
        // Also save a markdown version for easy reading
        const markdownPath = filepath.replace('.json', '.md');
        await fs.writeFile(markdownPath, this.generateMarkdownOutline(outline));
        
        return filepath;
    }

    generateMarkdownOutline(outline) {
        let md = `# ${outline.title}\n\n`;
        
        if (outline.subtitle) {
            md += `## ${outline.subtitle}\n\n`;
        }
        
        md += `**Author**: ${outline.author}\n`;
        md += `**Target Audience**: ${outline.targetAudience}\n`;
        md += `**Level**: ${outline.audienceLevel}\n`;
        md += `**Estimated Length**: ${outline.targetWordCount.toLocaleString()} words\n\n`;
        
        md += `## Table of Contents\n\n`;
        
        outline.chapters.forEach(chapter => {
            md += `### Chapter ${chapter.number}: ${chapter.title}\n`;
            md += `*${chapter.summary}*\n\n`;
            md += `**Key Points**:\n`;
            chapter.keyPoints.forEach(point => {
                md += `- ${point}\n`;
            });
            
            if (chapter.exercises && chapter.exercises.length > 0) {
                md += `\n**Exercises**:\n`;
                chapter.exercises.forEach(exercise => {
                    md += `- ${exercise}\n`;
                });
            }
            
            md += `\n*Estimated words: ${chapter.estimatedWords.toLocaleString()}*\n\n`;
        });
        
        if (outline.guidelines && outline.guidelines.length > 0) {
            md += `## Writing Guidelines\n\n`;
            outline.guidelines.forEach(guideline => {
                md += `- ${guideline}\n`;
            });
            md += '\n';
        }
        
        return md;
    }

    sanitizeTitle(title) {
        return title.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 50);
    }

    async callClaude(prompt) {
        const tempFile = path.join('/tmp', `planner-${Date.now()}.txt`);
        await fs.writeFile(tempFile, prompt);
        
        try {
            const command = `agentcli call claude.opus --model="${this.model}" --temperature=0.5 --file="${tempFile}"`;
            const { stdout } = await execAsync(command, {
                maxBuffer: 10 * 1024 * 1024
            });
            
            return stdout.trim();
            
        } finally {
            await fs.unlink(tempFile).catch(() => {});
        }
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
    
    if (!options.topic) {
        console.error('Usage: planner.js --topic="Your Book Topic" [--chapters=10] [--style="how-to"]');
        console.error('Styles: how-to, business, self-help, technical, story-driven');
        console.error('Depth: beginner, intermediate, advanced');
        process.exit(1);
    }
    
    const planner = new Planner({
        bookStyle: options.style || 'how-to',
        depth: options.depth || 'intermediate',
        includeExercises: options.exercises !== 'false'
    });
    
    (async () => {
        try {
            const result = await planner.createOutline(options.topic, {
                chapters: options.chapters ? parseInt(options.chapters) : undefined,
                author: options.author,
                researchPath: options.research,
                outputDir: options.output
            });
            
            if (result.success) {
                console.log('\n✅ Outline saved to:', result.path);
                console.log('\n📊 Summary:');
                console.log(JSON.stringify(result.summary, null, 2));
            } else {
                console.error('\n❌ Failed:', result.error);
                process.exit(1);
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = Planner;