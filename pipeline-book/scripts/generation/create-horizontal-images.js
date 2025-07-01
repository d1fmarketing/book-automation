#!/usr/bin/env node

/**
 * Create professional HORIZONTAL images for each chapter
 * 16:9 landscape format to not waste vertical space
 */

const fs = require('fs');
const path = require('path');

const colors = {
    primary: '#0066CC',
    secondary: '#00AA44', 
    accent: '#FF6600',
    dark: '#1A1A1A',
    gray: '#7A7A7A',
    lightGray: '#E0E0E0',
    ultraLight: '#F5F5F5',
    white: '#FFFFFF'
};

// Professional HORIZONTAL book cover (16:9)
function createHorizontalCover() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="coverBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#001F3F" />
      <stop offset="50%" style="stop-color:#0066CC" />
      <stop offset="100%" style="stop-color:#00AA44" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1920" height="1080" fill="url(#coverBg)"/>
  
  <!-- Grid pattern -->
  <g opacity="0.1">
    ${Array.from({length: 20}, (_, i) => `<line x1="${i*100}" y1="0" x2="${i*100}" y2="1080" stroke="white" stroke-width="0.5"/>`).join('')}
    ${Array.from({length: 12}, (_, i) => `<line x1="0" y1="${i*100}" x2="1920" y2="${i*100}" stroke="white" stroke-width="0.5"/>`).join('')}
  </g>
  
  <!-- Left side - Title -->
  <g transform="translate(200, 540)">
    <text y="-120" font-family="Inter, Arial" font-size="120" font-weight="100" fill="white" text-anchor="start">THE CLAUDE ELITE</text>
    <text y="0" font-family="Inter, Arial" font-size="120" font-weight="100" fill="white" text-anchor="start">PIPELINE</text>
    <text y="80" font-family="Inter, Arial" font-size="36" font-weight="300" fill="#00AA44" text-anchor="start">Mastering Automated Ebook Creation</text>
    <text y="150" font-family="Inter, Arial" font-size="32" font-weight="200" fill="white" text-anchor="start">Claude Elite Team</text>
  </g>
  
  <!-- Right side - Agent visualization -->
  <g transform="translate(1400, 540)">
    <!-- Central hub -->
    <circle cx="0" cy="0" r="100" fill="none" stroke="white" stroke-width="3" opacity="0.8" filter="url(#glow)"/>
    
    <!-- Five agents in circle -->
    ${Array.from({length: 5}, (_, i) => {
        const angle = (i * 72 - 90) * Math.PI / 180;
        const x = Math.cos(angle) * 200;
        const y = Math.sin(angle) * 200;
        const agentNames = ['CONTENT', 'FORMAT', 'QUALITY', 'MONITOR', 'PUBLISH'];
        return `
        <g transform="translate(${x}, ${y})">
            <circle r="60" fill="white" opacity="0.9"/>
            <text y="5" font-family="Inter, Arial" font-size="16" font-weight="600" text-anchor="middle" fill="${colors.primary}">${agentNames[i]}</text>
        </g>
        <line x1="0" y1="0" x2="${x}" y2="${y}" stroke="white" stroke-width="2" opacity="0.5"/>`;
    }).join('')}
  </g>
</svg>`;
}

// Chapter 1: Pipeline Architecture (Horizontal)
function createChapter1Image() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="${colors.ultraLight}"/>
  
  <text x="960" y="100" font-family="Inter, Arial" font-size="48" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    The Claude Elite Pipeline Architecture
  </text>
  
  <!-- Pipeline flow diagram -->
  <g transform="translate(100, 300)">
    <!-- Input -->
    <rect x="0" y="0" width="200" height="400" fill="white" stroke="${colors.primary}" stroke-width="2" rx="10"/>
    <text x="100" y="50" font-family="Inter, Arial" font-size="24" font-weight="500" text-anchor="middle" fill="${colors.dark}">INPUT</text>
    <text x="100" y="200" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">Markdown</text>
    <text x="100" y="230" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">Chapters</text>
    
    <!-- Arrow -->
    <path d="M 200 200 L 280 200" stroke="${colors.gray}" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
    
    <!-- Five Agents -->
    <g transform="translate(300, 0)">
      ${['Content', 'Format', 'Quality', 'Monitor', 'Publish'].map((agent, i) => `
        <rect x="${i * 220}" y="0" width="200" height="400" fill="white" stroke="${i % 2 ? colors.secondary : colors.primary}" stroke-width="2" rx="10"/>
        <text x="${i * 220 + 100}" y="50" font-family="Inter, Arial" font-size="20" font-weight="500" text-anchor="middle" fill="${colors.dark}">${agent}</text>
        <text x="${i * 220 + 100}" y="80" font-family="Inter, Arial" font-size="16" font-weight="300" text-anchor="middle" fill="${colors.gray}">Agent</text>
        
        <!-- Agent features -->
        <text x="${i * 220 + 100}" y="150" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.dark}">
          ${['• Context tracking', '• Typography', '• Grammar check', '• Real-time stats', '• Distribution'][i]}
        </text>
        <text x="${i * 220 + 100}" y="180" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.dark}">
          ${['• Consistency', '• Layout design', '• Style guide', '• Performance', '• Multi-platform'][i]}
        </text>
        
        ${i < 4 ? `<path d="M ${(i + 1) * 220 - 20} 200 L ${(i + 1) * 220} 200" stroke="${colors.gray}" stroke-width="3" fill="none" marker-end="url(#arrow)"/>` : ''}
      `).join('')}
    </g>
    
    <!-- Output -->
    <g transform="translate(1420, 0)">
      <path d="M 0 200 L 80 200" stroke="${colors.gray}" stroke-width="3" fill="none" marker-end="url(#arrow)"/>
      <rect x="100" y="0" width="200" height="400" fill="white" stroke="${colors.accent}" stroke-width="2" rx="10"/>
      <text x="200" y="50" font-family="Inter, Arial" font-size="24" font-weight="500" text-anchor="middle" fill="${colors.dark}">OUTPUT</text>
      <text x="200" y="180" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">PDF</text>
      <text x="200" y="210" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">EPUB</text>
      <text x="200" y="240" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">Published</text>
    </g>
  </g>
  
  <!-- Arrow marker -->
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="${colors.gray}"/>
    </marker>
  </defs>
  
  <!-- Stats at bottom -->
  <g transform="translate(960, 850)">
    <text font-family="Inter, Arial" font-size="24" font-weight="300" text-anchor="middle" fill="${colors.primary}">
      90% faster • 75% fewer errors • 100% validation rate • 5x productivity
    </text>
  </g>
</svg>`;
}

