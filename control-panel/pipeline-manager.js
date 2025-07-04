// Pipeline Manager - Advanced control logic
class PipelineManager {
    constructor() {
        this.phases = [
            'research', 
            'deep-research', 
            'content', 
            'images', 
            'qa', 
            'publish'
        ];
        this.runningJobs = new Map();
        this.jobQueue = [];
        this.batchMode = false;
        this.schedules = [];
        this.apiKeys = {};
        this.init();
    }

    init() {
        this.loadAPIKeys();
        this.loadSchedules();
        this.initBatchMode();
        this.initScheduler();
    }

    // API Key Management
    loadAPIKeys() {
        const savedKeys = localStorage.getItem('api-keys');
        if (savedKeys) {
            this.apiKeys = JSON.parse(savedKeys);
            this.maskAPIKeys();
        }
    }

    maskAPIKeys() {
        // Apply masked keys to form
        Object.keys(this.apiKeys).forEach(service => {
            const input = document.getElementById(`${service}-key`);
            if (input && this.apiKeys[service]) {
                input.value = this.maskKey(this.apiKeys[service]);
            }
        });
    }

    maskKey(key) {
        if (!key || key.length < 8) return key;
        return key.slice(0, 4) + '...' + key.slice(-4);
    }

    // Batch Mode
    initBatchMode() {
        // Load batch settings
        const batchSettings = localStorage.getItem('batch-settings');
        if (batchSettings) {
            const settings = JSON.parse(batchSettings);
            document.getElementById('batch-count').value = settings.count || 5;
            document.getElementById('batch-parallel').value = settings.parallel || 2;
            document.getElementById('batch-topics').value = settings.topicMode || 'auto';
            document.getElementById('batch-delay').value = settings.delay || 30;
        }
    }

