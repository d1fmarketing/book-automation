/**
 * Cost Tracker
 * 
 * Tracks API costs for ebook generation
 * Provides real-time cost monitoring and budget management
 */

const fs = require('fs').promises;
const path = require('path');
const { getMetricsCollector } = require('../monitoring/MetricsCollector');

// API Pricing (in USD)
const PRICING = {
    anthropic: {
        'claude-3-opus': {
            input: 0.015,      // per 1K tokens
            output: 0.075      // per 1K tokens
        },
        'claude-3-sonnet': {
            input: 0.003,
            output: 0.015
        },
        'claude-3-haiku': {
            input: 0.00025,
            output: 0.00125
        }
    },
    openai: {
        'gpt-4': {
            input: 0.03,
            output: 0.06
        },
        'gpt-4-turbo': {
            input: 0.01,
            output: 0.03
        },
        'gpt-3.5-turbo': {
            input: 0.0005,
            output: 0.0015
        }
    },
    perplexity: {
        'sonar-pro': {
            perSearch: 0.005   // per search
        },
        'sonar': {
            perSearch: 0.0005
        }
    },
    ideogram: {
        'v1': {
            perImage: 0.08     // per image
        },
        'v2': {
            perImage: 0.10
        }
    },
    deepseek: {
        'chat': {
            input: 0.00014,
            output: 0.00028
        },
        'coder': {
            input: 0.00014,
            output: 0.00028
        }
    }
};