// Chapter 2: Quality Dashboard (Horizontal)
function createChapter2Image() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#f8f9fa"/>
  
  <text x="960" y="80" font-family="Inter, Arial" font-size="42" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    Quality Agent Dashboard
  </text>
  
  <!-- Three panels side by side -->
  <g transform="translate(100, 150)">
    <!-- Grammar Panel -->
    <rect width="550" height="700" fill="white" stroke="${colors.lightGray}" rx="10"/>
    <rect width="550" height="60" fill="${colors.primary}" rx="10 10 0 0"/>
    <text x="275" y="40" font-family="Inter, Arial" font-size="24" font-weight="400" fill="white" text-anchor="middle">Grammar Analysis</text>
    
    <!-- Sample issues -->
    ${['Passive voice detected', 'Missing comma in compound sentence', 'Inconsistent tense usage'].map((issue, i) => `
      <g transform="translate(30, ${100 + i * 80})">
        <rect width="490" height="60" fill="${colors.ultraLight}" rx="5"/>
        <circle cx="30" cy="30" r="8" fill="${i === 0 ? colors.secondary : colors.accent}"/>
        <text x="55" y="35" font-family="Inter, Arial" font-size="16" font-weight="400" fill="${colors.dark}">${issue}</text>
      </g>
    `).join('')}
    
    <!-- Metrics Panel -->
    <g transform="translate(600, 0)">
      <rect width="550" height="700" fill="white" stroke="${colors.lightGray}" rx="10"/>
      <rect width="550" height="60" fill="${colors.secondary}" rx="10 10 0 0"/>
      <text x="275" y="40" font-family="Inter, Arial" font-size="24" font-weight="400" fill="white" text-anchor="middle">Style Metrics</text>
      
      <!-- Circular progress indicators -->
      <g transform="translate(275, 200)">
        <circle cx="0" cy="0" r="80" fill="none" stroke="${colors.lightGray}" stroke-width="20"/>
        <circle cx="0" cy="0" r="80" fill="none" stroke="${colors.primary}" stroke-width="20" 
                stroke-dasharray="377" stroke-dashoffset="94" transform="rotate(-90)"/>
        <text y="10" font-family="Inter, Arial" font-size="36" font-weight="300" text-anchor="middle" fill="${colors.dark}">85%</text>
        <text y="120" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.gray}">Readability</text>
      </g>
      
      <g transform="translate(275, 400)">
        <rect x="-200" y="0" width="400" height="8" fill="${colors.lightGray}" rx="4"/>
        <rect x="-200" y="0" width="360" height="8" fill="${colors.secondary}" rx="4"/>
        <text y="40" font-family="Inter, Arial" font-size="18" font-weight="300" text-anchor="middle" fill="${colors.dark}">Consistency: 90%</text>
      </g>
    </g>
    
    <!-- AI Suggestions Panel -->
    <g transform="translate(1200, 0)">
      <rect width="550" height="700" fill="white" stroke="${colors.lightGray}" rx="10"/>
      <rect width="550" height="60" fill="${colors.accent}" rx="10 10 0 0"/>
      <text x="275" y="40" font-family="Inter, Arial" font-size="24" font-weight="400" fill="white" text-anchor="middle">AI Insights</text>
      
      <text x="30" y="120" font-family="Inter, Arial" font-size="18" font-weight="400" fill="${colors.dark}">
        ✨ Chapter pacing is excellent
      </text>
      <text x="30" y="160" font-family="Inter, Arial" font-size="18" font-weight="400" fill="${colors.dark}">
        📊 Technical terms well explained
      </text>
      <text x="30" y="200" font-family="Inter, Arial" font-size="18" font-weight="400" fill="${colors.dark}">
        🎯 Consider varying sentence openings
      </text>
      
      <!-- Word cloud visualization -->
      <g transform="translate(275, 400)">
        <text font-family="Inter, Arial" font-size="32" font-weight="300" text-anchor="middle" fill="${colors.primary}">pipeline</text>
        <text x="-100" y="30" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.secondary}">automation</text>
        <text x="80" y="-20" font-family="Inter, Arial" font-size="20" font-weight="300" fill="${colors.accent}">agent</text>
        <text x="-60" y="-40" font-family="Inter, Arial" font-size="18" font-weight="300" fill="${colors.gray}">quality</text>
        <text x="100" y="40" font-family="Inter, Arial" font-size="22" font-weight="300" fill="${colors.primary}">ebook</text>
      </g>
    </g>
  </g>
