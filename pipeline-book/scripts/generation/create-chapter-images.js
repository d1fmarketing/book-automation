#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const colors = {
    primary: '#0066CC',
    secondary: '#00AA44', 
    accent: '#FF6600',
    dark: '#1A1A1A',
    gray: '#7A7A7A',
    lightGray: '#DADADA',
    ultraLight: '#F5F5F5',
    white: '#FFFFFF'
};

// Chapter 2: Quality Agent Interface
function createQualityInterface() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.1"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1600" height="900" fill="${colors.ultraLight}"/>
  
  <!-- Window frame -->
  <rect x="100" y="100" width="1400" height="700" fill="${colors.white}" rx="10" filter="url(#shadow)"/>
  
  <!-- Title bar -->
  <rect x="100" y="100" width="1400" height="60" fill="${colors.dark}" rx="10 10 0 0"/>
  <text x="130" y="140" font-family="Inter, Arial" font-size="24" font-weight="400" fill="${colors.white}">Quality Agent Dashboard</text>
  
  <!-- Window controls -->
  <circle cx="1450" cy="130" r="8" fill="${colors.accent}"/>
  <circle cx="1420" cy="130" r="8" fill="${colors.secondary}"/>
  <circle cx="1390" cy="130" r="8" fill="${colors.primary}"/>
  
  <!-- Content sections -->
  <!-- Grammar Issues Panel -->
  <g transform="translate(130, 200)">
    <rect width="400" height="250" fill="${colors.white}" stroke="${colors.lightGray}" rx="5"/>
    <rect width="400" height="40" fill="${colors.primary}" rx="5 5 0 0"/>
    <text x="20" y="28" font-family="Inter, Arial" font-size="18" font-weight="500" fill="${colors.white}">Grammar Issues</text>
    
    <!-- Issue items -->
    <g transform="translate(20, 60)">
      <rect width="360" height="50" fill="${colors.ultraLight}" rx="5"/>
      <circle cx="25" cy="25" r="8" fill="${colors.accent}"/>
      <text x="45" y="20" font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">Missing comma in compound sentence</text>
      <text x="45" y="35" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.gray}">Line 42: "...pipeline processes data the agents..."</text>
    </g>
    
    <g transform="translate(20, 120)">
      <rect width="360" height="50" fill="${colors.ultraLight}" rx="5"/>
      <circle cx="25" cy="25" r="8" fill="${colors.secondary}"/>
      <text x="45" y="20" font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">Passive voice detected</text>
      <text x="45" y="35" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.gray}">Line 78: "The book was written by..."</text>
    </g>
  </g>
  
  <!-- Style Metrics -->
  <g transform="translate(570, 200)">
    <rect width="400" height="250" fill="${colors.white}" stroke="${colors.lightGray}" rx="5"/>
    <rect width="400" height="40" fill="${colors.secondary}" rx="5 5 0 0"/>
    <text x="20" y="28" font-family="Inter, Arial" font-size="18" font-weight="500" fill="${colors.white}">Style Metrics</text>
    
    <!-- Metrics -->
    <g transform="translate(20, 60)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">Readability Score</text>
      <text x="300" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.primary}" text-anchor="end">8.5/10</text>
      <rect y="30" width="360" height="4" fill="${colors.lightGray}" rx="2"/>
      <rect y="30" width="306" height="4" fill="${colors.primary}" rx="2"/>
    </g>
    
    <g transform="translate(20, 120)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">Sentence Complexity</text>
      <text x="300" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.secondary}" text-anchor="end">Medium</text>
    </g>
    
    <g transform="translate(20, 170)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">Consistency Score</text>
      <text x="300" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.secondary}" text-anchor="end">94%</text>
    </g>
  </g>
  
  <!-- Suggestions -->
  <g transform="translate(1010, 200)">
    <rect width="460" height="250" fill="${colors.white}" stroke="${colors.lightGray}" rx="5"/>
    <rect width="460" height="40" fill="${colors.accent}" rx="5 5 0 0"/>
    <text x="20" y="28" font-family="Inter, Arial" font-size="18" font-weight="500" fill="${colors.white}">AI Suggestions</text>
    
    <g transform="translate(20, 60)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">✨ Consider varying sentence openings in Ch. 3</text>
    </g>
    <g transform="translate(20, 90)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">📊 Technical terms could use more explanation</text>
    </g>
    <g transform="translate(20, 120)">
      <text font-family="Inter, Arial" font-size="14" font-weight="400" fill="${colors.dark}">🎯 Strong narrative flow detected - keep it up!</text>
    </g>
  </g>
  
  <!-- Live preview -->
  <g transform="translate(130, 480)">
    <rect width="1340" height="280" fill="${colors.white}" stroke="${colors.lightGray}" rx="5"/>
    <text x="20" y="30" font-family="Inter, Arial" font-size="16" font-weight="500" fill="${colors.dark}">Live Document Preview</text>
    <line x1="0" y1="50" x2="1340" y2="50" stroke="${colors.lightGray}"/>
    
    <!-- Sample text with highlights -->
    <text x="20" y="80" font-family="Georgia, serif" font-size="14" fill="${colors.dark}">
      The Claude Elite Pipeline represents a paradigm shift in automated publishing.
    </text>
    <rect x="250" y="65" width="60" height="20" fill="${colors.accent}" opacity="0.2" rx="2"/>
    
    <text x="20" y="105" font-family="Georgia, serif" font-size="14" fill="${colors.dark}">
      Each agent <tspan fill="${colors.secondary}" font-weight="600">collaborates</tspan> seamlessly to transform raw text into polished books.
    </text>
  </g>
