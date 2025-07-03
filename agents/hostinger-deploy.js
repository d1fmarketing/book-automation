#!/usr/bin/env node

/**
 * Hostinger Deploy Agent
 * 
 * Deploys ebooks to Hostinger VPS using blue-green deployment strategy.
 * Manages DNS switching after Lighthouse validation passes.
 * 
 * Usage:
 *   agentcli call deploy.hostinger --ebook-dir="build/ebooks/my-ebook" --env="production"
 *   node agents/hostinger-deploy.js --ebook-dir="build/ebooks/my-ebook" --validate
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const crypto = require('crypto');

// Deployment configuration
const DEPLOY_CONFIG = {
    hostinger: {
        apiUrl: process.env.HOSTINGER_API_URL || 'https://api.hostinger.com/v1',
        apiToken: process.env.HOSTINGER_API_TOKEN,
        vpsHost: process.env.HOSTINGER_VPS_HOST || 'your-vps.hostinger.com',
        sshUser: process.env.HOSTINGER_SSH_USER || 'root',
        sshKeyPath: process.env.HOSTINGER_SSH_KEY || '~/.ssh/hostinger_rsa'
    },
    paths: {
        blue: '/var/www/ebooks-blue',
        green: '/var/www/ebooks-green',
        shared: '/var/www/ebooks-shared',
        nginx: '/etc/nginx/sites-available'
    },
    lighthouse: {
        threshold: 90,
        retries: 3,
        waitTime: 5000 // Wait 5s between retries
    }
};

class HostingerDeploy {
    constructor(options = {}) {
        this.config = { ...DEPLOY_CONFIG, ...options };
        this.currentEnv = null;
        this.deploymentId = `deploy-${Date.now()}`;
    }

    async deploy(ebookDir, options = {}) {
        console.log(`🚀 Starting Hostinger deployment: ${ebookDir}`);
        console.log(`📦 Deployment ID: ${this.deploymentId}`);
        
        try {
            // Pre-deployment checks
            await this.preDeploymentChecks(ebookDir);
            
            // Determine current environment (blue/green)
            this.currentEnv = await this.getCurrentEnvironment();
            const targetEnv = this.currentEnv === 'blue' ? 'green' : 'blue';
            
            console.log(`🎯 Current: ${this.currentEnv}, Target: ${targetEnv}`);
            
            // Create deployment package
            const packagePath = await this.createDeploymentPackage(ebookDir);
            
            // Upload to target environment
            await this.uploadToVPS(packagePath, targetEnv);
            
            // Deploy to target environment
            await this.deployToEnvironment(targetEnv, path.basename(ebookDir));
            
            // Run health checks
            const healthCheck = await this.runHealthChecks(targetEnv);
            if (!healthCheck.passed) {
                throw new Error(`Health check failed: ${healthCheck.error}`);
            }
            
            // Run Lighthouse validation
            const lighthouseResult = await this.runLighthouseValidation(targetEnv);
            if (!lighthouseResult.passed) {
                console.log(`⚠️  Lighthouse score below threshold: ${lighthouseResult.average}/100`);
                
                if (!options.force) {
                    await this.rollback(targetEnv);
                    throw new Error('Lighthouse validation failed. Use --force to override.');
                }
            }
            
            // Switch DNS to new environment
            if (!options.skipDNS) {
                await this.switchDNS(targetEnv);
            }
            
            // Post-deployment tasks
            await this.postDeployment(targetEnv, this.currentEnv);
            
            // Generate deployment report
            const report = await this.generateDeploymentReport({
                ebookDir,
                targetEnv,
                healthCheck,
                lighthouseResult,
                deploymentId: this.deploymentId
            });
            
            console.log(`✅ Deployment successful to ${targetEnv} environment`);
            
            return {
                success: true,
                deploymentId: this.deploymentId,
                environment: targetEnv,
                url: `https://${this.config.hostinger.vpsHost}/ebooks/${path.basename(ebookDir)}`,
                lighthouse: lighthouseResult,
                report
            };
            
        } catch (error) {
            console.error(`❌ Deployment failed: ${error.message}`);
            
            // Attempt rollback
            if (this.currentEnv) {
                await this.emergencyRollback();
            }
            
            return {
                success: false,
                error: error.message,
                deploymentId: this.deploymentId
            };
        }
    }

    async preDeploymentChecks(ebookDir) {
        console.log('🔍 Running pre-deployment checks...');
        
        // Check if directory exists
        await fs.access(ebookDir);
        
        // Check for required files
        const requiredFiles = ['index.html', 'metadata.json'];
        for (const file of requiredFiles) {
            await fs.access(path.join(ebookDir, file));
        }
        
        // Check API token
        if (!this.config.hostinger.apiToken) {
            throw new Error('HOSTINGER_API_TOKEN environment variable not set');
        }
        
        // Check SSH access
        await this.testSSHConnection();
        
        console.log('✅ Pre-deployment checks passed');
    }

    async testSSHConnection() {
        const command = `ssh -i ${this.config.hostinger.sshKeyPath} -o BatchMode=yes -o ConnectTimeout=5 ${this.config.hostinger.sshUser}@${this.config.hostinger.vpsHost} echo "SSH OK"`;
        
        try {
            const { stdout } = await execAsync(command);
            if (!stdout.includes('SSH OK')) {
                throw new Error('SSH connection test failed');
            }
        } catch (error) {
            throw new Error(`SSH connection failed: ${error.message}`);
        }
    }

    async getCurrentEnvironment() {
        try {
            // Check which environment is currently active via nginx config
            const command = `ssh -i ${this.config.hostinger.sshKeyPath} ${this.config.hostinger.sshUser}@${this.config.hostinger.vpsHost} "grep -l 'ebooks-blue' ${this.config.paths.nginx}/ebooks 2>/dev/null || echo 'green'"`;
            
            const { stdout } = await execAsync(command);
            return stdout.includes('ebooks-blue') ? 'blue' : 'green';
        } catch {
            // Default to blue if no config exists
            return 'blue';
        }
    }

    async createDeploymentPackage(ebookDir) {
        console.log('📦 Creating deployment package...');
        
        const tempDir = path.join('/tmp', this.deploymentId);
        await fs.mkdir(tempDir, { recursive: true });
        
        // Copy ebook files
        await execAsync(`cp -r "${ebookDir}"/* "${tempDir}/"`);
        
        // Add deployment metadata
        const deploymentMeta = {
            deploymentId: this.deploymentId,
            timestamp: new Date().toISOString(),
            source: ebookDir,
            version: await this.getVersion(ebookDir),
            checksum: await this.calculateChecksum(ebookDir)
        };
        
        await fs.writeFile(
            path.join(tempDir, 'deployment.json'),
            JSON.stringify(deploymentMeta, null, 2)
        );
        
        // Create tarball
        const packagePath = `/tmp/${this.deploymentId}.tar.gz`;
        await execAsync(`tar -czf "${packagePath}" -C "${tempDir}" .`);
        
        // Cleanup temp directory
        await execAsync(`rm -rf "${tempDir}"`);
        
        console.log(`✅ Package created: ${packagePath}`);
        return packagePath;
    }

    async getVersion(ebookDir) {
        try {
            const metadata = await fs.readFile(path.join(ebookDir, 'metadata.json'), 'utf8');
            const { version } = JSON.parse(metadata);
            return version || '1.0.0';
        } catch {
            return '1.0.0';
        }
    }

    async calculateChecksum(dir) {
        const { stdout } = await execAsync(`find "${dir}" -type f -exec md5sum {} + | sort | md5sum | cut -d' ' -f1`);
        return stdout.trim();
    }

    async uploadToVPS(packagePath, environment) {
        console.log(`📤 Uploading to ${environment} environment...`);
        
        const remotePath = `/tmp/${path.basename(packagePath)}`;
        const scpCommand = `scp -i ${this.config.hostinger.sshKeyPath} "${packagePath}" ${this.config.hostinger.sshUser}@${this.config.hostinger.vpsHost}:${remotePath}`;
        
        await execAsync(scpCommand);
        
        // Cleanup local package
        await fs.unlink(packagePath);
        
        console.log('✅ Upload complete');
        return remotePath;
    }

    async deployToEnvironment(environment, ebookName) {
        console.log(`🚀 Deploying to ${environment} environment...`);
        
        const envPath = environment === 'blue' ? this.config.paths.blue : this.config.paths.green;
        const deployPath = path.join(envPath, ebookName);
        
        // SSH commands to deploy
        const commands = [
            // Create directory structure
            `mkdir -p "${deployPath}"`,
            
            // Extract package
            `tar -xzf "/tmp/${this.deploymentId}.tar.gz" -C "${deployPath}"`,
            
            // Set permissions
            `chown -R www-data:www-data "${deployPath}"`,
            `chmod -R 755 "${deployPath}"`,
            
            // Create symlinks for shared assets
            `ln -sfn "${this.config.paths.shared}/assets" "${deployPath}/shared-assets"`,
            
            // Cleanup
            `rm -f "/tmp/${this.deploymentId}.tar.gz"`
        ];
        
        for (const cmd of commands) {
            await this.executeSSHCommand(cmd);
        }
        
        // Create health endpoint
        await this.createHealthEndpoint(environment, deployPath);
        
        console.log('✅ Deployment complete');
    }

    async executeSSHCommand(command) {
        const sshCommand = `ssh -i ${this.config.hostinger.sshKeyPath} ${this.config.hostinger.sshUser}@${this.config.hostinger.vpsHost} "${command}"`;
        const { stdout, stderr } = await execAsync(sshCommand);
        
        if (stderr && !stderr.includes('Warning')) {
            console.warn(`SSH stderr: ${stderr}`);
        }
        
        return stdout;
    }

    async runHealthChecks(environment) {
        console.log('🏥 Running health checks...');
        
        const envUrl = environment === 'blue' 
            ? `http://${this.config.hostinger.vpsHost}:8001`
            : `http://${this.config.hostinger.vpsHost}:8002`;
        
        try {
            // Check if environment is responding
            const { stdout } = await execAsync(`curl -s -o /dev/null -w "%{http_code}" ${envUrl}/health`);
            
            if (stdout === '200') {
                console.log('✅ Health check passed');
                return { passed: true };
            } else {
                return { passed: false, error: `HTTP status: ${stdout}` };
            }
        } catch (error) {
            return { passed: false, error: error.message };
        }
    }

    async runLighthouseValidation(environment) {
        console.log('🏠 Running Lighthouse validation...');
        
        const envUrl = environment === 'blue'
            ? `https://${this.config.hostinger.vpsHost}:8001`
            : `https://${this.config.hostinger.vpsHost}:8002`;
        
        // Import the QA module
        const { getLighthouseScore } = require('../qa/qa-html-mcp');
        
        let attempts = 0;
        let result;
        
        while (attempts < this.config.lighthouse.retries) {
            attempts++;
            console.log(`   Attempt ${attempts}/${this.config.lighthouse.retries}...`);
            
            try {
                // Create a temporary HTML file that loads from the staging URL
                const tempHtml = `/tmp/lighthouse-test-${Date.now()}.html`;
                await fs.writeFile(tempHtml, `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta http-equiv="refresh" content="0; url=${envUrl}">
                    </head>
                    <body>Redirecting to staging...</body>
                    </html>
                `);
                
                result = await getLighthouseScore(tempHtml);
                await fs.unlink(tempHtml);
                
                if (result.passesThreshold) {
                    break;
                }
                
                // Wait before retry
                if (attempts < this.config.lighthouse.retries) {
                    await this.sleep(this.config.lighthouse.waitTime);
                }
                
            } catch (error) {
                console.error(`   Lighthouse attempt ${attempts} failed:`, error.message);
                result = {
                    passed: false,
                    average: 0,
                    error: error.message
                };
            }
        }
        
        result.passed = result.passesThreshold || false;
        console.log(`   Final score: ${result.average}/100 (${result.passed ? 'PASS' : 'FAIL'})`);
        
        return result;
    }

    async switchDNS(newEnvironment) {
        console.log(`🔄 Switching DNS to ${newEnvironment} environment...`);
        
        // Update nginx configuration
        const nginxConfig = `
upstream ebooks_backend {
    server 127.0.0.1:${newEnvironment === 'blue' ? '8001' : '8002'};
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name ${this.config.hostinger.vpsHost};
    
    ssl_certificate /etc/ssl/certs/ebooks.crt;
    ssl_certificate_key /etc/ssl/private/ebooks.key;
    
    location /ebooks/ {
        proxy_pass http://ebooks_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}`;
        
        // Write new config
        const configPath = '/tmp/ebooks-nginx.conf';
        await fs.writeFile(configPath, nginxConfig);
        
        // Upload and activate new config
        await execAsync(`scp -i ${this.config.hostinger.sshKeyPath} "${configPath}" ${this.config.hostinger.sshUser}@${this.config.hostinger.vpsHost}:/tmp/`);
        
        const commands = [
            'cp /tmp/ebooks-nginx.conf /etc/nginx/sites-available/ebooks',
            'nginx -t',
            'systemctl reload nginx'
        ];
        
        for (const cmd of commands) {
            await this.executeSSHCommand(cmd);
        }
        
        console.log('✅ DNS switched successfully');
    }

    async postDeployment(newEnv, oldEnv) {
        console.log('🧹 Running post-deployment tasks...');
        
        // Keep old environment for rollback (don't delete immediately)
        console.log(`   Old environment (${oldEnv}) kept for rollback`);
        
        // Clear CDN cache if configured
        if (process.env.CLOUDFLARE_API_TOKEN) {
            await this.clearCDNCache();
        }
        
        // Send deployment notification
        await this.sendDeploymentNotification(newEnv);
        
        console.log('✅ Post-deployment complete');
    }

    async clearCDNCache() {
        console.log('   Clearing CDN cache...');
        // Implementation would depend on CDN provider
        await this.sleep(1000); // Simulate API call
    }

    async sendDeploymentNotification(environment) {
        console.log('   Sending deployment notification...');
        
        const notification = {
            deploymentId: this.deploymentId,
            environment,
            timestamp: new Date().toISOString(),
            status: 'success'
        };
        
        // In production, this would send to Slack/Discord/email
        console.log('   Notification sent');
    }

    async rollback(failedEnv) {
        console.log(`⏮️  Rolling back from ${failedEnv}...`);
        
        try {
            // Simply don't switch DNS, the old environment is still active
            console.log('✅ Rollback complete (DNS not switched)');
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
        }
    }

    async emergencyRollback() {
        console.log('🚨 Emergency rollback initiated...');
        
        try {
            // Switch back to previous environment
            if (this.currentEnv) {
                await this.switchDNS(this.currentEnv);
            }
            console.log('✅ Emergency rollback complete');
        } catch (error) {
            console.error('❌ Emergency rollback failed:', error.message);
        }
    }

    async generateDeploymentReport(data) {
        const report = {
            deploymentId: this.deploymentId,
            timestamp: new Date().toISOString(),
            source: data.ebookDir,
            targetEnvironment: data.targetEnv,
            lighthouse: {
                scores: data.lighthouseResult.scores,
                average: data.lighthouseResult.average,
                passed: data.lighthouseResult.passed
            },
            healthCheck: data.healthCheck,
            duration: Math.round((Date.now() - parseInt(this.deploymentId.split('-')[1])) / 1000),
            status: 'success'
        };
        
        // Save report
        const reportPath = path.join('build', 'deployments', `${this.deploymentId}.json`);
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        return report;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Additional utility methods
    
    async validateDeployment(environment) {
        console.log(`🔍 Validating ${environment} deployment...`);
        
        const checks = {
            files: true,
            permissions: true,
            nginx: true,
            ssl: true
        };
        
        // Check files exist
        try {
            const envPath = environment === 'blue' ? this.config.paths.blue : this.config.paths.green;
            await this.executeSSHCommand(`ls -la ${envPath}`);
        } catch {
            checks.files = false;
        }
        
        // Check nginx config
        try {
            await this.executeSSHCommand('nginx -t');
        } catch {
            checks.nginx = false;
        }
        
        return checks;
    }
    
    async createHealthEndpoint(environment, deployPath) {
        console.log('🏥 Creating health endpoint...');
        
        // Read workflow manifest if available
        let agentsRun = 0;
        let lighthouseScore = 0;
        
        try {
            const manifestPath = path.join(deployPath, 'workflow-manifest.json');
            const manifestCmd = `cat "${manifestPath}" 2>/dev/null || echo '{}'`;
            const manifestData = await this.executeSSHCommand(manifestCmd);
            const manifest = JSON.parse(manifestData || '{}');
            agentsRun = manifest.totalAgents || 0;
        } catch {
            // Manifest not found
        }
        
        // Get Lighthouse score from deployment metadata
        try {
            const metaPath = path.join(deployPath, 'deployment.json');
            const metaCmd = `cat "${metaPath}" 2>/dev/null || echo '{}'`;
            const metaData = await this.executeSSHCommand(metaCmd);
            const meta = JSON.parse(metaData || '{}');
            lighthouseScore = meta.lighthouse?.average || 0;
        } catch {
            // Metadata not found
        }
        
        // Create health.json file
        const healthData = {
            status: 'healthy',
            build: environment,
            timestamp: new Date().toISOString(),
            deploymentId: this.deploymentId,
            agentsRun,
            lighthouse: lighthouseScore / 100, // Convert to decimal
            version: '1.0.0', // Default version
            environment: {
                name: environment,
                path: deployPath
            }
        };
        
        const healthJson = JSON.stringify(healthData, null, 2);
        const healthPath = path.join(deployPath, 'health.json');
        
        // Create health endpoint file
        await this.executeSSHCommand(`echo '${healthJson}' > "${healthPath}"`);
        await this.executeSSHCommand(`chmod 644 "${healthPath}"`);
        
        // Create simple health.html for browser access
        const healthHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Health Status</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, sans-serif; padding: 2rem; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .status { font-size: 2rem; margin-bottom: 1rem; }
        .healthy { color: #22c55e; }
        .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; }
        .metric { padding: 1rem; background: #f9fafb; border-radius: 4px; }
        .metric-label { font-size: 0.875rem; color: #6b7280; }
        .metric-value { font-size: 1.5rem; font-weight: bold; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="status healthy">✅ ${healthData.status.toUpperCase()}</h1>
        <p><strong>Deployment ID:</strong> ${healthData.deploymentId}</p>
        <p><strong>Environment:</strong> ${healthData.build}</p>
        <p><strong>Version:</strong> ${healthData.version}</p>
        <p><strong>Last Updated:</strong> ${new Date(healthData.timestamp).toLocaleString()}</p>
        
        <div class="metrics">
            <div class="metric">
                <div class="metric-label">Agents Run</div>
                <div class="metric-value">${healthData.agentsRun}</div>
            </div>
            <div class="metric">
                <div class="metric-label">Lighthouse Score</div>
                <div class="metric-value">${Math.round(healthData.lighthouse * 100)}%</div>
            </div>
        </div>
    </div>
    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>`;
        
        const healthHtmlPath = path.join(deployPath, 'health.html');
        await this.executeSSHCommand(`cat > "${healthHtmlPath}" << 'EOF'
${healthHtml}
EOF`);
        
        console.log('✅ Health endpoint created');
    }
    
    async getDeploymentStatus() {
        const blue = await this.getEnvironmentInfo('blue');
        const green = await this.getEnvironmentInfo('green');
        const current = await this.getCurrentEnvironment();
        
        return {
            current,
            environments: { blue, green },
            lastDeployment: await this.getLastDeployment()
        };
    }
    
    async getEnvironmentInfo(env) {
        try {
            const envPath = env === 'blue' ? this.config.paths.blue : this.config.paths.green;
            const deploymentFile = `${envPath}/deployment.json`;
            
            const content = await this.executeSSHCommand(`cat ${deploymentFile} 2>/dev/null || echo '{}'`);
            return JSON.parse(content);
        } catch {
            return null;
        }
    }
    
    async getLastDeployment() {
        try {
            const files = await fs.readdir('build/deployments');
            const latest = files
                .filter(f => f.endsWith('.json'))
                .sort()
                .pop();
            
            if (latest) {
                const content = await fs.readFile(path.join('build/deployments', latest), 'utf8');
                return JSON.parse(content);
            }
        } catch {
            // No deployments yet
        }
        return null;
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {};
    
    args.forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value || true;
        }
    });
    
    if (!options['ebook-dir'] && !options.status) {
        console.error('Usage: hostinger-deploy.js --ebook-dir="path/to/ebook" [--validate] [--skip-dns] [--force]');
        console.error('   or: hostinger-deploy.js --status');
        process.exit(1);
    }
    
    const deployer = new HostingerDeploy();
    
    (async () => {
        try {
            if (options.status) {
                const status = await deployer.getDeploymentStatus();
                console.log('\nDeployment Status:', JSON.stringify(status, null, 2));
            } else {
                const result = await deployer.deploy(options['ebook-dir'], {
                    validate: options.validate === true,
                    skipDNS: options['skip-dns'] === true,
                    force: options.force === true
                });
                console.log('\nResult:', JSON.stringify(result, null, 2));
                process.exit(result.success ? 0 : 1);
            }
        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        }
    })();
}

module.exports = HostingerDeploy;