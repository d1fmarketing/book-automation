#!/usr/bin/env node

/**
 * Test Grammar Checker
 * Quick test to verify grammar checking is working
 */

const GrammarChecker = require('./grammar/grammar-checker');

// ANSI colors
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`
};

async function testGrammar() {
    console.log(colors.blue('🧪 Testing Grammar Checker...'));
    
    const checker = new GrammarChecker({
        language: 'pt-BR'
    });
    
    // Check if server is available
    console.log('\n1. Checking server connection...');
    const serverAvailable = await checker.checkServer();
    
    if (!serverAvailable) {
        console.error(colors.red('❌ LanguageTool server not available'));
        console.log(colors.yellow('Start it with: npm run grammar:server'));
        process.exit(1);
    }
    
    console.log(colors.green('✅ Server is running'));
    
    // Test Portuguese text with errors
    console.log('\n2. Testing Portuguese text...');
    const portugueseText = `
# Capítulo 1: Introdução

Este é um texto de teste com alguns alguns erros de gramática.
Eu gosto muito de escrever , mas as vezes cometo erros.
Por que você não tenta escrever tambem?
    `;
    
    const ptResult = await checker.checkText(portugueseText);
    console.log(`Found ${ptResult.matches.length} issues in Portuguese text`);
    
    if (ptResult.matches.length > 0) {
        console.log('\nFirst 3 issues:');
        ptResult.matches.slice(0, 3).forEach((match, i) => {
            console.log(`\n${i + 1}. ${match.message}`);
            console.log(`   Context: "${match.context.text}"`);
            if (match.replacements.length > 0) {
                console.log(`   Suggestions: ${match.replacements.slice(0, 3).map(r => r.value).join(', ')}`);
            }
        });
    }
    
    // Test English text
    console.log('\n3. Testing English text...');
    const checker2 = new GrammarChecker({ language: 'en-US' });
    
    const englishText = `
# Chapter 1: Introduction

This is a test text with with some grammar errors.
I really likes writing, but sometime I make mistakes.
Their are many ways to improve you're writing.
    `;
    
    const enResult = await checker2.checkText(englishText);
    console.log(`Found ${enResult.matches.length} issues in English text`);
    
    if (enResult.matches.length > 0) {
        console.log('\nFirst 3 issues:');
        enResult.matches.slice(0, 3).forEach((match, i) => {
            console.log(`\n${i + 1}. ${match.message}`);
            console.log(`   Context: "${match.context.text}"`);
            if (match.replacements.length > 0) {
                console.log(`   Suggestions: ${match.replacements.slice(0, 3).map(r => r.value).join(', ')}`);
            }
        });
    }
    
    // Test auto-fix
    console.log('\n4. Testing auto-fix...');
    const textWithFixableErrors = 'Este texto tem tem palavras repetidas e  espaços duplos.';
    const [fixedText, fixedCount] = await checker.autoFixSimpleIssues(textWithFixableErrors);
    
    console.log('Original:', textWithFixableErrors);
    console.log('Fixed:', fixedText);
    console.log(`Fixed ${fixedCount} issues`);
    
    // Show stats
    console.log('\n5. Statistics:');
    console.log('Portuguese:', ptResult.stats);
    console.log('English:', enResult.stats);
    
    console.log(colors.green('\n✅ Grammar checker is working!'));
}

// Run the test
testGrammar().catch(error => {
    console.error(colors.red('❌ Test failed:'), error.message);
    process.exit(1);
});