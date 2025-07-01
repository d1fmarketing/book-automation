#!/usr/bin/env node

/**
 * MCP Pipeline Monitor Integration
 * Real-time pipeline monitoring for MCP dashboard
 */

const fs = require('fs').promises;
const path = require('path');
const WebSocket = require('ws');
const PipelineStateManager = require('./pipeline-state-manager');
const PipelineLogger = require('./pipeline-logger');
const StatusDashboard = require('./status-dashboard');

class MCPPipelineMonitor {
    constructor() {
        this.wsPort = process.env.MCP_WS_PORT || 8765;
        this.authToken = process.env.MCP_MONITOR_TOKEN || null;
        this.wss = null;
        this.stateManager = new PipelineStateManager();
        this.logger = new PipelineLogger();
        this.dashboard = new StatusDashboard();
        this.updateInterval = null;
        this.clients = new Set();
        this.rateLimiter = new Map(); // IP -> { count, resetTime }
    }

    /**
     * Initialize monitor
     */
    async init() {
        await this.stateManager.init();
        await this.logger.init();
        await this.dashboard.init();
        
        // Create WebSocket server for real-time updates
        this.wss = new WebSocket.Server({ port: this.wsPort });
        
        this.wss.on('connection', (ws, req) => {
            // Get client IP for rate limiting
            const clientIp = req.socket.remoteAddress;
            
            // Check rate limit
            if (!this.checkRateLimit(clientIp)) {
                ws.close(1008, 'Rate limit exceeded');
                return;
            }
            
            // Handle authentication
            if (this.authToken) {
                // Check URL query parameter first
                const url = new URL(req.url, `http://${req.headers.host}`);
                const urlToken = url.searchParams.get('token');
                
                // Check Authorization header as fallback
                const authHeader = req.headers.authorization;
                const headerToken = authHeader?.replace('Bearer ', '');
                
                // Store auth state
                ws.authenticated = false;
                ws.pendingAuth = true;
                
                // If token provided in URL, validate immediately
                if (urlToken) {
                    if (urlToken === this.authToken) {
                        ws.authenticated = true;
                        ws.pendingAuth = false;
                    } else {
                        console.warn(`Invalid token in URL from ${clientIp}`);
                        ws.close(1008, 'Unauthorized');
                        return;
                    }
                } else if (headerToken) {
                    if (headerToken === this.authToken) {
                        ws.authenticated = true;
                        ws.pendingAuth = false;
                    } else {
                        console.warn(`Invalid token in header from ${clientIp}`);
                        ws.close(1008, 'Unauthorized');
                        return;
                    }
                } else {
                    // Wait for auth message
                    console.log(`Waiting for authentication from ${clientIp}`);
                }
            } else {
                // No auth required
                ws.authenticated = true;
                ws.pendingAuth = false;
            }
            
            console.log(`New MCP dashboard connected from ${clientIp}`);
            this.clients.add(ws);
            ws.clientIp = clientIp;
            
            // Only send initial state if authenticated
            if (ws.authenticated) {
                this.sendUpdate(ws, 'full');
            }
            
            ws.on('message', (message) => {
                this.handleMessage(ws, message);
            });
            
            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`MCP dashboard disconnected from ${clientIp}`);
            });
            
