#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function createPlaceholderCover() {
    const svg = `<svg width="1600" height="2400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#06b6d4;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="50%" y="40%" text-anchor="middle" fill="white" font-size="72" font-family="Arial, sans-serif" font-weight="bold">
    What's One Brutal Truth
  </text>
  <text x="50%" y="45%" text-anchor="middle" fill="white" font-size="72" font-family="Arial, sans-serif" font-weight="bold">
    You Learned After Starting
  </text>
  <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="72" font-family="Arial, sans-serif" font-weight="bold">
    Your Business?
  </text>
  <text x="50%" y="70%" text-anchor="middle" fill="white" font-size="48" font-family="Arial, sans-serif">
    Real Lessons from the Entrepreneurial Trenches
  </text>
  <text x="50%" y="90%" text-anchor="middle" fill="white" font-size="36" font-family="Arial, sans-serif">
    D1F Enterprises
  </text>
</svg>`;

    const coverPath = 'build/ebooks/whats-one-brutal-truth-you-learned-after-starting-your-busin/assets/images/cover.svg';
    await fs.writeFile(coverPath, svg);
    console.log('✅ Created placeholder cover at:', coverPath);
    
    // Also save as PNG placeholder (just copy SVG for now)
    const pngPath = coverPath.replace('.svg', '.png');
    await fs.copyFile(coverPath, pngPath);
    console.log('✅ Created PNG placeholder at:', pngPath);
}

createPlaceholderCover();