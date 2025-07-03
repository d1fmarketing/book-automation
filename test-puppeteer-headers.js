const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.goto(`file://${process.cwd()}/test-header-minimal.html`);
    
    await page.pdf({
        path: 'test-headers-fixed.pdf',
        format: 'A4',
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="font-size: 10px; text-align: center; width: 100%;">
                The Claude Elite Pipeline
            </div>
        `,
        footerTemplate: `
            <div style="font-size: 10px; text-align: center; width: 100%;">
                <span class="pageNumber"></span>
            </div>
        `,
        margin: { top: '60px', bottom: '60px' }
    });
    
    await browser.close();
    console.log('PDF gerado: test-headers-fixed.pdf');
})();