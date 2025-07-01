#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Console colors
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m'
};

// Map of emojis to professional Unicode symbols or HTML entities
const emojiReplacements = {
    // Tips and info
    '💡': '◆', // Diamond for tips
    '✨': '★', // Star
    '🔑': '⚿', // Key symbol
    '📱': '▣', // Mobile/tech symbol
    '👛': '◈', // Wallet/purse
    '🎧': '♫', // Music/headphones
    '🕶️': '◉', // Glasses
    '👓': '◉', // Glasses alternative
    
    // Warnings and alerts
    '⚠️': '▲', // Warning triangle
    '🚨': '!', // Alert
    '❗': '!', // Exclamation
    '⚡': '↯', // Lightning/energy
    
    // Actions and checks
    '✅': '✓', // Checkmark
    '☐': '□', // Checkbox empty
    '✓': '✓', // Already a checkmark
    '👆': '↑', // Up arrow
    '👇': '↓', // Down arrow
    '➡️': '→', // Right arrow
    '⬅️': '←', // Left arrow
    
    // Numbers and bullets
    '1️⃣': '①', // Circled 1
    '2️⃣': '②', // Circled 2
    '3️⃣': '③', // Circled 3
    '4️⃣': '④', // Circled 4
    '5️⃣': '⑤', // Circled 5
    
    // Emotions and people
    '😊': '☺', // Smiley
    '😔': '☹', // Sad
    '🤔': '?', // Thinking
    '👤': '◉', // Person
    '👥': '◉◉', // People
    
    // Objects and things
    '🏠': '⌂', // House
    '🚗': '◧', // Car
    '🏢': '▢', // Building
    '📦': '▫', // Box/package
    '📋': '▤', // Clipboard
    '📊': '▦', // Chart
    '🎯': '◎', // Target
    '🏆': '★', // Trophy
    '🎮': '▣', // Game controller
    
    // Time and calendar
    '⏰': '◷', // Clock/alarm
    '📅': '▦', // Calendar
    '⏱️': '◷', // Timer
    
    // Communication
    '💬': '◌', // Speech bubble
    '📧': '@', // Email
    '🌐': '◍', // Globe/web
    '📞': '☎', // Phone
    
    // Misc
    '🔄': '↻', // Refresh/sync
    '🎨': '◆', // Art/color
    '🖼️': '▭', // Image/picture
    '🏷️': '◈', // Tag/label
    '🛠️': '⚒', // Tools
    '🧠': '◎', // Brain
    '💪': '◆', // Strong/muscle
    '🎉': '★', // Celebration
    '🚀': '↗', // Rocket/launch
    '🔍': '◎', // Search/magnifier
    '📚': '▬', // Books
    '🎁': '◈', // Gift
    '🌟': '★', // Star
    
    // Faces and expressions
    '🤖': '[AI]', // Robot
    '😄': '☺', // Happy
    '😎': '◉', // Cool
    '🥳': '★', // Party
    
    // Nature
    '🌈': '~', // Rainbow
    '☀️': '☼', // Sun
    '🌙': '☾', // Moon
    '⭐': '★', // Star
    
    // Food
    '☕': '◉', // Coffee
    '🍎': '◉', // Apple/food
    
    // Hearts and love
    '❤️': '♥', // Heart
    '💚': '♥', // Green heart
    '💙': '♥', // Blue heart
    '🧡': '♥', // Orange heart
    
    // Hands
    '👍': '+', // Thumbs up
    '👎': '-', // Thumbs down
    '👏': '!', // Clapping
    '🙏': '!', // Prayer/thanks
    '✋': '!', // Hand/stop
    '🤝': '&', // Handshake
    
    // Arrows and directions
    '⬆️': '↑', // Up
    '⬇️': '↓', // Down
    '↩️': '↩', // Return
    '↪️': '↪', // Forward
    
    // Status
    '🔴': '●', // Red circle
    '🟢': '●', // Green circle
    '🟡': '●', // Yellow circle
    '🔵': '●', // Blue circle
    
    // Tech
    '💻': '▣', // Computer
    '🖥️': '▣', // Desktop
    '⌨️': '▤', // Keyboard
    '🖱️': '◉', // Mouse
    '💾': '▫', // Save/disk
    '📲': '▣', // Mobile with arrow
    
    // Money
    '💰': '$', // Money bag
    '💵': '$', // Dollar
    '💳': '▬', // Credit card
    
    // Transport
    '✈️': '↗', // Airplane
    '🚂': '→', // Train
    '🚶': '◉', // Walking
    '🏃': '◉', // Running
    
    // Weather
    '☔': '◊', // Rain/umbrella
    '❄️': '*', // Snow
    '🌡️': '|', // Temperature
    
    // Medical
    '💊': '◉', // Pill
    '🏥': '▢', // Hospital
    '🩺': '+', // Medical
    
    // Education
    '🎓': '◎', // Graduation
    '✏️': '/', // Pencil
    '📝': '▤', // Note
    
    // Security
    '🔒': '◈', // Lock
    '🔓': '◇', // Unlock
    '🔐': '◈', // Key lock
    '🛡️': '◊', // Shield
    
    // Flags and signals
    '🚩': '▲', // Red flag
    '🏁': '▦', // Checkered flag
    '🎌': '◉', // Crossed flags
    
    // Gender
    '♂️': '♂', // Male
    '♀️': '♀', // Female
    
    // Punctuation
    '❓': '?', // Question
    '❔': '?', // White question
    '❕': '!', // White exclamation
    '‼️': '!!', // Double exclamation
    
    // Math and symbols
    '➕': '+', // Plus
    '➖': '-', // Minus
    '✖️': '×', // Multiply
    '➗': '÷', // Divide
    '💯': '100', // 100
    
    // Shapes
    '⭕': '○', // Circle
    '🔲': '□', // Square
    '🔳': '■', // Filled square
    '🔶': '◆', // Diamond
    '🔷': '◇', // Diamond outline
    
    // Music
    '🎵': '♪', // Music note
    '🎶': '♫', // Music notes
    '🔊': '▶', // Speaker
    '🔇': '◀', // Muted
    
    // Games
    '🎲': '⚂', // Dice
    '♠️': '♠', // Spades
    '♥️': '♥', // Hearts
    '♦️': '♦', // Diamonds
    '♣️': '♣', // Clubs
    
    // Zodiac
    '♈': '♈', // Aries
    '♉': '♉', // Taurus
    '♊': '♊', // Gemini
    '♋': '♋', // Cancer
    '♌': '♌', // Leo
    '♍': '♍', // Virgo
    '♎': '♎', // Libra
    '♏': '♏', // Scorpio
    '♐': '♐', // Sagittarius
    '♑': '♑', // Capricorn
    '♒': '♒', // Aquarius
    '♓': '♓' // Pisces
};

function replaceEmojisInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let replacementCount = 0;
    
    // Replace each emoji
    for (const [emoji, replacement] of Object.entries(emojiReplacements)) {
        const regex = new RegExp(emoji, 'g');
        const matches = modifiedContent.match(regex);
        if (matches) {
            replacementCount += matches.length;
            modifiedContent = modifiedContent.replace(regex, replacement);
        }
    }
    
    if (replacementCount > 0) {
        fs.writeFileSync(filePath, modifiedContent);
        console.log(`  ${colors.green}✓${colors.reset} Replaced ${replacementCount} emojis in ${path.basename(filePath)}`);
    }
    
    return replacementCount;
}

function processDirectory(dirPath) {
    console.log(`${colors.green}${colors.bright}🔄 Replacing emojis with professional symbols...${colors.reset}`);
    
    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.md'))
        .sort();
    
    let totalReplacements = 0;
    
    console.log(`${colors.blue}📁 Processing ${files.length} markdown files...${colors.reset}`);
    
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        totalReplacements += replaceEmojisInFile(filePath);
    }
    
    console.log(`\n${colors.green}${colors.bright}✅ Emoji replacement complete!${colors.reset}`);
    console.log(`${colors.cyan}Total replacements: ${totalReplacements}${colors.reset}`);
    
    // Also update the generator script to use icon font
    const generatorPath = path.join(__dirname, 'pdf-presets/professional.js');
    if (fs.existsSync(generatorPath)) {
        console.log(`\n${colors.blue}📝 Updating PDF generator preset...${colors.reset}`);
        let generatorContent = fs.readFileSync(generatorPath, 'utf8');
        
        // Add icon font CSS
        const iconFontCSS = `
        /* Professional icon font */
        @font-face {
            font-family: 'BookIcons';
            src: local('Arial Unicode MS'), local('Symbola'), local('DejaVu Sans');
            font-weight: normal;
            font-style: normal;
        }
        
        .icon {
            font-family: 'BookIcons', 'Arial Unicode MS', 'Symbola', sans-serif;
            font-size: 1.1em;
            line-height: 1;
            display: inline-block;
            vertical-align: middle;
            margin: 0 0.1em;
        }`;
        
        // Insert icon font CSS if not already present
        if (!generatorContent.includes('BookIcons')) {
            generatorContent = generatorContent.replace(
                '/* Professional Color Palette - CMYK-friendly */',
                iconFontCSS + '\n        \n        /* Professional Color Palette - CMYK-friendly */'
            );
            fs.writeFileSync(generatorPath, generatorContent);
            console.log(`  ${colors.green}✓${colors.reset} Added icon font CSS to generator`);
        }
    }
}

// Run if called directly
if (require.main === module) {
    const chaptersDir = path.join(__dirname, '../chapters');
    
    if (fs.existsSync(chaptersDir)) {
        processDirectory(chaptersDir);
    } else {
        console.error(`${colors.red}❌ Chapters directory not found: ${chaptersDir}${colors.reset}`);
        process.exit(1);
    }
}

module.exports = { replaceEmojisInFile, emojiReplacements };