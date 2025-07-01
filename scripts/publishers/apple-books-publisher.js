#!/usr/bin/env node

/**
 * Apple Books Publisher Integration
 * Uses iTunes Producer for automated publishing
 */

const { exec, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const yaml = require('js-yaml');
const FormData = require('form-data');
const axios = require('axios');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    gray: (text) => `\x1b[90m${text}\x1b[0m`
};

class AppleBooksPublisher {
    constructor(options = {}) {
        this.credentials = options.credentials || {};
        this.metadata = options.metadata || {};
        this.dryRun = options.dryRun || false;
        this.itmspPath = options.itmspPath || null;
        this.producerPath = options.producerPath || '/Applications/iTunes Producer.app/Contents/MacOS/iTMSTransporter';
    }

    async loadMetadata(metadataPath) {
        const content = await fs.readFile(metadataPath, 'utf8');
        this.metadata = yaml.load(content);
        return this.metadata;
    }

    async loadCredentials(credPath) {
        const content = await fs.readFile(credPath, 'utf8');
        this.credentials = JSON.parse(content);
        return this.credentials;
    }

    async checkiTunesProducer() {
        console.log(colors.blue('🔍 Checking iTunes Producer installation...'));
        
        try {
            await fs.access(this.producerPath);
            console.log(colors.green('✅ iTunes Producer found'));
            return true;
        } catch (error) {
            console.error(colors.red('❌ iTunes Producer not found'));
            console.log(colors.yellow('  Download from: https://itunespartner.apple.com/books/tools'));
            return false;
        }
    }

    async createPackage() {
        console.log(colors.blue('📦 Creating ITMSP package...'));
        
        const packageName = `${this.metadata.isbn || 'book'}_${Date.now()}.itmsp`;
        const packagePath = path.join('build', 'apple', packageName);
        
        // Create package directory
        await fs.mkdir(path.dirname(packagePath), { recursive: true });
        await fs.mkdir(packagePath, { recursive: true });
        
        this.itmspPath = packagePath;
        
        // Create metadata.xml
        await this.createMetadataXML(packagePath);
        
        // Copy book files
        await this.copyBookFiles(packagePath);
        
        console.log(colors.green(`✅ Package created: ${packagePath}`));
        return packagePath;
    }

    async createMetadataXML(packagePath) {
        console.log(colors.blue('📝 Creating metadata.xml...'));
        
        const metadata = {
            package: {
                $: {
                    version: 'book5.2',
                    xmlns: 'http://apple.com/itunes/importer'
                },
                provider: this.credentials.providerId || 'PROVIDER_ID',
                team_id: this.credentials.teamId || 'TEAM_ID',
                book: {
                    vendor_id: this.metadata.apple_id || this.generateVendorId(),
                    id_type: {
                        $: { name: 'ISBN' },
                        _: this.metadata.isbn
                    },
                    metadata: {
                        title: this.metadata.title,
                        subtitle: this.metadata.subtitle,
                        series_name: this.metadata.series?.name,
                        series_sequence: this.metadata.series?.number,
                        description: this.formatDescription(this.metadata.description),
                        publication_date: this.metadata.publication_date || new Date().toISOString().split('T')[0],
                        publisher: this.metadata.publisher,
                        imprint: this.metadata.imprint,
                        
                        contributors: {
                            contributor: this.formatContributors()
                        },
                        
                        subjects: {
                            subject: this.formatSubjects()
                        },
                        
                        language: this.metadata.language || 'en',
                        
                        products: {
                            product: {
                                territory: 'WW', // Worldwide
                                cleared_for_sale: true,
                                price_tier: this.calculatePriceTier(this.metadata.pricing?.us || 9.99),
                                sales_start_date: new Date().toISOString().split('T')[0],
                                physical_list_price: {
                                    currency: 'USD',
                                    _: this.metadata.pricing?.us || 9.99
                                }
                            }
                        },
                        
                        // Book specifications
                        book_spec: {
                            version: '5.2',
                            epub_version: '3.0',
                            cover_art: {
                                file_name: 'cover.jpg',
                                size: await this.getFileSize(this.metadata.cover_image),
                                checksum: await this.calculateChecksum(this.metadata.cover_image)
                            },
                            book_file: {
                                file_name: path.basename(this.metadata.epub_path || 'book.epub'),
                                size: await this.getFileSize(this.metadata.epub_path),
                                checksum: await this.calculateChecksum(this.metadata.epub_path)
                            }
                        }
                    }
                }
            }
        };
        
        const builder = new xml2js.Builder({ 
            xmldec: { version: '1.0', encoding: 'UTF-8' },
            renderOpts: { pretty: true, indent: '  ' }
        });
        
        const xml = builder.buildObject(metadata);
        await fs.writeFile(path.join(packagePath, 'metadata.xml'), xml);
        
        console.log(colors.green('✅ metadata.xml created'));
    }