            // Set auth timeout
            if (ws.pendingAuth) {
                setTimeout(() => {
                    if (ws.pendingAuth && !ws.authenticated) {
                        console.warn(`Authentication timeout for ${clientIp}`);
                        ws.close(1008, 'Unauthorized');
                    }
                }, 5000); // 5 second timeout
            }
        });
        
        console.log(`MCP Pipeline Monitor listening on ws://localhost:${this.wsPort}`);
        if (this.authToken) {
            console.log('Authentication required. Token: MCP_MONITOR_TOKEN environment variable');
        }
        
        // Clean up rate limiter periodically
        setInterval(() => this.cleanupRateLimiter(), 60000); // Every minute
    }

    /**
     * Start monitoring
     */
    startMonitoring(intervalMs = 1000) {
        // Monitor for state changes
        this.updateInterval = setInterval(async () => {
            await this.checkForUpdates();
        }, intervalMs);
        
        // Subscribe to logger events
        this.subscribeToEvents();
    }

    /**
     * Check for updates and broadcast
     */
    async checkForUpdates() {
        const currentState = await this.getMonitoringData();
        
        // Broadcast to authenticated clients only
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.authenticated) {
                this.sendUpdate(client, 'incremental', currentState);
            }
        }
    }

    /**
     * Get current monitoring data
     */
    async getMonitoringData() {
        const state = this.stateManager.state;
        const status = this.stateManager.getStatus();
        const logStats = await this.logger.getStats({ includePhases: true });
        const recentLogs = await this.logger.search('', { limit: 5 });
        
        return {
            timestamp: new Date().toISOString(),
            session: {
                id: state.session_id,
                progress: status.progress,
                current_phase: state.current_phase
            },
            phases: this.getPhaseSummary(state, this.stateManager.rules),
            metrics: {
                total_time: state.metrics.total_time,
                phase_times: state.metrics.phase_times,
                log_counts: logStats.current_session.metrics.by_level
            },
            recent_logs: recentLogs.map(log => ({
                timestamp: log.timestamp,
                level: log.level,
                phase: log.phase,
                message: log.message
            })),
            issues: await this.detectIssues(state),
            resources: {
                checkpoints: state.checkpoints?.length || 0,
                log_size_mb: logStats.total_size_mb || 0
            }
        };
    }

    /**
     * Get phase summary for dashboard
     */
    getPhaseSummary(state, rules) {
        const summary = {};
        
        for (const phaseName of rules.rules.execution_order) {
            const phase = state.phases[phaseName];
            const phaseRules = rules.phases[phaseName];
            
            summary[phaseName] = {
                status: phase?.status || 'pending',
                optional: phaseRules.optional || false,
                duration: phase?.duration || null,
                attempts: phase?.attempts || 0,
                errors: phase?.errors?.length || 0
            };
            
            // Add progress for active phase
            if (phase?.status === 'in_progress' && phase.start_time) {
                summary[phaseName].elapsed = Date.now() - new Date(phase.start_time).getTime();
            }
        }
        
        return summary;
    }

    /**
     * Detect issues for monitoring
     */
    async detectIssues(state) {
        const issues = [];
        
        // Long-running phase
        if (state.current_phase) {
            const phase = state.phases[state.current_phase];
            const runtime = Date.now() - new Date(phase.start_time).getTime();
            
            if (runtime > 30 * 60 * 1000) { // 30 minutes
                issues.push({
                    type: 'long_running',
                    severity: 'warning',
                    phase: state.current_phase,
                    message: `Phase running for ${Math.floor(runtime / 60000)} minutes`
                });
            }
        }
        
        // Failed phases
        for (const [phaseName, phase] of Object.entries(state.phases)) {
            if (phase.status === 'failed') {
                issues.push({
                    type: 'phase_failed',
                    severity: 'error',
                    phase: phaseName,
                    message: phase.errors[phase.errors.length - 1]?.message || 'Unknown error'
                });
            }
        }
        
        // High error rate
        const errorCount = this.logger.currentSession.metrics.by_level.error || 0;
        const totalLogs = this.logger.currentSession.metrics.total_logs;
        
        if (totalLogs > 50 && errorCount / totalLogs > 0.1) {
            issues.push({
                type: 'high_error_rate',
                severity: 'warning',
                message: `${Math.round(errorCount / totalLogs * 100)}% error rate`
            });
        }
        
        return issues;
    }

    /**
     * Subscribe to real-time events
     */
    subscribeToEvents() {
        // Monitor file changes
        const stateFile = path.join(process.cwd(), 'pipeline-state.json');
        
        try {
            fs.watch(stateFile, async (eventType) => {
                if (eventType === 'change') {
                    await this.stateManager.loadOrCreateState();
                    this.broadcastEvent('state_changed');
                }
            });
        } catch (error) {
            // File doesn't exist yet
        }
        
        // Monitor log file
        const logFile = this.logger.logFile;
        
        try {
            fs.watch(logFile, (eventType) => {
                if (eventType === 'change') {
                    this.broadcastEvent('new_logs');
                }
            });
        } catch (error) {
            // File doesn't exist yet
        }
    }

    /**
     * Send update to client
     */
    async sendUpdate(client, type = 'incremental', data = null) {
        if (client.readyState !== WebSocket.OPEN) return;
        
        // Only send to authenticated clients
        if (!client.authenticated) return;
        
        try {
            const message = {
                type: type === 'full' ? 'full_update' : 'update',
                data: data || await this.getMonitoringData()
            };
            
            client.send(JSON.stringify(message));
        } catch (error) {
            console.error('Error sending update:', error.message);
        }
    }

    /**
     * Broadcast event to all clients
     */
    broadcastEvent(eventType, data = {}) {
        const message = {
            type: 'event',
            event: eventType,
            timestamp: new Date().toISOString(),
            data
        };
        
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN && client.authenticated) {
                client.send(JSON.stringify(message));
            }
        }
    }

    /**
     * Handle incoming messages from dashboard
     */
    async handleMessage(ws, message) {
        try {
            const msg = JSON.parse(message);
            
            // Handle authentication first
            if (msg.type === 'auth' && ws.pendingAuth) {
                if (msg.token === this.authToken) {
                    ws.authenticated = true;
                    ws.pendingAuth = false;
                    console.log(`Client ${ws.clientIp} authenticated successfully`);
                    
                    // Send initial state after successful auth
                    this.sendUpdate(ws, 'full');
                    
                    // Send auth success
                    ws.send(JSON.stringify({ type: 'auth_success' }));
                } else {
                    console.warn(`Invalid auth token from ${ws.clientIp}`);
                    ws.close(1008, 'Unauthorized');
                }
                return;
            }
            
            // Require authentication for all other messages
            if (!ws.authenticated) {
                ws.close(1008, 'Unauthorized');
                return;
            }
            
            switch (msg.type) {
                case 'command':
                    await this.handleCommand(ws, msg.command, msg.args);
                    break;
                    
                case 'subscribe':
                    // Client wants specific updates
                    ws.subscriptions = msg.channels || ['all'];
                    break;
                    
                case 'ping':
                    // Only respond to authenticated clients
                    if (ws.authenticated) {
                        ws.send(JSON.stringify({ type: 'pong' }));
                    }
                    break;
            }
        } catch (error) {
            console.error('Invalid message:', error);
        }
    }

    /**
     * Handle commands from dashboard
     */
    async handleCommand(ws, command, args = {}) {
        try {
            let result;
            
            switch (command) {
                case 'start_phase':
                    await this.stateManager.startPhase(args.phase);
                    result = { success: true, message: `Started phase: ${args.phase}` };
                    break;
                    
                case 'create_checkpoint':
                    const checkpointId = await this.stateManager.createCheckpoint(args.label);
                    result = { success: true, checkpoint_id: checkpointId };
                    break;
                    
                case 'get_logs':
                    const logs = await this.logger.search(args.query || '', args.options || {});
                    result = { success: true, logs };
                    break;
                    
                case 'pause_pipeline':
                    // Implement pause logic
                    result = { success: true, message: 'Pipeline paused' };
                    break;
                    
                default:
                    result = { success: false, error: `Unknown command: ${command}` };
            }
            
            ws.send(JSON.stringify({
                type: 'command_response',
                command,
                result
            }));
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'command_response',
                command,
                result: { success: false, error: error.message }
            }));
        }
    }

    /**
     * Create MCP dashboard HTML
     */
    async createDashboardHTML() {
        const wsProtocol = this.authToken ? 'auth' : 'open';
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pipeline Monitor - MCP Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            padding: 20px;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #333;
        }
        h1 { font-size: 28px; font-weight: 600; }
        .status-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }
        .status-connected { background: #065f46; color: #6ee7b7; }
        .status-disconnected { background: #7f1d1d; color: #fca5a5; }
        
        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            padding: 20px;
        }
        .card h2 { 
            font-size: 18px; 
            margin-bottom: 15px;
            color: #60a5fa;
        }
        
        .progress-bar {
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #60a5fa);
            transition: width 0.3s ease;
        }
        
        .phase-grid {
            display: grid;
            gap: 10px;
        }
        .phase-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #262626;
            border-radius: 6px;
            border: 1px solid #404040;
        }
        .phase-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 10px;
        }
        .status-pending { background: #666; }
        .status-in_progress { background: #3b82f6; animation: pulse 2s infinite; }
        .status-completed { background: #10b981; }
        .status-failed { background: #ef4444; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .log-viewer {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 6px;
            padding: 15px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
            height: 300px;
            overflow-y: auto;
        }
        .log-entry { margin-bottom: 5px; }
        .log-error { color: #ef4444; }
        .log-warn { color: #f59e0b; }
        .log-info { color: #3b82f6; }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .metric-item {
            text-align: center;
            padding: 15px;
            background: #262626;
            border-radius: 6px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: 600;
            color: #60a5fa;
        }
        .metric-label {
            font-size: 14px;
            color: #9ca3af;
            margin-top: 5px;
        }
        
        .issues-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .issue-item {
            padding: 12px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .issue-warning { background: #7c2d12; border: 1px solid #ea580c; }
        .issue-error { background: #7f1d1d; border: 1px solid #dc2626; }
        
        .controls {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }
        button {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        .btn-primary:hover {
            background: #2563eb;
        }
        .btn-secondary {
            background: #404040;
            color: #e0e0e0;
        }
        .btn-secondary:hover {
            background: #525252;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Pipeline Monitor</h1>
            <div id="connection-status" class="status-badge status-disconnected">
                Disconnected
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>Session Info</h2>
                <div id="session-info">
                    <p>Session ID: <span id="session-id">-</span></p>
                    <p>Progress:</p>
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill" style="width: 0%"></div>
                    </div>
                    <p id="progress-text">0%</p>
                    <p>Current Phase: <span id="current-phase">-</span></p>
                </div>
            </div>
            
            <div class="card">
                <h2>Metrics</h2>
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div id="total-time" class="metric-value">0</div>
                        <div class="metric-label">Total Time</div>
                    </div>
                    <div class="metric-item">
                        <div id="checkpoints" class="metric-value">0</div>
                        <div class="metric-label">Checkpoints</div>
                    </div>
                    <div class="metric-item">
                        <div id="error-count" class="metric-value">0</div>
                        <div class="metric-label">Errors</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>Pipeline Phases</h2>
                <div id="phases" class="phase-grid"></div>
            </div>
            
            <div class="card">
                <h2>Issues & Warnings</h2>
                <div id="issues" class="issues-list">
                    <p style="color: #666;">No issues detected</p>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Recent Logs</h2>
            <div id="logs" class="log-viewer"></div>
        </div>
        
        <div class="controls">
            <button class="btn-primary" onclick="createCheckpoint()">
                Create Checkpoint
            </button>
            <button class="btn-secondary" onclick="refreshDashboard()">
                Refresh
            </button>
            <button class="btn-secondary" onclick="toggleAutoRefresh()">
                Auto-refresh: <span id="auto-refresh-status">ON</span>
            </button>
        </div>
    </div>
    
    <script>
        let ws = null;
        let autoRefresh = true;
        let data = {};
        const authRequired = ${this.authToken ? 'true' : 'false'};
        let authToken = null;
        
        if (authRequired) {
            authToken = localStorage.getItem('mcp_monitor_token');
            if (!authToken) {
                authToken = prompt('Enter monitor token:');
                if (authToken) {
                    localStorage.setItem('mcp_monitor_token', authToken);
                }
            }
        }
        
        function connect() {
            const wsUrl = 'ws://localhost:${this.wsPort}' + (authToken ? '?token=' + encodeURIComponent(authToken) : '');
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                document.getElementById('connection-status').textContent = 'Connected';
                document.getElementById('connection-status').className = 'status-badge status-connected';
                
                // Send auth token as first message if required
                if (authRequired && authToken) {
                    ws.send(JSON.stringify({
                        type: 'auth',
                        token: authToken
                    }));
                }
            };
            
            ws.onclose = (event) => {
                document.getElementById('connection-status').textContent = 'Disconnected';
                document.getElementById('connection-status').className = 'status-badge status-disconnected';
                
                // Check if closed due to auth failure
                if (event.code === 1008 && event.reason === 'Unauthorized') {
                    // Clear stored token and prompt again
                    localStorage.removeItem('mcp_monitor_token');
                    authToken = prompt('Authentication failed. Enter monitor token:');
                    if (authToken) {
                        localStorage.setItem('mcp_monitor_token', authToken);
                    }
                }
                
                // Reconnect after 3 seconds
                setTimeout(connect, 3000);
            };
            
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                
                if (msg.type === 'update' || msg.type === 'full_update') {
                    data = msg.data;
                    updateDashboard();
                }
            };
        }
        
        function updateDashboard() {
            // Session info
            document.getElementById('session-id').textContent = data.session?.id || '-';
            document.getElementById('progress-fill').style.width = (data.session?.progress || 0) + '%';
            document.getElementById('progress-text').textContent = (data.session?.progress || 0) + '%';
            document.getElementById('current-phase').textContent = data.session?.current_phase || 'Idle';
            
            // Metrics
            document.getElementById('total-time').textContent = formatDuration(data.metrics?.total_time || 0);
            document.getElementById('checkpoints').textContent = data.resources?.checkpoints || 0;
            document.getElementById('error-count').textContent = data.metrics?.log_counts?.error || 0;
            
            // Phases
            updatePhases(data.phases || {});
            
            // Issues
            updateIssues(data.issues || []);
            
            // Logs
            updateLogs(data.recent_logs || []);
        }
        
        function updatePhases(phases) {
            const container = document.getElementById('phases');
            container.innerHTML = '';
            
            for (const [name, phase] of Object.entries(phases)) {
                const item = document.createElement('div');
                item.className = 'phase-item';
                
                const left = document.createElement('div');
                left.style.display = 'flex';
                left.style.alignItems = 'center';
                
                const status = document.createElement('div');
                status.className = 'phase-status status-' + phase.status;
                
                const label = document.createElement('span');
                label.textContent = name;
                
                left.appendChild(status);
                left.appendChild(label);
                
                const right = document.createElement('div');
                right.style.fontSize = '14px';
                right.style.color = '#9ca3af';
                
                if (phase.duration) {
                    right.textContent = formatDuration(phase.duration);
                } else if (phase.elapsed) {
                    right.textContent = formatDuration(phase.elapsed) + ' ⏱️';
                }
                
                item.appendChild(left);
                item.appendChild(right);
                container.appendChild(item);
            }
        }
        
        function updateIssues(issues) {
            const container = document.getElementById('issues');
            
            if (issues.length === 0) {
                container.innerHTML = '<p style="color: #666;">No issues detected</p>';
                return;
            }
            
            container.innerHTML = '';
            
            for (const issue of issues) {
                const item = document.createElement('div');
                item.className = 'issue-item issue-' + issue.severity;
                item.textContent = issue.message;
                container.appendChild(item);
            }
        }
        
        function updateLogs(logs) {
            const container = document.getElementById('logs');
            container.innerHTML = '';
            
            for (const log of logs) {
                const entry = document.createElement('div');
                entry.className = 'log-entry log-' + log.level;
                
                const time = new Date(log.timestamp).toLocaleTimeString();
                entry.textContent = \`[\${time}] [\${log.level}] [\${log.phase}] \${log.message}\`;
                
                container.appendChild(entry);
            }
            
            container.scrollTop = container.scrollHeight;
        }
        
        function formatDuration(ms) {
            if (ms < 1000) return ms + 'ms';
            if (ms < 60000) return Math.floor(ms / 1000) + 's';
            if (ms < 3600000) return Math.floor(ms / 60000) + 'm';
            return Math.floor(ms / 3600000) + 'h';
        }
        
        function createCheckpoint() {
            const label = prompt('Checkpoint label (optional):');
            ws.send(JSON.stringify({
                type: 'command',
                command: 'create_checkpoint',
                args: { label: label || '' }
            }));
        }
        
        function refreshDashboard() {
            ws.send(JSON.stringify({ type: 'ping' }));
        }
        
        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            document.getElementById('auto-refresh-status').textContent = autoRefresh ? 'ON' : 'OFF';
        }
        
        // Connect on load
        connect();
        
        // Ping every 30 seconds to keep connection alive
        setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    </script>
</body>
</html>`;

        const dashboardPath = path.join(__dirname, '..', 'mcp-pipeline-dashboard.html');
        await fs.writeFile(dashboardPath, html);
        
        return dashboardPath;
    }

    /**
     * Check rate limit for IP
     */
    checkRateLimit(ip) {
        const now = Date.now();
        const limit = 100; // 100 requests per minute
        const window = 60 * 1000; // 1 minute
        
        let record = this.rateLimiter.get(ip);
        
        if (!record || now > record.resetTime) {
            record = { count: 0, resetTime: now + window };
            this.rateLimiter.set(ip, record);
        }
        
        record.count++;
        
        if (record.count > limit) {
            return false;
        }
        
        return true;
    }

    /**
     * Clean up old rate limit records
     */
    cleanupRateLimiter() {
        const now = Date.now();
        for (const [ip, record] of this.rateLimiter.entries()) {
            if (now > record.resetTime) {
                this.rateLimiter.delete(ip);
            }
        }
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        if (this.wss) {
            this.wss.close();
        }
    }
}

// CLI interface
if (require.main === module) {
    const monitor = new MCPPipelineMonitor();
    
    (async () => {
        await monitor.init();
        monitor.startMonitoring();
        
        // Create dashboard HTML
        const dashboardPath = await monitor.createDashboardHTML();
        console.log(`\n📊 Dashboard created at: ${dashboardPath}`);
        console.log('Open in browser to view real-time monitoring\n');
        
        // Keep process running
        process.on('SIGINT', () => {
            console.log('\nShutting down monitor...');
            monitor.stop();
            process.exit(0);
        });
    })().catch(console.error);
}

module.exports = MCPPipelineMonitor;