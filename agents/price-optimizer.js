#!/usr/bin/env node

/**
 * PriceOptimizer Agent
 * 
 * Analyzes sales data and market conditions to dynamically adjust ebook pricing
 * for maximum revenue. Implements various pricing strategies and A/B testing.
 * 
 * Usage:
 *   agentcli call price.optimize --ebook-id="abc123" --platform="gumroad"
 *   node agents/price-optimizer.js --analyze="build/analytics/sales.json"
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer');

// Pricing configuration
const PRICING_CONFIG = {
    strategies: {
        penetration: {
            name: 'Market Penetration',
            description: 'Start low to gain market share',
            priceRange: { min: 0.99, max: 4.99 },
            duration: 30 // days
        },
        premium: {
            name: 'Premium Positioning',
            description: 'High price for perceived value',
            priceRange: { min: 19.99, max: 49.99 },
            requirements: ['high_quality_score', 'niche_authority']
        },
        psychological: {
            name: 'Psychological Pricing',
            description: 'Price points that convert better',
            points: [0.99, 2.99, 4.99, 7.99, 9.99, 14.99, 19.99, 27.99, 37.99, 47.99]
        },
        dynamic: {
            name: 'Dynamic Demand-Based',
            description: 'Adjust based on real-time demand',
            factors: ['sales_velocity', 'conversion_rate', 'market_conditions']
        },
        bundle: {
            name: 'Bundle Pricing',
            description: 'Discount for multiple books',
            discounts: { 2: 0.15, 3: 0.25, 5: 0.35 } // 15%, 25%, 35% off
        }
    },
    
    platforms: {
        gumroad: {
            api: 'https://api.gumroad.com/v2',
            minPrice: 0.99,
            maxPrice: 999.99,
            currency: 'USD'
        },
        amazon: {
            minPrice: 0.99,
            maxPrice: 9.99, // for 70% royalty
            royaltyThreshold: 2.99
        }
    },
    
    elasticity: {
        // Price elasticity coefficients by niche
        'Business/Money': -1.2, // elastic
        'AI/Technology': -0.8,  // less elastic
        'Health/Fitness': -1.5, // very elastic
        'Self-Help': -1.3,      // elastic
        'Fiction': -2.0         // highly elastic
    },
    
    seasons: {
        'new_year': { months: [1], multiplier: 1.2 },      // Higher prices in January
        'summer': { months: [6, 7, 8], multiplier: 0.9 }, // Summer sale
        'black_friday': { days: [325, 330], multiplier: 0.5 }, // Day 325-330 of year
        'holiday': { months: [12], multiplier: 1.1 }       // December pricing
    }
};

class PriceOptimizer {
    constructor(options = {}) {
        this.minDataPoints = options.minDataPoints || 100; // Minimum sales for analysis
        this.testDuration = options.testDuration || 7;     // Days per price test
        this.maxPriceChange = options.maxPriceChange || 0.5; // Max 50% change at once
        this.platforms = options.platforms || ['gumroad'];
        
        // API credentials
        this.gumroadToken = options.gumroadToken || process.env.GUMROAD_ACCESS_TOKEN;
        
        // State
        this.currentTests = new Map();
    }

    async optimizePricing(ebookId, options = {}) {
        console.log('💰 Starting Price Optimization');
        console.log(`📚 Ebook ID: ${ebookId}`);
        console.log('');
        
        try {
            // Fetch current data
            const currentData = await this.fetchCurrentData(ebookId);
            console.log(`📊 Current price: $${currentData.price}`);
            console.log(`📈 Sales: ${currentData.totalSales} units`);
            console.log(`💵 Revenue: $${currentData.totalRevenue}`);
            
            // Check if we have enough data
            if (currentData.totalSales < this.minDataPoints) {
                console.log(`⚠️  Not enough data (${currentData.totalSales}/${this.minDataPoints} sales)`);
                return {
                    success: false,
                    reason: 'insufficient_data',
                    currentPrice: currentData.price,
                    recommendation: 'Continue gathering data'
                };
            }
            
            // Analyze market conditions
            const marketAnalysis = await this.analyzeMarket(currentData);
            
            // Calculate optimal price
            const optimization = await this.calculateOptimalPrice(currentData, marketAnalysis);
            
            // Apply pricing strategy
            const strategy = this.selectStrategy(currentData, marketAnalysis, optimization);
            
            // Generate price recommendations
            const recommendations = this.generateRecommendations(
                currentData,
                optimization,
                strategy
            );
            
            // Execute price changes if auto mode
            if (options.autoApply && recommendations.primary.price !== currentData.price) {
                await this.applyPriceChange(ebookId, recommendations.primary);
            }
            
            // Set up A/B test if requested
            if (options.abTest && recommendations.variations.length > 0) {
                await this.setupABTest(ebookId, recommendations.variations);
            }
            
            // Generate report
            const report = this.generateReport(
                currentData,
                marketAnalysis,
                optimization,
                strategy,
                recommendations
            );
            
            console.log('\n✅ Price optimization complete!');
            console.log(`🎯 Recommended price: $${recommendations.primary.price}`);
            console.log(`📊 Expected revenue change: ${recommendations.primary.expectedChange}%`);
            
            return {
                success: true,
                currentPrice: currentData.price,
                recommendedPrice: recommendations.primary.price,
                strategy: strategy.name,
                recommendations,
                report
            };
            
        } catch (error) {
            console.error('❌ Price optimization failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async fetchCurrentData(ebookId) {
        // Fetch from Gumroad API
        if (this.gumroadToken) {
            return await this.fetchGumroadData(ebookId);
        }
        
        // Fallback to local analytics file
        return await this.fetchLocalData(ebookId);
    }

    async fetchGumroadData(productId) {
        const response = await axios.get(
            `${PRICING_CONFIG.platforms.gumroad.api}/products/${productId}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.gumroadToken}`
                }
            }
        );
        
        if (!response.data.success) {
            throw new Error('Failed to fetch Gumroad data');
        }
        
        const product = response.data.product;
        
        // Fetch sales data
        const salesResponse = await axios.get(
            `${PRICING_CONFIG.platforms.gumroad.api}/sales`,
            {
                params: { product_id: productId },
                headers: {
                    'Authorization': `Bearer ${this.gumroadToken}`
                }
            }
        );
        
        const sales = salesResponse.data.sales || [];
        
        return {
            id: product.id,
            title: product.name,
            price: product.price / 100, // Convert cents to dollars
            currency: product.currency,
            totalSales: sales.length,
            totalRevenue: sales.reduce((sum, sale) => sum + (sale.price / 100), 0),
            conversionRate: this.calculateConversionRate(product.view_count, sales.length),
            salesHistory: this.processSalesHistory(sales),
            niche: this.detectNiche(product.name, product.description)
        };
    }

    async fetchLocalData(ebookId) {
        try {
            const analyticsPath = path.join('build', 'analytics', `${ebookId}.json`);
            const data = await fs.readFile(analyticsPath, 'utf8');
            return JSON.parse(data);
        } catch {
            throw new Error('No analytics data found');
        }
    }

    async analyzeMarket(currentData) {
        console.log('\n🔍 Analyzing market conditions...');
        
        const analysis = {
            competitors: [],
            averagePrice: 0,
            priceRange: { min: 999, max: 0 },
            season: this.getCurrentSeason(),
            demand: 'normal'
        };
        
        // Find competitor books
        if (currentData.niche) {
            analysis.competitors = await this.findCompetitors(
                currentData.title,
                currentData.niche
            );
            
            if (analysis.competitors.length > 0) {
                const prices = analysis.competitors.map(c => c.price);
                analysis.averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                analysis.priceRange.min = Math.min(...prices);
                analysis.priceRange.max = Math.max(...prices);
                
                console.log(`   📚 Found ${analysis.competitors.length} competitors`);
                console.log(`   💵 Average price: $${analysis.averagePrice.toFixed(2)}`);
                console.log(`   📊 Price range: $${analysis.priceRange.min} - $${analysis.priceRange.max}`);
            }
        }
        
        // Analyze demand based on sales velocity
        const recentSales = currentData.salesHistory.slice(-30); // Last 30 days
        const salesVelocity = recentSales.length / 30;
        
        if (salesVelocity > 10) analysis.demand = 'high';
        else if (salesVelocity > 5) analysis.demand = 'normal';
        else analysis.demand = 'low';
        
        console.log(`   📈 Current demand: ${analysis.demand}`);
        console.log(`   🗓️  Season: ${analysis.season.name || 'normal'}`);
        
        return analysis;
    }

    async findCompetitors(title, niche) {
        // In production, this would scrape Amazon/Gumroad for similar books
        // For now, return mock data
        return [
            { title: 'Similar Book 1', price: 9.99, sales_rank: 1234 },
            { title: 'Similar Book 2', price: 14.99, sales_rank: 2345 },
            { title: 'Similar Book 3', price: 7.99, sales_rank: 3456 }
        ];
    }

    calculateOptimalPrice(currentData, marketAnalysis) {
        console.log('\n📊 Calculating optimal price...');
        
        const optimization = {
            currentRevenue: currentData.totalRevenue,
            elasticity: PRICING_CONFIG.elasticity[currentData.niche] || -1.0,
            optimalPrice: currentData.price,
            expectedRevenue: currentData.totalRevenue,
            confidence: 0.5
        };
        
        // Price elasticity formula: % change in quantity / % change in price
        // Revenue = Price × Quantity
        // Optimal price = Current Price × (1 + 1/(elasticity + 1))
        
        const elasticityFactor = 1 + (1 / (optimization.elasticity + 1));
        let calculatedPrice = currentData.price * elasticityFactor;
        
        // Adjust for market conditions
        if (marketAnalysis.averagePrice > 0) {
            // Blend with market average
            calculatedPrice = (calculatedPrice * 0.7) + (marketAnalysis.averagePrice * 0.3);
        }
        
        // Apply seasonal adjustments
        if (marketAnalysis.season && marketAnalysis.season.multiplier) {
            calculatedPrice *= marketAnalysis.season.multiplier;
        }
        
        // Adjust for demand
        if (marketAnalysis.demand === 'high') {
            calculatedPrice *= 1.1; // 10% increase
        } else if (marketAnalysis.demand === 'low') {
            calculatedPrice *= 0.9; // 10% decrease
        }
        
        // Round to psychological price point
        optimization.optimalPrice = this.roundToPsychologicalPrice(calculatedPrice);
        
        // Calculate expected revenue change
        const priceChange = (optimization.optimalPrice - currentData.price) / currentData.price;
        const quantityChange = priceChange * optimization.elasticity;
        const revenueChange = (1 + priceChange) * (1 + quantityChange) - 1;
        
        optimization.expectedRevenue = currentData.totalRevenue * (1 + revenueChange);
        optimization.revenueChange = revenueChange * 100;
        
        // Calculate confidence based on data quality
        optimization.confidence = Math.min(
            1.0,
            currentData.totalSales / 1000 * 0.5 + // More sales = higher confidence
            (marketAnalysis.competitors.length / 10) * 0.3 + // More competitor data
            0.2 // Base confidence
        );
        
        console.log(`   💰 Optimal price: $${optimization.optimalPrice}`);
        console.log(`   📈 Expected revenue change: ${optimization.revenueChange.toFixed(1)}%`);
        console.log(`   🎯 Confidence: ${(optimization.confidence * 100).toFixed(0)}%`);
        
        return optimization;
    }

    selectStrategy(currentData, marketAnalysis, optimization) {
        // Determine best pricing strategy based on conditions
        
        // New book - use penetration pricing
        if (currentData.totalSales < 50) {
            return PRICING_CONFIG.strategies.penetration;
        }
        
        // High quality, established book - try premium
        if (currentData.conversionRate > 0.05 && currentData.totalSales > 500) {
            return PRICING_CONFIG.strategies.premium;
        }
        
        // High demand - use dynamic pricing
        if (marketAnalysis.demand === 'high') {
            return PRICING_CONFIG.strategies.dynamic;
        }
        
        // Default to psychological pricing
        return PRICING_CONFIG.strategies.psychological;
    }

    generateRecommendations(currentData, optimization, strategy) {
        const recommendations = {
            primary: {
                price: optimization.optimalPrice,
                strategy: strategy.name,
                expectedChange: optimization.revenueChange.toFixed(1),
                confidence: optimization.confidence
            },
            variations: [],
            timeline: []
        };
        
        // Ensure price change isn't too dramatic
        const maxChange = currentData.price * this.maxPriceChange;
        if (Math.abs(recommendations.primary.price - currentData.price) > maxChange) {
            recommendations.primary.price = currentData.price + 
                (recommendations.primary.price > currentData.price ? maxChange : -maxChange);
            recommendations.primary.gradual = true;
        }
        
        // Generate A/B test variations
        const basePrice = recommendations.primary.price;
        recommendations.variations = [
            {
                name: 'Control',
                price: currentData.price,
                allocation: 0.25
            },
            {
                name: 'Test A',
                price: basePrice,
                allocation: 0.5
            },
            {
                name: 'Test B',
                price: this.roundToPsychologicalPrice(basePrice * 1.1),
                allocation: 0.25
            }
        ];
        
        // Generate implementation timeline
        if (recommendations.primary.gradual) {
            const steps = 3;
            const priceStep = (recommendations.primary.price - currentData.price) / steps;
            
            for (let i = 1; i <= steps; i++) {
                recommendations.timeline.push({
                    week: i,
                    price: this.roundToPsychologicalPrice(currentData.price + (priceStep * i)),
                    action: `Gradual increase step ${i}/${steps}`
                });
            }
        } else {
            recommendations.timeline.push({
                week: 1,
                price: recommendations.primary.price,
                action: 'Immediate price change'
            });
        }
        
        return recommendations;
    }

    roundToPsychologicalPrice(price) {
        const points = PRICING_CONFIG.strategies.psychological.points;
        
        // Find closest psychological price point
        let closest = points[0];
        let minDiff = Math.abs(price - points[0]);
        
        for (const point of points) {
            const diff = Math.abs(price - point);
            if (diff < minDiff) {
                minDiff = diff;
                closest = point;
            }
        }
        
        // If very close to a round number, use .99 pricing
        if (price > 1 && Math.abs(price - Math.round(price)) < 0.5) {
            return Math.round(price) - 0.01;
        }
        
        return closest;
    }

    getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth() + 1;
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        
        for (const [name, config] of Object.entries(PRICING_CONFIG.seasons)) {
            if (config.months && config.months.includes(month)) {
                return { name, ...config };
            }
            if (config.days && config.days.includes(dayOfYear)) {
                return { name, ...config };
            }
        }
        
        return null;
    }

    calculateConversionRate(views, sales) {
        if (!views || views === 0) return 0;
        return sales / views;
    }

    processSalesHistory(sales) {
        // Group sales by date
        const history = {};
        
        sales.forEach(sale => {
            const date = new Date(sale.created_at).toISOString().split('T')[0];
            if (!history[date]) {
                history[date] = [];
            }
            history[date].push(sale);
        });
        
        // Convert to array sorted by date
        return Object.entries(history)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, sales]) => ({
                date,
                count: sales.length,
                revenue: sales.reduce((sum, s) => sum + (s.price / 100), 0)
            }));
    }

    detectNiche(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        for (const niche of Object.keys(PRICING_CONFIG.elasticity)) {
            const keywords = niche.toLowerCase().split('/');
            if (keywords.some(keyword => text.includes(keyword))) {
                return niche;
            }
        }
        
        return 'Business/Money'; // Default
    }

    async applyPriceChange(ebookId, recommendation) {
        console.log(`\n💱 Applying price change to $${recommendation.price}...`);
        
        if (this.gumroadToken) {
            try {
                const response = await axios.patch(
                    `${PRICING_CONFIG.platforms.gumroad.api}/products/${ebookId}`,
                    {
                        price: Math.round(recommendation.price * 100) // Convert to cents
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.gumroadToken}`
                        }
                    }
                );
                
                if (response.data.success) {
                    console.log('   ✅ Price updated successfully');
                    return true;
                }
            } catch (error) {
                console.error('   ❌ Failed to update price:', error.message);
            }
        }
        
        return false;
    }

    async setupABTest(ebookId, variations) {
        console.log('\n🧪 Setting up A/B price test...');
        
        const testId = `price-test-${Date.now()}`;
        
        this.currentTests.set(testId, {
            ebookId,
            variations,
            startDate: new Date(),
            endDate: new Date(Date.now() + this.testDuration * 24 * 60 * 60 * 1000),
            results: {}
        });
        
        // In production, this would configure the sales platform for A/B testing
        console.log(`   📊 Test ID: ${testId}`);
        console.log(`   🔄 Variations: ${variations.length}`);
        console.log(`   📅 Duration: ${this.testDuration} days`);
        
        return testId;
    }

    generateReport(currentData, marketAnalysis, optimization, strategy, recommendations) {
        return {
            timestamp: new Date().toISOString(),
            ebook: {
                id: currentData.id,
                title: currentData.title,
                currentPrice: currentData.price,
                totalSales: currentData.totalSales,
                totalRevenue: currentData.totalRevenue
            },
            market: {
                competitors: marketAnalysis.competitors.length,
                averagePrice: marketAnalysis.averagePrice,
                priceRange: marketAnalysis.priceRange,
                demand: marketAnalysis.demand,
                season: marketAnalysis.season
            },
            optimization: {
                optimalPrice: optimization.optimalPrice,
                expectedRevenueChange: optimization.revenueChange,
                elasticity: optimization.elasticity,
                confidence: optimization.confidence
            },
            strategy: {
                selected: strategy.name,
                description: strategy.description
            },
            recommendations: recommendations,
            implementation: {
                immediate: !recommendations.primary.gradual,
                timeline: recommendations.timeline,
                monitoring: [
                    'Track daily sales for 2 weeks',
                    'Monitor conversion rate changes',
                    'Compare with competitor pricing',
                    'Adjust if sales drop >20%'
                ]
            }
        };
    }

    async monitorPricePerformance(ebookId, testId = null) {
        console.log('📊 Monitoring price performance...');
        
        const currentData = await this.fetchCurrentData(ebookId);
        
        if (testId && this.currentTests.has(testId)) {
            const test = this.currentTests.get(testId);
            
            // Check if test is complete
            if (new Date() > test.endDate) {
                const results = await this.analyzeTestResults(test);
                console.log('\n🏁 A/B Test Complete!');
                console.log(`🏆 Winner: ${results.winner.name} at $${results.winner.price}`);
                console.log(`📈 Revenue lift: ${results.lift}%`);
                
                return results;
            }
        }
        
        // Calculate performance metrics
        const recentSales = currentData.salesHistory.slice(-7); // Last 7 days
        const previousSales = currentData.salesHistory.slice(-14, -7); // Previous 7 days
        
        const metrics = {
            currentWeekRevenue: recentSales.reduce((sum, day) => sum + day.revenue, 0),
            previousWeekRevenue: previousSales.reduce((sum, day) => sum + day.revenue, 0),
            currentWeekSales: recentSales.reduce((sum, day) => sum + day.count, 0),
            previousWeekSales: previousSales.reduce((sum, day) => sum + day.count, 0)
        };
        
        metrics.revenueChange = ((metrics.currentWeekRevenue - metrics.previousWeekRevenue) / 
                                 metrics.previousWeekRevenue * 100).toFixed(1);
        metrics.salesChange = ((metrics.currentWeekSales - metrics.previousWeekSales) / 
                               metrics.previousWeekSales * 100).toFixed(1);
        
        console.log(`💰 Revenue change: ${metrics.revenueChange}%`);
        console.log(`📦 Sales change: ${metrics.salesChange}%`);
        
        return metrics;
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
    
    if (!options['ebook-id'] && !options.analyze) {
        console.error('Usage: price-optimizer.js --ebook-id="abc123" [options]');
        console.error('   or: price-optimizer.js --analyze="path/to/analytics.json"');
        console.error('\nOptions:');
        console.error('  --auto-apply   Apply recommended price automatically');
        console.error('  --ab-test      Set up A/B price testing');
        console.error('  --monitor      Monitor existing price test');
        console.error('  --platform     Sales platform (gumroad, amazon)');
        process.exit(1);
    }
    
    const optimizer = new PriceOptimizer({
        platforms: options.platform ? [options.platform] : undefined
    });
    
    (async () => {
        try {
            if (options.monitor) {
                const results = await optimizer.monitorPricePerformance(
                    options['ebook-id'],
                    options['test-id']
                );
                console.log('\nResults:', JSON.stringify(results, null, 2));
            } else {
                const result = await optimizer.optimizePricing(options['ebook-id'], {
                    autoApply: options['auto-apply'] === true,
                    abTest: options['ab-test'] === true
                });
                
                if (result.report) {
                    // Save report
                    const reportPath = `build/reports/price-optimization-${Date.now()}.json`;
                    await fs.mkdir('build/reports', { recursive: true });
                    await fs.writeFile(reportPath, JSON.stringify(result.report, null, 2));
                    console.log(`\n📄 Report saved to: ${reportPath}`);
                }
            }
            
            process.exit(0);
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = PriceOptimizer;