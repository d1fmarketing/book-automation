#!/usr/bin/env node

/**
 * Generate SVG images for all chapters
 * Creates professional vector illustrations
 */

const fs = require('fs-extra');
const path = require('path');

function generateChapterSVG(chapterNum, title) {
    const gradients = [
        ['#667eea', '#764ba2'], // Chapter 1 - Purple
        ['#f093fb', '#f5576c'], // Chapter 2 - Pink
        ['#4facfe', '#00f2fe'], // Chapter 3 - Blue
        ['#43e97b', '#38f9d7'], // Chapter 4 - Green
        ['#fa709a', '#fee140'], // Chapter 5 - Sunset
    ];
    
    const [startColor, endColor] = gradients[chapterNum - 1] || gradients[0];
    
    return `<svg width="1600" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad${chapterNum}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${startColor};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${endColor};stop-opacity:1" />
    </linearGradient>
    <pattern id="pattern${chapterNum}" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="1600" height="600" fill="url(#grad${chapterNum})"/>
  <rect width="1600" height="600" fill="url(#pattern${chapterNum})"/>
  
  <!-- Decorative circles -->
  <g opacity="0.1">
    ${[...Array(5)].map((_, i) => `
    <circle cx="${(i + 1) * 266}" cy="300" r="${50 + i * 30}" 
            stroke="white" stroke-width="2" fill="none"/>`).join('')}
  </g>
  
  <!-- Geometric lines -->
  <g opacity="0.05">
    ${[...Array(10)].map((_, i) => `
    <line x1="${i * 160}" y1="0" x2="${1600 - i * 160}" y2="600" 
          stroke="white" stroke-width="2"/>`).join('')}
  </g>
  
  <!-- Chapter number -->
  <text x="800" y="250" font-family="Inter, sans-serif" font-size="120" 
        font-weight="bold" text-anchor="middle" fill="white">${chapterNum}</text>
  
  <!-- Top decorative line -->
  <line x1="600" y1="180" x2="1000" y2="180" stroke="white" stroke-width="3"/>
  
  <!-- Chapter title -->
  <text x="800" y="380" font-family="Inter, sans-serif" font-size="40" 
        text-anchor="middle" fill="white">${title}</text>
  
  <!-- Bottom decorative line -->
  <line x1="650" y1="430" x2="950" y2="430" stroke="white" stroke-width="3"/>
  
  <!-- Corner decorations -->
  <g stroke="white" stroke-width="2" fill="none" opacity="0.3">
    <path d="M50,50 L50,20 L20,20"/>
    <path d="M1550,50 L1550,20 L1580,20"/>
    <path d="M50,550 L50,580 L20,580"/>
    <path d="M1550,550 L1550,580 L1580,580"/>
  </g>
</svg>`;
}

function generateCoverSVG() {
    return `<svg width="1600" height="2400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="coverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#764ba2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#312e81;stop-opacity:1" />
    </linearGradient>
    <pattern id="coverPattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
      <circle cx="25" cy="25" r="1" fill="white" opacity="0.05"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="1600" height="2400" fill="url(#coverGrad)"/>
  <rect width="1600" height="2400" fill="url(#coverPattern)"/>
  
  <!-- Concentric circles -->
  <g opacity="0.1">
    ${[...Array(20)].map((_, i) => `
    <circle cx="800" cy="1200" r="${100 + i * 50}" 
            stroke="white" stroke-width="2" fill="none"/>`).join('')}
  </g>
  
  <!-- Title -->
  <text x="800" y="800" font-family="Inter, sans-serif" font-size="120" 
        font-weight="bold" text-anchor="middle" fill="white">The Claude</text>
  <text x="800" y="950" font-family="Inter, sans-serif" font-size="120" 
        font-weight="bold" text-anchor="middle" fill="white">Elite Pipeline</text>
  
  <!-- Decorative line -->
  <line x1="400" y1="1050" x2="1200" y2="1050" stroke="white" stroke-width="4"/>
  
  <!-- Subtitle -->
  <text x="800" y="1200" font-family="Inter, sans-serif" font-size="60" 
        text-anchor="middle" fill="white">Mastering Automated</text>
  <text x="800" y="1300" font-family="Inter, sans-serif" font-size="60" 
        text-anchor="middle" fill="white">Ebook Creation</text>
  
  <!-- Decorative line -->
  <line x1="400" y1="1500" x2="1200" y2="1500" stroke="white" stroke-width="4"/>
  
  <!-- Author -->
  <text x="800" y="1800" font-family="Inter, sans-serif" font-size="50" 
        text-anchor="middle" fill="white">Claude Elite Team</text>
  
  <!-- Border decoration -->
  <rect x="50" y="50" width="1500" height="2300" rx="20" ry="20" 
        stroke="white" stroke-width="2" fill="none" opacity="0.3"/>
  
  <!-- Corner decorations -->
  <g stroke="white" stroke-width="3" fill="none" opacity="0.5">
    <path d="M100,100 L100,50 L50,50 L50,100"/>
    <path d="M1500,100 L1500,50 L1550,50 L1550,100"/>
    <path d="M100,2300 L100,2350 L50,2350 L50,2300"/>
    <path d="M1500,2300 L1500,2350 L1550,2350 L1550,2300"/>
  </g>
</svg>`;
}

async function generateAllSVGs() {
    console.log('🎨 Generating professional SVG images...\n');
    
    const outputDir = path.join(__dirname, '../../assets/images');
    await fs.ensureDir(outputDir);
    
    const chapters = [
        { num: 1, title: 'The Vision of Automated Publishing' },
        { num: 2, title: 'The Five Agents' },
        { num: 3, title: 'Building Your First Book' },
        { num: 4, title: 'Professional Publishing' },
        { num: 5, title: 'The Future of Publishing' }
    ];
    
    // Generate chapter images
    for (const chapter of chapters) {
        console.log(`📸 Generating image for Chapter ${chapter.num}...`);
        
        const svg = generateChapterSVG(chapter.num, chapter.title);
        const outputPath = path.join(outputDir, `chapter-0${chapter.num}-premium.svg`);
        
        await fs.writeFile(outputPath, svg);
        console.log(`   ✓ Saved to ${path.relative(process.cwd(), outputPath)}`);
    }
    
    // Generate cover
    console.log('\n📚 Generating professional cover...');
    const coverSVG = generateCoverSVG();
    const coverPath = path.join(outputDir, 'cover-premium.svg');
    await fs.writeFile(coverPath, coverSVG);
    console.log(`   ✓ Saved professional cover`);
    
    console.log('\n✅ All SVG images generated successfully!');
}

generateAllSVGs().catch(console.error);