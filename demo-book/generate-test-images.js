#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');

async function generateTestImages() {
    console.log('🎨 Generating test images for demo book...');
    
    // Generate a simple test cover (1800x2700)
    const coverSvg = `
    <svg width="1800" height="2700">
        <rect width="1800" height="2700" fill="#1a1a2e"/>
        <rect x="100" y="100" width="1600" height="2500" fill="#16213e" stroke="#0f3460" stroke-width="4"/>
        <text x="900" y="800" font-family="Arial" font-size="120" fill="#e94560" text-anchor="middle" font-weight="bold">
            PIPELINE
        </text>
        <text x="900" y="950" font-family="Arial" font-size="100" fill="#e94560" text-anchor="middle">
            SANITY CHECK
        </text>
        <text x="900" y="1200" font-family="Arial" font-size="60" fill="#f5f5f5" text-anchor="middle">
            A Test Book for Validating
        </text>
        <text x="900" y="1300" font-family="Arial" font-size="60" fill="#f5f5f5" text-anchor="middle">
            the Claude Elite Pipeline
        </text>
        <rect x="400" y="1500" width="1000" height="600" fill="none" stroke="#0f3460" stroke-width="3"/>
        <circle cx="650" cy="1800" r="50" fill="#e94560"/>
        <circle cx="900" cy="1800" r="50" fill="#0f3460"/>
        <circle cx="1150" cy="1800" r="50" fill="#16213e"/>
        <text x="900" y="2400" font-family="Arial" font-size="50" fill="#666" text-anchor="middle">
            Claude Elite Test Suite
        </text>
    </svg>`;
    
    // Generate cover
    await sharp(Buffer.from(coverSvg))
        .jpeg({ quality: 90 })
        .toFile(path.join(__dirname, 'assets/images/cover.jpg'));
    
    console.log('✅ Generated cover.jpg');
    
    // Generate chapter illustrations
    const chapterImages = [
        { file: 'ch1-architecture.png', title: 'Pipeline Architecture' },
        { file: 'ch1-components.png', title: 'Component Overview' },
        { file: 'ch2-locking.png', title: 'File Locking Flow' },
        { file: 'ch2-trash.png', title: 'Trash Structure' },
        { file: 'ch2-checkpoint.png', title: 'Checkpoint System' },
        { file: 'ch3-auth.png', title: 'WebSocket Auth' },
        { file: 'ch3-monitoring.png', title: 'Rate Limiting' },
        { file: 'ch4-flow.png', title: 'Complete Flow' },
        { file: 'ch4-recovery.png', title: 'Error Recovery' }
    ];
    
    for (const img of chapterImages) {
        const svg = `
        <svg width="1200" height="800">
            <rect width="1200" height="800" fill="#f0f0f0"/>
            <rect x="50" y="50" width="1100" height="700" fill="white" stroke="#ddd" stroke-width="2"/>
            <text x="600" y="150" font-family="Arial" font-size="48" fill="#333" text-anchor="middle" font-weight="bold">
                ${img.title}
            </text>
            <rect x="200" y="250" width="800" height="400" fill="#f8f8f8" stroke="#ccc" stroke-width="2"/>
            <text x="600" y="450" font-family="Arial" font-size="36" fill="#666" text-anchor="middle">
                [Placeholder Diagram]
            </text>
            <text x="600" y="500" font-family="Arial" font-size="24" fill="#999" text-anchor="middle">
                ${img.file}
            </text>
        </svg>`;
        
        await sharp(Buffer.from(svg))
            .png()
            .toFile(path.join(__dirname, 'assets/images', img.file));
        
        console.log(`✅ Generated ${img.file}`);
    }
    
    console.log('\\n🎉 All test images generated successfully!');
}

// Run if called directly
if (require.main === module) {
    generateTestImages().catch(console.error);
}

module.exports = { generateTestImages };