#!/bin/bash

# AI Writing Assistant Integration Script
# Integrates the AI Writing Assistant with the existing book pipeline

set -e

echo "🤖 AI Writing Assistant Integration"
echo "=================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root"
    exit 1
fi

# Install server dependencies
echo -e "${YELLOW}Installing server dependencies...${NC}"
cd writing-assistant-server
npm install
cd ..

# Install Python dependencies
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip3 install nltk pyyaml

# Download NLTK data
echo -e "${YELLOW}Downloading NLTK data...${NC}"
python3 -c "
import nltk
nltk.download('punkt', quiet=True)
nltk.download('stopwords', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
"

# Create startup script
echo -e "${YELLOW}Creating startup script...${NC}"
cat > start-writing-assistant.sh << 'EOF'
#!/bin/bash

# Start AI Writing Assistant Server

echo "🚀 Starting AI Writing Assistant..."

# Start the server
cd writing-assistant-server
npm start &
SERVER_PID=$!

echo "✅ Server started (PID: $SERVER_PID)"
echo "📝 Open http://localhost:3002 in your browser"
echo ""
echo "Press Ctrl+C to stop"

# Wait for interrupt
trap "echo ''; echo 'Shutting down...'; kill $SERVER_PID; exit 0" INT
wait $SERVER_PID
EOF

chmod +x start-writing-assistant.sh

# Add to package.json scripts
echo -e "${YELLOW}Updating package.json scripts...${NC}"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts['writing-assistant'] = './start-writing-assistant.sh';
pkg.scripts['wa'] = './start-writing-assistant.sh';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

# Create example integration
echo -e "${YELLOW}Creating example integration...${NC}"
cat > examples/writing-assistant-integration.js << 'EOF'
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
EOF

# Create README for the writing assistant
echo -e "${YELLOW}Creating documentation...${NC}"
cat > writing-assistant-ui/README.md << 'EOF'
# AI Writing Assistant

Real-time AI-powered writing assistant for creating human-like, engaging content.

## Features

- 🎨 **Real-time Style Suggestions**: Get instant feedback on writing style
- 🔍 **Consistency Checking**: Detect inconsistencies with story bible
- 🤖 **Humanization**: Transform AI-sounding text to natural human writing
- ✨ **Smart Autocomplete**: Context-aware completions
- 📊 **Humanity Score**: Track how human-like your writing is
- 📝 **Auto Summaries**: Generate chapter and section summaries

## Quick Start

```bash
# Start the writing assistant
npm run writing-assistant

# Or use the short alias
npm run wa
```

Then open http://localhost:3002 in your browser.

## Usage Tips

1. **Select Content Type**: Choose the type of content you're writing (technical, story, etc.)
2. **Real-time Feedback**: Issues and suggestions appear as you type
3. **Humanize Selection**: Select text and click "Humanize" to improve it
4. **Keyboard Shortcuts**:
   - `Ctrl+Space`: Trigger autocomplete
   - `Tab`: Indent
   - `Shift+Tab`: Outdent

## API Integration

The server provides REST endpoints for integration:

```javascript
// Humanize text
POST /api/humanize
{
  "text": "Your text here",
  "contentType": "general",
  "chapterNum": 1
}

// Analyze humanity score
POST /api/analyze
{
  "text": "Your text here"
}
```

## Configuration

Edit the humanization templates in:
- `context/humanization/voice-templates.yaml`
- `context/humanization/personal-stories.yaml`
- `context/humanization/imperfections.yaml`
EOF

echo -e "${GREEN}✅ AI Writing Assistant integration complete!${NC}"
echo ""
echo "To start the writing assistant:"
echo "  npm run writing-assistant"
echo ""
echo "Or integrate with your workflow:"
echo "  See examples/writing-assistant-integration.js"