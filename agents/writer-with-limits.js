#!/usr/bin/env node

/**
 * Writer Agent with Rate Limiting and Cost Tracking
 * 
 * Enhanced writer that respects API limits and tracks costs
 */

const { Writer } = require('./writer');
const { getRateLimiter } = require('../src/middleware/RateLimiter');
const { getCostTracker } = require('../src/cost/CostTracker');
const { createCircuitBreaker } = require('../utils/circuit-breaker');

class WriterWithLimits extends Writer {
    constructor(options = {}) {
        super(options);
        
        // Initialize rate limiter and cost tracker
        this.rateLimiter = getRateLimiter();
        this.costTracker = getCostTracker();
        
        // Initialize circuit breaker with rate limit awareness
        this.circuitBreaker = createCircuitBreaker('writer', {
            timeout: 30000,
            failureThreshold: 3,
            resetTimeout: 60000,
            fallback: this.generateFallbackContent.bind(this)
        });
        
        // Track if we're initialized
        this.initialized = false;
    }
    
    async initialize() {
        if (this.initialized) return;
        
        await this.costTracker.initialize();
        this.initialized = true;
        
        console.log('💰 Writer initialized with rate limiting and cost tracking');
    }
    
    async generateChapter(outline, chapterNumber, options = {}) {
        await this.initialize();
        
        // Start cost tracking session
        const sessionId = `chapter-${outline.title}-${chapterNumber}-${Date.now()}`;
        this.costTracker.startSession(sessionId, {
            topic: outline.title,
            chapter: chapterNumber,
            style: options.style || this.style
        });
        
        try {
            // Check rate limits before proceeding
            const limitCheck = await this.rateLimiter.checkLimit('anthropic', 'request');
            
            if (!limitCheck.allowed) {
                console.error(`❌ Rate limit exceeded: ${limitCheck.reason}`);
                console.log(`⏰ Reset in: ${Math.ceil(limitCheck.resetIn / 1000)} seconds`);
                
                // Use fallback content if rate limited
                return this.generateFallbackChapter(outline, chapterNumber);
            }
            
            // Apply delay if throttled
            if (limitCheck.delay) {
                console.log(`⏱️ Throttled - waiting ${limitCheck.delay}ms`);
                await this.sleep(limitCheck.delay);
            }
            
            // Generate chapter with circuit breaker
            const result = await this.circuitBreaker.fire(
                () => super.generateChapter(outline, chapterNumber, options)
            );
            
            // Record successful usage
            if (result.success) {
                await this.recordUsage(result);
            }
            
            return result;
            
        } catch (error) {
            console.error('❌ Error generating chapter:', error.message);
            
            // Check if it's a rate limit error
            if (error.message.includes('rate') || error.message.includes('429')) {
                await this.rateLimiter.recordUsage('anthropic', 'request', 1);
                return this.generateFallbackChapter(outline, chapterNumber);
            }
            
            throw error;
            
        } finally {
            // End cost tracking session
            const session = await this.costTracker.endSession();
            
            // Check if we're approaching budget limits
            const spending = this.costTracker.getCurrentSpending();
            const budgets = this.costTracker.budgets;
            
            if (budgets.perBook && spending.session > budgets.perBook * 0.5) {
                console.warn(`⚠️  Book budget warning: $${spending.session.toFixed(2)} of $${budgets.perBook}`);
            }
        }
    }
    
    async callClaude(prompt) {
        // Estimate tokens (rough estimate: 1 token ≈ 4 characters)
        const inputTokens = Math.ceil(prompt.length / 4);
        const estimatedOutputTokens = 3000; // Typical chapter length
        
        // Check token limits
        const tokenCheck = await this.rateLimiter.checkLimit('anthropic', 'token', inputTokens + estimatedOutputTokens);
        
        if (!tokenCheck.allowed) {
            console.error(`❌ Token limit exceeded: ${tokenCheck.reason}`);
            throw new Error('Token limit exceeded');
        }
        
        // Record the request
        await this.rateLimiter.recordUsage('anthropic', 'request', 1);
        
        // Call the actual API (or use fallback)
        const startTime = Date.now();
        const result = await super.callClaude(prompt);
        const duration = Date.now() - startTime;
        
        // Calculate actual tokens used
        const outputTokens = Math.ceil(result.length / 4);
        const totalTokens = inputTokens + outputTokens;
        
        // Record token usage
        await this.rateLimiter.recordUsage('anthropic', 'token', totalTokens);
        
        // Track costs (using Claude 3 Opus pricing)
        this.costTracker.trackLLMUsage('anthropic', 'claude-3-opus', inputTokens, outputTokens);
        
        console.log(`📊 API call completed in ${duration}ms - ${totalTokens} tokens used`);
        
        return result;
    }
    
