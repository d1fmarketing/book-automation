#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const { exec } = require('child_process');
const path = require('path');

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = 10; // questions per hour
const RATE_PERIOD = 3600000; // 1 hour in ms

// Create HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Chat WebSocket Server is running');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Check rate limit for client
function checkRateLimit(clientId) {
  const now = Date.now();
  let clientData = rateLimits.get(clientId);
  
  if (!clientData || now - clientData.resetTime > RATE_PERIOD) {
    clientData = {
      count: 0,
      resetTime: now + RATE_PERIOD
    };
    rateLimits.set(clientId, clientData);
  }
  
  if (clientData.count >= RATE_LIMIT) {
    const remainingTime = Math.ceil((clientData.resetTime - now) / 60000);
    return {
      allowed: false,
      message: `Rate limit reached. Try again in ${remainingTime} minutes.`,
      remaining: 0
    };
  }
  
  clientData.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT - clientData.count
  };
}

// Call Claude CLI agent
async function callClaudeAgent(question, context) {
  return new Promise((resolve, reject) => {
    // Build agent command
    const agentPrompt = `
You are an AI assistant helping a reader understand an ebook.
Context: ${context.title || 'this ebook'}
Current chapter: ${context.chapter || 'unknown'}

Answer this question concisely and helpfully: ${question}
    `.trim();
    
    // Use agentcli if available, otherwise fallback
    const command = `echo '${agentPrompt.replace(/'/g, "'\\''")}' | claude --no-color --max-tokens 150`;
    
    exec(command, { 
      maxBuffer: 1024 * 1024,
      timeout: 30000 
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('Claude CLI error:', error);
        // Fallback response
        resolve({
          success: false,
          response: "I'm having trouble connecting right now. Please try again later or continue reading the ebook for more information.",
          error: error.message
        });
        return;
      }
      
      resolve({
        success: true,
        response: stdout.trim()
      });
    });
  });
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = req.socket.remoteAddress;
  console.log(`New client connected: ${clientId}`);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to AI Assistant',
    rateLimit: RATE_LIMIT
  }));
  
  // Handle messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'question') {
        // Check rate limit
        const rateCheck = checkRateLimit(clientId);
        
        if (!rateCheck.allowed) {
          ws.send(JSON.stringify({
            type: 'error',
            message: rateCheck.message,
            remaining: 0
          }));
          return;
        }
        
        // Send thinking status
        ws.send(JSON.stringify({
          type: 'status',
          message: 'Thinking...',
          remaining: rateCheck.remaining
        }));
        
        // Call Claude agent
        const result = await callClaudeAgent(
          message.question,
          message.context || {}
        );
        
        // Send response
        ws.send(JSON.stringify({
          type: 'answer',
          response: result.response,
          success: result.success,
          remaining: rateCheck.remaining
        }));
      }
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process your request'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId}`);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });
});

// Start server
const PORT = process.env.CHAT_WS_PORT || 3001;
server.listen(PORT, () => {
  console.log(`🤖 Chat WebSocket Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  wss.clients.forEach((client) => {
    client.close();
  });
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Clean up old rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [clientId, data] of rateLimits.entries()) {
    if (now - data.resetTime > RATE_PERIOD * 2) {
      rateLimits.delete(clientId);
    }
  }
}, RATE_PERIOD);