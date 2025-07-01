// performance-monitor.js - Track operation performance

class PerformanceMonitor {
  constructor(telemetryClient = null) {
    this.telemetryClient = telemetryClient;
    this.operations = new Map();
  }

  async trackOperation(operationName, fn) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      
      const metrics = {
        operation: operationName,
        duration,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed,
        status: 'success'
      };
      
      this.recordMetrics(metrics);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const metrics = {
        operation: operationName,
        duration,
        status: 'error',
        error: error.message
      };
      
      this.recordMetrics(metrics);
      throw error;
    }
  }

  recordMetrics(metrics) {
    console.log(`[Performance] ${metrics.operation}: ${metrics.duration}ms (${metrics.status})`);
    
    if (this.telemetryClient) {
      this.telemetryClient.send(metrics);
    }
    
    // Store for local analysis
    if (!this.operations.has(metrics.operation)) {
      this.operations.set(metrics.operation, []);
    }
    this.operations.get(metrics.operation).push(metrics);
  }

  getStats(operationName) {
    const ops = this.operations.get(operationName) || [];
    if (ops.length === 0) return null;
    
    const durations = ops.map(op => op.duration);
    const successful = ops.filter(op => op.status === 'success');
    
    return {
      count: ops.length,
      successRate: (successful.length / ops.length) * 100,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations)
    };
  }
}

module.exports = PerformanceMonitor;
