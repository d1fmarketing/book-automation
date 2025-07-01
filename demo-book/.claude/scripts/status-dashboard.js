#!/usr/bin/env node

/**
 * Pipeline Status Dashboard Generator
 * Creates and updates a real-time status dashboard in Markdown
 */

const fs = require('fs').promises;
const path = require('path');
const PipelineStateManager = require('./pipeline-state-manager');
const PipelineLogger = require('./pipeline-logger');
const SafeTrash = require('./safe-trash');

class StatusDashboard {
    constructor() {
        this.dashboardPath = path.join(process.cwd(), '.claude', 'status.md');
        this.stateManager = new PipelineStateManager();
        this.logger = new PipelineLogger();
        this.trash = new SafeTrash();
        this.updateInterval = null;
    }

    /**
     * Initialize dashboard
     */
    async init() {
        await this.stateManager.init();
        await this.logger.init();
        await this.trash.init();
    }

    /**
     * Generate dashboard content
     */
    async generateDashboard() {
        const state = this.stateManager.state;
        const status = this.stateManager.getStatus();
        const logStats = await this.logger.getStats({ includePhases: true });
        const trashStats = await this.trash.getStats();
        const timestamp = new Date().toISOString();

        let content = `# 📊 Pipeline Status Dashboard

> Last updated: ${new Date(timestamp).toLocaleString()}
> Auto-refresh: Enabled

## 🎯 Current Session

- **Session ID**: \`${state.session_id}\`
- **Started**: ${new Date(state.created_at).toLocaleString()}
- **Current Phase**: ${state.current_phase ? `⚡ ${state.current_phase}` : '🟢 Idle'}
- **Overall Progress**: ${this.createProgressBar(status.progress)}

## 📈 Pipeline Progress

`;

        // Phase status table
        content += this.generatePhaseTable(state, this.stateManager.rules);

        // Current activity
        if (state.current_phase) {
            content += `\n## ⚙️ Current Activity\n\n`;
            const phase = state.phases[state.current_phase];
            content += `### Phase: ${state.current_phase}\n\n`;
            content += `- Started: ${new Date(phase.start_time).toLocaleString()}\n`;
            content += `- Duration: ${this.formatDuration(Date.now() - new Date(phase.start_time).getTime())}\n`;
            content += `- Attempts: ${phase.attempts}\n`;
            
            if (phase.metrics && Object.keys(phase.metrics).length > 0) {
                content += `\n**Metrics:**\n`;
                for (const [key, value] of Object.entries(phase.metrics)) {
                    content += `- ${key}: ${value}\n`;
                }
            }
        }

        // Recent activity log
        content += `\n## 📜 Recent Activity\n\n\`\`\`\n`;
        const recentLogs = await this.logger.search('', { limit: 10 });
        for (const log of recentLogs) {
            if (log.raw) {
                content += log.raw + '\n';
            } else {
                const time = new Date(log.timestamp).toLocaleTimeString();
                content += `[${time}] [${log.level.toUpperCase()}] [${log.phase}] ${log.message}\n`;
            }
        }
        content += `\`\`\`\n`;

        // Metrics
        content += `\n## 📊 Metrics\n\n`;
        content += `### Performance\n`;
        content += `- Total Time: ${this.formatDuration(state.metrics?.total_time || 0)}\n`;
        content += `- Active Phase Time: ${state.current_phase && state.phases[state.current_phase]?.start_time ? this.formatDuration(Date.now() - new Date(state.phases[state.current_phase].start_time).getTime()) : 'N/A'}\n`;
        
        if (state.metrics?.phase_times && Object.keys(state.metrics.phase_times).length > 0) {
            content += `\n### Phase Timings\n`;
            for (const [phase, time] of Object.entries(state.metrics.phase_times)) {
                content += `- ${phase}: ${this.formatDuration(time)}\n`;
            }
        }

        content += `\n### Log Statistics\n`;
        content += `- Total Logs: ${logStats.current_session.metrics.total_logs}\n`;
        content += `- Log Size: ${logStats.total_size_mb.toFixed(2)} MB\n`;
        
        if (Object.keys(logStats.current_session.metrics.by_level).length > 0) {
            content += `\n**By Level:**\n`;
            for (const [level, count] of Object.entries(logStats.current_session.metrics.by_level)) {
                const emoji = this.getLevelEmoji(level);
                content += `- ${emoji} ${level}: ${count}\n`;
            }
        }

        // Issues and warnings
        content += `\n## ⚠️ Issues & Warnings\n\n`;
        const issues = await this.findIssues(state);
        if (issues.length === 0) {
            content += `✅ No issues detected\n`;
        } else {
            for (const issue of issues) {
                content += `- ${issue.emoji} **${issue.type}**: ${issue.message}\n`;
            }
        }

        // Checkpoints
        content += `\n## 💾 Checkpoints\n\n`;
        if (state.checkpoints.length === 0) {
            content += `No checkpoints created yet.\n`;
        } else {
            content += `| Checkpoint | Created | Label | Size |\n`;
            content += `|------------|---------|-------|------|\n`;
            
            const recentCheckpoints = state.checkpoints.slice(-5).reverse();
            for (const checkpoint of recentCheckpoints) {
                const created = new Date(checkpoint.created_at).toLocaleString();
                content += `| \`${checkpoint.id}\` | ${created} | ${checkpoint.label || 'N/A'} | ${checkpoint.size} |\n`;
            }
            
            if (state.checkpoints.length > 5) {
                content += `\n*Showing 5 most recent checkpoints out of ${state.checkpoints.length} total*\n`;
            }
        }

        // System resources
        content += `\n## 💻 System Resources\n\n`;
        content += `- Trash Items: ${trashStats.total_items} (${trashStats.total_size_mb} MB)\n`;
        content += `- Checkpoints: ${state.checkpoints.length}\n`;
        content += `- Log Files: ${logStats.log_files.length}\n`;

        // Quick actions
        content += `\n## 🚀 Quick Actions\n\n`;
        content += `\`\`\`bash\n`;
        content += `# Resume current pipeline\n`;
        content += `node .claude/scripts/pipeline-state-manager.js status\n\n`;
        content += `# Create checkpoint\n`;
        content += `node .claude/scripts/pipeline-state-manager.js checkpoint "manual backup"\n\n`;
        content += `# View recent logs\n`;
        content += `node .claude/scripts/pipeline-logger.js tail 50\n\n`;
        content += `# Clean trash\n`;
        content += `node .claude/scripts/safe-trash.js clean --dry-run\n`;
        content += `\`\`\`\n`;

        // Footer
        content += `\n---\n\n`;
        content += `*Generated by Claude Elite Pipeline Monitor*\n`;
        content += `*Session: ${state.session_id}*\n`;

        return content;
    }

