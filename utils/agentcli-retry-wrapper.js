const { spawn } = require('child_process');

/**
 * Retry wrapper for agentcli to handle 529 (rate limit) errors
 * Implements exponential backoff with jitter
 */
class AgentCliRetryWrapper {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.initialDelay = options.initialDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 64000; // 64 seconds
    this.jitterFactor = options.jitterFactor || 0.3; // 30% jitter
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  calculateDelay(attempt) {
    // Exponential backoff: 2^attempt * initialDelay
    const exponentialDelay = Math.pow(2, attempt) * this.initialDelay;
    
    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.jitterFactor * (Math.random() - 0.5);
    
    return Math.round(cappedDelay + jitter);
  }

  /**
   * Execute agentcli command with retry logic
   */
  async execute(agent, args = {}) {
    let lastError = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`🤖 Calling agent: ${agent} (attempt ${attempt + 1}/${this.maxRetries})`);
        
        const result = await this.runAgentCli(agent, args);
        
        // Success! Return the result
        console.log(`✅ Agent ${agent} completed successfully`);
        return result;
        
      } catch (error) {
        lastError = error;
        
        // Check if it's a 529 error or overloaded error
        if (this.isRetryableError(error)) {
          const delay = this.calculateDelay(attempt);
          console.log(`⚠️  Agent ${agent} returned ${error.code || '529'} - overloaded`);
          console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before retry...`);
          
          await this.sleep(delay);
        } else {
          // Non-retryable error, throw immediately
          throw error;
        }
      }
    }
    
    // All retries exhausted
    throw new Error(`Agent ${agent} failed after ${this.maxRetries} attempts. Last error: ${lastError.message}`);
  }

  /**
   * Check if error is retryable (529 or similar overload errors)
   */
  isRetryableError(error) {
    // Check for 529 status code
    if (error.code === 529 || error.statusCode === 529) {
      return true;
    }
    
    // Check for overload-related error messages
    const overloadMessages = [
      'overloaded',
      'rate limit',
      'too many requests',
      '529',
      'service unavailable',
      'temporarily unavailable',
      'system is busy'
    ];
    
    const errorMessage = (error.message || '').toLowerCase();
    return overloadMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Run agentcli command
   */
  runAgentCli(agent, args) {
    return new Promise((resolve, reject) => {
      const cmdArgs = ['call', agent];
      
      // Add any additional arguments
      if (args && Object.keys(args).length > 0) {
        cmdArgs.push(JSON.stringify(args));
      }
      
      const child = spawn('agentcli', cmdArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('error', (error) => {
        reject(error);
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse JSON response
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (e) {
            // Return raw output if not JSON
            resolve(stdout.trim());
          }
        } else {
          // Check for 529 in stderr or stdout
          const output = stdout + stderr;
          const error = new Error(`Agent ${agent} failed with code ${code}: ${stderr || stdout}`);
          
          if (output.includes('529') || output.includes('overloaded')) {
            error.code = 529;
          } else {
            error.code = code;
          }
          
          reject(error);
        }
      });
      
      // Send input if needed
      if (args.input) {
        child.stdin.write(args.input);
        child.stdin.end();
      }
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function to call an agent with retry
 */
async function callAgentWithRetry(agent, args = {}, options = {}) {
  const wrapper = new AgentCliRetryWrapper(options);
  return wrapper.execute(agent, args);
}

module.exports = {
  AgentCliRetryWrapper,
  callAgentWithRetry
};