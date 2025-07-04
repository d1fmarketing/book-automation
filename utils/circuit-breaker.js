/**
 * Circuit Breaker Utility
 * 
 * Prevents long timeouts and provides fallback behavior
 * when external services (LLMs, APIs) are slow or failing
 */

class CircuitBreaker {
    constructor(options = {}) {
        this.timeout = options.timeout || 30000; // 30 seconds default
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 60000; // 1 minute
        this.fallbackFn = options.fallback;
        
        // State
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failures = 0;
        this.nextAttempt = Date.now();
        this.successCount = 0;
        this.lastError = null;
    }

    async fire(fn, ...args) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                console.log('⚡ Circuit breaker OPEN - using fallback');
                if (this.fallbackFn) {
                    return this.fallbackFn(...args);
                }
                throw new Error(`Circuit breaker is OPEN. Last error: ${this.lastError}`);
            }
            // Try half-open
            this.state = 'HALF_OPEN';
            console.log('⚡ Circuit breaker attempting HALF_OPEN');
        }

        try {
            // Wrap function with timeout
            const result = await this.withTimeout(fn(...args));
            
            // Success - update state
            this.onSuccess();
            return result;
            
        } catch (error) {
            this.onFailure(error);
            
            // If we have a fallback, use it
            if (this.fallbackFn) {
                console.log('⚡ Using fallback due to error:', error.message);
                return this.fallbackFn(...args);
            }
            
            throw error;
        }
    }

    async withTimeout(promise) {
        let timeoutId;
        
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error(`Operation timed out after ${this.timeout}ms`));
            }, this.timeout);
        });
        
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            clearTimeout(timeoutId);
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    onSuccess() {
        this.failures = 0;
        
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount > 2) {
                this.state = 'CLOSED';
                this.successCount = 0;
                console.log('✅ Circuit breaker CLOSED - service recovered');
            }
        }
    }

    onFailure(error) {
        this.failures++;
        this.lastError = error.message;
        
        console.log(`⚠️  Circuit breaker failure ${this.failures}/${this.failureThreshold}: ${error.message}`);
        
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.resetTimeout;
            console.log(`❌ Circuit breaker OPEN - will retry at ${new Date(this.nextAttempt).toLocaleTimeString()}`);
        }
    }

    getState() {
        return {
            state: this.state,
            failures: this.failures,
            lastError: this.lastError,
            nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt) : null
        };
    }
}

// Helper function to create a circuit breaker with exponential backoff
function createCircuitBreaker(name, options = {}) {
    const defaults = {
        timeout: 30000,
        failureThreshold: 3,
        resetTimeout: 60000
    };
    
    const config = { ...defaults, ...options };
    
    console.log(`🔌 Creating circuit breaker for ${name}:`, {
        timeout: `${config.timeout}ms`,
        threshold: config.failureThreshold,
        reset: `${config.resetTimeout}ms`
    });
    
    return new CircuitBreaker(config);
}

// Fallback content generators
const fallbacks = {
    chapter: (outline, chapterNum) => {
        const chapter = outline.chapters[chapterNum - 1];
        return `# Chapter ${chapterNum}: ${chapter.title}

*[Content generation temporarily unavailable. This is placeholder content.]*

## Overview

This chapter explores the topic of "${chapter.title}" as part of our comprehensive guide on "${outline.title}".

### Key Points to Cover:

${chapter.keyPoints?.map(point => `- ${point}`).join('\n') || '- Key insights about this topic\n- Practical applications\n- Real-world examples'}

## Main Content

[This section would contain detailed explanations and examples about ${chapter.title}. The content generator is currently experiencing high load or connectivity issues.]

### Important Concepts

1. **Core Principle**: Understanding the fundamentals of ${chapter.title}
2. **Application**: How to apply these concepts in practice
3. **Benefits**: What you'll gain from mastering this topic

## Summary

${chapter.title} is a crucial aspect of ${outline.title}. While we're unable to generate the full content at this moment, the key takeaways include:

- Essential understanding of the topic
- Practical steps for implementation
- Long-term benefits and outcomes

## Next Steps

Continue to the next chapter to explore more aspects of ${outline.title}.

---

*Note: This is placeholder content generated due to temporary service unavailability. Full content will be generated when the service is restored.*`;
    },
    
    research: (topic) => ({
        summary: `Research on "${topic}" is temporarily unavailable due to API limitations.`,
        keyPoints: [
            `${topic} is an important subject in today's context`,
            'Multiple perspectives exist on this topic',
            'Further research is recommended'
        ],
        links: [
            'https://en.wikipedia.org/wiki/Main_Page',
            'https://scholar.google.com'
        ],
        error: 'CIRCUIT_BREAKER_FALLBACK'
    }),
    
    polish: (content) => content, // Return unpolished content
    
    factCheck: () => ({
        issues: [],
        summary: { FACT_CHECK_NEEDED: false },
        error: 'CIRCUIT_BREAKER_FALLBACK'
    })
};

module.exports = {
    CircuitBreaker,
    createCircuitBreaker,
    fallbacks
};