</svg>`;
}

// Chapter 3: Writing Assistant Interface (Horizontal)
function createChapter3Image() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#1a1a2e"/>
  
  <!-- Window frame -->
  <rect x="50" y="50" width="1820" height="980" fill="#16213e" rx="10"/>
  
  <!-- Title bar -->
  <rect x="50" y="50" width="1820" height="60" fill="#0f3460" rx="10 10 0 0"/>
  <circle cx="90" cy="80" r="10" fill="#ff5555"/>
  <circle cx="120" cy="80" r="10" fill="#ffff55"/>
  <circle cx="150" cy="80" r="10" fill="#55ff55"/>
  <text x="960" y="90" font-family="Inter, Arial" font-size="20" font-weight="400" fill="white" text-anchor="middle">
    🤖 AI Writing Assistant - Real-time Enhancement
  </text>
  
  <!-- Main editor area -->
  <rect x="80" y="130" width="1200" height="700" fill="#0f3460" rx="5"/>
  
  <!-- Editor content with syntax highlighting -->
  <g transform="translate(100, 160)">
    <text font-family="Monaco, monospace" font-size="18" fill="#e94560">## Chapter 3: Implementation</text>
    <text y="40" font-family="Monaco, monospace" font-size="18" fill="#f8f8f2">
      Theory provides understanding, but practice brings mastery.
    </text>
    <text y="70" font-family="Monaco, monospace" font-size="18" fill="#f8f8f2">
      In this chapter, we'll transform knowledge into action,
    </text>
    <text y="100" font-family="Monaco, monospace" font-size="18" fill="#f8f8f2">
      guiding you through creating your first book with the
    </text>
    <text y="130" font-family="Monaco, monospace" font-size="18" fill="#f8f8f2">
      Claude Elite Pipeline.
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
    </text>
    
    <!-- Inline suggestion -->
    <rect x="0" y="150" width="400" height="80" fill="#533483" rx="5" opacity="0.9"/>
    <text x="20" y="180" font-family="Inter, Arial" font-size="16" font-weight="400" fill="white">
      💡 AI Suggestion: Add code example here
    </text>
    <rect x="20" y="195" width="100" height="30" fill="#e94560" rx="5"/>
    <text x="70" y="215" font-family="Inter, Arial" font-size="14" font-weight="500" fill="white" text-anchor="middle">Apply</text>
  </g>
  
  <!-- Side panels -->
  <g transform="translate(1320, 130)">
    <!-- Stats panel -->
    <rect width="520" height="300" fill="#0f3460" rx="5"/>
    <text x="20" y="40" font-family="Inter, Arial" font-size="20" font-weight="400" fill="white">📊 Writing Stats</text>
    
    <g transform="translate(20, 80)">
      <text font-family="Inter, Arial" font-size="48" font-weight="200" fill="#e94560">1,247</text>
      <text y="30" font-family="Inter, Arial" font-size="16" font-weight="300" fill="#f8f8f2">words written</text>
    </g>
    
    <g transform="translate(200, 80)">
      <text font-family="Inter, Arial" font-size="48" font-weight="200" fill="#00d9ff">87%</text>
      <text y="30" font-family="Inter, Arial" font-size="16" font-weight="300" fill="#f8f8f2">humanity score</text>
    </g>
    
    <!-- Progress bar -->
    <rect x="20" y="200" width="480" height="10" fill="#1a1a2e" rx="5"/>
    <rect x="20" y="200" width="410" height="10" fill="#e94560" rx="5"/>
    <text x="20" y="240" font-family="Inter, Arial" font-size="14" font-weight="300" fill="#f8f8f2">Chapter progress: 85%</text>
  </g>
  
  <!-- Grammar panel -->
  <g transform="translate(1320, 450)">
    <rect width="520" height="400" fill="#0f3460" rx="5"/>
    <text x="20" y="40" font-family="Inter, Arial" font-size="20" font-weight="400" fill="white">✏️ Grammar & Style</text>
    
    <!-- Issues -->
    ${['No issues found - great job!', '1 style suggestion available'].map((text, i) => `
      <g transform="translate(20, ${80 + i * 60})">
        <rect width="480" height="50" fill="${i === 0 ? '#16213e' : '#533483'}" rx="5"/>
        <circle cx="25" cy="25" r="8" fill="${i === 0 ? '#55ff55' : '#ffff55'}"/>
        <text x="50" y="30" font-family="Inter, Arial" font-size="16" font-weight="300" fill="white">${text}</text>
      </g>
    `).join('')}
  </g>
  
  <!-- Status bar -->
  <rect x="50" y="970" width="1820" height="60" fill="#0f3460" rx="0 0 10 10"/>
  <text x="80" y="1005" font-family="Inter, Arial" font-size="14" font-weight="300" fill="#f8f8f2">
    Connected • Auto-save enabled • Grammar check: active • Last saved: 2 seconds ago
  </text>
</svg>`;
}

