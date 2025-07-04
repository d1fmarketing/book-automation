#!/usr/bin/env node

/**
 * Backup Manager CLI
 * 
 * Command-line interface for backup and restore operations
 */

const { getBackupManager } = require('../src/backup/BackupManager');
const yargs = require('yargs');
const Table = require('cli-table3');
const chalk = require('chalk');
const inquirer = require('inquirer');

// Initialize backup manager
const backupManager = getBackupManager();

// CLI commands
yargs
    .command('create [type]', 'Create a backup', (yargs) => {
        yargs
            .positional('type', {
                describe: 'Backup type',
                default: 'manual',
                choices: ['manual', 'daily', 'weekly', 'monthly']
            })
            .option('exclude', {
                describe: 'Components to exclude',
                type: 'array',
                choices: ['books', 'state', 'config', 'database']
            })
            .option('s3', {
                describe: 'Upload to S3',
                type: 'boolean',
                default: true
            });
    }, async (argv) => {
        try {
            console.log(chalk.blue('💾 Creating backup...\n'));
            
            const options = {
                exclude: argv.exclude
            };
            
            if (!argv.s3) {
                backupManager.options.s3.enabled = false;
            }
            
            const result = await backupManager.createBackup(argv.type, options);
            
            console.log(chalk.green('\n✅ Backup created successfully!\n'));
            console.log('Backup ID:', chalk.yellow(result.id));
            console.log('Type:', result.type);
            console.log('Size:', formatSize(result.size));
            console.log('Duration:', `${(result.duration / 1000).toFixed(1)}s`);
            console.log('Path:', result.path);
            
            if (result.metadata.contents.length > 0) {
                console.log('\nContents:');
                result.metadata.contents.forEach(content => {
                    if (content) {
                        console.log(`  - ${content.type}: ${content.count || content.files || 'backed up'}`);
                    }
                });
            }
            
        } catch (error) {
            console.error(chalk.red('\n❌ Backup failed:'), error.message);
            process.exit(1);
        }
    })
    .command('restore <backupId>', 'Restore from backup', (yargs) => {
        yargs
            .positional('backupId', {
                describe: 'Backup ID to restore',
                type: 'string'
            })
            .option('exclude', {
                describe: 'Components to exclude from restore',
                type: 'array',
                choices: ['books', 'state', 'config', 'database']
            })
            .option('force', {
                describe: 'Skip confirmation',
                type: 'boolean',
                default: false
            });
    }, async (argv) => {
        try {
            if (!argv.force) {
                const confirm = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'proceed',
                    message: `Are you sure you want to restore from backup ${argv.backupId}? This will overwrite current data.`,
                    default: false
                }]);
                
                if (!confirm.proceed) {
                    console.log(chalk.yellow('\n⚠️  Restore cancelled'));
                    return;
                }
            }
            
            console.log(chalk.blue(`\n🔄 Restoring from backup: ${argv.backupId}...\n`));
            
            const options = {
                exclude: argv.exclude
            };
            
            const result = await backupManager.restoreBackup(argv.backupId, options);
            
            console.log(chalk.green('\n✅ Restore completed successfully!\n'));
            console.log('Backup ID:', chalk.yellow(result.backupId));
            console.log('Backup Date:', new Date(result.metadata.timestamp).toLocaleString());
            console.log('\nRestored components:');
            Object.entries(result.restored).forEach(([component, restored]) => {
                console.log(`  - ${component}: ${restored ? chalk.green('✓') : chalk.gray('skipped')}`);
            });
            
        } catch (error) {
            console.error(chalk.red('\n❌ Restore failed:'), error.message);
            process.exit(1);
        }
    })
    .command('list [type]', 'List available backups', (yargs) => {
        yargs
            .positional('type', {
                describe: 'Filter by backup type',
                choices: ['manual', 'daily', 'weekly', 'monthly']
            })
            .option('s3', {
                describe: 'Include S3 backups',
                type: 'boolean',
                default: true
            })
            .option('limit', {
                describe: 'Number of backups to show',
                type: 'number',
                default: 20
            });
    }, async (argv) => {
        try {
            console.log(chalk.blue('\n📁 Listing backups...\n'));
            
            const options = {
                type: argv.type,
                includeS3: argv.s3
            };
            
            const backups = await backupManager.listBackups(options);
            const limited = backups.slice(0, argv.limit);
            
            if (limited.length === 0) {
                console.log(chalk.yellow('No backups found'));
                return;
            }
            
            // Create table
            const table = new Table({
                head: ['ID', 'Type', 'Date', 'Size', 'Location'],
                style: {
                    head: ['cyan']
                }
            });
            
            limited.forEach(backup => {
                table.push([
                    backup.id,
                    backup.type,
                    new Date(backup.timestamp).toLocaleString(),
                    formatSize(backup.size),
                    backup.location === 's3' ? chalk.blue('S3') : chalk.green('Local')
                ]);
            });
            
            console.log(table.toString());
            
            if (backups.length > argv.limit) {
                console.log(chalk.gray(`\nShowing ${argv.limit} of ${backups.length} backups`));
            }
            
        } catch (error) {
            console.error(chalk.red('\n❌ Failed to list backups:'), error.message);
            process.exit(1);
        }
    })
    .command('delete <backupId>', 'Delete a backup', (yargs) => {
        yargs
            .positional('backupId', {
                describe: 'Backup ID to delete',
                type: 'string'
            })
            .option('force', {
                describe: 'Skip confirmation',
                type: 'boolean',
                default: false
            });
    }, async (argv) => {
        try {
            // Find backup
            const backups = await backupManager.listBackups({ includeS3: true });
            const backup = backups.find(b => b.id === argv.backupId);
            
            if (!backup) {
                console.error(chalk.red(`\n❌ Backup not found: ${argv.backupId}`));
                process.exit(1);
            }
            
            if (!argv.force) {
                const confirm = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'proceed',
                    message: `Are you sure you want to delete backup ${argv.backupId}?`,
                    default: false
                }]);
                
                if (!confirm.proceed) {
                    console.log(chalk.yellow('\n⚠️  Delete cancelled'));
                    return;
                }
            }
            
            // Delete backup
            if (backup.location === 'local') {
                await require('fs').promises.unlink(backup.path);
            } else if (backup.location === 's3' && backupManager.s3Client) {
                await backupManager.s3Client.deleteObject({
                    Bucket: backupManager.options.s3.bucket,
                    Key: backup.key
                }).promise();
            }
            
            console.log(chalk.green(`\n✅ Backup deleted: ${argv.backupId}`));
            
        } catch (error) {
            console.error(chalk.red('\n❌ Delete failed:'), error.message);
            process.exit(1);
        }
    })
    .command('schedule', 'Show backup schedule', () => {}, async () => {
        console.log(chalk.blue('\n📅 Backup Schedule\n'));
        
        const schedule = backupManager.options.schedule;
        const retention = backupManager.options.retention;
        
        const table = new Table({
            head: ['Type', 'Schedule', 'Retention'],
            style: {
                head: ['cyan']
            }
        });
        
        Object.entries(schedule).forEach(([type, cron]) => {
            table.push([
                type.charAt(0).toUpperCase() + type.slice(1),
                cron,
                `${retention[type]} backups`
            ]);
        });
        
        console.log(table.toString());
        
        console.log('\n' + chalk.gray('Cron format: minute hour day month weekday'));
        console.log(chalk.gray('Example: "0 2 * * *" = Every day at 2:00 AM'));
    })
    .help()
    .alias('help', 'h')
    .demandCommand(1, 'You must specify a command')
    .recommendCommands()
    .argv;

// Utility functions

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}