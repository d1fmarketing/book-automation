#!/usr/bin/env node

const marked = require('marked');

// Test content that might cause issues
const testContent = `
# Test Chapter

## Overview

This is a test paragraph.

### Subheading

- Item 1
- Item 2
- Item 3

[object Object]
`;

console.log('=== Testing Marked.js ===\n');
console.log('Input:');
console.log(testContent);
console.log('\n=== Output ===\n');
console.log(marked.parse(testContent));