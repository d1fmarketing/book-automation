#!/usr/bin/env node

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const crypto = require('crypto');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Store for analytics data (in production, use a database)
const analyticsStore = {
    sales: [],
    visitors: [],
    events: [],
    webhooks: new Map()
};

// Connected WebSocket clients
const wsClients = new Set();

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New analytics client connected');
    wsClients.add(ws);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleWebSocketMessage(ws, data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    
    ws.on('close', () => {
        wsClients.delete(ws);
        console.log('Analytics client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        wsClients.delete(ws);
    });
});

// Handle WebSocket messages
function handleWebSocketMessage(ws, data) {
    switch (data.type) {
        case 'subscribe':
            // Client subscribing to specific channels
            ws.channels = data.channels || ['sales'];
            ws.send(JSON.stringify({
                type: 'subscribed',
                channels: ws.channels
            }));
            break;
            
        case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
    }
}

// Broadcast to WebSocket clients
function broadcast(type, data, channel = 'all') {
    const message = JSON.stringify({
        type,
        channel,
        data,
        timestamp: new Date().toISOString()
    });
    
    wsClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            if (channel === 'all' || client.channels?.includes(channel)) {
                client.send(message);
            }
        }
    });
}

// API Routes

// Record a sale
app.post('/api/sales', async (req, res) => {
    try {
        const sale = {
            id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            ...req.body
        };
        
        analyticsStore.sales.push(sale);
        
        // Broadcast to clients
        broadcast('new-sale', { sale }, 'sales');
        
        res.json({ success: true, saleId: sale.id });
    } catch (error) {
        console.error('Error recording sale:', error);
        res.status(500).json({ error: error.message });
    }
});

