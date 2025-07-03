#!/usr/bin/env node

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Store connected clients
const clients = new Set();

// Dashboard state
let dashboardState = {
  stats: {
    totalEbooks: 24,
    monthlyRevenue: 1248,
    apiQuota: 78,
    perplexityUsed: 450,
    perplexityTotal: 500,
    systemStatus: 'online'
  },
  pipeline: {
    currentStep: 2, // 0-based index
    steps: [
      { name: 'scan', status: 'completed' },
      { name: 'research', status: 'completed' },
      { name: 'generate', status: 'active' },
      { name: 'qa', status: 'pending' },
      { name: 'publish', status: 'pending' }
    ]
  },
  recentEbooks: [
    { id: 1, title: 'AI Prompts for Business', date: '2025-01-03', revenue: 124 },
    { id: 2, title: 'Passive Income Guide', date: '2025-01-02', revenue: 89 },
    { id: 3, title: 'Crypto Trading Basics', date: '2025-01-01', revenue: 156 }
  ]
};

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New dashboard client connected');
  clients.add(ws);
  
  // Send welcome message with current state
  ws.send(JSON.stringify({
    type: 'welcome',
    stats: dashboardState.stats,
    pipeline: dashboardState.pipeline,
    recentEbooks: dashboardState.recentEbooks
  }));
  
  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.action) {
        case 'get-pipeline-status':
          ws.send(JSON.stringify({
            type: 'pipeline-status',
            status: dashboardState.pipeline
          }));
          break;
        
        case 'get-stats':
          ws.send(JSON.stringify({
            type: 'stats-update',
            stats: dashboardState.stats
          }));
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  });
  
  // Remove client on disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Dashboard client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// API Routes

// Scan for trending topics
app.post('/api/scan-topics', async (req, res) => {
  try {
    // Update pipeline status
    dashboardState.pipeline.currentStep = 0;
    dashboardState.pipeline.steps[0].status = 'active';
    broadcast({
      type: 'pipeline-status',
      status: dashboardState.pipeline
    });
    
    // Simulate scanning process
    setTimeout(() => {
      dashboardState.pipeline.steps[0].status = 'completed';
      dashboardState.pipeline.currentStep = 1;
      dashboardState.pipeline.steps[1].status = 'active';
      broadcast({
        type: 'pipeline-status',
        status: dashboardState.pipeline
      });
    }, 3000);
    
    // Return mock topics
    res.json({
      success: true,
      topics: [
        'AI Tools for Small Business',
        'Passive Income Strategies 2025',
        'Cryptocurrency Investment Guide',
        'Remote Work Productivity Hacks',
        'Social Media Marketing Automation'
      ]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate ebook
app.post('/api/generate-ebook', async (req, res) => {
  try {
    const { topic } = req.body;
    
    // Reset pipeline for new generation
    dashboardState.pipeline.currentStep = 0;
    dashboardState.pipeline.steps.forEach((step, index) => {
      step.status = index === 0 ? 'active' : 'pending';
    });
    
    broadcast({
      type: 'pipeline-status',
      status: dashboardState.pipeline
    });
    
    // Simulate pipeline progression
    const pipelineSteps = ['scan', 'research', 'generate', 'qa', 'publish'];
    let currentStep = 0;
    
    const interval = setInterval(() => {
      if (currentStep < pipelineSteps.length) {
        // Complete current step
        dashboardState.pipeline.steps[currentStep].status = 'completed';
        
        // Move to next step
        currentStep++;
        if (currentStep < pipelineSteps.length) {
          dashboardState.pipeline.currentStep = currentStep;
          dashboardState.pipeline.steps[currentStep].status = 'active';
        }
        
        broadcast({
          type: 'pipeline-status',
          status: dashboardState.pipeline
        });
        
        // When generation completes, add new ebook and update stats
        if (currentStep === pipelineSteps.length) {
          const newEbook = {
            id: dashboardState.recentEbooks.length + 1,
            title: topic || 'Auto-Generated Topic',
            date: new Date().toISOString().split('T')[0],
            revenue: Math.floor(Math.random() * 200) + 50
          };
          
          dashboardState.recentEbooks.unshift(newEbook);
          dashboardState.stats.totalEbooks++;
          dashboardState.stats.monthlyRevenue += newEbook.revenue;
          
          broadcast({
            type: 'new-ebook',
            ebook: newEbook
          });
          
          broadcast({
            type: 'stats-update',
            stats: dashboardState.stats
          });
          
          clearInterval(interval);
        }
      }
    }, 5000); // 5 seconds per step
    
    res.json({
      success: true,
      message: 'Ebook generation started',
      topic: topic || 'Auto-selected trending topic'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  res.json(dashboardState.stats);
});

// Get recent ebooks
app.get('/api/ebooks', async (req, res) => {
  try {
    // In production, this would read from database or file system
    res.json(dashboardState.recentEbooks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific ebook
app.get('/api/ebook/:id', async (req, res) => {
  try {
    const ebook = dashboardState.recentEbooks.find(e => e.id === parseInt(req.params.id));
    if (!ebook) {
      return res.status(404).json({ error: 'Ebook not found' });
    }
    res.json(ebook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update API quota (for monitoring)
app.post('/api/update-quota', (req, res) => {
  const { used, total } = req.body;
  
  dashboardState.stats.perplexityUsed = used;
  dashboardState.stats.perplexityTotal = total;
  dashboardState.stats.apiQuota = Math.round((used / total) * 100);
  
  broadcast({
    type: 'stats-update',
    stats: dashboardState.stats
  });
  
  res.json({ success: true });
});

// Simulate periodic updates
setInterval(() => {
  // Simulate revenue changes
  const revenueChange = Math.floor(Math.random() * 50) - 25;
  dashboardState.stats.monthlyRevenue += revenueChange;
  
  // Simulate API usage
  if (Math.random() > 0.7) {
    dashboardState.stats.perplexityUsed = Math.min(
      dashboardState.stats.perplexityUsed + 1,
      dashboardState.stats.perplexityTotal
    );
    dashboardState.stats.apiQuota = Math.round(
      (dashboardState.stats.perplexityUsed / dashboardState.stats.perplexityTotal) * 100
    );
  }
  
  broadcast({
    type: 'stats-update',
    stats: dashboardState.stats
  });
}, 30000); // Every 30 seconds

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.DASHBOARD_PORT || 3002;
server.listen(PORT, () => {
  console.log(`💰 Money Machine Dashboard server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  
  // Close WebSocket connections
  clients.forEach(client => {
    client.close();
  });
  
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});