# 📊 Rate Limiting and Cost Tracking Guide

## Overview

This guide explains how the rate limiting and cost tracking system works in the ebook automation pipeline.

## 🚦 Rate Limiting

### Configuration

Rate limits are configured in `.env`:

```bash
# Anthropic API Limits
ANTHROPIC_RPM=50           # Requests per minute
ANTHROPIC_TPM=100000       # Tokens per minute
ANTHROPIC_RPH=1000         # Requests per hour
ANTHROPIC_TPH=2000000      # Tokens per hour
```

### How It Works

1. **Pre-check**: Before each API call, the system checks if limits allow the request
2. **Throttling**: When usage > 80%, adds delays between requests
3. **Pausing**: When usage > 95%, pauses all requests until reset
4. **Circuit Breaker**: Falls back to cached content if API is unavailable

### Features

- **Adaptive Throttling**: Automatically slows down as limits approach
- **Multi-window Tracking**: Monitors minute, hour, and day windows
- **Service-specific Limits**: Different limits per API service
- **Real-time Monitoring**: Live updates in admin dashboard

## 💰 Cost Tracking

### Budget Configuration

Set budgets in `.env`:

```bash
# Budget Limits (USD)
DAILY_BUDGET=10.00         # Daily spending limit
MONTHLY_BUDGET=200.00      # Monthly spending limit
BOOK_BUDGET=2.00           # Per-book spending limit
```

### Cost Breakdown

Current API pricing (as of 2025):

| Service | Model | Input Cost | Output Cost |
|---------|-------|------------|-------------|
| Anthropic | Claude 3 Opus | $0.015/1K tokens | $0.075/1K tokens |
| Anthropic | Claude 3 Sonnet | $0.003/1K tokens | $0.015/1K tokens |
| Google | Gemini 2.5 Pro | $0.00125/1K tokens | $0.005/1K tokens |

### Features

- **Session Tracking**: Costs tracked per book/session
- **Budget Alerts**: Warnings at 80% of budget
- **Hard Stops**: Prevents overspending
- **ROI Calculation**: Shows break-even point
- **Export Reports**: CSV/JSON export of all costs

## 🎯 Usage Examples

### 1. Generate Book with Budget

```bash
# Set a $3 budget for this book
BOOK_BUDGET=3.00 node scripts/orchestrator-with-limits.js "AI Business Guide" --chapters 10
```

### 2. Check Current Status

```bash
# View rate limits and costs
node agents/writer-with-limits.js --status
```

### 3. Start Workers with Limits

```bash
# Workers that respect limits and track costs
node scripts/start-workers-with-limits.js
```

### 4. Use Admin Dashboard

The admin dashboard shows:
- Real-time rate limit status
- Current spending vs budgets
- Alerts and warnings

## 🛡️ Protection Mechanisms

### Rate Limit Protection

1. **Soft Limit (80%)**: Adds delays between requests
2. **Hard Limit (95%)**: Pauses all requests
3. **Circuit Breaker**: Uses fallback content if API fails

### Budget Protection

1. **Warning (80%)**: Shows alerts in dashboard
2. **Hard Stop (100%)**: Blocks new requests
3. **Session Limits**: Per-book budget enforcement

## 📈 Monitoring

### Admin Dashboard Widgets

1. **Rate Limit Widget**
   - Shows usage percentages
   - Indicates throttle status
   - Color-coded warnings

2. **Cost Tracking Widget**
   - Current spending
   - Budget progress bars
   - Alerts for overspending

### Logs and Reports

- Real-time logs in terminal
- Cost reports after each session
- Export data for analysis

## 🔧 Troubleshooting

### Common Issues

1. **"Rate limit exceeded"**
   - Wait for reset (shown in error)
   - Reduce concurrent requests
   - Increase delays between calls

2. **"Budget exceeded"**
   - Increase budget in .env
   - Use cheaper models
   - Reduce chapter count

3. **"Circuit breaker open"**
   - API is failing repeatedly
   - Check API status
   - Wait for automatic recovery

### Debug Commands

```bash
# Check rate limit status
curl http://localhost:3001/api/rate-limits

# Check current costs
curl http://localhost:3001/api/costs

# Export cost data
curl http://localhost:3001/api/costs/export > costs.json
```

## 💡 Best Practices

1. **Set Realistic Budgets**
   - Start with small test runs
   - Monitor actual costs
   - Adjust budgets accordingly

2. **Use Appropriate Models**
   - Claude 3 Opus: High quality, high cost
   - Claude 3 Sonnet: Good balance
   - Gemini 2.5 Pro: Lower cost alternative

3. **Optimize Prompts**
   - Shorter prompts = lower costs
   - Be specific to reduce rewrites
   - Cache common responses

4. **Monitor Regularly**
   - Check dashboard during runs
   - Review cost reports
   - Adjust limits as needed

## 📊 Cost Optimization Tips

1. **Batch Operations**: Process multiple chapters together
2. **Use Caching**: Avoid regenerating same content
3. **Fallback Content**: Use when approaching limits
4. **Off-peak Hours**: Some APIs have higher limits at night
5. **Model Selection**: Use cheaper models for drafts

## 🚀 Advanced Configuration

### Custom Rate Limits

Edit `src/middleware/RateLimiter.js` to add new services:

```javascript
limits: {
  newService: {
    requests: {
      perMinute: 100,
      perHour: 1000
    }
  }
}
```

### Custom Pricing

Edit `src/cost/CostTracker.js` to update pricing:

```javascript
PRICING = {
  anthropic: {
    'claude-3-opus': {
      input: 0.015,  // Update with latest pricing
      output: 0.075
    }
  }
}
```

## 🔗 Related Documentation

- [Admin Dashboard Guide](admin/HOW-TO-USE.md)
- [Pipeline Configuration](QUICKSTART.md)
- [API Setup Guide](docs/api-setup.md)