const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function deepAnalyzeIronFist() {
    const pdfPath = '/Users/d1f/Downloads/iron-fist-perfect-ebook.pdf';
    const outputDir = path.join(__dirname, '../build/iron-fist-deep-analysis');
    
    console.log('Deep Analysis of Iron Fist PDF...\n');
    
    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });
    
    try {
        // Load the PDF
        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const pageCount = pdfDoc.getPageCount();
        
        console.log(`PDF: ${pdfPath}`);
        console.log(`Total Pages: ${pageCount}`);
        console.log(`File Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n=== PAGE-BY-PAGE ANALYSIS ===\n');
        
        const fullAnalysis = [];
        
        for (let i = 0; i < pageCount; i++) {
            const page = pdfDoc.getPage(i);
            const { width, height } = page.getSize();
            
            console.log(`PAGE ${i + 1}:`);
            console.log(`- Dimensions: ${width} x ${height} points (${(width/72).toFixed(2)}" x ${(height/72).toFixed(2)}")`);
            
            // Get page resources
            const resources = page.node.Resources();
            
            // Check for XObjects (images)
            let imageCount = 0;
            let imageInfo = [];
            if (resources && resources.lookupMaybe('XObject')) {
                const xobjects = resources.lookup('XObject');
                const xobjectKeys = xobjects ? Object.keys(xobjects.dict || {}) : [];
                
                for (const key of xobjectKeys) {
                    try {
                        const xobj = xobjects.lookup(key);
                        if (xobj && xobj.lookupMaybe('Subtype')) {
                            const subtype = xobj.lookup('Subtype');
                            if (subtype && subtype.encodedName === '/Image') {
                                imageCount++;
                                const imgWidth = xobj.lookupMaybe('Width');
                                const imgHeight = xobj.lookupMaybe('Height');
                                imageInfo.push({
                                    name: key,
                                    width: imgWidth ? imgWidth.numberValue : 'unknown',
                                    height: imgHeight ? imgHeight.numberValue : 'unknown'
                                });
                            }
                        }
                    } catch (e) {
                        // Skip errors for individual objects
                    }
                }
            }
            
            console.log(`- Images: ${imageCount}`);
            if (imageInfo.length > 0) {
                imageInfo.forEach(img => {
                    console.log(`  • ${img.name}: ${img.width} x ${img.height} pixels`);
                });
            }
            
            // Check for fonts
            let fontCount = 0;
            let fontNames = [];
            if (resources && resources.lookupMaybe('Font')) {
                const fonts = resources.lookup('Font');
                const fontKeys = fonts ? Object.keys(fonts.dict || {}) : [];
                fontCount = fontKeys.length;
                
                for (const key of fontKeys) {
                    try {
                        const font = fonts.lookup(key);
                        const baseFontName = font.lookupMaybe('BaseFont');
                        if (baseFontName) {
                            fontNames.push(baseFontName.encodedName);
                        }
                    } catch (e) {
                        // Skip errors
                    }
                }
            }
            
            console.log(`- Fonts: ${fontCount}`);
            if (fontNames.length > 0) {
                fontNames.forEach(font => {
                    console.log(`  • ${font}`);
                });
            }
            
            // Check page content stream length
            const contents = page.node.Contents();
            let contentLength = 0;
            if (contents) {
                try {
                    const stream = contents.asArray ? contents.asArray()[0] : contents;
                    if (stream && stream.contents) {
                        contentLength = stream.contents.length;
                    }
                } catch (e) {
                    // Skip errors
                }
            }
            console.log(`- Content Stream Size: ${contentLength} bytes`);
            
            // Page issues check
            const issues = [];
            if (Math.abs(width - 432) > 1 || Math.abs(height - 648) > 1) {
                issues.push(`Non-standard size: ${(width/72).toFixed(2)}" x ${(height/72).toFixed(2)}" (expected 6" x 9")`);
            }
            
            if (i === 0 && imageCount === 0) {
                issues.push('Cover page has no images!');
            }
            
            if (i > 0 && imageCount === 0 && contentLength < 100) {
                issues.push('Page appears to be blank or nearly blank');
            }
            
            if (issues.length > 0) {
                console.log(`- ISSUES:`);
                issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
            } else {
                console.log('- Status: ✅ OK');
            }
            
            console.log('');
            
            fullAnalysis.push({
                pageNumber: i + 1,
                dimensions: { width, height, widthInches: width/72, heightInches: height/72 },
                imageCount,
                imageInfo,
                fontCount,
                fontNames,
                contentLength,
                issues
            });
        }
        
        // Summary analysis
        console.log('\n=== SUMMARY ANALYSIS ===\n');
        
        const coverPage = fullAnalysis[0];
        console.log('COVER PAGE CHECK:');
        if (coverPage.imageCount > 0) {
            console.log('✅ Cover has images');
            console.log(`   Images found: ${coverPage.imageCount}`);
            coverPage.imageInfo.forEach(img => {
                console.log(`   - ${img.name}: ${img.width} x ${img.height} pixels`);
            });
        } else {
            console.log('❌ CRITICAL: Cover page has NO images!');
        }
        
        console.log('\nPAGE SIZE CONSISTENCY:');
        const nonStandardPages = fullAnalysis.filter(p => p.issues.length > 0);
        if (nonStandardPages.length === 0) {
            console.log('✅ All pages are standard 6" x 9" size');
        } else {
            console.log(`❌ ${nonStandardPages.length} pages have issues:`);
            nonStandardPages.forEach(p => {
                console.log(`   Page ${p.pageNumber}: ${p.issues.join(', ')}`);
            });
        }
        
        console.log('\nIMAGE DISTRIBUTION:');
        const pagesWithImages = fullAnalysis.filter(p => p.imageCount > 0);
        console.log(`${pagesWithImages.length} of ${pageCount} pages contain images`);
        
        console.log('\nFONT USAGE:');
        const allFonts = new Set();
        fullAnalysis.forEach(p => p.fontNames.forEach(f => allFonts.add(f)));
        console.log(`Total unique fonts: ${allFonts.size}`);
        allFonts.forEach(font => console.log(`- ${font}`));
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            pdfPath,
            fileSize: pdfBuffer.length,
            pageCount,
            pages: fullAnalysis,
            summary: {
                coverHasImages: coverPage.imageCount > 0,
                allPagesStandardSize: nonStandardPages.length === 0,
                pagesWithImages: pagesWithImages.length,
                uniqueFonts: Array.from(allFonts),
                criticalIssues: nonStandardPages.map(p => ({
                    page: p.pageNumber,
                    issues: p.issues
                }))
            }
        };
        
        await fs.writeFile(
            path.join(outputDir, 'deep-analysis-report.json'),
            JSON.stringify(report, null, 2)
        );
        
        console.log(`\nDetailed report saved to: ${path.join(outputDir, 'deep-analysis-report.json')}`);
        
        // CRITICAL CHECK
        console.log('\n=== CRITICAL CHECKS FOR ADOBE ACROBAT ===\n');
        
        if (!report.summary.coverHasImages) {
            console.log('🚨 CRITICAL ISSUE: Cover page has no images - will show as blank!');
        }
        
        if (!report.summary.allPagesStandardSize) {
            console.log('🚨 CRITICAL ISSUE: Non-standard page sizes detected!');
        }
        
        if (report.summary.pagesWithImages < 3) {
            console.log('⚠️  WARNING: Very few pages have images - check if images are rendering correctly');
        }
        
        console.log('\nPDF Analysis Complete.');
        
    } catch (error) {
        console.error('Error during deep analysis:', error);
        throw error;
    }
}

deepAnalyzeIronFist().catch(console.error);