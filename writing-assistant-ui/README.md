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
