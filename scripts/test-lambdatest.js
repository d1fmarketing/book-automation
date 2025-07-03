#!/usr/bin/env node

const puppeteer = require('puppeteer');

// LambdaTest credentials
const LT_USERNAME = process.env.LT_USERNAME || 'd1fdmarketing';
const LT_ACCESS_KEY = process.env.LT_ACCESS_KEY || 'LT_rnRwvICkcRkwuedzYg6C8RY2x1opdkzOZqJj1NStB1cunQm';

async function testLambdaTest() {
    console.log('🧪 Testing LambdaTest connection...\n');
    
    const capabilities = {
        'browserName': 'Chrome',
        'browserVersion': 'latest',
        'LT:Options': {
            'platform': 'Windows 10',
            'build': 'Ebook Pipeline Test',
            'name': 'Connection Test',
            'user': LT_USERNAME,
            'accessKey': LT_ACCESS_KEY
        }
    };

    try {
        // Connect to LambdaTest grid
        console.log('📡 Connecting to LambdaTest Grid...');
        const browser = await puppeteer.connect({
            browserWSEndpoint: `wss://cdp.lambdatest.com/puppeteer?capabilities=${encodeURIComponent(JSON.stringify(capabilities))}`
        });

        console.log('✅ Connected successfully!');
        
        // Create a page
        const page = await browser.newPage();
        console.log('📄 Created new page');
        
        // Navigate to test page
        await page.goto('https://www.lambdatest.com/');
        console.log('🌐 Navigated to LambdaTest homepage');
        
        // Take screenshot
        await page.screenshot({ path: 'lambdatest-connection-test.png' });
        console.log('📸 Screenshot saved: lambdatest-connection-test.png');
        
        // Get page title
        const title = await page.title();
        console.log(`📖 Page title: ${title}`);
        
        // Close browser
        await browser.close();
        console.log('🔒 Browser closed');
        
        console.log('\n✅ LambdaTest is working perfectly!');
        console.log('   Username:', LT_USERNAME);
        console.log('   Access Key:', LT_ACCESS_KEY.substring(0, 20) + '...');
        
    } catch (error) {
        console.error('\n❌ LambdaTest connection failed!');
        console.error('Error:', error.message);
        console.error('\nCheck:');
        console.error('1. Username is correct');
        console.error('2. Access key is valid');
        console.error('3. You have active subscription');
        process.exit(1);
    }
}

// Run test
testLambdaTest();