#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

async function capturePreview() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set viewport for 6x9 inch at 96 DPI
        await page.setViewport({
            width: 576,  // 6 inches * 96 DPI
            height: 864, // 9 inches * 96 DPI
            deviceScaleFactor: 2
        });
        
        const htmlPath = path.join(__dirname, '..', 'build', 'tmp', 'ebook-preview.html');
        const fileUrl = `file://${htmlPath}`;
        
        console.log('Loading preview from:', fileUrl);
        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait for content to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get all pages
        const pageElements = await page.$$('.page, .cover');
        console.log(`Found ${pageElements.length} pages`);
        
        // Create screenshots directory
        const screenshotDir = path.join(__dirname, '..', 'build', 'preview-screenshots');
        await fs.mkdir(screenshotDir, { recursive: true });
        
        // Take full page screenshot
        const fullPagePath = path.join(screenshotDir, 'full-preview.png');
        await page.screenshot({
            path: fullPagePath,
            fullPage: true
        });
        console.log('Full page screenshot saved to:', fullPagePath);
        
        // Take individual page screenshots
        for (let i = 0; i < pageElements.length; i++) {
            const pageElement = pageElements[i];
            const screenshotPath = path.join(screenshotDir, `page-${i + 1}.png`);
            
            // Check if it's a cover page
            const isCover = await pageElement.evaluate(el => el.classList.contains('cover'));
            
            await pageElement.screenshot({
                path: screenshotPath
            });
            
            console.log(`Page ${i + 1} screenshot saved (${isCover ? 'COVER' : 'CONTENT'})`, screenshotPath);
            
            // Get page dimensions
            const dimensions = await pageElement.evaluate(el => ({
                width: el.offsetWidth,
                height: el.offsetHeight,
                hasImages: el.querySelectorAll('img').length > 0,
                imgSrcs: Array.from(el.querySelectorAll('img')).map(img => img.src)
            }));
            
            console.log(`Page ${i + 1} dimensions:`, dimensions);
        }
        
        // Check for styling
        const styles = await page.evaluate(() => {
            const pages = document.querySelectorAll('.page, .cover');
            return Array.from(pages).map((page, i) => {
                const computed = window.getComputedStyle(page);
                return {
                    page: i + 1,
                    width: computed.width,
                    height: computed.height,
                    padding: computed.padding,
                    boxShadow: computed.boxShadow,
                    background: computed.background
                };
            });
        });
        
        console.log('\nPage styles:');
        styles.forEach(style => {
            console.log(`Page ${style.page}:`, style);
        });
        
    } catch (error) {
        console.error('Error capturing preview:', error);
    } finally {
        await browser.close();
    }
}

capturePreview();