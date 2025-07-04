#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');

// LambdaTest credentials
const LT_USERNAME = process.env.LT_USERNAME || 'd1fdmarketing';
const LT_ACCESS_KEY = process.env.LT_ACCESS_KEY || 'LT_rnRwvICkcRkwuedzYg6C8RY2x1opdkzOZqJj1NStB1cunQm';

async function testEbookOnLambdaTest() {
    console.log('🧪 Testing Ebook on LambdaTest...\n');
    
    // Test on multiple devices
    const devices = [
        { platform: 'Windows 10', browserName: 'Chrome', version: 'latest' },
        { platform: 'macOS Ventura', browserName: 'Safari', version: '16' },
        { platform: 'Windows 11', browserName: 'Edge', version: 'latest' }
    ];
    
    const ebookPath = path.join(__dirname, 'build/html-ebook/index.html');
    const ebookUrl = `file://${ebookPath}`;
    
    console.log(`📖 Testing ebook: ${ebookUrl}\n`);
    
    for (const device of devices) {
        console.log(`\n📱 Testing on ${device.platform} - ${device.browserName}`);
        
        const capabilities = {
            'browserName': device.browserName,
            'browserVersion': device.version,
            'LT:Options': {
                'platform': device.platform,
                'build': 'Ebook QA Test',
                'name': `Ebook Test - ${device.platform} ${device.browserName}`,
                'user': LT_USERNAME,
                'accessKey': LT_ACCESS_KEY,
                'visual': true,
                'video': true,
                'console': true,
                'network': true
            }
        };

        try {
            // Connect to LambdaTest
            const browser = await puppeteer.connect({
                browserWSEndpoint: `wss://cdp.lambdatest.com/puppeteer?capabilities=${encodeURIComponent(JSON.stringify(capabilities))}`
            });

            const page = await browser.newPage();
            
            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });
            
            // Navigate to ebook
            await page.goto(ebookUrl, { waitUntil: 'networkidle0' });
            
            // Wait for content to load
            await page.waitForSelector('h1', { timeout: 10000 });
            
            // Take screenshot
            const screenshotName = `ebook-${device.platform.replace(/\s/g, '-')}-${device.browserName}.png`;
            await page.screenshot({ 
                path: `build/qa-screenshots/${screenshotName}`,
                fullPage: true 
            });
            console.log(`   📸 Screenshot saved: ${screenshotName}`);
            
            // Check for basic elements
            const title = await page.$eval('h1', el => el.textContent);
            console.log(`   📚 Title found: ${title}`);
            
            const hasImages = await page.$$eval('img', images => images.length);
            console.log(`   🖼️  Images found: ${hasImages}`);
            
            const hasChapters = await page.$$eval('.chapter', chapters => chapters.length);
            console.log(`   📖 Chapters found: ${hasChapters}`);
            
            // Close browser
            await browser.close();
            console.log(`   ✅ Test passed!`);
            
        } catch (error) {
            console.error(`   ❌ Test failed: ${error.message}`);
        }
    }
    
    console.log('\n\n🎉 QA Testing Complete!');
    console.log('📁 Screenshots saved in: build/qa-screenshots/');
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('build/qa-screenshots')) {
    fs.mkdirSync('build/qa-screenshots', { recursive: true });
}

// Run test
testEbookOnLambdaTest().catch(console.error);