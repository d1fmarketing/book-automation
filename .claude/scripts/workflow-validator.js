#!/usr/bin/env node

/**
 * Workflow Validator
 * Validates phase requirements and dependencies based on workflow-rules.yaml
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const yaml = require('js-yaml');

const execAsync = promisify(exec);

class WorkflowValidator {
    constructor(rulesFile = '.claude/workflow-rules.yaml') {
        this.rulesFile = path.join(process.cwd(), rulesFile);
        this.rules = null;
        this.validationCache = new Map();
    }

    /**
     * Load workflow rules
     */
    async loadRules() {
        try {
            const rulesContent = await fs.readFile(this.rulesFile, 'utf8');
            this.rules = yaml.load(rulesContent);
        } catch (error) {
            throw new Error(`Failed to load workflow rules: ${error.message}`);
        }
    }

    /**
     * Validate phase requirements before execution
     */
    async validatePhase(phaseName, currentState = {}) {
        if (!this.rules) {
            await this.loadRules();
        }

        const phase = this.rules.phases[phaseName];
        if (!phase) {
            return {
                valid: false,
                errors: [`Unknown phase: ${phaseName}`],
                warnings: []
            };
        }

        const errors = [];
        const warnings = [];

        // Check if phase is optional and can be skipped
        if (phase.optional && !this._shouldRunOptionalPhase(phaseName, currentState)) {
            return {
                valid: true,
                errors: [],
                warnings: [`Optional phase ${phaseName} will be skipped`],
                skip: true
            };
        }

        // Validate dependencies
        const depResult = await this._validateDependencies(phaseName, currentState);
        errors.push(...depResult.errors);
        warnings.push(...depResult.warnings);

        // Validate requirements
        const reqResult = await this._validateRequirements(phaseName, phase.requires || {});
        errors.push(...reqResult.errors);
        warnings.push(...reqResult.warnings);

        // Run pre-checks
        if (phase.pre_checks) {
            const checkResult = await this._runPreChecks(phaseName, phase.pre_checks);
            errors.push(...checkResult.errors);
            warnings.push(...checkResult.warnings);
        }

        // Check blocking conditions
        if (phase.blocks_if_missing && errors.length > 0) {
            errors.push(`Phase ${phaseName} is blocking - all requirements must be met`);
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            phase: phase
        };
    }

    /**
     * Validate phase outputs after completion
     */
    async validatePhaseOutputs(phaseName, outputs = {}) {
        if (!this.rules) {
            await this.loadRules();
        }

        const phase = this.rules.phases[phaseName];
        if (!phase || !phase.produces) {
            return { valid: true, errors: [], warnings: [] };
        }

        const errors = [];
        const warnings = [];

        // Check produced files
        if (phase.produces.files) {
            for (const filePattern of phase.produces.files) {
                const files = outputs.files || [];
                const hasMatch = files.some(f => this._matchesPattern(f, filePattern));
                if (!hasMatch && !await this._fileExists(filePattern)) {
                    errors.push(`Missing required output: ${filePattern}`);
                }
            }
        }

        // Check produced directories
        if (phase.produces.directories) {
            for (const dir of phase.produces.directories) {
                try {
                    const stats = await fs.stat(dir);
                    if (!stats.isDirectory()) {
                        errors.push(`Expected directory but found file: ${dir}`);
                    }
                } catch {
                    errors.push(`Missing required directory: ${dir}`);
                }
            }
        }

        // Validate outputs against rules
        if (phase.validation) {
            const valResult = await this._validateOutputRules(phaseName, phase.validation, outputs);
            errors.push(...valResult.errors);
            warnings.push(...valResult.warnings);
        }

        return { valid: errors.length === 0, errors, warnings };
    }

    /**
     * Get next valid phases based on current state
     */
    getNextPhases(currentState) {
        if (!this.rules) {
            throw new Error('Rules not loaded');
        }

        const executionOrder = this.rules.rules.execution_order;
        const completedPhases = Object.keys(currentState.phases || {})
            .filter(p => currentState.phases[p].status === 'completed');

        const nextPhases = [];

        for (const phaseName of executionOrder) {
            if (completedPhases.includes(phaseName)) {
                continue;
            }

            // Check if all dependencies are met
            const prevIndex = executionOrder.indexOf(phaseName);
            const requiredPrevPhases = executionOrder.slice(0, prevIndex)
                .filter(p => !this.rules.phases[p].optional);

            const allDependenciesMet = requiredPrevPhases.every(p => 
                completedPhases.includes(p)
            );

            if (allDependenciesMet) {
                nextPhases.push(phaseName);
            }

            // Only return the first available phase if not allowing parallel
            if (!this.rules.global.allow_parallel && nextPhases.length > 0) {
                break;
            }
        }

        return nextPhases;
    }

    /**
     * Validate dependencies between phases
     */
    async _validateDependencies(phaseName, currentState) {
        const errors = [];
        const warnings = [];

        const executionOrder = this.rules.rules.execution_order;
        const currentIndex = executionOrder.indexOf(phaseName);

        // Check all previous required phases are completed
        for (let i = 0; i < currentIndex; i++) {
            const prevPhase = executionOrder[i];
            const prevPhaseRules = this.rules.phases[prevPhase];

            // Skip optional phases
            if (prevPhaseRules.optional) continue;

            const phaseState = currentState.phases?.[prevPhase];
            if (!phaseState || phaseState.status !== 'completed') {
                errors.push(`Required phase '${prevPhase}' must be completed before '${phaseName}'`);
            }
        }

        // Check blocking conditions
        for (const condition of this.rules.rules.blocking_conditions || []) {
            const blockResult = await this._evaluateBlockingCondition(condition, currentState);
            if (blockResult.blocks) {
                errors.push(`Blocking condition: ${condition.description} - ${blockResult.reason}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate phase requirements
     */
    async _validateRequirements(phaseName, requirements) {
        const errors = [];
        const warnings = [];

        // Check required files
        if (requirements.files) {
            for (const file of requirements.files) {
                if (!await this._fileExists(file)) {
                    errors.push(`Missing required file: ${file}`);
                }
            }
        }

        // Check required directories
        if (requirements.directories) {
            for (const dir of requirements.directories) {
                try {
                    const stats = await fs.stat(dir);
                    if (!stats.isDirectory()) {
                        errors.push(`Expected directory but found file: ${dir}`);
                    }
                } catch {
                    errors.push(`Missing required directory: ${dir}`);
                }
            }
        }

        // Check environment variables
        if (requirements.environment) {
            for (const envVar of requirements.environment) {
                const vars = envVar.split('|'); // Support OR conditions
                const hasAny = vars.some(v => process.env[v]);
                if (!hasAny) {
                    errors.push(`Missing required environment variable(s): ${envVar}`);
                }
            }
        }

        // Check tools
        if (requirements.tools) {
            for (const tool of requirements.tools) {
                const tools = tool.split('|'); // Support alternatives
                let foundAny = false;
                
                for (const t of tools) {
                    try {
                        await execAsync(`which ${t}`);
                        foundAny = true;
                        break;
                    } catch {
                        // Tool not found
                    }
                }
                
                if (!foundAny) {
                    errors.push(`Missing required tool(s): ${tool}`);
                }
            }
        }

        // Check context requirements
        if (requirements.context) {
            for (const ctx of requirements.context) {
                warnings.push(`Context requirement '${ctx}' should be validated by the phase implementation`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Run pre-check scripts
     */
    async _runPreChecks(phaseName, preChecks) {
        const errors = [];
        const warnings = [];

        for (const check of preChecks) {
            try {
                if (check.script) {
                    // Run Python script
                    const scriptPath = path.join(process.cwd(), check.script);
                    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
                    
                    if (stderr && !stderr.includes('Warning')) {
                        errors.push(`Pre-check '${check.name}' failed: ${stderr}`);
                    } else if (stderr) {
                        warnings.push(`Pre-check '${check.name}': ${stderr}`);
                    }
                } else if (check.command) {
                    // Run shell command
                    const { stdout, stderr } = await execAsync(check.command);
                    
                    if (stderr) {
                        warnings.push(`Pre-check '${check.name}': ${stderr}`);
                    }
                }
            } catch (error) {
                errors.push(`Pre-check '${check.name}' failed: ${error.message}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate output rules
     */
    async _validateOutputRules(phaseName, validationRules, outputs) {
        const errors = [];
        const warnings = [];

        for (const rule of validationRules) {
            // Handle QA checks specially
            if (typeof rule === 'object' && rule.qa_checks) {
                const qaResult = this._validateQAChecks(rule.qa_checks, outputs);
                errors.push(...qaResult.errors);
                warnings.push(...qaResult.warnings);
                continue;
            }

            // Parse rule string
            const [key, value] = rule.split(':').map(s => s.trim());
            
            switch (key) {
                case 'min_words_per_chapter':
                    if (outputs.metrics?.min_words < parseInt(value)) {
                        errors.push(`Minimum words per chapter (${outputs.metrics?.min_words}) below required ${value}`);
                    }
                    break;
                    
                case 'all_chapters_have_frontmatter':
                    if (value === 'true' && !outputs.validation?.has_frontmatter) {
                        errors.push('Not all chapters have required frontmatter');
                    }
                    break;
                    
                case 'qa_passed':
                    if (value === 'true' && !outputs.status?.qa_passed) {
                        errors.push('QA validation did not pass');
                    }
                    break;
                    
                case 'all_placeholders_resolved':
                    if (value === 'true' && outputs.placeholders?.unresolved > 0) {
                        errors.push(`Found ${outputs.placeholders.unresolved} unresolved placeholders`);
                    }
                    break;
                    
                default:
                    warnings.push(`Unknown validation rule: ${rule}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Validate QA checks
     */
    _validateQAChecks(qaChecks, outputs) {
        const errors = [];
        const warnings = [];

        // Typography checks
        if (qaChecks.typography) {
            const typography = outputs.qa?.typography || {};
            
            for (const check of qaChecks.typography) {
                const [key, value] = check.split(':').map(s => s.trim());
                
                if (key === 'font_size_range') {
                    const [min, max] = JSON.parse(value);
                    if (typography.font_size < min || typography.font_size > max) {
                        errors.push(`Font size ${typography.font_size} outside range [${min}, ${max}]`);
                    }
                }
            }
        }

        // Add more QA check validations as needed...

        return { errors, warnings };
    }

    /**
     * Evaluate blocking condition
     */
    async _evaluateBlockingCondition(condition, currentState) {
        switch (condition.name) {
            case 'no_skip_phases':
                // Check if any required phase was skipped
                const executionOrder = this.rules.rules.execution_order;
                for (const phase of executionOrder) {
                    if (!this.rules.phases[phase].optional && 
                        !currentState.phases?.[phase]) {
                        return {
                            blocks: true,
                            reason: `Required phase '${phase}' has not been executed`
                        };
                    }
                }
                break;
                
            case 'qa_must_pass':
                const qaPhase = currentState.phases?.qa;
                if (qaPhase && qaPhase.status === 'completed' && 
                    !qaPhase.outputs?.status?.qa_passed) {
                    return {
                        blocks: true,
                        reason: 'QA phase completed but did not pass'
                    };
                }
                break;
                
            case 'context_sync':
                // This would need to check context file timestamps
                // Simplified for now
                return {
                    blocks: false,
                    reason: 'Context sync validation not fully implemented'
                };
                break;
        }

        return { blocks: false };
    }

    /**
     * Check if file exists (supports glob patterns)
     */
    async _fileExists(pattern) {
        try {
            // Simple existence check for now
            await fs.access(pattern);
            return true;
        } catch {
            // Could enhance with glob support
            return false;
        }
    }

    /**
     * Pattern matching helper
     */
    _matchesPattern(filename, pattern) {
        // Simple pattern matching - could enhance with minimatch
        const regex = pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\{([^}]+)\}/g, '($1)');
        return new RegExp(`^${regex}$`).test(filename);
    }

    /**
     * Check if optional phase should run
     */
    _shouldRunOptionalPhase(phaseName, currentState) {
        // Logic to determine if optional phase should run
        // For now, always suggest running optional phases
        return true;
    }

    /**
     * Generate validation report
     */
    generateReport(validationResults) {
        const report = {
            timestamp: new Date().toISOString(),
            results: validationResults,
            summary: {
                total_phases: Object.keys(validationResults).length,
                valid_phases: Object.values(validationResults).filter(r => r.valid).length,
                blocked_phases: Object.values(validationResults).filter(r => !r.valid).length,
                warnings_count: Object.values(validationResults)
                    .reduce((sum, r) => sum + r.warnings.length, 0)
            }
        };

        return report;
    }
}

// CLI interface
if (require.main === module) {
    const validator = new WorkflowValidator();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        await validator.loadRules();

        switch (command) {
            case 'validate':
                const phaseName = args[0];
                if (!phaseName) {
                    console.error('Usage: workflow-validator.js validate <phase>');
                    process.exit(1);
                }

                // Load current state
                let currentState = {};
                try {
                    const stateContent = await fs.readFile('pipeline-state.json', 'utf8');
                    currentState = JSON.parse(stateContent);
                } catch {
                    // No state file yet
                }

                const result = await validator.validatePhase(phaseName, currentState);
                
                if (!result.valid) {
                    console.error(`\n❌ Phase '${phaseName}' validation failed:\n`);
                    result.errors.forEach(err => console.error(`  • ${err}`));
                } else {
                    console.log(`\n✅ Phase '${phaseName}' validation passed`);
                }
                
                if (result.warnings.length > 0) {
                    console.log(`\n⚠️  Warnings:`);
                    result.warnings.forEach(warn => console.log(`  • ${warn}`));
                }
                
                process.exit(result.valid ? 0 : 1);
                break;

            case 'validate-outputs':
                const phase = args[0];
                const outputsFile = args[1];
                
                if (!phase || !outputsFile) {
                    console.error('Usage: workflow-validator.js validate-outputs <phase> <outputs.json>');
                    process.exit(1);
                }

                const outputs = JSON.parse(await fs.readFile(outputsFile, 'utf8'));
                const outputResult = await validator.validatePhaseOutputs(phase, outputs);
                
                console.log(JSON.stringify(outputResult, null, 2));
                process.exit(outputResult.valid ? 0 : 1);
                break;

            case 'next-phases':
                let state = {};
                try {
                    const stateContent = await fs.readFile('pipeline-state.json', 'utf8');
                    state = JSON.parse(stateContent);
                } catch {
                    // No state file
                }

                const nextPhases = validator.getNextPhases(state);
                console.log('Next available phases:', nextPhases);
                break;

            default:
                console.log(`
Workflow Validator

Usage:
  workflow-validator.js <command> [args]

Commands:
  validate <phase>                    Validate phase requirements
  validate-outputs <phase> <outputs>  Validate phase outputs
  next-phases                         Show next available phases

Examples:
  node workflow-validator.js validate writer
  node workflow-validator.js validate-outputs builder outputs.json
  node workflow-validator.js next-phases
                `);
        }
    })().catch(console.error);
}

module.exports = WorkflowValidator;