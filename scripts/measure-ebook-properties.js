#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');

async function measureEbookProperties() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Set viewport to typical reading size
        await page.setViewport({
            width: 1200,
            height: 800
        });

        // Load the HTML file
        const htmlPath = path.join(__dirname, '..', 'build', 'tmp', 'ebook.html');
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0'
        });

        // Execute the measurement script
        const results = await page.evaluate(() => {
            // Get computed styles
            const style = getComputedStyle(document.body);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight);
            const lineHeightRatio = lineHeight / fontSize;

            // Check margins
            const marginTop = parseFloat(style.marginTop);
            const marginRight = parseFloat(style.marginRight);
            const marginBottom = parseFloat(style.marginBottom);
            const marginLeft = parseFloat(style.marginLeft);

            // Check images
            const images = document.querySelectorAll('img');
            const imageInfo = Array.from(images).map(img => ({
                src: img.src,
                alt: img.alt,
                loaded: img.complete,
                width: img.width,
                height: img.height
            }));

            // Check contrast (simplified)
            const color = style.color;
            const backgroundColor = style.backgroundColor;

            // Get font family
            const fontFamily = style.fontFamily;

            // Count chapters
            const chapters = document.querySelectorAll('.chapter').length;

            // Return comprehensive results
            return {
                typography: {
                    fontSize: fontSize,
                    fontSizePt: fontSize * 0.75, // Convert px to pt
                    fontSizeOK: fontSize >= 15.3 && fontSize <= 18.7, // 11.5pt-14pt
                    lineHeight: lineHeight,
                    lineHeightRatio: lineHeightRatio,
                    lineHeightOK: lineHeightRatio >= 1.3 && lineHeightRatio <= 1.6,
                    fontFamily: fontFamily
                },
                layout: {
                    marginTop: marginTop,
                    marginRight: marginRight,
                    marginBottom: marginBottom,
                    marginLeft: marginLeft,
                    marginsOK: marginTop > 20 && marginRight > 20 && marginLeft > 20
                },
                content: {
                    chapters: chapters,
                    images: imageInfo,
                    hasImages: images.length > 0,
                    imagesLoaded: imageInfo.every(img => img.loaded || !img.src)
                },
                colors: {
                    textColor: color,
                    backgroundColor: backgroundColor
                }
            };
        });

        console.log(JSON.stringify(results, null, 2));

    } catch (error) {
        console.error('Error measuring ebook properties:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

measureEbookProperties();