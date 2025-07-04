// Analytics Charts Module
class AnalyticsCharts {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#7c3aed',
            secondary: '#10b981',
            accent: '#f59e0b',
            danger: '#ef4444',
            info: '#3b82f6',
            gray: '#6b7280',
            platforms: {
                gumroad: '#ff90e8',
                stripe: '#635bff',
                paypal: '#0070ba',
                kdp: '#ff9900'
            }
        };
        
        this.init();
    }
    
    init() {
        // Set default Chart.js options
        this.setChartDefaults();
        
        // Initialize all charts
        this.initializeCharts();
        
        console.log('📈 Charts initialized');
    }
    
    setChartDefaults() {
        Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#6b7280';
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(31, 41, 55, 0.9)';
        Chart.defaults.plugins.tooltip.padding = 12;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
        Chart.defaults.plugins.tooltip.titleFont.size = 14;
        Chart.defaults.plugins.tooltip.bodyFont.size = 13;
    }
    
    initializeCharts() {
        // Revenue chart
        this.initRevenueChart();
        
        // Platform distribution chart
        this.initPlatformChart();
        
        // Revenue sparkline
        this.initSparkline();
        
        // Initialize other charts as needed
    }
    
    // Revenue Chart
    initRevenueChart() {
        const ctx = document.getElementById('revenue-chart');
        if (!ctx) return;
        
        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Revenue',
                    data: [],
                    borderColor: this.colors.primary,
                    backgroundColor: this.createGradient(ctx, this.colors.primary),
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: this.colors.primary,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `Revenue: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 0
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: (value) => `$${value}`
                        }
                    }
                }
            }
        });
    }
    
    // Platform Distribution Chart
    initPlatformChart() {
        const ctx = document.getElementById('platform-chart');
        if (!ctx) return;
        
        this.charts.platform = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const percentage = context.dataset.percentages?.[context.dataIndex] || 0;
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        // Add center text
        this.addCenterText(ctx, this.charts.platform);
    }
    
    // Sparkline Chart
    initSparkline() {
        const ctx = document.getElementById('revenue-sparkline');
        if (!ctx) return;
        
        this.charts.sparkline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [{
                    data: [],
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    }
    
    // Update Methods
    updateRevenueChart(data) {
        if (!this.charts.revenue) return;
        
        const dates = Object.keys(data.byDate).slice(-30);
        const values = dates.map(date => data.byDate[date]);
        
        this.charts.revenue.data.labels = dates.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
        });
        
        this.charts.revenue.data.datasets[0].data = values;
        
        // Add comparison data if enabled
        if (this.comparisonEnabled && data.previousPeriod) {
            if (!this.charts.revenue.data.datasets[1]) {
                this.charts.revenue.data.datasets.push({
                    label: 'Previous Period',
                    data: [],
                    borderColor: this.colors.gray,
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 0
                });
            }
            
            const prevDates = Object.keys(data.previousPeriod.byDate);
            const prevValues = prevDates.map(date => data.previousPeriod.byDate[date]);
            this.charts.revenue.data.datasets[1].data = prevValues;
        }
        
        this.charts.revenue.update('none');
    }
    
    updatePlatformChart(platforms) {
        if (!this.charts.platform) return;
        
        const labels = Object.keys(platforms);
        const data = labels.map(p => platforms[p].revenue);
        const percentages = labels.map(p => platforms[p].percentage);
        const colors = labels.map(p => this.colors.platforms[p] || this.colors.gray);
        
        this.charts.platform.data.labels = labels.map(p => p.charAt(0).toUpperCase() + p.slice(1));
        this.charts.platform.data.datasets[0].data = data;
        this.charts.platform.data.datasets[0].backgroundColor = colors;
        this.charts.platform.data.datasets[0].percentages = percentages;
        
        // Update center text
        const total = data.reduce((sum, val) => sum + val, 0);
        this.updateCenterText(this.charts.platform, `$${total.toFixed(0)}`);
        
        this.charts.platform.update('none');
        
        // Update legend
        this.updatePlatformLegend(platforms);
    }
    
    updatePlatformLegend(platforms) {
        const legend = document.getElementById('platform-legend');
        if (!legend) return;
        
        legend.innerHTML = Object.entries(platforms).map(([platform, stats]) => `
            <div class="legend-item">
                <span class="legend-color" style="background: ${this.colors.platforms[platform] || this.colors.gray}"></span>
                <span>${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                <span style="margin-left: auto; font-weight: 600">${stats.percentage}%</span>
            </div>
        `).join('');
    }
    
    updateSparkline(data) {
        if (!this.charts.sparkline) return;
        
        // Get last 30 days of data
        const values = data.slice(-30);
        this.charts.sparkline.data.datasets[0].data = values;
        this.charts.sparkline.update('none');
    }
    
    // Chart Type Updates
    updateChartType(chartName, newType) {
        const chart = this.charts[chartName];
        if (!chart) return;
        
        // Save current data
        const currentData = {
            labels: chart.data.labels,
            datasets: chart.data.datasets
        };
        
        // Destroy old chart
        chart.destroy();
        
        // Create new chart with new type
        const ctx = document.getElementById(`${chartName}-chart`);
        
        const config = {
            type: newType,
            data: currentData,
            options: this.getChartOptions(chartName, newType)
        };
        
        this.charts[chartName] = new Chart(ctx, config);
    }
    
    getChartOptions(chartName, type) {
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false
        };
        
        if (chartName === 'revenue') {
            if (type === 'bar') {
                return {
                    ...baseOptions,
                    scales: {
                        x: {
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => `$${value}`
                            }
                        }
                    }
                };
            } else if (type === 'area') {
                const lineOptions = this.charts.revenue.options;
                lineOptions.elements = {
                    line: {
                        fill: true
                    }
                };
                return lineOptions;
            }
        }
        
        return baseOptions;
    }
    
    // Add real-time data point
    addDataPoint(sale) {
        // Update revenue chart
        if (this.charts.revenue) {
            const today = new Date().toLocaleDateString();
            const labels = this.charts.revenue.data.labels;
            const lastLabel = labels[labels.length - 1];
            
            if (lastLabel === today) {
                // Add to existing day
                const currentValue = this.charts.revenue.data.datasets[0].data[labels.length - 1];
                this.charts.revenue.data.datasets[0].data[labels.length - 1] = currentValue + sale.amount;
            } else {
                // New day
                labels.push(today);
                this.charts.revenue.data.datasets[0].data.push(sale.amount);
                
                // Keep only last 30 days
                if (labels.length > 30) {
                    labels.shift();
                    this.charts.revenue.data.datasets[0].data.shift();
                }
            }
            
            this.charts.revenue.update();
        }
        
        // Update sparkline
        if (this.charts.sparkline) {
            const data = this.charts.sparkline.data.datasets[0].data;
            data.push(sale.amount);
            if (data.length > 30) data.shift();
            this.charts.sparkline.update('none');
        }
    }
    
    // Utility Methods
    createGradient(ctx, color) {
        const canvas = ctx.getContext('2d');
        const gradient = canvas.createLinearGradient(0, 0, 0, 400);
        
        const rgb = this.hexToRgb(color);
        gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`);
        gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
        
        return gradient;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    addCenterText(ctx, chart) {
        // Plugin to add text in center of doughnut
        chart.options.plugins.centerText = {
            display: true,
            text: '$0'
        };
        
        Chart.register({
            id: 'centerText',
            beforeDraw: (chart) => {
                if (chart.options.plugins.centerText?.display) {
                    const ctx = chart.ctx;
                    ctx.save();
                    
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                    
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = 'bold 24px Inter';
                    ctx.fillStyle = '#1f2937';
                    ctx.fillText(chart.options.plugins.centerText.text, centerX, centerY);
                    
                    ctx.restore();
                }
            }
        });
    }
    
    updateCenterText(chart, text) {
        if (chart.options.plugins.centerText) {
            chart.options.plugins.centerText.text = text;
            chart.update('none');
        }
    }
    
    // Comparison mode
    toggleComparison() {
        this.comparisonEnabled = !this.comparisonEnabled;
        
        if (window.analytics) {
            const metrics = window.analytics.calculateMetrics();
            this.updateRevenueChart(metrics.revenue);
        }
    }
    
    // Update all charts with new data
    updateAll(metrics) {
        this.updateRevenueChart(metrics.revenue);
        this.updatePlatformChart(metrics.platforms);
        
        // Update sparkline with daily values
        const dailyValues = Object.values(metrics.revenue.byDate || {});
        this.updateSparkline(dailyValues);
    }
    
    // Destroy all charts
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
    
    // Export chart as image
    exportChart(chartName) {
        const chart = this.charts[chartName];
        if (!chart) return;
        
        const url = chart.toBase64Image();
        const link = document.createElement('a');
        link.download = `${chartName}-chart-${new Date().toISOString().split('T')[0]}.png`;
        link.href = url;
        link.click();
    }
}

