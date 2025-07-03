#!/usr/bin/env node

require('dotenv').config();
const deepResearch = require('./agents/deep-research');
const { generateEbookContent } = require('./scripts/generate-content');
const { generatePremiumHTML } = require('./scripts/build-premium-html-ebook');

async function runDemo() {
    console.log('🚀 EBOOK MONEY MACHINE AI - Demo Pipeline\n');
    console.log('=' .repeat(60) + '\n');
    
    // Step 1: Select a trending topic
    const topic = {
        title: "ChatGPT & AI Prompts for Business Success",
        niche: "AI/Technology",
        description: "Master AI prompts to automate your business and boost profits",
        keywords: ["chatgpt", "ai prompts", "business automation"],
        targetAudience: "Entrepreneurs and business owners",
        estimatedDemand: 9500,
        potential: "Very High"
    };
    
    console.log('📊 Selected Topic:', topic.title);
    console.log('💰 Revenue Potential:', topic.potential);
    console.log('🎯 Target Audience:', topic.targetAudience);
    
    // Step 2: Deep Research with Perplexity
    console.log('\n🔍 Performing Deep Research...\n');
    
    try {
        const research = await deepResearch({ topic: topic.title });
        
        console.log('✅ Research Complete!');
        console.log('\n📝 Summary:');
        console.log(research.summary);
        
        console.log('\n💡 Key Insights:');
        research.bullets.forEach((bullet, i) => {
            console.log(`${i + 1}. ${bullet}`);
        });
        
        console.log('\n🔗 Sources:');
        research.links.forEach((link, i) => {
            console.log(`${i + 1}. ${link}`);
        });
        
        // Save research for content generation
        const fs = require('fs').promises;
        await fs.mkdir('context', { recursive: true });
        await fs.writeFile('context/research.yaml', 
            require('js-yaml').dump({
                topic: topic.title,
                timestamp: new Date().toISOString(),
                ...research
            })
        );
        
        console.log('\n✅ Research saved to context/research.yaml');
        
    } catch (error) {
        console.error('❌ Research failed:', error.message);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n🎉 Demo Complete!');
    console.log('\nNext Steps:');
    console.log('1. Run full pipeline: npm run money:start');
    console.log('2. Build HTML ebook: npm run build:premium-ebook');
    console.log('3. Check research: cat context/research.yaml');
}

if (require.main === module) {
    runDemo().catch(console.error);
}