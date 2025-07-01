#!/usr/bin/env node

/**
 * Safe Trash Operations
 * Never delete files directly - always move to timestamped trash
 */

const fs = require('fs').promises;
const path = require('path');

class SafeTrash {
    constructor() {
        this.trashRoot = path.join(process.cwd(), 'trash');
        this.trashConfig = path.join(this.trashRoot, '.trash-config.json');
        this.config = null;
    }

    /**
     * Initialize trash system
     */
    async init() {
        await fs.mkdir(this.trashRoot, { recursive: true });
        await this.loadConfig();
    }

    /**
     * Load or create trash configuration
     */
    async loadConfig() {
        try {
            const configData = await fs.readFile(this.trashConfig, 'utf8');
            this.config = JSON.parse(configData);
        } catch {
            this.config = {
                retention_days: 30,
                auto_clean: true,
                organization: {
                    by_date: true,
                    by_type: true,
                    compress_old: true
                },
                stats: {
                    total_trashed: 0,
                    total_size_mb: 0,
                    last_cleaned: null
                }
            };
            await this.saveConfig();
        }
    }

    /**
     * Save configuration
     */
    async saveConfig() {
        await fs.writeFile(this.trashConfig, JSON.stringify(this.config, null, 2));
    }

    /**
     * Move file or directory to trash
     */
    async trash(sourcePath, reason = 'manual') {
        try {
            // Get absolute path
            const absolutePath = path.resolve(sourcePath);
            
            // Check if source exists
            const stats = await fs.stat(absolutePath);
            
            // Generate trash path
            const trashPath = await this.generateTrashPath(absolutePath, stats.isDirectory());
            
            // Create trash directory structure
            await fs.mkdir(path.dirname(trashPath), { recursive: true });
            
            // Create metadata
            const metadata = {
                original_path: absolutePath,
                trashed_at: new Date().toISOString(),
                reason,
                type: stats.isDirectory() ? 'directory' : 'file',
                size_bytes: stats.size,
                permissions: stats.mode
            };
            
            // Move to trash
            await fs.rename(absolutePath, trashPath);
            
            // Save metadata
            await fs.writeFile(trashPath + '.meta.json', JSON.stringify(metadata, null, 2));
            
            // Update stats
            this.config.stats.total_trashed++;
            this.config.stats.total_size_mb += stats.size / (1024 * 1024);
            await this.saveConfig();
            
            // Log operation
            await this.logTrashOperation(absolutePath, trashPath, reason);
            
            console.log(`✅ Moved to trash: ${path.basename(absolutePath)}`);
            console.log(`   Location: ${trashPath}`);
            
            return { success: true, trashPath, metadata };
            
        } catch (error) {
            console.error(`❌ Failed to trash ${sourcePath}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate trash path with timestamp and organization
     */
    async generateTrashPath(originalPath, isDirectory) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const basename = path.basename(originalPath);
        const ext = path.extname(basename);
        const nameWithoutExt = path.basename(basename, ext);
        
        let trashPath = this.trashRoot;
        
        // Organize by date if enabled
        if (this.config.organization.by_date) {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            trashPath = path.join(trashPath, year.toString(), month, day);
        }
        
        // Organize by type if enabled
        if (this.config.organization.by_type) {
            if (isDirectory) {
                trashPath = path.join(trashPath, 'directories');
            } else {
                const category = this.categorizeFile(ext);
                trashPath = path.join(trashPath, category);
            }
        }
        
        // Generate unique filename
        const trashedName = `${nameWithoutExt}-${timestamp}${ext}`;
        
        return path.join(trashPath, trashedName);
    }

    /**
     * Categorize file by extension
     */
    categorizeFile(ext) {
        const categories = {
            documents: ['.md', '.txt', '.doc', '.docx', '.pdf'],
            images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
            code: ['.js', '.py', '.ts', '.jsx', '.tsx', '.css', '.html'],
            config: ['.json', '.yaml', '.yml', '.toml', '.ini'],
            archives: ['.zip', '.tar', '.gz', '.rar', '.7z']
        };
        
        for (const [category, extensions] of Object.entries(categories)) {
            if (extensions.includes(ext.toLowerCase())) {
                return category;
            }
        }
        
        return 'other';
    }

    /**
     * Restore file from trash
     */
    async restore(trashPath, targetPath = null) {
        try {
            const metaPath = trashPath + '.meta.json';
            const metaData = JSON.parse(await fs.readFile(metaPath, 'utf8'));
            
            // Determine target path
            const restorePath = targetPath || metaData.original_path;
            
            // Check if target exists
            try {
                await fs.access(restorePath);
                console.error(`❌ Target path already exists: ${restorePath}`);
                return { success: false, error: 'Target exists' };
            } catch {
                // Good, target doesn't exist
            }
            
            // Create parent directory
            await fs.mkdir(path.dirname(restorePath), { recursive: true });
            
            // Restore file
            await fs.rename(trashPath, restorePath);
            
            // Remove metadata
            await fs.unlink(metaPath).catch(() => {});
            
            console.log(`✅ Restored: ${path.basename(restorePath)}`);
            
            return { success: true, restoredTo: restorePath };
            
        } catch (error) {
            console.error(`❌ Failed to restore: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * List trash contents
     */
    async list(options = {}) {
        const items = [];
        
        async function scanDir(dir, baseDir) {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    // Skip config and meta files
                    if (entry.name.startsWith('.') || entry.name.endsWith('.meta.json')) {
                        continue;
                    }
                    
                    // Check for metadata
                    const metaPath = fullPath + '.meta.json';
                    let metadata = null;
                    
                    try {
                        metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
                    } catch {
                        // No metadata
                    }
                    
                    items.push({
                        name: entry.name,
                        path: fullPath,
                        relativePath: path.relative(baseDir, fullPath),
                        type: entry.isDirectory() ? 'directory' : 'file',
                        metadata
                    });
                    
                    // Recurse into directories if not organizing by type
                    if (entry.isDirectory() && !options.shallow) {
                        await scanDir(fullPath, baseDir);
                    }
                }
            } catch (error) {
                console.error(`Error scanning ${dir}: ${error.message}`);
            }
        }
        
        await scanDir(this.trashRoot, this.trashRoot);
        
        // Sort by date (newest first)
        items.sort((a, b) => {
            const dateA = a.metadata?.trashed_at || '0';
            const dateB = b.metadata?.trashed_at || '0';
            return dateB.localeCompare(dateA);
        });
        
        return items;
    }

    /**
     * Clean old trash items
     */
    async clean(options = {}) {
        const { dryRun = false, force = false, days = this.config.retention_days } = 
            typeof options === 'boolean' ? { dryRun: options } : options;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const items = await this.list();
        const toDelete = [];
        
        for (const item of items) {
            const trashedDate = item.metadata?.deleted_at || item.metadata?.trashed_at;
            if (trashedDate) {
                const itemDate = new Date(trashedDate);
                if (itemDate < cutoffDate) {
                    toDelete.push(item);
                }
            }
        }
        
        console.log(`Found ${toDelete.length} items older than ${days} days`);
        
        if (!dryRun && toDelete.length > 0) {
            if (!force) {
                // Ask for confirmation
                const readline = require('readline').createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                
                const answer = await new Promise(resolve => {
                    readline.question(`Delete ${toDelete.length} items? (y/N) `, resolve);
                });
                readline.close();
                
                if (answer.toLowerCase() !== 'y') {
                    console.log('Cancelled');
                    return 0;
                }
            }
            
            for (const item of toDelete) {
                try {
                    if (item.type === 'directory') {
                        await this.removeDirectory(item.path);
                    } else {
                        await fs.unlink(item.path);
                    }
                    
                    // Remove metadata
                    await fs.unlink(item.path + '.meta.json').catch(() => {});
                    
                    console.log(`  Deleted: ${item.name}`);
                } catch (error) {
                    console.error(`  Failed to delete ${item.name}: ${error.message}`);
                }
            }
            
            this.config.stats.last_cleaned = new Date().toISOString();
            await this.saveConfig();
        }
        
        return toDelete.length;
    }

    /**
     * Get trash statistics
     */
    async getStats() {
        const items = await this.list();
        
        let totalSize = 0;
        const byType = {};
        const byDate = {};
        
        for (const item of items) {
            // Size
            if (item.metadata?.size_bytes) {
                totalSize += item.metadata.size_bytes;
            }
            
            // By type
            const type = item.type;
            byType[type] = (byType[type] || 0) + 1;
            
            // By date
            if (item.metadata?.trashed_at) {
                const date = item.metadata.trashed_at.split('T')[0];
                byDate[date] = (byDate[date] || 0) + 1;
            }
        }
        
        return {
            total_items: items.length,
            total_size_mb: (totalSize / (1024 * 1024)).toFixed(2),
            by_type: byType,
            by_date: byDate,
            config: this.config
        };
    }

    /**
     * Log trash operation
     */
    async logTrashOperation(source, target, reason) {
        const logDir = path.join(process.cwd(), '.claude', 'logs');
        await fs.mkdir(logDir, { recursive: true });
        
        const logFile = path.join(logDir, 'trash-operations.log');
        const logEntry = `[${new Date().toISOString()}] TRASH ${reason}: ${source} -> ${target}\n`;
        
        await fs.appendFile(logFile, logEntry);
    }

    /**
     * Remove directory recursively
     */
    async removeDirectory(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                await this.removeDirectory(fullPath);
            } else {
                await fs.unlink(fullPath);
            }
        }
        
