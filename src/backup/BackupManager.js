/**
 * Backup and Recovery Manager
 * 
 * Automated backup system for generated content and system state
 * Supports local and cloud (S3) storage with recovery capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const { getMetricsCollector } = require('../monitoring/MetricsCollector');

class BackupManager {
    constructor(options = {}) {
        this.options = {
            backupDir: path.join('backups'),
            tempDir: path.join('build', 'temp', 'backups'),
            schedule: {
                daily: '0 2 * * *',    // 2 AM daily
                weekly: '0 3 * * 0',   // 3 AM Sunday
                monthly: '0 4 1 * *'   // 4 AM first of month
            },
            retention: {
                daily: 7,              // Keep 7 daily backups
                weekly: 4,             // Keep 4 weekly backups
                monthly: 12            // Keep 12 monthly backups
            },
            compress: true,
            encrypt: false,
            s3: {
                enabled: process.env.S3_BACKUP_ENABLED === 'true',
                bucket: process.env.S3_BACKUP_BUCKET,
                region: process.env.AWS_REGION || 'us-east-1',
                prefix: 'ebook-backups/'
            },
            paths: {
                books: 'build/ebooks',
                state: 'pipeline-state.json',
                config: ['config', 'pipelines', 'context'],
                database: 'build/database'
            },
            ...options
        };
        
        this.metrics = getMetricsCollector();
        this.activeBackups = new Map();
        this.s3Client = null;
        
        if (this.options.s3.enabled) {
            this.initializeS3();
        }
    }

    async initializeS3() {
        try {
            const AWS = require('aws-sdk');
            this.s3Client = new AWS.S3({
                region: this.options.s3.region
            });
            
            // Test connection
            await this.s3Client.headBucket({
                Bucket: this.options.s3.bucket
            }).promise();
            
            console.log('✅ S3 backup enabled');
        } catch (error) {
            console.error('❌ S3 initialization failed:', error.message);
            this.options.s3.enabled = false;
        }
    }

    /**
     * Create a backup
     */
    async createBackup(type = 'manual', options = {}) {
        const backupId = this.generateBackupId(type);
        const startTime = Date.now();
        
        console.log(`💾 Starting ${type} backup: ${backupId}`);
        
        try {
            // Mark backup as active
            this.activeBackups.set(backupId, {
                type,
                startTime,
                status: 'in-progress'
            });
            
            // Create backup metadata
            const metadata = {
                id: backupId,
                type,
                timestamp: new Date().toISOString(),
                version: require('../../package.json').version,
                system: {
                    platform: process.platform,
                    node: process.version,
                    memory: process.memoryUsage(),
                    uptime: process.uptime()
                },
                contents: []
            };
            
            // Create temp directory
            const tempPath = path.join(this.options.tempDir, backupId);
            await fs.mkdir(tempPath, { recursive: true });
            
            // Backup books
            if (!options.exclude?.includes('books')) {
                const booksBackup = await this.backupBooks(tempPath);
                metadata.contents.push(booksBackup);
            }
            
            // Backup state
            if (!options.exclude?.includes('state')) {
                const stateBackup = await this.backupState(tempPath);
                metadata.contents.push(stateBackup);
            }
            
            // Backup config
            if (!options.exclude?.includes('config')) {
                const configBackup = await this.backupConfig(tempPath);
                metadata.contents.push(configBackup);
            }
            
            // Backup database
            if (!options.exclude?.includes('database')) {
                const dbBackup = await this.backupDatabase(tempPath);
                if (dbBackup) metadata.contents.push(dbBackup);
            }
            
            // Write metadata
            await fs.writeFile(
                path.join(tempPath, 'backup-metadata.json'),
                JSON.stringify(metadata, null, 2)
            );
            
            // Create archive
            const archivePath = await this.createArchive(backupId, tempPath);
            
            // Upload to S3 if enabled
            if (this.options.s3.enabled) {
                await this.uploadToS3(backupId, archivePath);
            }
            
            // Clean up temp files
            await this.cleanupTemp(tempPath);
            
            // Update active backup status
            const duration = Date.now() - startTime;
            this.activeBackups.set(backupId, {
                type,
                startTime,
                endTime: Date.now(),
                duration,
                status: 'completed',
                size: (await fs.stat(archivePath)).size,
                path: archivePath
            });
            
            // Record metrics
            this.metrics.recordJob('backup', type, 'completed', duration);
            
            console.log(`✅ Backup completed: ${backupId} (${(duration / 1000).toFixed(1)}s)`);
            
            // Clean old backups
            await this.cleanupOldBackups(type);
            
            return {
                id: backupId,
                type,
                path: archivePath,
                size: (await fs.stat(archivePath)).size,
                duration,
                metadata
            };
            
        } catch (error) {
            console.error(`❌ Backup failed: ${error.message}`);
            
            this.activeBackups.set(backupId, {
                type,
                startTime,
                endTime: Date.now(),
                status: 'failed',
                error: error.message
            });
            
            this.metrics.recordError('backup_failed', type);
            throw error;
        }
    }

    async backupBooks(tempPath) {
        const booksPath = this.options.paths.books;
        const backupPath = path.join(tempPath, 'books');
        
        try {
            await fs.access(booksPath);
            await this.copyDirectory(booksPath, backupPath);
            
            // Count books
            const books = await fs.readdir(backupPath);
            const bookCount = books.filter(b => !b.startsWith('.')).length;
            
            return {
                type: 'books',
                path: 'books',
                count: bookCount,
                size: await this.getDirectorySize(backupPath)
            };
        } catch (error) {
            console.warn('Books directory not found, skipping');
            return null;
        }
    }

    async backupState(tempPath) {
        const statePath = this.options.paths.state;
        const backupPath = path.join(tempPath, 'state');
        
        await fs.mkdir(backupPath, { recursive: true });
        
        // Copy pipeline state
        try {
            await fs.copyFile(statePath, path.join(backupPath, 'pipeline-state.json'));
        } catch (error) {
            console.warn('Pipeline state not found');
        }
        
        // Copy queue states
        const queueStates = await this.exportQueueStates();
        await fs.writeFile(
            path.join(backupPath, 'queue-states.json'),
            JSON.stringify(queueStates, null, 2)
        );
        
        return {
            type: 'state',
            path: 'state',
            files: 2
        };
    }

    async backupConfig(tempPath) {
        const configPaths = this.options.paths.config;
        const backupPath = path.join(tempPath, 'config');
        
        await fs.mkdir(backupPath, { recursive: true });
        
        let fileCount = 0;
        for (const configDir of configPaths) {
            try {
                const destPath = path.join(backupPath, path.basename(configDir));
                await this.copyDirectory(configDir, destPath);
                const files = await this.countFiles(destPath);
                fileCount += files;
            } catch (error) {
                console.warn(`Config directory ${configDir} not found`);
            }
        }
        
        return {
            type: 'config',
            path: 'config',
            files: fileCount
        };
    }

    async backupDatabase(tempPath) {
        const dbPath = this.options.paths.database;
        const backupPath = path.join(tempPath, 'database');
        
        try {
            await fs.access(dbPath);
            await this.copyDirectory(dbPath, backupPath);
            
            return {
                type: 'database',
                path: 'database',
                size: await this.getDirectorySize(backupPath)
            };
        } catch (error) {
            return null;
        }
    }

    async createArchive(backupId, sourcePath) {
        const archivePath = path.join(this.options.backupDir, `${backupId}.tar.gz`);
        
        // Ensure backup directory exists
        await fs.mkdir(this.options.backupDir, { recursive: true });
        
        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(archivePath);
            const archive = archiver('tar', {
                gzip: this.options.compress,
                gzipOptions: { level: 9 }
            });
            
            output.on('close', () => resolve(archivePath));
            archive.on('error', reject);
            
            archive.pipe(output);
            archive.directory(sourcePath, false);
            archive.finalize();
        });
    }

    async uploadToS3(backupId, archivePath) {
        if (!this.s3Client) return;
        
        const key = `${this.options.s3.prefix}${backupId}.tar.gz`;
        const fileStream = require('fs').createReadStream(archivePath);
        
        console.log(`☁️ Uploading to S3: ${key}`);
        
        try {
            await this.s3Client.upload({
                Bucket: this.options.s3.bucket,
                Key: key,
                Body: fileStream,
                ServerSideEncryption: 'AES256',
                StorageClass: 'STANDARD_IA',
                Metadata: {
                    'backup-type': backupId.split('_')[0],
                    'backup-date': new Date().toISOString()
                }
            }).promise();
            
            console.log(`✅ Uploaded to S3: ${key}`);
            
        } catch (error) {
            console.error(`Failed to upload to S3:`, error);
            throw error;
        }
    }

    /**
     * Restore from backup
     */
    async restoreBackup(backupId, options = {}) {
        console.log(`🔄 Starting restore from backup: ${backupId}`);
        
        try {
            let archivePath;
            
            // Check local backup
            const localPath = path.join(this.options.backupDir, `${backupId}.tar.gz`);
            try {
                await fs.access(localPath);
                archivePath = localPath;
            } catch (error) {
                // Try S3
                if (this.options.s3.enabled) {
                    archivePath = await this.downloadFromS3(backupId);
                } else {
                    throw new Error('Backup not found');
                }
            }
            
            // Extract archive
            const tempPath = path.join(this.options.tempDir, `restore-${backupId}`);
            await this.extractArchive(archivePath, tempPath);
            
            // Read metadata
            const metadata = JSON.parse(
                await fs.readFile(path.join(tempPath, 'backup-metadata.json'), 'utf8')
            );
            
            // Restore components
            const results = {
                books: false,
                state: false,
                config: false,
                database: false
            };
            
            if (!options.exclude?.includes('books') && metadata.contents.find(c => c.type === 'books')) {
                await this.restoreBooks(tempPath);
                results.books = true;
            }
            
            if (!options.exclude?.includes('state') && metadata.contents.find(c => c.type === 'state')) {
                await this.restoreState(tempPath);
                results.state = true;
            }
            
            if (!options.exclude?.includes('config') && metadata.contents.find(c => c.type === 'config')) {
                await this.restoreConfig(tempPath);
                results.config = true;
            }
            
            if (!options.exclude?.includes('database') && metadata.contents.find(c => c.type === 'database')) {
                await this.restoreDatabase(tempPath);
                results.database = true;
            }
            
            // Clean up
            await this.cleanupTemp(tempPath);
            
            console.log(`✅ Restore completed from backup: ${backupId}`);
            
            return {
                backupId,
                metadata,
                restored: results
            };
            
        } catch (error) {
            console.error(`❌ Restore failed:`, error);
            this.metrics.recordError('restore_failed', 'backup');
            throw error;
        }
    }

    async restoreBooks(tempPath) {
        const sourcePath = path.join(tempPath, 'books');
        const destPath = this.options.paths.books;
        
        // Backup current books
        const backupPath = `${destPath}.backup-${Date.now()}`;
        try {
            await fs.rename(destPath, backupPath);
        } catch (error) {
            // Directory doesn't exist
        }
        
        // Restore
        await this.copyDirectory(sourcePath, destPath);
        console.log(`✅ Restored books to ${destPath}`);
    }

    async restoreState(tempPath) {
        const sourcePath = path.join(tempPath, 'state');
        
        // Restore pipeline state
        try {
            await fs.copyFile(
                path.join(sourcePath, 'pipeline-state.json'),
                this.options.paths.state
            );
            console.log(`✅ Restored pipeline state`);
        } catch (error) {
            console.warn('Pipeline state not found in backup');
        }
    }

    async restoreConfig(tempPath) {
        const sourcePath = path.join(tempPath, 'config');
        
        // Restore each config directory
        const dirs = await fs.readdir(sourcePath);
        for (const dir of dirs) {
            const srcDir = path.join(sourcePath, dir);
            const destDir = path.join('.', dir);
            
            // Backup current config
            const backupPath = `${destDir}.backup-${Date.now()}`;
            try {
                await fs.rename(destDir, backupPath);
            } catch (error) {
                // Directory doesn't exist
            }
            
            await this.copyDirectory(srcDir, destDir);
            console.log(`✅ Restored config: ${dir}`);
        }
    }

    async restoreDatabase(tempPath) {
        const sourcePath = path.join(tempPath, 'database');
        const destPath = this.options.paths.database;
        
        // Backup current database
        const backupPath = `${destPath}.backup-${Date.now()}`;
        try {
            await fs.rename(destPath, backupPath);
        } catch (error) {
            // Directory doesn't exist
        }
        
        // Restore
        await this.copyDirectory(sourcePath, destPath);
        console.log(`✅ Restored database`);
    }

    /**
     * List available backups
     */
    async listBackups(options = {}) {
        const backups = [];
        
        // List local backups
        try {
            const files = await fs.readdir(this.options.backupDir);
            for (const file of files) {
                if (file.endsWith('.tar.gz')) {
                    const stats = await fs.stat(path.join(this.options.backupDir, file));
                    const [type, timestamp] = file.replace('.tar.gz', '').split('_');
                    
                    backups.push({
                        id: file.replace('.tar.gz', ''),
                        type,
                        timestamp: timestamp ? parseInt(timestamp) : stats.mtimeMs,
                        size: stats.size,
                        location: 'local',
                        path: path.join(this.options.backupDir, file)
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to list local backups:', error.message);
        }
        
        // List S3 backups
        if (this.options.s3.enabled && options.includeS3) {
            try {
                const s3Backups = await this.listS3Backups();
                backups.push(...s3Backups);
            } catch (error) {
                console.warn('Failed to list S3 backups:', error.message);
            }
        }
        
        // Sort by timestamp
        backups.sort((a, b) => b.timestamp - a.timestamp);
        
        // Filter by type if specified
        if (options.type) {
            return backups.filter(b => b.type === options.type);
        }
        
        return backups;
    }

    async listS3Backups() {
        if (!this.s3Client) return [];
        
        const params = {
            Bucket: this.options.s3.bucket,
            Prefix: this.options.s3.prefix
        };
        
        const response = await this.s3Client.listObjectsV2(params).promise();
        
        return response.Contents.map(obj => {
            const filename = path.basename(obj.Key);
            const [type, timestamp] = filename.replace('.tar.gz', '').split('_');
            
            return {
                id: filename.replace('.tar.gz', ''),
                type,
                timestamp: timestamp ? parseInt(timestamp) : new Date(obj.LastModified).getTime(),
                size: obj.Size,
                location: 's3',
                key: obj.Key
            };
        });
    }

    async downloadFromS3(backupId) {
        const key = `${this.options.s3.prefix}${backupId}.tar.gz`;
        const localPath = path.join(this.options.tempDir, `${backupId}.tar.gz`);
        
        await fs.mkdir(this.options.tempDir, { recursive: true });
        
        console.log(`⬇️ Downloading from S3: ${key}`);
        
        const params = {
            Bucket: this.options.s3.bucket,
            Key: key
        };
        
        const stream = this.s3Client.getObject(params).createReadStream();
        const fileStream = require('fs').createWriteStream(localPath);
        
        await pipeline(stream, fileStream);
        
        return localPath;
    }

    async extractArchive(archivePath, destPath) {
        await fs.mkdir(destPath, { recursive: true });
        
        const tar = require('tar');
        await tar.extract({
            file: archivePath,
            cwd: destPath,
            gzip: this.options.compress
        });
    }

    async cleanupOldBackups(type) {
        const retention = this.options.retention[type] || 7;
        const backups = await this.listBackups({ type });
        
        // Keep only the most recent backups
        const toDelete = backups.slice(retention);
        
        for (const backup of toDelete) {
            try {
                if (backup.location === 'local') {
                    await fs.unlink(backup.path);
                    console.log(`🗑️ Deleted old backup: ${backup.id}`);
                } else if (backup.location === 's3' && this.s3Client) {
                    await this.s3Client.deleteObject({
                        Bucket: this.options.s3.bucket,
                        Key: backup.key
                    }).promise();
                    console.log(`🗑️ Deleted old S3 backup: ${backup.id}`);
                }
            } catch (error) {
                console.error(`Failed to delete backup ${backup.id}:`, error.message);
            }
        }
    }

    // Utility methods

    generateBackupId(type) {
        const timestamp = Date.now();
        return `${type}_${timestamp}`;
    }

    async copyDirectory(src, dest) {
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

    async getDirectorySize(dirPath) {
        let size = 0;
        
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                size += await this.getDirectorySize(fullPath);
            } else {
                const stats = await fs.stat(fullPath);
                size += stats.size;
            }
        }
        
        return size;
    }

    async countFiles(dirPath) {
        let count = 0;
        
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                count += await this.countFiles(path.join(dirPath, entry.name));
            } else {
                count++;
            }
        }
        
        return count;
    }

    async cleanupTemp(tempPath) {
        try {
            await fs.rm(tempPath, { recursive: true, force: true });
        } catch (error) {
            console.warn('Failed to cleanup temp directory:', error.message);
        }
    }

    async exportQueueStates() {
        // This would export current queue states
        // For now, return mock data
        return {
            pipeline: { waiting: 0, active: 0, completed: 0, failed: 0 },
            research: { waiting: 0, active: 0, completed: 0, failed: 0 },
            writer: { waiting: 0, active: 0, completed: 0, failed: 0 },
            formatter: { waiting: 0, active: 0, completed: 0, failed: 0 },
            qa: { waiting: 0, active: 0, completed: 0, failed: 0 }
        };
    }
}

// Singleton instance
let instance;

function getBackupManager(options) {
    if (!instance) {
        instance = new BackupManager(options);
    }
    return instance;
}

module.exports = {
    BackupManager,
    getBackupManager
};