#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m'
};

async function optimizeImagesFor150DPI() {
    console.log(`${colors.green}${colors.bright}🖼️ Optimizing images for 150 DPI print quality...${colors.reset}`);
    
    const imagesDir = path.join(__dirname, '../assets/images');
    const outputDir = path.join(__dirname, '../assets/images-optimized');
    
    // Create output directory
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Get all image files
    const imageFiles = fs.readdirSync(imagesDir)
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    
    console.log(`${colors.blue}📁 Found ${imageFiles.length} images to optimize${colors.reset}`);
    
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    
    for (const file of imageFiles) {
        const inputPath = path.join(imagesDir, file);
        const outputPath = path.join(outputDir, file);
        
        const stats = fs.statSync(inputPath);
        totalOriginalSize += stats.size;
        
        console.log(`\n${colors.cyan}Processing: ${file}${colors.reset}`);
        console.log(`  Original size: ${(stats.size / 1024 / 1024).toFixed(2)}MB`);
        
        try {
            // For print: A5 width is 148mm = 5.83 inches
            // At 150 DPI: 5.83 * 150 = 874 pixels max width
            const MAX_WIDTH = 874;
            const DPI = 150;
            
            // Get image metadata
            const metadata = await sharp(inputPath).metadata();
            
            // Calculate new dimensions maintaining aspect ratio
            let newWidth = metadata.width;
            let newHeight = metadata.height;
            
            if (newWidth > MAX_WIDTH) {
                const ratio = MAX_WIDTH / newWidth;
                newWidth = MAX_WIDTH;
                newHeight = Math.round(metadata.height * ratio);
            }
            
            // Optimize image
            await sharp(inputPath)
                .resize(newWidth, newHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({
                    quality: 85,
                    progressive: true,
                    mozjpeg: true
                })
                .withMetadata({
                    density: DPI
                })
                .toFile(outputPath.replace(/\.(png|jpg|jpeg)$/i, '.jpg'));
            
            const newStats = fs.statSync(outputPath.replace(/\.(png|jpg|jpeg)$/i, '.jpg'));
            totalOptimizedSize += newStats.size;
            
            console.log(`  ${colors.green}✓ Optimized size: ${(newStats.size / 1024 / 1024).toFixed(2)}MB${colors.reset}`);
            console.log(`  ${colors.green}✓ Dimensions: ${newWidth}x${newHeight} @ ${DPI}DPI${colors.reset}`);
            console.log(`  ${colors.green}✓ Reduction: ${((1 - newStats.size / stats.size) * 100).toFixed(1)}%${colors.reset}`);
            
        } catch (error) {
            console.log(`  ${colors.red}✗ Error: ${error.message}${colors.reset}`);
        }
    }
    
    console.log(`\n${colors.yellow}${colors.bright}📊 Optimization Summary:${colors.reset}`);
    console.log(`  Original total: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Optimized total: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Total reduction: ${((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1)}%`);
    
    console.log(`\n${colors.green}${colors.bright}✅ Images optimized for 150 DPI print!${colors.reset}`);
    console.log(`${colors.cyan}📁 Optimized images saved to: ${outputDir}${colors.reset}`);
    
    // Create backup of original images
    const backupDir = path.join(__dirname, '../assets/images-original');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`\n${colors.blue}📦 Creating backup of original images...${colors.reset}`);
        
        for (const file of imageFiles) {
            fs.copyFileSync(
                path.join(imagesDir, file),
                path.join(backupDir, file)
            );
        }
        console.log(`${colors.green}✓ Backup created at: ${backupDir}${colors.reset}`);
    }
    
    // Replace original images with optimized ones
    console.log(`\n${colors.blue}🔄 Replacing original images with optimized versions...${colors.reset}`);
    for (const file of imageFiles) {
        const optimizedFile = file.replace(/\.(png|jpg|jpeg)$/i, '.jpg');
        const optimizedPath = path.join(outputDir, optimizedFile);
        const originalPath = path.join(imagesDir, file);
        
        if (fs.existsSync(optimizedPath)) {
            // Remove original
            fs.unlinkSync(originalPath);
            // Move optimized to original location with new name
            fs.renameSync(optimizedPath, path.join(imagesDir, optimizedFile));
        }
    }
    
    // Remove temporary output directory
    fs.rmdirSync(outputDir);
    
    console.log(`${colors.green}✓ All images replaced with optimized versions${colors.reset}`);
}

optimizeImagesFor150DPI().catch(console.error);