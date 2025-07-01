#!/usr/bin/env node

/**
 * Grammar Integration Example
 * Shows how to use the grammar checker in your workflow
 */

const GrammarChecker = require('../scripts/grammar/grammar-checker');
const fs = require('fs').promises;
const path = require('path');

async function example() {
    console.log('Grammar Integration Example\n');
    
    // 1. Initialize the grammar checker
    const checker = new GrammarChecker({
        language: 'pt-BR',  // or 'en-US'
        apiUrl: 'http://localhost:8081/v2'
    });
    
    // 2. Check if server is running
    if (!await checker.checkServer()) {
        console.error('❌ Grammar server not available');
        console.log('Start it with: npm run grammar:server');
        return;
    }
    
    // 3. Check a text
    const text = `
Este é um exemplo de texto com alguns erros.
Eu gosto muito muito de escrever, mas as vezes cometo erros.
Por que você não tenta escrever tambem?
    `;
    
    console.log('Checking text...\n');
    const result = await checker.checkText(text);
    
    console.log(`Found ${result.matches.length} issues:\n`);
    
    // 4. Display issues
    result.matches.forEach((match, i) => {
        console.log(`${i + 1}. ${match.message}`);
        console.log(`   Position: ${match.offset}-${match.offset + match.length}`);
        console.log(`   Context: "${match.context.text}"`);
        
        if (match.replacements.length > 0) {
            console.log(`   Suggestions: ${match.replacements.slice(0, 3).map(r => r.value).join(', ')}`);
        }
        console.log();
    });
    
    // 5. Auto-fix simple issues
    console.log('Auto-fixing simple issues...\n');
    const [fixedText, fixedCount] = await checker.autoFixSimpleIssues(text);
    
    if (fixedCount > 0) {
        console.log(`Fixed ${fixedCount} issues:`);
        console.log('Fixed text:', fixedText);
    } else {
        console.log('No auto-fixable issues found');
    }
    
    // 6. Statistics
    console.log('\nStatistics:', result.stats);
    
    // 7. Custom dictionary example
    checker.addToDictionary(['Claude', 'Anthropic', 'technomancer']);
    console.log('\nAdded custom words to dictionary');
    
    // 8. Check a markdown file
    console.log('\n--- Checking a Markdown File ---\n');
    
    try {
        const markdownPath = path.join(__dirname, '..', 'chapters', 'chapter-01-introduction.md');
        const markdownContent = await fs.readFile(markdownPath, 'utf8');
        
        const mdResult = await checker.checkText(markdownContent);
        console.log(`Markdown file has ${mdResult.matches.length} issues`);
        
        if (mdResult.stats) {
            console.log('By category:', mdResult.stats.byCategory);
            console.log('By severity:', mdResult.stats.bySeverity);
        }
    } catch (error) {
        console.log('No markdown file found to check');
    }
}

// Integration with Writing Assistant
async function writingAssistantExample() {
    console.log('\n--- Writing Assistant Integration ---\n');
    
    // Example of real-time grammar checking
    const ws = new (require('ws'))('ws://localhost:3002');
    
    ws.on('open', () => {
        console.log('Connected to Writing Assistant');
        
        // Send grammar check request
        ws.send(JSON.stringify({
            type: 'check_grammar',
            text: 'Este texto tem tem palavras repetidas.',
            autoFix: false
        }));
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'grammar_results') {
            console.log('Grammar results received:');
            console.log(`Found ${message.matches.length} issues`);
            message.matches.forEach(match => {
                console.log(`- ${match.message}`);
            });
        }
        
        ws.close();
    });
    
    ws.on('error', () => {
        console.log('Writing Assistant not running');
        console.log('Start it with: npm run writing-assistant');
    });
}

// Command-line usage example
async function commandLineExample() {
    console.log('\n--- Command Line Usage ---\n');
    
    console.log('Available commands:');
    console.log('  npm run grammar:server        # Start the grammar server');
    console.log('  npm run grammar:check         # Check all chapters');
    console.log('  npm run grammar:fix           # Auto-fix simple issues');
    console.log('  npm run grammar:report        # Generate HTML report');
    console.log('  make grammar                  # Check with server startup');
    console.log('  make test-grammar             # Run grammar tests');
}

// Run examples
(async () => {
    await example();
    await commandLineExample();
    
    // Uncomment to test Writing Assistant integration
    // await writingAssistantExample();
})();