// Sales Data Collector Module
class SalesCollector {
    constructor() {
        this.webhookEndpoints = {
            gumroad: '/api/webhooks/gumroad',
            stripe: '/api/webhooks/stripe',
            paypal: '/api/webhooks/paypal',
            kdp: '/api/webhooks/kdp'
        };
        
        this.salesQueue = [];
        this.wsConnection = null;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        
        this.init();
    }
    
    init() {
        // Initialize WebSocket connection
        this.connectWebSocket();
        
        // Load cached sales data
        this.loadCachedSales();
        
        // Set up periodic sync
        this.startPeriodicSync();
        
        console.log('💰 Sales collector initialized');
    }
    
    // WebSocket connection for real-time updates
    connectWebSocket() {
        const wsUrl = window.location.protocol === 'https:' 
            ? `wss://${window.location.host}/ws`
            : `ws://localhost:3004/ws`;
        
        try {
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('📡 Connected to sales stream');
                this.retryAttempts = 0;
                
                // Subscribe to sales events
                this.wsConnection.send(JSON.stringify({
                    type: 'subscribe',
                    channels: ['sales', 'refunds', 'analytics']
                }));
            };
            
            this.wsConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealtimeEvent(data);
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            this.wsConnection.onclose = () => {
                console.log('WebSocket disconnected');
                this.scheduleReconnect();
            };
            
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    
    scheduleReconnect() {
        if (this.retryAttempts < this.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
            this.retryAttempts++;
            
            setTimeout(() => {
                console.log(`Attempting reconnect (${this.retryAttempts}/${this.maxRetries})...`);
                this.connectWebSocket();
            }, delay);
        }
    }
    
    handleRealtimeEvent(data) {
        switch (data.type) {
            case 'new-sale':
                this.processSale(data.sale);
                this.showSaleNotification(data.sale);
                break;
                
            case 'refund':
                this.processRefund(data.refund);
                break;
                
            case 'analytics-update':
                this.updateAnalytics(data.analytics);
                break;
                
            case 'platform-status':
                this.updatePlatformStatus(data.platform, data.status);
                break;
        }
    }
    
    // Process incoming sale
    processSale(sale) {
        // Normalize sale data
        const normalizedSale = this.normalizeSaleData(sale);
        
        // Add to queue
        this.salesQueue.push(normalizedSale);
        
        // Update UI immediately
        this.updateDashboard(normalizedSale);
        
        // Persist to local storage
        this.cacheSale(normalizedSale);
        
        // Send to analytics engine
        if (window.analytics) {
            window.analytics.recordSale(normalizedSale);
        }
        
        // Track conversion source
        this.trackConversionSource(normalizedSale);
    }
    
    normalizeSaleData(sale) {
        return {
            id: sale.id || `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: sale.timestamp || new Date().toISOString(),
            platform: sale.platform,
            ebookId: sale.product_id || sale.ebookId,
            ebookTitle: sale.product_name || sale.ebookTitle,
            amount: parseFloat(sale.amount || sale.price),
            currency: sale.currency || 'USD',
            customerEmail: this.hashEmail(sale.customer_email || sale.email),
            customerCountry: sale.country || sale.customer_country || 'Unknown',
            source: sale.source || this.detectSource(sale),
            affiliateId: sale.affiliate_id || sale.affiliateId,
            refunded: false,
            metadata: sale.metadata || {}
        };
    }
    
    hashEmail(email) {
        if (!email) return 'anonymous';
        // Simple hash for privacy
        return 'user_' + btoa(email).substr(0, 8);
    }
    
    detectSource(sale) {
        // Check for UTM parameters or referrer
        if (sale.utm_source) return sale.utm_source;
        if (sale.referrer?.includes('google')) return 'google';
        if (sale.referrer?.includes('facebook')) return 'facebook';
        if (sale.affiliate_id) return 'affiliate';
        return 'organic';
    }
    
    trackConversionSource(sale) {
        // Match with reader analytics if possible
        const readerSession = this.findReaderSession(sale.customerEmail);
        
        if (readerSession) {
            sale.readerMetrics = {
                readingTime: readerSession.readingTime,
                chaptersRead: readerSession.chaptersCompleted,
                highlightsCount: readerSession.highlights,
                clickedAffiliate: readerSession.affiliateClicks
            };
        }
    }
    
    findReaderSession(customerHash) {
        // Check if we have reader analytics for this customer
        const sessions = JSON.parse(localStorage.getItem('reader-sessions') || '[]');
        return sessions.find(s => s.customerHash === customerHash);
    }
    
    // Process refunds
    processRefund(refund) {
        // Find original sale
        const originalSale = this.findSale(refund.sale_id);
        
        if (originalSale) {
            originalSale.refunded = true;
            originalSale.refundDate = refund.timestamp;
            originalSale.refundReason = refund.reason;
            
            // Update analytics
            if (window.analytics) {
                window.analytics.recordRefund(originalSale);
            }
            
            // Update cached data
            this.updateCachedSale(originalSale);
        }
    }
    
    findSale(saleId) {
        // Check queue first
        let sale = this.salesQueue.find(s => s.id === saleId);
        
        if (!sale) {
            // Check cached sales
            const cached = JSON.parse(localStorage.getItem('sales-cache') || '[]');
            sale = cached.find(s => s.id === saleId);
        }
        
        return sale;
    }
    
    // Platform webhook handlers
    async handleGumroadWebhook(data) {
        if (data.event === 'sale.created') {
            const sale = {
                platform: 'gumroad',
                id: data.sale.id,
                product_id: data.sale.product_id,
                product_name: data.sale.product_name,
                amount: data.sale.price / 100, // Convert cents to dollars
                currency: data.sale.currency,
                customer_email: data.sale.email,
                country: data.sale.country,
                affiliate_id: data.sale.affiliate
            };
            
            this.processSale(sale);
        } else if (data.event === 'sale.refunded') {
            this.processRefund({
                sale_id: data.sale.id,
                timestamp: new Date().toISOString(),
                reason: 'Customer requested'
            });
        }
    }
    
    async handleStripeWebhook(data) {
        if (data.type === 'payment_intent.succeeded') {
            const payment = data.data.object;
            
            const sale = {
                platform: 'stripe',
                id: payment.id,
                product_id: payment.metadata.product_id,
                product_name: payment.metadata.product_name,
                amount: payment.amount / 100,
                currency: payment.currency.toUpperCase(),
                customer_email: payment.receipt_email,
                country: payment.charges.data[0]?.billing_details?.address?.country
            };
            
            this.processSale(sale);
        } else if (data.type === 'charge.refunded') {
            this.processRefund({
                sale_id: data.data.object.payment_intent,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    async handlePayPalWebhook(data) {
        if (data.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
            const capture = data.resource;
            
            const sale = {
                platform: 'paypal',
                id: capture.id,
                product_id: capture.custom_id,
                amount: parseFloat(capture.amount.value),
                currency: capture.amount.currency_code,
                customer_email: capture.payer?.email_address,
                country: capture.payer?.address?.country_code
            };
            
            this.processSale(sale);
        }
    }
    
    // Amazon KDP report parser
    async parseKDPReport(csvData) {
        const lines = csvData.split('\n');
        const headers = lines[0].split(',');
        const sales = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < headers.length) continue;
            
            const sale = {
                platform: 'kdp',
                id: `kdp_${values[0]}_${Date.now()}`,
                product_id: values[headers.indexOf('ASIN')],
                product_name: values[headers.indexOf('Title')],
                amount: parseFloat(values[headers.indexOf('Royalty')]),
                currency: values[headers.indexOf('Currency')],
                country: values[headers.indexOf('Marketplace')],
                timestamp: values[headers.indexOf('Sale Date')]
            };
            
            sales.push(sale);
        }
        
        // Process all sales
        sales.forEach(sale => this.processSale(sale));
        
        return sales.length;
    }
    
    // Currency conversion
    async convertCurrency(amount, fromCurrency, toCurrency = 'USD') {
        if (fromCurrency === toCurrency) return amount;
        
        try {
            // Use cached rates first
            const rates = this.getCachedRates();
            
            if (rates[fromCurrency]) {
                return amount / rates[fromCurrency] * rates[toCurrency];
            }
            
            // Fetch new rates if needed
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
            const data = await response.json();
            
            // Cache rates
            localStorage.setItem('currency-rates', JSON.stringify({
                rates: data.rates,
                timestamp: Date.now()
            }));
            
            return amount / data.rates[fromCurrency];
            
        } catch (error) {
            console.error('Currency conversion failed:', error);
            return amount; // Return original amount if conversion fails
        }
    }
    
    getCachedRates() {
        const cached = localStorage.getItem('currency-rates');
        if (!cached) return {};
        
        const { rates, timestamp } = JSON.parse(cached);
        
        // Rates are valid for 24 hours
        if (Date.now() - timestamp < 86400000) {
            return rates;
        }
        
        return {};
    }
    
    // Update dashboard UI
    updateDashboard(sale) {
        // Update total revenue
        const revenueEl = document.getElementById('total-revenue');
        if (revenueEl) {
            const currentRevenue = parseFloat(revenueEl.textContent);
            revenueEl.textContent = (currentRevenue + sale.amount).toFixed(2);
        }
        
        // Update sales count
        const salesEl = document.getElementById('total-sales');
        if (salesEl) {
            salesEl.textContent = parseInt(salesEl.textContent) + 1;
        }
        
        // Add to recent sales table
        this.addToRecentSales(sale);
        
        // Update charts if available
        if (window.charts) {
            window.charts.addDataPoint(sale);
        }
    }
    
    addToRecentSales(sale) {
        const table = document.getElementById('recent-sales-table');
        if (!table) return;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(sale.timestamp).toLocaleTimeString()}</td>
            <td>${sale.ebookTitle || 'Unknown'}</td>
            <td>
                <span class="platform-badge ${sale.platform}">
                    ${sale.platform}
                </span>
            </td>
            <td>$${sale.amount.toFixed(2)}</td>
            <td>
                <span class="country-flag">${this.getCountryFlag(sale.customerCountry)}</span>
                ${sale.customerCountry}
            </td>
        `;
        
        // Add to top of table
        table.insertBefore(row, table.firstChild);
        
        // Keep only last 10 sales
        while (table.children.length > 10) {
            table.removeChild(table.lastChild);
        }
        
        // Highlight new row
        row.style.animation = 'highlight 2s ease';
    }
    
    getCountryFlag(country) {
        const flags = {
            'US': '🇺🇸',
            'UK': '🇬🇧',
            'CA': '🇨🇦',
            'AU': '🇦🇺',
            'DE': '🇩🇪',
            'FR': '🇫🇷',
            'ES': '🇪🇸',
            'IT': '🇮🇹',
            'JP': '🇯🇵',
            'BR': '🇧🇷'
        };
        
        return flags[country] || '🌍';
    }
    
    // Show sale notification
    showSaleNotification(sale) {
        const notification = document.getElementById('sale-notification');
        const details = document.getElementById('notification-details');
        
        if (!notification || !details) return;
        
        details.innerHTML = `
            <strong>$${sale.amount.toFixed(2)}</strong> - ${sale.ebookTitle || 'Ebook'}
            <br>
            <small>${sale.platform} • ${sale.customerCountry}</small>
        `;
        
        notification.classList.add('show');
        
        // Play sound if enabled
        if (localStorage.getItem('notification-sound') !== 'false') {
            this.playNotificationSound();
        }
        
        // Hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 5000);
    }
    
    playNotificationSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Local storage operations
    cacheSale(sale) {
        const cached = JSON.parse(localStorage.getItem('sales-cache') || '[]');
        cached.push(sale);
        
        // Keep only last 1000 sales
        if (cached.length > 1000) {
            cached.shift();
        }
        
        localStorage.setItem('sales-cache', JSON.stringify(cached));
    }
    
    updateCachedSale(sale) {
        const cached = JSON.parse(localStorage.getItem('sales-cache') || '[]');
        const index = cached.findIndex(s => s.id === sale.id);
        
        if (index !== -1) {
            cached[index] = sale;
            localStorage.setItem('sales-cache', JSON.stringify(cached));
        }
    }
    
    loadCachedSales() {
        const cached = JSON.parse(localStorage.getItem('sales-cache') || '[]');
        console.log(`Loaded ${cached.length} cached sales`);
        return cached;
    }
    
    // Periodic sync with server
    startPeriodicSync() {
        // Sync every 5 minutes
        setInterval(() => {
            this.syncWithServer();
        }, 300000);
        
        // Initial sync
        this.syncWithServer();
    }
    
    async syncWithServer() {
        if (this.salesQueue.length === 0) return;
        
        try {
            const response = await fetch('/api/sales/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sales: this.salesQueue
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Synced ${result.processed} sales`);
                
                // Clear synced sales from queue
                this.salesQueue = [];
            }
            
        } catch (error) {
            console.error('Sync failed:', error);
        }
    }
    
    // Start real-time updates
    startRealTimeUpdates() {
        // Check for WebSocket support
        if (!window.WebSocket) {
            console.warn('WebSocket not supported, falling back to polling');
            this.startPolling();
            return;
        }
        
        // WebSocket is already initialized in constructor
        console.log('Real-time updates active');
    }
    
    // Fallback polling for older browsers
    startPolling() {
        setInterval(async () => {
            try {
                const response = await fetch('/api/sales/recent');
                const sales = await response.json();
                
                sales.forEach(sale => {
                    if (!this.findSale(sale.id)) {
                        this.processSale(sale);
                    }
                });
                
            } catch (error) {
                console.error('Polling failed:', error);
            }
        }, 30000); // Poll every 30 seconds
    }
    
    // Export functionality
    exportSalesData(format = 'csv', dateRange = {}) {
        const sales = this.getSalesForExport(dateRange);
        
        switch (format) {
            case 'csv':
                this.exportAsCSV(sales);
                break;
            case 'json':
                this.exportAsJSON(sales);
                break;
            case 'excel':
                this.exportAsExcel(sales);
                break;
        }
    }
    
    getSalesForExport(dateRange) {
        let sales = this.loadCachedSales();
        
        if (dateRange.start) {
            sales = sales.filter(s => new Date(s.timestamp) >= new Date(dateRange.start));
        }
        
        if (dateRange.end) {
            sales = sales.filter(s => new Date(s.timestamp) <= new Date(dateRange.end));
        }
        
        return sales;
    }
    
    exportAsCSV(sales) {
        const headers = [
            'Date', 'Time', 'Platform', 'Ebook', 'Amount', 'Currency', 
            'Country', 'Source', 'Affiliate', 'Refunded'
        ];
        
        const rows = sales.map(sale => [
            new Date(sale.timestamp).toLocaleDateString(),
            new Date(sale.timestamp).toLocaleTimeString(),
            sale.platform,
            sale.ebookTitle,
            sale.amount,
            sale.currency,
            sale.customerCountry,
            sale.source,
            sale.affiliateId || '',
            sale.refunded ? 'Yes' : 'No'
        ]);
        
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        this.downloadFile(csv, 'sales-export.csv', 'text/csv');
    }
    
    exportAsJSON(sales) {
        const json = JSON.stringify(sales, null, 2);
        this.downloadFile(json, 'sales-export.json', 'application/json');
    }
    
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize collector
window.collector = new SalesCollector();