        await fs.rmdir(dirPath);
    }

    /**
     * Search for items in trash
     */
    async findInTrash(query) {
        const results = [];
        const searchLower = query.toLowerCase();
        
        const searchDir = async (dir, depth = 0) => {
            if (depth > 5) return; // Limit recursion depth
            
            try {
                const items = await fs.readdir(dir, { withFileTypes: true });
                
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    
                    // Skip metadata files
                    if (item.name.endsWith('.meta.json')) {
                        continue;
                    }
                    
                    // First, try to load metadata to check original name
                    const metaPath = fullPath + '.meta.json';
                    let metadata = null;
                    let originalName = null;
                    
                    try {
                        metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
                        originalName = path.basename(metadata.original_path);
                    } catch {
                        // No metadata
                    }
                    
                    // Check if name matches (either current name or original name)
                    const currentNameMatches = item.name.toLowerCase().includes(searchLower);
                    const originalNameMatches = originalName && originalName.toLowerCase().includes(searchLower);
                    
                    if (currentNameMatches || originalNameMatches) {
                        const stats = await fs.stat(fullPath);
                        
                        results.push({
                            path: fullPath,
                            name: item.name,
                            originalName: originalName,
                            type: item.isDirectory() ? 'directory' : 'file',
                            size: stats.size,
                            metadata
                        });
                    }
                    
                    // Recursively search directories
                    if (item.isDirectory() && !item.name.endsWith('.meta')) {
                        await searchDir(fullPath, depth + 1);
                    }
                }
            } catch (error) {
                // Directory might not exist
            }
        };
        
        try {
            await searchDir(this.trashRoot);
        } catch (error) {
            console.error(`Search error: ${error.message}`);
        }
        
        // Sort by date (newest first)
        results.sort((a, b) => {
            const dateA = a.metadata?.trashed_at || 0;
            const dateB = b.metadata?.trashed_at || 0;
            return new Date(dateB) - new Date(dateA);
        });
        
        return results;
    }
    
    /**
     * Get detailed information about a trash item
     */
    async getItemInfo(itemPath) {
        try {
            // Handle relative paths
            let fullPath;
            if (path.isAbsolute(itemPath)) {
                fullPath = itemPath;
            } else if (itemPath.startsWith('trash/')) {
                // Handle paths like trash/2025/07/01/...
                fullPath = path.join(process.cwd(), itemPath);
            } else {
                fullPath = path.join(this.trashDir, itemPath);
            }
            
            const stats = await fs.stat(fullPath);
            const metaPath = fullPath + '.meta.json';
            let metadata = null;
            
            try {
                metadata = JSON.parse(await fs.readFile(metaPath, 'utf8'));
            } catch {
                // No metadata
            }
            
            return {
                path: fullPath,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                metadata
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Format file size
     */
    _formatSize(bytes) {
        if (!bytes || bytes === 0) return '0B';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
    }
    
    /**
     * Create helper functions for common operations
     */
    static createHelpers() {
        return `
# Trash Helper Functions
# Add these to your .bashrc or .zshrc

# Safe delete function
trash() {
    node ${__filename} trash "$@"
}

# List trash contents
trash-list() {
    node ${__filename} list "$@"
}

# Restore from trash
trash-restore() {
    node ${__filename} restore "$@"
}

# Clean old trash
trash-clean() {
    node ${__filename} clean "$@"
}

# Trash statistics
trash-stats() {
    node ${__filename} stats
}

# Find items in trash
trash-find() {
    node ${__filename} find "$@"
}

# Get info about trash item
trash-info() {
    node ${__filename} info "$@"
}

# Alias rm to trash for safety
alias rm='echo "Use trash command instead of rm for safety" #'
        `;
    }
}

// CLI interface
if (require.main === module) {
    const trash = new SafeTrash();
    const command = process.argv[2];
    const args = process.argv.slice(3);

    (async () => {
        await trash.init();

        switch (command) {
            case 'trash':
                if (!args[0]) {
                    console.error('Usage: trash <file/directory> [reason]');
                    process.exit(1);
                }
                await trash.trash(args[0], args[1]);
                break;

            case 'restore':
                if (!args[0]) {
                    console.error('Usage: restore <trash-path> [target-path]');
                    process.exit(1);
                }
                
                // If it's just a filename, search for it
                let fullTrashPath = args[0];
                if (!path.isAbsolute(args[0]) && !args[0].startsWith('trash/')) {
                    const matches = await trash.findInTrash(args[0]);
                    if (matches.length === 0) {
                        console.error(`No items found matching: ${args[0]}`);
                        process.exit(1);
                    } else if (matches.length > 1) {
                        console.error(`Multiple items found. Please be more specific:`);
                        matches.slice(0, 10).forEach(m => console.log(`  - ${m.path}`));
                        if (matches.length > 10) {
                            console.log(`  ... and ${matches.length - 10} more`);
                        }
                        process.exit(1);
                    }
                    fullTrashPath = matches[0].path;
                    console.log(`Found: ${fullTrashPath}`);
                }
                
                await trash.restore(fullTrashPath, args[1]);
                break;

            case 'list':
                const items = await trash.list();
                console.log('\n🗑️  Trash Contents:\n');
                
                for (const item of items) {
                    const date = item.metadata?.deleted_at || item.metadata?.trashed_at;
                    const dateStr = date ? new Date(date).toLocaleString() : 'Unknown';
                    const reason = item.metadata?.reason || 'Unknown';
                    
                    console.log(`📄 ${item.name}`);
                    console.log(`   Path: ${item.relativePath}`);
                    console.log(`   Date: ${dateStr}`);
                    console.log(`   Reason: ${reason}`);
                    console.log('');
                }
                
                console.log(`Total items: ${items.length}`);
                break;

            case 'clean':
                const dryRun = args.includes('--dry-run');
                const force = args.includes('--force');
                const days = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '30');
                
                const count = await trash.clean({ dryRun, force, days });
                
                if (dryRun) {
                    console.log(`\nWould delete ${count} items (dry run)`);
                } else {
                    console.log(`\nCleaned ${count} items`);
                }
                break;
                
            case 'find':
            case 'search':
                const query = args[0];
                if (!query) {
                    console.error('Please provide a search query');
                    process.exit(1);
                }
                
                const results = await trash.findInTrash(query);
                if (results.length === 0) {
                    console.log('No matching items found in trash');
                } else {
                    console.log(`\nFound ${results.length} item(s):\n`);
                    for (const item of results) {
                        console.log(`${item.path}`);
                        console.log(`  Original: ${item.metadata?.original_path || 'Unknown'}`);
                        console.log(`  Deleted: ${item.metadata ? new Date(item.metadata.trashed_at).toLocaleString() : 'Unknown'}`);
                        console.log(`  Reason: ${item.metadata?.reason || 'Unknown'}`);
                        console.log(`  Size: ${trash._formatSize(item.size)}`);
                        console.log();
                    }
                }
                break;
                
            case 'info':
                const itemPath = args[0];
                if (!itemPath) {
                    console.error('Please provide item path');
                    process.exit(1);
                }
                
                const info = await trash.getItemInfo(itemPath);
                if (info) {
                    console.log('\n=== Trash Item Information ===');
                    console.log(`Path: ${info.path}`);
                    console.log(`Type: ${info.type}`);
                    console.log(`Size: ${trash._formatSize(info.size)}`);
                    console.log(`Created: ${info.created.toLocaleString()}`);
                    console.log(`Modified: ${info.modified.toLocaleString()}`);
                    if (info.metadata) {
                        console.log(`\nMetadata:`);
                        console.log(`  Original Path: ${info.metadata.original_path}`);
                        console.log(`  Deleted At: ${new Date(info.metadata.trashed_at).toLocaleString()}`);
                        console.log(`  Deleted By: ${info.metadata.trashed_by || 'N/A'}`);
                        console.log(`  Reason: ${info.metadata.reason}`);
                    }
                } else {
                    console.error('Item not found or not in trash');
                }
                break;

            case 'stats':
                const stats = await trash.getStats();
                console.log('\n📊 Trash Statistics:\n');
                console.log(`Total Items: ${stats.total_items}`);
                console.log(`Total Size: ${stats.total_size_mb} MB`);
                console.log(`Retention: ${stats.config.retention_days} days`);
                console.log(`Auto-clean: ${stats.config.auto_clean ? 'Enabled' : 'Disabled'}`);
                
                if (Object.keys(stats.by_type).length > 0) {
                    console.log('\nBy Type:');
                    for (const [type, count] of Object.entries(stats.by_type)) {
                        console.log(`  ${type}: ${count}`);
                    }
                }
                break;

            case 'helpers':
                console.log(SafeTrash.createHelpers());
                break;

            default:
                console.log(`
Safe Trash - Never lose a file again!

Usage:
  node safe-trash.js <command> [args]

Commands:
  trash <path> [reason]      Move file/directory to trash
  restore <path> [target]    Restore from trash
  list                       List trash contents
  clean [--dry-run]          Clean old items
  stats                      Show trash statistics
  helpers                    Show bash helper functions

Examples:
  node safe-trash.js trash old-file.txt "replaced with new version"
  node safe-trash.js restore trash/2024/01/07/old-file-2024-01-07T10-30-45.txt
  node safe-trash.js clean --dry-run
  node safe-trash.js stats

Safety Features:
  - Never overwrites files
  - Timestamps all deletions
  - Preserves metadata
  - Organized by date/type
  - Configurable retention
  - Full restore capability
                `);
        }
    })().catch(console.error);
}

module.exports = SafeTrash;