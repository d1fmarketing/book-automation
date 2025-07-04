#!/usr/bin/env node

// Test writer directly to debug issues

const path = require('path');
const fs = require('fs').promises;

async function testWriter() {
    console.log('🧪 Testing Writer Agent Directly\n');
    
    try {
        // Load writer module
        const writerModule = require('../agents/writer');
        
        console.log('Module type:', typeof writerModule);
        console.log('Has Writer class:', !!writerModule.Writer);
        
        // Create test book directory
        const bookDir = 'build/ebooks/test-brutal-truth';
        await fs.mkdir(bookDir, { recursive: true });
        
        // Create test outline
        const outline = {
            title: "What's One Brutal Truth You Learned After Starting Your Business?",
            outputDir: bookDir,
            chapters: [
                { 
                    number: 1, 
                    title: "The Harsh Reality", 
                    keyPoints: ["Most businesses fail", "Cash flow is king", "Customers don't care about your passion"] 
                },
                { 
                    number: 2, 
                    title: "Market Validation", 
                    keyPoints: ["Build what people want", "Test before you invest", "Listen to real feedback"] 
                }
            ]
        };
        
        // Save outline
        await fs.writeFile(
            path.join(bookDir, 'outline.json'), 
            JSON.stringify(outline, null, 2)
        );
        
        // Test direct function call
        if (typeof writerModule === 'function') {
            console.log('\n📝 Testing as function...');
            const result = await writerModule();
            console.log('Result type:', typeof result);
            console.log('Result length:', result?.length || 0);
            console.log('First 200 chars:', result?.substring(0, 200) || 'NO CONTENT');
        }
        
        // Test as class
        if (writerModule.Writer) {
            console.log('\n📝 Testing as Writer class...');
            const Writer = writerModule.Writer;
            const writer = new Writer();
            
            // Generate just chapter 1
            console.log('Generating Chapter 1...');
            const result = await writer.generateChapter(outline, 1);
            console.log('Success:', result.success);
            console.log('Word count:', result.wordCount);
            
            if (!result.success) {
                console.log('Error:', result.error);
            }
        }
        
        console.log('\n✅ Test complete');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

testWriter();