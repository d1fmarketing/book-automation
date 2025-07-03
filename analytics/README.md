# Money Machine Analytics Dashboard 📊

Comprehensive sales and revenue tracking dashboard for the Money Machine ebook automation system.

## Features

### 📈 Revenue Analytics
- **Real-time Revenue Tracking**: Live updates as sales come in
- **Multi-period Comparison**: Compare current vs previous periods
- **Currency Conversion**: Automatic conversion to USD
- **Revenue Forecasting**: AI-powered predictions based on trends
- **Refund Impact**: Track and analyze refund patterns

### 💰 Sales Metrics
- **Platform Breakdown**: See where sales come from (Gumroad, Stripe, PayPal, KDP)
- **Geographic Distribution**: Heat map of sales by country
- **Conversion Funnel**: Track visitor → reader → click → purchase journey
- **Average Order Value**: Monitor pricing effectiveness
- **Top Performing Ebooks**: Identify bestsellers

### 🔬 Advanced Analytics
- **Cohort Analysis**: Track customer lifetime value over time
- **A/B Test Results**: Compare different pricing/cover strategies
- **Source Attribution**: Understand which channels drive sales
- **Customer Segmentation**: Identify high-value customer groups
- **Trend Detection**: Automatic identification of sales patterns

### 🔗 Integration Features
- **Webhook Support**: Direct integration with payment platforms
- **Reader Analytics**: Connect with ebook reader engagement data
- **Affiliate Tracking**: Monitor affiliate link performance
- **Chat Widget Conversions**: Track AI assistant impact on sales

## Quick Start

```bash
# Start analytics server
cd analytics
node server.js

# Or with demo data
DEMO_MODE=true node server.js

# Access dashboard at
http://localhost:3004
```

## Payment Platform Integration

### Gumroad Setup
1. Go to Gumroad Settings → Advanced → Webhooks
2. Add webhook URL: `https://your-domain.com/api/webhooks/gumroad`
3. Select events: "Sale" and "Refund"
4. Copy webhook to dashboard settings

### Stripe Setup
```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3004/api/webhooks/stripe

# Or configure in Stripe Dashboard
# Webhook URL: https://your-domain.com/api/webhooks/stripe
# Events: payment_intent.succeeded, charge.refunded
```

### PayPal Setup
1. Login to PayPal Developer Dashboard
2. Create webhook: `https://your-domain.com/api/webhooks/paypal`
3. Subscribe to: PAYMENT.CAPTURE.COMPLETED

### Amazon KDP
- Upload monthly reports via dashboard
- Or automate with KDP report API

## Architecture

### Frontend (`index.html`)
- Pure JavaScript (no framework dependencies)
- Chart.js for visualizations
- WebSocket for real-time updates
- Responsive design for all devices

### Analytics Engine (`engine.js`)
- Metrics calculation and caching
- Date range filtering
- Comparison analysis
- Predictive algorithms

### Sales Collector (`collector.js`)
- Webhook processing
- Real-time WebSocket client
- Local storage for offline capability
- Currency conversion

### Charts Module (`charts.js`)
- Revenue trends visualization
- Platform distribution
- Funnel visualization
- Export capabilities

### Backend (`server.js`)
- Express REST API
- WebSocket server
- Webhook endpoints
- Data persistence

## API Endpoints

### Sales Management
```javascript
// Record a sale
POST /api/sales
{
  "platform": "gumroad",
  "ebookId": "ai-prompts",
  "amount": 47.00,
  "currency": "USD",
  "customerCountry": "US"
}

// Get recent sales
GET /api/sales/recent?limit=50

// Batch upload
POST /api/sales/batch
{
  "sales": [...]
}
```

### Analytics
```javascript
// Get summary
GET /api/analytics/summary?start=2025-01-01&end=2025-01-31

// Record event
POST /api/analytics/event
{
  "type": "visitor",
  "sessionId": "abc123",
  "source": "google"
}

// Export data
GET /api/analytics/export?format=csv
```

### Webhooks
```javascript
// Platform webhooks
POST /api/webhooks/gumroad
POST /api/webhooks/stripe
POST /api/webhooks/paypal
POST /api/webhooks/kdp
```

## WebSocket Events

