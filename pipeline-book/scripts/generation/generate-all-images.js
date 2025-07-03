#!/usr/bin/env node

/**
 * Generate high-quality images for all chapters
 * Creates professional chapter illustrations
 */

const fs = require('fs-extra');
const path = require('path');
const { createCanvas } = require('canvas');

async function generateChapterImage(chapterNum, title, theme) {
    const width = 1600;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Create gradient background based on chapter
    const gradients = [
        ['#667eea', '#764ba2'], // Chapter 1 - Purple
        ['#f093fb', '#f5576c'], // Chapter 2 - Pink
        ['#4facfe', '#00f2fe'], // Chapter 3 - Blue
        ['#43e97b', '#38f9d7'], // Chapter 4 - Green
        ['#fa709a', '#fee140'], // Chapter 5 - Sunset
    ];
    
    const [startColor, endColor] = gradients[chapterNum - 1] || gradients[0];
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    
    // Fill background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Add geometric patterns
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    
    // Draw circles
    for (let i = 0; i < 5; i++) {
        const x = (i + 1) * (width / 6);
        const y = height / 2;
        const radius = 50 + i * 20;
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw lines
    for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (width / 10), 0);
        ctx.lineTo(width - i * (width / 10), height);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    
    // Add chapter number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${chapterNum}`, width / 2, height / 2 - 50);
    
    // Add chapter title
    ctx.font = '40px Inter, sans-serif';
    ctx.fillText(title, width / 2, height / 2 + 80);
    
    // Add decorative elements
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    
    // Top line
    ctx.beginPath();
    ctx.moveTo(width / 2 - 200, height / 2 - 120);
    ctx.lineTo(width / 2 + 200, height / 2 - 120);
    ctx.stroke();
    
    // Bottom line
    ctx.beginPath();
    ctx.moveTo(width / 2 - 150, height / 2 + 130);
    ctx.lineTo(width / 2 + 150, height / 2 + 130);
    ctx.stroke();
    
    return canvas.toBuffer('png');
}

async function generateAllImages() {
    console.log('🎨 Generating professional chapter images...\n');
    
    const outputDir = path.join(__dirname, '../../assets/images');
    await fs.ensureDir(outputDir);
    
    const chapters = [
        { num: 1, title: 'The Vision of Automated Publishing' },
        { num: 2, title: 'The Five Agents' },
        { num: 3, title: 'Building Your First Book' },
        { num: 4, title: 'Professional Publishing' },
        { num: 5, title: 'The Future of Publishing' }
    ];
    
    for (const chapter of chapters) {
        console.log(`📸 Generating image for Chapter ${chapter.num}...`);
        
        const imageBuffer = await generateChapterImage(chapter.num, chapter.title);
        const outputPath = path.join(outputDir, `chapter-0${chapter.num}-professional.png`);
        
        await fs.writeFile(outputPath, imageBuffer);
        console.log(`   ✓ Saved to ${path.relative(process.cwd(), outputPath)}`);
    }
    
    // Generate a professional cover
    console.log('\n📚 Generating professional cover...');
    const coverCanvas = createCanvas(1600, 2400);
    const coverCtx = coverCanvas.getContext('2d');
    
    // Cover gradient
    const coverGradient = coverCtx.createLinearGradient(0, 0, 0, 2400);
    coverGradient.addColorStop(0, '#667eea');
    coverGradient.addColorStop(0.5, '#764ba2');
    coverGradient.addColorStop(1, '#312e81');
    
    coverCtx.fillStyle = coverGradient;
    coverCtx.fillRect(0, 0, 1600, 2400);
    
    // Add pattern overlay
    coverCtx.globalAlpha = 0.1;
    coverCtx.strokeStyle = '#ffffff';
    coverCtx.lineWidth = 2;
    
    for (let i = 0; i < 20; i++) {
        coverCtx.beginPath();
        coverCtx.arc(800, 1200, 100 + i * 50, 0, Math.PI * 2);
        coverCtx.stroke();
    }
    
    coverCtx.globalAlpha = 1;
    
    // Title
    coverCtx.fillStyle = '#ffffff';
    coverCtx.font = 'bold 120px Inter, sans-serif';
    coverCtx.textAlign = 'center';
    coverCtx.fillText('The Claude', 800, 800);
    coverCtx.fillText('Elite Pipeline', 800, 950);
    
    // Subtitle
    coverCtx.font = '60px Inter, sans-serif';
    coverCtx.fillText('Mastering Automated', 800, 1200);
    coverCtx.fillText('Ebook Creation', 800, 1300);
    
    // Author
    coverCtx.font = '50px Inter, sans-serif';
    coverCtx.fillText('Claude Elite Team', 800, 1800);
    
    // Decorative line
    coverCtx.strokeStyle = '#ffffff';
    coverCtx.lineWidth = 4;
    coverCtx.beginPath();
    coverCtx.moveTo(400, 1500);
    coverCtx.lineTo(1200, 1500);
    coverCtx.stroke();
    
    const coverPath = path.join(outputDir, 'cover-professional.png');
    await fs.writeFile(coverPath, coverCanvas.toBuffer('png'));
    console.log(`   ✓ Saved professional cover`);
    
    console.log('\n✅ All images generated successfully!');
}

// Check if canvas is installed
try {
    require('canvas');
    generateAllImages().catch(console.error);
} catch (error) {
    console.log('⚠️  Canvas module not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install canvas', { stdio: 'inherit' });
    console.log('\n✅ Canvas installed. Please run this script again.');
}