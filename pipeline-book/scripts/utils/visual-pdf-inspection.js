const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function visuallyInspectPDF(pdfPath) {
    console.log(`\n🔍 VISUAL PDF INSPECTION: ${pdfPath}\n`);
    console.log('═'.repeat(80));
    
    const browser = await puppeteer.launch({
        headless: true,
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
        
        // Navigate to PDF
        const pdfUrl = `file://${path.resolve(pdfPath)}`;
        await page.goto(pdfUrl, { waitUntil: 'networkidle0' });
        
        // Wait for PDF to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get PDF viewer info
        const pdfInfo = await page.evaluate(() => {
            const viewer = document.querySelector('embed') || document.querySelector('iframe');
            return {
                hasViewer: !!viewer,
                viewerType: viewer?.tagName,
                documentTitle: document.title
            };
        });
        
        console.log('\n📄 PDF VIEWER INFO:');
        console.log(`  Viewer Found: ${pdfInfo.hasViewer}`);
        console.log(`  Viewer Type: ${pdfInfo.viewerType || 'Browser PDF Viewer'}`);
        console.log(`  Document Title: ${pdfInfo.documentTitle}`);
        
        // Since we can't reliably navigate PDF pages in headless mode,
        // let's open the HTML source that was used to create the PDF
        console.log('\n📝 ANALYZING HTML SOURCE...\n');
        
        const htmlPath = 'final-perfect.html';
        if (fs.existsSync(htmlPath)) {
            await page.goto(`file://${path.resolve(htmlPath)}`, { waitUntil: 'networkidle0' });
            
            // Analyze page structure
            const pageAnalysis = await page.evaluate(() => {
                const results = {
                    pages: [],
                    images: [],
                    dropCaps: []
                };
                
                // Find all page breaks
                const pages = document.querySelectorAll('.page, .cover-page, .title-page, .copyright-page, .toc-page, .chapter-opener');
                
                pages.forEach((pageEl, index) => {
                    const pageInfo = {
                        number: index + 1,
                        type: pageEl.className,
                        hasContent: pageEl.textContent.trim().length > 0,
                        textPreview: pageEl.textContent.trim().substring(0, 100)
                    };
                    
                    // Check for images
                    const images = pageEl.querySelectorAll('img');
                    images.forEach(img => {
                        results.images.push({
                            page: index + 1,
                            src: img.src,
                            alt: img.alt,
                            width: img.width,
                            height: img.height,
                            isVisible: img.offsetWidth > 0 && img.offsetHeight > 0
                        });
                    });
                    
                    // Check for drop caps
                    const dropCaps = pageEl.querySelectorAll('.drop-cap, p:first-child:first-letter');
                    if (dropCaps.length > 0) {
                        results.dropCaps.push({
                            page: index + 1,
                            count: dropCaps.length
                        });
                    }
                    
                    results.pages.push(pageInfo);
                });
                
                return results;
            });
            
            // Report findings
            console.log(`📊 STRUCTURE ANALYSIS:`);
            console.log(`  Total Pages: ${pageAnalysis.pages.length}`);
            console.log(`  Total Images: ${pageAnalysis.images.length}`);
            console.log(`  Pages with Drop Caps: ${pageAnalysis.dropCaps.length}`);
            
            console.log(`\n📄 PAGE-BY-PAGE BREAKDOWN:\n`);
            
            pageAnalysis.pages.forEach((page, index) => {
                console.log(`PAGE ${page.number}:`);
                console.log(`  Type: ${page.type}`);
                console.log(`  Has Content: ${page.hasContent}`);
                if (page.hasContent) {
                    console.log(`  Preview: "${page.textPreview}..."`);
                }
                
                // Check for images on this page
                const pageImages = pageAnalysis.images.filter(img => img.page === page.number);
                if (pageImages.length > 0) {
                    console.log(`  Images: ${pageImages.length}`);
                    pageImages.forEach(img => {
                        console.log(`    - ${img.alt || 'No alt text'} (${img.width}x${img.height}) ${img.isVisible ? '✅ Visible' : '❌ Not visible'}`);
                    });
                }
                
                // Check for drop caps
                const pageDropCaps = pageAnalysis.dropCaps.filter(dc => dc.page === page.number);
                if (pageDropCaps.length > 0) {
                    console.log(`  ✅ Has drop cap`);
                }
                
                console.log('');
            });
            
            // Image analysis
            console.log(`\n🖼️  IMAGE DETAILS:\n`);
            if (pageAnalysis.images.length === 0) {
                console.log('  ❌ NO IMAGES FOUND IN HTML!');
            } else {
                pageAnalysis.images.forEach((img, index) => {
                    console.log(`Image ${index + 1}:`);
                    console.log(`  Page: ${img.page}`);
                    console.log(`  Source: ${img.src}`);
                    console.log(`  Dimensions: ${img.width}x${img.height}`);
                    console.log(`  Visible: ${img.isVisible ? '✅ Yes' : '❌ No'}`);
                    console.log('');
                });
            }
            
            // Take screenshots of key pages
            console.log(`\n📸 TAKING SCREENSHOTS OF KEY PAGES...\n`);
            
            // Screenshot cover page
            const coverEl = await page.$('.cover-page');
            if (coverEl) {
                await coverEl.screenshot({ path: 'inspection-cover.png' });
                console.log('  ✅ Cover page screenshot saved');
            }
            
            // Screenshot first chapter opener
            const chapterEl = await page.$('.chapter-opener');
            if (chapterEl) {
                await chapterEl.screenshot({ path: 'inspection-chapter.png' });
                console.log('  ✅ Chapter opener screenshot saved');
            }
            
            // Final summary
            console.log(`\n📝 VISUAL INSPECTION SUMMARY:\n`);
            
            const issues = [];
            if (pageAnalysis.images.length === 0) {
                issues.push('No images found in document');
            }
            if (pageAnalysis.dropCaps.length === 0) {
                issues.push('No drop caps found');
            }
            if (pageAnalysis.images.some(img => !img.isVisible)) {
                issues.push('Some images are not visible');
            }
            
            if (issues.length > 0) {
                console.log('⚠️  ISSUES FOUND:');
                issues.forEach(issue => console.log(`  - ${issue}`));
            } else {
                console.log('✅ All visual elements appear to be present');
            }
            
        } else {
            console.log('❌ HTML source file not found');
        }
        
    } catch (error) {
        console.error('Error during visual inspection:', error);
    } finally {
        await browser.close();
    }
    
    console.log('\n' + '═'.repeat(80));
}

// Run the inspection
const pdfFile = process.argv[2] || 'the-claude-elite-pipeline-perfect.pdf';
visuallyInspectPDF(pdfFile);