    async startBatch() {
        const count = parseInt(document.getElementById('batch-count').value);
        const parallel = parseInt(document.getElementById('batch-parallel').value);
        const topicMode = document.getElementById('batch-topics').value;
        const delay = parseInt(document.getElementById('batch-delay').value);

        // Save settings
        localStorage.setItem('batch-settings', JSON.stringify({
            count, parallel, topicMode, delay
        }));

        // Close modal
        window.closeBatchModal();

        // Start batch processing
        this.batchMode = true;
        controlPanel.showNotification(`Starting batch mode: ${count} ebooks`, 'info');

        try {
            const response = await fetch('/api/pipeline/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    count,
                    parallel,
                    topicMode,
                    delay
                })
            });

            if (response.ok) {
                const result = await response.json();
                controlPanel.showNotification(`Batch started: ${result.jobIds.length} jobs queued`, 'success');
            }
        } catch (error) {
            controlPanel.showNotification('Failed to start batch', 'error');
            console.error(error);
        }
    }

    // Scheduler
    initScheduler() {
        this.loadSchedules();
        this.startSchedulerPolling();
    }

    loadSchedules() {
        const saved = localStorage.getItem('pipeline-schedules');
        if (saved) {
            this.schedules = JSON.parse(saved);
        }
    }

    updateScheduleUI() {
        const type = document.getElementById('schedule-type').value;
        const optionsDiv = document.getElementById('schedule-options');

        let html = '';
        switch (type) {
            case 'One-time':
                html = `
                    <div class="form-group">
                        <label>Date & Time</label>
                        <input type="datetime-local" id="schedule-datetime">
                    </div>
                `;
                break;
            case 'Daily':
                html = `
                    <div class="form-group">
                        <label>Time</label>
                        <input type="time" id="schedule-time">
                    </div>
                `;
                break;
            case 'Weekly':
                html = `
                    <div class="form-group">
                        <label>Days</label>
                        <div class="checkbox-group">
                            ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => 
                                `<label><input type="checkbox" value="${day}"> ${day}</label>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Time</label>
                        <input type="time" id="schedule-time">
                    </div>
                `;
                break;
            case 'Custom Cron':
                html = `
                    <div class="form-group">
                        <label>Cron Expression</label>
                        <input type="text" id="schedule-cron" placeholder="0 9 * * *">
                        <small>Format: minute hour day month weekday</small>
                    </div>
                `;
                break;
        }

        optionsDiv.innerHTML = html;
    }

    saveSchedule() {
        const type = document.getElementById('schedule-type').value;
        const timezone = document.getElementById('schedule-timezone').value;

        const schedule = {
            id: Date.now(),
            type,
            timezone,
            enabled: true,
            created: new Date().toISOString()
        };

        // Get schedule-specific data
        switch (type) {
            case 'One-time':
                schedule.datetime = document.getElementById('schedule-datetime').value;
                break;
            case 'Daily':
                schedule.time = document.getElementById('schedule-time').value;
                break;
            case 'Weekly':
                schedule.days = Array.from(document.querySelectorAll('#schedule-options input[type="checkbox"]:checked'))
                    .map(cb => cb.value);
                schedule.time = document.getElementById('schedule-time').value;
                break;
            case 'Custom Cron':
                schedule.cron = document.getElementById('schedule-cron').value;
                break;
        }

        this.schedules.push(schedule);
        localStorage.setItem('pipeline-schedules', JSON.stringify(this.schedules));

        // Send to server
        this.sendScheduleToServer(schedule);

        window.closeScheduleModal();
        controlPanel.showNotification('Schedule saved successfully', 'success');
    }

    async sendScheduleToServer(schedule) {
        try {
            const response = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(schedule)
            });

            if (!response.ok) {
                throw new Error('Failed to save schedule');
            }
        } catch (error) {
            console.error('Failed to save schedule:', error);
        }
    }

    startSchedulerPolling() {
        // Check schedules every minute
        setInterval(() => {
            const now = new Date();
            this.schedules.forEach(schedule => {
                if (schedule.enabled && this.shouldRunSchedule(schedule, now)) {
                    this.executeScheduledRun(schedule);
                }
            });
        }, 60000);
    }

    shouldRunSchedule(schedule, now) {
        // Check if schedule should run based on type
        // Implementation depends on schedule type
        return false; // Placeholder
    }

    async executeScheduledRun(schedule) {
        controlPanel.showNotification(`Executing scheduled run: ${schedule.type}`, 'info');
        
        try {
            const response = await fetch('/api/pipeline/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'scheduled',
                    scheduleId: schedule.id
                })
            });

            if (response.ok) {
                controlPanel.showNotification('Scheduled run started', 'success');
            }
        } catch (error) {
            controlPanel.showNotification('Scheduled run failed', 'error');
            console.error(error);
        }
    }

    // API Testing
    async testAPIKeys() {
        const resultsDiv = document.getElementById('api-test-results');
        resultsDiv.classList.add('active');
        resultsDiv.innerHTML = 'Testing API keys...\n\n';

        const keys = {
            openai: document.getElementById('openai-key').value,
            perplexity: document.getElementById('perplexity-key').value,
            ideogram: document.getElementById('ideogram-key').value
        };

        for (const [service, key] of Object.entries(keys)) {
            if (!key || key.includes('...')) continue; // Skip masked keys

            resultsDiv.innerHTML += `Testing ${service}... `;
            
            try {
                const response = await fetch('/api/test-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ service, key })
                });

                const result = await response.json();
                resultsDiv.innerHTML += result.success ? '✅ Valid\n' : `❌ Invalid: ${result.error}\n`;
            } catch (error) {
                resultsDiv.innerHTML += `❌ Error: ${error.message}\n`;
            }
        }

        resultsDiv.innerHTML += '\nTest complete.';
    }

    saveAPIKeys() {
        const keys = {
            openai: document.getElementById('openai-key').value,
            perplexity: document.getElementById('perplexity-key').value,
            ideogram: document.getElementById('ideogram-key').value
        };

        // Only save non-masked keys
        Object.keys(keys).forEach(service => {
            if (keys[service] && !keys[service].includes('...')) {
                this.apiKeys[service] = keys[service];
            }
        });

        localStorage.setItem('api-keys', JSON.stringify(this.apiKeys));

        // Send to server (encrypted)
        this.sendKeysToServer();

        window.closeAPIModal();
        controlPanel.showNotification('API keys saved successfully', 'success');
    }

    async sendKeysToServer() {
        try {
            const response = await fetch('/api/keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keys: this.apiKeys,
                    encrypted: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save keys');
            }
        } catch (error) {
            console.error('Failed to save keys to server:', error);
        }
    }

    // Job Management
    async viewJobDetails(jobId) {
        try {
            const response = await fetch(`/api/jobs/${jobId}`);
            const job = await response.json();

            const modal = document.getElementById('job-modal');
            const details = document.getElementById('job-details');

            details.innerHTML = `
                <div class="job-details">
                    <h3>Job ID: ${job.id}</h3>
                    <div class="job-info">
                        <div class="info-row">
                            <span>Topic:</span>
                            <span>${job.topic}</span>
                        </div>
                        <div class="info-row">
                            <span>Status:</span>
                            <span class="status-badge ${job.status}">${job.status}</span>
                        </div>
                        <div class="info-row">
                            <span>Started:</span>
                            <span>${new Date(job.started).toLocaleString()}</span>
                        </div>
                        <div class="info-row">
                            <span>Duration:</span>
                            <span>${job.duration || 'In progress'}</span>
                        </div>
                    </div>
                    
                    <h4>Phase Progress</h4>
                    <div class="phase-progress">
                        ${this.phases.map(phase => `
                            <div class="phase-row">
                                <span>${phase}</span>
                                <span class="phase-status ${job.phases[phase]?.status || 'pending'}">
                                    ${job.phases[phase]?.status || 'pending'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${job.output ? `
                        <h4>Output</h4>
                        <div class="job-output">
                            <pre>${JSON.stringify(job.output, null, 2)}</pre>
                        </div>
                    ` : ''}
                    
                    ${job.error ? `
                        <h4>Error</h4>
                        <div class="job-error">
                            <pre>${job.error}</pre>
                        </div>
                    ` : ''}
                </div>
            `;

            modal.classList.add('active');
        } catch (error) {
            controlPanel.showNotification('Failed to load job details', 'error');
            console.error(error);
        }
    }

    async cancelJob(jobId) {
        if (!confirm('Cancel this job?')) return;

        try {
            const response = await fetch(`/api/jobs/${jobId}/cancel`, {
                method: 'POST'
            });

            if (response.ok) {
                controlPanel.showNotification('Job cancelled', 'warning');
                controlPanel.refreshQueue();
            }
        } catch (error) {
            controlPanel.showNotification('Failed to cancel job', 'error');
            console.error(error);
        }
    }

    // Queue Management
    async clearQueue() {
        if (!confirm('Clear all pending jobs from queue?')) return;

        try {
            const response = await fetch('/api/queue/clear', {
                method: 'POST'
            });

            if (response.ok) {
                controlPanel.showNotification('Queue cleared', 'warning');
                controlPanel.refreshQueue();
            }
        } catch (error) {
            controlPanel.showNotification('Failed to clear queue', 'error');
            console.error(error);
        }
    }

    async pauseQueue() {
        try {
            const response = await fetch('/api/queue/pause', {
                method: 'POST'
            });

            if (response.ok) {
                controlPanel.showNotification('Queue paused', 'warning');
            }
        } catch (error) {
            controlPanel.showNotification('Failed to pause queue', 'error');
            console.error(error);
        }
    }

    // API Usage Updates
    updateAPIUsage(usage) {
        // Update usage bars
        Object.keys(usage).forEach(service => {
            const item = document.querySelector(`[data-service="${service}"]`);
            if (item) {
                const fill = item.querySelector('.usage-fill');
                const text = item.querySelector('.usage-text');
                
                const percentage = (usage[service].used / usage[service].limit) * 100;
                fill.style.width = `${percentage}%`;
                
                if (percentage > 80) {
                    fill.classList.add('warning');
                }
                
                text.textContent = `${usage[service].used}/${usage[service].limit} calls`;
            }
        });
    }

    // Preset Management
    async showPresets() {
        // Load and show preset configurations
        try {
            const response = await fetch('/api/presets');
            const presets = await response.json();
            
            // Show preset modal (to be implemented)
            console.log('Presets:', presets);
        } catch (error) {
            controlPanel.showNotification('Failed to load presets', 'error');
            console.error(error);
        }
    }

    // History
    async showHistory() {
        // Load and show pipeline run history
        try {
            const response = await fetch('/api/history');
            const history = await response.json();
            
            // Show history modal (to be implemented)
            console.log('History:', history);
        } catch (error) {
            controlPanel.showNotification('Failed to load history', 'error');
            console.error(error);
        }
    }
}

// Additional global functions
window.startBatch = () => {
    pipelineManager.startBatch();
};

window.saveSchedule = () => {
    pipelineManager.saveSchedule();
};

window.updateScheduleUI = () => {
    pipelineManager.updateScheduleUI();
};

window.testAPIKeys = () => {
    pipelineManager.testAPIKeys();
};

window.saveAPIKeys = () => {
    pipelineManager.saveAPIKeys();
};

window.toggleKeyVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
};

window.addToQueue = () => {
    // Implementation for adding new job to queue
    controlPanel.showNotification('Add to queue feature coming soon', 'info');
};

window.clearQueue = () => {
    pipelineManager.clearQueue();
};

window.pauseQueue = () => {
    pipelineManager.pauseQueue();
};

window.showPresets = () => {
    pipelineManager.showPresets();
};

window.showHistory = () => {
    pipelineManager.showHistory();
};

window.closeJobModal = () => {
    document.getElementById('job-modal').classList.remove('active');
};

// Add notification styles if not already present
if (!document.querySelector('style[data-notifications]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notifications', 'true');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 3000;
            transform: translateX(400px);
            transition: transform var(--transition-normal);
            box-shadow: var(--shadow-lg);
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification.success {
            border-color: var(--success);
            color: var(--success);
        }
        
        .notification.error {
            border-color: var(--danger);
            color: var(--danger);
        }
        
        .notification.warning {
            border-color: var(--warning);
            color: var(--warning);
        }
        
        .notification.info {
            border-color: var(--info);
            color: var(--info);
        }
        
        .notification i {
            font-size: 1.25rem;
        }
    `;
    document.head.appendChild(style);
}