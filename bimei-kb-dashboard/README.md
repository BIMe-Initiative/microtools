# BIMei Knowledge Dashboard

A modular, responsive dashboard for accessing BIMei knowledge base through multiple specialized interfaces.

## Features

- **Modular Architecture**: Independent modules with their own state management
- **Responsive Design**: Mobile-friendly layout with adaptive grid system
- **WordPress Integration**: Embeddable as custom code snippet or iframe
- **Future-Ready**: Plugin architecture for additional modules

## Modules

### Core Modules (Phase 1-3)
1. **Text Response** - Parsed markdown responses from AI
2. **Sources** - Data store links with type indicators
3. **SEW Evidence** - Semantic evidence weights and scoring
4. **Path Visualization** - Knowledge graph path chains
5. **Interactive Graph** - NeoDash-powered graph exploration

### Future Modules (Extensible)
- **Notepad** - Comment and annotation system
- **Image Gallery** - BIMei knowledge base assets
- **Custom Modules** - WordPress plugins, external APIs, iframes

## WordPress Integration

### Method 1: Custom Code Snippet (Recommended)
```html
<!-- Paste this into Themeco Pro/Cornerstone custom code block -->
<div id="bimei-kb-embed"></div>
<script>
  fetch('/wp-content/uploads/bimei-kb-dashboard.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('bimei-kb-embed').innerHTML = html;
    });
</script>
```

### Method 2: Direct HTML Embed
```html
<!-- Copy entire B_Dashboard_UI.html content into WordPress page -->
```

### Method 3: Iframe Embed
```html
<iframe 
  src="https://your-domain.com/bimei-kb-dashboard/" 
  width="100%" 
  height="800px" 
  frameborder="0">
</iframe>
```

## Development

### Local Development
```bash
# Start local server
npm run dev
# or
python -m http.server 8000

# Open browser
open http://localhost:8000/B_Dashboard_UI.html
```

### Testing Responsive Design
- **Desktop**: 1200px+ (5-panel grid)
- **Tablet**: 768px-1023px (4-panel grid)
- **Mobile**: <768px (single column)

## Architecture

### Module System
```javascript
// Register new module
window.BIMeiKB.registerModule('custom-module', new CustomModule());

// Module base class
class CustomModule extends BaseModule {
  constructor() {
    super('custom-module');
  }
  
  onQueryComplete(detail) {
    // Handle query results
    this.updateContent('<p>Custom content</p>');
    this.updateUI('success');
  }
}
```

### Event System
```javascript
// Listen to dashboard events
dashboard.eventBus.addEventListener('query-start', (e) => {
  console.log('Query started:', e.detail.query);
});

// Broadcast custom events
dashboard.broadcast('custom-event', { data: 'value' });
```

## Configuration

### API Endpoints
```javascript
const config = {
  apiEndpoints: {
    vertex: 'https://australia-southeast1-bimei-ai.cloudfunctions.net/bimei-chatbot',
    graph: '/graphQuery',
    neodash: '/ask'
  }
};
```

### Module Configuration
```javascript
const moduleConfig = {
  text: { enabled: true, priority: 1 },
  sources: { enabled: true, priority: 2 },
  evidence: { enabled: true, priority: 3 },
  path: { enabled: true, priority: 4 },
  graph: { enabled: true, priority: 5 }
};
```

## Security

- **CSS Isolation**: All styles use `bimei-kb-` prefixes with `!important`
- **No External Dependencies**: Self-contained HTML file
- **CORS Compliant**: Proper headers for cross-origin requests
- **WordPress Safe**: No theme conflicts or plugin interference

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

## Development Phases

- ✅ **Phase 1**: Core Infrastructure (Complete)
- ⏳ **Phase 2**: API Integration
- ⏳ **Phase 3**: Module Development
- ⏳ **Phase 4**: WordPress Integration

## License

MIT License - See LICENSE file for details

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test across devices/browsers
5. Submit pull request

## Support

For issues and questions:
- GitHub Issues: https://github.com/BIMe-Initiative/microtools/issues
- Documentation: https://bimexcellence.org/