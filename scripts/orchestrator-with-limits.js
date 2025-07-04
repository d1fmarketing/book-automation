#!/usr/bin/env node

/**
 * Orchestrator with Rate Limiting and Cost Tracking
 * 
 * Enhanced orchestrator that manages API limits and tracks costs
 */

const HybridOrchestrator = require('./orchestrator-hybrid');
const { getRateLimiter } = require('../src/middleware/RateLimiter');
const { getCostTracker } = require('../src/cost/CostTracker');
const path = require('path');

class OrchestratorWithLimits extends HybridOrchestrator {
    constructor(topic, options = {}) {
        super(topic, options);
        
        // Initialize rate limiter and cost tracker
        this.rateLimiter = getRateLimiter();
        this.costTracker = getCostTracker();
        
        // Override writer to use limited version
        this.agents.writer = path.join(__dirname, '../agents/writer-with-limits.js');
        
        console.log('💰 Orchestrator initialized with rate limiting and cost tracking');
    }
    
    async run(job = null) {
        // Initialize cost tracking
        await this.costTracker.initialize();
        
        // Start cost session for entire book
        const sessionId = `book-${this.topic}-${Date.now()}`;
        this.costTracker.startSession(sessionId, {
            topic: this.topic,
            chapters: this.options.chapters,
            style: this.options.style
        });
        
        try {
            // Check if we have budget available
            const spending = this.costTracker.getCurrentSpending();
            const budgets = this.costTracker.budgets;
            
            if (budgets.daily && spending.daily >= budgets.daily) {
                throw new Error(`Daily budget exceeded: $${spending.daily.toFixed(2)} >= $${budgets.daily}`);
            }
            
            if (budgets.monthly && spending.monthly >= budgets.monthly) {
                throw new Error(`Monthly budget exceeded: $${spending.monthly.toFixed(2)} >= $${budgets.monthly}`);
            }
            
            // Show current status
            console.log('\n💵 Budget Status:');
            console.log(`  Daily: $${spending.daily.toFixed(2)} / $${budgets.daily || '∞'}`);
            console.log(`  Monthly: $${spending.monthly.toFixed(2)} / $${budgets.monthly || '∞'}`);
            console.log(`  Per Book: $${budgets.perBook || '∞'}`);
            
            // Check rate limit status
            const anthropicStatus = this.rateLimiter.getStatus('anthropic');
            console.log('\n🚦 Rate Limit Status:');
            console.log(`  Requests: ${anthropicStatus.percentages.minute || '0%'} (minute), ${anthropicStatus.percentages.hour || '0%'} (hour)`);
            
            if (anthropicStatus.throttle.paused) {
                console.error('❌ Anthropic API is paused due to rate limits');
                console.log('⏰ Will retry in:', anthropicStatus.throttle.delay / 1000, 'seconds');
                
                if (job) {
                    await job.updateProgress({ 
                        stage: 'paused', 
                        percent: 0, 
                        message: 'Waiting for rate limits to reset...' 
                    });
                }
                
                // Wait for unpause
                await this.sleep(anthropicStatus.throttle.delay);
            }
            
            // Run the normal orchestration
            const result = await super.run(job);
            
            return result;
            
        } catch (error) {
            console.error('❌ Orchestration failed:', error.message);
            
            // Record the failure
            if (job) {
                await job.updateProgress({ 
                    stage: 'failed', 
                    percent: 0, 
                    message: error.message 
                });
            }
            
            throw error;
            
        } finally {
            // End cost session and show report
            const session = await this.costTracker.endSession();
            
            if (session) {
                console.log('\n💰 COST REPORT');
                console.log('================');
                console.log(`Book: ${this.topic}`);
                console.log(`Total Cost: $${session.costs.total.toFixed(4)}`);
                console.log(`Chapters: ${this.options.chapters}`);
                console.log(`Cost per Chapter: $${(session.costs.total / this.options.chapters).toFixed(4)}`);
                
                // Calculate ROI
                const bookPrice = 9.99; // Assumed book price
                const breakEven = Math.ceil(session.costs.total / bookPrice);
                console.log(`\nBreak-even: ${breakEven} books at $${bookPrice}`);
                
                // Check if we stayed within budget
                const budgets = this.costTracker.budgets;
                if (budgets.perBook) {
                    if (session.costs.total <= budgets.perBook) {
                        console.log(`✅ Within budget: $${session.costs.total.toFixed(2)} <= $${budgets.perBook}`);
                    } else {
                        console.warn(`⚠️  Over budget: $${session.costs.total.toFixed(2)} > $${budgets.perBook}`);
                    }
                }
            }
        }
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        console.log(`
Orchestrator with Rate Limiting and Cost Tracking

Usage:
  node orchestrator-with-limits.js <topic> [options]

Options:
  --chapters <n>     Number of chapters (default: 10)
  --style <type>     Writing style (default: business)
  --workdir <path>   Working directory
  --budget <amount>  Set per-book budget

Environment Variables:
  ANTHROPIC_API_KEY   Required for content generation
  DAILY_BUDGET        Daily spending limit
  MONTHLY_BUDGET      Monthly spending limit
  BOOK_BUDGET         Per-book spending limit

Examples:
  # Generate with default budget
  node orchestrator-with-limits.js "AI Business Guide"
  
  # Set specific book budget
  BOOK_BUDGET=3.00 node orchestrator-with-limits.js "AI Guide" --chapters 15
        `);
        process.exit(0);
    }
    
    const topic = args[0];
    const options = {};
    
    // Parse arguments
    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.slice(2).split('=');
            const value = valueParts.join('=') || args[++i];
            
            if (key === 'chapters') {
                options.chapters = parseInt(value);
            } else if (key === 'style') {
                options.style = value;
            } else if (key === 'workdir') {
                options.workDir = value;
            } else if (key === 'budget') {
                process.env.BOOK_BUDGET = value;
            }
        }
    }
    
    // Set budgets from environment
    if (process.env.DAILY_BUDGET || process.env.MONTHLY_BUDGET || process.env.BOOK_BUDGET) {
        (async () => {
            const costTracker = getCostTracker();
            await costTracker.initialize();
            
            if (process.env.DAILY_BUDGET) {
                await costTracker.setBudget('daily', parseFloat(process.env.DAILY_BUDGET));
            }
            if (process.env.MONTHLY_BUDGET) {
                await costTracker.setBudget('monthly', parseFloat(process.env.MONTHLY_BUDGET));
            }
            if (process.env.BOOK_BUDGET) {
                await costTracker.setBudget('perBook', parseFloat(process.env.BOOK_BUDGET));
            }
        })();
    }
    
    // Run orchestrator
    const orchestrator = new OrchestratorWithLimits(topic, options);
    
    orchestrator.run().then(result => {
        if (!result.success) {
            process.exit(1);
        }
    }).catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = OrchestratorWithLimits;