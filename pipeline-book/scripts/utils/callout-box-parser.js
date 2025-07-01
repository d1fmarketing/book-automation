/**
 * Callout Box Parser
 * Converts Markdown callout syntax to HTML with proper styling
 * 
 * Syntax: > [!TYPE] Content
 * Types: TIP, WARNING, SUCCESS, INFO, QUOTE, KEY
 */

const calloutTypes = {
    'TIP': {
        class: 'tip-box',
        title: 'Tip',
        icon: '💡'
    },
    'WARNING': {
        class: 'warning-box', 
        title: 'Warning',
        icon: '⚠️'
    },
    'SUCCESS': {
        class: 'success-box',
        title: 'Success',
        icon: '✅'
    },
    'INFO': {
        class: 'info-box',
        title: 'Information',
        icon: 'ℹ️'
    },
    'QUOTE': {
        class: 'quote-box',
        title: 'Quote',
        icon: '"'
    },
    'KEY': {
        class: 'key-box',
        title: 'Key Point',
        icon: '🔑'
    }
};

/**
 * Parse callout box syntax in markdown content
 * @param {string} content - Markdown content
 * @returns {string} - HTML content with callout boxes
 */
function parseCalloutBoxes(content) {
    // Regular expression to match callout syntax
    // Matches: > [!TYPE] Title (optional)
    // Content on following lines starting with >
    const calloutRegex = /^>\s*\[!(\w+)\]\s*(.*?)$((?:\n>\s*.*)*)/gm;
    
    return content.replace(calloutRegex, (match, type, title, content) => {
        const calloutType = calloutTypes[type.toUpperCase()];
        
        if (!calloutType) {
            // If type is not recognized, return original text
            return match;
        }
        
        // Clean up the content - remove leading > and spaces
        const cleanContent = content
            .split('\n')
            .map(line => line.replace(/^>\s*/, ''))
            .filter(line => line.length > 0)
            .join('\n');
        
        // Use custom title if provided, otherwise use default
        const boxTitle = title.trim() || calloutType.title;
        
        // Build the HTML
        const html = `
<div class="callout-box ${calloutType.class}">
    <div class="callout-box-header">
        <span class="callout-box-icon"></span>
        <span>${boxTitle}</span>
    </div>
    <div class="callout-box-content">
        ${convertMarkdownToHTML(cleanContent)}
    </div>
</div>`;
        
        return html.trim();
    });
}

/**
 * Basic markdown to HTML conversion for content inside callout boxes
 * @param {string} markdown - Markdown content
 * @returns {string} - HTML content
 */
function convertMarkdownToHTML(markdown) {
    // Convert line breaks to <br> for proper formatting
    let html = markdown.replace(/\n/g, '<br>\n');
    
    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic text
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert inline code
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    // Convert links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    
    return html;
}

/**
 * Process entire markdown document
 * @param {string} markdown - Full markdown document
 * @returns {string} - Markdown with callout boxes converted to HTML
 */
function processMarkdownWithCallouts(markdown) {
    // Split by double newlines to preserve paragraph structure
    const blocks = markdown.split(/\n\n/);
    
    // Process each block
    const processedBlocks = blocks.map(block => {
        // Check if this block starts with a callout
        if (block.trim().startsWith('> [!')) {
            return parseCalloutBoxes(block);
        }
        return block;
    });
    
    // Rejoin blocks
    return processedBlocks.join('\n\n');
}

// Export functions
module.exports = {
    parseCalloutBoxes,
    processMarkdownWithCallouts,
    calloutTypes
};

// Command line usage
if (require.main === module) {
    const fs = require('fs');
    const path = require('path');
    
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('Usage: node callout-box-parser.js <markdown-file>');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace('.md', '-with-callouts.html');
    
    try {
        const markdown = fs.readFileSync(inputFile, 'utf8');
        const processed = processMarkdownWithCallouts(markdown);
        
        // Wrap in basic HTML structure for testing
        const html = `
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="${path.relative(path.dirname(outputFile), 'assets/css/professional-web-style.css')}">
</head>
<body>
    <div class="container">
        ${processed}
    </div>
</body>
</html>`;
        
        fs.writeFileSync(outputFile, html);
        console.log(`✅ Processed callout boxes and saved to: ${outputFile}`);
        
    } catch (error) {
        console.error('❌ Error processing file:', error.message);
        process.exit(1);
    }
}