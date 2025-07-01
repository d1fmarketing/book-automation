#!/usr/bin/env node

/**
 * Generate professional images for The Claude Elite Pipeline ebook
 * Creates high-quality visual assets for cover and chapters
 */

const fs = require('fs');
const path = require('path');

// Professional color palette
const colors = {
    primary: '#0066CC',
    secondary: '#00AA44', 
    accent: '#FF6600',
    dark: '#1A1A1A',
    gray: '#4A4A4A',
    lightGray: '#E0E0E0',
    ultraLight: '#F5F5F5',
    white: '#FFFFFF',
    gradient1: '#0066CC',
    gradient2: '#00AA44',
    gradient3: '#FF6600'
};

// Professional SVG Cover
function createProfessionalCover() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1800" height="2700" viewBox="0 0 1800 2700" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Professional gradient background -->
    <linearGradient id="coverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.gradient1};stop-opacity:1" />
      <stop offset="50%" style="stop-color:${colors.gradient2};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.gradient3};stop-opacity:1" />
    </linearGradient>
    
    <!-- Mesh pattern overlay -->
    <pattern id="mesh" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="1" fill="${colors.white}" opacity="0.1"/>
      <path d="M 0 50 L 100 50 M 50 0 L 50 100" stroke="${colors.white}" stroke-width="0.5" opacity="0.05"/>
    </pattern>
    
    <!-- Glow effect -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Drop shadow -->
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="20" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Background gradient -->
  <rect width="1800" height="2700" fill="url(#coverGrad)"/>
  
  <!-- Mesh overlay -->
  <rect width="1800" height="2700" fill="url(#mesh)"/>
  
  <!-- Abstract pipeline visualization -->
  <g transform="translate(900, 1350)">
    <!-- Central core -->
    <circle cx="0" cy="0" r="150" fill="none" stroke="${colors.white}" stroke-width="3" opacity="0.9" filter="url(#glow)"/>
    <circle cx="0" cy="0" r="100" fill="${colors.white}" opacity="0.1"/>
    
    <!-- Agent nodes in pentagon formation -->
    <g id="agents">
      <!-- Content Agent - Top -->
      <g transform="translate(0, -350)">
        <circle r="80" fill="${colors.white}" opacity="0.95" filter="url(#shadow)"/>
        <text y="5" font-family="Inter, Arial" font-size="24" font-weight="600" text-anchor="middle" fill="${colors.primary}">CONTENT</text>
      </g>
      
      <!-- Format Agent - Top Right -->
      <g transform="translate(333, -108)">
        <circle r="80" fill="${colors.white}" opacity="0.95" filter="url(#shadow)"/>
        <text y="5" font-family="Inter, Arial" font-size="24" font-weight="600" text-anchor="middle" fill="${colors.primary}">FORMAT</text>
      </g>
      
      <!-- Quality Agent - Bottom Right -->
      <g transform="translate(206, 283)">
        <circle r="80" fill="${colors.white}" opacity="0.95" filter="url(#shadow)"/>
        <text y="5" font-family="Inter, Arial" font-size="24" font-weight="600" text-anchor="middle" fill="${colors.primary}">QUALITY</text>
      </g>
      
      <!-- Monitor Agent - Bottom Left -->
      <g transform="translate(-206, 283)">
        <circle r="80" fill="${colors.white}" opacity="0.95" filter="url(#shadow)"/>
        <text y="5" font-family="Inter, Arial" font-size="24" font-weight="600" text-anchor="middle" fill="${colors.primary}">MONITOR</text>
      </g>
      
      <!-- Publish Agent - Top Left -->
      <g transform="translate(-333, -108)">
        <circle r="80" fill="${colors.white}" opacity="0.95" filter="url(#shadow)"/>
        <text y="5" font-family="Inter, Arial" font-size="24" font-weight="600" text-anchor="middle" fill="${colors.primary}">PUBLISH</text>
      </g>
    </g>
    
    <!-- Connection lines -->
    <g stroke="${colors.white}" stroke-width="2" fill="none" opacity="0.6">
      <path d="M 0,-150 L 0,-270"/>
      <path d="M 130,-75 L 253,-108"/>
      <path d="M 130,75 L 206,203"/>
      <path d="M -130,75 L -206,203"/>
      <path d="M -130,-75 L -253,-108"/>
      <!-- Pentagon connections -->
      <path d="M 0,-350 L 333,-108 L 206,283 L -206,283 L -333,-108 Z" stroke-width="1" opacity="0.3"/>
    </g>
    
    <!-- Animated particles (static representation) -->
    <g opacity="0.8">
      <circle cx="0" cy="-200" r="3" fill="${colors.white}"/>
      <circle cx="150" cy="-50" r="3" fill="${colors.white}"/>
      <circle cx="100" cy="150" r="3" fill="${colors.white}"/>
      <circle cx="-100" cy="150" r="3" fill="${colors.white}"/>
      <circle cx="-150" cy="-50" r="3" fill="${colors.white}"/>
    </g>
  </g>
  
  <!-- Title section with backdrop -->
  <rect x="150" y="350" width="1500" height="400" fill="${colors.dark}" opacity="0.8" rx="20"/>
  
  <!-- Main title -->
  <text x="900" y="480" font-family="Inter, Arial" font-size="120" font-weight="100" text-anchor="middle" fill="${colors.white}">
    THE CLAUDE ELITE
  </text>
  <text x="900" y="620" font-family="Inter, Arial" font-size="120" font-weight="100" text-anchor="middle" fill="${colors.white}">
    PIPELINE
  </text>
  
  <!-- Tagline -->
  <rect x="300" y="2000" width="1200" height="100" fill="${colors.white}" opacity="0.9" rx="10"/>
  <text x="900" y="2065" font-family="Inter, Arial" font-size="48" font-weight="300" text-anchor="middle" fill="${colors.dark}">
    Mastering Automated Ebook Creation
  </text>
  
  <!-- Author -->
  <text x="900" y="2300" font-family="Inter, Arial" font-size="60" font-weight="200" text-anchor="middle" fill="${colors.white}">
    Claude Elite Team
  </text>
  
  <!-- Decorative elements -->
  <g opacity="0.3">
    <rect x="100" y="2500" width="200" height="2" fill="${colors.white}"/>
    <rect x="1500" y="2500" width="200" height="2" fill="${colors.white}"/>
  </g>
