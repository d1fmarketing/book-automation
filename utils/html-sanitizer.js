/**
 * HTML Sanitizer
 * 
 * Fixes common HTML generation issues:
 * - [object Object] in content
 * - <hundefined> tags
 * - Empty or broken elements
 */

class HTMLSanitizer {
    /**
     * Clean HTML content and fix common issues
     */
    static clean(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }
        
        let cleaned = html;
        
        // Fix [object Object] in content
        cleaned = cleaned.replace(/\[object Object\]/g, '');
        
        // Fix undefined heading tags
        cleaned = cleaned.replace(/<h\s*undefined/gi, '<h3');
        cleaned = cleaned.replace(/<hundefined/gi, '<h3');
        cleaned = cleaned.replace(/<\/hundefined>/gi, '</h3>');
        
        // Fix headings with undefined level
        cleaned = cleaned.replace(/<h(\d*)>/g, (match, level) => {
            const validLevel = parseInt(level);
            if (!validLevel || validLevel < 1 || validLevel > 6) {
                return '<h3>';
            }
            return match;
        });
        
        // Fix empty headings
        cleaned = cleaned.replace(/<h(\d)([^>]*)>\s*<\/h\1>/g, '');
        
        // Fix broken image tags
        cleaned = cleaned.replace(/<img([^>]*)\s+src=["']?undefined["']?([^>]*)>/g, '');
        cleaned = cleaned.replace(/<img([^>]*)\s+src=["']?\[object Object\]["']?([^>]*)>/g, '');
        
        // Fix empty paragraphs
        cleaned = cleaned.replace(/<p>\s*<\/p>/g, '');
        
        // Fix empty list items
        cleaned = cleaned.replace(/<li>\s*<\/li>/g, '');
        
        // Fix empty code blocks
        cleaned = cleaned.replace(/<pre><code>\s*<\/code><\/pre>/g, '');
        
        // Fix consecutive line breaks
        cleaned = cleaned.replace(/(<br\s*\/?>){3,}/g, '<br><br>');
        
        // Fix unclosed tags (basic)
        cleaned = this.fixUnclosedTags(cleaned);
        
        return cleaned;
    }
    
    /**
     * Fix unclosed HTML tags
     */
    static fixUnclosedTags(html) {
        const selfClosing = ['img', 'br', 'hr', 'input', 'meta', 'link'];
        const stack = [];
        let fixed = '';
        let i = 0;
        
        while (i < html.length) {
            if (html[i] === '<') {
                const tagEnd = html.indexOf('>', i);
                if (tagEnd === -1) {
                    fixed += html.substring(i);
                    break;
                }
                
                const tag = html.substring(i + 1, tagEnd);
                const tagName = tag.match(/^\/?\w+/)?.[0] || '';
                const cleanTagName = tagName.replace('/', '');
                
                if (tag.startsWith('/')) {
                    // Closing tag
                    if (stack.length > 0 && stack[stack.length - 1] === cleanTagName) {
                        stack.pop();
                        fixed += html.substring(i, tagEnd + 1);
                    } else {
                        // Skip mismatched closing tag
                        console.warn(`Skipping mismatched closing tag: </${cleanTagName}>`);
                    }
                } else if (!selfClosing.includes(cleanTagName) && !tag.endsWith('/')) {
                    // Opening tag
                    stack.push(cleanTagName);
                    fixed += html.substring(i, tagEnd + 1);
                } else {
                    // Self-closing or void tag
                    fixed += html.substring(i, tagEnd + 1);
                }
                
                i = tagEnd + 1;
            } else {
                fixed += html[i];
                i++;
            }
        }
        
        // Close any remaining open tags
        while (stack.length > 0) {
            const tag = stack.pop();
            fixed += `</${tag}>`;
        }
        
        return fixed;
    }
    
    /**
     * Validate HTML has no known issues
     */
    static validate(html) {
        const issues = [];
        
        if (html.includes('[object Object]')) {
            issues.push('Contains [object Object]');
        }
        
        if (html.match(/<h\s*undefined|<hundefined/i)) {
            issues.push('Contains undefined heading tags');
        }
        
        // Check for empty required elements
        if (html.match(/<h\d>\s*<\/h\d>/)) {
            issues.push('Contains empty headings');
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
    
    /**
     * Process markdown before HTML conversion
     */
    static preprocessMarkdown(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }
        
        let processed = markdown;
        
        // Fix headings with no space after #
        processed = processed.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
        
        // Fix empty headings
        processed = processed.replace(/^(#{1,6})\s*$/gm, '');
        
        // Fix [object Object] in markdown
        processed = processed.replace(/\[object Object\]/g, '');
        
        // Fix broken links
        processed = processed.replace(/\[([^\]]*)\]\(\s*\[object Object\]\s*\)/g, '$1');
        processed = processed.replace(/\[([^\]]*)\]\(\s*undefined\s*\)/g, '$1');
        
        // Fix broken images
        processed = processed.replace(/!\[([^\]]*)\]\(\s*\[object Object\]\s*\)/g, '');
        processed = processed.replace(/!\[([^\]]*)\]\(\s*undefined\s*\)/g, '');
        
        return processed;
    }
}

module.exports = HTMLSanitizer;