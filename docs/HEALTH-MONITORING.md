# Health Monitoring Setup

## Overview

The health monitoring system checks the status of all critical components and sends alerts to Slack when issues are detected.

## Components Monitored

1. **Admin Dashboard** - HTTP health endpoint
2. **Redis Connection** - Queue system connectivity
3. **Queue Health** - Job counts and failure rates
4. **Worker Processes** - PM2 managed processes
5. **Disk Space** - Storage availability

## Setup Instructions

### 1. Configure Slack Webhook (Optional)

Add to your `.env` file:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 2. Test Health Monitor

Run one-time check:
```bash
node scripts/health-monitor.js
```

### 3. Setup Cron Job

Add to crontab (runs every 5 minutes):
```bash
crontab -e

# Add this line:
*/5 * * * * cd /path/to/book-automation && ./scripts/health-check-cron.sh >> logs/health-monitor.log 2>&1
```

### 4. Setup PM2 Process (Alternative)

Run as PM2 process for continuous monitoring:
```bash
pm2 start scripts/health-monitor.js --name health-monitor
pm2 save
```

## Alert Types

- **🔴 Critical** - Service down or disk space >90%
- **⚠️ Warning** - High failure rates or disk space >80%
- **✅ Healthy** - All systems operational

## Customization

Edit `scripts/health-monitor.js` to:
- Adjust check intervals
- Add custom health checks
- Change alert thresholds
- Add email notifications

## Troubleshooting

1. **No PM2 processes found**: Start workers with `pm2 start ecosystem.config.js`
2. **Redis connection failed**: Ensure Redis is running with `redis-cli ping`
3. **Slack alerts not sending**: Verify webhook URL and network connectivity