    formatContributors() {
        const contributors = [];
        
        // Primary author
        contributors.push({
            role: 'author',
            primary: true,
            first_name: this.metadata.author_first || this.metadata.author.split(' ')[0],
            last_name: this.metadata.author_last || this.metadata.author.split(' ').slice(1).join(' '),
            display_name: this.metadata.author
        });
        
        // Additional contributors
        if (this.metadata.contributors) {
            this.metadata.contributors.forEach(contrib => {
                contributors.push({
                    role: contrib.role,
                    primary: false,
                    first_name: contrib.first_name,
                    last_name: contrib.last_name,
                    display_name: contrib.name
                });
            });
        }
        
        return contributors;
    }

    formatSubjects() {
        const subjects = [];
        
        // BISAC categories
        if (this.metadata.bisac_codes) {
            this.metadata.bisac_codes.forEach(code => {
                subjects.push({
                    $: { scheme: 'bisac' },
                    _: code
                });
            });
        }
        
        // Keywords
        if (this.metadata.keywords) {
            this.metadata.keywords.forEach(keyword => {
                subjects.push({
                    $: { scheme: 'keyword' },
                    _: keyword
                });
            });
        }
        
        return subjects;
    }

    formatDescription(description) {
        // Apple Books supports basic HTML in descriptions
        return `<![CDATA[${description}]]>`;
    }

    calculatePriceTier(price) {
        // Apple uses price tiers
        // This is a simplified mapping
        const tiers = {
            0: 0,
            0.99: 1,
            1.99: 2,
            2.99: 3,
            3.99: 4,
            4.99: 5,
            5.99: 6,
            6.99: 7,
            7.99: 8,
            8.99: 9,
            9.99: 10,
            10.99: 11,
            11.99: 12,
            12.99: 13,
            13.99: 14,
            14.99: 15
        };
        
        // Find closest tier
        let closestTier = 0;
        let minDiff = Infinity;
        
        for (const [tierPrice, tier] of Object.entries(tiers)) {
            const diff = Math.abs(parseFloat(tierPrice) - price);
            if (diff < minDiff) {
                minDiff = diff;
                closestTier = tier;
            }
        }
        
        return closestTier;
    }