### Client → Server
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['sales', 'analytics']
}));
```

### Server → Client
```javascript
// New sale notification
{
  type: 'new-sale',
  channel: 'sales',
  data: {
    sale: {...}
  }
}

// Analytics update
{
  type: 'analytics-update',
  channel: 'analytics',
  data: {
    metrics: {...}
  }
}
```

## Configuration

### Environment Variables
```bash
ANALYTICS_PORT=3004           # Server port
DEMO_MODE=true               # Generate demo data
CURRENCY_API_KEY=xxx         # For currency conversion
WEBHOOK_SECRET=xxx           # Webhook verification
```

### Dashboard Settings
- Real-time updates toggle
- Refund tracking
- Currency conversion
- Revenue goals
- Alert thresholds

## Data Schema

### Sale Object
```javascript
{
  id: "sale_123",
  timestamp: "2025-01-03T10:30:00Z",
  platform: "gumroad",
  ebookId: "ai-prompts-guide",
  ebookTitle: "AI Prompts Guide",
  amount: 47.00,
  currency: "USD",
  customerEmail: "user_a1b2c3d4", // Hashed
  customerCountry: "US",
  source: "organic",
  affiliateId: null,
  refunded: false,
  metadata: {}
}
```

### Visitor Event
```javascript
{
  type: "visitor",
  timestamp: "2025-01-03T10:25:00Z",
  sessionId: "session_123",
  ebookId: "ai-prompts-guide",
  source: "google",
  readingTime: 300,
  chaptersViewed: 3,
  affiliateClicks: 1
}
```

## Metrics Calculation

### Conversion Rate
```
Conversion Rate = (Sales / Unique Visitors) × 100
```

### Average Order Value
```
AOV = Total Revenue / Number of Sales
```

### Customer Lifetime Value
```
CLV = Average Order Value × Purchase Frequency × Customer Lifespan
```

### Cohort Retention
```
Retention Rate = (Customers in Month N / Initial Cohort Size) × 100
```

## Performance Optimization

- **Caching**: Metrics cached for 5 minutes
- **Pagination**: Large datasets paginated
- **Indexes**: Database indexes on timestamp, platform
- **Compression**: Gzip enabled for API responses
- **CDN**: Static assets served from CDN

## Security

- **Authentication**: API key required for write operations
- **Webhook Verification**: Signature validation for webhooks
- **Data Privacy**: Email hashing, no PII storage
- **CORS**: Configured for specific origins
- **Rate Limiting**: 100 requests/minute per IP

## Troubleshooting

### No Real-time Updates
- Check WebSocket connection in browser console
- Verify port 3004 is not blocked
- Check server logs for errors

### Missing Sales Data
- Verify webhook configuration in payment platform
- Check webhook logs in server
- Ensure proper webhook signature validation

### Chart Not Loading
- Clear browser cache
- Check for JavaScript errors
- Verify Chart.js loaded properly

### Export Not Working
- Check available disk space
- Verify export permissions
- Try smaller date ranges

## Advanced Features

### Custom Metrics
Add custom metrics by extending the analytics engine:
```javascript
// In engine.js
calculateCustomMetric() {
  return this.data.sales.filter(s => 
    s.metadata.customField === 'value'
  ).length;
}
```

### New Chart Types
Add visualizations in charts.js:
```javascript
// Create custom chart
createCustomChart() {
  new Chart(ctx, {
    type: 'radar',
    data: {...}
  });
}
```

### Automation
Schedule reports and alerts:
```javascript
// Daily revenue report
schedule.scheduleJob('0 9 * * *', async () => {
  const report = await generateDailyReport();
  await emailReport(report);
});
```

## Deployment

### Production Setup
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start analytics/server.js --name analytics

# Save PM2 config
pm2 save
pm2 startup
```

### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY analytics/ ./analytics/
EXPOSE 3004
CMD ["node", "analytics/server.js"]
```

### Nginx Configuration
```nginx
location /analytics {
  proxy_pass http://localhost:3004;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

## Future Enhancements

- [ ] Machine learning for sales prediction
- [ ] Automated anomaly detection
- [ ] Multi-currency support
- [ ] Email report scheduling
- [ ] Mobile app integration
- [ ] Blockchain payment tracking
- [ ] Social media ROI tracking
- [ ] Customer journey mapping
- [ ] Predictive churn analysis
- [ ] Revenue optimization AI