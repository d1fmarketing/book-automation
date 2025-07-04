#!/usr/bin/env node

/**
 * Regression Tests for Ebook Pipeline
 * 
 * Ensures that common issues don't reappear
 */

const fs = require('fs').promises;
const path = require('path');
const assert = require('assert');

// Test cases to prevent regression
const REGRESSION_TESTS = [
    {
        name: 'No [object Object] in output',
        test: async (content) => {
            assert(!content.includes('[object Object]'), 
                'Found [object Object] in content - writer.js may be returning objects instead of strings');
        }
    },
    {
        name: 'No <hundefined> tags',
        test: async (content) => {
            assert(!content.includes('<hundefined'), 
                'Found <hundefined> tags - formatter-html.js heading renderer has undefined level');
            assert(!content.includes('</hundefined>'), 
                'Found </hundefined> tags - formatter-html.js heading renderer has undefined level');
        }
    },
    {
        name: 'Cover image present',
        test: async (content) => {
            assert(content.includes('class="cover-image"'), 
                'No cover image found - illustrator.js may not be running');
        }
    },
    {
        name: 'TOC without duplicates',
        test: async (content) => {
            // Extract TOC items
            const tocMatches = content.match(/href="#chapter-\d+"/g) || [];
            const uniqueTocs = new Set(tocMatches);
            assert(tocMatches.length === uniqueTocs.size, 
                `TOC has duplicates: ${tocMatches.length} items but only ${uniqueTocs.size} unique`);
        }
    },
    {
        name: 'Valid HTML structure',
        test: async (content) => {
            assert(content.includes('<!DOCTYPE html>'), 'Missing DOCTYPE');
            assert(content.includes('<html'), 'Missing <html> tag');
            assert(content.includes('<head>'), 'Missing <head> tag');
            assert(content.includes('<body>'), 'Missing <body> tag');
            assert(content.includes('</html>'), 'Missing closing </html>');
        }
    },
    {
        name: 'Chapter content exists',
        test: async (content) => {
            const chapterCount = (content.match(/class="chapter"/g) || []).length;
            assert(chapterCount >= 8, 
                `Expected at least 8 chapters, found ${chapterCount}`);
        }
    },
    {
        name: 'No empty src attributes',
        test: async (content) => {
            assert(!content.includes('src=""'), 'Found empty src attribute');
            assert(!content.includes("src=''"), 'Found empty src attribute');
        }
    },
    {
        name: 'Metadata populated',
        test: async (content) => {
            assert(!content.includes('Untitled Book'), 
                'Found "Untitled Book" - metadata not properly loaded');
            assert(!content.includes('Unknown Author'), 
                'Found "Unknown Author" - metadata not properly loaded');
        }
    }
];

async function runRegressionTests(htmlPath) {
    console.log('🧪 Running Regression Tests');
    console.log('==========================');
    console.log(`📄 Testing: ${htmlPath}\n`);

    let passed = 0;
    let failed = 0;
    const results = [];

    try {
        // Read HTML content
        const content = await fs.readFile(htmlPath, 'utf8');

        // Run each test
        for (const testCase of REGRESSION_TESTS) {
            process.stdout.write(`Testing: ${testCase.name}... `);
            
            try {
                await testCase.test(content);
                console.log('✅ PASSED');
                passed++;
                results.push({
                    name: testCase.name,
                    passed: true
                });
            } catch (error) {
                console.log('❌ FAILED');
                console.log(`   Error: ${error.message}`);
                failed++;
                results.push({
                    name: testCase.name,
                    passed: false,
                    error: error.message
                });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 SUMMARY:');
        console.log(`   Total tests: ${REGRESSION_TESTS.length}`);
        console.log(`   Passed: ${passed}`);
        console.log(`   Failed: ${failed}`);
        console.log('');

        if (failed === 0) {
            console.log('✅ All regression tests passed!');
            return { success: true, passed, failed, results };
        } else {
            console.log('❌ Some regression tests failed!');
            console.log('\nFailed tests:');
            results.filter(r => !r.passed).forEach(r => {
                console.log(`   - ${r.name}: ${r.error}`);
            });
            return { success: false, passed, failed, results };
        }

    } catch (error) {
        console.error(`\n❌ Fatal error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Export for use in other scripts
module.exports = { runRegressionTests, REGRESSION_TESTS };

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const htmlPath = args[0];

    if (!htmlPath) {
        console.error('Usage: node test-no-regression.js <path-to-html>');
        process.exit(1);
    }

    runRegressionTests(htmlPath)
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}