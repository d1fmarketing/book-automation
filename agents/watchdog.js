#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Watchdog configuration
const WATCHDOG_CONFIG = {
  checkInterval: 30000,        // Check every 30 seconds
  maxAge: 900,                 // Max age in seconds (15 minutes)
  manifestPath: 'build/run-manifest.json',
  logPath: 'build/logs/watchdog.log',
  pidPath: 'build/orchestrator.pid'
};

class PipelineWatchdog {
  constructor() {
    this.isRunning = false;
    this.orchestratorProcess = null;
    this.restartCount = 0;
    this.maxRestarts = 5;
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    
    console.log(logEntry.trim());
    
    try {
      await fs.mkdir(path.dirname(WATCHDOG_CONFIG.logPath), { recursive: true });
      await fs.appendFile(WATCHDOG_CONFIG.logPath, logEntry);
    } catch (e) {
      // Ignore logging errors
    }
  }

  async checkManifest() {
    try {
      const manifestData = await fs.readFile(WATCHDOG_CONFIG.manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);
      
      const age = Date.now() / 1000 - manifest.timestamp;
      
      await this.log(`Manifest check - Age: ${Math.round(age)}s, Final: ${manifest.final}, Steps: ${manifest.steps.length}`);
      
      // Check if manifest is stale and not final
      if (!manifest.final && age > WATCHDOG_CONFIG.maxAge) {
        await this.log(`⚠️  Pipeline stuck! Age: ${Math.round(age)}s exceeds max: ${WATCHDOG_CONFIG.maxAge}s`, 'WARN');
        return { stuck: true, manifest };
      }
      
      // Check if pipeline completed
      if (manifest.final) {
        await this.log('✅ Pipeline completed successfully!', 'INFO');
        return { completed: true, manifest };
      }
      
      return { healthy: true, manifest };
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.log('No manifest found - pipeline may not have started', 'DEBUG');
        return { notStarted: true };
      }
      
      await this.log(`Error reading manifest: ${error.message}`, 'ERROR');
      return { error: true };
    }
  }

  async checkOrchestrator() {
    try {
      const pidData = await fs.readFile(WATCHDOG_CONFIG.pidPath, 'utf8');
      const pid = parseInt(pidData.trim());
      
      // Check if process is running
      try {
        process.kill(pid, 0);
        return { running: true, pid };
      } catch (e) {
        await this.log(`Orchestrator process ${pid} not running`, 'WARN');
        return { running: false, pid };
      }
    } catch (error) {
      return { running: false };
    }
  }

  async startOrchestrator(topic) {
    if (this.restartCount >= this.maxRestarts) {
      await this.log(`❌ Max restarts (${this.maxRestarts}) reached - giving up`, 'ERROR');
      process.exit(1);
    }

    await this.log(`🚀 Starting orchestrator (restart #${this.restartCount + 1})...`, 'INFO');
    
    // Kill any existing orchestrator
    const check = await this.checkOrchestrator();
    if (check.running && check.pid) {
      await this.log(`Killing existing orchestrator PID: ${check.pid}`, 'INFO');
      try {
        process.kill(check.pid, 'SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        // Process may have already died
      }
    }

    // Start new orchestrator
    const orchestratorPath = path.join(__dirname, '..', 'scripts', 'orchestrator.js');
    
    this.orchestratorProcess = spawn('node', [orchestratorPath, topic], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MAX_ATTEMPTS: '10' }
    });

    // Save PID
    await fs.writeFile(WATCHDOG_CONFIG.pidPath, this.orchestratorProcess.pid.toString());
    
    // Log output
    this.orchestratorProcess.stdout.on('data', (data) => {
      console.log(`[ORCHESTRATOR] ${data.toString().trim()}`);
    });
    
    this.orchestratorProcess.stderr.on('data', (data) => {
      console.error(`[ORCHESTRATOR ERROR] ${data.toString().trim()}`);
    });

    this.orchestratorProcess.on('exit', (code) => {
      this.log(`Orchestrator exited with code: ${code}`, code === 0 ? 'INFO' : 'ERROR');
    });

    this.orchestratorProcess.unref();
    this.restartCount++;
    
    await this.log(`Orchestrator started with PID: ${this.orchestratorProcess.pid}`, 'INFO');
  }

  async run(topic) {
    await this.log('🐕 Pipeline Watchdog starting...', 'INFO');
    await this.log(`Topic: ${topic}`, 'INFO');
    await this.log(`Check interval: ${WATCHDOG_CONFIG.checkInterval / 1000}s`, 'INFO');
    await this.log(`Max pipeline age: ${WATCHDOG_CONFIG.maxAge}s`, 'INFO');
    
    this.isRunning = true;

    // Start orchestrator initially
    await this.startOrchestrator(topic);

    // Main watchdog loop
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, WATCHDOG_CONFIG.checkInterval));
      
      const manifestCheck = await this.checkManifest();
      const orchestratorCheck = await this.checkOrchestrator();
      
      // Handle different scenarios
      if (manifestCheck.completed) {
        await this.log('🎉 Pipeline completed successfully! Watchdog stopping.', 'INFO');
        this.isRunning = false;
        break;
      }
      
      if (manifestCheck.stuck || !orchestratorCheck.running) {
        if (manifestCheck.stuck) {
          await this.log('⛔ Pipeline is stuck - restarting orchestrator...', 'WARN');
        } else {
          await this.log('⛔ Orchestrator not running - restarting...', 'WARN');
        }
        
        await this.startOrchestrator(topic);
      }
      
      if (manifestCheck.healthy) {
        await this.log(`✅ Pipeline healthy - ${manifestCheck.manifest.steps.length} steps completed`, 'DEBUG');
      }
    }
    
    await this.log('🐕 Watchdog shutting down', 'INFO');
  }

  async stop() {
    this.isRunning = false;
    if (this.orchestratorProcess) {
      this.orchestratorProcess.kill('SIGTERM');
    }
  }
}

