#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Reverse map - symbols back to emojis
const emojiRestoration = {
    // Tips and info
    '◆': '💡',
    '★': '✨',
    '⚿': '🔑',
    '▣': '📱',
    '◈': '👛',
    '♫': '🎧',
    '◉': '👓',
    
    // Warnings
    '▲': '⚠️',
    '!': '❗',
    '↯': '⚡',
    
    // Checks
    '✓': '✅',
    '□': '☐',
    '↑': '👆',
    '↓': '👇',
    '→': '➡️',
    '←': '⬅️',
    
    // Numbers
    '①': '1️⃣',
    '②': '2️⃣',
    '③': '3️⃣',
    '④': '4️⃣',
    '⑤': '5️⃣',
    
    // Faces
    '☺': '😊',
    '☹': '😔',
    '?': '🤔',
    
    // Objects
    '⌂': '🏠',
    '◧': '🚗',
    '▢': '🏢',
    '▫': '📦',
    '▤': '📋',
    '▦': '📊',
    '◎': '🎯',
    
    // Time
    '◷': '⏰',
    
    // Communication
    '◌': '💬',
    '@': '📧',
    '◍': '🌐',
    '☎': '📞',
    
    // Other
    '↻': '🔄',
    '▭': '🖼️',
    '⚒': '🛠️',
    '↗': '🚀',
    '▬': '📚',
    
    // Hearts
    '♥': '❤️',
    
    // Status
    '●': '🔴',
    
    // Money
    '$': '💰',
    
    // Weather
    '◊': '☔',
    '*': '❄️',
    '|': '🌡️',
    
    // Medical
    '+': '💊',
    
    // Education
    '/': '✏️',
    
    // Security
    '◇': '🔓',
    
    // Flags
    '▲': '🚩',
    
    // Gender
    '♂': '♂️',
    '♀': '♀️',
    
    // Math
    '×': '✖️',
    '÷': '➗',
    '100': '💯',
    
    // Shapes
    '○': '⭕',
    '□': '🔲',
    '■': '🔳',
    
    // Music
    '♪': '🎵',
    '♫': '🎶',
    '▶': '🔊',
    '◀': '🔇',
    
    // Games
    '⚂': '🎲',
    '♠': '♠️',
    '♦': '♦️',
    '♣': '♣️'
};

// Special restoration for cases where context matters
const contextualRestorations = {
    '◆ DICA': '💡 DICA',
    '◎ COMPROMISSO': '🎯 COMPROMISSO',
    '★ As 10': '🏆 As 10',
    '◉◉': '👥'
};

function restoreEmojisInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let restorationCount = 0;
    
    // First restore contextual replacements
    for (const [symbol, emoji] of Object.entries(contextualRestorations)) {
        const regex = new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = content.match(regex);
        if (matches) {
            restorationCount += matches.length;
            content = content.replace(regex, emoji);
        }
    }
    
    // Then restore individual symbols
    // Sort by length to avoid replacing parts of longer symbols
    const sortedSymbols = Object.keys(emojiRestoration).sort((a, b) => b.length - a.length);
    
    for (const symbol of sortedSymbols) {
        const emoji = emojiRestoration[symbol];
        const regex = new RegExp(symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        const matches = content.match(regex);
        if (matches) {
            restorationCount += matches.length;
            content = content.replace(regex, emoji);
        }
    }
    
    if (restorationCount > 0) {
        fs.writeFileSync(filePath, content);
        console.log(`  ✅ Restored ${restorationCount} emojis in ${path.basename(filePath)}`);
    }
    
    return restorationCount;
}

console.log('🔄 Restoring original emojis...\n');

const chaptersDir = path.join(__dirname, '../chapters');
const files = fs.readdirSync(chaptersDir)
    .filter(f => f.endsWith('.md'))
    .sort();

let totalRestored = 0;

for (const file of files) {
    const filePath = path.join(chaptersDir, file);
    totalRestored += restoreEmojisInFile(filePath);
}

console.log(`\n✨ Total emojis restored: ${totalRestored}`);
console.log('🎉 Emojis have been restored to their colorful glory!');