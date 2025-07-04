# Money Machine Control Panel

Advanced pipeline management interface for the Money Machine ebook automation system.

## Features

### 🎯 Overview Dashboard
- Real-time pipeline status monitoring
- Visual pipeline flow with phase indicators
- Quick action buttons for common tasks
- Performance statistics and metrics

### 🔧 Pipeline Management
- Sequential/Parallel/Manual execution modes
- Error handling configuration
- Phase enable/disable toggles
- Auto-retry and notification settings

### ⚙️ Configuration Center
- Topic Research: Source selection, topic count, score thresholds
- Deep Research: Depth levels, citation styles, statistics
- Content Generation: AI model selection, chapter settings, writing styles
- Image Generation: Cover styles, color schemes, chapter images
- Quality Assurance: Lighthouse thresholds, grammar/plagiarism checks
- Publishing: Platform selection, pricing, auto-publish

### 📋 Job Queue
- Real-time job monitoring
- Progress tracking for each phase
- Job details and output viewing
- Queue management (pause, clear, cancel)

### 📊 Performance Monitor
- API usage tracking with visual indicators
- Cost tracking (daily, weekly, monthly)
- Pipeline performance charts
- Resource utilization metrics

### 📝 System Logs
- Real-time log streaming
- Level-based filtering (error, warning, info)
- Search functionality
- Export capabilities

### 🚀 Advanced Features
- **Batch Mode**: Process multiple ebooks simultaneously
- **Scheduling**: One-time, daily, weekly, or custom cron schedules
- **API Key Management**: Secure storage and testing
- **Presets**: Save and load pipeline configurations
- **History**: View past pipeline runs and results

## Installation

```bash
# Navigate to control panel directory
cd control-panel

# Install dependencies (if not already installed)
npm install

# Start the control panel
./start-control-panel.sh

# Or with demo mode
./start-control-panel.sh --demo
```

## Usage

### Starting a Pipeline Run

1. Click "Start Full Pipeline" for automatic processing
2. Or use individual phase controls for manual execution
3. Monitor progress in real-time through the visual pipeline

### Batch Processing

1. Click "Batch Mode"
2. Configure:
   - Number of ebooks to generate
   - Parallel processing limit
   - Topic selection mode
   - Delay between jobs
3. Click "Start Batch"

### Scheduling Runs

1. Click "Schedule"
2. Choose schedule type:
   - One-time: Specific date and time
   - Daily: Run at same time each day
   - Weekly: Select days and time
   - Custom Cron: Advanced scheduling
3. Select timezone
4. Save schedule

### Configuration

1. Navigate to Configuration tab
2. Adjust settings for each phase
3. Click "Save Configuration"
4. Export/Import configurations for backup

### API Key Management

1. Click "API Keys" in header
2. Enter your API keys:
   - OpenAI API Key
   - Perplexity API Key
   - Ideogram API Key
3. Test keys to verify
4. Save securely

## API Endpoints

- `GET /api/health` - Server health check
- `POST /api/pipeline/start` - Start pipeline run
- `POST /api/pipeline/stop` - Stop pipeline (emergency stop available)
- `POST /api/pipeline/phase/:phase` - Run specific phase
- `GET /api/queue` - Get current job queue
- `GET /api/jobs/:jobId` - Get job details
- `GET /api/performance` - Get performance metrics
- `GET /api/history` - Get pipeline run history

## WebSocket Events

### Client → Server
- `save-config` - Save configuration
- `get-stats` - Request statistics update

### Server → Client
- `pipeline-status` - Pipeline status updates
- `phase-update` - Phase completion updates
- `job-progress` - Job progress updates
- `stats-update` - Statistics updates
- `log-entry` - New log entries
- `api-usage` - API usage updates

## Configuration File

Configuration is saved to `config.json` and includes:
- Pipeline execution settings
- Phase-specific configurations
- API endpoints and limits
- Notification preferences

## Troubleshooting

### Control panel won't start
- Check if port 3005 is available
- Verify Node.js installation (v20+)
- Check console for error messages

### WebSocket connection fails
- Ensure server is running
- Check firewall settings
- Verify WebSocket URL

### API keys not working
- Test keys using the built-in tester
- Verify key format and permissions
- Check API service status

## Environment Variables

- `CONTROL_PORT` - Server port (default: 3005)
- `DEMO_MODE` - Enable demo mode with simulated data
- `LOG_LEVEL` - Logging verbosity

## Security Notes

- API keys are stored locally in browser storage
- Keys are masked in the UI for security
- Server-side encryption recommended for production
- Use HTTPS in production environments

## Development

```bash
# Run in development mode
NODE_ENV=development node server.js

# Enable debug logging
DEBUG=control:* node server.js
```

## Architecture

- Frontend: Vanilla JavaScript with WebSocket connection
- Backend: Express.js with WebSocket server
- Storage: In-memory with optional persistence
- Communication: REST API + WebSocket for real-time updates