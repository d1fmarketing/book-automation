# WebSocket Authentication for MCP Pipeline Monitor

## Overview

The MCP Pipeline Monitor now includes WebSocket authentication to secure real-time pipeline monitoring. When authentication is enabled, all clients must provide a valid token to receive pipeline updates.

## Configuration

### Enable Authentication

Set the `MCP_MONITOR_TOKEN` environment variable when starting the monitor:

```bash
MCP_MONITOR_TOKEN=your-secret-token node .claude/scripts/mcp-pipeline-monitor.js
```

### Disable Authentication

Simply start the monitor without the token:

```bash
node .claude/scripts/mcp-pipeline-monitor.js
```

## Authentication Methods

### 1. URL Query Parameter (Recommended for Browser)

Include the token in the WebSocket URL:

```javascript
const ws = new WebSocket('ws://localhost:8765?token=your-secret-token');
```

### 2. Authentication Message

Send an authentication message after connecting:

```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'auth',
        token: 'your-secret-token'
    }));
});
```

### 3. Authorization Header (Not supported by browser WebSocket API)

For non-browser clients that support custom headers:

```javascript
const ws = new WebSocket('ws://localhost:8765', [], {
    headers: {
        'Authorization': 'Bearer your-secret-token'
    }
});
```

## Security Features

1. **Token Validation**: Invalid tokens result in immediate connection closure
2. **Rate Limiting**: 100 requests per minute per IP address
3. **Authentication Timeout**: Clients have 5 seconds to authenticate
4. **Secure Broadcasting**: Only authenticated clients receive pipeline updates

## Testing

Run the authentication test suite:

```bash
.claude/scripts/test-monitor-auth.sh
```

This will:
1. Start the monitor with authentication enabled
2. Test various authentication scenarios
3. Verify security controls are working

## Dashboard Access

The web dashboard automatically prompts for the token if required. The token is stored in localStorage for convenience.

## Troubleshooting

### Connection Rejected

If you see "Unauthorized" errors:
- Verify the token is correct
- Check the MCP_MONITOR_TOKEN environment variable
- Ensure the token doesn't contain special characters that need URL encoding

### Rate Limiting

If connections are rejected due to rate limiting:
- Wait 1 minute for the rate limit to reset
- Check for connection loops in your client code
- Consider increasing the rate limit in the monitor code

## Security Recommendations

1. Use strong, random tokens (minimum 32 characters)
2. Rotate tokens regularly
3. Never commit tokens to version control
4. Use HTTPS/WSS in production environments
5. Monitor logs for unauthorized access attempts
EOF < /dev/null