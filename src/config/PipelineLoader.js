/**
 * Pipeline Loader
 * 
 * Loads and validates YAML pipeline configurations
 * Supports inheritance and variable substitution
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const Joi = require('joi');

// Pipeline schema for validation
const stageSchema = Joi.object({
    id: Joi.string().required(),
    name: Joi.string(),
    agent: Joi.string().required(),
    depends_on: Joi.array().items(Joi.string()),
    parallel_with: Joi.array().items(Joi.string()),
    config: Joi.object(),
    timeout: Joi.number().positive(),
    retries: Joi.number().min(0),
    cache: Joi.boolean(),
    cache_key: Joi.string(),
    cache_ttl: Joi.number().positive(),
    required: Joi.boolean(),
    condition: Joi.string(),
    parallel: Joi.boolean(),
    parallel_max: Joi.number().positive(),
    foreach: Joi.string(),
    override: Joi.boolean(),
    enabled: Joi.boolean(),
    runs: Joi.number().positive(),
    manual: Joi.boolean(),
    fail_fast: Joi.boolean()
});

const pipelineSchema = Joi.object({
    version: Joi.string().required(),
    name: Joi.string().required(),
    description: Joi.string(),
    extends: Joi.string(),
    settings: Joi.object(),
    stages: Joi.array().items(stageSchema).required(),
    success_criteria: Joi.object(),
    notifications: Joi.object(),
    metrics: Joi.array().items(Joi.string()),
    quality_gates: Joi.array()
});

class PipelineLoader {
    constructor(options = {}) {
        this.options = {
            pipelinesDir: path.join(__dirname, '../../pipelines'),
            cache: new Map(),
            ...options
        };
    }

    /**
     * Load a pipeline configuration
     */
    async load(pipelineName, variables = {}) {
        // Check cache
        const cacheKey = `${pipelineName}-${JSON.stringify(variables)}`;
        if (this.options.cache.has(cacheKey)) {
            return this.options.cache.get(cacheKey);
        }

        try {
            // Load pipeline file
            const pipelinePath = path.join(this.options.pipelinesDir, `${pipelineName}.yaml`);
            const content = await fs.readFile(pipelinePath, 'utf8');
            
            // Parse YAML
            let pipeline = yaml.load(content);
            
            // Handle inheritance
            if (pipeline.extends) {
                const baseName = pipeline.extends.replace('.yaml', '');
                const basePipeline = await this.load(baseName, variables);
                pipeline = this.mergePipelines(basePipeline, pipeline);
            }
            
            // Substitute variables
            pipeline = this.substituteVariables(pipeline, variables);
            
            // Validate
            const validation = pipelineSchema.validate(pipeline);
            if (validation.error) {
                throw new Error(`Pipeline validation failed: ${validation.error.message}`);
            }
            
            // Process and optimize
            pipeline = this.processPipeline(pipeline);
            
            // Cache
            this.options.cache.set(cacheKey, pipeline);
            
            return pipeline;
            
        } catch (error) {
            throw new Error(`Failed to load pipeline "${pipelineName}": ${error.message}`);
        }
    }

    /**
     * Merge pipelines for inheritance
     */
    mergePipelines(base, override) {
        const merged = JSON.parse(JSON.stringify(base));
        
        // Merge settings
        if (override.settings) {
            merged.settings = this.deepMerge(merged.settings || {}, override.settings);
        }
        
        // Merge stages
        if (override.stages) {
            merged.stages = this.mergeStages(merged.stages || [], override.stages);
        }
        
        // Override other properties
        ['success_criteria', 'notifications', 'metrics', 'quality_gates'].forEach(prop => {
            if (override[prop]) {
                merged[prop] = override[prop];
            }
        });
        
        // Keep metadata from override
        merged.name = override.name;
        merged.description = override.description;
        delete merged.extends;
        
        return merged;
    }

    /**
     * Merge stage arrays
     */
    mergeStages(baseStages, overrideStages) {
        const stageMap = new Map();
        
        // Add base stages
        baseStages.forEach(stage => {
            stageMap.set(stage.id, { ...stage });
        });
        
        // Process overrides
        overrideStages.forEach(stage => {
            if (stage.override) {
                // Override existing stage
                const existing = stageMap.get(stage.id);
                if (existing) {
                    const merged = this.deepMerge(existing, stage);
                    delete merged.override;
                    
                    // Handle special case for enabled
                    if (stage.enabled === false) {
                        merged.condition = 'false';
                    }
                    
                    stageMap.set(stage.id, merged);
                }
            } else {
                // Add new stage
                stageMap.set(stage.id, stage);
            }
        });
        
        return Array.from(stageMap.values());
    }

    /**
     * Deep merge objects
     */
    deepMerge(target, source) {
        const output = { ...target };
        
        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                output[key] = this.deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        
        return output;
    }

    /**
     * Substitute variables in pipeline
     */
    substituteVariables(pipeline, variables) {
        const context = {
            ...variables,
            env: process.env,
            settings: pipeline.settings || {},
            timestamp: Date.now(),
            date: new Date().toISOString()
        };
        
        const substitute = (obj) => {
            if (typeof obj === 'string') {
                // Simple template substitution
                return obj.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
                    try {
                        // Safe evaluation
                        const keys = Object.keys(context);
                        const values = keys.map(k => context[k]);
                        const fn = new Function(...keys, `return ${expr}`);
                        return fn(...values);
                    } catch {
                        return match;
                    }
                });
            } else if (Array.isArray(obj)) {
                return obj.map(item => substitute(item));
            } else if (obj instanceof Object) {
                const result = {};
                for (const key in obj) {
                    result[key] = substitute(obj[key]);
                }
                return result;
            }
            return obj;
        };
        
        return substitute(pipeline);
    }

    /**
     * Process and optimize pipeline
     */
    processPipeline(pipeline) {
        // Build dependency graph
        const stages = pipeline.stages;
        const stageMap = new Map(stages.map(s => [s.id, s]));
        
        // Add implicit dependencies
        stages.forEach((stage, index) => {
            if (!stage.depends_on && index > 0) {
                // If no explicit dependencies, depend on previous required stage
                for (let i = index - 1; i >= 0; i--) {
                    if (stages[i].required !== false) {
                        stage.depends_on = [stages[i].id];
                        break;
                    }
                }
            }
        });
        
        // Validate dependencies
        stages.forEach(stage => {
            if (stage.depends_on) {
                stage.depends_on.forEach(dep => {
                    if (!stageMap.has(dep)) {
                        throw new Error(`Stage "${stage.id}" depends on unknown stage "${dep}"`);
                    }
                });
            }
            
            if (stage.parallel_with) {
                stage.parallel_with.forEach(parallel => {
                    if (!stageMap.has(parallel)) {
                        throw new Error(`Stage "${stage.id}" parallel with unknown stage "${parallel}"`);
                    }
                });
            }
        });
        
        // Calculate execution order
        pipeline.executionPlan = this.calculateExecutionPlan(stages);
        
        return pipeline;
    }

    /**
     * Calculate optimal execution plan
     */
    calculateExecutionPlan(stages) {
        const plan = [];
        const completed = new Set();
        const stageMap = new Map(stages.map(s => [s.id, s]));
        
        const canRun = (stage) => {
            if (!stage.depends_on || stage.depends_on.length === 0) {
                return true;
            }
            return stage.depends_on.every(dep => completed.has(dep));
        };
        
        while (completed.size < stages.length) {
            const batch = [];
            
            for (const stage of stages) {
                if (!completed.has(stage.id) && canRun(stage)) {
                    batch.push(stage.id);
                }
            }
            
            if (batch.length === 0) {
                throw new Error('Circular dependency detected in pipeline');
            }
            
            // Group parallel stages
            const parallelGroups = [];
            const processed = new Set();
            
            for (const stageId of batch) {
                if (processed.has(stageId)) continue;
                
                const stage = stageMap.get(stageId);
                const group = [stageId];
                processed.add(stageId);
                
                // Find stages that can run in parallel
                if (stage.parallel_with) {
                    stage.parallel_with.forEach(parallelId => {
                        if (batch.includes(parallelId) && !processed.has(parallelId)) {
                            group.push(parallelId);
                            processed.add(parallelId);
                        }
                    });
                }
                
                parallelGroups.push(group);
            }
            
            plan.push(parallelGroups);
            batch.forEach(id => completed.add(id));
        }
        
        return plan;
    }

    /**
     * List available pipelines
     */
    async list() {
        const files = await fs.readdir(this.options.pipelinesDir);
        return files
            .filter(f => f.endsWith('.yaml'))
            .map(f => f.replace('.yaml', ''));
    }

    /**
     * Validate a pipeline without loading
     */
    async validate(pipelineName) {
        try {
            await this.load(pipelineName);
            return { valid: true };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get pipeline info without full load
     */
    async info(pipelineName) {
        const pipelinePath = path.join(this.options.pipelinesDir, `${pipelineName}.yaml`);
        const content = await fs.readFile(pipelinePath, 'utf8');
        const pipeline = yaml.load(content);
        
        return {
            name: pipeline.name,
            version: pipeline.version,
            description: pipeline.description,
            extends: pipeline.extends,
            stages: pipeline.stages.length,
            settings: Object.keys(pipeline.settings || {})
        };
    }
}

module.exports = PipelineLoader;