// Batch sales upload
app.post('/api/sales/batch', async (req, res) => {
    try {
        const { sales } = req.body;
        let processed = 0;
        
        for (const sale of sales) {
            if (!sale.id) {
                sale.id = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            analyticsStore.sales.push(sale);
            processed++;
        }
        
        res.json({ success: true, processed });
    } catch (error) {
        console.error('Error processing batch sales:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent sales
app.get('/api/sales/recent', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const recent = analyticsStore.sales
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
    
    res.json(recent);
});

// Get analytics summary
app.get('/api/analytics/summary', (req, res) => {
    const { start, end } = req.query;
    
    let sales = analyticsStore.sales;
    
    // Filter by date range if provided
    if (start) {
        sales = sales.filter(s => new Date(s.timestamp) >= new Date(start));
    }
    if (end) {
        sales = sales.filter(s => new Date(s.timestamp) <= new Date(end));
    }
    
    // Calculate summary
    const summary = {
        totalRevenue: sales.reduce((sum, s) => sum + (s.refunded ? 0 : s.amount), 0),
        totalSales: sales.filter(s => !s.refunded).length,
        refunds: sales.filter(s => s.refunded).length,
        averageOrderValue: sales.length > 0 
            ? sales.reduce((sum, s) => sum + s.amount, 0) / sales.length 
            : 0,
        byPlatform: groupBy(sales, 'platform'),
        byCountry: groupBy(sales, 'customerCountry'),
        topEbooks: getTopEbooks(sales)
    };
    
    res.json(summary);
});

// Record visitor/analytics event
app.post('/api/analytics/event', (req, res) => {
    try {
        const event = {
            id: crypto.randomBytes(16).toString('hex'),
            timestamp: new Date().toISOString(),
            ...req.body
        };
        
        analyticsStore.events.push(event);
        
        // Process specific event types
        if (event.type === 'visitor') {
            analyticsStore.visitors.push(event);
        }
        
        // Broadcast analytics update
        broadcast('analytics-update', { event }, 'analytics');
        
        res.json({ success: true, eventId: event.id });
    } catch (error) {
        console.error('Error recording event:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook endpoints for payment platforms

// Gumroad webhook
app.post('/api/webhooks/gumroad', async (req, res) => {
    try {
        // Verify webhook signature (in production)
        const signature = req.headers['gumroad-signature'];
        
        // Process webhook
        const sale = processGumroadWebhook(req.body);
        if (sale) {
            analyticsStore.sales.push(sale);
            broadcast('new-sale', { sale }, 'sales');
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Gumroad webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Stripe webhook
app.post('/api/webhooks/stripe', async (req, res) => {
    try {
        // Verify webhook signature
        const sig = req.headers['stripe-signature'];
        
        // Process webhook
        const sale = processStripeWebhook(req.body);
        if (sale) {
            analyticsStore.sales.push(sale);
            broadcast('new-sale', { sale }, 'sales');
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});

// PayPal webhook
app.post('/api/webhooks/paypal', async (req, res) => {
    try {
        // Verify webhook
        const sale = processPayPalWebhook(req.body);
        if (sale) {
            analyticsStore.sales.push(sale);
            broadcast('new-sale', { sale }, 'sales');
        }
        
        res.json({ received: true });
    } catch (error) {
        console.error('PayPal webhook error:', error);
        res.status(400).json({ error: error.message });
    }
});

// KDP report upload
app.post('/api/webhooks/kdp', async (req, res) => {
    try {
        const { csvData } = req.body;
        const sales = parseKDPReport(csvData);
        
        sales.forEach(sale => {
            analyticsStore.sales.push(sale);
            broadcast('new-sale', { sale }, 'sales');
        });
        
        res.json({ received: true, processed: sales.length });
    } catch (error) {
        console.error('KDP report error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Export data
app.get('/api/analytics/export', async (req, res) => {
    try {
        const { format = 'json', start, end } = req.query;
        
        let data = {
            sales: analyticsStore.sales,
            visitors: analyticsStore.visitors,
            events: analyticsStore.events
        };
        
        // Filter by date range
        if (start || end) {
            data = filterByDateRange(data, start, end);
        }
        
        switch (format) {
            case 'csv':
                const csv = convertToCSV(data.sales);
                res.header('Content-Type', 'text/csv');
                res.attachment(`analytics-export-${Date.now()}.csv`);
                res.send(csv);
                break;
                
            case 'json':
            default:
                res.json(data);
                break;
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        sales: analyticsStore.sales.length,
        visitors: analyticsStore.visitors.length,
        wsClients: wsClients.size
    });
});

// Helper functions

function groupBy(array, key) {
    return array.reduce((result, item) => {
        const group = item[key] || 'unknown';
        result[group] = (result[group] || 0) + 1;
        return result;
    }, {});
}

function getTopEbooks(sales) {
    const ebookRevenue = {};
    
    sales.filter(s => !s.refunded).forEach(sale => {
        const id = sale.ebookId || 'unknown';
        ebookRevenue[id] = (ebookRevenue[id] || 0) + sale.amount;
    });
    
    return Object.entries(ebookRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id, revenue]) => ({ id, revenue }));
}

function processGumroadWebhook(data) {
    if (data.event === 'sale.created') {
        return {
            id: data.sale.id,
            platform: 'gumroad',
            timestamp: new Date().toISOString(),
            ebookId: data.sale.product_id,
            ebookTitle: data.sale.product_name,
            amount: data.sale.price / 100,
            currency: data.sale.currency,
            customerEmail: hashEmail(data.sale.email),
            customerCountry: data.sale.country,
            affiliateId: data.sale.affiliate
        };
    }
    return null;
}

function processStripeWebhook(data) {
    if (data.type === 'payment_intent.succeeded') {
        const payment = data.data.object;
        return {
            id: payment.id,
            platform: 'stripe',
            timestamp: new Date().toISOString(),
            ebookId: payment.metadata?.product_id,
            ebookTitle: payment.metadata?.product_name,
            amount: payment.amount / 100,
            currency: payment.currency.toUpperCase(),
            customerEmail: hashEmail(payment.receipt_email),
            customerCountry: payment.charges?.data?.[0]?.billing_details?.address?.country
        };
    }
    return null;
}

function processPayPalWebhook(data) {
    if (data.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const capture = data.resource;
        return {
            id: capture.id,
            platform: 'paypal',
            timestamp: new Date().toISOString(),
            ebookId: capture.custom_id,
            amount: parseFloat(capture.amount.value),
            currency: capture.amount.currency_code,
            customerEmail: hashEmail(capture.payer?.email_address),
            customerCountry: capture.payer?.address?.country_code
        };
    }
    return null;
}

function parseKDPReport(csvData) {
    // Parse Amazon KDP CSV report
    // Implementation depends on actual KDP report format
    return [];
}

function hashEmail(email) {
    if (!email) return 'anonymous';
    return 'user_' + crypto.createHash('md5').update(email).digest('hex').substr(0, 8);
}

function filterByDateRange(data, start, end) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    
    const filterItems = (items) => {
        return items.filter(item => {
            const date = new Date(item.timestamp);
            return (!startDate || date >= startDate) && (!endDate || date <= endDate);
        });
    };
    
    return {
        sales: filterItems(data.sales),
        visitors: filterItems(data.visitors),
        events: filterItems(data.events)
    };
}

function convertToCSV(sales) {
    const headers = [
        'Date', 'Time', 'Sale ID', 'Platform', 'Ebook', 'Amount', 
        'Currency', 'Country', 'Source', 'Refunded'
    ];
    
    const rows = sales.map(sale => [
        new Date(sale.timestamp).toLocaleDateString(),
        new Date(sale.timestamp).toLocaleTimeString(),
        sale.id,
        sale.platform,
        sale.ebookTitle || sale.ebookId,
        sale.amount,
        sale.currency,
        sale.customerCountry,
        sale.source || '',
        sale.refunded ? 'Yes' : 'No'
    ]);
    
    return [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
}

// Simulate some sales data for demo
function generateDemoData() {
    const platforms = ['gumroad', 'stripe', 'paypal', 'kdp'];
    const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR'];
    const ebooks = [
        'ai-prompts-for-business',
        'passive-income-guide',
        'crypto-trading-basics',
        'social-media-mastery'
    ];
    
    // Generate sales for last 30 days
    for (let i = 0; i < 100; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);
        
        analyticsStore.sales.push({
            id: `demo_sale_${i}`,
            timestamp: timestamp.toISOString(),
            platform: platforms[Math.floor(Math.random() * platforms.length)],
            ebookId: ebooks[Math.floor(Math.random() * ebooks.length)],
            ebookTitle: ebooks[Math.floor(Math.random() * ebooks.length)].replace(/-/g, ' '),
            amount: Math.floor(Math.random() * 50) + 27,
            currency: 'USD',
            customerCountry: countries[Math.floor(Math.random() * countries.length)],
            source: Math.random() > 0.5 ? 'organic' : 'affiliate',
            refunded: Math.random() > 0.95
        });
    }
    
    console.log('Generated demo data: 100 sales');
}

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.ANALYTICS_PORT || 3004;
server.listen(PORT, () => {
    console.log(`📊 Analytics server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    console.log(`📈 Dashboard: http://localhost:${PORT}`);
    
    // Generate demo data
    if (process.env.DEMO_MODE === 'true') {
        generateDemoData();
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    
    // Close WebSocket connections
    wsClients.forEach(client => {
        client.close();
    });
    
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});