const fs = require('fs');
const pdf = require('pdf-parse');

async function analyzePDF(filename) {
    console.log(`\n📚 COMPREHENSIVE PDF ANALYSIS: ${filename}\n`);
    console.log('═'.repeat(80));
    
    try {
        const dataBuffer = fs.readFileSync(filename);
        const data = await pdf(dataBuffer);
        
        console.log(`\n📊 BASIC INFO:`);
        console.log(`  Pages: ${data.numpages}`);
        console.log(`  PDF Version: ${data.version}`);
        console.log(`  Title: ${data.info?.Title || 'Not found'}`);
        console.log(`  Author: ${data.info?.Author || 'Not found'}`);
        console.log(`  Creator: ${data.info?.Creator || 'Not found'}`);
        
        // Extract text by pages
        const pages = data.text.split('\n\n\n');
        
        console.log(`\n📄 PAGE-BY-PAGE ANALYSIS:\n`);
        
        pages.forEach((pageText, index) => {
            const pageNum = index + 1;
            const trimmed = pageText.trim();
            const lines = trimmed.split('\n').filter(l => l.trim());
            
            console.log(`\nPAGE ${pageNum}:`);
            console.log('─'.repeat(40));
            
            // Identify page type
            if (pageNum === 1) {
                console.log(`  Type: COVER PAGE`);
                if (trimmed.includes('Claude Elite Pipeline')) {
                    console.log(`  ✅ Title found`);
                } else {
                    console.log(`  ❌ Title missing`);
                }
                if (trimmed.includes('Enrique Oliveira')) {
                    console.log(`  ✅ Author found`);
                } else {
                    console.log(`  ❌ Author missing`);
                }
            } else if (trimmed.includes('Copyright') || trimmed.includes('©')) {
                console.log(`  Type: COPYRIGHT PAGE`);
                console.log(`  ✅ Copyright info present`);
            } else if (trimmed.includes('Table of Contents') || trimmed.includes('Contents')) {
                console.log(`  Type: TABLE OF CONTENTS`);
                const chapterMatches = trimmed.match(/Chapter \d+/g);
                if (chapterMatches) {
                    console.log(`  ✅ ${chapterMatches.length} chapters listed`);
                }
            } else if (trimmed.match(/^Chapter \d+:/m)) {
                const chapterMatch = trimmed.match(/^Chapter (\d+):/m);
                console.log(`  Type: CHAPTER ${chapterMatch[1]} OPENER`);
                console.log(`  ✅ Chapter title present`);
            } else if (lines.length > 10) {
                console.log(`  Type: CONTENT PAGE`);
                console.log(`  Lines: ${lines.length}`);
                console.log(`  Characters: ${trimmed.length}`);
            } else if (lines.length === 0) {
                console.log(`  Type: BLANK PAGE`);
            } else {
                console.log(`  Type: OTHER`);
            }
            
            // Show first few lines
            if (lines.length > 0) {
                console.log(`  First lines:`);
                lines.slice(0, 3).forEach(line => {
                    if (line.trim()) {
                        console.log(`    "${line.substring(0, 60)}${line.length > 60 ? '...' : ''}"`);
                    }
                });
            }
        });
        
        // Check for images (in metadata)
        console.log(`\n🖼️  IMAGE ANALYSIS:`);
        const textContent = data.text.toLowerCase();
        const imageIndicators = [
            'figure', 'diagram', 'illustration', 'image', 
            'chart', 'graph', 'photo', 'picture'
        ];
        
        let imageCount = 0;
        imageIndicators.forEach(indicator => {
            const matches = (textContent.match(new RegExp(indicator, 'g')) || []).length;
            if (matches > 0) {
                imageCount += matches;
                console.log(`  Found "${indicator}": ${matches} times`);
            }
        });
        
        if (imageCount === 0) {
            console.log(`  ⚠️  No image references found in text`);
        }
        
        // Content checks
        console.log(`\n✅ CONTENT VERIFICATION:`);
        const checks = {
            'Cover/Title': textContent.includes('claude elite pipeline'),
            'Author': textContent.includes('enrique oliveira'),
            'Copyright': textContent.includes('copyright') || textContent.includes('©'),
            'ISBN': textContent.includes('isbn'),
            'TOC': textContent.includes('table of contents') || textContent.includes('contents'),
            'Chapter 1': textContent.includes('chapter 1'),
            'Chapter 2': textContent.includes('chapter 2'),
            'Chapter 3': textContent.includes('chapter 3'),
            'Chapter 4': textContent.includes('chapter 4'),
            'Chapter 5': textContent.includes('chapter 5'),
            'Drop Caps': textContent.includes('initial-letter') || textContent.includes('drop-cap')
        };
        
        Object.entries(checks).forEach(([item, found]) => {
            console.log(`  ${found ? '✅' : '❌'} ${item}`);
        });
        
        // Summary
        console.log(`\n📝 SUMMARY:`);
        const passedChecks = Object.values(checks).filter(v => v).length;
        const totalChecks = Object.keys(checks).length;
        console.log(`  Passed: ${passedChecks}/${totalChecks} checks`);
        
        if (passedChecks < totalChecks) {
            console.log(`\n⚠️  ISSUES FOUND:`);
            Object.entries(checks).forEach(([item, found]) => {
                if (!found) {
                    console.log(`  - Missing: ${item}`);
                }
            });
        } else {
            console.log(`\n✅ ALL CHECKS PASSED!`);
        }
        
        console.log('\n' + '═'.repeat(80));
        
    } catch (error) {
        console.error('Error analyzing PDF:', error);
    }
}

// Run the analysis
const pdfFile = process.argv[2] || 'the-claude-elite-pipeline-perfect.pdf';
analyzePDF(pdfFile);