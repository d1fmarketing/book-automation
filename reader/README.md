# Enhanced Ebook Reader UI 📚

Professional ebook reader with advanced analytics, social features, and engagement tracking.

## Features

### 📖 Core Reading Experience
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Night Mode**: Eye-friendly dark theme for night reading
- **Customizable Reading**: Adjust font size, line height, font family
- **Progress Tracking**: Visual progress bar and reading time estimates
- **Chapter Navigation**: Easy navigation with keyboard shortcuts
- **Bookmarks**: Save your place across multiple chapters
- **Notes**: Add personal notes to any chapter
- **Print Support**: Clean print layout for physical copies

### 📊 Analytics & Tracking
- **Reading Time**: Track total time spent reading
- **Scroll Depth**: Monitor how much content is actually read
- **Chapter Completion**: Track which chapters are completed
- **Engagement Score**: Calculate reader engagement level
- **Link Tracking**: Monitor internal and affiliate link clicks
- **Privacy Controls**: Users can disable analytics anytime

### 🔗 Social Features
- **Text Highlighting**: Select and highlight important passages
- **Social Sharing**: Share quotes on Twitter, LinkedIn, Facebook
- **Reader Reviews**: 5-star rating system with written reviews
- **Social Proof**: Real-time notifications of other readers
- **Recommendations**: "Readers also enjoyed" suggestions
- **Comments**: Discussion system for each chapter

### 🎯 Interactive Elements
- **AI Chat Widget**: Integrated from main system
- **Progress Certificates**: Completion certificates for readers
- **Interactive Quizzes**: Test knowledge (future feature)
- **Email Capture**: Newsletter signup integration

## Quick Start

```bash
# Start the reader server
cd reader
node server.js

# Or use npm script from root
npm run reader:server

# Access reader at
http://localhost:3003
```

## Integration with Money Machine

The reader automatically integrates with generated ebooks:

1. **Automatic Detection**: Finds all ebooks in `build/ebooks/`
2. **Analytics Integration**: Sends data to Money Machine Dashboard
3. **Affiliate Tracking**: Monitors conversions from affiliate links
4. **Chat Widget**: Includes AI assistant if configured

## URL Parameters

```
# Load specific ebook
http://localhost:3003/?id=chatgpt-ai-prompts-for-business-success

# Start at specific chapter
http://localhost:3003/?id=ebook-id&chapter=2

# Demo mode (uses sample content)
http://localhost:3003/?demo=true
```

## Analytics Data

### Events Tracked
- `page-view`: Chapter views with timestamps
- `reading-progress`: Progress through chapters
- `scroll-depth`: How far users scroll (25%, 50%, 75%, 100%)
- `link-click`: All link clicks with categorization
- `affiliate-click`: Special tracking for monetized links
- `text-highlight`: When users highlight text
- `note-added`: Note creation with length
- `bookmark`: Add/remove bookmarks
- `social-share`: Shares by platform
- `settings-change`: Preference changes

### Privacy & Compliance
- Analytics off by default (user must opt-in)
- All data stored locally first
- No PII collected
- Export/delete options available
- GDPR compliant design

## Customization

### Themes
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #7c3aed;
    --reading-font: 'Merriweather', Georgia, serif;
    --reading-width: 680px;
}
```

### Adding Features
1. **New Analytics Event**:
```javascript
// In your feature code
window.ebookAnalytics.trackEvent('custom-event', {
    data: 'value'
});
```

2. **New Social Platform**:
```javascript
// In social.js
shareOnPlatform() {
    const url = `https://platform.com/share?url=${this.shareUrl}`;
    this.openShareWindow(url, 'platform');
}
```

3. **Custom Modal**:
```html
<!-- Add to index.html -->
<div class="modal" id="custom-modal">
    <div class="modal-content">
        <!-- Your content -->
    </div>
</div>
```

## API Endpoints

### Reader API
- `GET /api/ebook/:id` - Get ebook data and chapters
- `GET /api/ebooks` - List all available ebooks
- `POST /api/analytics` - Send analytics events
- `GET /api/analytics/:ebookId` - Get analytics summary

### Analytics Payload
```javascript
POST /api/analytics
{
    sessionId: "session_123",
    ebookId: "ebook-id",
    event: {
        type: "page-view",
        timestamp: 1234567890,
        data: {
            chapter: 1,
            title: "Chapter Title"
        }
    }
}
```

## Performance Optimizations

- **Lazy Loading**: Chapters load on demand
- **Local Storage**: Settings and progress cached locally
- **Debounced Tracking**: Scroll events throttled
- **Minimal Dependencies**: No heavy frameworks
- **Async Loading**: Non-blocking script loading

## Mobile Experience

- **Touch Gestures**: Swipe for chapter navigation
- **Responsive Typography**: Automatic font scaling
- **Offline Support**: Works without connection
- **PWA Ready**: Can be installed as app

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: ARIA labels throughout
- **High Contrast**: Works with system preferences
- **Focus Management**: Proper focus handling
- **Text Scaling**: Respects browser zoom

## Testing

```bash
# Test with demo content
node server.js
# Visit http://localhost:3003/?demo=true

# Test with real ebook
# First generate an ebook with Money Machine
npm run money:generate
# Then visit reader
http://localhost:3003
```

## Production Deployment

### Standalone Deployment
```bash
# Using PM2
pm2 start reader/server.js --name ebook-reader

# Using Docker
docker build -t ebook-reader ./reader
docker run -p 3003:3003 ebook-reader
```

### Integrated Deployment
The reader can be served directly from your main app:
```javascript
// In your Express app
app.use('/reader', express.static('reader'));
```

### CDN Setup
Static assets can be served from CDN:
```html
<link rel="stylesheet" href="https://cdn.example.com/reader/styles.css">
<script src="https://cdn.example.com/reader/analytics.js"></script>
```

## Troubleshooting

### Reader Won't Load
- Check if server is running: `lsof -i:3003`
- Verify ebook exists in `build/ebooks/`
- Check browser console for errors

### Analytics Not Working
- Verify analytics is enabled in settings
- Check network tab for `/api/analytics` calls
- Ensure server CORS is configured

### Styles Look Wrong
- Clear browser cache
- Check for CSS conflicts with parent page
- Verify font files are loading

## Future Enhancements

- [ ] Full-text search across chapters
- [ ] Audio narration support
- [ ] Translation to multiple languages
- [ ] Collaborative highlighting
- [ ] Reading groups/clubs
- [ ] Gamification elements
- [ ] Speed reading mode
- [ ] Export annotations
- [ ] Sync across devices
- [ ] Payment integration