// PM2 ecosystem configuration generator
async function generatePM2Config() {
  const ecosystem = {
    apps: [
      {
        name: 'ebook-orchestrator',
        script: './scripts/orchestrator.js',
        args: process.env.EBOOK_TOPIC || 'How to Make Money with AI',
        instances: 1,
        autorestart: false, // Watchdog handles restarts
        watch: false,
        max_memory_restart: '2G',
        env: {
          NODE_ENV: 'production',
          MAX_ATTEMPTS: 10
        },
        error_file: './build/logs/orchestrator-error.log',
        out_file: './build/logs/orchestrator-out.log',
        time: true
      },
      {
        name: 'ebook-watchdog',
        script: './agents/watchdog.js',
        args: process.env.EBOOK_TOPIC || 'How to Make Money with AI',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
          NODE_ENV: 'production'
        },
        error_file: './build/logs/watchdog-error.log',
        out_file: './build/logs/watchdog-out.log',
        time: true
      }
    ]
  };

  await fs.writeFile('ecosystem.config.js', `module.exports = ${JSON.stringify(ecosystem, null, 2)}`);
  console.log('✅ PM2 ecosystem config generated: ecosystem.config.js');
  console.log('\nTo start with PM2:');
  console.log('   pm2 start ecosystem.config.js');
  console.log('   pm2 save');
  console.log('   pm2 startup');
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'pm2-config') {
    generatePM2Config().catch(console.error);
  } else {
    const topic = args[0] || process.env.EBOOK_TOPIC;
    
    if (!topic) {
      console.error('Usage: node watchdog.js "<topic>"');
      console.error('   or: node watchdog.js pm2-config');
      process.exit(1);
    }
    
    const watchdog = new PipelineWatchdog();
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      await watchdog.log('Received SIGTERM - shutting down gracefully', 'INFO');
      await watchdog.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      await watchdog.log('Received SIGINT - shutting down gracefully', 'INFO');
      await watchdog.stop();
      process.exit(0);
    });
    
    watchdog.run(topic).catch(async (error) => {
      await watchdog.log(`Fatal error: ${error.message}`, 'ERROR');
      console.error(error);
      process.exit(1);
    });
  }
}

module.exports = PipelineWatchdog;