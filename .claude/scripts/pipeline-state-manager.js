#!/usr/bin/env node

/**
 * Enhanced Pipeline State Manager
 * Manages state transitions, validation, and persistence for the book pipeline
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const FileLock = require('./file-lock');
const WorkflowValidator = require('./workflow-validator');

class PipelineStateManager {
    constructor() {
        this.stateFile = path.join(process.cwd(), 'pipeline-state.json');
        this.workflowRulesFile = path.join(__dirname, '..', 'workflow-rules.yaml');
        this.checkpointDir = path.join(__dirname, '..', 'checkpoints');
        this.state = null;
        this.rules = null;
        this.stateLock = new FileLock(this.stateFile);
        this.validator = new WorkflowValidator();
    }

    /**
     * Initialize the state manager
     */
    async init() {
        await this.loadWorkflowRules();
        await this.loadOrCreateState();
        await fs.mkdir(this.checkpointDir, { recursive: true });
        await this.validator.loadRules();
    }

    /**
     * Load workflow rules from YAML
     */
    async loadWorkflowRules() {
        try {
            const rulesContent = await fs.readFile(this.workflowRulesFile, 'utf8');
            this.rules = yaml.load(rulesContent);
        } catch (error) {
            console.error('Failed to load workflow rules:', error);
            throw error;
        }
    }

    /**
     * Load existing state or create new
     */
    async loadOrCreateState() {
        await this.stateLock.withLock(async () => {
            try {
                const stateContent = await fs.readFile(this.stateFile, 'utf8');
                this.state = JSON.parse(stateContent);
                
                // Ensure metrics object exists in loaded state
                if (!this.state.metrics) {
                    this.state.metrics = {
                        total_time: 0,
                        phase_times: {}
                    };
                    // Don't call saveState here to avoid nested locks
                    this.state.updated_at = new Date().toISOString();
                    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
                }
            } catch {
            // Create initial state
            this.state = {
                session_id: this.generateSessionId(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                current_phase: null,
                phases: {},
                context: {
                    book_id: null,
                    metadata_file: 'metadata.yaml',
                    workflow_mode: 'standard'
                },
                checkpoints: [],
                todos: [],
                metrics: {
                    total_time: 0,
                    phase_times: {}
                }
            };
            // Don't call saveState here to avoid nested locks
            await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
        }
        });
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        const date = new Date().toISOString().split('T')[0];
        const rand = crypto.randomBytes(4).toString('hex');
        return `book-${date}-${rand}`;
    }

    /**
     * Save current state to file with lock
     */
    async saveState() {
        await this.stateLock.withLock(async () => {
            this.state.updated_at = new Date().toISOString();
            await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
        });
    }

    /**
     * Start a new phase
     */
    async startPhase(phaseName) {
        // Validate phase exists in rules
        if (!this.rules.phases[phaseName]) {
            throw new Error(`Unknown phase: ${phaseName}`);
        }

        // Use workflow validator for comprehensive validation
        const validationResult = await this.validator.validatePhase(phaseName, this.state);
        
        if (!validationResult.valid) {
            const errorMsg = `Phase validation failed:\n${validationResult.errors.join('\n')}`;
            this.log('error', errorMsg);
            throw new Error(errorMsg);
        }
        
        if (validationResult.skip) {
            this.log('info', `Skipping optional phase: ${phaseName}`);
            return;
        }
        
        if (validationResult.warnings.length > 0) {
            validationResult.warnings.forEach(warn => this.log('warn', warn));
        }

        // Check dependencies (kept for backward compatibility)
        await this.validatePhaseDependencies(phaseName);

        // Create checkpoint if enabled
        if (this.rules.global.auto_checkpoint) {
            await this.createCheckpoint(`before-${phaseName}`);
        }

        // Update state
        this.state.current_phase = phaseName;
        this.state.phases[phaseName] = {
            status: 'in_progress',
            start_time: new Date().toISOString(),
            attempts: (this.state.phases[phaseName]?.attempts || 0) + 1,
            outputs: [],
            errors: [],
            metrics: {}
        };

        await this.saveState();
        this.log('info', `Started phase: ${phaseName}`);
    }

    /**
     * Complete a phase
     */
    async completePhase(phaseName, outputs = {}, metrics = {}) {
        const phase = this.state.phases[phaseName];
        if (!phase || phase.status !== 'in_progress') {
            throw new Error(`Phase ${phaseName} is not in progress`);
        }

        // Use workflow validator for output validation
        const outputValidation = await this.validator.validatePhaseOutputs(phaseName, outputs);
        
        if (!outputValidation.valid) {
            const errorMsg = `Output validation failed:\n${outputValidation.errors.join('\n')}`;
            this.log('error', errorMsg);
            throw new Error(errorMsg);
        }
        
        if (outputValidation.warnings.length > 0) {
            outputValidation.warnings.forEach(warn => this.log('warn', warn));
        }

        // Validate outputs (kept for backward compatibility)
        await this.validatePhaseOutputs(phaseName, outputs);

        // Update phase
        phase.status = 'completed';
        phase.end_time = new Date().toISOString();
        phase.duration = Date.now() - new Date(phase.start_time).getTime();
        phase.outputs = outputs;
        phase.metrics = metrics;
        phase.context_hash = await this.calculateContextHash();

        // Update metrics
        this.state.metrics.phase_times[phaseName] = phase.duration;
        this.state.metrics.total_time += phase.duration;

        // Clear current phase
        this.state.current_phase = null;

        // Run post hooks
        await this.runPostHooks(phaseName);

        await this.saveState();
        this.log('info', `Completed phase: ${phaseName}`);
    }

    /**
     * Fail a phase
     */
    async failPhase(phaseName, error) {
        const phase = this.state.phases[phaseName];
        if (!phase || phase.status !== 'in_progress') {
            throw new Error(`Phase ${phaseName} is not in progress`);
        }

        phase.status = 'failed';
        phase.end_time = new Date().toISOString();
        phase.errors.push({
            timestamp: new Date().toISOString(),
            message: error.message || String(error),
            stack: error.stack
        });

        this.state.current_phase = null;

        // Check retry policy
        const phaseRules = this.rules.phases[phaseName];
        if (phaseRules.error_handling?.retry_count > phase.attempts) {
            phase.status = 'pending_retry';
            this.log('warn', `Phase ${phaseName} failed, will retry (${phase.attempts}/${phaseRules.error_handling.retry_count})`);
        } else {
            this.log('error', `Phase ${phaseName} failed after ${phase.attempts} attempts`);
        }

        await this.saveState();
    }

    /**
     * Validate phase dependencies
     */
    async validatePhaseDependencies(phaseName) {
        const phaseRules = this.rules.phases[phaseName];
        if (!phaseRules.requires) return;

        const errors = [];

        // Check file dependencies
        if (phaseRules.requires.files) {
            for (const file of phaseRules.requires.files) {
                try {
                    await fs.access(file);
                } catch {
                    errors.push(`Missing required file: ${file}`);
                }
            }
        }

        // Check directory dependencies
        if (phaseRules.requires.directories) {
            for (const dir of phaseRules.requires.directories) {
                try {
                    const stats = await fs.stat(dir);
                    if (!stats.isDirectory()) {
                        errors.push(`Not a directory: ${dir}`);
                    }
                } catch {
                    errors.push(`Missing required directory: ${dir}`);
                }
            }
        }

        // Check environment variables
        if (phaseRules.requires.environment) {
            for (const envVar of phaseRules.requires.environment) {
                const vars = envVar.split('|'); // Support OR conditions
                const hasAny = vars.some(v => process.env[v]);
                if (!hasAny) {
                    errors.push(`Missing required environment variable(s): ${envVar}`);
                }
            }
        }

        // Check phase dependencies
        const executionOrder = this.rules.rules.execution_order;
        const currentIndex = executionOrder.indexOf(phaseName);
        
        for (let i = 0; i < currentIndex; i++) {
            const prevPhase = executionOrder[i];
            const prevPhaseRules = this.rules.phases[prevPhase];
            
            // Skip optional phases if not completed
            if (prevPhaseRules.optional) continue;
            
            if (!this.state.phases[prevPhase]?.status === 'completed') {
                errors.push(`Required phase not completed: ${prevPhase}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`Phase dependencies not met:\n${errors.join('\n')}`);
        }
    }

    /**
     * Validate phase outputs
     */
    async validatePhaseOutputs(phaseName, outputs) {
        const phaseRules = this.rules.phases[phaseName];
        if (!phaseRules.produces) return;

        const errors = [];

        // Check required files
        if (phaseRules.produces.files) {
            for (const filePattern of phaseRules.produces.files) {
                const files = outputs.files || [];
                const hasMatch = files.some(f => this.matchesPattern(f, filePattern));
                if (!hasMatch) {
                    errors.push(`Missing required output: ${filePattern}`);
                }
            }
        }

        // Check validation rules
        if (phaseRules.validation) {
            for (const rule of phaseRules.validation) {
                // Parse rule (e.g., "min_words_per_chapter: 500")
                const [key, value] = rule.split(':').map(s => s.trim());
                
                // Apply validation based on rule type
                if (!this.validateRule(key, value, outputs)) {
                    errors.push(`Validation failed: ${rule}`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Phase output validation failed:\n${errors.join('\n')}`);
        }
    }

    /**
     * Create a checkpoint
     */
    async createCheckpoint(label = '') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const checkpointId = `${timestamp}${label ? '-' + label : ''}`;
        const checkpointPath = path.join(this.checkpointDir, checkpointId);

        await fs.mkdir(checkpointPath, { recursive: true });

        // Create checkpoint manifest
        const manifest = {
            id: checkpointId,
            created_at: new Date().toISOString(),
            label,
            phase: this.state.current_phase,
            state_version: this.state.session_id,
            includes: [],
            stats: {}
        };

        // Save current state
        await fs.writeFile(
            path.join(checkpointPath, 'pipeline-state.json'),
            JSON.stringify(this.state, null, 2)
        );

        // Copy included files/directories with rules
        for (const include of this.rules.checkpoints.checkpoint_includes) {
            try {
                const srcPath = path.join(process.cwd(), include);
                const destPath = path.join(checkpointPath, include);
                
                // Apply inclusion rules
                const includeStats = await this._checkpointInclude(srcPath, include, destPath);
                
                if (includeStats) {
                    manifest.includes.push({
                        path: include,
                        type: includeStats.type,
                        files: includeStats.files,
                        size: includeStats.size
                    });
                }
            } catch (error) {
                this.log('warn', `Failed to checkpoint ${include}: ${error.message}`);
            }
        }
        
        // Save checkpoint manifest
        await fs.writeFile(
            path.join(checkpointPath, 'checkpoint-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );

        // Update checkpoint list
        if (!this.state.checkpoints) {
            this.state.checkpoints = [];
        }
        
        this.state.checkpoints.push({
            id: checkpointId,
            created_at: new Date().toISOString(),
            label,
            phase: this.state.current_phase,
            size: await this.getDirectorySize(checkpointPath)
        });

        // Prune old checkpoints
        await this.pruneCheckpoints();

        await this.saveState();
        this.log('info', `Created checkpoint: ${checkpointId}`);
        
        return checkpointId;
    }

    /**
     * Restore from checkpoint
     */
    async restoreCheckpoint(checkpointId, options = {}) {
        const checkpointPath = path.join(this.checkpointDir, checkpointId);
        const {
            components = ['state', 'files', 'logs', 'trash', 'context'],
            dryRun = false,
            conflictResolution = 'backup'
        } = options;
        
        try {
            // Load checkpoint manifest
            const manifest = await this._loadCheckpointManifest(checkpointPath);
            
            if (dryRun) {
                return await this._previewRestore(checkpointId, manifest, components);
            }
            
            // Backup current state first
            if (conflictResolution === 'backup') {
                await this.createCheckpoint('before-restore');
            }

            const restoreReport = {
                checkpoint: checkpointId,
                timestamp: new Date().toISOString(),
                components: components,
                results: {}
            };

            // Restore state if requested
            if (components.includes('state')) {
                const checkpointState = JSON.parse(
                    await fs.readFile(path.join(checkpointPath, 'pipeline-state.json'), 'utf8')
                );
                this.state = checkpointState;
                this.state.restored_from = checkpointId;
                this.state.restored_at = new Date().toISOString();
                await this.saveState();
                restoreReport.results.state = { success: true };
            }

            // Restore other components
            for (const component of manifest.includes) {
                const componentType = this._getComponentType(component.path);
                
                if (!components.includes(componentType)) {
                    continue;
                }
                
                const srcPath = path.join(checkpointPath, component.path);
                const destPath = path.join(process.cwd(), component.path);
                
                try {
                    // Handle conflicts
                    if (conflictResolution === 'backup') {
                        await this.moveToTrash(destPath);
                    } else if (conflictResolution === 'skip') {
                        const exists = await this._pathExists(destPath);
                        if (exists) continue;
                    }
                    
                    // Restore from checkpoint
                    await this._restoreComponent(srcPath, destPath, component);
                    
                    restoreReport.results[component.path] = {
                        success: true,
                        type: componentType,
                        files: component.files
                    };
                } catch (error) {
                    this.log('warn', `Failed to restore ${component.path}: ${error.message}`);
                    restoreReport.results[component.path] = {
                        success: false,
                        error: error.message
                    };
                }
            }
            
            // Save restore report
            const reportPath = path.join(this.checkpointDir, `restore-report-${Date.now()}.json`);
            await fs.writeFile(reportPath, JSON.stringify(restoreReport, null, 2));
            
            this.log('info', `Restored from checkpoint: ${checkpointId}`);
            return restoreReport;
            
        } catch (error) {
            this.log('error', `Failed to restore checkpoint: ${error.message}`);
            throw error;
        }
    }

    /**
     * Run post-hooks for a phase
     */
    async runPostHooks(phaseName) {
        const phaseRules = this.rules.phases[phaseName];
        if (!phaseRules.post_hooks) return;

        for (const hook of phaseRules.post_hooks) {
            try {
                this.log('info', `Running post-hook: ${hook}`);
                // Execute hook (simplified - use proper exec in production)
                const { exec } = require('child_process');
                await new Promise((resolve, reject) => {
                    exec(hook, (error, stdout, stderr) => {
                        if (error) reject(error);
                        else resolve({ stdout, stderr });
                    });
                });
            } catch (error) {
                this.log('warn', `Post-hook failed: ${hook} - ${error.message}`);
            }
        }
    }

    /**
     * Get next available phases
     */
    getNextPhases() {
        return this.validator.getNextPhases(this.state);
    }

    /**
     * Get current status summary
     */
    getStatus() {
        const summary = {
            session_id: this.state.session_id,
            current_phase: this.state.current_phase,
            completed_phases: [],
            pending_phases: [],
            failed_phases: [],
            progress: 0,
            metrics: this.state.metrics
        };

        const executionOrder = this.rules.rules.execution_order;
        let completedCount = 0;

        for (const phaseName of executionOrder) {
            const phase = this.state.phases[phaseName];
            const phaseRules = this.rules.phases[phaseName];
            
            if (phaseRules.optional) continue;
            
            if (phase?.status === 'completed') {
                summary.completed_phases.push(phaseName);
                completedCount++;
            } else if (phase?.status === 'failed') {
                summary.failed_phases.push(phaseName);
            } else {
                summary.pending_phases.push(phaseName);
            }
        }

        const requiredPhases = executionOrder.filter(p => !this.rules.phases[p].optional);
        summary.progress = Math.round((completedCount / requiredPhases.length) * 100);

        return summary;
    }

    /**
     * Move file/directory to trash
     */
    async moveToTrash(sourcePath) {
        const trashDir = path.join(process.cwd(), 'trash');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const basename = path.basename(sourcePath);
        const trashPath = path.join(trashDir, `${basename}-${timestamp}`);

        try {
            await fs.mkdir(path.dirname(trashPath), { recursive: true });
            await fs.rename(sourcePath, trashPath);
            this.log('info', `Moved to trash: ${sourcePath} -> ${trashPath}`);
        } catch (error) {
            this.log('warn', `Failed to trash ${sourcePath}: ${error.message}`);
        }
    }

    /**
     * Helper: Calculate context hash
     */
    async calculateContextHash() {
        const contextFiles = ['context/CONTEXT.md', 'metadata.yaml', 'outline.yaml'];
        const hash = crypto.createHash('sha256');
        
        for (const file of contextFiles) {
            try {
                const content = await fs.readFile(file, 'utf8');
                hash.update(content);
            } catch {
                // File doesn't exist
            }
        }
        
        return hash.digest('hex').substring(0, 8);
    }

    /**
     * Helper: Pattern matching
     */
    matchesPattern(filename, pattern) {
        // Simple glob matching (use minimatch in production)
        const regex = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\{([^}]+)\}/g, '($1)');
        return new RegExp(`^${regex}$`).test(filename);
    }

    /**
     * Helper: Validate rule
     */
    validateRule(key, value, outputs) {
        // Simplified validation - expand based on needs
        switch (key) {
            case 'min_words_per_chapter':
                return outputs.metrics?.min_words >= parseInt(value);
            case 'all_chapters_have_frontmatter':
                return outputs.validation?.has_frontmatter === (value === 'true');
            case 'qa_passed':
                return outputs.status?.qa_passed === (value === 'true');
            default:
                return true;
        }
    }

    /**
     * Helper: Copy directory recursively
     */
    async copyDirectory(src, dest) {
        // Simplified - use fs-extra or similar in production
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Helper: Get directory size (formatted)
     */
    async getDirectorySize(dirPath) {
        try {
            const bytes = await this._getDirectorySize(dirPath);
            return this._formatSize(bytes);
        } catch {
            return '0B';
        }
    }
    
    /**
     * Helper: Format size in bytes to human readable
     */
    _formatSize(bytes) {
        if (!bytes || bytes === 0) return '0B';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
    }

    /**
     * Helper: Smart checkpoint pruning
     */
    async pruneCheckpoints() {
        const policy = this.rules.checkpoints.retention_policy;
        const now = Date.now();
        const maxAge = policy.max_age_days * 24 * 60 * 60 * 1000;
        
        // Separate checkpoints by category
        const phaseCompletions = [];
        const regular = [];
        
        for (const checkpoint of this.state.checkpoints) {
            const age = now - new Date(checkpoint.created_at).getTime();
            
            // Skip if too old (unless it's a phase completion)
            if (age > maxAge && !checkpoint.label?.includes('after-')) {
                continue;
            }
            
            // Categorize
            if (checkpoint.label?.includes('after-') && policy.keep_phase_completions) {
                phaseCompletions.push(checkpoint);
            } else {
                regular.push(checkpoint);
            }
        }
        
        // Keep phase completions + recent regular checkpoints
        const toKeep = [
            ...phaseCompletions,
            ...regular.slice(-Math.max(policy.max_checkpoints - phaseCompletions.length, policy.keep_minimum))
        ];
        
        // Remove old checkpoints
        const toRemove = this.state.checkpoints.filter(
            cp => !toKeep.find(keep => keep.id === cp.id)
        );
        
        for (const checkpoint of toRemove) {
            const checkpointPath = path.join(this.checkpointDir, checkpoint.id);
            await this.moveToTrash(checkpointPath);
        }
        
        this.state.checkpoints = toKeep;
    }

    /**
     * Helper: Checkpoint include with rules
     */
    async _checkpointInclude(srcPath, includePath, destPath) {
        const stats = await fs.stat(srcPath).catch(() => null);
        if (!stats) return null;
        
        const result = {
            type: stats.isDirectory() ? 'directory' : 'file',
            files: 0,
            size: 0
        };
        
        // Apply inclusion rules
        const rules = this.rules.checkpoints.inclusion_rules || {};
        
        if (includePath.includes('logs') && rules.logs) {
            return await this._checkpointLogs(srcPath, destPath, rules.logs, result);
        } else if (includePath.includes('trash') && rules.trash) {
            return await this._checkpointTrash(srcPath, destPath, rules.trash, result);
        } else {
            // Standard copy
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            
            if (stats.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
                result.files = await this._countFiles(srcPath);
                result.size = await this._getDirectorySize(srcPath);
            } else {
                await fs.copyFile(srcPath, destPath);
                result.files = 1;
                result.size = stats.size;
            }
        }
        
        return result;
    }
    
    /**
     * Helper: Checkpoint logs with rules
     */
    async _checkpointLogs(srcPath, destPath, rules, result) {
        await fs.mkdir(destPath, { recursive: true });
        
        const files = await fs.readdir(srcPath, { withFileTypes: true });
        
        for (const file of files) {
            if (!file.isFile()) continue;
            
            const filePath = path.join(srcPath, file.name);
            const stats = await fs.stat(filePath);
            
            // Check size limit
            if (rules.max_file_size_mb && stats.size > rules.max_file_size_mb * 1024 * 1024) {
                this.log('info', `Skipping large log file: ${file.name} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
                continue;
            }
            
            // Check patterns
            const includeMatch = !rules.include_patterns || 
                rules.include_patterns.some(pattern => {
                    // Convert glob pattern to regex
                    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
                    return file.name.match(new RegExp(regex));
                });
            const excludeMatch = rules.exclude_patterns && 
                rules.exclude_patterns.some(pattern => {
                    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
                    return file.name.match(new RegExp(regex));
                });
            
            if (includeMatch && !excludeMatch) {
                await fs.copyFile(filePath, path.join(destPath, file.name));
                result.files++;
                result.size += stats.size;
            }
        }
        
        return result;
    }
    
    /**
     * Helper: Checkpoint trash with rules
     */
    async _checkpointTrash(srcPath, destPath, rules, result) {
        const now = Date.now();
        const maxAge = (rules.max_age_days || 7) * 24 * 60 * 60 * 1000;
        
        await fs.mkdir(destPath, { recursive: true });
        
        // Copy recent trash items
        const items = await this._getTrashItems(srcPath, maxAge);
        
        for (const item of items) {
            const srcItem = path.join(srcPath, item);
            const destItem = path.join(destPath, item);
            
            await fs.mkdir(path.dirname(destItem), { recursive: true });
            
            const stats = await fs.stat(srcItem);
            if (stats.isDirectory()) {
                await this.copyDirectory(srcItem, destItem);
            } else {
                await fs.copyFile(srcItem, destItem);
            }
            
            result.files++;
            result.size += stats.size;
        }
        
        // Compress if requested
        if (rules.compress && result.files > 0) {
            // Would implement compression here
            this.log('info', 'Trash compression not yet implemented');
        }
        
        return result;
    }
    
    /**
     * Helper: Get recent trash items
     */
    async _getTrashItems(trashPath, maxAge) {
        const items = [];
        const now = Date.now();
        
        try {
            const files = await fs.readdir(trashPath);
            
            for (const file of files) {
                const filePath = path.join(trashPath, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() <= maxAge) {
                    items.push(file);
                }
            }
        } catch (error) {
            // Trash directory might not exist
        }
        
        return items;
    }
    
    /**
     * Helper: Load checkpoint manifest
     */
    async _loadCheckpointManifest(checkpointPath) {
        try {
            const manifestPath = path.join(checkpointPath, 'checkpoint-manifest.json');
            return JSON.parse(await fs.readFile(manifestPath, 'utf8'));
        } catch {
            // Old checkpoint without manifest - generate basic one
            return {
                includes: this.rules.checkpoints.checkpoint_includes.map(include => ({
                    path: include,
                    type: 'unknown',
                    files: 0,
                    size: 0
                }))
            };
        }
    }
    
    /**
     * Helper: Preview restore
     */
    async _previewRestore(checkpointId, manifest, components) {
        const preview = {
            checkpoint: checkpointId,
            created_at: manifest.created_at,
            components_to_restore: components,
            changes: []
        };
        
        for (const component of manifest.includes) {
            const componentType = this._getComponentType(component.path);
            
            if (!components.includes(componentType)) {
                continue;
            }
            
            const destPath = path.join(process.cwd(), component.path);
            const exists = await this._pathExists(destPath);
            
            preview.changes.push({
                path: component.path,
                type: componentType,
                action: exists ? 'overwrite' : 'create',
                files: component.files,
                size: component.size
            });
        }
        
        return preview;
    }
    
    /**
     * Helper: Get component type from path
     */
    _getComponentType(componentPath) {
        if (componentPath.includes('chapters') || componentPath.includes('assets')) {
            return 'files';
        } else if (componentPath.includes('logs')) {
            return 'logs';
        } else if (componentPath.includes('trash')) {
            return 'trash';
        } else if (componentPath.includes('context')) {
            return 'context';
        } else if (componentPath.includes('state')) {
            return 'state';
        }
        return 'other';
    }
    
    /**
     * Helper: Restore component
     */
    async _restoreComponent(srcPath, destPath, component) {
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        
        const stats = await fs.stat(srcPath);
        if (stats.isDirectory()) {
            await this.copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
    
    /**
     * Helper: Check if path exists
     */
    async _pathExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Helper: Count files in directory
     */
    async _countFiles(dirPath) {
        let count = 0;
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const file of files) {
            if (file.isDirectory()) {
                count += await this._countFiles(path.join(dirPath, file.name));
            } else {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * Helper: Get real directory size
     */
    async _getDirectorySize(dirPath) {
        let size = 0;
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            const stats = await fs.stat(filePath);
            
            if (file.isDirectory()) {
                size += await this._getDirectorySize(filePath);
            } else {
                size += stats.size;
            }
        }
        
        return size;
    }
    
    /**
     * Log message
     */
    log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage);
        
        // Also append to log file
        const logFile = path.join(process.cwd(), '.claude', 'logs', 'pipeline.log');
        fs.appendFile(logFile, logMessage + '\n').catch(() => {});
    }
}

// CLI interface
if (require.main === module) {
    const manager = new PipelineStateManager();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        await manager.init();

        switch (command) {
            case 'start':
                await manager.startPhase(args[0]);
                break;
                
            case 'complete':
                await manager.completePhase(args[0], JSON.parse(args[1] || '{}'));
                break;
                
            case 'fail':
                await manager.failPhase(args[0], new Error(args[1] || 'Unknown error'));
                break;
                
            case 'status':
                const status = manager.getStatus();
                const nextPhases = manager.getNextPhases();
                console.log(JSON.stringify({ ...status, next_phases: nextPhases }, null, 2));
                break;
                
            case 'checkpoint':
                const checkpointId = await manager.createCheckpoint(args[0]);
                console.log(`Created checkpoint: ${checkpointId}`);
                break;
                
            case 'restore':
                if (!args[0]) {
                    console.error('Please specify checkpoint ID');
                    process.exit(1);
                }
                
                // Parse options
                const restoreOptions = {};
                if (args.includes('--dry-run')) {
                    restoreOptions.dryRun = true;
                }
                if (args.includes('--state-only')) {
                    restoreOptions.components = ['state'];
                } else if (args.includes('--files-only')) {
                    restoreOptions.components = ['files', 'context'];
                } else if (args.includes('--logs-only')) {
                    restoreOptions.components = ['logs'];
                }
                
                const result = await manager.restoreCheckpoint(args[0], restoreOptions);
                
                if (restoreOptions.dryRun) {
                    console.log('\n=== Restore Preview ===');
                    console.log(JSON.stringify(result, null, 2));
                } else {
                    console.log('\n✅ Restore completed');
                    console.log(`Report saved to: ${result.checkpoint}`);
                }
                break;
                
            case 'validate':
                if (!args[0]) {
                    console.error('Please specify a phase to validate');
                    process.exit(1);
                }
                const valResult = await manager.validator.validatePhase(args[0], manager.state);
                
                if (valResult.valid) {
                    console.log(`✅ Phase '${args[0]}' can be executed`);
                } else {
                    console.log(`❌ Phase '${args[0]}' cannot be executed:`);
                    valResult.errors.forEach(err => console.log(`  • ${err}`));
                }
                
                if (valResult.warnings.length > 0) {
                    console.log('\n⚠️  Warnings:');
                    valResult.warnings.forEach(warn => console.log(`  • ${warn}`));
                }
                break;
                
            case 'checkpoint-info':
                if (!args[0]) {
                    console.error('Please specify checkpoint ID');
                    process.exit(1);
                }
                
                const checkpointPath = path.join(manager.checkpointDir, args[0]);
                try {
                    const manifest = await manager._loadCheckpointManifest(checkpointPath);
                    const stateFile = path.join(checkpointPath, 'pipeline-state.json');
                    const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
                    
                    console.log('\n=== Checkpoint Information ===');
                    console.log(`ID: ${args[0]}`);
                    console.log(`Created: ${manifest.created_at || state.created_at}`);
                    console.log(`Label: ${manifest.label || 'none'}`);
                    console.log(`Phase: ${manifest.phase || state.current_phase || 'none'}`);
                    console.log(`\nIncludes:`);
                    
                    for (const include of manifest.includes) {
                        console.log(`  • ${include.path}`);
                        const sizeStr = manager._formatSize(include.size);
                    console.log(`    Type: ${include.type}, Files: ${include.files}, Size: ${sizeStr}`);
                    }
                } catch (error) {
                    console.error(`Failed to read checkpoint: ${error.message}`);
                }
                break;
                
            case 'checkpoint-list':
                console.log('\n=== Available Checkpoints ===\n');
                
                if (!manager.state.checkpoints || manager.state.checkpoints.length === 0) {
                    console.log('No checkpoints found');
                } else {
                    for (const cp of manager.state.checkpoints) {
                        const age = Date.now() - new Date(cp.created_at).getTime();
                        const ageStr = age < 3600000 ? `${Math.floor(age / 60000)}m ago` :
                                      age < 86400000 ? `${Math.floor(age / 3600000)}h ago` :
                                      `${Math.floor(age / 86400000)}d ago`;
                        
                        console.log(`${cp.id}`);
                        console.log(`  Created: ${ageStr}`);
                        console.log(`  Label: ${cp.label || 'none'}`);
                        console.log(`  Size: ${cp.size}`);
                        console.log();
                    }
                }
                break;
                
            case 'checkpoint-cleanup':
                console.log('Cleaning up old checkpoints...');
                const beforeCount = manager.state.checkpoints?.length || 0;
                await manager.pruneCheckpoints();
                await manager.saveState();
                const afterCount = manager.state.checkpoints.length;
                const removed = beforeCount - afterCount;
                console.log(`✅ Removed ${removed} old checkpoint(s)`);
                console.log(`   Remaining: ${afterCount}`);
                break;
                
            default:
                console.log(`
Pipeline State Manager

Usage:
  node pipeline-state-manager.js <command> [args]

Commands:
  start <phase>              Start a pipeline phase
  complete <phase> [outputs] Complete a phase with outputs
  fail <phase> [error]       Mark phase as failed
  status                     Show current pipeline status and next phases
  checkpoint [label]         Create a checkpoint
  restore <id> [options]     Restore from checkpoint
    Options:
      --dry-run              Preview changes without restoring
      --state-only           Restore only pipeline state
      --files-only           Restore only files (chapters, assets)
      --logs-only            Restore only log files
  checkpoint-info <id>       Show checkpoint details
  checkpoint-list            List all checkpoints
  checkpoint-cleanup         Remove old checkpoints
  validate <phase>           Validate phase requirements
                `);
        }
    })().catch(console.error);
}

module.exports = PipelineStateManager;