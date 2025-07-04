// Control Panel Main JavaScript
class ControlPanel {
    constructor() {
        this.activeTab = 'overview';
        this.wsConnection = null;
        this.config = {};
        this.stats = {
            successCount: 0,
            failedCount: 0,
            avgTime: 0,
            apiCost: 0
        };
        this.logs = [];
        this.init();
    }

    init() {
        this.initWebSocket();
        this.initEventListeners();
        this.loadConfiguration();
        this.updateStats();
        this.startPolling();
    }

    initWebSocket() {
        const wsUrl = 'ws://localhost:3005/ws';
        
        try {
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('WebSocket connected');
                this.updateConnectionStatus('online');
            };
            
            this.wsConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus('error');
            };
            
            this.wsConnection.onclose = () => {
                console.log('WebSocket disconnected');
                this.updateConnectionStatus('offline');
                // Attempt reconnection after 5 seconds
                setTimeout(() => this.initWebSocket(), 5000);
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

    initEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tab);
            });
        });

        // Log level filter
        const logLevel = document.getElementById('log-level');
        if (logLevel) {
            logLevel.addEventListener('change', () => this.filterLogs());
        }

        // Log search
        const logSearch = document.getElementById('log-search');
        if (logSearch) {
            logSearch.addEventListener('input', () => this.filterLogs());
        }

        // Schedule type change
        const scheduleType = document.getElementById('schedule-type');
        if (scheduleType) {
            scheduleType.addEventListener('change', () => this.updateScheduleUI());
        }
    }

    switchTab(tab) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tab}-tab`);
        });

        this.activeTab = tab;

        // Load tab-specific data
        if (tab === 'monitor') {
            this.initPerformanceChart();
        } else if (tab === 'queue') {
            this.refreshQueue();
        }
    }

    handleWebSocketMessage(data) {
        const { type, payload } = data;

        switch (type) {
            case 'pipeline-status':
                this.updatePipelineStatus(payload);
                break;
            case 'phase-update':
                this.updatePhaseStatus(payload);
                break;
            case 'job-progress':
                this.updateJobProgress(payload);
                break;
            case 'stats-update':
                this.updateStats(payload);
                break;
            case 'log-entry':
                this.addLogEntry(payload);
                break;
            case 'api-usage':
                this.updateAPIUsage(payload);
                break;
        }
    }

    updatePipelineStatus(status) {
        const statusDot = document.getElementById('pipeline-status');
        const statusText = document.getElementById('pipeline-status-text');

        if (statusDot && statusText) {
            statusDot.className = `status-dot ${status.state}`;
            statusText.textContent = status.message;
        }
    }

    updatePhaseStatus(data) {
        const phaseElement = document.getElementById(`phase-${data.phase}`);
        if (phaseElement) {
            const statusElement = phaseElement.querySelector('.phase-status');
            if (statusElement) {
                statusElement.textContent = data.status;
                statusElement.className = `phase-status ${data.status.toLowerCase()}`;
            }
        }
    }

    updateStats(data) {
        if (data) {
            this.stats = { ...this.stats, ...data };
        }

        document.getElementById('success-count').textContent = this.stats.successCount;
        document.getElementById('failed-count').textContent = this.stats.failedCount;
        document.getElementById('avg-time').textContent = `${this.stats.avgTime}m`;
        document.getElementById('api-cost').textContent = `$${this.stats.apiCost.toFixed(2)}`;
    }

    loadConfiguration() {
        // Load saved configuration from localStorage or server
        const savedConfig = localStorage.getItem('pipeline-config');
        if (savedConfig) {
            this.config = JSON.parse(savedConfig);
            this.applyConfiguration();
        }
    }

    applyConfiguration() {
        // Apply loaded configuration to form fields
        Object.keys(this.config).forEach(key => {
            const element = document.querySelector(`[name="${key}"]`);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = this.config[key];
                } else {
                    element.value = this.config[key];
                }
            }
        });
    }

    saveConfiguration() {
        // Gather all configuration values
        const config = {};
        
        // Get all form inputs
        document.querySelectorAll('#config-tab input, #config-tab select').forEach(element => {
            const name = element.name || element.id;
            if (name) {
                if (element.type === 'checkbox') {
                    config[name] = element.checked;
                } else {
                    config[name] = element.value;
                }
            }
        });

        this.config = config;
        localStorage.setItem('pipeline-config', JSON.stringify(config));

        // Send to server
        this.sendWebSocketMessage('save-config', config);

        // Show success notification
        this.showNotification('Configuration saved successfully', 'success');
    }

    // Job Queue Management
    refreshQueue() {
        // Fetch queue data from server
        fetch('/api/queue')
            .then(res => res.json())
            .then(data => {
                this.renderQueue(data.jobs);
            })
            .catch(error => {
                console.error('Failed to fetch queue:', error);
            });
    }

    renderQueue(jobs) {
        const tbody = document.getElementById('queue-tbody');
        if (!tbody) return;

        tbody.innerHTML = jobs.map(job => `
            <tr>
                <td>${job.id}</td>
                <td>${job.topic}</td>
                <td><span class="status-badge ${job.status}">${job.status}</span></td>
                <td>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${job.progress}%"></div>
                    </div>
                </td>
                <td>${new Date(job.started).toLocaleTimeString()}</td>
                <td>${job.duration || '-'}</td>
                <td>
                    <button class="mini-btn" onclick="controlPanel.viewJobDetails('${job.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="mini-btn" onclick="controlPanel.cancelJob('${job.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    addToQueue() {
        // Show modal for adding new job
        this.showModal('add-job-modal');
    }

    // Performance Monitoring
    initPerformanceChart() {
        const canvas = document.getElementById('performance-chart');
        if (!canvas || this.performanceChart) return;

        const ctx = canvas.getContext('2d');
        this.performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Pipeline Duration (minutes)',
                    data: [],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                }, {
                    label: 'API Cost ($)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    yAxisID: 'cost'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#a3a3a3'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: '#333333'
                        },
                        ticks: {
                            color: '#a3a3a3'
                        }
                    },
                    y: {
                        grid: {
                            color: '#333333'
                        },
                        ticks: {
                            color: '#a3a3a3'
                        }
                    },
                    cost: {
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#a3a3a3'
                        }
                    }
                }
            }
        });

        // Load initial data
        this.loadPerformanceData();
    }

    loadPerformanceData() {
        // Fetch performance data from server
        fetch('/api/performance')
            .then(res => res.json())
            .then(data => {
                if (this.performanceChart) {
                    this.performanceChart.data.labels = data.labels;
                    this.performanceChart.data.datasets[0].data = data.durations;
                    this.performanceChart.data.datasets[1].data = data.costs;
                    this.performanceChart.update();
                }
            })
            .catch(error => {
                console.error('Failed to load performance data:', error);
            });
    }

    // Logging
    addLogEntry(entry) {
        this.logs.unshift(entry);
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }

        if (this.activeTab === 'logs') {
            this.renderLogEntry(entry);
        }
    }

    renderLogEntry(entry) {
        const viewer = document.getElementById('log-viewer');
        if (!viewer) return;

        const div = document.createElement('div');
        div.className = `log-entry ${entry.level}`;
        div.innerHTML = `
            <span class="log-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span class="log-level">[${entry.level.toUpperCase()}]</span>
            <span class="log-message">${entry.message}</span>
        `;

        viewer.insertBefore(div, viewer.firstChild);

        // Keep only last 500 entries in DOM
        while (viewer.children.length > 500) {
            viewer.removeChild(viewer.lastChild);
        }
    }

    filterLogs() {
        const level = document.getElementById('log-level').value;
        const search = document.getElementById('log-search').value.toLowerCase();

        const filtered = this.logs.filter(log => {
            const matchesLevel = level === 'all' || 
                (level === 'error' && log.level === 'error') ||
                (level === 'warning' && ['warning', 'error'].includes(log.level)) ||
                (level === 'info' && ['info', 'warning', 'error'].includes(log.level));

            const matchesSearch = !search || 
                log.message.toLowerCase().includes(search);

            return matchesLevel && matchesSearch;
        });

        // Re-render filtered logs
        const viewer = document.getElementById('log-viewer');
        viewer.innerHTML = '';
        filtered.slice(0, 500).forEach(log => this.renderLogEntry(log));
    }

    clearLogs() {
        if (confirm('Are you sure you want to clear all logs?')) {
            this.logs = [];
            document.getElementById('log-viewer').innerHTML = '';
        }
    }

    exportLogs() {
        const blob = new Blob([JSON.stringify(this.logs, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pipeline-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Utility Methods
    sendWebSocketMessage(type, payload) {
        if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
            this.wsConnection.send(JSON.stringify({ type, payload }));
        }
    }

    updateConnectionStatus(status) {
        const indicator = document.querySelector('.api-item:last-child .api-indicator');
        if (indicator) {
            indicator.className = `api-indicator ${status === 'online' ? 'online' : 'offline'}`;
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 
                             type === 'error' ? 'exclamation-circle' : 
                             'info-circle'}"></i>
            <span>${message}</span>
        `;

        // Add to DOM
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    startPolling() {
        // Poll for updates every 10 seconds
        setInterval(() => {
            if (this.activeTab === 'overview') {
                this.updateStats();
            } else if (this.activeTab === 'queue') {
                this.refreshQueue();
            } else if (this.activeTab === 'monitor') {
                this.loadPerformanceData();
            }
        }, 10000);
    }

    startMonitoring() {
        console.log('Control Panel monitoring started');
        this.updateStats();
    }
}

// Global functions for button handlers
window.startFullPipeline = async () => {
    if (confirm('Start full pipeline run?')) {
        try {
            const response = await fetch('/api/pipeline/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'full' })
            });
            
            if (response.ok) {
                controlPanel.showNotification('Pipeline started successfully', 'success');
            } else {
                throw new Error('Failed to start pipeline');
            }
        } catch (error) {
            controlPanel.showNotification('Failed to start pipeline', 'error');
            console.error(error);
        }
    }
};

window.emergencyStop = async () => {
    if (confirm('Emergency stop all running processes?')) {
        try {
            const response = await fetch('/api/pipeline/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emergency: true })
            });
            
            if (response.ok) {
                controlPanel.showNotification('Emergency stop executed', 'warning');
            }
        } catch (error) {
            console.error('Emergency stop failed:', error);
        }
    }
};

window.runPhase = async (phase) => {
    try {
        const response = await fetch(`/api/pipeline/phase/${phase}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            controlPanel.showNotification(`${phase} phase started`, 'success');
        }
    } catch (error) {
        controlPanel.showNotification(`Failed to start ${phase}`, 'error');
    }
};

window.configurePhase = (phase) => {
    controlPanel.switchTab('config');
    // Scroll to specific phase configuration
    const phaseConfig = document.querySelector(`[data-phase="${phase}"]`);
    if (phaseConfig) {
        phaseConfig.scrollIntoView({ behavior: 'smooth' });
    }
};

window.saveConfiguration = () => {
    controlPanel.saveConfiguration();
};

window.exportConfiguration = () => {
    const blob = new Blob([JSON.stringify(controlPanel.config, null, 2)], 
        { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline-config.json';
    a.click();
    URL.revokeObjectURL(url);
};

window.importConfiguration = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const config = JSON.parse(event.target.result);
                    controlPanel.config = config;
                    controlPanel.applyConfiguration();
                    controlPanel.showNotification('Configuration imported', 'success');
                } catch (error) {
                    controlPanel.showNotification('Invalid configuration file', 'error');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
};

// Modal functions
window.startBatchMode = () => {
    document.getElementById('batch-modal').classList.add('active');
};

window.closeBatchModal = () => {
    document.getElementById('batch-modal').classList.remove('active');
};

window.scheduleRun = () => {
    document.getElementById('schedule-modal').classList.add('active');
};

window.closeScheduleModal = () => {
    document.getElementById('schedule-modal').classList.remove('active');
};

window.showAPISettings = () => {
    document.getElementById('api-modal').classList.add('active');
};

window.closeAPIModal = () => {
    document.getElementById('api-modal').classList.remove('active');
};

window.clearLogs = () => {
    controlPanel.clearLogs();
};

window.exportLogs = () => {
    controlPanel.exportLogs();
};