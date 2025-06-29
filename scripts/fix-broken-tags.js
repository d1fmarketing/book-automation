#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing broken HTML tags in markdown files...\n');

// Find all markdown files in chapters directory
const files = glob.sync('chapters/*.md');

let totalFixed = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let fixedCount = 0;
    
    // Replace all broken closing tags
    const patterns = [
        { broken: /<✏️div>/g, correct: '</div>' },
        { broken: /<✏️h4>/g, correct: '</h4>' },
        { broken: /<✏️li>/g, correct: '</li>' },
        { broken: /<✏️p>/g, correct: '</p>' },
        { broken: /<✏️span>/g, correct: '</span>' },
        { broken: /<✏️table>/g, correct: '</table>' },
        { broken: /<✏️tr>/g, correct: '</tr>' },
        { broken: /<✏️td>/g, correct: '</td>' },
        { broken: /<✏️th>/g, correct: '</th>' },
        { broken: /<✏️ul>/g, correct: '</ul>' }
    ];
    
    patterns.forEach(pattern => {
        const matches = content.match(pattern.broken);
        if (matches) {
            fixedCount += matches.length;
            content = content.replace(pattern.broken, pattern.correct);
        }
    });
    
    if (fixedCount > 0) {
        fs.writeFileSync(file, content);
        console.log(`  ✅ Fixed ${fixedCount} tags in ${path.basename(file)}`);
        totalFixed += fixedCount;
    }
});

console.log(`\n✨ Total tags fixed: ${totalFixed}`);
console.log('🎉 All broken tags have been fixed!');