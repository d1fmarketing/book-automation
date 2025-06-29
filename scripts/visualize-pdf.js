#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function visualizePDF() {
    console.log('🖼️ Taking screenshots of the HTML book...');
    
    const htmlPath = path.join(__dirname, '../build/temp/adhd-book-commercial.html');
    const screenshotsDir = path.join(__dirname, '../build/screenshots');
    
    // Create screenshots directory
    fs.mkdirSync(screenshotsDir, { recursive: true });
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set A5 viewport
    await page.setViewport({
        width: 595,  // A5 width
        height: 842, // A5 height
        deviceScaleFactor: 2
    });
    
    // Load HTML
    console.log('📄 Loading HTML...');
    await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0',
        timeout: 60000
    });
    
    // Take screenshots of different sections
    console.log('📸 Taking screenshots...');
    
    // 1. Cover page
    await page.screenshot({
        path: path.join(screenshotsDir, '01-cover.png'),
        fullPage: false
    });
    console.log('✓ Cover page captured');
    
    // 2. Scroll to first chapter
    await page.evaluate(() => {
        const firstChapter = document.querySelector('.chapter');
        if (firstChapter) {
            firstChapter.scrollIntoView();
        }
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({
        path: path.join(screenshotsDir, '02-first-chapter.png'),
        fullPage: false
    });
    console.log('✓ First chapter captured');
    
    // 3. Scroll to middle (around 40% of content)
    await page.evaluate(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, scrollHeight * 0.4);
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({
        path: path.join(screenshotsDir, '03-middle-content.png'),
        fullPage: false
    });
    console.log('✓ Middle content captured');
    
    // 4. Find and capture a tip box
    await page.evaluate(() => {
        const tipBox = document.querySelector('div[style*="background: linear-gradient(135deg, #E8F8F5"]');
        if (tipBox) {
            tipBox.scrollIntoView({ block: 'center' });
        }
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({
        path: path.join(screenshotsDir, '04-tip-box.png'),
        fullPage: false
    });
    console.log('✓ Tip box captured');
    
    // 5. Scroll to end
    await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.screenshot({
        path: path.join(screenshotsDir, '05-end-content.png'),
        fullPage: false
    });
    console.log('✓ End content captured');
    
    // Also save one full-page screenshot
    await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0'
    });
    await page.screenshot({
        path: path.join(screenshotsDir, '00-full-page.png'),
        fullPage: true
    });
    console.log('✓ Full page captured');
    
    await browser.close();
    
    console.log(`\n✅ Screenshots saved to: ${screenshotsDir}`);
    console.log('\nYou can now view these screenshots to see the actual PDF appearance:');
    fs.readdirSync(screenshotsDir).forEach(file => {
        if (file.endsWith('.png')) {
            console.log(`  - ${file}`);
        }
    });
}

visualizePDF().catch(console.error);