// Additional chart types and visualizations

// Cohort Chart
function createCohortChart(containerId, cohortData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const months = Object.keys(cohortData).sort();
    const maxMonths = Math.max(...months.map(m => 
        Object.keys(cohortData[m].retention).length
    ));
    
    // Create grid
    let html = '<div class="cohort-grid">';
    
    // Header row
    html += '<div class="cohort-cell header">Cohort</div>';
    for (let i = 0; i <= maxMonths; i++) {
        html += `<div class="cohort-cell header">M${i}</div>`;
    }
    
    // Data rows
    months.forEach(month => {
        const cohort = cohortData[month];
        html += `<div class="cohort-cell label">${month}</div>`;
        
        for (let i = 0; i <= maxMonths; i++) {
            const retention = cohort.retention[i];
            if (retention) {
                const percentage = (retention.activeUsers / cohort.customers.size * 100).toFixed(1);
                const color = getRetentionColor(percentage);
                html += `<div class="cohort-cell" style="background: ${color}">${percentage}%</div>`;
            } else {
                html += '<div class="cohort-cell">-</div>';
            }
        }
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function getRetentionColor(percentage) {
    const value = parseFloat(percentage);
    if (value >= 80) return '#d1fae5';
    if (value >= 60) return '#a7f3d0';
    if (value >= 40) return '#fef3c7';
    if (value >= 20) return '#fed7aa';
    return '#fee2e2';
}

// AB Test Visualization
function createABTestChart(containerId, testResults) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let html = '';
    
    Object.entries(testResults.variants).forEach(([id, variant]) => {
        const isWinner = id === testResults.winner;
        html += `
            <div class="ab-test-card ${isWinner ? 'winner' : ''}">
                <div class="test-info">
                    <h4>${variant.name}</h4>
                    <div class="test-variants">
                        <div class="variant">
                            <span class="variant-color" style="background: ${getVariantColor(id)}"></span>
                            <span>${variant.visitors} visitors</span>
                        </div>
                    </div>
                    <div class="test-status">
                        Conversion: ${variant.conversionRate}% • Revenue: $${variant.revenue.toFixed(2)}
                    </div>
                </div>
                ${isWinner ? `
                    <div class="test-winner">
                        <i class="fas fa-trophy"></i> Winner
                        <br>
                        <small>${testResults.confidence}% confidence</small>
                    </div>
                ` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getVariantColor(id) {
    const colors = {
        'control': '#6b7280',
        'variant-a': '#7c3aed',
        'variant-b': '#10b981',
        'variant-c': '#f59e0b'
    };
    return colors[id] || '#3b82f6';
}

// Initialize charts
window.charts = new AnalyticsCharts();