#!/usr/bin/env node

/**
 * Watch dashboard console for a specified duration
 * Looking for specific errors like "dimensions"
 */

const puppeteer = require('puppeteer');

const WATCH_DURATION = process.argv[2] ? parseInt(process.argv[2]) * 1000 : 60000; // Default 60 seconds
const DASHBOARD_URL = 'http://localhost:3000';

async function watchConsole() {
    console.log(`👁️  Watching dashboard console for ${WATCH_DURATION/1000} seconds...`);
    console.log(`📍 URL: ${DASHBOARD_URL}`);
    console.log('=' .repeat(60));
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    let errorCount = 0;
    let dimensionsErrorSeen = false;
    const logs = [];
    
    // Capture console logs
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        const timestamp = new Date().toISOString();
        
        logs.push({ timestamp, type, text });
        
        // Check for dimensions error
        if (text.includes('dimensions')) {
            dimensionsErrorSeen = true;
            console.log(`🚨 [${timestamp}] DIMENSIONS ERROR: ${text}`);
        }
        
        // Log errors and warnings
        if (type === 'error' || type === 'warning') {
            errorCount++;
            console.log(`⚠️  [${timestamp}] ${type.toUpperCase()}: ${text}`);
        }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
        errorCount++;
        const timestamp = new Date().toISOString();
        console.log(`❌ [${timestamp}] PAGE ERROR: ${error.message}`);
        
        if (error.message.includes('dimensions')) {
            dimensionsErrorSeen = true;
            console.log(`🚨 DIMENSIONS ERROR DETECTED!`);
        }
    });
    
    try {
        await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle2' });
        
        // Start watching
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = WATCH_DURATION - elapsed;
            
            if (remaining <= 0) {
                clearInterval(checkInterval);
            } else {
                process.stdout.write(`\r⏱️  Watching... ${Math.ceil(remaining/1000)}s remaining`);
            }
        }, 1000);
        
        // Wait for the specified duration
        await new Promise(resolve => setTimeout(resolve, WATCH_DURATION));
        
        clearInterval(checkInterval);
        console.log('\n' + '=' .repeat(60));
        
        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`   Total logs captured: ${logs.length}`);
        console.log(`   Errors/Warnings: ${errorCount}`);
        console.log(`   "dimensions" error seen: ${dimensionsErrorSeen ? '❌ YES' : '✅ NO'}`);
        
        if (dimensionsErrorSeen) {
            console.log('\n🔍 Dimensions error details:');
            logs.filter(log => log.text.includes('dimensions'))
                .forEach(log => console.log(`   [${log.timestamp}] ${log.text}`));
        }
        
        await browser.close();
        
        // Exit code based on findings
        process.exit(dimensionsErrorSeen ? 1 : 0);
        
    } catch (error) {
        console.error(`\n❌ Watch failed: ${error.message}`);
        await browser.close();
        process.exit(2);
    }
}

// Run if called directly
if (require.main === module) {
    watchConsole().catch(console.error);
}