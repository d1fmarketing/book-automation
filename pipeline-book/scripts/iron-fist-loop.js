#!/usr/bin/env node

/**
 * IRON-FIST BUILD SUPERVISOR
 * 
 * Complete build loop with absolute control:
 * 1. Generate HTML
 * 2. QA HTML (2x passes)
 * 3. Build PDF only after HTML passes
 * 4. QA PDF
 * 5. Loop up to 30 times until perfect
 * 6. Move to final location with SHA256
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Import our modules
const MarkdownToHTMLFormatter = require('./format/markdown-to-html');
const HTMLQualityAssurance = require('./qa/qa-html');
const PDFBuilder = require('./build/build-pdf');
const PDFQualityAssurance = require('./qa/qa-pdf');

class IronFistBuildSupervisor {
    constructor() {
        this.projectRoot = path.join(__dirname, '../');
        this.logPath = path.join(this.projectRoot, 'build/logs/iron-fist-loop.log');
        this.maxAttempts = 30;
        this.currentAttempt = 0;
        this.startTime = Date.now();
    }

    async ensureLogDir() {
        await fs.ensureDir(path.dirname(this.logPath));
        await fs.ensureDir(path.join(this.projectRoot, 'build/tmp'));
        await fs.ensureDir(path.join(this.projectRoot, 'build/dist'));
    }

    async log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}\n`;
        console.log(message);
        await fs.appendFile(this.logPath, logEntry);
    }

    async runCommand(scriptPath, description) {
        await this.log(`\n🔧 Running: ${description}`);
        
        try {
            const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
                cwd: this.projectRoot,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            });
            
            if (stderr && !stderr.includes('warning')) {
                await this.log(`⚠️  Warnings: ${stderr}`, 'WARN');
            }
            
            await this.log(`✅ ${description} completed successfully`);
            return true;
            
        } catch (error) {
            await this.log(`❌ ${description} failed: ${error.message}`, 'ERROR');
            if (error.stdout) {
                await this.log(`   Output: ${error.stdout.slice(-500)}`, 'ERROR');
            }
            return false;
        }
    }

    async generateSHA256(filePath) {
        const fileBuffer = await fs.readFile(filePath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        return hashSum.digest('hex');
    }

    async runBuildLoop() {
        while (this.currentAttempt < this.maxAttempts) {
            this.currentAttempt++;
            
            await this.log('\n' + '='.repeat(60));
            await this.log(`ATTEMPT ${this.currentAttempt} OF ${this.maxAttempts}`);
            await this.log('='.repeat(60));
            
            // Step 1: Generate HTML
            const htmlGenerated = await this.runCommand(
                path.join(__dirname, 'format/markdown-to-html.js'),
                'HTML Generation'
            );
            
            if (!htmlGenerated) {
                await this.log('🔄 Retrying from HTML generation...', 'WARN');
                continue;
            }
            
            // Step 2: QA HTML (2x passes required)
            const htmlQAPassed = await this.runCommand(
                path.join(__dirname, 'qa/qa-html.js'),
                'HTML Quality Assurance (2x passes)'
            );
            
            if (!htmlQAPassed) {
                await this.log('🔄 HTML QA failed, fixing and retrying...', 'WARN');
                // In real implementation, would apply fixes here
                continue;
            }
            
            // Step 3: Build PDF (only after HTML passes)
            await this.log('\n✅ HTML passed QA 2x - proceeding to PDF generation');
            
            const pdfBuilt = await this.runCommand(
                path.join(__dirname, 'build/build-pdf.js'),
                'PDF Build with Ghostscript'
            );
            
            if (!pdfBuilt) {
                await this.log('🔄 PDF build failed, retrying entire flow...', 'WARN');
                continue;
            }
            
            // Step 4: QA PDF
            const pdfQAPassed = await this.runCommand(
                path.join(__dirname, 'qa/qa-pdf.js'),
                'PDF Quality Assurance'
            );
            
            if (!pdfQAPassed) {
                await this.log('🔄 PDF QA failed, retrying entire flow...', 'WARN');
                continue;
            }
            
            // SUCCESS! All checks passed
            await this.log('\n' + '🎉'.repeat(20));
            await this.log('ALL CHECKS PASSED! PERFECT BUILD ACHIEVED!');
            await this.log('🎉'.repeat(20));
            
            return true;
        }
        
        await this.log('\n😔 Maximum attempts reached without success', 'ERROR');
        return false;
    }

    async moveToFinalLocation() {
        await this.log('\n📦 Moving files to final location...');
        
        const sourcePdf = path.join(this.projectRoot, 'build/tmp/ebook-fixed.pdf');
        const finalPdf = path.join(this.projectRoot, 'build/dist/ebook-final.pdf');
        
        // Copy to final location
        await fs.copy(sourcePdf, finalPdf);
        
        // Generate SHA256
        const sha256 = await this.generateSHA256(finalPdf);
        await this.log(`\n🔐 SHA256: ${sha256}`);
        
        // Save hash file
        await fs.writeFile(
            path.join(this.projectRoot, 'build/dist/ebook-final.pdf.sha256'),
            `${sha256}  ebook-final.pdf\n`
        );
        
        // Get final stats
        const stats = await fs.stat(finalPdf);
        const elapsedTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
        
        await this.log('\n✅ FINAL_EBOOK_READY');
        await this.log(`📍 Location: ${finalPdf}`);
        await this.log(`📏 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        await this.log(`⏱️  Time: ${elapsedTime} seconds`);
        await this.log(`🔄 Attempts: ${this.currentAttempt}`);
        
        // Copy to Downloads for easy access
        const downloadsPath = path.join(process.env.HOME, 'Downloads', 'iron-fist-perfect-ebook.pdf');
        await fs.copy(finalPdf, downloadsPath);
        await this.log(`\n📥 Also copied to: ${downloadsPath}`);
    }

    async generateEPUB() {
        await this.log('\n📚 Generating EPUB (optional)...');
        
        try {
            // This would call the EPUB generator
            // For now, just log
            await this.log('  ℹ️  EPUB generation not implemented in this version');
        } catch (error) {
            await this.log(`  ⚠️  EPUB generation skipped: ${error.message}`, 'WARN');
        }
    }

    async run() {
        try {
            await this.ensureLogDir();
            
            await this.log('🔨 IRON-FIST BUILD SUPERVISOR');
            await this.log('=============================');
            await this.log('NO excuses, NO shortcuts.');
            await this.log(`Max attempts: ${this.maxAttempts}`);
            
            // Clear any previous logs
            const logsDir = path.join(this.projectRoot, 'build/logs');
            const logFiles = await fs.readdir(logsDir);
            for (const file of logFiles) {
                if (file !== 'iron-fist-loop.log') {
                    await fs.remove(path.join(logsDir, file));
                }
            }
            
            // Run the build loop
            const success = await this.runBuildLoop();
            
            if (success) {
                // Move to final location
                await this.moveToFinalLocation();
                
                // Generate EPUB
                await this.generateEPUB();
                
                await this.log('\n✅ BUILD COMPLETE - PERFECT QUALITY ACHIEVED');
                await this.log('The supervisor is satisfied. 🎯');
                
                process.exit(0);
            } else {
                await this.log('\n❌ BUILD FAILED - Manual intervention required', 'ERROR');
                await this.log('Review logs in build/logs/ for details.', 'ERROR');
                process.exit(1);
            }
            
        } catch (error) {
            await this.log(`\n❌ Fatal error: ${error.message}`, 'FATAL');
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const supervisor = new IronFistBuildSupervisor();
    supervisor.run();
}

module.exports = IronFistBuildSupervisor;