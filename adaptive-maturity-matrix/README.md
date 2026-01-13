# AMX (Adaptive Maturity eXplorer)

Widget embedding utilities and parent page templates for integrating the Adaptive Maturity Matrix into external websites and content management systems.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: HTML, JavaScript, CSS
**Related**: [Adaptive Maturity Assessment](../adaptive-maturity-assessment-amis/)
**Status**: Utility

---

## Overview

AMX provides embeddable widgets and integration utilities for displaying adaptive maturity assessment content in external environments like WordPress, Typepad, or custom websites. It includes search functionality, comparison modes, and a complete adaptive maturity matrix interface.

### Key Features

- **Embeddable Widget**: Self-contained HTML/CSS/JavaScript for easy integration
- **Search Functionality**: Full-text search across maturity matrix content
- **Comparison Mode**: Side-by-side comparison of different maturity cards
- **Tabbed Interface**: Process, Maturity, Indicators (PMI) organization
- **Responsive Design**: Works on desktop and mobile
- **WordPress/Typepad Ready**: No external dependencies
- **Brand Styling**: BIMei color scheme and typography

---

## Files

```
amx/
├── index.html          # Main AMX widget with all functionality
├── embed-parent.js     # Parent page integration script
└── README.md           # This file
```

---

## Quick Start

### Embedding in a Website

1. **Copy the widget code**
   ```html
   <div id="amx-widget" lang="en" role="region" aria-label="Adaptive Maturity Matrix">
     <!-- Widget content from index.html -->
   </div>
   ```

2. **Include in your HTML**
   - For WordPress: Add to a Custom HTML block
   - For Typepad: Add to a post or page
   - For custom sites: Insert directly into HTML

### Features

#### Single Card Mode
- **View**: Display one maturity card at a time
- **Dropdowns**: Select Process and Maturity level
- **Tabs**: Switch between Process, Maturity, and Indicators
- **Actions**: Copy link, add to comparison

#### Compare Mode
- **Grid**: Side-by-side comparison of selected cards
- **Remove**: Delete cards from comparison
- **Clear**: Reset comparison

#### Search
- **Full-text**: Search across all card content
- **Highlights**: Matched terms highlighted in results
- **Metadata**: Shows Process/Maturity/Indicator tags
- **Click to view**: Select result to display card

---

## Widget Structure

### Top Bar
```
┌─────────────────────────────────────┐
│ [Search Box]          [Compare ☐]  │
└─────────────────────────────────────┘
```

### Single Card View
```
┌─────────────────────────────────────┐
│ Process: [Dropdown ▼]              │
│ Maturity: [Dropdown ▼]             │
├─────────────────────────────────────┤
│ [Process] [Maturity] [Indicators]  │
├─────────────────────────────────────┤
│ Title                               │
│ Metadata tags                       │
│ Description content...              │
│ [Copy Link] [Add to Compare]       │
└─────────────────────────────────────┘
```

### Compare Mode
```
┌──────────────────┬──────────────────┐
│ Card 1           │ Card 2           │
│ Title            │ Title            │
│ Content...       │ Content...       │
│ [Remove]         │ [Remove]         │
├──────────────────┼──────────────────┤
│ Card 3           │ Card 4           │
│ ...              │ ...              │
└──────────────────┴──────────────────┘
```

---

## Customization

### Brand Colors

Edit CSS variables in the `<style>` section:

```css
#amx-widget {
  --amx-brand: #f73f37;        /* Primary brand color */
  --amx-text: #111827;         /* Text color */
  --amx-muted: #6b7280;        /* Muted text */
  --amx-border: #e5e7eb;       /* Border color */
  --amx-bg: #ffffff;           /* Background */
  --amx-soft: #fafafa;         /* Soft background */
  --amx-badge-bg: #fde8e7;     /* Badge background */
  --amx-badge-br: #f8c6c3;     /* Badge border */
}
```

### Typography

```css
#amx-widget {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  max-width: 650px;
}
```

### Button Styles

```css
#amx-widget .btn {
  background: var(--amx-brand);
  color: #fff;
  border: 0;
  border-radius: 0;  /* Flat design */
  padding: 10px 12px;
}
```

---

## Data Structure

The widget uses a hardcoded data structure:

```javascript
const AMX_DATA = [
  {
    process: "Process Name",
    maturity: "Maturity Level",
    indicator: "Indicator Type",
    process_text: "Process description...",
    maturity_text: "Maturity description...",
    indicator_text: "Indicator description..."
  },
  // ... more cards
];
```

### Adding New Cards

1. Open `index.html`
2. Find the `AMX_DATA` array
3. Add a new object:

```javascript
{
  process: "Information Management",
  maturity: "Optimized",
  indicator: "Continuous Improvement",
  process_text: "Information is managed systematically...",
  maturity_text: "Processes are continuously optimized...",
  indicator_text: "Evidence: regular review cycles..."
}
```

---

## Integration Examples

### WordPress

1. **Add Custom HTML Block**
2. **Paste widget code** from `index.html`
3. **Preview and publish**

### Typepad

1. **Create new post**
2. **Switch to HTML editor**
3. **Paste widget code**
4. **Save and publish**

### Iframe Embedding

```html
<iframe
  src="path/to/amx/index.html"
  width="100%"
  height="800px"
  frameborder="0"
  title="Adaptive Maturity Matrix">
</iframe>
```

### JavaScript Integration

Use `embed-parent.js` to embed the widget programmatically:

```javascript
// Load and inject widget into page
loadAMXWidget('amx-container');
```

---

## Features Deep Dive

### Search Functionality

- **Full-text search**: Searches across all text fields (process, maturity, indicator)
- **Real-time filtering**: Results update as you type
- **Highlighting**: Matched terms highlighted with `<mark>` tags
- **Metadata display**: Shows Process/Maturity/Indicator badges
- **Snippets**: Displays relevant text excerpt with match

### Comparison Mode

- **Toggle**: Checkbox to enable/disable compare mode
- **Add cards**: Click "Add to Compare" on any card
- **Grid layout**: 2-column responsive grid
- **Remove individual**: Remove cards one at a time
- **Clear all**: Reset comparison with one click

### Accessibility

- **ARIA labels**: All interactive elements labeled
- **Keyboard navigation**: Full keyboard support
- **Screen reader**: Semantic HTML with proper roles
- **Focus management**: Visible focus indicators

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

---

## Performance

- **Size**: ~20KB uncompressed (HTML + CSS + JS + data)
- **Load time**: < 500ms
- **Dependencies**: None (vanilla JavaScript)
- **Search**: Instant filtering (< 50ms)

---

## Deployment

### Static Hosting

Host `index.html` on any static file server:

```bash
# Copy to web server
cp index.html /var/www/html/amx/

# Or use cloud storage
gsutil cp index.html gs://your-bucket/amx/
```

### CDN

For faster loading, host on a CDN:

```html
<script src="https://cdn.example.com/amx/embed.js"></script>
```

---

## Troubleshooting

### Widget not displaying
- Check HTML is properly closed
- Verify CSS is included
- Check browser console for errors

### Search not working
- Ensure JavaScript is enabled
- Check data is loaded (`AMX_DATA` array)
- Verify input event listeners attached

### Compare mode issues
- Check localStorage is available
- Verify comparison array is updating
- Clear browser cache

---

## Related Tools

- [adaptive-maturity-assessment-amis](../adaptive-maturity-assessment-amis/) - Full assessment tool
- [adaptive-maturity-map](../adaptive-maturity-map/) - Visualization companion

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.
