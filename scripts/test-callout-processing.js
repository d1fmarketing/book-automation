#!/usr/bin/env node

/**
 * Test script for callout processing
 */

const MarkdownProcessor = require('./pdf-utils/markdown-processor');
const fs = require('fs');
const path = require('path');

// Test markdown content with various callout syntaxes
const testMarkdown = `
# Test Chapter

Regular paragraph before callouts.

[!TIP] Simple Tip
This is a simple tip using bracket syntax.

[!WARNING] 
No title provided - should use WARNING as title.

> [!INFO] Blockquote Info
> This is using blockquote syntax.
> Multiple lines should work.

> [!SUCCESS] Achievement Unlocked
> You've mastered callouts!

Mixed content between callouts.

[!KEY] Important Key Point
Remember this crucial information.

## Regular Section

Normal content continues here.
`;

// Process the markdown
const processor = new MarkdownProcessor({ verbose: true });
const html = processor.processMarkdown(testMarkdown);

// Save output for inspection
const outputPath = path.join(__dirname, '../build/temp/callout-test.html');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Callout Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
        .callout { margin: 1rem 0; padding: 1rem; border-radius: 8px; border-left: 4px solid; }
        .callout-header { font-weight: bold; margin-bottom: 0.5rem; }
        .callout-tip { background: #e3f2fd; border-color: #2196f3; }
        .callout-warning { background: #fff3cd; border-color: #ff9800; }
        .callout-info { background: #e7f3ff; border-color: #0066cc; }
        .callout-success { background: #d4edda; border-color: #28a745; }
        .callout-key { background: #fff3cd; border-color: #ffc107; }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;

fs.writeFileSync(outputPath, fullHtml);

console.log('✅ Callout processing test complete!');
console.log(`📄 Output saved to: ${outputPath}`);
console.log('\n🔍 Generated HTML preview:');
console.log('─'.repeat(50));
console.log(html.substring(0, 500) + '...');
console.log('─'.repeat(50));

// Count callouts found
const calloutCount = (html.match(/class="callout/g) || []).length;
console.log(`\n📊 Found ${calloutCount} callouts in processed HTML`);

// Open in browser
if (process.platform === 'darwin') {
    require('child_process').exec(`open ${outputPath}`);
}