class CostTracker {
    constructor(options = {}) {
        this.options = {
            dataFile: path.join('build', 'costs', 'cost-data.json'),
            budgetFile: path.join('build', 'costs', 'budgets.json'),
            alertThreshold: 0.8, // Alert at 80% of budget
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.data = {
            sessions: {},
            daily: {},
            monthly: {},
            total: 0
        };
        this.budgets = {
            daily: null,
            monthly: null,
            perBook: null
        };
        this.currentSession = null;
    }

    async initialize() {
        // Create costs directory
        await fs.mkdir(path.dirname(this.options.dataFile), { recursive: true });
        
        // Load existing data
        await this.loadData();
        await this.loadBudgets();
    }

    async loadData() {
        try {
            const content = await fs.readFile(this.options.dataFile, 'utf8');
            this.data = JSON.parse(content);
        } catch (error) {
            // File doesn't exist, use defaults
        }
    }

    async saveData() {
        await fs.writeFile(
            this.options.dataFile,
            JSON.stringify(this.data, null, 2)
        );
    }

    async loadBudgets() {
        try {
            const content = await fs.readFile(this.options.budgetFile, 'utf8');
            this.budgets = JSON.parse(content);
        } catch (error) {
            // Use default budgets
            this.budgets = {
                daily: 10.00,     // $10/day
                monthly: 200.00,  // $200/month
                perBook: 2.00     // $2/book
            };
        }
    }

    async saveBudgets() {
        await fs.writeFile(
            this.options.budgetFile,
            JSON.stringify(this.budgets, null, 2)
        );
    }

    /**
     * Start a new cost tracking session
     */
    startSession(sessionId, metadata = {}) {
        this.currentSession = {
            id: sessionId,
            startTime: Date.now(),
            costs: {
                llm: 0,
                search: 0,
                images: 0,
                total: 0
            },
            usage: {
                tokens: { input: 0, output: 0 },
                searches: 0,
                images: 0
            },
            metadata,
            breakdown: []
        };
        
        this.data.sessions[sessionId] = this.currentSession;
        console.log(`💰 Cost tracking started for session: ${sessionId}`);
    }

    /**
     * Track LLM API usage
     */
    trackLLMUsage(service, model, inputTokens, outputTokens) {
        if (!this.currentSession) return;
        
        const pricing = PRICING[service]?.[model];
        if (!pricing) {
            console.warn(`⚠️  Unknown pricing for ${service}/${model}`);
            return;
        }
        
        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;
        const totalCost = inputCost + outputCost;
        
        // Update session
        this.currentSession.costs.llm += totalCost;
        this.currentSession.costs.total += totalCost;
        this.currentSession.usage.tokens.input += inputTokens;
        this.currentSession.usage.tokens.output += outputTokens;
        
        // Add to breakdown
        this.currentSession.breakdown.push({
            timestamp: Date.now(),
            type: 'llm',
            service,
            model,
            inputTokens,
            outputTokens,
            cost: totalCost
        });
        
        // Update metrics
        this.metrics.recordTokenUsage(service, model, inputTokens + outputTokens);
        this.metrics.recordAPICost(service, 'tokens', Math.round(totalCost * 100));
        
        // Check budget
        this.checkBudget();
        
        console.log(`💸 LLM cost: $${totalCost.toFixed(4)} (${service}/${model})`);
    }

    /**
     * Track search API usage
     */
    trackSearchUsage(service, model, searches = 1) {
        if (!this.currentSession) return;
        
        const pricing = PRICING[service]?.[model];
        if (!pricing) {
            console.warn(`⚠️  Unknown pricing for ${service}/${model}`);
            return;
        }
        
        const cost = searches * pricing.perSearch;
        
        // Update session
        this.currentSession.costs.search += cost;
        this.currentSession.costs.total += cost;
        this.currentSession.usage.searches += searches;
        
        // Add to breakdown
        this.currentSession.breakdown.push({
            timestamp: Date.now(),
            type: 'search',
            service,
            model,
            searches,
            cost
        });
        
        // Update metrics
        this.metrics.recordAPICost(service, 'search', Math.round(cost * 100));
        
        // Check budget
        this.checkBudget();
        
        console.log(`💸 Search cost: $${cost.toFixed(4)} (${service}/${model})`);
    }

    /**
     * Track image generation usage
     */
    trackImageUsage(service, model, images = 1) {
        if (!this.currentSession) return;
        
        const pricing = PRICING[service]?.[model];
        if (!pricing) {
            console.warn(`⚠️  Unknown pricing for ${service}/${model}`);
            return;
        }
        
        const cost = images * pricing.perImage;
        
        // Update session
        this.currentSession.costs.images += cost;
        this.currentSession.costs.total += cost;
        this.currentSession.usage.images += images;
        
        // Add to breakdown
        this.currentSession.breakdown.push({
            timestamp: Date.now(),
            type: 'image',
            service,
            model,
            images,
            cost
        });
        
        // Update metrics
        this.metrics.recordAPICost(service, 'image', Math.round(cost * 100));
        
        // Check budget
        this.checkBudget();
        
        console.log(`💸 Image cost: $${cost.toFixed(4)} (${service}/${model})`);
    }

    /**
     * End cost tracking session
     */
    async endSession() {
        if (!this.currentSession) return;
        
        const session = this.currentSession;
        session.endTime = Date.now();
        session.duration = session.endTime - session.startTime;
        
        // Update daily and monthly totals
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        
        this.data.daily[today] = (this.data.daily[today] || 0) + session.costs.total;
        this.data.monthly[month] = (this.data.monthly[month] || 0) + session.costs.total;
        this.data.total += session.costs.total;
        
        // Save data
        await this.saveData();
        
        // Generate report
        const report = this.generateSessionReport(session);
        console.log(report);
        
        this.currentSession = null;
        
        return session;
    }

    /**
     * Generate session cost report
     */
    generateSessionReport(session) {
        const duration = ((session.duration || 0) / 1000 / 60).toFixed(1);
        
        let report = '\n💰 SESSION COST REPORT\n';
        report += '========================\n';
        report += `Session ID: ${session.id}\n`;
        report += `Duration: ${duration} minutes\n`;
        report += '\nCosts:\n';
        report += `  LLM: $${session.costs.llm.toFixed(4)}\n`;
        report += `  Search: $${session.costs.search.toFixed(4)}\n`;
        report += `  Images: $${session.costs.images.toFixed(4)}\n`;
        report += `  TOTAL: $${session.costs.total.toFixed(4)}\n`;
        report += '\nUsage:\n';
        report += `  Tokens: ${session.usage.tokens.input + session.usage.tokens.output} (${session.usage.tokens.input} in, ${session.usage.tokens.output} out)\n`;
        report += `  Searches: ${session.usage.searches}\n`;
        report += `  Images: ${session.usage.images}\n`;
        
        return report;
    }

    /**
     * Check budget limits
     */
    checkBudget() {
        if (!this.currentSession) return;
        
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        
        const dailySpent = this.data.daily[today] || 0;
        const monthlySpent = this.data.monthly[month] || 0;
        const sessionSpent = this.currentSession.costs.total;
        
        // Check per-book budget
        if (this.budgets.perBook && sessionSpent >= this.budgets.perBook * this.options.alertThreshold) {
            console.warn(`⚠️  Book budget alert: $${sessionSpent.toFixed(2)} of $${this.budgets.perBook} (${Math.round(sessionSpent / this.budgets.perBook * 100)}%)`);
        }
        
        // Check daily budget
        if (this.budgets.daily && dailySpent >= this.budgets.daily * this.options.alertThreshold) {
            console.warn(`⚠️  Daily budget alert: $${dailySpent.toFixed(2)} of $${this.budgets.daily} (${Math.round(dailySpent / this.budgets.daily * 100)}%)`);
        }
        
        // Check monthly budget
        if (this.budgets.monthly && monthlySpent >= this.budgets.monthly * this.options.alertThreshold) {
            console.warn(`⚠️  Monthly budget alert: $${monthlySpent.toFixed(2)} of $${this.budgets.monthly} (${Math.round(monthlySpent / this.budgets.monthly * 100)}%)`);
        }
        
        // Hard stop if over budget
        if (this.budgets.perBook && sessionSpent > this.budgets.perBook) {
            throw new Error(`Book budget exceeded: $${sessionSpent.toFixed(2)} > $${this.budgets.perBook}`);
        }
    }

    /**
     * Get current spending
     */
    getCurrentSpending() {
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);
        
        return {
            session: this.currentSession?.costs.total || 0,
            daily: this.data.daily[today] || 0,
            monthly: this.data.monthly[month] || 0,
            total: this.data.total
        };
    }