    async recordUsage(result) {
        // This is called after successful generation
        // Additional metrics can be recorded here
        console.log(`✅ Chapter generated successfully`);
    }
    
    generateFallbackChapter(outline, chapterNumber) {
        const chapter = outline.chapters[chapterNumber - 1];
        
        console.warn('⚠️  Using fallback content due to rate limits');
        
        const content = `# ${chapter.title}

*[This chapter is being generated with limited API access. Full content will be available once rate limits reset.]*

## Overview

${chapter.summary || `This chapter explores ${chapter.title} as part of ${outline.title}.`}

## Key Topics

${(chapter.keyPoints || []).map(point => `- ${point}`).join('\n')}

## Main Content

[Content generation is temporarily limited due to API rate limits. The service will automatically retry when limits reset.]

### What You'll Learn

${(chapter.keyPoints || ['Core concepts', 'Practical applications', 'Real-world examples']).map((point, i) => `${i + 1}. ${point}`).join('\n')}

## Summary

This chapter provides essential insights into ${chapter.title}. Once API limits reset, the full content will be generated with detailed explanations, examples, and actionable advice.

## Next Steps

Continue to the next chapter or wait for rate limits to reset for full content generation.

---

*Rate limit will reset at: ${new Date(Date.now() + 3600000).toLocaleString()}*`;
        
        return {
            success: true,
            path: null,
            content: content,
            wordCount: content.split(/\s+/).length,
            fallback: true
        };
    }
    
    generateFallbackContent(outline, chapterNumber) {
        console.log('🔄 Circuit breaker activated - using fallback');
        return this.generateFallbackChapter(outline, chapterNumber).content;
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    async getUsageReport() {
        const rateLimitStatus = this.rateLimiter.getStatus('anthropic');
        const currentSpending = this.costTracker.getCurrentSpending();
        const budgets = this.costTracker.budgets;
        
        return {
            rateLimits: rateLimitStatus,
            costs: {
                current: currentSpending,
                budgets: budgets,
                percentUsed: {
                    daily: budgets.daily ? (currentSpending.daily / budgets.daily * 100).toFixed(1) + '%' : 'N/A',
                    monthly: budgets.monthly ? (currentSpending.monthly / budgets.monthly * 100).toFixed(1) + '%' : 'N/A',
                    perBook: budgets.perBook ? (currentSpending.session / budgets.perBook * 100).toFixed(1) + '%' : 'N/A'
                }
            }
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--status')) {
        // Show current usage status
        (async () => {
            const writer = new WriterWithLimits();
            await writer.initialize();
            
            const report = await writer.getUsageReport();
            console.log('\n📊 USAGE REPORT');
            console.log('================');
            console.log('\nRate Limits:');
            console.log(JSON.stringify(report.rateLimits, null, 2));
            console.log('\nCosts:');
            console.log(JSON.stringify(report.costs, null, 2));
        })();
        
    } else if (args.includes('--help') || args.length === 0) {
        console.log(`
Writer with Rate Limiting and Cost Tracking

Usage:
  node writer-with-limits.js --outline <path> --chapter <number> [options]
  node writer-with-limits.js --status

Options:
  --outline <path>   Path to outline.json
  --chapter <n>      Chapter number to write
  --output <dir>     Output directory
  --style <type>     Writing style
  --status           Show current usage status

Environment Variables:
  ANTHROPIC_API_KEY   Required for content generation
  DAILY_BUDGET        Daily spending limit (default: $10)
  MONTHLY_BUDGET      Monthly spending limit (default: $200)
  BOOK_BUDGET         Per-book spending limit (default: $2)
        `);
        
    } else {
        // Run normal writer flow
        const { Writer } = require('./writer');
        // Reuse the existing CLI logic from writer.js
        const originalModule = require.main;
        require.main = module;
        require('./writer');
        require.main = originalModule;
    }
}

module.exports = WriterWithLimits;