</svg>`;
}

// Chapter 3: Writing Assistant UI
function createWritingAssistant() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <!-- Dark theme background -->
  <rect width="1600" height="900" fill="#0f172a"/>
  
  <!-- Main editor window -->
  <rect x="50" y="50" width="1100" height="800" fill="#1e293b" rx="10" filter="url(#shadow)"/>
  
  <!-- Editor header -->
  <rect x="50" y="50" width="1100" height="60" fill="#334155" rx="10 10 0 0"/>
  <text x="80" y="88" font-family="Inter, Arial" font-size="20" font-weight="400" fill="#f1f5f9">🤖 AI Writing Assistant - Chapter 3</text>
  
  <!-- Toolbar -->
  <g transform="translate(80, 130)">
    <rect width="120" height="36" fill="#2563eb" rx="6"/>
    <text x="60" y="24" font-family="Inter, Arial" font-size="14" font-weight="500" fill="white" text-anchor="middle">✨ Humanize</text>
    
    <rect x="130" width="120" height="36" fill="#7c3aed" rx="6"/>
    <text x="190" y="24" font-family="Inter, Arial" font-size="14" font-weight="500" fill="white" text-anchor="middle">📝 Check Style</text>
    
    <rect x="260" width="140" height="36" fill="#10b981" rx="6"/>
    <text x="330" y="24" font-family="Inter, Arial" font-size="14" font-weight="500" fill="white" text-anchor="middle">✏️ Grammar Check</text>
  </g>
  
  <!-- Word count -->
  <text x="1070" y="154" font-family="Inter, Arial" font-size="14" font-weight="300" fill="#cbd5e1" text-anchor="end">Words: 1,247</text>
  
  <!-- Editor content -->
  <g transform="translate(80, 200)">
    <text font-family="Monaco, monospace" font-size="16" fill="#f1f5f9">
      <tspan x="0" y="0">## Setting Up Your Environment</tspan>
      <tspan x="0" y="30"></tspan>
      <tspan x="0" y="60">Before crafting your masterpiece, let's ensure your workspace</tspan>
      <tspan x="0" y="90">is properly configured. The pipeline requires minimal setup</tspan>
      <tspan x="0" y="120">but rewards attention to detail.</tspan>
      <tspan x="0" y="150"></tspan>
      <tspan x="0" y="180">### Installation Symphony</tspan>
      <tspan x="0" y="210"></tspan>
      <tspan x="0" y="240">Begin with the orchestrated installation process:</tspan>
    </text>
    
    <!-- Cursor -->
    <rect x="420" y="225" width="2" height="20" fill="#2563eb">
      <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
    </rect>
  </g>
  
  <!-- AI Suggestion popup -->
  <g transform="translate(450, 350)">
    <rect width="300" height="120" fill="#334155" rx="8" filter="url(#shadow)"/>
    <text x="15" y="25" font-family="Inter, Arial" font-size="14" font-weight="500" fill="#f1f5f9">💡 AI Suggestion</text>
    <text x="15" y="50" font-family="Inter, Arial" font-size="13" font-weight="300" fill="#cbd5e1">Consider adding a code example here</text>
    <text x="15" y="70" font-family="Inter, Arial" font-size="13" font-weight="300" fill="#cbd5e1">to illustrate the installation steps.</text>
    <rect x="15" y="85" width="80" height="24" fill="#2563eb" rx="4"/>
    <text x="55" y="101" font-family="Inter, Arial" font-size="12" font-weight="500" fill="white" text-anchor="middle">Apply</text>
  </g>
  
  <!-- Side panel -->
  <rect x="1200" y="50" width="350" height="800" fill="#1e293b" rx="10" filter="url(#shadow)"/>
  
  <!-- Grammar panel -->
  <g transform="translate(1220, 80)">
    <text font-family="Inter, Arial" font-size="18" font-weight="500" fill="#f1f5f9">✏️ Grammar & Spelling</text>
    
    <g transform="translate(0, 40)">
      <rect width="310" height="60" fill="#334155" rx="6"/>
      <circle cx="20" cy="30" r="6" fill="#ef4444"/>
      <text x="35" y="25" font-family="Inter, Arial" font-size="13" font-weight="400" fill="#f1f5f9">Missing article</text>
      <text x="35" y="42" font-family="Inter, Arial" font-size="11" font-weight="300" fill="#94a3b8">"pipeline requires" → "the pipeline requires"</text>
    </g>
    
    <g transform="translate(0, 110)">
      <rect width="310" height="60" fill="#334155" rx="6"/>
      <circle cx="20" cy="30" r="6" fill="#f59e0b"/>
      <text x="35" y="25" font-family="Inter, Arial" font-size="13" font-weight="400" fill="#f1f5f9">Passive voice</text>
      <text x="35" y="42" font-family="Inter, Arial" font-size="11" font-weight="300" fill="#94a3b8">Consider active voice for clarity</text>
    </g>
  </g>
  
  <!-- Humanity score -->
  <g transform="translate(1220, 750)">
    <text font-family="Inter, Arial" font-size="16" font-weight="400" fill="#f1f5f9">Humanity Score</text>
    <text x="280" font-family="Inter, Arial" font-size="24" font-weight="300" fill="#10b981" text-anchor="end">87%</text>
    <rect y="30" width="280" height="6" fill="#334155" rx="3"/>
    <rect y="30" width="244" height="6" fill="#10b981" rx="3"/>
  </g>
</svg>`;
}