    /**
     * Generate phase status table
     */
    generatePhaseTable(state, rules) {
        let table = `| Phase | Status | Duration | Attempts | Actions |\n`;
        table += `|-------|--------|----------|----------|---------|\n`;

        const executionOrder = rules.rules.execution_order;
        
        for (const phaseName of executionOrder) {
            const phase = state.phases[phaseName];
            const phaseRules = rules.phases[phaseName];
            
            let status = '⏳ Pending';
            let duration = '-';
            let attempts = '0';
            let actions = '';

            if (phase) {
                // Status
                if (phase.status === 'completed') {
                    status = '✅ Completed';
                } else if (phase.status === 'failed') {
                    status = '❌ Failed';
                } else if (phase.status === 'in_progress') {
                    status = '🔄 In Progress';
                } else if (phase.status === 'pending_retry') {
                    status = '🔁 Pending Retry';
                }

                // Duration
                if (phase.duration) {
                    duration = this.formatDuration(phase.duration);
                } else if (phase.start_time && phase.status === 'in_progress') {
                    duration = this.formatDuration(Date.now() - new Date(phase.start_time).getTime()) + ' ⏱️';
                }

                // Attempts
                attempts = phase.attempts?.toString() || '1';

                // Actions
                if (phase.status === 'failed' || phase.status === 'pending_retry') {
                    actions = `[Retry](# "Retry ${phaseName}")`;
                } else if (phase.status === 'completed') {
                    actions = `[View](# "View outputs")`;
                }
            } else if (phaseRules.optional) {
                status = '⏩ Optional';
            }

            table += `| ${phaseName} | ${status} | ${duration} | ${attempts} | ${actions} |\n`;
        }

        return table;
    }

