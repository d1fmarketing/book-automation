#!/usr/bin/env node

/**
 * Centralized Pipeline Logger
 * Structured logging for all pipeline phases with rotation and analysis
 */

const fs = require('fs').promises;
const path = require('path');
const { createWriteStream } = require('fs');

class PipelineLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), '.claude', 'logs');
        this.logFile = path.join(this.logDir, 'pipeline.log');
        this.logStream = null;
        this.config = {
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            logLevel: process.env.LOG_LEVEL || 'info',
            structured: true,
            includeMetadata: true
        };
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        this.currentSession = null;
        this.phaseTimers = new Map();
    }

    /**
     * Initialize logger
     */
    async init() {
        await fs.mkdir(this.logDir, { recursive: true });
        await this.rotateLogsIfNeeded();
        this.createLogStream();
        
        // Load or create session
        await this.initSession();
    }

    /**
     * Initialize or load session
     */
    async initSession() {
        const sessionFile = path.join(this.logDir, 'current-session.json');
        
        try {
            const sessionData = await fs.readFile(sessionFile, 'utf8');
            this.currentSession = JSON.parse(sessionData);
        } catch {
            this.currentSession = {
                id: this.generateSessionId(),
                started_at: new Date().toISOString(),
                phases: {},
                metrics: {
                    total_logs: 0,
                    by_level: {},
                    by_phase: {}
                }
            };
            await this.saveSession();
        }
    }

    /**
     * Save session data
     */
    async saveSession() {
        const sessionFile = path.join(this.logDir, 'current-session.json');
        await fs.writeFile(sessionFile, JSON.stringify(this.currentSession, null, 2));
    }

    /**
     * Generate session ID
     */
    generateSessionId() {
        const date = new Date().toISOString().split('T')[0];
        const rand = Math.random().toString(36).substring(2, 8);
        return `session-${date}-${rand}`;
    }

    /**
     * Create log stream
     */
    createLogStream() {
        this.logStream = createWriteStream(this.logFile, { flags: 'a' });
    }

    /**
     * Log a message
     */
    async log(level, message, metadata = {}) {
        // Check log level
        if (this.levels[level] > this.levels[this.config.logLevel]) {
            return;
        }

        const timestamp = new Date().toISOString();
        const phase = metadata.phase || 'system';
        
        // Create log entry
        const entry = {
            timestamp,
            level,
            phase,
            message,
            session_id: this.currentSession.id
        };

        // Add metadata if enabled
        if (this.config.includeMetadata && Object.keys(metadata).length > 0) {
            entry.metadata = metadata;
        }

        // Add caller information in debug mode
        if (this.config.logLevel === 'debug' || this.config.logLevel === 'trace') {
            const stack = new Error().stack;
            const caller = stack.split('\n')[3]?.trim() || 'unknown';
            entry.caller = caller;
        }

        // Write log
        if (this.config.structured) {
            this.logStream.write(JSON.stringify(entry) + '\n');
        } else {
            const formatted = `[${timestamp}] [${level.toUpperCase()}] [${phase}] ${message}`;
            this.logStream.write(formatted + '\n');
        }

        // Update metrics
        this.updateMetrics(level, phase);

        // Also log to console in development
        if (process.env.NODE_ENV !== 'production') {
            this.consoleLog(level, phase, message);
        }
    }

    /**
     * Console logging with colors
     */
    consoleLog(level, phase, message) {
        const colors = {
            error: '\x1b[31m', // Red
            warn: '\x1b[33m',  // Yellow
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[90m', // Gray
            trace: '\x1b[90m'  // Gray
        };
        const reset = '\x1b[0m';
        
        console.log(`${colors[level]}[${level.toUpperCase()}]${reset} [${phase}] ${message}`);
    }

    /**
     * Update metrics
     */
    updateMetrics(level, phase) {
        this.currentSession.metrics.total_logs++;
        
        // By level
        this.currentSession.metrics.by_level[level] = 
            (this.currentSession.metrics.by_level[level] || 0) + 1;
        
        // By phase
        this.currentSession.metrics.by_phase[phase] = 
            (this.currentSession.metrics.by_phase[phase] || 0) + 1;
        
        // Save periodically
        if (this.currentSession.metrics.total_logs % 100 === 0) {
            this.saveSession().catch(() => {});
        }
    }

    /**
     * Log phase start
     */
    async startPhase(phaseName, metadata = {}) {
        const startTime = Date.now();
        this.phaseTimers.set(phaseName, startTime);
        
        this.currentSession.phases[phaseName] = {
            started_at: new Date().toISOString(),
            status: 'in_progress',
            logs: []
        };
        
        await this.log('info', `Phase started: ${phaseName}`, {
            phase: phaseName,
            event: 'phase_start',
            ...metadata
        });
    }

    /**
     * Log phase completion
     */
    async completePhase(phaseName, metadata = {}) {
        const startTime = this.phaseTimers.get(phaseName);
        const duration = startTime ? Date.now() - startTime : 0;
        
        if (this.currentSession.phases[phaseName]) {
            this.currentSession.phases[phaseName].completed_at = new Date().toISOString();
            this.currentSession.phases[phaseName].status = 'completed';
            this.currentSession.phases[phaseName].duration_ms = duration;
        }
        
        await this.log('info', `Phase completed: ${phaseName} (${duration}ms)`, {
            phase: phaseName,
            event: 'phase_complete',
            duration_ms: duration,
            ...metadata
        });
        
        this.phaseTimers.delete(phaseName);
        await this.saveSession();
    }

    /**
     * Log phase failure
     */
    async failPhase(phaseName, error, metadata = {}) {
        const startTime = this.phaseTimers.get(phaseName);
        const duration = startTime ? Date.now() - startTime : 0;
        
        if (this.currentSession.phases[phaseName]) {
            this.currentSession.phases[phaseName].failed_at = new Date().toISOString();
            this.currentSession.phases[phaseName].status = 'failed';
            this.currentSession.phases[phaseName].duration_ms = duration;
            this.currentSession.phases[phaseName].error = {
                message: error.message || String(error),
                stack: error.stack
            };
        }
        
        await this.log('error', `Phase failed: ${phaseName} - ${error.message}`, {
            phase: phaseName,
            event: 'phase_fail',
            duration_ms: duration,
            error: error.message,
            stack: error.stack,
            ...metadata
        });
        
        this.phaseTimers.delete(phaseName);
        await this.saveSession();
    }

    /**
     * Rotate logs if needed
     */
    async rotateLogsIfNeeded() {
        try {
            const stats = await fs.stat(this.logFile);
            
            if (stats.size > this.config.maxFileSize) {
                await this.rotateLogs();
            }
        } catch {
            // Log file doesn't exist yet
        }
    }

    /**
     * Rotate log files
     */
    async rotateLogs() {
        // Close current stream
        if (this.logStream) {
            this.logStream.end();
        }

        // Rotate files
        for (let i = this.config.maxFiles - 1; i > 0; i--) {
            const oldFile = i === 1 ? this.logFile : `${this.logFile}.${i - 1}`;
            const newFile = `${this.logFile}.${i}`;
            
            try {
                await fs.rename(oldFile, newFile);
            } catch {
                // File doesn't exist
            }
        }

        // Archive session
        await this.archiveSession();
        
        // Create new stream
        this.createLogStream();
    }

    /**
     * Archive current session
     */
    async archiveSession() {
        if (!this.currentSession) return;
        
        const archiveDir = path.join(this.logDir, 'sessions');
        await fs.mkdir(archiveDir, { recursive: true });
        
        const archiveFile = path.join(archiveDir, `${this.currentSession.id}.json`);
        this.currentSession.archived_at = new Date().toISOString();
        
        await fs.writeFile(archiveFile, JSON.stringify(this.currentSession, null, 2));
        
        // Start new session
        this.currentSession = {
            id: this.generateSessionId(),
            started_at: new Date().toISOString(),
            phases: {},
            metrics: {
                total_logs: 0,
                by_level: {},
                by_phase: {}
            }
        };
    }

    /**
     * Search logs
     */
    async search(query, options = {}) {
        const results = [];
        const logFiles = [this.logFile];
        
        // Include rotated files if requested
        if (options.includeRotated) {
            for (let i = 1; i <= this.config.maxFiles; i++) {
                logFiles.push(`${this.logFile}.${i}`);
            }
        }
        
        for (const file of logFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                const lines = content.split('\n');
                
                for (const line of lines) {
                    if (!line) continue;
                    
                    try {
                        const entry = JSON.parse(line);
                        
                        // Search in message and metadata
                        const searchText = JSON.stringify(entry).toLowerCase();
                        if (searchText.includes(query.toLowerCase())) {
                            results.push(entry);
                        }
                    } catch {
                        // Not JSON, search raw line
                        if (line.toLowerCase().includes(query.toLowerCase())) {
                            results.push({ raw: line });
                        }
                    }
                }
            } catch {
                // File doesn't exist
            }
        }
        
        // Apply filters
        if (options.phase) {
            results.filter(r => r.phase === options.phase);
        }
        if (options.level) {
            results.filter(r => r.level === options.level);
        }
        if (options.startTime) {
            results.filter(r => new Date(r.timestamp) >= new Date(options.startTime));
        }
        if (options.endTime) {
            results.filter(r => new Date(r.timestamp) <= new Date(options.endTime));
        }
        
        // Sort by timestamp (newest first)
        results.sort((a, b) => {
            const timeA = a.timestamp || '0';
            const timeB = b.timestamp || '0';
            return timeB.localeCompare(timeA);
        });
        
        // Limit results
        if (options.limit) {
            return results.slice(0, options.limit);
        }
        
        return results;
    }

    /**
     * Get log statistics
     */
    async getStats(options = {}) {
        const stats = {
            current_session: this.currentSession,
            log_files: [],
            total_size_mb: 0,
            total_entries: 0
        };
        
        // Get file stats
        const logFiles = await fs.readdir(this.logDir);
        
        for (const file of logFiles) {
            if (file.startsWith('pipeline.log')) {
                const filePath = path.join(this.logDir, file);
                try {
                    const fileStat = await fs.stat(filePath);
                    stats.log_files.push({
                        name: file,
                        size_mb: (fileStat.size / (1024 * 1024)).toFixed(2),
                        modified: fileStat.mtime
                    });
                    stats.total_size_mb += fileStat.size / (1024 * 1024);
                } catch {
                    // Skip
                }
            }
        }
        
        // Count entries in current log
        try {
            const content = await fs.readFile(this.logFile, 'utf8');
            stats.total_entries = content.split('\n').filter(line => line).length;
        } catch {
            // No logs yet
        }
        
        // Get phase statistics
        if (options.includePhases) {
            stats.phases = {};
            
            for (const [phase, data] of Object.entries(this.currentSession.phases)) {
                stats.phases[phase] = {
                    status: data.status,
                    duration_ms: data.duration_ms,
                    log_count: this.currentSession.metrics.by_phase[phase] || 0
                };
            }
        }
        
        return stats;
    }

    /**
     * Create logger instance for a specific phase
     */
    createPhaseLogger(phaseName) {
        const self = this;
        
        return {
            info: (message, metadata) => self.log('info', message, { phase: phaseName, ...metadata }),
            warn: (message, metadata) => self.log('warn', message, { phase: phaseName, ...metadata }),
            error: (message, metadata) => self.log('error', message, { phase: phaseName, ...metadata }),
            debug: (message, metadata) => self.log('debug', message, { phase: phaseName, ...metadata }),
            trace: (message, metadata) => self.log('trace', message, { phase: phaseName, ...metadata }),
            
            start: (metadata) => self.startPhase(phaseName, metadata),
            complete: (metadata) => self.completePhase(phaseName, metadata),
            fail: (error, metadata) => self.failPhase(phaseName, error, metadata)
        };
    }

    /**
     * Close logger
     */
    async close() {
        await this.saveSession();
        
        if (this.logStream) {
            this.logStream.end();
        }
    }
}