// Chapter 4: AI Cover Gallery
function createCoverGallery() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="900" fill="${colors.ultraLight}"/>
  
  <text x="800" y="80" font-family="Inter, Arial" font-size="42" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    AI-Generated Book Covers
  </text>
  
  <!-- Cover variations -->
  <g transform="translate(160, 150)">
    <!-- Cover 1: Minimalist -->
    <g>
      <rect width="240" height="360" fill="${colors.primary}" rx="5" filter="url(#shadow)"/>
      <text x="120" y="180" font-family="Inter, Arial" font-size="24" font-weight="100" fill="white" text-anchor="middle">MINIMAL</text>
      <text x="120" y="380" font-family="Inter, Arial" font-size="14" font-weight="300" fill="${colors.dark}" text-anchor="middle">Clean & Modern</text>
    </g>
    
    <!-- Cover 2: Gradient -->
    <g transform="translate(280, 0)">
      <defs>
        <linearGradient id="coverGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors.secondary}" />
          <stop offset="100%" style="stop-color:${colors.accent}" />
        </linearGradient>
      </defs>
      <rect width="240" height="360" fill="url(#coverGrad2)" rx="5" filter="url(#shadow)"/>
      <text x="120" y="180" font-family="Inter, Arial" font-size="24" font-weight="100" fill="white" text-anchor="middle">VIBRANT</text>
      <text x="120" y="380" font-family="Inter, Arial" font-size="14" font-weight="300" fill="${colors.dark}" text-anchor="middle">Eye-catching</text>
    </g>
    
    <!-- Cover 3: Technical -->
    <g transform="translate(560, 0)">
      <rect width="240" height="360" fill="${colors.dark}" rx="5" filter="url(#shadow)"/>
      <g stroke="${colors.primary}" stroke-width="1" fill="none" opacity="0.5">
        ${Array.from({length: 8}, (_, i) => `<line x1="30" y1="${45 + i*40}" x2="210" y2="${45 + i*40}"/>`).join('')}
      </g>
      <text x="120" y="180" font-family="Inter, Arial" font-size="24" font-weight="100" fill="${colors.primary}" text-anchor="middle">TECHNICAL</text>
      <text x="120" y="380" font-family="Inter, Arial" font-size="14" font-weight="300" fill="${colors.dark}" text-anchor="middle">Professional</text>
    </g>
    
    <!-- Cover 4: Abstract -->
    <g transform="translate(840, 0)">
      <rect width="240" height="360" fill="white" stroke="${colors.lightGray}" rx="5" filter="url(#shadow)"/>
      <circle cx="120" cy="180" r="80" fill="${colors.primary}" opacity="0.2"/>
      <circle cx="80" cy="140" r="60" fill="${colors.secondary}" opacity="0.2"/>
      <circle cx="160" cy="140" r="60" fill="${colors.accent}" opacity="0.2"/>
      <text x="120" y="300" font-family="Inter, Arial" font-size="24" font-weight="100" fill="${colors.dark}" text-anchor="middle">ABSTRACT</text>
      <text x="120" y="380" font-family="Inter, Arial" font-size="14" font-weight="300" fill="${colors.dark}" text-anchor="middle">Artistic</text>
    </g>
  </g>
  
  <!-- Selection indicator -->
  <rect x="440" y="150" width="240" height="360" fill="none" stroke="${colors.primary}" stroke-width="3" rx="5"/>
  <text x="800" y="600" font-family="Inter, Arial" font-size="16" font-weight="400" fill="${colors.primary}" text-anchor="middle">✓ Selected Design</text>
