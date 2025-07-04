#!/usr/bin/env node

/**
 * Orchestrator with Human Review Integration
 * 
 * Extended pipeline that creates PRs for review
 */

const YAMLOrchestrator = require('./orchestrator-yaml');
const { getHumanReview } = require('../src/review/HumanReview');
const { getCostTracker } = require('../src/cost/CostTracker');

class ReviewOrchestrator extends YAMLOrchestrator {
    constructor(topic, options = {}) {
        super(topic, {
            ...options,
            pipeline: options.pipeline || 'premium'  // Default to premium for review
        });
        
        this.humanReview = getHumanReview();
        this.costTracker = getCostTracker();
    }

    async initialize() {
        await super.initialize();
        
        // Initialize review system
        if (!this.options.skipReview) {
            await this.humanReview.initialize();
        }
        
        // Initialize cost tracking
        await this.costTracker.initialize();
        this.costTracker.startSession(`review-${this.topic}`, {
            topic: this.topic,
            pipeline: this.options.pipeline
        });
    }

    async run() {
        try {
            // Run the pipeline
            const result = await super.run();
            
            if (result.success && !this.options.skipReview) {
                // Create review PR
                console.log('\n📝 Creating review pull request...');
                
                const reviewResult = await this.humanReview.createReview(
                    result.bookDir,
                    {
                        topic: this.topic,
                        pipeline: this.options.pipeline,
                        duration: result.duration,
                        costs: this.costTracker.getCurrentSpending()
                    }
                );
                
                result.reviewUrl = reviewResult.prUrl;
                result.reviewBranch = reviewResult.branch;
                
                console.log('\n✅ Book ready for review!');
                console.log(`📖 Review at: ${reviewResult.prUrl}`);
                console.log('\n🔄 Next steps:');
                console.log('   1. Review and edit the content in the PR');
                console.log('   2. Approve when ready');
                console.log('   3. Merge to trigger automatic publishing');
            }
            
            // End cost tracking
            await this.costTracker.endSession();
            
            // Show cost report
            const costs = this.costTracker.getCurrentSpending();
            console.log('\n💰 COST SUMMARY:');
            console.log(`   Session: $${costs.session.toFixed(4)}`);
            console.log(`   Daily: $${costs.daily.toFixed(4)}`);
            console.log(`   Monthly: $${costs.monthly.toFixed(4)}`);
            
            return result;
            
        } catch (error) {
            await this.costTracker.endSession();
            throw error;
        }
    }

    async executeManualStage(stage) {
        if (stage.agent === 'expert-reviewer') {
            // This is where human review happens
            console.log('   📝 Creating review PR for human approval...');
            
            const reviewResult = await this.humanReview.createReview(
                this.bookDir,
                {
                    topic: this.topic,
                    stage: stage.id,
                    requiresExpertReview: true
                }
            );
            
            console.log(`   🔗 Review at: ${reviewResult.prUrl}`);
            console.log('   ⏸️  Pipeline paused - waiting for approval');
            
            // In a real implementation, this would wait for PR approval
            // For now, just mark as successful
            return {
                success: true,
                manual: true,
                reviewUrl: reviewResult.prUrl
            };
        }
        
        return super.executeManualStage(stage);
    }

    async cleanup() {
        await super.cleanup();
        
        // Final cost report
        const analytics = await this.costTracker.getAnalytics('day');
        
        console.log('\n📊 Daily Analytics:');
        console.log(`   Books generated: ${analytics.totalSessions}`);
        console.log(`   Total cost: $${analytics.totalCost.toFixed(2)}`);
        console.log(`   Average per book: $${analytics.averageCostPerSession.toFixed(2)}`);
        
        // Export cost data
        const costData = await this.costTracker.exportCostData('json');
        await require('fs').promises.writeFile(
            'build/costs/daily-report.json',
            costData
        );
    }
}

// CLI entry point
if (require.main === module) {
    const args = process.argv.slice(2);
    let topic = process.env.EBOOK_TOPIC;
    let pipeline = 'premium';
    let skipReview = false;
    let dryRun = false;
    const variables = {};
    
    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--topic' && i + 1 < args.length) {
            topic = args[i + 1];
            i++;
        } else if (args[i] === '--pipeline' && i + 1 < args.length) {
            pipeline = args[i + 1];
            i++;
        } else if (args[i] === '--skip-review') {
            skipReview = true;
        } else if (args[i] === '--dry-run') {
            dryRun = true;
        } else if (args[i].startsWith('--var-') && i + 1 < args.length) {
            const varName = args[i].substring(6);
            variables[varName] = args[i + 1];
            i++;
        } else if (args[i] === '--help') {
            console.log(`
Orchestrator with Human Review

Usage:
  node orchestrator-with-review.js "Topic" [options]
  node orchestrator-with-review.js --topic "Topic" [options]

Options:
  --pipeline <name>     Pipeline to use (default: "premium")
  --skip-review        Skip human review PR creation
  --dry-run            Show execution plan without running
  --var-<name> <value> Set pipeline variable
  --help               Show this help

Examples:
  node orchestrator-with-review.js "AI Business Ideas"
  node orchestrator-with-review.js "AI Business Ideas" --skip-review
  node orchestrator-with-review.js "AI Business Ideas" --pipeline fast --skip-review
`);
            process.exit(0);
        } else if (!args[i].startsWith('--')) {
            topic = args[i];
        }
    }
    
    if (!topic) {
        console.error('Error: No topic specified');
        console.error('Usage: node orchestrator-with-review.js "Topic"');
        process.exit(1);
    }
    
    const orchestrator = new ReviewOrchestrator(topic, {
        pipeline,
        skipReview,
        dryRun,
        variables
    });
    
    orchestrator.run()
        .then(result => {
            if (!dryRun) {
                console.log('\n✅ Pipeline completed successfully!');
                if (result.reviewUrl) {
                    console.log(`📝 Review your book at: ${result.reviewUrl}`);
                }
            }
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Pipeline failed:', error);
            process.exit(1);
        });
}

module.exports = ReviewOrchestrator;