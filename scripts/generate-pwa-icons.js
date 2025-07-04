#!/usr/bin/env node

// Script to generate PWA icons

const fs = require('fs').promises;
const path = require('path');

const ICON_SIZES = [
    16, 32, 72, 96, 128, 144, 152, 192, 384, 512
];

async function generateIcons() {
    console.log('🎨 Generating PWA icons...\n');
    
    try {
        // Create icons directory
        const iconsDir = path.join(process.cwd(), 'icons');
        await fs.mkdir(iconsDir, { recursive: true });
        
        // Generate SVG icon
        const svgIcon = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#2563eb"/>
    <text x="256" y="320" font-family="Arial, sans-serif" font-size="240" font-weight="bold" text-anchor="middle" fill="white">$</text>
    <text x="256" y="420" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="rgba(255,255,255,0.8)">MM</text>
</svg>`;
        
        await fs.writeFile(path.join(iconsDir, 'icon.svg'), svgIcon);
        console.log('✅ Created base SVG icon');
        
        // For each size, create a placeholder HTML file
        // (In production, you'd use a library like sharp to resize actual images)
        for (const size of ICON_SIZES) {
            const htmlIcon = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${size}px;
            height: ${size}px;
            background: #2563eb;
            border-radius: ${size * 0.125}px;
            font-family: Arial, sans-serif;
        }
        .icon {
            color: white;
            font-size: ${size * 0.5}px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="icon">$</div>
</body>
</html>`;
            
            await fs.writeFile(
                path.join(iconsDir, `icon-${size}x${size}.html`),
                htmlIcon
            );
        }
        
        console.log(`✅ Generated ${ICON_SIZES.length} icon placeholder files`);
        
        // Create a simple PNG using Canvas API (placeholder)
        console.log('\n📝 Note: For production, use a proper image generation library');
        console.log('   like Sharp or Canvas to generate actual PNG files');
        
        // Create badge icon
        const badgeHtml = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 72px;
            height: 72px;
            background: #ef4444;
            border-radius: 50%;
            font-family: Arial, sans-serif;
        }
        .badge {
            color: white;
            font-size: 36px;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="badge">!</div>
</body>
</html>`;
        
        await fs.writeFile(path.join(iconsDir, 'badge-72x72.html'), badgeHtml);
        
        console.log('\n✅ Icon placeholders created successfully!');
        console.log('\n🎯 Next steps:');
        console.log('   1. Replace HTML files with actual PNG images');
        console.log('   2. Use a tool like Sharp to generate icons from a master image');
        console.log('   3. Optimize icons for different platforms');
        
    } catch (error) {
        console.error('❌ Error generating icons:', error);
    }
}

// Simple script to generate a real PNG icon using Canvas
async function generateSimplePNGIcon() {
    console.log('\n🖼️  Generating simple PNG icon example...');
    
    // Create a data URL for a simple icon
    const canvas = `<canvas id="icon" width="192" height="192"></canvas>
<script>
    const canvas = document.getElementById('icon');
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#2563eb';
    ctx.roundRect(0, 0, 192, 192, 24);
    ctx.fill();
    
    // Dollar sign
    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 96, 96);
    
    // Convert to data URL
    console.log('Data URL:', canvas.toDataURL('image/png'));
</script>`;
    
    const canvasHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Icon Generator</title>
</head>
<body>
    ${canvas}
    <p>Open browser console to see the data URL</p>
    <p>You can save this as a PNG file</p>
</body>
</html>`;
    
    await fs.writeFile('icons/generate-icon.html', canvasHtml);
    console.log('✅ Created icon generator HTML (open in browser to generate PNG)');
}

// Run the script
generateIcons()
    .then(() => generateSimplePNGIcon())
    .catch(console.error);