</svg>`;
}

// Chapter 5: Future Vision
function createFutureVision() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="futureGrad" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:0.1" />
      <stop offset="100%" style="stop-color:${colors.dark};stop-opacity:1" />
    </radialGradient>
  </defs>
  
  <!-- Futuristic background -->
  <rect width="1600" height="900" fill="url(#futureGrad)"/>
  
  <!-- Network visualization -->
  <g opacity="0.3">
    ${Array.from({length: 20}, (_, i) => {
        const x1 = Math.random() * 1600;
        const y1 = Math.random() * 900;
        const x2 = Math.random() * 1600;
        const y2 = Math.random() * 900;
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors.primary}" stroke-width="0.5"/>`;
    }).join('')}
  </g>
  
  <!-- Central hologram effect -->
  <g transform="translate(800, 450)">
    <!-- Holographic book -->
    <g opacity="0.8">
      <rect x="-100" y="-150" width="200" height="300" fill="none" stroke="${colors.primary}" stroke-width="2" rx="5"/>
      <rect x="-100" y="-150" width="200" height="300" fill="${colors.primary}" opacity="0.1" rx="5"/>
      
      <!-- Scanning lines -->
      <line x1="-100" y1="-100" x2="100" y2="-100" stroke="${colors.secondary}" stroke-width="1" opacity="0.6">
        <animate attributeName="y1" values="-150;150;-150" dur="3s" repeatCount="indefinite"/>
        <animate attributeName="y2" values="-150;150;-150" dur="3s" repeatCount="indefinite"/>
      </line>
    </g>
    
    <!-- Orbiting elements -->
    <g>
      <circle r="200" fill="none" stroke="${colors.primary}" stroke-width="1" opacity="0.3"/>
      <circle r="250" fill="none" stroke="${colors.secondary}" stroke-width="1" opacity="0.2"/>
      <circle r="300" fill="none" stroke="${colors.accent}" stroke-width="1" opacity="0.1"/>
      
      <!-- Orbiting nodes -->
      <circle cx="200" cy="0" r="10" fill="${colors.primary}"/>
      <circle cx="-200" cy="0" r="10" fill="${colors.secondary}"/>
      <circle cx="0" cy="200" r="10" fill="${colors.accent}"/>
    </g>
  </g>
  
  <!-- Title -->
  <text x="800" y="100" font-family="Inter, Arial" font-size="48" font-weight="100" text-anchor="middle" fill="white">
    The Future of Publishing
  </text>
  
  <!-- Feature cards -->
  <g transform="translate(200, 700)">
    <rect width="200" height="80" fill="${colors.white}" opacity="0.1" rx="10"/>
    <text x="100" y="35" font-family="Inter, Arial" font-size="16" font-weight="400" fill="white" text-anchor="middle">Neural Writing</text>
    <text x="100" y="55" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.lightGray}" text-anchor="middle">AI Co-creation</text>
  </g>
  
  <g transform="translate(500, 700)">
    <rect width="200" height="80" fill="${colors.white}" opacity="0.1" rx="10"/>
    <text x="100" y="35" font-family="Inter, Arial" font-size="16" font-weight="400" fill="white" text-anchor="middle">Instant Translation</text>
    <text x="100" y="55" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.lightGray}" text-anchor="middle">100+ Languages</text>
  </g>
  
  <g transform="translate(800, 700)">
    <rect width="200" height="80" fill="${colors.white}" opacity="0.1" rx="10"/>
    <text x="100" y="35" font-family="Inter, Arial" font-size="16" font-weight="400" fill="white" text-anchor="middle">Blockchain Rights</text>
    <text x="100" y="55" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.lightGray}" text-anchor="middle">Decentralized</text>
  </g>
  
  <g transform="translate(1100, 700)">
    <rect width="200" height="80" fill="${colors.white}" opacity="0.1" rx="10"/>
    <text x="100" y="35" font-family="Inter, Arial" font-size="16" font-weight="400" fill="white" text-anchor="middle">Immersive Reading</text>
    <text x="100" y="55" font-family="Inter, Arial" font-size="12" font-weight="300" fill="${colors.lightGray}" text-anchor="middle">AR/VR Books</text>
  </g>
