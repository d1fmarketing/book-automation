#!/usr/bin/env node

// Test script for deep research integration
const deepResearch = require('./agents/deep-research');

async function testDeepResearch() {
    console.log('🧪 Testing Deep Research Agent with Perplexity API\n');
    console.log('=' + '='.repeat(60) + '\n');
    
    // Test topics
    const testTopics = [
        'ChatGPT for business automation',
        'Passive income with AI tools',
        'Cryptocurrency day trading strategies'
    ];
    
    for (const topic of testTopics) {
        console.log(`📚 Researching: "${topic}"`);
        console.log('-'.repeat(60));
        
        try {
            const research = await deepResearch({ topic });
            
            console.log('\n📝 Summary:');
            console.log(research.summary);
            
            console.log('\n🔗 Related Links:');
            research.links.forEach((link, i) => {
                console.log(`${i + 1}. ${link}`);
            });
            
            console.log('\n💡 Key Insights:');
            research.bullets.forEach((bullet, i) => {
                console.log(`${i + 1}. ${bullet}`);
            });
            
            console.log('\n✅ Research successful!\n');
            
        } catch (error) {
            console.error(`\n❌ Research failed: ${error.message}`);
            console.error('\nMake sure PERPLEXITY_API_KEY is set in .env\n');
        }
        
        console.log('=' + '='.repeat(60) + '\n');
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Run test
if (require.main === module) {
    require('dotenv').config();
    testDeepResearch().catch(console.error);
}