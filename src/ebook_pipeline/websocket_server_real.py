#!/usr/bin/env python3
"""
Real WebSocket Server with Dashboard
Provides real-time communication between agents and web dashboard
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime
from typing import Dict, Set, Any, Optional
import os
import sys
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('WebSocketServer')


class RealWebSocketServer:
    """Production WebSocket server for agent communication"""
    
    def __init__(self, host: str = '127.0.0.1', port: int = 8765):
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.agent_states = {
            'content': {'status': 'idle', 'progress': 0},
            'format': {'status': 'idle', 'progress': 0},
            'quality': {'status': 'idle', 'progress': 0},
            'monitor': {'status': 'idle', 'progress': 0},
            'publish': {'status': 'idle', 'progress': 0}
        }
        self.message_history = []
        self.pipeline_state = {
            'status': 'idle',
            'start_time': None,
            'current_stage': None,
            'progress': 0
        }
        
    async def register(self, websocket):
        """Register a new client"""
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
        
        # Send current state to new client
        await websocket.send(json.dumps({
            'type': 'state_sync',
            'data': {
                'agents': self.agent_states,
                'pipeline': self.pipeline_state,
                'history': self.message_history[-50:]  # Last 50 messages
            }
        }))
        
    async def unregister(self, websocket):
        """Unregister a client"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected: {websocket.remote_address}")
        
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if self.clients:
            # Add timestamp
            message['timestamp'] = datetime.now().isoformat()
            
            # Store in history
            self.message_history.append(message)
            if len(self.message_history) > 1000:
                self.message_history = self.message_history[-1000:]
            
            # Send to all clients
            message_json = json.dumps(message)
            await asyncio.gather(
                *[client.send(message_json) for client in self.clients],
                return_exceptions=True
            )
            
    async def handle_client(self, websocket, path):
        """Handle client connection"""
        await self.register(websocket)
        try:
            async for message in websocket:
                data = json.loads(message)
                await self.process_message(websocket, data)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)
            
    async def process_message(self, websocket, data: Dict[str, Any]):
        """Process incoming message from client"""
        msg_type = data.get('type')
        
        if msg_type == 'agent_update':
            # Update agent state
            agent = data.get('agent')
            if agent in self.agent_states:
                self.agent_states[agent].update(data.get('state', {}))
                await self.broadcast({
                    'type': 'agent_status',
                    'agent': agent,
                    'state': self.agent_states[agent]
                })
                
        elif msg_type == 'pipeline_control':
            # Handle pipeline control commands
            command = data.get('command')
            if command == 'start':
                await self.start_pipeline()
            elif command == 'pause':
                await self.pause_pipeline()
            elif command == 'resume':
                await self.resume_pipeline()
            elif command == 'stop':
                await self.stop_pipeline()
                
        elif msg_type == 'get_logs':
            # Send log history
            await websocket.send(json.dumps({
                'type': 'log_history',
                'logs': self.message_history[-100:]
            }))
            
        elif msg_type == 'ping':
            # Respond to ping
            await websocket.send(json.dumps({'type': 'pong'}))
            
    async def start_pipeline(self):
        """Start the pipeline"""
        self.pipeline_state = {
            'status': 'running',
            'start_time': datetime.now().isoformat(),
            'current_stage': 'content',
            'progress': 0
        }
        await self.broadcast({
            'type': 'pipeline_started',
            'pipeline': self.pipeline_state
        })
        logger.info("Pipeline started")
        
    async def pause_pipeline(self):
        """Pause the pipeline"""
        self.pipeline_state['status'] = 'paused'
        await self.broadcast({
            'type': 'pipeline_paused',
            'pipeline': self.pipeline_state
        })
        logger.info("Pipeline paused")
        
    async def resume_pipeline(self):
        """Resume the pipeline"""
        self.pipeline_state['status'] = 'running'
        await self.broadcast({
            'type': 'pipeline_resumed',
            'pipeline': self.pipeline_state
        })
        logger.info("Pipeline resumed")
        
    async def stop_pipeline(self):
        """Stop the pipeline"""
        self.pipeline_state = {
            'status': 'stopped',
            'start_time': None,
            'current_stage': None,
            'progress': 0
        }
        await self.broadcast({
            'type': 'pipeline_stopped',
            'pipeline': self.pipeline_state
        })
        logger.info("Pipeline stopped")
        
    async def update_agent_status(self, agent: str, status: str, data: Optional[Dict] = None):
        """Update agent status (called by agents)"""
        if agent in self.agent_states:
            self.agent_states[agent]['status'] = status
            if data:
                self.agent_states[agent].update(data)
                
            await self.broadcast({
                'type': 'agent_update',
                'agent': agent,
                'status': status,
                'data': data or {}
            })
            
    async def log_message(self, level: str, source: str, message: str):
        """Log a message from an agent"""
        await self.broadcast({
            'type': 'log',
            'level': level,
            'source': source,
            'message': message
        })
        
    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on ws://{self.host}:{self.port}")
        
        # Also serve the dashboard HTML
        await self.create_dashboard_file()
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info(f"WebSocket server running on ws://{self.host}:{self.port}")
            logger.info(f"Dashboard available at: file://{Path.cwd()}/dashboard.html")
            await asyncio.Future()  # Run forever
            
    async def create_dashboard_file(self):
        """Create the dashboard HTML file"""
        dashboard_html = '''<!DOCTYPE html>
<html>
<head>
    <title>Pipeline Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f; 
            color: #e0e0e0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        
        h1 { 
            color: #45B3E7; 
            margin-bottom: 30px;
            text-align: center;
            font-size: 2.5em;
            text-shadow: 0 0 20px rgba(69, 179, 231, 0.5);
        }
        
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .agent-card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 20px;
            transition: all 0.3s ease;
        }
        
        .agent-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(69, 179, 231, 0.3);
        }
        
        .agent-name {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 10px;
            text-transform: capitalize;
        }
        
        .agent-status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        
        .status-idle { background: #666; }
        .status-running { background: #45B3E7; }
        .status-completed { background: #4CAF50; }
        .status-error { background: #f44336; }
        
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #45B3E7, #863DFF);
            transition: width 0.3s ease;
        }
        
        .controls {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-bottom: 30px;
        }
        
        button {
            background: #45B3E7;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 1em;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        button:hover {
            background: #3498db;
            transform: translateY(-1px);
        }
        
        button:disabled {
            background: #666;
            cursor: not-allowed;
        }
        
        .log-container {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 20px;
            height: 400px;
            overflow-y: auto;
        }
        
        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid #222;
            font-family: 'Monaco', 'Consolas', monospace;
            font-size: 0.9em;
        }
        
        .log-info { color: #45B3E7; }
        .log-warning { color: #FFA726; }
        .log-error { color: #EF5350; }
        .log-success { color: #66BB6A; }
        
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        
        .connected { background: #4CAF50; }
        .disconnected { background: #f44336; }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .running { animation: pulse 2s infinite; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Pipeline Dashboard</h1>
        
        <div class="connection-status disconnected" id="connectionStatus">
            Disconnected
        </div>
        
        <div class="controls">
            <button id="startBtn" onclick="startPipeline()">Start Pipeline</button>
            <button id="pauseBtn" onclick="pausePipeline()" disabled>Pause</button>
            <button id="resumeBtn" onclick="resumePipeline()" disabled>Resume</button>
            <button id="stopBtn" onclick="stopPipeline()" disabled>Stop</button>
        </div>
        
        <div class="status-grid" id="agentGrid">
            <!-- Agent cards will be inserted here -->
        </div>
        
        <div class="log-container" id="logContainer">
            <!-- Log entries will be inserted here -->
        </div>
    </div>
    
    <script>
        let ws = null;
        let agents = {};
        let pipelineState = {};
        
        function connect() {
            ws = new WebSocket('ws://127.0.0.1:8765');
            
            ws.onopen = () => {
                console.log('Connected to WebSocket server');
                updateConnectionStatus(true);
            };
            
            ws.onclose = () => {
                console.log('Disconnected from WebSocket server');
                updateConnectionStatus(false);
                setTimeout(connect, 2000); // Reconnect
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleMessage(data);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        
        function handleMessage(data) {
            switch(data.type) {
                case 'state_sync':
                    agents = data.data.agents;
                    pipelineState = data.data.pipeline;
                    updateAgentGrid();
                    updateControls();
                    break;
                    
                case 'agent_update':
                case 'agent_status':
                    if (data.agent && agents[data.agent]) {
                        Object.assign(agents[data.agent], data.state || {status: data.status});
                        updateAgentCard(data.agent);
                    }
                    break;
                    
                case 'pipeline_started':
                case 'pipeline_paused':
                case 'pipeline_resumed':
                case 'pipeline_stopped':
                    pipelineState = data.pipeline;
                    updateControls();
                    break;
                    
                case 'log':
                    addLogEntry(data);
                    break;
            }
        }
        
        function updateConnectionStatus(connected) {
            const status = document.getElementById('connectionStatus');
            status.textContent = connected ? 'Connected' : 'Disconnected';
            status.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
        }
        
        function updateAgentGrid() {
            const grid = document.getElementById('agentGrid');
            grid.innerHTML = '';
            
            for (const [name, state] of Object.entries(agents)) {
                const card = createAgentCard(name, state);
                grid.appendChild(card);
            }
        }
        
        function createAgentCard(name, state) {
            const card = document.createElement('div');
            card.className = 'agent-card';
            card.innerHTML = `
                <div class="agent-name">${name} Agent</div>
                <span class="agent-status status-${state.status}">${state.status}</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${state.progress || 0}%"></div>
                </div>
            `;
            if (state.status === 'running') {
                card.classList.add('running');
            }
            return card;
        }
        
        function updateAgentCard(name) {
            const grid = document.getElementById('agentGrid');
            const cards = grid.children;
            
            for (let i = 0; i < cards.length; i++) {
                if (cards[i].querySelector('.agent-name').textContent.toLowerCase().includes(name)) {
                    const state = agents[name];
                    cards[i].innerHTML = createAgentCard(name, state).innerHTML;
                    if (state.status === 'running') {
                        cards[i].classList.add('running');
                    } else {
                        cards[i].classList.remove('running');
                    }
                    break;
                }
            }
        }
        
        function updateControls() {
            const startBtn = document.getElementById('startBtn');
            const pauseBtn = document.getElementById('pauseBtn');
            const resumeBtn = document.getElementById('resumeBtn');
            const stopBtn = document.getElementById('stopBtn');
            
            if (pipelineState.status === 'idle' || pipelineState.status === 'stopped') {
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                resumeBtn.disabled = true;
                stopBtn.disabled = true;
            } else if (pipelineState.status === 'running') {
                startBtn.disabled = true;
                pauseBtn.disabled = false;
                resumeBtn.disabled = true;
                stopBtn.disabled = false;
            } else if (pipelineState.status === 'paused') {
                startBtn.disabled = true;
                pauseBtn.disabled = true;
                resumeBtn.disabled = false;
                stopBtn.disabled = false;
            }
        }
        
        function addLogEntry(data) {
            const container = document.getElementById('logContainer');
            const entry = document.createElement('div');
            entry.className = 'log-entry log-' + (data.level || 'info');
            
            const time = new Date(data.timestamp).toLocaleTimeString();
            entry.textContent = `[${time}] [${data.source || 'system'}] ${data.message}`;
            
            container.appendChild(entry);
            container.scrollTop = container.scrollHeight;
            
            // Keep only last 100 entries
            while (container.children.length > 100) {
                container.removeChild(container.firstChild);
            }
        }
        
        function startPipeline() {
            ws.send(JSON.stringify({ type: 'pipeline_control', command: 'start' }));
        }
        
        function pausePipeline() {
            ws.send(JSON.stringify({ type: 'pipeline_control', command: 'pause' }));
        }
        
        function resumePipeline() {
            ws.send(JSON.stringify({ type: 'pipeline_control', command: 'resume' }));
        }
        
        function stopPipeline() {
            ws.send(JSON.stringify({ type: 'pipeline_control', command: 'stop' }));
        }
        
        // Start connection
        connect();
    </script>
</body>
</html>'''
        
        dashboard_path = Path.cwd() / 'dashboard.html'
        with open(dashboard_path, 'w') as f:
            f.write(dashboard_html)
        
        logger.info(f"Dashboard created at: {dashboard_path}")


async def main():
    """Run the WebSocket server"""
    server = RealWebSocketServer()
    
    # Optional: Accept command line arguments
    if len(sys.argv) > 1:
        server.host = sys.argv[1]
    if len(sys.argv) > 2:
        server.port = int(sys.argv[2])
    
    try:
        await server.start_server()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")


if __name__ == "__main__":
    asyncio.run(main())