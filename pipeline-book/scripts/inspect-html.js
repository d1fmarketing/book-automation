const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function inspectHTML() {
    const htmlPath = path.join(__dirname, '../build/tmp/ebook.html');
    
    if (!fs.existsSync(htmlPath)) {
        console.error('❌ HTML file not found:', htmlPath);
        return;
    }
    
    console.log('📄 Opening HTML file:', htmlPath);
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Set viewport to match 6×9" book dimensions
        await page.setViewport({
            width: 900,
            height: 1350,
            deviceScaleFactor: 2
        });
        
        // Navigate to the HTML file
        await page.goto(`file://${htmlPath}`, { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });
        
        // Wait a bit for everything to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take screenshots of different parts
        const screenshotDir = path.join(__dirname, '../build/html-inspection');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
        
        // Full page screenshot
        await page.screenshot({
            path: path.join(screenshotDir, 'full-page.png'),
            fullPage: true
        });
        console.log('✅ Full page screenshot saved');
        
        // Check for cover image
        const coverImage = await page.$('.cover img');
        if (coverImage) {
            const coverSrc = await coverImage.evaluate(img => img.src);
            console.log('📸 Cover image found:', coverSrc);
            
            // Screenshot just the cover
            await page.screenshot({
                path: path.join(screenshotDir, 'cover.png'),
                clip: await coverImage.boundingBox()
            });
        } else {
            console.log('❌ No cover image found!');
        }
        
        // Check for all images
        const allImages = await page.$$('img');
        console.log(`\n📷 Found ${allImages.length} images total:`);
        
        for (let i = 0; i < allImages.length; i++) {
            const img = allImages[i];
            const src = await img.evaluate(el => el.src);
            const alt = await img.evaluate(el => el.alt);
            const naturalWidth = await img.evaluate(el => el.naturalWidth);
            const naturalHeight = await img.evaluate(el => el.naturalHeight);
            
            console.log(`\nImage ${i + 1}:`);
            console.log(`  Alt: ${alt || '(no alt text)'}`);
            console.log(`  Src: ${src}`);
            console.log(`  Loaded: ${naturalWidth > 0 ? '✅ Yes' : '❌ No'} (${naturalWidth}×${naturalHeight})`);
            
            // Take screenshot of each image
            try {
                const box = await img.boundingBox();
                if (box && box.width > 0 && box.height > 0) {
                    await page.screenshot({
                        path: path.join(screenshotDir, `image-${i + 1}.png`),
                        clip: box
                    });
                }
            } catch (e) {
                console.log(`  Could not screenshot: ${e.message}`);
            }
        }
        
        // Check for broken images
        const brokenImages = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return images.filter(img => !img.complete || img.naturalWidth === 0)
                        .map(img => ({ src: img.src, alt: img.alt }));
        });
        
        if (brokenImages.length > 0) {
            console.log('\n❌ BROKEN IMAGES FOUND:');
            brokenImages.forEach(img => {
                console.log(`  - ${img.alt || 'no alt'}: ${img.src}`);
            });
        }
        
        // Check chapters
        const chapters = await page.$$('h1');
        console.log(`\n📚 Found ${chapters.length} H1 headings (chapters):`);
        for (const chapter of chapters) {
            const text = await chapter.evaluate(el => el.textContent);
            console.log(`  - ${text}`);
        }
        
        // Check page structure
        const hasToC = await page.$('#table-of-contents') !== null;
        console.log(`\n📑 Table of Contents: ${hasToC ? '✅ Found' : '❌ Not found'}`);
        
        // Get page dimensions
        const dimensions = await page.evaluate(() => {
            return {
                width: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight
            };
        });
        console.log(`\n📐 Page dimensions: ${dimensions.width}×${dimensions.height}px`);
        
        console.log('\n✅ Inspection complete! Check the screenshots in:', screenshotDir);
        
    } finally {
        await browser.close();
    }
}

inspectHTML().catch(console.error);