// Chapter 4: Multi-Platform Publishing (Horizontal)
function createChapter4Image() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="${colors.ultraLight}"/>
  
  <text x="960" y="80" font-family="Inter, Arial" font-size="42" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    Multi-Platform Publishing Dashboard
  </text>
  
  <!-- Central book -->
  <g transform="translate(960, 400)">
    <rect x="-100" y="-150" width="200" height="300" fill="${colors.primary}" rx="5"/>
    <text y="0" font-family="Inter, Arial" font-size="24" font-weight="300" fill="white" text-anchor="middle">YOUR</text>
    <text y="40" font-family="Inter, Arial" font-size="24" font-weight="300" fill="white" text-anchor="middle">BOOK</text>
  </g>
  
  <!-- Platform connections -->
  ${[
    { name: 'Amazon KDP', x: 300, y: 300, color: '#FF9900' },
    { name: 'Apple Books', x: 300, y: 500, color: '#A2AAAD' },
    { name: 'Google Play', x: 1620, y: 300, color: '#4285F4' },
    { name: 'Kobo', x: 1620, y: 500, color: '#E32B16' },
    { name: 'Barnes & Noble', x: 960, y: 700, color: '#5A7550' }
  ].map(platform => `
    <g>
      <line x1="960" y1="400" x2="${platform.x}" y2="${platform.y}" stroke="${colors.lightGray}" stroke-width="2" stroke-dasharray="5,5"/>
      <rect x="${platform.x - 120}" y="${platform.y - 40}" width="240" height="80" fill="white" stroke="${platform.color}" stroke-width="2" rx="10"/>
      <text x="${platform.x}" y="${platform.y - 5}" font-family="Inter, Arial" font-size="18" font-weight="500" text-anchor="middle" fill="${colors.dark}">${platform.name}</text>
      <text x="${platform.x}" y="${platform.y + 20}" font-family="Inter, Arial" font-size="14" font-weight="300" text-anchor="middle" fill="${colors.gray}">✓ Optimized</text>
    </g>
  `).join('')}
  
  <!-- Stats -->
  <g transform="translate(960, 900)">
    <rect x="-400" y="-60" width="800" height="120" fill="white" stroke="${colors.lightGray}" stroke-width="2" rx="10"/>
    <text y="-10" font-family="Inter, Arial" font-size="20" font-weight="400" text-anchor="middle" fill="${colors.dark}">
      Publishing to 40+ platforms • One-click distribution • Real-time royalty tracking
    </text>
    <text y="30" font-family="Inter, Arial" font-size="32" font-weight="200" text-anchor="middle" fill="${colors.primary}">
      $45,230 total revenue • 12,847 copies sold
    </text>
  </g>
