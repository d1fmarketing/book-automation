# Live Preview System

The live preview system provides real-time visual feedback as PDFs are generated, showing each page as it's rendered.

## Features

- **Real-time Updates**: See pages appear as they're generated
- **Progress Tracking**: Visual progress bar with percentage and page count
- **Page Navigation**: Click through pages or use arrow keys
- **Zoom Controls**: Zoom in/out or fit to window
- **WebSocket Communication**: Instant updates without polling
- **Authentication**: Secure preview access with token

## Quick Start

### Using npm scripts

```bash
# Generate PDF with live preview
npm run preview

# Generate with specific preset
npm run build:pdf:preview -- --preset clean

# Generate without preview (faster)
npm run preview -- --no-preview
```

### Direct usage

```bash
# Basic usage
node scripts/generate-pdf-with-preview.js

# With options
node scripts/generate-pdf-with-preview.js --preset professional --verbose

# Custom port
node scripts/generate-pdf-with-preview.js --preview-port 3002
```

## Architecture

```
preview-system/
├── preview-server.js       # Express server with WebSocket
├── preview-ui.html         # Web interface
├── preview-client.js       # Client-side JavaScript
├── pdf-preview-generator.js # Enhanced PDF generator
└── previews/              # Generated page images
```

## How It Works

1. **PDF Generation Starts**: The generator launches Puppeteer and begins rendering
2. **Preview Server**: Starts on port 3001 (configurable) with WebSocket support
3. **Page Capture**: As each page is rendered, a screenshot is captured
4. **Real-time Updates**: WebSocket broadcasts progress and new pages to connected clients
5. **Web Interface**: Shows live progress, page thumbnails, and preview

## UI Features

### Progress Section
- Live progress bar
- Current/total page count
- Processing status
- Chapter information

### Page List
- Thumbnail previews
- Page numbers
- Chapter indicators
- Click to navigate

### Preview Area
- Full page preview
- Zoom controls (25%-200%)
- Keyboard navigation
- Download button

## Keyboard Shortcuts

- **Arrow Left**: Previous page
- **Arrow Right**: Next page
- **+/=**: Zoom in
- **-**: Zoom out

## Configuration

### Environment Variables

```bash
# Preview server port
PREVIEW_PORT=3001

# Authentication token
PREVIEW_TOKEN=your-secure-token
```

### Options

```javascript
{
    enablePreview: true,      // Enable/disable preview
    previewPort: 3001,       // Server port
    verbose: false,          // Detailed logging
    preset: 'main',          // PDF preset
    outputPath: null         // Custom output path
}
```

## Security

The preview system includes:
- Token-based authentication for WebSocket connections
- Secure file serving with path validation
- Automatic cleanup of preview files

## Performance

- Screenshots are captured asynchronously
- WebSocket updates are throttled to prevent overload
- Preview images are optimized PNG format
- Server cleanup removes old preview files

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3001

# Kill the process
kill <PID>
```

### Preview Not Loading

1. Check browser console for errors
2. Verify WebSocket connection
3. Ensure authentication token matches
4. Check server logs

### Slow Performance

- Reduce page count for testing
- Use `--no-preview` for production builds
- Check system resources

## Integration

The preview system integrates with:
- Pipeline monitor for build status
- MCP tools for browser automation
- QA system for visual verification

## API Endpoints

- `GET /` - Preview UI
- `GET /api/status` - Current build status
- `GET /api/preview/:page` - Page image
- `GET /preview/current.pdf` - Final PDF
- `WS /ws/preview` - WebSocket connection

## WebSocket Messages

### Client → Server
```javascript
{ type: 'ping' }
{ type: 'get_preview', page: 1 }
{ type: 'get_pdf' }
```

### Server → Client
```javascript
{ type: 'build_start', data: {...} }
{ type: 'progress', data: {...} }
{ type: 'page_ready', data: {...} }
{ type: 'build_complete', data: {...} }
```

## Development

To modify the preview system:

1. Edit UI: `preview-ui.html`
2. Update client: `preview-client.js`
3. Modify server: `preview-server.js`
4. Enhance generator: `pdf-preview-generator.js`

Test changes:
```bash
node preview-system/test-preview.js
```