/**
 * Agent Helpers for Claude Elite
 * Provides sub-agent spawning and management
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const cache = require('./cache');

// Agent pool for reuse
const agentPool = new Map();

// Agent process wrapper
class AgentProcess extends EventEmitter {
  constructor(name, args = []) {
    super();
    this.name = name;
    this.args = args;
    this.process = null;
    this.output = '';
    this.errors = '';
    this.startTime = null;
    this.endTime = null;
  }

  async start() {
    this.startTime = Date.now();
    
    // Check cache first
    const cacheKey = `${this.name}:${JSON.stringify(this.args)}`;
    const cached = await cache.get('agent-results', cacheKey);
    if (cached) {
      this.output = cached.output;
      this.endTime = Date.now();
      this.emit('complete', cached);
      return cached;
    }

    return new Promise((resolve, reject) => {
      // Spawn the agent process
      this.process = spawn('node', [
        path.join(process.cwd(), '.claude/scripts/agent-launcher.js'),
        this.name,
        ...this.args
      ], {
        env: { ...process.env, AGENT_MODE: 'subprocess' }
      });

      // Capture output
      this.process.stdout.on('data', (data) => {
        const chunk = data.toString();
        this.output += chunk;
        this.emit('data', chunk);
      });

      // Capture errors
      this.process.stderr.on('data', (data) => {
        const chunk = data.toString();
        this.errors += chunk;
        this.emit('error', chunk);
      });

      // Handle completion
      this.process.on('close', async (code) => {
        this.endTime = Date.now();
        const duration = this.endTime - this.startTime;
        
        const result = {
          name: this.name,
          args: this.args,
          output: this.output,
          errors: this.errors,
          code,
          duration,
          success: code === 0
        };

        // Cache successful results
        if (code === 0) {
          await cache.set('agent-results', [cacheKey], result, 3600);
        }

        this.emit('complete', result);
        
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error(`Agent ${this.name} failed with code ${code}: ${this.errors}`));
        }
      });

      // Handle process errors
      this.process.on('error', (error) => {
        this.endTime = Date.now();
        this.emit('error', error);
        reject(error);
      });
    });
  }

  async stop() {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }
  }
}

/**
 * Spawn a single agent
 * @param {string} agentName - Name of the agent to spawn
 * @param {Array} args - Arguments to pass to the agent
 * @param {Object} options - Options for spawning
 * @returns {Promise<Object>} - Agent result
 */
async function spawnAgent(agentName, args = [], options = {}) {
  const {
    timeout = 30000,
    cached = true,
    pooled = true
  } = options;

  // Check pool for reusable agent
  const poolKey = `${agentName}:${pooled}`;
  let agent;
  
  if (pooled && agentPool.has(poolKey)) {
    agent = agentPool.get(poolKey);
    agent.args = args;
  } else {
    agent = new AgentProcess(agentName, args);
    if (pooled) {
      agentPool.set(poolKey, agent);
    }
  }

  // Set timeout
  const timeoutHandle = setTimeout(() => {
    agent.stop();
  }, timeout);

  try {
    const result = await agent.start();
    clearTimeout(timeoutHandle);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle);
    throw error;
  }
}

/**
 * Spawn multiple agents in parallel
 * @param {Array} agents - Array of {name, args} objects
 * @param {Object} options - Options for spawning
 * @returns {Promise<Array>} - Array of results
 */
async function spawnAgents(agents, options = {}) {
  const {
    concurrency = 5,
    onProgress = () => {},
    stopOnError = false
  } = options;

  const results = [];
  const queue = [...agents];
  let completed = 0;

  // Process in batches
  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    
    const batchPromises = batch.map(async ({ name, args }) => {
      try {
        const result = await spawnAgent(name, args, options);
        completed++;
        onProgress(completed, agents.length, result);
        return { success: true, result };
      } catch (error) {
        completed++;
        onProgress(completed, agents.length, null);
        
        if (stopOnError) {
          throw error;
        }
        
        return { success: false, error: error.message };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Create an agent pipeline
 * @param {Array} stages - Array of agent stages
 * @returns {Promise<Array>} - Results from each stage
 */
async function agentPipeline(stages) {
  const results = [];
  let previousOutput = null;

  for (const stage of stages) {
    const { name, args = [], transform = (x) => x } = stage;
    
    // Use previous output as input if available
    const stageArgs = previousOutput 
      ? [transform(previousOutput), ...args]
      : args;

    try {
      const result = await spawnAgent(name, stageArgs);
      results.push(result);
      previousOutput = result.output;
    } catch (error) {
      results.push({ error: error.message });
      break;
    }
  }

  return results;
}

/**
 * Monitor agent health
 */
async function getAgentStats() {
  const stats = {
    poolSize: agentPool.size,
    agents: []
  };

  for (const [key, agent] of agentPool) {
    stats.agents.push({
      key,
      name: agent.name,
      running: agent.process && !agent.process.killed,
      startTime: agent.startTime,
      duration: agent.endTime ? agent.endTime - agent.startTime : null
    });
  }

  // Get cache stats
  const cacheStats = await cache.stats();
  stats.cache = cacheStats;

  return stats;
}

/**
 * Clean up agent pool
 */
async function cleanupAgents() {
  for (const agent of agentPool.values()) {
    await agent.stop();
  }
  agentPool.clear();
}

// Cleanup on exit
process.on('exit', cleanupAgents);
process.on('SIGINT', cleanupAgents);
process.on('SIGTERM', cleanupAgents);

module.exports = {
  spawnAgent,
  spawnAgents,
  agentPipeline,
  getAgentStats,
  cleanupAgents,
  AgentProcess
};