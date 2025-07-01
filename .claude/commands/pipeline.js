module.exports = {
    name: 'pipeline',
    description: 'Manage book automation pipeline',
    aliases: ['p', 'pipe'],
    
    async execute(args, cli) {
        const subcommand = args[0] || 'status';
        
        // Import required modules
        const path = require('path');
        const PipelineStateManager = require('../scripts/pipeline-state-manager');
        const StatusDashboard = require('../scripts/status-dashboard');
        const PipelineLogger = require('../scripts/pipeline-logger');
        
        const stateManager = new PipelineStateManager();
        const dashboard = new StatusDashboard();
        const logger = new PipelineLogger();
        
        // Initialize managers
        await stateManager.init();
        await dashboard.init();
        await logger.init();
        
        const subcommands = {
            status: this.showStatus,
            start: this.startPhase,
            complete: this.completePhase,
            fail: this.failPhase,
            checkpoint: this.createCheckpoint,
            restore: this.restoreCheckpoint,
            rollback: this.rollback,
            dashboard: this.manageDashboard,
            logs: this.viewLogs,
            clean: this.cleanup
        };
        
        const handler = subcommands[subcommand];
        
        if (!handler) {
            cli.error(`Unknown pipeline subcommand: ${subcommand}`);
            cli.log('\nAvailable subcommands:');
            cli.log('  status      - Show current pipeline status');
            cli.log('  start       - Start a pipeline phase');
            cli.log('  complete    - Complete current phase');
            cli.log('  fail        - Mark phase as failed');
            cli.log('  checkpoint  - Create a checkpoint');
            cli.log('  restore     - Restore from checkpoint');
            cli.log('  rollback    - Interactive rollback');
            cli.log('  dashboard   - Manage status dashboard');
            cli.log('  logs        - View pipeline logs');
            cli.log('  clean       - Clean old data');
            return;
        }
        
        try {
            await handler.call(this, args.slice(1), cli, { stateManager, dashboard, logger });
        } catch (error) {
            cli.error(`Pipeline command failed: ${error.message}`);
            throw error;
        }
    },
    
    async showStatus(args, cli, { stateManager }) {
        const status = stateManager.getStatus();
        
        cli.log('\n📊 Pipeline Status\n');
        cli.log(`Session: ${status.session_id}`);
        cli.log(`Progress: ${status.progress}%`);
        
        if (status.current_phase) {
            cli.log(`\n⚡ Active Phase: ${status.current_phase}`);
            const phase = stateManager.state.phases[status.current_phase];
            const runtime = Date.now() - new Date(phase.start_time).getTime();
            cli.log(`  Runtime: ${formatDuration(runtime)}`);
            cli.log(`  Attempts: ${phase.attempts}`);
        }
        
        cli.log('\n📈 Phase Summary:');
        cli.log(`  ✅ Completed: ${status.completed_phases.join(', ') || 'None'}`);
        cli.log(`  ⏳ Pending: ${status.pending_phases.join(', ') || 'None'}`);
        cli.log(`  ❌ Failed: ${status.failed_phases.join(', ') || 'None'}`);
        
        cli.log('\n💾 Checkpoints: ' + stateManager.state.checkpoints.length);
        
        // Show recent checkpoints
        if (stateManager.state.checkpoints.length > 0) {
            cli.log('\nRecent checkpoints:');
            const recent = stateManager.state.checkpoints.slice(-3).reverse();
            for (const cp of recent) {
                cli.log(`  • ${cp.id} - ${cp.label || 'No label'}`);
            }
        }
        
        cli.log(`\n📝 View full dashboard: claude /pipeline dashboard open`);
    },
    
    async startPhase(args, cli, { stateManager, logger }) {
        const phaseName = args[0];
        
        if (!phaseName) {
            // Show available phases
            const rules = stateManager.rules;
            cli.log('\nAvailable phases:');
            for (const phase of rules.rules.execution_order) {
                const optional = rules.phases[phase].optional ? ' (optional)' : '';
                cli.log(`  • ${phase}${optional}`);
            }
            return;
        }
        
        cli.log(`\n🚀 Starting phase: ${phaseName}`);
        
        try {
            await stateManager.startPhase(phaseName);
            await logger.startPhase(phaseName);
            
            cli.success(`Phase ${phaseName} started successfully`);
            cli.info('Run "claude /pipeline complete" when done');
        } catch (error) {
            cli.error(`Failed to start phase: ${error.message}`);
            
            // Show what's missing
            if (error.message.includes('dependencies')) {
                cli.log('\n' + error.message);
            }
        }
    },
    
    async completePhase(args, cli, { stateManager, logger }) {
        const currentPhase = stateManager.state.current_phase;
        
        if (!currentPhase) {
            cli.error('No phase is currently active');
            return;
        }
        
        cli.log(`\n✅ Completing phase: ${currentPhase}`);
        
        // Parse outputs if provided
        let outputs = {};
        if (args[0]) {
            try {
                outputs = JSON.parse(args.join(' '));
            } catch {
                cli.warn('Could not parse outputs, using defaults');
            }
        }
        
        try {
            await stateManager.completePhase(currentPhase, outputs);
            await logger.completePhase(currentPhase);
            
            cli.success(`Phase ${currentPhase} completed!`);
            
            // Show next phase
            const status = stateManager.getStatus();
            if (status.pending_phases.length > 0) {
                cli.info(`Next phase: ${status.pending_phases[0]}`);
                cli.log('Run "claude /pipeline start <phase>" to continue');
            } else {
                cli.success('🎉 All phases completed!');
            }
        } catch (error) {
            cli.error(`Failed to complete phase: ${error.message}`);
        }
    },
    
    async failPhase(args, cli, { stateManager, logger }) {
        const currentPhase = stateManager.state.current_phase;
        
        if (!currentPhase) {
            cli.error('No phase is currently active');
            return;
        }
        
        const errorMessage = args.join(' ') || 'Unknown error';
        
        cli.log(`\n❌ Marking phase as failed: ${currentPhase}`);
        
        await stateManager.failPhase(currentPhase, new Error(errorMessage));
        await logger.failPhase(currentPhase, new Error(errorMessage));
        
        const phase = stateManager.state.phases[currentPhase];
        const phaseRules = stateManager.rules.phases[currentPhase];
        
        if (phase.status === 'pending_retry') {
            cli.warn(`Phase will be retried (${phase.attempts}/${phaseRules.error_handling?.retry_count || 1})`);
            cli.info('Run "claude /pipeline start" to retry');
        } else {
            cli.error('Phase failed permanently');
        }
    },
    
    async createCheckpoint(args, cli, { stateManager }) {
        const label = args.join(' ') || '';
        
        cli.log('\n💾 Creating checkpoint...');
        
        const checkpointId = await stateManager.createCheckpoint(label);
        
        cli.success(`Checkpoint created: ${checkpointId}`);
        
        if (label) {
            cli.info(`Label: ${label}`);
        }
        
        cli.log(`Total checkpoints: ${stateManager.state.checkpoints.length}`);
    },
    
    async restoreCheckpoint(args, cli, { stateManager }) {
        const checkpointId = args[0];
        
        if (!checkpointId) {
            // List available checkpoints
            cli.log('\n💾 Available checkpoints:\n');
            
            if (stateManager.state.checkpoints.length === 0) {
                cli.info('No checkpoints available');
                return;
            }
            
            for (const cp of stateManager.state.checkpoints.reverse()) {
                cli.log(`ID: ${cp.id}`);
                cli.log(`  Created: ${new Date(cp.created_at).toLocaleString()}`);
                cli.log(`  Label: ${cp.label || 'None'}`);
                cli.log(`  Phase: ${cp.phase || 'N/A'}`);
                cli.log('');
            }
            
            cli.info('Run "claude /pipeline restore <checkpoint-id>" to restore');
            return;
        }
        
        cli.warn(`\n⚠️  Restoring from checkpoint: ${checkpointId}`);
        cli.warn('Current state will be backed up first');
        
        try {
            await stateManager.restoreCheckpoint(checkpointId);
            cli.success('Checkpoint restored successfully!');
            
            // Show current status
            await this.showStatus([], cli, { stateManager });
        } catch (error) {
            cli.error(`Failed to restore: ${error.message}`);
        }
    },
    
    async rollback(args, cli, { stateManager }) {
        cli.log('\n🔄 Interactive Rollback\n');
        
        // Show recent checkpoints
        const checkpoints = stateManager.state.checkpoints.slice(-5).reverse();
        
        if (checkpoints.length === 0) {
            cli.error('No checkpoints available for rollback');
            return;
        }
        
        cli.log('Recent checkpoints:');
        checkpoints.forEach((cp, index) => {
            cli.log(`  ${index + 1}. ${cp.id}`);
            cli.log(`     ${cp.label || 'No description'}`);
            cli.log(`     Created: ${new Date(cp.created_at).toLocaleString()}`);
        });
        
        cli.log('\nTo rollback, run:');
        cli.log('  claude /pipeline restore <checkpoint-id>');
        cli.log('\nTo create a new checkpoint:');
        cli.log('  claude /pipeline checkpoint "description"');
    },
    
    async manageDashboard(args, cli, { dashboard }) {
        const action = args[0] || 'show';
        
        switch (action) {
            case 'show':
            case 'open':
                await dashboard.update();
                cli.success('Dashboard updated');
                cli.log(`Location: ${dashboard.dashboardPath}`);
                
                // Try to open in editor
                if (action === 'open') {
                    const { exec } = require('child_process');
                    exec(`open "${dashboard.dashboardPath}" || code "${dashboard.dashboardPath}"`, (err) => {
                        if (err) {
                            cli.info('Open the file manually at the location above');
                        }
                    });
                }
                break;
                
            case 'watch':
                const interval = parseInt(args[1]) || 5000;
                cli.log(`📊 Starting dashboard auto-update (every ${interval}ms)`);
                dashboard.startAutoUpdate(interval);
                cli.info('Press Ctrl+C to stop');
                
                // Keep process running
                process.on('SIGINT', () => {
                    dashboard.stopAutoUpdate();
                    process.exit(0);
                });
                
                // Prevent exit
                await new Promise(() => {});
                break;
                
            default:
                cli.error(`Unknown dashboard action: ${action}`);
                cli.log('Available: show, open, watch');
        }
    },
    
    async viewLogs(args, cli, { logger }) {
        const action = args[0] || 'tail';
        
        switch (action) {
            case 'tail':
                const lines = parseInt(args[1]) || 20;
                cli.log(`\n📜 Last ${lines} log entries:\n`);
                
                const logs = await logger.search('', { limit: lines });
                for (const log of logs.reverse()) {
                    if (log.raw) {
                        cli.log(log.raw);
                    } else {
                        const time = new Date(log.timestamp).toLocaleTimeString();
                        const level = log.level.toUpperCase().padEnd(5);
                        const phase = log.phase.padEnd(12);
                        cli.log(`[${time}] [${level}] [${phase}] ${log.message}`);
                    }
                }
                break;
                
            case 'search':
                const query = args.slice(1).join(' ');
                if (!query) {
                    cli.error('Usage: logs search <query>');
                    return;
                }
                
                cli.log(`\n🔍 Searching for: "${query}"\n`);
                const results = await logger.search(query, { limit: 50 });
                
                if (results.length === 0) {
                    cli.info('No matches found');
                } else {
                    cli.log(`Found ${results.length} matches:\n`);
                    for (const log of results) {
                        if (log.raw) {
                            cli.log(log.raw);
                        } else {
                            const time = new Date(log.timestamp).toLocaleTimeString();
                            cli.log(`[${time}] [${log.level}] [${log.phase}] ${log.message}`);
                        }
                    }
                }
                break;
                
            case 'stats':
                const stats = await logger.getStats({ includePhases: true });
                
                cli.log('\n📊 Log Statistics:\n');
                cli.log(`Session: ${stats.current_session.id}`);
                cli.log(`Total logs: ${stats.current_session.metrics.total_logs}`);
                cli.log(`Log size: ${stats.total_size_mb.toFixed(2)} MB`);
                
                cli.log('\nBy level:');
                for (const [level, count] of Object.entries(stats.current_session.metrics.by_level)) {
                    cli.log(`  ${level}: ${count}`);
                }
                
                cli.log('\nBy phase:');
                for (const [phase, count] of Object.entries(stats.current_session.metrics.by_phase)) {
                    cli.log(`  ${phase}: ${count}`);
                }
                break;
                
            default:
                cli.error(`Unknown logs action: ${action}`);
                cli.log('Available: tail, search, stats');
        }
    },
    
    async cleanup(args, cli, { stateManager }) {
        const target = args[0] || 'all';
        
        cli.log('\n🧹 Cleanup Options:\n');
        
        switch (target) {
            case 'checkpoints':
                const cpCount = stateManager.state.checkpoints.length;
                cli.log(`Checkpoints: ${cpCount}`);
                
                if (cpCount > 5) {
                    cli.warn(`Will keep only the 5 most recent checkpoints`);
                    cli.info('Run with --force to proceed');
                }
                break;
                
            case 'logs':
                cli.log('Log rotation will be triggered');
                cli.info('Old logs will be archived');
                break;
                
            case 'trash':
                cli.log('Trash items older than 30 days will be removed');
                cli.info('Run "claude /todo add \'Clean trash\'" to schedule');
                break;
                
            case 'all':
                cli.log('Will clean:');
                cli.log('  • Old checkpoints (keep 5)');
                cli.log('  • Rotated logs');
                cli.log('  • Trash items > 30 days');
                cli.warn('\nThis is a dry run. Add --force to execute');
                break;
                
            default:
                cli.error(`Unknown cleanup target: ${target}`);
                cli.log('Available: checkpoints, logs, trash, all');
        }
    }
};

// Helper function
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}