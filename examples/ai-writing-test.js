#!/usr/bin/env node

/**
 * Test the AI Writing Assistant API
 * This demonstrates how to use the humanization feature programmatically
 */

const axios = require('axios');

// Sample AI-generated text that needs humanization
const aiText = `
Furthermore, it is important to note that software development encompasses a multitude of complex processes. Moreover, the implementation of efficient algorithms requires careful consideration of various factors. In conclusion, developers must maintain a balance between code optimization and readability.

The aforementioned principles apply universally across different programming paradigms. Nevertheless, each language has its unique characteristics that developers must understand. Hence, continuous learning is essential for professional growth in this field.
`;

async function testHumanization() {
    try {
        console.log('🤖 Original AI Text:');
        console.log('-------------------');
        console.log(aiText);
        console.log('\n');
        
        // Make sure the server is running
        const health = await axios.get('http://localhost:3002/api/health');
        console.log('✅ Server is running:', health.data);
        console.log('\n');
        
        // Humanize the text
        console.log('🎨 Humanizing text...');
        const response = await axios.post('http://localhost:3002/api/humanize', {
            text: aiText,
            contentType: 'technical',
            chapterNum: 1
        });
        
        if (response.data.success) {
            console.log('\n✨ Humanized Text:');
            console.log('------------------');
            console.log(response.data.result);
            
            // Analyze humanity score
            console.log('\n📊 Analyzing humanity score...');
            const analysis = await axios.post('http://localhost:3002/api/analyze', {
                text: response.data.result
            });
            
            if (analysis.data.success) {
                const result = analysis.data.result;
                console.log(`\nHumanity Score: ${result.humanity_score}%`);
                console.log('\nMetrics:');
                console.log(`- Sentence length variation: ${result.metrics.sentence_length_stddev.toFixed(2)}`);
                console.log(`- Personal pronouns per 1000 words: ${result.metrics.personal_pronouns_per_1000_words.toFixed(2)}`);
                console.log(`- Questions per 1000 words: ${result.metrics.questions_per_1000_words.toFixed(2)}`);
                
                if (result.recommendations && result.recommendations.length > 0) {
                    console.log('\nRecommendations:');
                    result.recommendations.forEach(rec => {
                        console.log(`- ${rec}`);
                    });
                }
            }
        } else {
            console.error('❌ Humanization failed:', response.data.error);
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Could not connect to server. Make sure it\'s running:');
            console.error('   npm run writing-assistant');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

// Run the test
if (require.main === module) {
    console.log('AI Writing Assistant API Test');
    console.log('============================\n');
    testHumanization();
}

module.exports = { testHumanization };