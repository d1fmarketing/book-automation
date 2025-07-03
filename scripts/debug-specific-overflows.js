/**
 * Debug Specific Overflow Elements
 * Provides detailed information about each overflow issue
 * 
 * Created: 2025-07-02 20:58:00 UTC
 * Author: Claude Assistant
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function debugOverflows() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    const htmlPath = path.join(process.cwd(), 'build/tmp/ebook-digital.html');
    
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    const overflowDetails = await page.evaluate(() => {
        const overflows = [];
        
        document.querySelectorAll('*').forEach(el => {
            if (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) {
                const parent = el.parentElement;
                overflows.push({
                    tag: el.tagName,
                    class: el.className || 'no-class',
                    id: el.id || 'no-id',
                    text: el.textContent.substring(0, 50) + '...',
                    scrollWidth: el.scrollWidth,
                    clientWidth: el.clientWidth,
                    parentTag: parent ? parent.tagName : 'none',
                    computedStyle: {
                        overflow: window.getComputedStyle(el).overflow,
                        overflowX: window.getComputedStyle(el).overflowX,
                        whiteSpace: window.getComputedStyle(el).whiteSpace,
                        width: window.getComputedStyle(el).width
                    }
                });
            }
        });
        
        return overflows;
    });
    
    console.log('🔍 Detalhes dos Overflows:\n');
    overflowDetails.forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.tag}${item.class ? '.' + item.class : ''}`);
        console.log(`   Texto: "${item.text}"`);
        console.log(`   Largura: ${item.scrollWidth}px > ${item.clientWidth}px`);
        console.log(`   CSS: overflow-x=${item.computedStyle.overflowX}, white-space=${item.computedStyle.whiteSpace}`);
        console.log('');
    });
    
    await browser.close();
}

debugOverflows();