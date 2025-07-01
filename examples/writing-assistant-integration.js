/**
 * Example: Integrating AI Writing Assistant with the build pipeline
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

async function humanizeChapter(chapterPath) {
    // Read chapter content
    const content = await fs.readFile(chapterPath, 'utf8');
    
    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter = frontmatterMatch ? frontmatterMatch[0] : '';
    const text = content.slice(frontmatter.length).trim();
    
    // Call AI Writing Assistant API
    const response = await axios.post('http://localhost:3002/api/humanize', {
        text: text,
        contentType: 'general',
        chapterNum: 1
    });
    
    if (response.data.success) {
        // Combine frontmatter with humanized text
        const humanizedContent = frontmatter + '\n\n' + response.data.result;
        
        // Save humanized version
        const humanizedPath = chapterPath.replace('.md', '.humanized.md');
        await fs.writeFile(humanizedPath, humanizedContent);
        
        console.log(`✅ Humanized: ${path.basename(humanizedPath)}`);
        return humanizedPath;
    } else {
        throw new Error(`Humanization failed: ${response.data.error}`);
    }
}

// Example usage
if (require.main === module) {
    humanizeChapter('chapters/chapter-01-introduction.md')
        .then(path => console.log(`Done! Output: ${path}`))
        .catch(console.error);
}

module.exports = { humanizeChapter };
