// Analytics Engine Module
class AnalyticsEngine {
    constructor() {
        this.data = {
            sales: [],
            visitors: [],
            conversions: [],
            revenue: {}
        };
        
        this.dateRange = {
            start: null,
            end: null,
            preset: 'today'
        };
        
        this.cache = new Map();
        this.init();
    }
    
    init() {
        // Load saved data
        this.loadSavedData();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize calculations
        this.recalculate();
        
        console.log('📊 Analytics engine initialized');
    }
    
    setupEventListeners() {
        // Date range changes
        document.querySelectorAll('.date-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setDateRange(e.target.dataset.range);
            });
        });
        
        // Chart type changes
        const chartTypeSelect = document.getElementById('revenue-chart-type');
        if (chartTypeSelect) {
            chartTypeSelect.addEventListener('change', (e) => {
                if (window.charts) {
                    window.charts.updateChartType('revenue', e.target.value);
                }
            });
        }
    }
    
    // Date range management
    setDateRange(preset) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (preset) {
            case 'today':
                this.dateRange.start = today;
                this.dateRange.end = now;
                break;
                
            case 'week':
                this.dateRange.start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                this.dateRange.end = now;
                break;
                
            case 'month':
                this.dateRange.start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                this.dateRange.end = now;
                break;
                
            case 'quarter':
                this.dateRange.start = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
                this.dateRange.end = now;
                break;
                
            case 'year':
                this.dateRange.start = new Date(now.getFullYear(), 0, 1);
                this.dateRange.end = now;
                break;
                
            case 'custom':
                this.showCustomDatePicker();
                return;
        }
        
        this.dateRange.preset = preset;
        
        // Update UI
        document.querySelectorAll('.date-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.range === preset);
        });
        
        // Recalculate metrics
        this.recalculate();
    }
    
    showCustomDatePicker() {
        // Implementation for custom date picker modal
        console.log('Custom date picker not implemented yet');
    }
    
    // Data recording
    recordSale(sale) {
        this.data.sales.push(sale);
        this.invalidateCache();
        
        // Update real-time metrics
        this.updateMetrics();
        
        // Trigger chart update
        if (window.charts) {
            window.charts.addDataPoint(sale);
        }
    }
    
    recordVisitor(visitor) {
        this.data.visitors.push({
            timestamp: new Date().toISOString(),
            sessionId: visitor.sessionId,
            source: visitor.source,
            ebookId: visitor.ebookId,
            ...visitor
        });
        
        this.invalidateCache();
    }
    
    recordConversion(conversion) {
        this.data.conversions.push({
            timestamp: new Date().toISOString(),
            visitorId: conversion.visitorId,
            saleId: conversion.saleId,
            ...conversion
        });
        
        this.invalidateCache();
    }
    
    recordRefund(refund) {
        const sale = this.data.sales.find(s => s.id === refund.id);
        if (sale) {
            sale.refunded = true;
            sale.refundDate = refund.refundDate;
            this.invalidateCache();
            this.updateMetrics();
        }
    }
    
    // Metrics calculation
    calculateMetrics() {
        const filtered = this.getFilteredData();
        
        return {
            revenue: this.calculateRevenue(filtered.sales),
            sales: this.calculateSalesMetrics(filtered.sales),
            conversion: this.calculateConversionMetrics(filtered),
            ebooks: this.calculateEbookMetrics(filtered.sales),
            geography: this.calculateGeographicMetrics(filtered.sales),
            sources: this.calculateSourceMetrics(filtered),
            platforms: this.calculatePlatformMetrics(filtered.sales)
        };
    }
    
    getFilteredData() {
        const { start, end } = this.dateRange;
        
        const filterByDate = (items) => {
            if (!start || !end) return items;
            
            return items.filter(item => {
                const date = new Date(item.timestamp);
                return date >= start && date <= end;
            });
        };
        
        return {
            sales: filterByDate(this.data.sales),
            visitors: filterByDate(this.data.visitors),
            conversions: filterByDate(this.data.conversions)
        };
    }
    
    calculateRevenue(sales) {
        const validSales = sales.filter(s => !s.refunded);
        
        const total = validSales.reduce((sum, sale) => sum + sale.amount, 0);
        const refunds = sales.filter(s => s.refunded).reduce((sum, sale) => sum + sale.amount, 0);
        
        // Group by date for charts
        const byDate = {};
        validSales.forEach(sale => {
            const date = new Date(sale.timestamp).toLocaleDateString();
            byDate[date] = (byDate[date] || 0) + sale.amount;
        });
        
        // Calculate change vs previous period
        const previousPeriod = this.getPreviousPeriodData();
        const previousTotal = previousPeriod.sales
            .filter(s => !s.refunded)
            .reduce((sum, sale) => sum + sale.amount, 0);
        
        const change = previousTotal > 0 
            ? ((total - previousTotal) / previousTotal * 100).toFixed(1)
            : 0;
        
        return {
            total,
            refunds,
            net: total - refunds,
            change,
            byDate,
            averageOrderValue: validSales.length > 0 ? total / validSales.length : 0
        };
    }
    
    calculateSalesMetrics(sales) {
        const validSales = sales.filter(s => !s.refunded);
        
        return {
            total: validSales.length,
            refunded: sales.filter(s => s.refunded).length,
            byPlatform: this.groupBy(validSales, 'platform'),
            byEbook: this.groupBy(validSales, 'ebookId'),
            byCountry: this.groupBy(validSales, 'customerCountry'),
            bySource: this.groupBy(validSales, 'source')
        };
    }
    
    calculateConversionMetrics(data) {
        const { visitors, sales } = data;
        
        const uniqueVisitors = new Set(visitors.map(v => v.sessionId)).size;
        const conversions = sales.length;
        const rate = uniqueVisitors > 0 ? (conversions / uniqueVisitors * 100) : 0;
        
        // Calculate funnel
        const readers = visitors.filter(v => v.readingTime > 60).length; // Read for > 1 min
        const clickers = visitors.filter(v => v.affiliateClicks > 0).length;
        
        return {
            visitors: uniqueVisitors,
            conversions,
            rate: rate.toFixed(2),
            funnel: {
                views: uniqueVisitors,
                readers,
                clicks: clickers,
                purchases: conversions
            }
        };
    }
    
    calculateEbookMetrics(sales) {
        const ebookSales = {};
        const ebookRevenue = {};
        
        sales.filter(s => !s.refunded).forEach(sale => {
            const ebookId = sale.ebookId || 'unknown';
            ebookSales[ebookId] = (ebookSales[ebookId] || 0) + 1;
            ebookRevenue[ebookId] = (ebookRevenue[ebookId] || 0) + sale.amount;
        });
        
        // Get top performers
        const topByRevenue = Object.entries(ebookRevenue)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([id, revenue]) => ({
                id,
                revenue,
                sales: ebookSales[id],
                title: this.getEbookTitle(id)
            }));
        
        return {
            active: Object.keys(ebookSales).length,
            topPerformers: topByRevenue,
            bestSeller: topByRevenue[0]
        };
    }
    
    calculateGeographicMetrics(sales) {
        const byCountry = {};
        const revenueByCountry = {};
        
        sales.filter(s => !s.refunded).forEach(sale => {
            const country = sale.customerCountry || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;
            revenueByCountry[country] = (revenueByCountry[country] || 0) + sale.amount;
        });
        
        return {
            salesByCountry: byCountry,
            revenueByCountry,
            topCountries: Object.entries(revenueByCountry)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
        };
    }
    
    calculateSourceMetrics(data) {
        const { visitors, sales } = data;
        
        const sourceStats = {};
        
        // Calculate visitors by source
        visitors.forEach(visitor => {
            const source = visitor.source || 'direct';
            if (!sourceStats[source]) {
                sourceStats[source] = {
                    visitors: 0,
                    sales: 0,
                    revenue: 0
                };
            }
            sourceStats[source].visitors++;
        });
        
        // Add sales data
        sales.forEach(sale => {
            const source = sale.source || 'direct';
            if (sourceStats[source]) {
                sourceStats[source].sales++;
                sourceStats[source].revenue += sale.amount;
            }
        });
        
        // Calculate conversion rates
        Object.keys(sourceStats).forEach(source => {
            const stats = sourceStats[source];
            stats.conversionRate = stats.visitors > 0 
                ? (stats.sales / stats.visitors * 100).toFixed(2)
                : 0;
        });
        
        return sourceStats;
    }
    
    calculatePlatformMetrics(sales) {
        const platforms = {};
        
        sales.filter(s => !s.refunded).forEach(sale => {
            const platform = sale.platform || 'unknown';
            if (!platforms[platform]) {
                platforms[platform] = {
                    sales: 0,
                    revenue: 0,
                    percentage: 0
                };
            }
            platforms[platform].sales++;
            platforms[platform].revenue += sale.amount;
        });
        
        // Calculate percentages
        const totalRevenue = Object.values(platforms)
            .reduce((sum, p) => sum + p.revenue, 0);
        
        Object.keys(platforms).forEach(platform => {
            platforms[platform].percentage = totalRevenue > 0
                ? (platforms[platform].revenue / totalRevenue * 100).toFixed(1)
                : 0;
        });
        
        return platforms;
    }
    
    // Cohort analysis
    calculateCohortAnalysis() {
        const cohorts = {};
        
        // Group customers by first purchase month
        this.data.sales.forEach(sale => {
            const cohortMonth = new Date(sale.timestamp).toISOString().slice(0, 7);
            const customerId = sale.customerEmail;
            
            if (!cohorts[cohortMonth]) {
                cohorts[cohortMonth] = {
                    customers: new Set(),
                    revenue: {},
                    retention: {}
                };
            }
            
            cohorts[cohortMonth].customers.add(customerId);
            
            // Track revenue by month
            const saleMonth = new Date(sale.timestamp).toISOString().slice(0, 7);
            if (!cohorts[cohortMonth].revenue[saleMonth]) {
                cohorts[cohortMonth].revenue[saleMonth] = 0;
            }
            cohorts[cohortMonth].revenue[saleMonth] += sale.amount;
        });
        
        // Calculate retention and LTV
        Object.keys(cohorts).forEach(cohortMonth => {
            const cohort = cohorts[cohortMonth];
            const totalCustomers = cohort.customers.size;
            
            Object.keys(cohort.revenue).forEach(month => {
                const monthIndex = this.getMonthDifference(cohortMonth, month);
                cohort.retention[monthIndex] = {
                    revenue: cohort.revenue[month],
                    ltv: cohort.revenue[month] / totalCustomers
                };
            });
        });
        
        return cohorts;
    }
    
    getMonthDifference(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        return (endDate.getFullYear() - startDate.getFullYear()) * 12 +
               (endDate.getMonth() - startDate.getMonth());
    }
    
    // A/B test analysis
    analyzeABTest(testId) {
        const test = this.getABTest(testId);
        if (!test) return null;
        
        const results = {
            variants: {}
        };
        
        // Calculate metrics for each variant
        test.variants.forEach(variant => {
            const variantSales = this.data.sales.filter(s => 
                s.metadata?.abTest === testId && 
                s.metadata?.variant === variant.id
            );
            
            const variantVisitors = this.data.visitors.filter(v =>
                v.metadata?.abTest === testId &&
                v.metadata?.variant === variant.id
            );
            
            results.variants[variant.id] = {
                name: variant.name,
                visitors: variantVisitors.length,
                conversions: variantSales.length,
                revenue: variantSales.reduce((sum, s) => sum + s.amount, 0),
                conversionRate: variantVisitors.length > 0
                    ? (variantSales.length / variantVisitors.length * 100).toFixed(2)
                    : 0
            };
        });
        
        // Determine winner
        let winner = null;
        let maxConversionRate = 0;
        
        Object.entries(results.variants).forEach(([id, variant]) => {
            if (parseFloat(variant.conversionRate) > maxConversionRate) {
                maxConversionRate = parseFloat(variant.conversionRate);
                winner = id;
            }
        });
        
        results.winner = winner;
        results.confidence = this.calculateStatisticalSignificance(results.variants);
        
        return results;
    }
    
    calculateStatisticalSignificance(variants) {
        // Simplified confidence calculation
        // In production, use proper statistical tests
        const variantArray = Object.values(variants);
        if (variantArray.length < 2) return 0;
        
        const rates = variantArray.map(v => parseFloat(v.conversionRate));
        const maxRate = Math.max(...rates);
        const minRate = Math.min(...rates);
        
        const difference = maxRate - minRate;
        const avgVisitors = variantArray.reduce((sum, v) => sum + v.visitors, 0) / variantArray.length;
        
        // Simple confidence based on difference and sample size
        const confidence = Math.min(
            95,
            difference * 5 + Math.log(avgVisitors) * 10
        );
        
        return Math.round(confidence);
    }
    
    // Predictive analytics
    predictRevenue(days = 30) {
        const recentDays = 30;
        const now = new Date();
        const recentStart = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
        
        const recentSales = this.data.sales.filter(s => 
            new Date(s.timestamp) >= recentStart && !s.refunded
        );
        
        const dailyRevenue = recentSales.reduce((sum, s) => sum + s.amount, 0) / recentDays;
        
        // Simple linear projection
        const projection = {
            daily: dailyRevenue,
            weekly: dailyRevenue * 7,
            monthly: dailyRevenue * 30,
            projected: dailyRevenue * days
        };
        
        // Add trend analysis
        const trend = this.calculateTrend(recentSales);
        if (trend !== 0) {
            projection.projected *= (1 + trend * days / 100);
        }
        
        return projection;
    }
    
    calculateTrend(sales) {
        if (sales.length < 2) return 0;
        
        // Group by day
        const dailyRevenue = {};
        sales.forEach(sale => {
            const date = new Date(sale.timestamp).toLocaleDateString();
            dailyRevenue[date] = (dailyRevenue[date] || 0) + sale.amount;
        });
        
        const values = Object.values(dailyRevenue);
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        return ((avgSecond - avgFirst) / avgFirst * 100);
    }
    
    // Helper methods
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key] || 'unknown';
            result[group] = (result[group] || 0) + 1;
            return result;
        }, {});
    }
    
    getEbookTitle(id) {
        // In production, fetch from database
        const titles = {
            'chatgpt-ai-prompts': 'ChatGPT AI Prompts',
            'passive-income-guide': 'Passive Income Guide',
            'crypto-trading': 'Crypto Trading Basics'
        };
        
        return titles[id] || id;
    }
    
    getPreviousPeriodData() {
        const { start, end } = this.dateRange;
        if (!start || !end) return { sales: [], visitors: [] };
        
        const duration = end.getTime() - start.getTime();
        const previousStart = new Date(start.getTime() - duration);
        const previousEnd = new Date(start.getTime());
        
        return {
            sales: this.data.sales.filter(s => {
                const date = new Date(s.timestamp);
                return date >= previousStart && date < previousEnd;
            }),
            visitors: this.data.visitors.filter(v => {
                const date = new Date(v.timestamp);
                return date >= previousStart && date < previousEnd;
            })
        };
    }
    
    getABTest(testId) {
        // In production, fetch from database
        const tests = {
            'price-test-1': {
                id: 'price-test-1',
                name: 'Price Point Test',
                variants: [
                    { id: 'control', name: '$47' },
                    { id: 'variant-a', name: '$67' },
                    { id: 'variant-b', name: '$97' }
                ]
            }
        };
        
        return tests[testId];
    }
    
    // Cache management
    invalidateCache() {
        this.cache.clear();
    }
    
    getCached(key, calculator) {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        const result = calculator();
        this.cache.set(key, result);
        return result;
    }
    
    // Update UI
    updateMetrics() {
        const metrics = this.calculateMetrics();
        
        // Update revenue
        document.getElementById('total-revenue').textContent = 
            metrics.revenue.total.toFixed(2);
        document.getElementById('revenue-change').textContent = 
            `${metrics.revenue.change > 0 ? '+' : ''}${metrics.revenue.change}%`;
        
        // Update sales
        document.getElementById('total-sales').textContent = 
            metrics.sales.total;
        document.getElementById('avg-order-value').textContent = 
            metrics.revenue.averageOrderValue.toFixed(2);
        
        // Update conversion
        document.getElementById('conversion-rate').textContent = 
            metrics.conversion.rate;
        document.getElementById('total-visitors').textContent = 
            metrics.conversion.visitors;
        
        // Update ebooks
        document.getElementById('active-ebooks').textContent = 
            metrics.ebooks.active;
        if (metrics.ebooks.bestSeller) {
            document.getElementById('best-seller').textContent = 
                metrics.ebooks.bestSeller.title;
        }
        
        // Update funnel
        this.updateFunnel(metrics.conversion.funnel);
        
        // Update tables
        this.updateTopEbooksTable(metrics.ebooks.topPerformers);
        
        // Update change indicators
        this.updateChangeIndicators(metrics);
    }
    
    updateFunnel(funnel) {
        document.getElementById('funnel-views').textContent = funnel.views;
        document.getElementById('funnel-readers').textContent = funnel.readers;
        document.getElementById('funnel-clicks').textContent = funnel.clicks;
        document.getElementById('funnel-purchases').textContent = funnel.purchases;
        
        // Update percentages
        const viewsPercent = 100;
        const readersPercent = funnel.views > 0 ? (funnel.readers / funnel.views * 100) : 0;
        const clicksPercent = funnel.views > 0 ? (funnel.clicks / funnel.views * 100) : 0;
        const purchasesPercent = funnel.views > 0 ? (funnel.purchases / funnel.views * 100) : 0;
        
        document.getElementById('readers-percent').textContent = `${readersPercent.toFixed(1)}%`;
        document.getElementById('clicks-percent').textContent = `${clicksPercent.toFixed(1)}%`;
        document.getElementById('purchases-percent').textContent = `${purchasesPercent.toFixed(1)}%`;
        
        // Update bar widths
        document.querySelectorAll('.funnel-bar').forEach((bar, index) => {
            const percents = [viewsPercent, readersPercent, clicksPercent, purchasesPercent];
            bar.style.width = `${percents[index]}%`;
        });
    }
    
    updateTopEbooksTable(topEbooks) {
        const table = document.getElementById('top-ebooks-table');
        if (!table) return;
        
        table.innerHTML = topEbooks.map(ebook => {
            const trend = Math.random() > 0.5 ? 'up' : 'down'; // In production, calculate real trend
            const trendIcon = trend === 'up' ? '↑' : '↓';
            
            return `
                <tr>
                    <td>${ebook.title}</td>
                    <td>${ebook.sales}</td>
                    <td>$${ebook.revenue.toFixed(2)}</td>
                    <td>${(ebook.sales / 100 * 100).toFixed(1)}%</td>
                    <td>
                        <span class="trend ${trend}">
                            ${trendIcon} ${Math.abs(Math.random() * 20).toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    updateChangeIndicators(metrics) {
        // Update change classes
        const revenueChange = document.querySelector('#revenue-change').parentElement;
        revenueChange.className = `metric-change ${metrics.revenue.change >= 0 ? 'positive' : 'negative'}`;
        
        // In production, calculate all changes
    }
    
    // Data persistence
    saveData() {
        try {
            localStorage.setItem('analytics-data', JSON.stringify(this.data));
        } catch (error) {
            console.error('Failed to save analytics data:', error);
        }
    }
    
    loadSavedData() {
        try {
            const saved = localStorage.getItem('analytics-data');
            if (saved) {
                this.data = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load analytics data:', error);
        }
    }
    
    // Public methods
    recalculate() {
        this.updateMetrics();
        this.saveData();
    }
    
    async loadDashboard() {
        // Set initial date range
        this.setDateRange('today');
        
        // Load any remote data
        try {
            const response = await fetch('/api/analytics/summary');
            if (response.ok) {
                const summary = await response.json();
                // Merge with local data
                this.mergeSummaryData(summary);
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
        
        // Update UI
        this.updateMetrics();
    }
    
    mergeSummaryData(summary) {
        // Merge remote data with local data
        // Implementation depends on your backend
    }
}

// Initialize analytics engine when ready
window.analytics = new AnalyticsEngine();