</svg>`;
}

// Chapter 5: Future Technologies (Horizontal)
function createChapter5Image() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="futureGrad" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color:#0066CC;stop-opacity:0.2" />
      <stop offset="100%" style="stop-color:#001F3F;stop-opacity:1" />
    </radialGradient>
  </defs>
  
  <rect width="1920" height="1080" fill="url(#futureGrad)"/>
  
  <!-- Animated network lines -->
  <g opacity="0.2">
    ${Array.from({length: 30}, (_, i) => {
        const x1 = Math.random() * 1920;
        const y1 = Math.random() * 1080;
        const x2 = Math.random() * 1920;
        const y2 = Math.random() * 1080;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#00AA44" stroke-width="1">
          <animate attributeName="opacity" values="0;1;0" dur="${3 + Math.random() * 2}s" repeatCount="indefinite"/>
        </line>`;
    }).join('')}
  </g>
  
  <text x="960" y="100" font-family="Inter, Arial" font-size="48" font-weight="100" text-anchor="middle" fill="white">
    The Future of Automated Publishing
  </text>
  
  <!-- Future tech cards -->
  <g transform="translate(160, 250)">
    ${[
      { title: 'Neural Writing', desc: 'AI co-creation in real-time', icon: '🧠' },
      { title: 'Instant Translation', desc: '100+ languages simultaneously', icon: '🌍' },
      { title: 'Blockchain Rights', desc: 'Decentralized ownership', icon: '🔗' },
      { title: 'Holographic Books', desc: 'AR/VR reading experiences', icon: '🔮' },
      { title: 'Quantum Processing', desc: 'Infinite story variations', icon: '⚛️' },
      { title: 'Mind Upload', desc: 'Direct thought to text', icon: '💭' }
    ].map((tech, i) => `
      <g transform="translate(${(i % 3) * 550}, ${Math.floor(i / 3) * 250})">
        <rect width="500" height="200" fill="white" opacity="0.1" rx="10"/>
        <rect width="500" height="200" fill="none" stroke="white" stroke-width="2" rx="10" opacity="0.5"/>
        <text x="50" y="60" font-family="Inter, Arial" font-size="48">${tech.icon}</text>
        <text x="130" y="60" font-family="Inter, Arial" font-size="28" font-weight="300" fill="white">${tech.title}</text>
        <text x="130" y="100" font-family="Inter, Arial" font-size="18" font-weight="200" fill="#00AA44">${tech.desc}</text>
        
        <!-- Progress bar -->
        <rect x="50" y="150" width="400" height="4" fill="white" opacity="0.2" rx="2"/>
        <rect x="50" y="150" width="${200 + Math.random() * 200}" height="4" fill="#00AA44" rx="2"/>
      </g>
    `).join('')}
  </g>
  
  <!-- Timeline -->
  <g transform="translate(960, 900)">
    <line x1="-700" y1="0" x2="700" y2="0" stroke="white" stroke-width="2" opacity="0.5"/>
    ${['2024', '2025', '2026', '2027', '2028'].map((year, i) => `
      <g transform="translate(${(i - 2) * 350}, 0)">
        <circle cx="0" cy="0" r="8" fill="#00AA44"/>
        <text y="40" font-family="Inter, Arial" font-size="20" font-weight="300" fill="white" text-anchor="middle">${year}</text>
      </g>
    `).join('')}
  </g>
</svg>`;
}

// Generate all horizontal images
const images = [
    { name: 'cover-horizontal.svg', content: createHorizontalCover() },
    { name: 'chapter-01-architecture-horizontal.svg', content: createChapter1Image() },
    { name: 'chapter-02-quality-horizontal.svg', content: createChapter2Image() },
    { name: 'chapter-03-assistant-horizontal.svg', content: createChapter3Image() },
    { name: 'chapter-04-publishing-horizontal.svg', content: createChapter4Image() },
    { name: 'chapter-05-future-horizontal.svg', content: createChapter5Image() }
];

console.log('🎨 Creating HORIZONTAL professional images...\n');

images.forEach(img => {
    fs.writeFileSync(path.join(__dirname, img.name), img.content);
    console.log(`✅ Created: ${img.name} (16:9 landscape)`);
});

console.log('\n✨ All horizontal images created!');