const marked = require('marked');

// Test markdown
const markdown = `\![AI-IMAGE: A minimalist book cover design featuring abstract geometric shapes in soft gradients. Simple, clean, professional. Title "The Tiny Test Book" prominently displayed with modern typography text="THE TINY TEST BOOK"]()`;

// Convert to HTML
const html = marked.parse(markdown);
console.log('Original HTML:', html);

// Show what we need to match
console.log('\nNeed to match pattern like:', '<img src="" alt="AI-IMAGE: ...');
