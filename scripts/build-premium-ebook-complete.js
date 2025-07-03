#!/usr/bin/env node

const { generateAllImages } = require('./generate-ebook-images');
const { generatePremiumHTML } = require('./build-premium-html-ebook');
const fs = require('fs').promises;
const path = require('path');

async function buildCompletePremiumEbook() {
    console.log('🚀 Starting Complete Premium Ebook Build Process\n');
    console.log('=' + '='.repeat(60) + '\n');
    
    const startTime = Date.now();
    
    try {
        // Step 1: Generate Images with Ideogram
        console.log('📸 STEP 1: Generating AI Images with Ideogram\n');
        console.log('This may take a few minutes...\n');
        
        let imageResults;
        try {
            imageResults = await generateAllImages();
        } catch (error) {
            console.log('⚠️  Image generation failed, continuing with placeholders\n');
            console.log('Error:', error.message, '\n');
            imageResults = { success: [], failed: [] };
        }
        
        // Step 2: Generate Premium HTML
        console.log('\n' + '='.repeat(60) + '\n');
        console.log('📝 STEP 2: Building Premium HTML Ebook\n');
        
        const htmlPath = await generatePremiumHTML();
        
        // Step 3: Generate summary report
        console.log('\n' + '='.repeat(60) + '\n');
        console.log('📊 BUILD SUMMARY\n');
        console.log('='.repeat(60) + '\n');
        
        const buildTime = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`✅ Build completed in ${buildTime} seconds`);
        console.log(`📸 Images generated: ${imageResults.success?.length || 0}/${imageResults.success?.length + imageResults.failed?.length || 10}`);
        console.log(`📄 HTML file: ${htmlPath}`);
        
        // Check file size
        const stats = await fs.stat(htmlPath);
        const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`📏 File size: ${fileSizeMB} MB`);
        
        // Generate quick start guide
        console.log('\n' + '='.repeat(60) + '\n');
        console.log('🎯 QUICK START GUIDE\n');
        console.log('='.repeat(60) + '\n');
        
        console.log('1️⃣  Open the ebook in your browser:');
        console.log(`   open ${htmlPath}\n`);
        
        console.log('2️⃣  Start a local server (recommended):');
        console.log('   cd build/html-ebook');
        console.log('   python3 -m http.server 8000');
        console.log('   # Then open http://localhost:8000\n');
        
        console.log('3️⃣  Deploy to GitHub Pages:');
        console.log('   git add build/html-ebook');
        console.log('   git commit -m "Add premium ebook"');
        console.log('   git push\n');
        
        console.log('4️⃣  Sell on Gumroad:');
        console.log('   - Create a new product on Gumroad');
        console.log('   - Upload the HTML file');
        console.log('   - Set price to $47-97');
        console.log('   - Add preview images\n');
        
        console.log('5️⃣  Features to test:');
        console.log('   - ✨ Progress tracking (scroll and check localStorage)');
        console.log('   - 🔍 Search functionality (press /)');
        console.log('   - 🌙 Dark mode (settings panel)');
        console.log('   - 📱 Mobile responsiveness');
        console.log('   - ⌨️  Keyboard shortcuts (j/k, n/p, b)');
        console.log('   - 📋 Copy code buttons');
        console.log('   - ✅ Interactive checklists\n');
        
        // Save build report
        const report = {
            buildTime: new Date().toISOString(),
            duration: buildTime + 's',
            images: {
                total: imageResults.success?.length + imageResults.failed?.length || 0,
                success: imageResults.success?.length || 0,
                failed: imageResults.failed?.length || 0
            },
            output: {
                path: htmlPath,
                size: fileSizeMB + ' MB'
            },
            features: [
                'Progress Tracking',
                'Search Functionality',
                'Dark/Light/Sepia Themes',
                'Interactive Checklists',
                'Code Copy Buttons',
                'Keyboard Navigation',
                'Mobile Responsive',
                'Chapter Navigation',
                'Reading Time Estimates',
                'Customizable Font Size'
            ]
        };
        
        const reportPath = path.join(path.dirname(htmlPath), 'build-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📋 Build report saved to: ${reportPath}\n`);
        
        console.log('🎉 Premium ebook build complete!\n');
        console.log('💰 This ebook is ready to sell for $47-97\n');
        
        return {
            success: true,
            htmlPath,
            report
        };
        
    } catch (error) {
        console.error('\n❌ Build failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Add convenience npm script
async function updatePackageJson() {
    try {
        const packagePath = path.join(__dirname, '../package.json');
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        
        if (!packageJson.scripts['build:premium-ebook']) {
            packageJson.scripts['build:premium-ebook'] = 'node scripts/build-premium-ebook-complete.js';
            await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
            console.log('✅ Added npm script: npm run build:premium-ebook\n');
        }
    } catch (error) {
        // Ignore if can't update package.json
    }
}

// Run if called directly
if (require.main === module) {
    updatePackageJson().then(() => {
        buildCompletePremiumEbook()
            .then(result => {
                process.exit(result.success ? 0 : 1);
            })
            .catch(error => {
                console.error('Fatal error:', error);
                process.exit(1);
            });
    });
}

module.exports = { buildCompletePremiumEbook };