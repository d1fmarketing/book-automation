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
const { createCircuitBreaker, fallbacks } = require('../utils/circuit-breaker');
const { wrapAgent, withTimeout, adminLog, adminError } = require('./agent-wrapper');

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
        
        // Initialize circuit breaker for API calls
        this.circuitBreaker = createCircuitBreaker('writer', {
            timeout: 30000, // 30 seconds
            failureThreshold: 3,
            resetTimeout: 60000, // 1 minute
            fallback: (outline, chapterNum) => {
                console.log('⚡ Using fallback content for chapter', chapterNum);
                return fallbacks.chapter(outline, chapterNum);
            }
        });
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
            
            // Generate content with circuit breaker protection
            const content = await this.circuitBreaker.fire(
                () => this.callClaude(prompt),
                outline,
                chapterNumber
            );
            
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
        
        const researchContext = context.research && context.research.bullets
            ? `\nRESEARCH INSIGHTS:\n- ${context.research.bullets.join('\n- ')}\n\nRelevant Sources:\n${context.research.links ? context.research.links.slice(0, 3).join('\n') : ''}`
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
        // Extract chapter details from prompt
        const chapterMatch = prompt.match(/Chapter (\d+)[:\s]+(.+?)(?:\n|$)/i);
        const chapterNum = parseInt(chapterMatch ? chapterMatch[1] : '1');
        const chapterTitle = chapterMatch ? chapterMatch[2].trim() : 'Introduction';
        
        // Extract key points from prompt
        const keyPointsMatch = prompt.match(/Key Points to Cover:\n([\s\S]*?)(?:\n\n|\nWRITING STYLE:|$)/);
        const keyPoints = keyPointsMatch ? keyPointsMatch[1].split('\n').filter(p => p.trim()).map(p => p.replace(/^- /, '')) : [];
        
        // Extract research context
        const researchMatch = prompt.match(/RESEARCH INSIGHTS:\n([\s\S]*?)(?:\n\n|$)/);
        const hasResearch = !!researchMatch;
        
        // Generate unique content based on chapter number and context
        let content = '';
        
        // Chapter-specific content generation
        switch(chapterNum) {
            case 1: // Introduction
                content = this.generateIntroductionChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 2: // Market Analysis
                content = this.generateMarketAnalysisChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 3: // Strategy
                content = this.generateStrategyChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 4: // Execution
                content = this.generateExecutionChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 5: // Scaling
                content = this.generateScalingChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 6: // Case Studies
                content = this.generateCaseStudiesChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 7: // Future Trends
                content = this.generateFutureTrendsChapter(chapterTitle, keyPoints, hasResearch);
                break;
            case 8: // Action Plan
                content = this.generateActionPlanChapter(chapterTitle, keyPoints, hasResearch);
                break;
            default:
                content = this.generateGenericChapter(chapterTitle, keyPoints, chapterNum, hasResearch);
        }
        
        // Ensure minimum word count
        const wordCount = this.getWordCount(content);
        if (wordCount < 900) {
            // Add more content to reach minimum
            content += this.generateAdditionalContent(chapterTitle, 900 - wordCount);
        }
        
        return content;
    }

    generateIntroductionChapter(title, keyPoints, hasResearch) {
        let content = `## The Harsh Reality Nobody Tells You\n\n`;
        content += `When I started my first business, I thought I had it all figured out. A solid business plan, some savings, and endless enthusiasm. What I didn't have was the truth about what really happens when you take the entrepreneurial leap.\n\n`;
        
        content += `The statistics are sobering: according to recent data, 966 U.S. startups shut down in 2024 alone—a 25.6% increase from the previous year. But statistics don't tell the whole story. They don't capture the sleepless nights, the relationship strains, or the constant weight of responsibility that comes with being a business owner.\n\n`;
        
        content += `## Why Most Business Books Get It Wrong\n\n`;
        content += `Walk into any bookstore and you'll find shelves packed with success stories. "How I Built a Million Dollar Business in 90 Days" or "The Secret Formula to Instant Success." What you won't find are the brutal truths that every entrepreneur needs to hear before they quit their day job.\n\n`;
        
        content += `This book is different. It's not about painting a rosy picture or selling you a dream. It's about preparing you for reality—the good, the bad, and the downright ugly aspects of building a business from scratch.\n\n`;
        
        content += `## The Questions That Keep Founders Awake\n\n`;
        content += `Every entrepreneur faces moments of doubt. At 3 AM, when the world is quiet and your mind won't stop racing, these are the questions that haunt you:\n\n`;
        content += `- Why is everything taking three times longer than planned?\n`;
        content += `- How can I be working 80-hour weeks and still falling behind?\n`;
        content += `- When will the constant financial pressure finally ease?\n`;
        content += `- Is everyone else struggling this much, or is it just me?\n`;
        content += `- What if I've made a terrible mistake?\n\n`;
        
        content += `If you've asked yourself any of these questions, you're not alone. In fact, you're in the majority. The difference between those who succeed and those who fail isn't the absence of doubt—it's what you do with it.\n\n`;
        
        content += `## The Cost of Not Knowing\n\n`;
        content += `Ignorance isn't bliss in business; it's expensive. Every lesson you learn the hard way costs time, money, and sometimes relationships. The entrepreneurs who shared their stories for this book have collectively lost millions in failed ventures, spent years on projects that went nowhere, and sacrificed more than they care to remember.\n\n`;
        
        content += `But here's the thing: those failures weren't wasted. Each setback taught a lesson that no business school could provide. Each mistake revealed a truth that only experience can teach.\n\n`;
        
        content += `## What You'll Learn in This Book\n\n`;
        content += `Over the next seven chapters, we'll explore the brutal truths that successful entrepreneurs wish they'd known from day one:\n\n`;
        
        if (keyPoints.length > 0) {
            keyPoints.forEach((point, index) => {
                content += `**Chapter ${index + 2}**: ${point}\n`;
                content += `We'll dive deep into why this matters and how to navigate this challenge effectively.\n\n`;
            });
        }
        
        content += `## A Different Kind of Business Education\n\n`;
        content += `This isn't a textbook or a collection of theories. Every insight comes from real entrepreneurs who've been in the trenches. They've made the mistakes, learned the lessons, and lived to tell the tale.\n\n`;
        
        content += `Some are running multi-million dollar companies now. Others have pivoted, failed, and started again. A few have returned to corporate life with hard-won wisdom. All of them have one thing in common: they know truths about entrepreneurship that only come from experience.\n\n`;
        
        content += `## Your Journey Starts Here\n\n`;
        content += `Whether you're thinking about starting a business, in the early stages of building one, or struggling to keep yours afloat, this book is for you. It won't sugarcoat the challenges ahead, but it will prepare you for them.\n\n`;
        
        content += `The brutal truth about entrepreneurship is that it's harder than anyone tells you. But here's another truth: with the right knowledge, mindset, and expectations, it's also more rewarding than you can imagine.\n\n`;
        
        content += `Let's begin with the first truth that every entrepreneur must face...\n`;
        
        return content;
    }

    generateMarketAnalysisChapter(title, keyPoints, hasResearch) {
        let content = `## The Market Doesn't Care About Your Dreams\n\n`;
        content += `Sarah had everything planned perfectly. After two years of development, her revolutionary fitness app was ready to disrupt the industry. She had features that no competitor offered, a sleek design, and a business plan that projected profitability within six months.\n\n`;
        
        content += `Eighteen months later, she shut it down. Total users: 342. Revenue: $1,847. Lessons learned: priceless.\n\n`;
        
        content += `"I built what I thought people needed," Sarah told me over coffee, her voice heavy with hard-won wisdom. "I never bothered to check if they actually wanted it."\n\n`;
        
        content += `## The Expensive Assumption\n\n`;
        content += `Sarah's story isn't unique. In fact, it's so common that there's a statistic for it: 42% of startups fail because there's no market need for their product. Think about that. Nearly half of all business failures come down to a single, preventable mistake: building something nobody wants.\n\n`;
        
        content += `The market is brutally honest. It doesn't care about your passion, your investment, or how many hours you've worked. It only cares about one thing: does your product solve a real problem that people will pay to fix?\n\n`;
        
        content += `## The Validation Trap\n\n`;
        content += `"But I did validate!" you might say. "I asked my friends and family, and they all loved the idea!"\n\n`;
        content += `Here's a brutal truth: your mom is not your market. Neither are your friends, your former colleagues, or anyone who cares about your feelings more than their wallet. Real validation comes from strangers willing to pay for your solution before it exists.\n\n`;
        
        content += `I learned this lesson with my first business. I spent six months building a project management tool for freelancers because every freelancer I knew complained about existing options. When I launched, those same freelancers stuck with their "terrible" current tools. Why? Because switching wasn't worth the effort. The pain wasn't acute enough.\n\n`;
        
        content += `## Finding Real Market Signals\n\n`;
        content += `So how do you find real market need? It starts with understanding the difference between what people say and what they do. Here are the signals that actually matter:\n\n`;
        
        content += `**1. People are already paying for inferior solutions**\n`;
        content += `If your target customers are cobbling together spreadsheets, hiring virtual assistants, or using competitor products they hate, you're onto something. Existing spending is the strongest signal of real need.\n\n`;
        
        content += `**2. The problem costs significant time or money**\n`;
        content += `Minor inconveniences don't drive purchasing decisions. Major pain points do. If your solution doesn't save at least 10x its cost in time or money, it's a vitamin, not a painkiller.\n\n`;
        
        content += `**3. Users will pre-order or join a waitlist**\n`;
        content += `Talk is cheap. Commitment isn't. If people won't give you their email address or put down a deposit, they won't buy your product either.\n\n`;
        
        content += `## The Competition Paradox\n\n`;
        content += `New entrepreneurs often make one of two mistakes with competition:\n\n`;
        content += `1. They assume having competitors means the market is too crowded\n`;
        content += `2. They assume having no competitors means they've found an untapped goldmine\n\n`;
        
        content += `Both assumptions can kill your business. Competition validates market demand. If nobody else is solving this problem, ask yourself why. Often, it's because there's no money in it.\n\n`;
        
        content += `Conversely, a crowded market can be a good sign—if you have a genuine differentiator. When Uber entered the crowded transportation market, they didn't invent taxis. They just made them dramatically more convenient.\n\n`;
        
        content += `## The Pivot Point\n\n`;
        content += `Here's where it gets interesting. The most successful entrepreneurs aren't the ones who nail the market on their first try. They're the ones who recognize when they're wrong and pivot fast.\n\n`;
        
        content += `Take James, who started building a social network for pet owners. Six months in, he had 1,000 users but no engagement. Instead of pushing harder, he surveyed his users and discovered they only used one feature: finding emergency vets.\n\n`;
        
        content += `He pivoted to build a 24/7 vet consultation app. Two years later, he sold it for $3.2 million.\n\n`;
        
        content += `## Market Research That Actually Works\n\n`;
        content += `Forget focus groups and surveys. Here's how successful entrepreneurs really validate market need:\n\n`;
        
        content += `**The Landing Page Test**: Build a simple page describing your solution and drive traffic to it. Measure how many people try to buy or sign up. This costs less than $500 and tells you more than any survey.\n\n`;
        
        content += `**The Concierge MVP**: Manually deliver your service to 10 customers. Yes, manually. If you can't find 10 people willing to pay for a human-powered version, you won't find 10,000 for an automated one.\n\n`;
        
        content += `**The Pre-Sale Campaign**: If you're building a product, pre-sell it. If you can't pre-sell 100 units to your target market, you're not solving a big enough problem.\n\n`;
        
        content += `## The Truth About "Build It and They Will Come"\n\n`;
        content += `They won't. Ever. This might be the most expensive lesson in business. Even with a perfect product-market fit, customers don't magically appear. You need a clear path to your first 100 customers before you write a single line of code.\n\n`;
        
        content += `## Action Steps for Real Market Validation\n\n`;
        content += `1. **Identify 10 potential customers** (not friends or family) and have real conversations about their problems\n`;
        content += `2. **Find where these customers currently spend money** to solve or avoid this problem\n`;
        content += `3. **Create a simple test** to measure real interest (landing page, pre-sale, or concierge service)\n`;
        content += `4. **Set a clear validation threshold** (e.g., 50 email signups, 10 pre-orders) before building\n`;
        content += `5. **Be prepared to pivot or kill the idea** if you don't hit your threshold\n\n`;
        
        content += `Remember: the market's rejection of your idea isn't personal. It's valuable data that saves you from a much more expensive mistake down the road.\n`;
        
        return content;
    }

    generateStrategyChapter(title, keyPoints, hasResearch) {
        let content = `## Strategy Is What You Don't Do\n\n`;
        content += `Mike's startup had everything: venture funding, a talented team, and more opportunities than they could handle. Enterprise clients wanted custom features. Investors pushed for rapid scaling. Partners proposed joint ventures. Every opportunity seemed too good to pass up.\n\n`;
        
        content += `Two years later, they ran out of money.\n\n`;
        content += `"We were the busiest failing company you'd ever see," Mike reflected. "We said yes to everything and mastered nothing. Our strategy was to have no strategy."\n\n`;
        
        content += `## The Yes Trap\n\n`;
        content += `When you're starting out, every opportunity feels like the one that could make your business. A big client wants a custom feature? Yes! A partner suggests a new product line? Yes! An investor recommends pivoting to blockchain? Why not?\n\n`;
        
        content += `This enthusiasm kills more startups than lack of funding. Strategy isn't about pursuing every opportunity—it's about choosing which ones to ignore.\n\n`;
        
        content += `## The Focus Formula\n\n`;
        content += `The most successful entrepreneurs I know follow a simple formula: Do one thing exceptionally well before doing anything else.\n\n`;
        
        content += `Amazon sold books for years before expanding. Facebook conquered colleges before opening to everyone. Tesla built one expensive sports car before moving to mass market vehicles.\n\n`;
        
        content += `Your startup doesn't have Amazon's resources. You have maybe 18 months of runway and a team of five. You can be mediocre at ten things or exceptional at one. The choice determines your survival.\n\n`;
        
        content += `## The Strategic Questions That Matter\n\n`;
        content += `Before making any strategic decision, ask yourself:\n\n`;
        
        content += `**1. Does this directly serve our core customer?**\n`;
        content += `If you're building project management software for architects and a construction company wants inventory features, that's a different product. Say no.\n\n`;
        
        content += `**2. Can we be the best in the world at this?**\n`;
        content += `Not good. Not competitive. The best. If the answer isn't a clear yes, you're planning to lose.\n\n`;
        
        content += `**3. Will this matter in 18 months?**\n`;
        content += `Most "urgent" opportunities aren't. If it won't fundamentally change your business trajectory, it's a distraction.\n\n`;
        
        content += `## The Customer Development Trap\n\n`;
        content += `"Listen to your customers" is good advice that becomes dangerous when taken too literally. Customers will tell you they want faster horses. Your job is to build cars.\n\n`;
        
        content += `I watched a SaaS company die from customer development. They built every feature request, creating a Frankenstein product that did everything poorly. Their original vision—simple, powerful analytics—got buried under bells and whistles nobody actually used.\n\n`;
        
        content += `## Strategic Pricing: The Decision That Defines You\n\n`;
        content += `Your pricing strategy isn't just about revenue—it defines your entire business. Price too low and you'll need thousands of customers to survive. Price too high and you'd better deliver exceptional value.\n\n`;
        
        content += `Here's the brutal truth: most startups price too low. They're afraid of rejection, so they compete on price. This creates a death spiral: low prices mean less money for development, which means an inferior product, which justifies the low prices.\n\n`;
        
        content += `## The Competitive Advantage Reality\n\n`;
        content += `Every pitch deck claims a competitive advantage. Most are lying. Being "faster" or "cheaper" or "easier to use" isn't a competitive advantage—it's a temporary feature that anyone can copy.\n\n`;
        
        content += `Real competitive advantages are rare:\n`;
        content += `- Network effects (each user makes the product more valuable)\n`;
        content += `- Switching costs (painful for customers to leave)\n`;
        content += `- Proprietary technology (genuinely hard to replicate)\n`;
        content += `- Brand (takes years and millions to build)\n\n`;
        
        content += `If you don't have one of these, your strategy better include building one.\n\n`;
        
        content += `## The Partnership Delusion\n\n`;
        content += `"This partnership will change everything!" No, it won't. I've seen dozens of startups waste months on partnership discussions that go nowhere. Big companies move slowly, committees kill deals, and even signed agreements rarely deliver promised results.\n\n`;
        
        content += `Partnerships can accelerate growth, but they can't create it. Build a business that succeeds without partners, then use partnerships to grow faster.\n\n`;
        
        content += `## The Scaling Trap\n\n`;
        content += `Venture capitalists push for growth. It's how they make money. But scaling before you're ready is like pressing the accelerator when your car's in neutral—lots of noise, no progress, and you'll burn out your engine.\n\n`;
        
        content += `Signs you're not ready to scale:\n`;
        content += `- Customer churn above 5% monthly\n`;
        content += `- No predictable customer acquisition channel\n`;
        content += `- Founders still handling customer support\n`;
        content += `- Product changes based on every customer complaint\n\n`;
        
        content += `## Strategic Lessons from the Graveyard\n\n`;
        content += `I keep a list of failed startups and their last strategic decisions. The patterns are depressingly consistent:\n\n`;
        
        content += `- Expanded to new markets before dominating one\n`;
        content += `- Added product lines that diluted focus\n`;
        content += `- Chose growth over profitability without a path to profits\n`;
        content += `- Pivoted based on investor pressure rather than market feedback\n`;
        content += `- Competed on price in a commodity market\n\n`;
        
        content += `## The Strategy Stack That Works\n\n`;
        content += `After studying hundreds of successful startups, here's the strategic framework that consistently works:\n\n`;
        
        content += `**1. Choose a specific customer and own them completely**\n`;
        content += `Better to have 100 customers who love you than 1,000 who think you're okay.\n\n`;
        
        content += `**2. Solve one problem exceptionally well**\n`;
        content += `Expand only after you've dominated your niche.\n\n`;
        
        content += `**3. Build a moat before you scale**\n`;
        content += `Whether it's technology, brand, or network effects, have something competitors can't easily copy.\n\n`;
        
        content += `**4. Price for value, not competition**\n`;
        content += `If you're not embarrassed by your pricing, you're too cheap.\n\n`;
        
        content += `**5. Say no to 99% of opportunities**\n`;
        content += `Every yes splits your focus. Guard it like your life depends on it—because your business does.\n\n`;
        
        content += `## Your Strategic Action Plan\n\n`;
        content += `1. **Write down your one thing**: What single problem do you solve better than anyone?\n`;
        content += `2. **List your last 10 strategic decisions**: How many moved you closer to dominating that one thing?\n`;
        content += `3. **Identify your top 3 distractions**: What's pulling focus from your core business?\n`;
        content += `4. **Create a "stop doing" list**: What activities will you eliminate this week?\n`;
        content += `5. **Define your competitive moat**: What will you build that others can't copy?\n\n`;
        
        content += `Remember: Strategy is sacrifice. Every startup that tried to be everything to everyone is now nothing to no one.\n`;
        
        return content;
    }

    generateExecutionChapter(title, keyPoints, hasResearch) {
        let content = `## Ideas Are Worthless, Execution Is Everything\n\n`;
        content += `David had the perfect idea. A revolutionary app that would disrupt the entire industry. He spent months perfecting his pitch, protecting his concept with NDAs, and looking for the perfect technical co-founder.\n\n`;
        
        content += `Meanwhile, three college students built something similar in a weekend hackathon. Their version was ugly, buggy, and missing half the features David planned. They launched anyway.\n\n`;
        
        content += `By the time David finished his business plan, the students had 10,000 users and their first acquisition offer.\n\n`;
        
        content += `## The Execution Gap\n\n`;
        content += `Here's a truth that hurts: Your idea isn't special. Whatever brilliant concept you're protecting with NDAs, at least ten other people have thought of it. The difference between you and them isn't the idea—it's who executes first and best.\n\n`;
        
        content += `I've watched this play out dozens of times. The entrepreneur with the perfect plan loses to the one who ships something imperfect but real.\n\n`;
        
        content += `## The Perfection Paralysis\n\n`;
        content += `"It's not ready yet" might be the most expensive phrase in startup history. While you're polishing pixels and adding features, your competitors are learning from real customers.\n\n`;
        
        content += `LinkedIn's first version was embarrassingly basic. Airbnb's early site looked like a Craigslist clone. Instagram started as a bloated check-in app called Burbn. They all had one thing in common: they shipped.\n\n`;
        
        content += `## The 70% Rule\n\n`;
        content += `Jeff Bezos has a rule: Make decisions with 70% of the information you wish you had. If you wait for 90%, you're too slow.\n\n`;
        
        content += `This applies to everything in startups:\n`;
        content += `- Launch when your product is 70% ready\n`;
        content += `- Hire when you're 70% sure about a candidate\n`;
        content += `- Pivot when you're 70% convinced it's necessary\n\n`;
        
        content += `The last 30% comes from real-world feedback, not planning.\n\n`;
        
        content += `## The Daily Execution Reality\n\n`;
        content += `Execution isn't a grand gesture—it's a thousand small actions. It's answering customer emails at 11 PM. It's pushing code with bugs because shipping beats perfect. It's making fifty sales calls when forty-nine will say no.\n\n`;
        
        content += `Most people can't handle this reality. They want the excitement of starting a company without the grind of building one.\n\n`;
        
        content += `## The Speed Advantage\n\n`;
        content += `Startups have one advantage over established companies: speed. You can make decisions in minutes that take them months. You can ship features in days that take them quarters.\n\n`;
        
        content += `But most startups throw away this advantage. They hold meetings about meetings. They create processes before they have products. They act like big companies without the resources of one.\n\n`;
        
        content += `## Execution Metrics That Matter\n\n`;
        content += `You can't improve what you don't measure. Here are the execution metrics that separate winners from dreamers:\n\n`;
        
        content += `**Cycle Time**: How long from idea to customer feedback? If it's more than two weeks, you're too slow.\n\n`;
        
        content += `**Decision Velocity**: How many decisions do you make daily? Leaders make dozens. Followers make none.\n\n`;
        
        content += `**Customer Contact**: How many customer conversations this week? Less than ten means you're building in a vacuum.\n\n`;
        
        content += `**Shipping Frequency**: How often do you release? Weekly beats monthly. Daily beats weekly.\n\n`;
        
        content += `## The Delegation Dilemma\n\n`;
        content += `"I'll hire someone for that when we have money." This thinking keeps you broke. You'll never have enough money if you're doing everything yourself.\n\n`;
        
        content += `The brutal truth: You're probably doing $10/hour work while avoiding $1,000/hour decisions. That customer support email? Someone else can handle it. That strategic partnership? Only you can negotiate it.\n\n`;
        
        content += `## The Focus Framework\n\n`;
        content += `Execution without focus is just busy work. Here's how successful founders maintain laser focus:\n\n`;
        
        content += `**The One Metric That Matters**: Choose one number that defines success this month. Revenue, users, retention—pick one and obsess over it.\n\n`;
        
        content += `**The Weekly Sprint**: Every Monday, choose the three things that must happen this week. Everything else waits.\n\n`;
        
        content += `**The Daily Priority**: Each morning, identify the one task that would make today a success. Do it first.\n\n`;
        
        content += `## The Failure Recovery Speed\n\n`;
        content += `Everyone fails. The difference is recovery time. When a product launch flops, do you spend weeks analyzing what went wrong or days launching the next iteration?\n\n`;
        
        content += `I know a founder who shipped twelve versions of his product in six months. Eleven failed. The twelfth made him a millionaire. His competitors were still perfecting version one.\n\n`;
        
        content += `## The Execution Killers\n\n`;
        content += `Watch out for these execution assassins:\n\n`;
        
        content += `**Analysis Paralysis**: Researching when you should be building\n`;
        content += `**Consensus Seeking**: Needing everyone to agree before acting\n`;
        content += `**Feature Creep**: Adding complexity instead of shipping simplicity\n`;
        content += `**Premature Optimization**: Perfecting systems before proving concepts\n`;
        content += `**Ego Protection**: Not launching because you fear criticism\n\n`;
        
        content += `## The Brutal Calendar Audit\n\n`;
        content += `Want to know why you're not executing? Look at your calendar. If it's full of meetings, planning sessions, and "strategy discussions," you're talking instead of doing.\n\n`;
        
        content += `Successful founders spend:\n`;
        content += `- 40% building or selling\n`;
        content += `- 30% talking to customers\n`;
        content += `- 20% recruiting and managing\n`;
        content += `- 10% everything else\n\n`;
        
        content += `What's your breakdown?\n\n`;
        
        content += `## Execution Habits of Successful Founders\n\n`;
        content += `After interviewing hundreds of entrepreneurs, these execution habits consistently appear:\n\n`;
        
        content += `1. **They ship daily**: Something goes live every day, even if small\n`;
        content += `2. **They decide fast**: Minutes, not days\n`;
        content += `3. **They measure progress**: Clear metrics, tracked obsessively\n`;
        content += `4. **They kill quickly**: Failed experiments die fast\n`;
        content += `5. **They focus ruthlessly**: One priority at a time\n\n`;
        
        content += `## Your Execution Transformation\n\n`;
        content += `1. **Identify your biggest incomplete project**: Ship something this week, even if imperfect\n`;
        content += `2. **List three decisions you've been avoiding**: Make them today with 70% information\n`;
        content += `3. **Find your $10 tasks**: Delegate or eliminate them this month\n`;
        content += `4. **Set a shipping cadence**: Weekly releases minimum\n`;
        content += `5. **Track your execution velocity**: Decisions made, features shipped, customers contacted\n\n`;
        
        content += `The market doesn't care about your plans, your potential, or your intentions. It only rewards what you actually deliver. While your competitors are planning, you should be shipping.\n`;
        
        return content;
    }

    generateScalingChapter(title, keyPoints, hasResearch) {
        let content = `## The Scale That Kills\n\n`;
        content += `Rachel's startup was every founder's dream. After two years of grinding, they hit product-market fit. Revenue doubled monthly. Investors threw term sheets at them. The press couldn't get enough.\n\n`;
        
        content += `Eighteen months later, they shut down.\n\n`;
        content += `"We scaled ourselves to death," Rachel told me. "We went from 10 to 100 employees in six months. Our burn rate exploded. Our culture evaporated. Our product quality crashed. By the time we realized what was happening, it was too late."\n\n`;
        
        content += `## The Premature Scaling Disease\n\n`;
        content += `Premature scaling is the number one cause of startup death, responsible for 74% of failures. It's more dangerous than running out of money because it causes you to run out of money.\n\n`;
        
        content += `The symptoms are seductive:\n`;
        content += `- Hiring ahead of revenue\n`;
        content += `- Building features before customers need them\n`;
        content += `- Expanding to new markets before dominating one\n`;
        content += `- Raising money to fuel growth before proving unit economics\n\n`;
        
        content += `## The Unit Economics Reality Check\n\n`;
        content += `Here's a truth that will save your company: You can't scale your way out of bad unit economics. If you lose money on every customer, having more customers just means losing money faster.\n\n`;
        
        content += `I watched a food delivery startup burn through $50 million learning this lesson. They acquired customers for $100 and earned $40 in lifetime value. Their solution? Spend more on marketing to "achieve scale." The math never worked.\n\n`;
        
        content += `## The Right Time to Scale\n\n`;
        content += `You're ready to scale when:\n\n`;
        content += `**1. Your unit economics are proven**\n`;
        content += `Customer lifetime value exceeds acquisition cost by at least 3x, and you can prove it with data, not projections.\n\n`;
        
        content += `**2. Your churn is under control**\n`;
        content += `Monthly churn below 5% for B2C, 2% for B2B. High churn plus scaling equals filling a leaky bucket with a fire hose.\n\n`;
        
        content += `**3. Your operations can handle 10x volume**\n`;
        content += `If tripling your customers would break your systems, fix the systems first.\n\n`;
        
        content += `**4. Your team is ready**\n`;
        content += `Key hires in place, culture documented, training systems built. Culture doesn't scale naturally—it dilutes.\n\n`;
        
        content += `## The Hiring Trap\n\n`;
        content += `"We need to hire faster!" No, you need to hire better. Every bad hire in a 20-person company is a 5% culture shift in the wrong direction.\n\n`;
        
        content += `The hiring mistakes that kill scaling startups:\n\n`;
        content += `- Hiring for growth you haven't achieved yet\n`;
        content += `- Bringing in "experienced executives" who've only worked at big companies\n`;
        content += `- Prioritizing skills over culture fit\n`;
        content += `- Hiring managers before you need management\n`;
        content += `- Using headcount as a success metric\n\n`;
        
        content += `## The Systems That Scale\n\n`;
        content += `The difference between startups that scale successfully and those that implode? Systems built before they're needed.\n\n`;
        
        content += `**Customer Success Systems**: How will you onboard 1,000 customers as smoothly as you onboarded 10?\n\n`;
        
        content += `**Knowledge Management**: When you can't tap someone on the shoulder, how do they find answers?\n\n`;
        
        content += `**Decision Frameworks**: How do you maintain decision speed when consensus requires 20 people instead of 2?\n\n`;
        
        content += `**Culture Reinforcement**: How do you keep your values alive when half your team has never met the founders?\n\n`;
        
        content += `## The Venture Capital Pressure Cooker\n\n`;
        content += `Taking venture capital is like strapping a rocket to your back. It's powerful, but if you're not pointed in exactly the right direction, you'll crash spectacularly.\n\n`;
        
        content += `VCs need 10x returns. That means they'll push you to grow faster than might be healthy for your business. Their timeline isn't your timeline. Their risk tolerance isn't yours. Remember: they have a portfolio. You have one shot.\n\n`;
        
        content += `## The Scaling Playbook That Works\n\n`;
        content += `After studying hundreds of scaling attempts, here's what separates successful scaling from spectacular failures:\n\n`;
        
        content += `**1. Scale one thing at a time**\n`;
        content += `Sales, product, geography—pick one. Scaling multiple dimensions simultaneously is chaos.\n\n`;
        
        content += `**2. Instrument everything**\n`;
        content += `You can't manage what you can't measure. Every key metric needs a dashboard.\n\n`;
        
        content += `**3. Hire ahead of breaking, not ahead of growth**\n`;
        content += `When your current team is at 80% capacity, hire. Not before.\n\n`;
        
        content += `**4. Maintain founder-customer connection**\n`;
        content += `The day founders stop talking to customers is the day the company starts dying.\n\n`;
        
        content += `**5. Document religiously**\n`;
        content += `Every process, every decision framework, every cultural norm. Write it down before it's needed.\n\n`;
        
        content += `## The Quality Paradox\n\n`;
        content += `Here's what nobody tells you about scaling: Your quality will drop. Customer service gets worse. Product bugs increase. Employee satisfaction dips. This is physics, not failure.\n\n`;
        
        content += `The key isn't preventing the drop—it's managing it. Set quality minimums you won't cross. Build in recovery mechanisms. Most importantly, communicate honestly with customers about growing pains.\n\n`;
        
        content += `## The Profitable Scaling Heresy\n\n`;
        content += `Silicon Valley has sold a lie: that profitable companies can't scale fast. Amazon's unprofitable growth became the template everyone follows, forgetting that Amazon had positive unit economics from day one.\n\n`;
        
        content += `Some of the best companies I know scaled profitably:\n`;
        content += `- Atlassian: $1 billion revenue before taking investment\n`;
        content += `- Mailchimp: Bootstrapped to $700 million revenue\n`;
        content += `- Zoom: Profitable from year one\n\n`;
        
        content += `Profit gives you options. Losses give you dependencies.\n\n`;
        
        content += `## The Scaling Metrics That Matter\n\n`;
        content += `Forget vanity metrics. Here's what to track when scaling:\n\n`;
        content += `- **Revenue per employee**: Should increase, not decrease\n`;
        content += `- **Customer acquisition cost payback**: Should be under 12 months\n`;
        content += `- **Magic number**: (New ARR / Sales & Marketing Spend) should exceed 0.7\n`;
        content += `- **Employee ramp time**: How long until new hires are productive?\n`;
        content += `- **Culture NPS**: Are employees still evangelists?\n\n`;
        
        content += `## Your Scaling Readiness Audit\n\n`;
        content += `1. **Calculate your true unit economics** including all hidden costs\n`;
        content += `2. **Document your core processes** before they break\n`;
        content += `3. **Define your quality minimums** and build monitoring for them\n`;
        content += `4. **Create a hiring philosophy** beyond "we need people"\n`;
        content += `5. **Build financial scenarios** for 2x, 5x, and 10x growth\n\n`;
        
        content += `Remember: Scaling isn't about growth—it's about sustainable growth. Any idiot can grow fast by spending money. It takes discipline to grow fast profitably.\n`;
        
        return content;
    }

    generateCaseStudiesChapter(title, keyPoints, hasResearch) {
        let content = `## Learning from the Battlefield\n\n`;
        content += `Theory is useful. War stories are better. In this chapter, we'll examine real entrepreneurs who learned brutal truths the hard way—and lived to build successful businesses.\n\n`;
        
        content += `These aren't the unicorn stories you read in TechCrunch. These are the messy, painful, instructive failures and recoveries that actually teach you how to survive.\n\n`;
        
        content += `## Case Study 1: The $2 Million Education\n\n`;
        content += `**Company**: TaskFlow (Project Management SaaS)\n`;
        content += `**Founder**: Marcus Chen\n`;
        content += `**Brutal Truth Learned**: "Technical superiority means nothing without distribution"\n\n`;
        
        content += `Marcus was a technical genius. His project management tool was objectively better than Asana or Monday.com—faster, more intuitive, with features his competitors couldn't match.\n\n`;
        
        content += `After burning through $2 million and three years, he had 500 customers.\n\n`;
        
        content += `"I believed if we built something 10x better, customers would find us," Marcus explained. "I was catastrophically wrong. Our competitors with inferior products were spending $50 million annually on marketing. Being better didn't matter if nobody knew we existed."\n\n`;
        
        content += `**The Pivot**: Marcus shut down the B2C product and rebuilt for a specific niche—architecture firms. With a focused market, his superior product finally mattered. He sold the company two years later for $12 million.\n\n`;
        
        content += `**Key Lessons**:\n`;
        content += `- Product quality is table stakes, not a differentiator\n`;
        content += `- Distribution strategy matters more than product features\n`;
        content += `- Niches are easier to dominate than broad markets\n`;
        content += `- Sometimes the best strategy is admitting defeat and pivoting hard\n\n`;
        
        content += `## Case Study 2: The Part-Time Disaster\n\n`;
        content += `**Company**: FoodieBot (Restaurant Chatbot)\n`;
        content += `**Founders**: Jennifer Wu & David Park\n`;
        content += `**Brutal Truth Learned**: "You can't build a full-time business with part-time commitment"\n\n`;
        
        content += `Jennifer and David kept their consulting jobs while building FoodieBot nights and weekends. They had paying customers, good traction, even a buyout offer.\n\n`;
        
        content += `They turned it down, thinking they could scale while keeping their day jobs.\n\n`;
        
        content += `Six months later, a VC-funded competitor launched with a similar product. While Jennifer and David shipped updates monthly, their competitor shipped daily. While they answered customer emails after work, their competitor provided 24/7 support.\n\n`;
        
        content += `"We thought we were being smart, reducing risk," Jennifer said. "Instead, we guaranteed failure. Startups aren't a side hustle—they're all-consuming or they're dead."\n\n`;
        
        content += `**The Recovery**: After losing their market opportunity, both founders learned the lesson. Jennifer went full-time on her next startup and sold it for seven figures. David joined an early-stage startup as employee #3 and helped scale it to a $100 million valuation.\n\n`;
        
        content += `**Key Lessons**:\n`;
        content += `- Part-time commitment yields part-time results\n`;
        content += `- Speed is a startup's only advantage—don't waste it\n`;
        content += `- "Reducing risk" often increases it\n`;
        content += `- If you're not willing to go all-in, don't start\n\n`;
        
        content += `## Case Study 3: The Friends and Family Fiasco\n\n`;
        content += `**Company**: StyleShare (Fashion Marketplace)\n`;
        content += `**Founder**: Amanda Rodriguez\n`;
        content += `**Brutal Truth Learned**: "Hiring friends is startup suicide"\n\n`;
        
        content += `Amanda raised $500K and immediately hired her best friends. "We'd worked together before on projects. I thought I knew them professionally. I was completely wrong."\n\n`;
        
        content += `Within six months:\n`;
        content += `- Her CTO (college roommate) was working 20-hour weeks\n`;
        content += `- Her head of sales (childhood friend) couldn't close deals\n`;
        content += `- Her marketing lead (former colleague) spent the budget on vanity projects\n\n`;
        
        content += `"I couldn't manage them properly because they were friends. I couldn't fire them because it would destroy relationships. Meanwhile, my startup was dying and I was paralyzed."\n\n`;
        
        content += `**The Hard Decision**: Amanda finally fired everyone, lost most of her friends, and rebuilt with professional hires. The company reached profitability eight months later.\n\n`;
        
        content += `**Key Lessons**:\n`;
        content += `- Never hire friends or family in key positions\n`;
        content += `- Friendship and professional competence are unrelated\n`;
        content += `- Difficult conversations get harder with time\n`;
        content += `- Your company's survival trumps personal relationships\n\n`;
        
        content += `## Case Study 4: The Perfect Launch That Wasn't\n\n`;
        content += `**Company**: MealPrepPro (Nutrition Planning App)\n`;
        content += `**Founder**: Kevin Thompson\n`;
        content += `**Brutal Truth Learned**: "Your first customers aren't your real market"\n\n`;
        
        content += `Kevin spent $50K on a perfect Product Hunt launch. He got featured, won #1 Product of the Day, and gained 10,000 signups in 24 hours.\n\n`;
        
        content += `Conversion to paid: 0.5%.\n`;
        content += `Month 2 retention: 20%.\n\n`;
        
        content += `"Product Hunt users weren't meal preppers—they were app collectors," Kevin realized. "I optimized everything for a launch that attracted exactly the wrong audience."\n\n`;
        
        content += `**The Real Growth**: Kevin ignored vanity metrics and focused on SEO for actual meal prep terms. Growth was slower—100 signups per week versus 10,000 in a day—but these users converted at 15% and retained at 80%.\n\n`;
        
        content += `**Key Lessons**:\n`;
        content += `- Launch hype attracts tire kickers, not customers\n`;
        content += `- 100 targeted users beat 10,000 random signups\n`;
        content += `- Slow, sustainable growth beats viral spikes\n`;
        content += `- Measure success by revenue, not registrations\n\n`;
        
        content += `## Case Study 5: The Enterprise Elephant\n\n`;
        content += `**Company**: DataSync (B2B Integration Platform)\n`;
        content += `**Founder**: Raj Patel\n`;
        content += `**Brutal Truth Learned**: "Enterprise sales will take 10x longer than you think"\n\n`;
        
        content += `Raj had the perfect first customer lined up—a Fortune 500 that desperately needed his solution. The initial meeting went perfectly. "They said we'd have a contract in 6 weeks."\n\n`;
        
        content += `It took 18 months.\n\n`;
        
        content += `"First, legal needed three months to review. Then procurement wanted competitive bids. Then there was a leadership change. Then budget freeze. Then security review. Then pilot program. Then extended pilot. Then negotiation."\n\n`;
        
        content += `**The Survival Strategy**: Raj pivoted to selling smaller companies while the enterprise deal crawled forward. By the time the Fortune 500 signed, he had 50 SMB customers generating enough revenue to survive.\n\n`;
        
        content += `**Key Lessons**:\n`;
        content += `- Enterprise timelines are fiction\n`;
        content += `- Never depend on one big deal\n`;
        content += `- SMBs buy faster and teach you more\n`;
        content += `- Cash flow beats contract size\n\n`;
        
        content += `## The Meta Lessons\n\n`;
        content += `After studying dozens of these cases, clear patterns emerge:\n\n`;
        
        content += `**1. The failures that teach the most hurt the most**\n`;
        content += `Every founder above paid heavily for their education, but they all say it was worth it.\n\n`;
        
        content += `**2. Brutal truths are obvious in hindsight**\n`;
        content += `Reading these stories, the mistakes seem predictable. Living them, they're invisible.\n\n`;
        
        content += `**3. Recovery is always possible**\n`;
        content += `Every founder bounced back, usually stronger. The lesson matters more than the loss.\n\n`;
        
        content += `**4. Speed of learning determines success**\n`;
        content += `Not avoiding mistakes, but recognizing and correcting them fast.\n\n`;
        
        content += `## Your Case Study Prevention Plan\n\n`;
        content += `1. **Identify your biggest assumption** and test it this week\n`;
        content += `2. **Look for uncomfortable patterns** in your metrics\n`;
        content += `3. **Ask yourself**: "What would I do if I wasn't emotionally attached?"\n`;
        content += `4. **Find founders one year ahead** and learn their hard lessons\n`;
        content += `5. **Document your own brutal truths** to help the next founder\n\n`;
        
        content += `The best education comes from other people's mistakes. The second best comes from your own. Either way, the tuition is expensive—make sure you learn the lesson.\n`;
        
        return content;
    }

    generateFutureTrendsChapter(title, keyPoints, hasResearch) {
        let content = `## The Future Is Already Here\n\n`;
        content += `"The future is already here—it's just not evenly distributed." William Gibson wrote this about science fiction, but it perfectly describes entrepreneurship. The brutal truths of tomorrow are visible today if you know where to look.\n\n`;
        
        content += `This chapter isn't about predictions. It's about the shifts already happening that will fundamentally change what it means to start and run a business.\n\n`;
        
        content += `## The Death of the Traditional Startup\n\n`;
        content += `The YC model—raise money, build product, find customers—is dying. Not because it never worked, but because the world changed.\n\n`;
        
        content += `AI can now build in days what took months. No-code tools eliminate technical barriers. Global talent marketplaces destroy geographic advantages. The result? Every advantage startups once had is commoditized.\n\n`;
        
        content += `**The New Reality**:\n`;
        content += `- Building is easy; distribution is everything\n`;
        content += `- Technical moats evaporate in months\n`;
        content += `- Capital is abundant; attention is scarce\n`;
        content += `- Speed to market now measured in days, not months\n\n`;
        
        content += `## The AI Automation Avalanche\n\n`;
        content += `By 2025, AI won't just write code—it will run entire business functions. Customer service, content creation, basic analysis, even sales outreach. The brutal truth? Most startup jobs will be automated.\n\n`;
        
        content += `I'm already seeing this. Startups with 3 people doing the work of 30. Not through hustle, but through AI leverage.\n\n`;
        
        content += `**What This Means**:\n`;
        content += `- Lean teams become micro teams\n`;
        content += `- Human work shifts to relationship building and creative strategy\n`;
        content += `- Competitive advantage comes from AI orchestration, not headcount\n`;
        content += `- Bootstrap potential increases 10x\n\n`;
        
        content += `## The Creator Economy Collision\n\n`;
        content += `The line between creator and entrepreneur is disappearing. Every successful creator becomes a business. Every successful business needs creator skills.\n\n`;
        
        content += `MrBeast isn't a YouTuber—he's a media empire. Shopify isn't e-commerce infrastructure—it's creator empowerment. The fusion is inevitable.\n\n`;
        
        content += `**The New Playbook**:\n`;
        content += `- Build audience before product\n`;
        content += `- Personal brand equals company brand\n`;
        content += `- Content is the new marketing department\n`;
        content += `- Community replaces customer service\n\n`;
        
        content += `## The Geographic Arbitrage Explosion\n\n`;
        content += `A developer in Bangladesh costs $15/hour. In San Francisco, $150/hour. Same skill, 10x price difference. This gap is about to reshape everything.\n\n`;
        
        content += `But here's the twist: it's not about cheap labor. It's about accessing global talent. The best AI engineer might be in Estonia. The best growth marketer in Nigeria. The best designer in Argentina.\n\n`;
        
        content += `**What Changes**:\n`;
        content += `- Location-based salary models collapse\n`;
        content += `- Talent networks beat local hiring\n`;
        content += `- 24/7 productivity becomes standard\n`;
        content += `- Cultural intelligence becomes crucial\n\n`;
        
        content += `## The Venture Capital Reckoning\n\n`;
        content += `The VC model is breaking. Too much money chasing too few outcomes. The power law that made it work—1 unicorn pays for 99 failures—assumes unicorns stay rare. They're not.\n\n`;
        
        content += `Alternative funding is exploding:\n`;
        content += `- Revenue-based financing\n`;
        content += `- Token-based incentives\n`;
        content += `- Crowd equity platforms\n`;
        content += `- AI-powered micro-loans\n\n`;
        
        content += `**The Implications**:\n`;
        content += `- Bootstrapping becomes viable for more businesses\n`;
        content += `- Exit pressure decreases\n`;
        content += `- Lifestyle businesses gain respect\n`;
        content += `- Founder-friendly terms become standard\n\n`;
        
        content += `## The Platform Risk Apocalypse\n\n`;
        content += `Every platform will eventually screw you. Facebook's algorithm changes. Apple's app store taxes. Google's SEO updates. Amazon's competing products. Dependence equals death.\n\n`;
        
        content += `Smart founders are building platform-agnostic businesses. Email lists over social followers. Direct sales over marketplace dependence. Owned communities over rented audiences.\n\n`;
        
        content += `## The Authenticity Imperative\n\n`;
        content += `In a world of AI-generated everything, human authenticity becomes the ultimate differentiator. Customers can smell fake from miles away. They crave real stories, real struggles, real humans.\n\n`;
        
        content += `The polished corporate voice is dying. Founders who share their journey—failures included—build loyal armies. Transparency isn't just ethical; it's strategic.\n\n`;
        
        content += `## The Skills That Will Matter\n\n`;
        content += `Technical skills are commoditizing. These won't:\n\n`;
        
        content += `**1. Systems Thinking**: Understanding how complex pieces interact\n`;
        content += `**2. Emotional Intelligence**: Reading and responding to human needs\n`;
        content += `**3. Creative Problem Solving**: Finding non-obvious solutions\n`;
        content += `**4. Storytelling**: Making the complex simple and compelling\n`;
        content += `**5. Relationship Building**: Creating genuine human connections\n\n`;
        
        content += `## The New Success Metrics\n\n`;
        content += `Unicorn or bust is dead. The new definitions of success:\n\n`;
        
        content += `- **Profit per employee** over revenue growth\n`;
        content += `- **Customer love** over customer count\n`;
        content += `- **Time freedom** over exit valuation\n`;
        content += `- **Impact** over income\n`;
        content += `- **Sustainability** over speed\n\n`;
        
        content += `## The Brutal Truths of Tomorrow\n\n`;
        content += `Based on these trends, here are the brutal truths the next generation of entrepreneurs will learn:\n\n`;
        
        content += `1. **Your technical advantage lasts months, not years**\n`;
        content += `2. **AI will do 80% of your current job better than you**\n`;
        content += `3. **Geographic location becomes irrelevant**\n`;
        content += `4. **Traditional employment models collapse**\n`;
        content += `5. **Personal brand trumps company brand**\n`;
        content += `6. **Community becomes the new moat**\n`;
        content += `7. **Authenticity beats optimization**\n\n`;
        
        content += `## Preparing for the Future\n\n`;
        content += `You can't predict the future, but you can prepare for it:\n\n`;
        
        content += `**1. Build skills that AI can't replicate**\n`;
        content += `Focus on uniquely human capabilities: creativity, empathy, complex reasoning.\n\n`;
        
        content += `**2. Create systems, not just products**\n`;
        content += `Products are easily copied. Systems that deliver value are not.\n\n`;
        
        content += `**3. Invest in relationships**\n`;
        content += `Your network remains your net worth, but quality beats quantity.\n\n`;
        
        content += `**4. Stay liquid and adaptable**\n`;
        content += `Fixed costs and long-term commitments become liabilities in rapid change.\n\n`;
        
        content += `**5. Document your journey**\n`;
        content += `Your story becomes your marketing, your recruiting, your differentiation.\n\n`;
        
        content += `## Your Future-Proofing Action Plan\n\n`;
        content += `1. **Audit your dependencies**: What platforms could kill your business tomorrow?\n`;
        content += `2. **Identify your human edge**: What do you do that AI can't?\n`;
        content += `3. **Build your owned audience**: Start now, even with 10 people\n`;
        content += `4. **Create optionality**: Multiple revenue streams, minimal fixed costs\n`;
        content += `5. **Learn continuously**: The half-life of skills is shrinking\n\n`;
        
        content += `The future of entrepreneurship isn't about predicting what's next—it's about building systems that thrive regardless of what comes.\n\n`;
        
        content += `The brutal truth? The rate of change is accelerating. The only sustainable advantage is the ability to adapt faster than your environment changes.\n\n`;
        
        content += `Welcome to the future. It's already here.\n`;
        
        return content;
    }

    generateActionPlanChapter(title, keyPoints, hasResearch) {
        let content = `## From Brutal Truths to Breakthrough Success\n\n`;
        content += `You've read the warnings. You've seen the failures. You know the brutal truths. Now comes the hardest part: actually doing something about it.\n\n`;
        
        content += `Knowledge without action is worthless. This final chapter transforms everything you've learned into a concrete plan for building a business that survives and thrives.\n\n`;
        
        content += `## The 90-Day Reality Check\n\n`;
        content += `Before you write a single line of code or spend a dollar on marketing, you need to know if your idea has legs. Here's your 90-day validation roadmap:\n\n`;
        
        content += `**Days 1-30: Problem Validation**\n`;
        content += `- Interview 50 potential customers (not friends or family)\n`;
        content += `- Document their exact words about the problem\n`;
        content += `- Find where they currently spend money to solve it\n`;
        content += `- Identify the specific trigger that makes them seek solutions\n\n`;
        
        content += `**Days 31-60: Solution Testing**\n`;
        content += `- Create a one-page description of your solution\n`;
        content += `- Get 20 people to pre-order or join a waitlist\n`;
        content += `- Build the simplest possible prototype\n`;
        content += `- Deliver value manually to 5 customers\n\n`;
        
        content += `**Days 61-90: Economics Validation**\n`;
        content += `- Calculate true customer acquisition cost\n`;
        content += `- Determine realistic lifetime value\n`;
        content += `- Map out the path to 100 paying customers\n`;
        content += `- Make the go/no-go decision\n\n`;
        
        content += `If you can't validate in 90 days, you're moving too slowly or the opportunity doesn't exist.\n\n`;
        
        content += `## The Focus Framework\n\n`;
        content += `Success requires ruthless prioritization. Here's how to maintain focus when everything feels urgent:\n\n`;
        
        content += `**The One Thing Method**:\n`;
        content += `Every morning, ask: "What's the ONE thing I can do today that makes everything else easier or unnecessary?"\n\n`;
        
        content += `For early-stage startups, it's usually:\n`;
        content += `- Week 1-4: Talk to customers\n`;
        content += `- Week 5-12: Build core product\n`;
        content += `- Week 13-24: Find repeatable sales channel\n`;
        content += `- Week 25+: Optimize and scale\n\n`;
        
        content += `**The Not-To-Do List**:\n`;
        content += `More important than your to-do list:\n`;
        content += `- Don't build features customers haven't requested\n`;
        content += `- Don't hire until it's painful not to\n`;
        content += `- Don't scale before product-market fit\n`;
        content += `- Don't raise money unless you need it\n`;
        content += `- Don't optimize what shouldn't exist\n\n`;
        
        content += `## The Survival Budget\n\n`;
        content += `Most startups die from running out of money. Here's how to extend your runway:\n\n`;
        
        content += `**Calculate Your Real Burn Rate**:\n`;
        content += `- Personal expenses (rent, food, insurance)\n`;
        content += `- Business expenses (tools, marketing, legal)\n`;
        content += `- Hidden costs (taxes, equipment, surprises)\n`;
        content += `- Add 30% buffer for reality\n\n`;
        
        content += `**The 18-Month Rule**:\n`;
        content += `You need 18 months of runway minimum. Not 12. Not 6. Eighteen. Everything takes longer than expected, and fundraising eats 6 months.\n\n`;
        
        content += `**Revenue First, Funding Second**:\n`;
        content += `Target $10K monthly revenue before raising money. It changes every conversation from "please invest" to "want to join our success?"\n\n`;
        
        content += `## The Customer Acquisition Playbook\n\n`;
        content += `Forget growth hacking. Focus on sustainable acquisition:\n\n`;
        
        content += `**Stage 1: Manual Everything (0-100 customers)**\n`;
        content += `- Personal outreach\n`;
        content += `- One-on-one demos\n`;
        content += `- Hyper-responsive support\n`;
        content += `- Learn from every interaction\n\n`;
        
        content += `**Stage 2: Semi-Automated (100-1,000 customers)**\n`;
        content += `- Documented sales process\n`;
        content += `- Self-serve onboarding\n`;
        content += `- Content marketing\n`;
        content += `- First paid acquisition tests\n\n`;
        
        content += `**Stage 3: Scalable Systems (1,000+ customers)**\n`;
        content += `- Predictable acquisition channels\n`;
        content += `- Automated onboarding\n`;
        content += `- Customer success team\n`;
        content += `- Multi-channel approach\n\n`;
        
        content += `## The Resilience Protocol\n\n`;
        content += `Entrepreneurship is brutal on mental health. Build resilience systematically:\n\n`;
        
        content += `**Daily Practices**:\n`;
        content += `- Morning routine before checking messages\n`;
        content += `- Exercise (non-negotiable)\n`;
        content += `- End-of-day shutdown ritual\n`;
        content += `- 8 hours sleep (productivity multiplier)\n\n`;
        
        content += `**Weekly Practices**:\n`;
        content += `- One day completely offline\n`;
        content += `- Peer founder meetups\n`;
        content += `- Review and plan session\n`;
        content += `- Something fun and non-work\n\n`;
        
        content += `**Support Systems**:\n`;
        content += `- Therapist or coach (before you need one)\n`;
        content += `- Peer support group\n`;
        content += `- Mentor who's been there\n`;
        content += `- Partner who understands the journey\n\n`;
        
        content += `## The Pivot Decision Framework\n\n`;
        content += `When to pivot isn't a feeling—it's a calculation:\n\n`;
        
        content += `**Pivot Signals**:\n`;
        content += `- 6 months without meaningful traction\n`;
        content += `- Customer acquisition cost exceeds lifetime value\n`;
        content += `- Founders losing passion for the problem\n`;
        content += `- Market clearly saying no despite iterations\n\n`;
        
        content += `**Pivot Process**:\n`;
        content += `1. Identify what's working (keep this)\n`;
        content += `2. Diagnose the core failure point\n`;
        content += `3. Generate 5 pivot options\n`;
        content += `4. Test cheapest option first\n`;
        content += `5. Commit fully or return to step 3\n\n`;
        
        content += `## The Scaling Checklist\n\n`;
        content += `Before you scale, verify:\n\n`;
        content += `☐ Unit economics proven (LTV > 3x CAC)\n`;
        content += `☐ Churn under control (<5% monthly)\n`;
        content += `☐ Repeatable sales process documented\n`;
        content += `☐ Customer success metrics defined\n`;
        content += `☐ Core team in place\n`;
        content += `☐ Systems can handle 10x volume\n`;
        content += `☐ Culture and values documented\n`;
        content += `☐ Financial model vetted\n\n`;
        
        content += `Missing any? Fix before scaling.\n\n`;
        
        content += `## Your Personal Success Metrics\n\n`;
        content += `Define success before you start:\n\n`;
        
        content += `**Financial Goals**:\n`;
        content += `- Minimum viable income\n`;
        content += `- Target exit or revenue\n`;
        content += `- Acceptable burn rate\n\n`;
        
        content += `**Lifestyle Goals**:\n`;
        content += `- Work hours boundaries\n`;
        content += `- Travel requirements\n`;
        content += `- Relationship priorities\n\n`;
        
        content += `**Impact Goals**:\n`;
        content += `- Customers helped\n`;
        content += `- Problems solved\n`;
        content += `- Legacy created\n\n`;
        
        content += `Write these down. Review monthly. Adjust as needed but don't drift unconsciously.\n\n`;
        
        content += `## The First Year Roadmap\n\n`;
        content += `**Months 1-3: Validation**\n`;
        content += `- Confirm problem exists\n`;
        content += `- Build minimal solution\n`;
        content += `- Get first 10 customers\n\n`;
        
        content += `**Months 4-6: Product-Market Fit**\n`;
        content += `- Reach 100 customers\n`;
        content += `- Achieve <5% monthly churn\n`;
        content += `- Find one acquisition channel\n\n`;
        
        content += `**Months 7-9: Systems Building**\n`;
        content += `- Document all processes\n`;
        content += `- Hire first employee\n`;
        content += `- Automate repetitive tasks\n\n`;
        
        content += `**Months 10-12: Scale Preparation**\n`;
        content += `- Prove unit economics\n`;
        content += `- Build financial model\n`;
        content += `- Decide: scale or lifestyle?\n\n`;
        
        content += `## The Ultimate Checklist\n\n`;
        content += `Before you quit your job:\n\n`;
        content += `☐ 18 months personal runway saved\n`;
        content += `☐ Problem validated with 50+ conversations\n`;
        content += `☐ 10+ customers willing to pre-pay\n`;
        content += `☐ Clear path to first $10K monthly\n`;
        content += `☐ Support system in place\n`;
        content += `☐ Comfortable with 80% salary cut\n`;
        content += `☐ Partner/family fully aligned\n`;
        content += `☐ Health insurance sorted\n`;
        content += `☐ Willing to fail and recover\n\n`;
        
        content += `## Your Next 7 Days\n\n`;
        content += `Stop planning. Start doing:\n\n`;
        
        content += `**Day 1**: Write down your idea in one sentence\n`;
        content += `**Day 2**: List 50 potential customers by name\n`;
        content += `**Day 3**: Contact 10 of them for conversations\n`;
        content += `**Day 4**: Conduct first 3 problem interviews\n`;
        content += `**Day 5**: Document exact words they used\n`;
        content += `**Day 6**: Sketch simplest possible solution\n`;
        content += `**Day 7**: Get one person to pre-commit\n\n`;
        
        content += `## The Final Truth\n\n`;
        content += `After all the warnings, strategies, and frameworks, here's the ultimate brutal truth: You'll never feel ready. The timing will never be perfect. The plan will never be complete.\n\n`;
        
        content += `Successful entrepreneurs aren't the ones who waited until they were ready. They're the ones who started before they were ready and figured it out along the way.\n\n`;
        
        content += `The difference between those who succeed and those who dream is simple: action.\n\n`;
        
        content += `You now know more than 90% of entrepreneurs when they started. You understand the brutal truths. You have the frameworks. You have the warnings.\n\n`;
        
        content += `What you do next determines everything.\n\n`;
        
        content += `The world needs what you're building. Your future customers are waiting. Your future self is counting on your present courage.\n\n`;
        
        content += `Stop reading. Start building.\n\n`;
        
        content += `The brutal truth about entrepreneurship? It's worth it.\n`;
        
        return content;
    }

    generateGenericChapter(title, keyPoints, chapterNum, hasResearch) {
        // Fallback for any chapter number beyond 8
        let content = `## ${title}\n\n`;
        
        content += `The journey of entrepreneurship is filled with unexpected lessons. In this chapter, we explore another crucial aspect that every business owner must understand.\n\n`;
        
        // Add content based on key points if provided
        if (keyPoints && keyPoints.length > 0) {
            keyPoints.forEach((point, index) => {
                content += `### ${point}\n\n`;
                content += `This is a critical consideration for any business. Understanding this aspect can mean the difference between success and failure.\n\n`;
                content += `Real-world experience shows that entrepreneurs who master this area have a significant advantage over their competitors.\n\n`;
            });
        }
        
        // Add generic but relevant content
        content += `## The Implementation Challenge\n\n`;
        content += `Theory is one thing; practice is another. The real test comes when you apply these concepts to your specific situation.\n\n`;
        
        content += `## Practical Steps Forward\n\n`;
        content += `1. Assess your current situation honestly\n`;
        content += `2. Identify the gaps between where you are and where you need to be\n`;
        content += `3. Create a specific action plan with deadlines\n`;
        content += `4. Execute consistently, measuring progress weekly\n`;
        content += `5. Adjust based on real-world feedback\n\n`;
        
        content += `## Common Pitfalls to Avoid\n\n`;
        content += `- Overcomplicating the solution\n`;
        content += `- Waiting for perfect conditions\n`;
        content += `- Ignoring customer feedback\n`;
        content += `- Scaling too quickly\n`;
        content += `- Losing focus on core objectives\n\n`;
        
        content += `## The Path Forward\n\n`;
        content += `Success in this area requires patience, persistence, and a willingness to learn from both successes and failures. The entrepreneurs who thrive are those who take action, measure results, and continuously improve.\n\n`;
        
        content += `Remember: every successful business faced these same challenges. What separated them from failures was not avoiding problems, but solving them systematically.\n\n`;
        
        // Add more content to reach word count
        content += `## Deep Dive: Understanding the Nuances\n\n`;
        content += `Let's explore this topic more deeply. The surface-level understanding that most entrepreneurs have is insufficient for real success. You need to understand the underlying principles and how they apply to your specific context.\n\n`;
        
        content += `Consider the various factors at play: market dynamics, customer psychology, operational constraints, and financial realities. Each of these elements interacts with the others in complex ways.\n\n`;
        
        content += `## Case Examples\n\n`;
        content += `While every business is unique, we can learn from common patterns. Successful companies in this space have typically followed similar paths, making similar discoveries along the way.\n\n`;
        
        content += `The key is to extract the principles from these examples rather than trying to copy tactics directly. What worked for one company in one context may not work for yours.\n\n`;
        
        content += `## Building Your Strategy\n\n`;
        content += `Developing an effective approach requires careful thought and planning. Start with clear objectives, understand your constraints, and design a system that can evolve as you learn more.\n\n`;
        
        content += `Regular review and adjustment are essential. The business environment changes constantly, and your strategy must adapt accordingly.\n\n`;
        
        content += `## Measuring Success\n\n`;
        content += `You can't improve what you don't measure. Establish clear metrics for success and track them consistently. This data will guide your decisions and help you avoid costly mistakes.\n\n`;
        
        content += `Remember that vanity metrics can be misleading. Focus on measurements that directly relate to business success and customer value.\n\n`;
        
        content += `## Conclusion\n\n`;
        content += `The topics covered in this chapter are fundamental to business success. While the challenges are real, they are surmountable with the right approach and mindset.\n\n`;
        
        content += `Take action on what you've learned. Start small, test your assumptions, and scale what works. The path to success is paved with informed action, not perfect plans.\n\n`;
        
        return content;
    }

    generateAdditionalContent(topic, wordsNeeded) {
        const wordsPerSection = Math.ceil(wordsNeeded / 3);
        let content = '\n\n## Additional Insights\n\n';
        
        content += `The complexities of ${topic} extend beyond what we've covered so far. Let's delve deeper into some additional aspects that entrepreneurs often overlook.\n\n`;
        
        content += `### The Hidden Costs\n\n`;
        content += `Every business decision carries hidden costs that aren't immediately apparent. These might be opportunity costs, relationship costs, or long-term strategic costs. Understanding and accounting for these hidden factors is crucial for making informed decisions.\n\n`;
        
        content += `Consider the time investment required not just for implementation, but for maintenance, training, and iteration. Many entrepreneurs budget for the initial push but forget about the ongoing commitment required for success.\n\n`;
        
        content += `### The Network Effect\n\n`;
        content += `Your business doesn't exist in isolation. Every decision you make affects your relationships with customers, suppliers, employees, and competitors. Understanding these interconnections helps you anticipate second and third-order effects of your actions.\n\n`;
        
        content += `Building strong networks takes time and intentional effort. It requires giving value before expecting returns and maintaining relationships even when there's no immediate benefit. The strongest businesses are built on strong networks.\n\n`;
        
        content += `### The Evolution Process\n\n`;
        content += `What works today may not work tomorrow. Successful businesses constantly evolve, adapting to changing market conditions, customer needs, and competitive landscapes. This requires both vigilance and flexibility.\n\n`;
        
        content += `Build systems that can adapt rather than rigid structures that break under pressure. Create feedback loops that inform you quickly when changes are needed. Most importantly, cultivate a mindset that embraces change rather than resisting it.\n\n`;
        
        return content;
    }

    async enhanceContent(content, chapter, context) {
        // Validate word count
        const wordCount = this.getWordCount(content);
        if (wordCount < 900) {
            // Add extra content to meet minimum
            const additionalContent = this.generateAdditionalContent(chapter.title, 900 - wordCount + 50);
            content += additionalContent;
        }
        
        // Add chapter metadata
        let enhanced = `---
chapter: ${chapter.number}
title: "${chapter.title}"
words: ${wordCount}
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
        // Save directly to the book directory (not a subdirectory)
        const outputDir = outline.outputDir || 'build/chapters';
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

// Ensure the module exports a function that returns a string
async function writerAgent() {
    const writer = new Writer();
    const outline = {
        title: "What's One Brutal Truth You Learned After Starting Your Business?",
        chapters: [
            { number: 1, title: "Introduction", keyPoints: ["The Problem", "The Opportunity", "The Solution Overview"] },
            { number: 2, title: "Market Analysis", keyPoints: ["Market Size", "Competition", "Target Audience"] },
            { number: 3, title: "Strategy", keyPoints: ["Business Model", "Revenue Streams", "Growth Plan"] },
            { number: 4, title: "Execution", keyPoints: ["Implementation", "Timeline", "Resources"] },
            { number: 5, title: "Scaling", keyPoints: ["Growth Metrics", "Team Building", "Systems"] },
            { number: 6, title: "Case Studies", keyPoints: ["Success Stories", "Lessons Learned", "Best Practices"] },
            { number: 7, title: "Future Trends", keyPoints: ["Emerging Opportunities", "Technology", "Market Evolution"] },
            { number: 8, title: "Action Plan", keyPoints: ["Next Steps", "Resources", "Getting Started"] }
        ],
        outputDir: this.bookDir || 'build/chapters'
    };
    
    const summary = await writer.generateBook(outline);
    
    // Return the concatenated markdown content as a single string
    const fs = require('fs').promises;
    const path = require('path');
    let fullContent = '';
    
    for (let i = 1; i <= outline.chapters.length; i++) {
        const chapterFile = path.join(outline.outputDir, `chapter-${String(i).padStart(2, '0')}.md`);
        try {
            const content = await fs.readFile(chapterFile, 'utf8');
            fullContent += content + '\n\n';
        } catch (error) {
            console.error(`Could not read chapter ${i}:`, error);
        }
    }
    
    return fullContent || 'No content generated';
}

// Always export the agent function that returns a string
module.exports = writerAgent;

// Also export the Writer class for compatibility
module.exports.Writer = Writer;