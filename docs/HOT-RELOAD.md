# Hot-Reload for Markdown Files

The hot-reload feature automatically rebuilds your PDF when markdown files change, providing instant visual feedback during writing.

## 🔥 Features

- **Automatic rebuild** when chapters or metadata change
- **Live preview updates** without manual refresh
- **Smart debouncing** to avoid excessive rebuilds
- **Visual notifications** when rebuilds occur
- **Error handling** with clear feedback

## 🚀 Quick Start

```bash
# Start preview with hot-reload
npm run preview:hot

# Open browser to see live updates
http://localhost:3001
```

## 📝 What It Watches

The hot-reload system monitors:
- `chapters/*.md` - All chapter files
- `metadata.yaml` - Book metadata
- `assets/css/*.css` - Stylesheets
- `assets/images/*` - Images including cover

## ⚡ How It Works

1. **File Detection**: Uses chokidar to watch for changes
2. **Debouncing**: Waits 1 second after changes stop
3. **Smart Rebuild**: Only rebuilds what's necessary
4. **Live Update**: WebSocket notifies browser instantly
5. **Visual Feedback**: Shows progress in real-time

## 🎯 Writing Workflow

1. Start hot-reload preview:
   ```bash
   npm run preview:hot
   ```

2. Open preview in browser:
   ```
   http://localhost:3001
   ```

3. Edit your markdown files in your favorite editor

4. Save changes - preview updates automatically!

## ⚙️ Configuration

### Disable Hot-Reload

```bash
# Preview without hot-reload
node preview-system/pdf-preview-generator-hotreload.js --no-hot-reload
```

### Verbose Mode

```bash
# See detailed file change logs
npm run preview:hot -- --verbose
```

### Custom Watch Paths

Edit `preview-system/pdf-preview-generator-hotreload.js`:

```javascript
watchPaths: [
    'chapters/*.md',
    'metadata.yaml',
    'custom/path/*.txt'  // Add custom paths
]
```

## 🔔 Notifications

When files change, you'll see:
- Orange notification popup in browser
- Status update: "Hot-reloading..."
- Log entry with trigger file
- Progress bar during rebuild

## ⚡ Performance

- **Debounce**: 1 second delay prevents rapid rebuilds
- **Queue**: Pending changes handled after current build
- **Incremental**: Future optimization for faster rebuilds

## 🐛 Troubleshooting

### Rebuilds Not Triggering

1. Check file paths are correct
2. Verify watcher is running (check logs)
3. Ensure files are saved to disk
4. Try verbose mode to debug

### Browser Not Updating

1. Check WebSocket connection in console
2. Verify preview server is running
3. Try manual page refresh
4. Check for JavaScript errors

### Too Many Rebuilds

1. Increase debounce time
2. Check for editor auto-save settings
3. Exclude backup/temp files

## 🔧 Advanced Usage

### Programmatic API

```javascript
const PDFPreviewGeneratorHotReload = require('./preview-system/pdf-preview-generator-hotreload');

const generator = new PDFPreviewGeneratorHotReload({
    enableHotReload: true,
    verbose: true,
    watchPaths: ['custom/*.md']
});

generator.generate();
```

### Custom File Handlers

Extend the watcher for custom file types:

```javascript
watcher.on('file:change', (event) => {
    if (event.path.endsWith('.json')) {
        // Custom JSON handling
    }
});
```

## 💡 Tips

1. **Split screen**: Editor on left, preview on right
2. **Auto-save**: Enable in your editor for seamless updates
3. **Focus mode**: Hide logs for distraction-free writing
4. **Multiple monitors**: Preview on second screen

## 🚧 Future Enhancements

- [ ] Incremental page updates (only changed pages)
- [ ] Markdown syntax highlighting in preview
- [ ] Scroll position preservation
- [ ] Change indicators in page list
- [ ] Diff view for changes