    /**
     * Find issues in current state
     */
    async findIssues(state) {
        const issues = [];

        // Check for failed phases
        for (const [phaseName, phase] of Object.entries(state.phases)) {
            if (phase.status === 'failed') {
                issues.push({
                    type: 'Phase Failed',
                    message: `${phaseName} failed after ${phase.attempts} attempts`,
                    emoji: '❌'
                });
            }
        }

        // Check for long-running phases
        if (state.current_phase) {
            const phase = state.phases[state.current_phase];
            const runtime = Date.now() - new Date(phase.start_time).getTime();
            
            if (runtime > 30 * 60 * 1000) { // 30 minutes
                issues.push({
                    type: 'Long Running',
                    message: `${state.current_phase} has been running for ${this.formatDuration(runtime)}`,
                    emoji: '⏰'
                });
            }
        }

        // Check for high error rate
        const errorCount = this.logger.currentSession.metrics.by_level.error || 0;
        const totalLogs = this.logger.currentSession.metrics.total_logs;
        
        if (totalLogs > 100 && errorCount / totalLogs > 0.1) {
            issues.push({
                type: 'High Error Rate',
                message: `${Math.round(errorCount / totalLogs * 100)}% of logs are errors`,
                emoji: '🚨'
            });
        }

        // Check disk space (simplified)
        const trashSize = parseFloat(await this.trash.getStats().total_size_mb);
        if (trashSize > 1000) { // 1GB
            issues.push({
                type: 'Disk Usage',
                message: `Trash folder is using ${trashSize.toFixed(0)} MB`,
                emoji: '💾'
            });
        }

        return issues;
    }

    /**
     * Create progress bar
     */
    createProgressBar(percentage) {
        const filled = Math.round(percentage / 5);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        return `${bar} ${percentage}%`;
    }

    /**
     * Format duration
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
    }

    /**
     * Get emoji for log level
     */
    getLevelEmoji(level) {
        const emojis = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🐛',
            trace: '🔍'
        };
        return emojis[level] || '•';
    }

    /**
     * Update dashboard
     */
    async update() {
        try {
            const content = await this.generateDashboard();
            await fs.writeFile(this.dashboardPath, content);
            console.log(`✅ Dashboard updated: ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            console.error(`❌ Failed to update dashboard: ${error.message}`);
        }
    }

    /**
     * Start auto-update
     */
    startAutoUpdate(intervalMs = 5000) {
        this.update(); // Initial update
        
        this.updateInterval = setInterval(() => {
            this.update();
        }, intervalMs);

        console.log(`📊 Dashboard auto-update started (every ${intervalMs / 1000}s)`);
        console.log(`📍 Dashboard location: ${this.dashboardPath}`);
    }

    /**
     * Stop auto-update
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('⏹️ Dashboard auto-update stopped');
        }
    }
}

// CLI interface
if (require.main === module) {
    const dashboard = new StatusDashboard();
    const command = process.argv[2];

    (async () => {
        await dashboard.init();

        switch (command) {
            case 'generate':
                await dashboard.update();
                console.log(`✅ Dashboard generated at: ${dashboard.dashboardPath}`);
                break;

            case 'watch':
                const interval = parseInt(process.argv[3]) || 5000;
                dashboard.startAutoUpdate(interval);
                
                // Keep process running
                process.on('SIGINT', () => {
                    dashboard.stopAutoUpdate();
                    process.exit(0);
                });
                break;

            case 'open':
                // Try to open in default editor
                const { exec } = require('child_process');
                exec(`open "${dashboard.dashboardPath}" || xdg-open "${dashboard.dashboardPath}" || start "${dashboard.dashboardPath}"`, (err) => {
                    if (err) {
                        console.log(`Dashboard location: ${dashboard.dashboardPath}`);
                    }
                });
                break;

            default:
                console.log(`
Pipeline Status Dashboard

Usage:
  node status-dashboard.js <command> [args]

Commands:
  generate          Generate dashboard once
  watch [interval]  Auto-update dashboard (default: 5000ms)
  open              Open dashboard in editor

Examples:
  node status-dashboard.js generate
  node status-dashboard.js watch 3000
  node status-dashboard.js open

The dashboard is saved at: ${dashboard.dashboardPath}
                `);
        }
    })().catch(console.error);
}

module.exports = StatusDashboard;