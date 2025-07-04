# Money Machine Dashboard 💰

Real-time monitoring and control interface for the Money Machine ebook automation pipeline.

## Features

- **Real-time Stats**: Monitor total ebooks, revenue, API usage
- **Pipeline Visualization**: Track generation progress step-by-step
- **Recent Ebooks Grid**: View latest generated ebooks
- **Revenue Charts**: Visualize earnings over time
- **WebSocket Updates**: Live updates without page refresh
- **Responsive Design**: Works on desktop and mobile

## Quick Start

```bash
# Start the dashboard
npm run dashboard

# Or start server only (no browser open)
npm run dashboard:server
```

## Architecture

### Frontend (index.html)
- Pure HTML/CSS/JavaScript (no framework dependencies)
- WebSocket client for real-time updates
- Chart.js for revenue visualization
- Mobile-responsive CSS Grid layout

### Backend (server.js)
- Express.js REST API
- WebSocket server for real-time communication
- Mock data for development (connects to real pipeline in production)
- Automatic state broadcasting to all clients

## API Endpoints

### REST API
- `GET /api/stats` - Get current statistics
- `GET /api/ebooks` - List recent ebooks
- `GET /api/ebook/:id` - Get specific ebook details
- `POST /api/scan-topics` - Trigger topic scanning
- `POST /api/generate-ebook` - Start ebook generation
- `POST /api/update-quota` - Update API quota

### WebSocket Events

#### Client → Server
```javascript
{
  action: 'get-pipeline-status' | 'get-stats'
}
```

#### Server → Client
```javascript
// Welcome message
{
  type: 'welcome',
  stats: {...},
  pipeline: {...},
  recentEbooks: [...]
}

// Pipeline update
{
  type: 'pipeline-status',
  status: {
    currentStep: 0-4,
    steps: [...]
  }
}

// Stats update
{
  type: 'stats-update',
  stats: {
    totalEbooks: 24,
    monthlyRevenue: 1248,
    apiQuota: 78
  }
}

// New ebook notification
{
  type: 'new-ebook',
  ebook: {
    id: 1,
    title: '...',
    date: '2025-01-03',
    revenue: 124
  }
}
```

## Integration with Pipeline

The dashboard integrates with the main pipeline through:

1. **Redis Events** (when available)
2. **File System Monitoring** (build outputs)
3. **Direct API Calls** (trigger actions)

### Connecting to Real Pipeline

To connect the dashboard to your actual pipeline:

1. Update `server.js` to import pipeline modules:
```javascript
const { scanTrendingTopics } = require('../scanners/trending-money-scanner');
const { automationPipeline } = require('../scripts/automation-pipeline');
```

2. Replace mock implementations with real calls:
```javascript
app.post('/api/scan-topics', async (req, res) => {
  const topics = await scanTrendingTopics();
  res.json({ success: true, topics });
});
```

3. Monitor build directory for new ebooks:
```javascript
const watcher = chokidar.watch('build/ebooks/**/*.pdf', {
  persistent: true
});

watcher.on('add', (path) => {
  // Broadcast new ebook to clients
});
```

## Customization

### Themes
Edit CSS variables in `index.html`:
```css
:root {
  --primary: #7c3aed;
  --secondary: #10b981;
  --accent: #f59e0b;
}
```

### Add New Stats
1. Add to dashboard state in `server.js`
2. Create new stat card in `index.html`
3. Broadcast updates via WebSocket

### Pipeline Steps
Modify the `pipelineSteps` array to match your workflow:
```javascript
const pipelineSteps = ['scan', 'research', 'generate', 'qa', 'publish'];
```

## Development

### Running Locally
```bash
# Install dependencies
npm install

# Start dashboard
npm run dashboard

# Dashboard will open at http://localhost:3002
```

### Environment Variables
```bash
DASHBOARD_PORT=3002  # WebSocket/HTTP port
```

### Testing WebSocket
```javascript
// Browser console
const ws = new WebSocket('ws://localhost:3002');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ action: 'get-stats' }));
```

## Deployment

### PM2 (Recommended)
```bash
pm2 start dashboard/server.js --name money-machine-dashboard
pm2 save
pm2 startup
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3002
CMD ["node", "dashboard/server.js"]
```

### Nginx Proxy
```nginx
location /dashboard {
  proxy_pass http://localhost:3002;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection 'upgrade';
  proxy_set_header Host $host;
  proxy_cache_bypass $http_upgrade;
}
```

## Troubleshooting

### WebSocket Won't Connect
- Check if port 3002 is available: `lsof -i:3002`
- Verify no firewall blocking WebSocket
- Check browser console for errors

### Stats Not Updating
- Verify WebSocket connection in Network tab
- Check server logs: `npm run dashboard:server`
- Ensure Redis is running (if integrated)

### Dashboard Blank
- Clear browser cache
- Check for JavaScript errors
- Verify Chart.js loaded properly

## Future Enhancements

- [ ] Historical data persistence
- [ ] Export reports to CSV/PDF
- [ ] Email notifications
- [ ] Multi-user support
- [ ] Dark mode toggle
- [ ] Mobile app (React Native)
- [ ] Webhook integrations
- [ ] Advanced analytics
- [ ] A/B testing dashboard
- [ ] Cost tracking