/**
 * Agent Wrapper for Error Broadcasting
 * 
 * Wraps agent functions with try/catch and broadcasts errors immediately
 */

// Try to get admin broadcast functions if available
let adminLog, adminError;
try {
    // These are set globally by admin server when running
    adminLog = global.adminLog || console.log;
    adminError = global.adminError || console.error;
} catch {
    adminLog = console.log;
    adminError = console.error;
}

/**
 * Wrap an agent function with error handling and broadcasting
 */
function wrapAgent(agentName, agentFunction) {
    return async function wrappedAgent(...args) {
        const startTime = Date.now();
        adminLog(`[${agentName}] Starting...`);
        
        try {
            const result = await agentFunction(...args);
            
            const duration = Date.now() - startTime;
            adminLog(`[${agentName}] ✅ Completed in ${(duration / 1000).toFixed(1)}s`);
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Broadcast error immediately
            adminError({
                type: 'agent',
                agent: agentName,
                error: error.message,
                stack: error.stack,
                duration,
                args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg).substring(0, 100) + '...' : arg)
            });
            
            adminLog(`[${agentName}] ❌ Failed after ${(duration / 1000).toFixed(1)}s: ${error.message}`);
            
            // Re-throw for upstream handling
            throw error;
        }
    };
}

/**
 * Create a timeout wrapper
 */
function withTimeout(fn, timeoutMs = 30000, name = 'Function') {
    return async function timeoutWrapper(...args) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`${name} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        
        return Promise.race([fn(...args), timeoutPromise]);
    };
}

/**
 * Wrap all methods of a class instance
 */
function wrapClass(instance, className) {
    const wrapped = {};
    
    const propertyNames = Object.getOwnPropertyNames(Object.getPrototypeOf(instance));
    
    for (const name of propertyNames) {
        const property = instance[name];
        
        if (typeof property === 'function' && name !== 'constructor') {
            wrapped[name] = wrapAgent(`${className}.${name}`, property.bind(instance));
        }
    }
    
    return wrapped;
}

module.exports = {
    wrapAgent,
    withTimeout,
    wrapClass,
    adminLog,
    adminError
};