</svg>`;
}

// Chapter 1: Architecture Visualization
function createArchitectureImage() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="archGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.ultraLight}" />
      <stop offset="100%" style="stop-color:${colors.white}" />
    </linearGradient>
    <filter id="cardShadow">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1600" height="900" fill="url(#archGrad)"/>
  
  <!-- Grid -->
  <g stroke="${colors.lightGray}" stroke-width="0.5" opacity="0.3">
    ${Array.from({length: 16}, (_, i) => `<line x1="${i*100}" y1="0" x2="${i*100}" y2="900"/>`).join('')}
    ${Array.from({length: 9}, (_, i) => `<line x1="0" y1="${i*100}" x2="1600" y2="${i*100}"/>`).join('')}
  </g>
  
  <!-- Title -->
  <text x="800" y="80" font-family="Inter, Arial" font-size="48" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    Five-Agent Architecture
  </text>
  
  <!-- Central Hub -->
  <g transform="translate(800, 450)">
    <rect x="-100" y="-60" width="200" height="120" fill="${colors.white}" stroke="${colors.primary}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
    <text y="-10" font-family="Inter, Arial" font-size="24" font-weight="400" text-anchor="middle" fill="${colors.dark}">Pipeline Core</text>
    <text y="20" font-family="Inter, Arial" font-size="16" font-weight="300" text-anchor="middle" fill="${colors.gray}">Event-Driven Hub</text>
  </g>
  
  <!-- Agent Cards -->
  <g id="agent-cards">
    <!-- Content Agent -->
    <g transform="translate(800, 200)">
      <rect x="-120" y="-50" width="240" height="100" fill="${colors.white}" stroke="${colors.primary}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
      <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">Content Agent</text>
      <text y="15" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">Narrative Intelligence</text>
      <circle cx="90" cy="-25" r="8" fill="${colors.secondary}"/>
    </g>
    
    <!-- Format Agent -->
    <g transform="translate(1100, 350)">
      <rect x="-120" y="-50" width="240" height="100" fill="${colors.white}" stroke="${colors.secondary}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
      <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">Format Agent</text>
      <text y="15" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">Typography Master</text>
      <circle cx="90" cy="-25" r="8" fill="${colors.primary}"/>
    </g>
    
    <!-- Quality Agent -->
    <g transform="translate(1100, 550)">
      <rect x="-120" y="-50" width="240" height="100" fill="${colors.white}" stroke="${colors.accent}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
      <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">Quality Agent</text>
      <text y="15" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">Editorial Excellence</text>
      <circle cx="90" cy="-25" r="8" fill="${colors.secondary}"/>
    </g>
    
    <!-- Monitor Agent -->
    <g transform="translate(500, 550)">
      <rect x="-120" y="-50" width="240" height="100" fill="${colors.white}" stroke="${colors.primary}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
      <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">Monitor Agent</text>
      <text y="15" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">Real-time Analytics</text>
      <circle cx="90" cy="-25" r="8" fill="${colors.accent}"/>
    </g>
    
    <!-- Publish Agent -->
    <g transform="translate(500, 350)">
      <rect x="-120" y="-50" width="240" height="100" fill="${colors.white}" stroke="${colors.secondary}" stroke-width="2" rx="10" filter="url(#cardShadow)"/>
      <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">Publish Agent</text>
      <text y="15" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">Distribution Pro</text>
      <circle cx="90" cy="-25" r="8" fill="${colors.primary}"/>
    </g>
  </g>
  
  <!-- Connection Lines with arrows -->
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${colors.gray}"/>
    </marker>
  </defs>
  
  <g stroke="${colors.gray}" stroke-width="2" fill="none" marker-end="url(#arrowhead)">
    <line x1="800" y1="300" x2="800" y2="380"/>
    <line x1="880" y1="420" x2="970" y2="350"/>
    <line x1="880" y1="480" x2="970" y2="550"/>
    <line x1="720" y1="480" x2="630" y2="550"/>
    <line x1="720" y1="420" x2="630" y2="350"/>
  </g>
</svg>`;
}

// Generate all professional images
const images = [
    { 
        name: 'cover-professional.svg', 
        content: createProfessionalCover(),
        description: 'Professional book cover with 5-agent visualization'
    },
    { 
        name: 'chapter-01-architecture-pro.svg', 
        content: createArchitectureImage(),
        description: 'Detailed architecture diagram with modern design'
    }
];

console.log('🎨 Generating professional images...\n');

images.forEach(img => {
    const filePath = path.join(__dirname, img.name);
    fs.writeFileSync(filePath, img.content);
    console.log(`✅ Created: ${img.name}`);
    console.log(`   ${img.description}\n`);
});

console.log('📝 Next: Convert these SVGs to high-resolution JPGs for the PDF');