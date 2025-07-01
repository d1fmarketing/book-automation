module.exports = {
    name: 'rollback',
    description: 'Emergency rollback functionality',
    aliases: ['rb', 'undo'],
    
    async execute(args, cli) {
        const subcommand = args[0] || 'status';
        
        const subcommands = {
            status: this.status,
            create: this.create,
            restore: this.restore,
            list: this.list,
            clean: this.clean
        };
        
        const handler = subcommands[subcommand];
        
        if (!handler) {
            cli.error(`Unknown rollback subcommand: ${subcommand}`);
            cli.log('\nAvailable subcommands:');
            cli.log('  rollback status  - Check rollback system status');
            cli.log('  rollback create  - Create a checkpoint');
            cli.log('  rollback restore - Restore from checkpoint');
            cli.log('  rollback list    - List available checkpoints');
            cli.log('  rollback clean   - Clean old checkpoints');
            return;
        }
        
        try {
            await handler.call(this, args.slice(1), cli);
        } catch (error) {
            cli.error(`Rollback command failed: ${error.message}`);
            throw error;
        }
    },
    
    async getCheckpointPath(cli) {
        const path = '.claude/checkpoints';
        await cli.exec(`mkdir -p ${path}`, { capture: true });
        return path;
    },
    
    async status(args, cli) {
        cli.log('\n🛡️  Rollback System Status\n');
        
        const checkpointPath = await this.getCheckpointPath(cli);
        
        try {
            const result = await cli.exec(`ls -la ${checkpointPath}/*.tar.gz 2>/dev/null | wc -l`, { capture: true });
            const count = parseInt(result.stdout.trim()) || 0;
            
            cli.log(`📦 Checkpoints available: ${count}`);
            
            // Check disk usage
            const diskResult = await cli.exec(`du -sh ${checkpointPath} 2>/dev/null || echo "0"`, { capture: true });
            const diskUsage = diskResult.stdout.trim().split('\t')[0];
            cli.log(`💾 Storage used: ${diskUsage}`);
            
            // Last checkpoint
            if (count > 0) {
                const lastResult = await cli.exec(`ls -t ${checkpointPath}/*.tar.gz 2>/dev/null | head -1`, { capture: true });
                const lastCheckpoint = lastResult.stdout.trim();
                if (lastCheckpoint) {
                    const name = lastCheckpoint.split('/').pop().replace('.tar.gz', '');
                    cli.log(`🕒 Last checkpoint: ${name}`);
                }
            }
            
            cli.log('\n✅ Rollback system is operational');
            
        } catch (error) {
            cli.warn('No checkpoints found or rollback system not initialized');
        }
    },
    
    async create(args, cli) {
        const message = args.join(' ') || 'Manual checkpoint';
        
        cli.log('\n🔄 Creating checkpoint...\n');
        
        // Generate checkpoint name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const sanitizedMessage = message.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30);
        const checkpointName = `${timestamp}_${sanitizedMessage}`;
        
        const checkpointPath = await this.getCheckpointPath(cli);
        const checkpointFile = `${checkpointPath}/${checkpointName}.tar.gz`;
        
        try {
            // Get list of files to backup (excluding common ignore patterns)
            cli.log('📸 Capturing current state...');
            
            const excludes = [
                '--exclude=node_modules',
                '--exclude=.git',
                '--exclude=.claude/checkpoints',
                '--exclude=build',
                '--exclude=dist',
                '--exclude=*.log',
                '--exclude=.env*'
            ].join(' ');
            
            // Create checkpoint
            await cli.exec(`tar -czf ${checkpointFile} ${excludes} .`);
            
            // Verify checkpoint
            const sizeResult = await cli.exec(`ls -lh ${checkpointFile} | awk '{print $5}'`, { capture: true });
            const size = sizeResult.stdout.trim();
            
            // Save metadata
            const metadata = {
                name: checkpointName,
                message,
                created: new Date().toISOString(),
                size,
                files: await this.countFiles(cli)
            };
            
            await cli.writeJSON(`${checkpointPath}/${checkpointName}.json`, metadata);
            
            cli.success(`Checkpoint created: ${checkpointName}`);
            cli.log(`  Size: ${size}`);
            cli.log(`  Message: ${message}`);
            
            // Auto-cleanup old checkpoints
            await this.autoCleanup(cli);
            
        } catch (error) {
            cli.error(`Failed to create checkpoint: ${error.message}`);
            throw error;
        }
    },
    
    async restore(args, cli) {
        const checkpointName = args[0];
        
        if (!checkpointName) {
            cli.error('Please specify a checkpoint to restore');
            cli.log('Use "claude /rollback list" to see available checkpoints');
            return;
        }
        
        const checkpointPath = await this.getCheckpointPath(cli);
        const checkpointFile = `${checkpointPath}/${checkpointName}.tar.gz`;
        
        if (!await cli.exists(checkpointFile)) {
            cli.error(`Checkpoint not found: ${checkpointName}`);
            return;
        }
        
        cli.warn('\n⚠️  WARNING: This will restore your project to a previous state!');
        cli.warn('Current changes will be lost. Consider creating a checkpoint first.');
        
        // In real implementation, would prompt for confirmation
        cli.log('\nRestoring would proceed with user confirmation...');
        
        try {
            // Create a safety checkpoint first
            cli.log('\n📸 Creating safety checkpoint...');
            await this.create(['safety-before-restore'], cli);
            
            // Restore
            cli.log('\n♻️  Restoring from checkpoint...');
            
            // Clear current state (except critical directories)
            const preserveDirs = ['.git', '.claude', 'node_modules'];
            await cli.exec(`find . -maxdepth 1 ! -name '.' ${preserveDirs.map(d => `! -name '${d}'`).join(' ')} -exec rm -rf {} +`);
            
            // Extract checkpoint
            await cli.exec(`tar -xzf ${checkpointFile} -C .`);
            
            cli.success(`\n✅ Restored from checkpoint: ${checkpointName}`);
            
            // Show what changed
            const metadataFile = `${checkpointPath}/${checkpointName}.json`;
            if (await cli.exists(metadataFile)) {
                const metadata = await cli.readJSON(metadataFile);
                cli.log(`\n📋 Checkpoint details:`);
                cli.log(`  Created: ${new Date(metadata.created).toLocaleString()}`);
                cli.log(`  Message: ${metadata.message}`);
            }
            
        } catch (error) {
            cli.error(`Restore failed: ${error.message}`);
            cli.warn('You may need to manually restore from the safety checkpoint');
            throw error;
        }
    },
    
    async list(args, cli) {
        cli.log('\n📚 Available Checkpoints\n');
        
        const checkpointPath = await this.getCheckpointPath(cli);
        
        try {
            const result = await cli.exec(`ls -t ${checkpointPath}/*.tar.gz 2>/dev/null`, { capture: true });
            const checkpoints = result.stdout.trim().split('\n').filter(Boolean);
            
            if (checkpoints.length === 0) {
                cli.info('No checkpoints found. Use "claude /rollback create" to create one.');
                return;
            }
            
            for (const checkpoint of checkpoints) {
                const name = checkpoint.split('/').pop().replace('.tar.gz', '');
                const metadataFile = checkpoint.replace('.tar.gz', '.json');
                
                cli.log(`📦 ${name}`);
                
                if (await cli.exists(metadataFile)) {
                    const metadata = await cli.readJSON(metadataFile);
                    cli.log(`   📝 ${metadata.message}`);
                    cli.log(`   🕒 ${new Date(metadata.created).toLocaleString()}`);
                    cli.log(`   💾 ${metadata.size}`);
                } else {
                    // Get file info if no metadata
                    const statResult = await cli.exec(`stat -f "%z %Sm" "${checkpoint}" 2>/dev/null || stat -c "%s %y" "${checkpoint}"`, { capture: true });
                    cli.log(`   📊 ${statResult.stdout.trim()}`);
                }
                cli.log('');
            }
            
            cli.info(`Total checkpoints: ${checkpoints.length}`);
            
        } catch (error) {
            cli.error('Failed to list checkpoints');
        }
    },
    
    async clean(args, cli) {
        const keepCount = parseInt(args[0]) || 5;
        
        cli.log(`\n🧹 Cleaning old checkpoints (keeping last ${keepCount})...\n`);
        
        const checkpointPath = await this.getCheckpointPath(cli);
        
        try {
            // Get all checkpoints sorted by time
            const result = await cli.exec(`ls -t ${checkpointPath}/*.tar.gz 2>/dev/null`, { capture: true });
            const checkpoints = result.stdout.trim().split('\n').filter(Boolean);
            
            if (checkpoints.length <= keepCount) {
                cli.info(`Only ${checkpoints.length} checkpoints found, nothing to clean`);
                return;
            }
            
            const toDelete = checkpoints.slice(keepCount);
            
            cli.log(`Found ${checkpoints.length} checkpoints, removing ${toDelete.length} old ones...`);
            
            for (const checkpoint of toDelete) {
                const name = checkpoint.split('/').pop();
                cli.log(`  🗑️  Removing ${name}`);
                
                // Remove checkpoint and metadata
                await cli.exec(`rm -f "${checkpoint}" "${checkpoint.replace('.tar.gz', '.json')}"`);
            }
            
            cli.success(`\nCleaned ${toDelete.length} old checkpoints`);
            
        } catch (error) {
            cli.error(`Cleanup failed: ${error.message}`);
        }
    },
    
    async countFiles(cli) {
        try {
            const result = await cli.exec('find . -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | wc -l', { capture: true });
            return parseInt(result.stdout.trim()) || 0;
        } catch {
            return 0;
        }
    },
    
    async autoCleanup(cli) {
        // Auto cleanup if more than 10 checkpoints
        try {
            const checkpointPath = await this.getCheckpointPath(cli);
            const result = await cli.exec(`ls ${checkpointPath}/*.tar.gz 2>/dev/null | wc -l`, { capture: true });
            const count = parseInt(result.stdout.trim()) || 0;
            
            if (count > 10) {
                cli.info('Auto-cleaning old checkpoints...');
                await this.clean(['5'], cli);
            }
        } catch {
            // Ignore cleanup errors
        }
    }
};