</svg>`;
}

// Sales Analytics Dashboard
function createAnalyticsDashboard() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1600" height="900" viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg">
  <rect width="1600" height="900" fill="${colors.ultraLight}"/>
  
  <text x="800" y="60" font-family="Inter, Arial" font-size="36" font-weight="200" text-anchor="middle" fill="${colors.dark}">
    Sales Analytics Dashboard
  </text>
  
  <!-- Revenue chart -->
  <g transform="translate(100, 120)">
    <rect width="500" height="300" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">Revenue Trend</text>
    
    <!-- Chart axes -->
    <line x1="60" y1="260" x2="460" y2="260" stroke="${colors.gray}" stroke-width="1"/>
    <line x1="60" y1="60" x2="60" y2="260" stroke="${colors.gray}" stroke-width="1"/>
    
    <!-- Revenue line -->
    <polyline points="60,240 150,200 240,180 330,140 420,100" fill="none" stroke="${colors.primary}" stroke-width="3"/>
    
    <!-- Data points -->
    <circle cx="60" cy="240" r="5" fill="${colors.primary}"/>
    <circle cx="150" cy="200" r="5" fill="${colors.primary}"/>
    <circle cx="240" cy="180" r="5" fill="${colors.primary}"/>
    <circle cx="330" cy="140" r="5" fill="${colors.primary}"/>
    <circle cx="420" cy="100" r="5" fill="${colors.primary}"/>
    
    <!-- Y-axis labels -->
    <text x="40" y="105" font-family="Inter, Arial" font-size="12" fill="${colors.gray}" text-anchor="end">$10k</text>
    <text x="40" y="185" font-family="Inter, Arial" font-size="12" fill="${colors.gray}" text-anchor="end">$5k</text>
    <text x="40" y="265" font-family="Inter, Arial" font-size="12" fill="${colors.gray}" text-anchor="end">$0</text>
  </g>
  
  <!-- Platform breakdown -->
  <g transform="translate(650, 120)">
    <rect width="400" height="300" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">Platform Sales</text>
    
    <!-- Pie chart -->
    <g transform="translate(200, 180)">
      <circle r="80" fill="${colors.primary}"/>
      <path d="M 0,0 L 80,0 A 80,80 0 0,1 -40,69.3 Z" fill="${colors.secondary}"/>
      <path d="M 0,0 L -40,69.3 A 80,80 0 0,1 -40,-69.3 Z" fill="${colors.accent}"/>
      
      <!-- Labels -->
      <text x="100" y="-50" font-family="Inter, Arial" font-size="14" fill="${colors.dark}">Amazon 45%</text>
      <text x="100" y="0" font-family="Inter, Arial" font-size="14" fill="${colors.dark}">Apple 30%</text>
      <text x="100" y="50" font-family="Inter, Arial" font-size="14" fill="${colors.dark}">Others 25%</text>
    </g>
  </g>
  
  <!-- Key metrics -->
  <g transform="translate(1100, 120)">
    <rect width="400" height="140" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">Key Metrics</text>
    
    <g transform="translate(20, 60)">
      <text font-family="Inter, Arial" font-size="48" font-weight="200" fill="${colors.primary}">12,847</text>
      <text y="25" font-family="Inter, Arial" font-size="14" fill="${colors.gray}">Total Sales</text>
    </g>
    
    <g transform="translate(220, 60)">
      <text font-family="Inter, Arial" font-size="48" font-weight="200" fill="${colors.secondary}">4.7</text>
      <text y="25" font-family="Inter, Arial" font-size="14" fill="${colors.gray}">Avg Rating</text>
    </g>
  </g>
  
  <!-- Conversion funnel -->
  <g transform="translate(1100, 280)">
    <rect width="400" height="140" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">Conversion Funnel</text>
    
    <g transform="translate(50, 60)">
      <rect width="300" height="20" fill="${colors.lightGray}" rx="10"/>
      <rect width="300" height="20" fill="${colors.primary}" rx="10"/>
      <text x="310" y="15" font-family="Inter, Arial" font-size="12" fill="${colors.gray}">Views: 45,230</text>
    </g>
    
    <g transform="translate(80, 90)">
      <rect width="240" height="20" fill="${colors.lightGray}" rx="10"/>
      <rect width="200" height="20" fill="${colors.secondary}" rx="10"/>
      <text x="250" y="15" font-family="Inter, Arial" font-size="12" fill="${colors.gray}">Samples: 12,450</text>
    </g>
  </g>
  
  <!-- Reader engagement -->
  <g transform="translate(100, 450)">
    <rect width="950" height="300" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">Reader Engagement</text>
    
    <!-- Heatmap visualization -->
    <g transform="translate(50, 80)">
      <text font-family="Inter, Arial" font-size="14" fill="${colors.gray}">Reading Completion by Chapter</text>
      
      <!-- Chapter bars -->
      ${Array.from({length: 10}, (_, i) => {
        const height = 150 - (i * 10);
        const opacity = 1 - (i * 0.08);
        return `
          <g transform="translate(${i * 80}, 30)">
            <rect width="60" height="${height}" y="${150 - height}" fill="${colors.primary}" opacity="${opacity}" rx="5"/>
            <text x="30" y="170" font-family="Inter, Arial" font-size="12" fill="${colors.gray}" text-anchor="middle">Ch ${i + 1}</text>
            <text x="30" y="${145 - height}" font-family="Inter, Arial" font-size="12" fill="${colors.dark}" text-anchor="middle">${100 - i * 7}%</text>
          </g>
        `;
      }).join('')}
    </g>
  </g>
  
  <!-- Predictions -->
  <g transform="translate(1100, 450)">
    <rect width="400" height="300" fill="white" stroke="${colors.lightGray}" rx="10" filter="url(#shadow)"/>
    <text x="20" y="35" font-family="Inter, Arial" font-size="20" font-weight="400" fill="${colors.dark}">AI Predictions</text>
    
    <g transform="translate(20, 80)">
      <rect width="360" height="60" fill="${colors.ultraLight}" rx="5"/>
      <text x="20" y="30" font-family="Inter, Arial" font-size="16" font-weight="400" fill="${colors.dark}">Next Month Revenue</text>
      <text x="20" y="50" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.primary}">$15,200</text>
      <text x="340" y="50" font-family="Inter, Arial" font-size="14" fill="${colors.secondary}" text-anchor="end">↑ 18%</text>
    </g>
    
    <g transform="translate(20, 160)">
      <rect width="360" height="60" fill="${colors.ultraLight}" rx="5"/>
      <text x="20" y="30" font-family="Inter, Arial" font-size="16" font-weight="400" fill="${colors.dark}">Optimal Price Point</text>
      <text x="20" y="50" font-family="Inter, Arial" font-size="24" font-weight="300" fill="${colors.primary}">$4.99</text>
      <text x="340" y="50" font-family="Inter, Arial" font-size="14" fill="${colors.gray}" text-anchor="end">Max profit</text>
    </g>
  </g>
</svg>`;
}

const chapterImages = [
    { name: 'chapter-02-quality-pro.svg', content: createQualityInterface() },
    { name: 'chapter-03-assistant-pro.svg', content: createWritingAssistant() },
    { name: 'chapter-04-covers-pro.svg', content: createCoverGallery() },
    { name: 'chapter-04-analytics-pro.svg', content: createAnalyticsDashboard() },
    { name: 'chapter-05-future-pro.svg', content: createFutureVision() }
];

console.log('🎨 Creating professional chapter images...\n');

chapterImages.forEach(img => {
    fs.writeFileSync(path.join(__dirname, img.name), img.content);
    console.log(`✅ Created: ${img.name}`);
});

console.log('\n✨ All professional images created!');