    generateVendorId() {
        // Generate a unique vendor ID if not provided
        return `BOOK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async getFileSize(filePath) {
        const stats = await fs.stat(filePath);
        return stats.size;
    }

    async calculateChecksum(filePath) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        const stream = require('fs').createReadStream(filePath);
        
        return new Promise((resolve, reject) => {
            stream.on('data', data => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    async copyBookFiles(packagePath) {
        console.log(colors.blue('📁 Copying book files...'));
        
        // Copy EPUB
        if (this.metadata.epub_path) {
            const epubDest = path.join(packagePath, path.basename(this.metadata.epub_path));
            await fs.copyFile(this.metadata.epub_path, epubDest);
            console.log(colors.gray(`  Copied: ${path.basename(this.metadata.epub_path)}`));
        }
        
        // Copy cover
        if (this.metadata.cover_image) {
            const coverDest = path.join(packagePath, 'cover.jpg');
            await fs.copyFile(this.metadata.cover_image, coverDest);
            console.log(colors.gray('  Copied: cover.jpg'));
        }
        
        console.log(colors.green('✅ Files copied'));
    }

    async validatePackage() {
        console.log(colors.blue('🔍 Validating package...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would validate package'));
            return true;
        }
        
        return new Promise((resolve, reject) => {
            const args = [
                '-m', 'verify',
                '-f', this.itmspPath,
                '-u', this.credentials.username,
                '-p', this.credentials.password,
                '-v', 'detailed'
            ];
            
            const process = spawn(this.producerPath, args);
            let output = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
                process.stdout.write(data);
            });
            
            process.stderr.on('data', (data) => {
                output += data.toString();
                process.stderr.write(data);
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    console.log(colors.green('✅ Package validated successfully'));
                    resolve(true);
                } else {
                    console.error(colors.red('❌ Validation failed'));
                    reject(new Error(`Validation failed with code ${code}`));
                }
            });
        });
    }

    async uploadPackage() {
        console.log(colors.blue('🚀 Uploading to Apple Books...'));
        
        if (this.dryRun) {
            console.log(colors.yellow('  [DRY RUN] Would upload package'));
            console.log(colors.green('\n✅ Dry run completed successfully!'));
            return { success: true, dryRun: true };
        }
        
        return new Promise((resolve, reject) => {
            const args = [
                '-m', 'upload',
                '-f', this.itmspPath,
                '-u', this.credentials.username,
                '-p', this.credentials.password,
                '-v', 'detailed',
                '-o', path.join('build', 'apple', 'upload.log')
            ];
            
            const process = spawn(this.producerPath, args);
            let output = '';
            
            process.stdout.on('data', (data) => {
                output += data.toString();
                process.stdout.write(data);
            });
            
            process.stderr.on('data', (data) => {
                output += data.toString();
                process.stderr.write(data);
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    console.log(colors.green('\n🎉 Book uploaded successfully!'));
                    
                    // Extract Apple ID from output
                    const appleIdMatch = output.match(/Apple ID: (\d+)/);
                    const appleId = appleIdMatch ? appleIdMatch[1] : null;
                    
                    resolve({ 
                        success: true, 
                        appleId,
                        message: 'Book will be reviewed by Apple within 24-48 hours'
                    });
                } else {
                    console.error(colors.red('❌ Upload failed'));
                    reject(new Error(`Upload failed with code ${code}`));
                }
            });
        });
    }

    async publishBook(options = {}) {
        try {
            // Check iTunes Producer
            const hasProducer = await this.checkiTunesProducer();
            if (!hasProducer && !this.dryRun) {
                throw new Error('iTunes Producer is required for publishing');
            }
            
            // Update metadata with file paths
            this.metadata.epub_path = options.epubPath || this.metadata.epub_path;
            this.metadata.cover_image = options.coverPath || this.metadata.cover_image;
            
            // Create package
            await this.createPackage();
            
            // Validate
            if (!options.skipValidation) {
                await this.validatePackage();
            }
            
            // Upload
            const result = await this.uploadPackage();
            
            return result;
        } catch (error) {
            console.error(colors.red('❌ Publishing failed:'), error.message);
            throw error;
        }
    }

    // Utility methods
    async checkStatus(appleId) {
        console.log(colors.blue(`🔍 Checking status for Apple ID ${appleId}...`));
        // Implementation for status checking
    }

    async updateMetadata(appleId, updates) {
        console.log(colors.blue(`📝 Updating metadata for Apple ID ${appleId}...`));
        // Implementation for metadata updates
    }

    async getSalesReport(options = {}) {
        console.log(colors.blue('📊 Downloading sales report...'));
        // Implementation for sales reporting
    }
}

module.exports = AppleBooksPublisher;

// CLI usage
if (require.main === module) {
    const yargs = require('yargs/yargs');
    const { hideBin } = require('yargs/helpers');
    
    const argv = yargs(hideBin(process.argv))
        .option('metadata', {
            alias: 'm',
            description: 'Path to metadata.yaml',
            type: 'string',
            default: 'metadata.yaml'
        })
        .option('epub', {
            alias: 'e',
            description: 'Path to EPUB file',
            type: 'string',
            default: 'build/dist/book.epub'
        })
        .option('cover', {
            alias: 'c',
            description: 'Path to cover image',
            type: 'string',
            default: 'assets/images/cover.jpg'
        })
        .option('credentials', {
            description: 'Path to Apple credentials',
            type: 'string',
            default: 'config/apple-credentials.json'
        })
        .option('dry-run', {
            alias: 'd',
            description: 'Perform a dry run without uploading',
            type: 'boolean',
            default: false
        })
        .option('skip-validation', {
            description: 'Skip package validation',
            type: 'boolean',
            default: false
        })
        .help()
        .argv;
    
    (async () => {
        const publisher = new AppleBooksPublisher({
            dryRun: argv.dryRun
        });
        
        try {
            // Load metadata
            await publisher.loadMetadata(argv.metadata);
            
            // Load credentials (if not dry run)
            if (!argv.dryRun) {
                await publisher.loadCredentials(argv.credentials);
            }
            
            // Publish
            const result = await publisher.publishBook({
                epubPath: argv.epub,
                coverPath: argv.cover,
                skipValidation: argv.skipValidation
            });
            
            if (result.success) {
                console.log(colors.green('\n✅ Publishing completed successfully!'));
                if (result.appleId) {
                    console.log(colors.blue(`   Apple ID: ${result.appleId}`));
                }
                if (result.message) {
                    console.log(colors.yellow(`   ${result.message}`));
                }
            }
        } catch (error) {
            console.error(colors.red('\n❌ Publishing failed:'), error.message);
            process.exit(1);
        }
    })();
}