// CLI interface
if (require.main === module) {
    const logger = new PipelineLogger();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        await logger.init();

        switch (command) {
            case 'log':
                const level = args[0] || 'info';
                const message = args[1] || 'Test message';
                const phase = args[2] || 'system';
                await logger.log(level, message, { phase });
                break;

            case 'search':
                const query = args[0];
                if (!query) {
                    console.error('Usage: search <query> [limit]');
                    process.exit(1);
                }
                const results = await logger.search(query, { limit: parseInt(args[1]) || 10 });
                console.log(JSON.stringify(results, null, 2));
                break;

            case 'stats':
                const stats = await logger.getStats({ includePhases: true });
                console.log('\n📊 Pipeline Log Statistics:\n');
                console.log(`Session ID: ${stats.current_session.id}`);
                console.log(`Total Logs: ${stats.current_session.metrics.total_logs}`);
                console.log(`Log Files: ${stats.log_files.length}`);
                console.log(`Total Size: ${stats.total_size_mb.toFixed(2)} MB`);
                
                console.log('\nLogs by Level:');
                for (const [level, count] of Object.entries(stats.current_session.metrics.by_level)) {
                    console.log(`  ${level}: ${count}`);
                }
                
                console.log('\nLogs by Phase:');
                for (const [phase, count] of Object.entries(stats.current_session.metrics.by_phase)) {
                    console.log(`  ${phase}: ${count}`);
                }
                break;

            case 'tail':
                const lines = parseInt(args[0]) || 20;
                const tailCmd = `tail -n ${lines} ${logger.logFile}`;
                const { exec } = require('child_process');
                exec(tailCmd, (err, stdout) => {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log(stdout);
                    }
                });
                break;

            case 'rotate':
                await logger.rotateLogs();
                console.log('✅ Logs rotated');
                break;

            default:
                console.log(`
Pipeline Logger

Usage:
  node pipeline-logger.js <command> [args]

Commands:
  log <level> <message> [phase]   Log a message
  search <query> [limit]          Search logs
  stats                           Show statistics
  tail [lines]                    Show recent logs
  rotate                          Rotate log files

Log Levels:
  error, warn, info, debug, trace

Examples:
  node pipeline-logger.js log info "Starting build" builder
  node pipeline-logger.js search "error"
  node pipeline-logger.js tail 50
                `);
        }

        await logger.close();
    })().catch(console.error);
}

module.exports = PipelineLogger;