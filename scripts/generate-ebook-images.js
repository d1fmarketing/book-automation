#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');

// Load environment variables
require('dotenv').config();

const IDEOGRAM_API_KEY = process.env.IDEOGRAM_API_KEY;
const OUTPUT_DIR = path.join(__dirname, '../build/html-ebook/images');

// Chapter titles and descriptions for generating contextual images
const CHAPTERS = [
    {
        id: 'cover',
        title: 'ChatGPT & AI Prompts for Business Success',
        prompt: 'Professional ebook cover design for "ChatGPT & AI Prompts for Business Success", ultra modern tech aesthetic, gradient blue to cyan, circuit board patterns, holographic effects, AI brain visualization, bestseller quality, clean typography, 8K resolution, vertical book cover format',
        width: 1600,
        height: 2400
    },
    {
        id: 'chapter-01',
        title: 'Getting Started - Your Journey Begins',
        prompt: 'Futuristic illustration for "Getting Started Your Journey Begins" chapter, AI brain neural network starting to glow, cyan energy pathways lighting up, minimalist tech design, sense of beginning and potential, banner format, professional business context',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-02',
        title: 'Core Concepts and Principles',
        prompt: 'Modern tech illustration for "Core Concepts and Principles", abstract geometric shapes representing AI fundamentals, data flow visualization, interconnected nodes, blue and cyan gradient, clean minimal design, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-03',
        title: 'The Step By Step System',
        prompt: 'Tech illustration showing "Step By Step System", ascending stairs made of glowing digital blocks, each step illuminated with AI symbols, progression visualization, cyan and blue theme, futuristic business setting, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-04',
        title: 'Tools and Resources',
        prompt: 'Digital toolbox illustration for "Tools and Resources", holographic interface showing various AI tools floating in space, ChatGPT logo subtly integrated, tech workshop aesthetic, blue cyan color scheme, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-05',
        title: 'Common Pitfalls and How to Avoid Them',
        prompt: 'Warning-themed tech illustration for "Common Pitfalls", digital maze with glowing safe path through obstacles, caution symbols in elegant tech style, problem-solving visualization, cyan highlights on dark background, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-06',
        title: 'Advanced Strategies for Scaling',
        prompt: 'Growth visualization for "Advanced Strategies for Scaling", exponential graph made of light particles, rocket ship trajectory through data clouds, scaling metaphor in tech style, dynamic upward movement, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-07',
        title: 'Case Studies and Success Stories',
        prompt: 'Success stories visualization, multiple glowing success graphs and charts floating in 3D space, trophy icons made of light, testimonial bubbles with tech aesthetic, celebration theme in corporate tech style, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-08',
        title: 'Your 30 Day Action Plan',
        prompt: 'Calendar visualization for "30 Day Action Plan", futuristic holographic calendar with glowing checkmarks, timeline with milestones, productivity dashboard aesthetic, organized tech design, banner format',
        width: 1920,
        height: 1080
    },
    {
        id: 'chapter-09',
        title: 'Maintaining Long Term Success',
        prompt: 'Infinity loop visualization for "Long Term Success", continuous flow of energy in tech style, sustainable growth metaphor, perpetual motion in digital form, established and stable aesthetic, banner format',
        width: 1920,
        height: 1080
    }
];

async function generateImageWithIdeogram(chapter) {
    console.log(`\n🎨 Generating image for: ${chapter.title}`);
    
    const requestBody = {
        image_request: {
            prompt: chapter.prompt,
            width: chapter.width,
            height: chapter.height,
            model: "V_2", // Latest Ideogram model
            magic_prompt_option: "AUTO", // Let Ideogram enhance our prompt
            style_type: "DESIGN" // Best for professional graphics
        }
    };

    const options = {
        hostname: 'api.ideogram.ai',
        path: '/generate',
        method: 'POST',
        headers: {
            'Api-Key': IDEOGRAM_API_KEY,
            'Content-Type': 'application/json'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', async () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (res.statusCode !== 200) {
                        throw new Error(`API Error: ${response.error || data}`);
                    }
                    
                    if (response.data && response.data[0] && response.data[0].url) {
                        const imageUrl = response.data[0].url;
                        const imagePath = path.join(OUTPUT_DIR, `${chapter.id}.png`);
                        
                        // Download the image
                        await downloadImage(imageUrl, imagePath);
                        console.log(`✅ Saved: ${imagePath}`);
                        resolve(imagePath);
                    } else {
                        throw new Error('No image URL in response');
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(requestBody));
        req.end();
    });
}

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        https.get(url, async (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download image: ${response.statusCode}`));
                return;
            }
            
            const writeStream = require('fs').createWriteStream(filepath);
            
            try {
                await pipeline(response, writeStream);
                resolve();
            } catch (error) {
                reject(error);
            }
        }).on('error', reject);
    });
}

async function generateAllImages() {
    console.log('🚀 Starting Ideogram image generation for premium ebook...\n');
    
    // Check API key
    if (!IDEOGRAM_API_KEY) {
        console.error('❌ ERROR: IDEOGRAM_API_KEY not found in .env file');
        console.log('\nPlease add your Ideogram API key to .env file:');
        console.log('IDEOGRAM_API_KEY=your_api_key_here\n');
        process.exit(1);
    }
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Output directory: ${OUTPUT_DIR}\n`);
    
    const results = {
        success: [],
        failed: []
    };
    
    // Generate images sequentially to avoid rate limits
    for (const chapter of CHAPTERS) {
        try {
            const imagePath = await generateImageWithIdeogram(chapter);
            results.success.push({ chapter: chapter.title, path: imagePath });
            
            // Wait 2 seconds between requests to respect rate limits
            if (CHAPTERS.indexOf(chapter) < CHAPTERS.length - 1) {
                console.log('⏳ Waiting 2 seconds before next request...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error(`❌ Failed to generate image for ${chapter.title}:`, error.message);
            results.failed.push({ chapter: chapter.title, error: error.message });
        }
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 GENERATION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully generated: ${results.success.length} images`);
    console.log(`❌ Failed: ${results.failed.length} images`);
    
    if (results.success.length > 0) {
        console.log('\n✅ Generated images:');
        results.success.forEach(r => console.log(`   - ${r.chapter}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\n❌ Failed images:');
        results.failed.forEach(r => console.log(`   - ${r.chapter}: ${r.error}`));
        console.log('\n💡 TIP: You can run this script again to retry failed images.');
    }
    
    // Save generation report
    const reportPath = path.join(OUTPUT_DIR, 'generation-report.json');
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Generation report saved to: ${reportPath}`);
    
    return results;
}

// Alternative: Generate placeholder images if Ideogram fails
async function generatePlaceholderImage(chapter) {
    // This would create a simple colored rectangle with text
    // For now, we'll just create a placeholder file
    const placeholderPath = path.join(OUTPUT_DIR, `${chapter.id}-placeholder.txt`);
    await fs.writeFile(placeholderPath, `Placeholder for: ${chapter.title}\nSize: ${chapter.width}x${chapter.height}`);
    return placeholderPath;
}

// Run if called directly
if (require.main === module) {
    generateAllImages()
        .then(results => {
            if (results.success.length === CHAPTERS.length) {
                console.log('\n🎉 All images generated successfully!');
                console.log('Next step: Run the HTML builder to create your premium ebook.');
            } else {
                console.log('\n⚠️  Some images failed to generate.');
                console.log('The HTML builder can still run with placeholder images.');
            }
        })
        .catch(error => {
            console.error('\n💥 Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { generateAllImages, CHAPTERS };