    /**
     * Get cost analytics
     */
    async getAnalytics(period = 'month') {
        const now = new Date();
        const sessions = Object.values(this.data.sessions);
        
        let filteredSessions;
        if (period === 'day') {
            const today = now.toISOString().split('T')[0];
            filteredSessions = sessions.filter(s => 
                new Date(s.startTime).toISOString().split('T')[0] === today
            );
        } else if (period === 'month') {
            const month = now.toISOString().substring(0, 7);
            filteredSessions = sessions.filter(s => 
                new Date(s.startTime).toISOString().substring(0, 7) === month
            );
        } else {
            filteredSessions = sessions;
        }
        
        // Calculate analytics
        const analytics = {
            period,
            totalCost: 0,
            totalSessions: filteredSessions.length,
            averageCostPerSession: 0,
            breakdown: {
                llm: 0,
                search: 0,
                images: 0
            },
            usage: {
                tokens: 0,
                searches: 0,
                images: 0
            },
            topExpenses: []
        };
        
        filteredSessions.forEach(session => {
            analytics.totalCost += session.costs.total;
            analytics.breakdown.llm += session.costs.llm;
            analytics.breakdown.search += session.costs.search;
            analytics.breakdown.images += session.costs.images;
            analytics.usage.tokens += session.usage.tokens.input + session.usage.tokens.output;
            analytics.usage.searches += session.usage.searches;
            analytics.usage.images += session.usage.images;
        });
        
        if (analytics.totalSessions > 0) {
            analytics.averageCostPerSession = analytics.totalCost / analytics.totalSessions;
        }
        
        // Find top expenses
        analytics.topExpenses = filteredSessions
            .sort((a, b) => b.costs.total - a.costs.total)
            .slice(0, 5)
            .map(s => ({
                id: s.id,
                cost: s.costs.total,
                topic: s.metadata?.topic || 'Unknown',
                date: new Date(s.startTime).toISOString()
            }));
        
        return analytics;
    }

    /**
     * Set budget limits
     */
    async setBudget(type, amount) {
        if (!['daily', 'monthly', 'perBook'].includes(type)) {
            throw new Error(`Invalid budget type: ${type}`);
        }
        
        this.budgets[type] = amount;
        await this.saveBudgets();
        
        console.log(`💰 Budget set: ${type} = $${amount}`);
    }

    /**
     * Calculate ROI
     */
    calculateROI(bookPrice, booksSold) {
        const spending = this.getCurrentSpending();
        const revenue = bookPrice * booksSold;
        const profit = revenue - spending.total;
        const roi = (profit / spending.total) * 100;
        
        return {
            spending: spending.total,
            revenue,
            profit,
            roi,
            breakEvenBooks: Math.ceil(spending.total / bookPrice)
        };
    }

    /**
     * Export cost data
     */
    async exportCostData(format = 'json') {
        const data = {
            generated: new Date().toISOString(),
            ...this.data,
            budgets: this.budgets
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            // Convert to CSV
            let csv = 'Session ID,Start Time,Duration,LLM Cost,Search Cost,Image Cost,Total Cost\n';
            
            Object.values(this.data.sessions).forEach(session => {
                csv += `${session.id},`;
                csv += `${new Date(session.startTime).toISOString()},`;
                csv += `${(session.duration || 0) / 1000 / 60},`;
                csv += `${session.costs.llm.toFixed(4)},`;
                csv += `${session.costs.search.toFixed(4)},`;
                csv += `${session.costs.images.toFixed(4)},`;
                csv += `${session.costs.total.toFixed(4)}\n`;
            });
            
            return csv;
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }
}

// Singleton instance
let instance;

function getCostTracker(options) {
    if (!instance) {
        instance = new CostTracker(options);
    }
    return instance;
}

module.exports = {
    CostTracker,
    getCostTracker,
    PRICING
};