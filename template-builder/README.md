# Money Machine Template Builder

Visual drag-and-drop template builder for creating custom ebook templates.

## Features

### 🎨 Visual Design
- Drag-and-drop components onto canvas
- Real-time preview of template changes
- Visual property editing for each component
- Grid, rulers, and guides for precise alignment

### 📦 Component Library
- **Cover Page**: Title, subtitle, and author
- **Table of Contents**: Chapter listings with page numbers
- **Chapter Headers**: Numbered chapters with titles
- **Callout Boxes**: Info, warning, success, and danger styles
- **Quote Blocks**: Styled quotations with attribution
- **Images**: With captions and sizing options
- **Lists**: Bullet and numbered lists
- **Code Blocks**: Syntax highlighting support
- **Dividers**: Visual separators
- **Footers**: Page numbers and custom content

### 🎯 Pre-built Templates
- **Professional Business**: Clean, corporate design
- **Inspiring Self-Help**: Warm, engaging layout
- **Technical Documentation**: Code-friendly formatting
- **Classic Fiction**: Elegant novel styling
- **Educational Textbook**: Structured learning format

### 🛠️ Customization Options
- Font family selection
- Color scheme (primary, secondary, text)
- Page size (6×9, 5.5×8.5, 8.5×11, A4, A5)
- Margin controls
- Component-specific styling

### 💾 Export Options
- **JSON Template**: Save template structure
- **HTML/CSS**: Export as web files
- **Complete Package**: ZIP with all assets

## Installation

```bash
# Navigate to template builder directory
cd template-builder

# Start the builder
./start-builder.sh
```

## Usage

### Creating a New Template

1. **Choose Template Type**: Select from the dropdown or start with Custom
2. **Add Components**: Drag components from the sidebar onto the canvas
3. **Arrange Layout**: Reorder components by dragging within the canvas
4. **Customize Properties**: Click components to edit their properties
5. **Apply Global Styles**: Set fonts, colors, and page settings

### Working with Components

#### Adding Components
- Drag from the component list in the sidebar
- Drop onto the canvas or between existing components
- Components automatically stack vertically

#### Editing Components
- Click to select and view properties
- Right-click for context menu options
- Use property panel to modify content and styles

#### Component Actions
- **Edit**: Modify component content
- **Duplicate**: Create a copy below
- **Move Up/Down**: Reorder in the layout
- **Delete**: Remove from template

### View Modes

- **Design View**: Visual canvas for building
- **Code View**: See generated HTML/CSS/Markdown
- **Split View**: Side-by-side design and code

### Keyboard Shortcuts

- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + S`: Save template
- `Ctrl/Cmd + D`: Duplicate selected component
- `Delete`: Delete selected component

### Saving and Loading

#### Save Template
1. Click "Save" button or press Ctrl/Cmd + S
2. Template saves to browser storage
3. Appears in "Saved Templates" sidebar

#### Load Template
1. Click template name in sidebar
2. Or use pre-built templates
3. Template loads with all settings

### Exporting Templates

#### JSON Export
- Complete template structure
- Import into automation pipeline
- Share with other users

#### HTML Export
- Standalone HTML file
- Includes embedded CSS
- Ready for web viewing

#### Package Export
- ZIP file with all assets
- Separated HTML/CSS files
- Font and image resources

## Template Structure

```json
{
  "name": "My Template",
  "type": "business",
  "components": [
    {
      "id": "component-123",
      "type": "cover",
      "content": {
        "title": "Book Title",
        "subtitle": "Subtitle",
        "author": "Author Name"
      },
      "styles": {
        "textAlign": "center",
        "padding": "4rem 2rem"
      }
    }
  ],
  "styles": {
    "fontFamily": "Inter",
    "primaryColor": "#2563eb",
    "secondaryColor": "#10b981",
    "textColor": "#1f2937",
    "pageSize": "6x9",
    "margins": {
      "top": 1,
      "right": 0.75,
      "bottom": 1,
      "left": 0.75
    }
  }
}
```

## Integration with Pipeline

Templates created in the builder can be used in the automation pipeline:

```javascript
// Load template
const template = require('./templates/my-template.json');

// Apply to content generation
const ebook = generateEbook({
  content: chapterData,
  template: template
});
```

## Customization

### Adding New Components

1. Add component to `components.js`:
```javascript
window.componentRenderers.myComponent = (component) => {
  return `<div class="my-component">${component.content}</div>`;
};
```

2. Add properties panel:
```javascript
window.componentProperties.myComponent = (component) => {
  return `<input type="text" data-property="content" value="${component.content}">`;
};
```

3. Add to component list in HTML

### Creating Custom Templates

1. Build template visually
2. Export as JSON
3. Add to `templates.js`:
```javascript
window.prebuiltTemplates.myTemplate = {
  name: 'My Custom Template',
  type: 'custom',
  components: [...],
  styles: {...}
};
```

## Tips

- **Start with a pre-built template** and customize
- **Use consistent spacing** between components
- **Test preview** before exporting
- **Save frequently** to avoid losing work
- **Export JSON** for version control

## Troubleshooting

### Components not dragging
- Ensure JavaScript is enabled
- Check browser console for errors
- Try refreshing the page

### Styles not applying
- Verify property values are valid
- Check CSS syntax in code view
- Ensure global styles are set

### Export not working
- Check browser permissions
- Try different export format
- Verify template has components

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Future Enhancements

- [ ] Multi-page template support
- [ ] Custom CSS editor
- [ ] Image upload functionality
- [ ] Template marketplace
- [ ] Collaborative editing
- [ ] Version history
- [ ] A/B template testing