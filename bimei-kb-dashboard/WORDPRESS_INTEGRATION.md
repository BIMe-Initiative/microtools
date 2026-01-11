# BIMei KB Dashboard - WordPress Integration Guide

## Integration Methods

### Method 1: Custom HTML Block (Recommended)
**Best for**: Themeco Pro, Elementor, Gutenberg
**Pros**: Direct integration, no external dependencies, full control
**Cons**: Requires copying HTML code

#### Steps:
1. Copy entire content from `B_Dashboard_WordPress.html`
2. In WordPress admin, create new page/post
3. Add "Custom HTML" block (Gutenberg) or "Code" element (page builders)
4. Paste the complete HTML code
5. Publish

#### Themeco Pro/Cornerstone Specific:
```
1. Edit page with Cornerstone
2. Add "Code" element
3. Paste HTML in "Content" field
4. Set "Output" to "HTML"
5. Configure responsive settings if needed
```

### Method 2: Shortcode Integration
**Best for**: Reusable across multiple pages
**Pros**: Easy to use, consistent updates
**Cons**: Requires functions.php modification

#### Implementation:
Add to your theme's `functions.php`:

```php
function bimei_kb_dashboard_shortcode($atts) {
    $atts = shortcode_atts(array(
        'width' => '100%',
        'height' => '800px'
    ), $atts);
    
    $dashboard_url = get_template_directory_uri() . '/bimei-kb-dashboard.html';
    
    return '<iframe src="' . esc_url($dashboard_url) . '" 
                    width="' . esc_attr($atts['width']) . '" 
                    height="' . esc_attr($atts['height']) . '" 
                    frameborder="0" 
                    style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            </iframe>';
}
add_shortcode('bimei_dashboard', 'bimei_kb_dashboard_shortcode');
```

#### Usage:
```
[bimei_dashboard]
[bimei_dashboard width="100%" height="600px"]
```

### Method 3: File Upload + Iframe
**Best for**: Static hosting, CDN integration
**Pros**: Fast loading, cacheable
**Cons**: Requires file management

#### Steps:
1. Upload `B_Dashboard_WordPress.html` to `/wp-content/uploads/`
2. Rename to `bimei-kb-dashboard.html`
3. Embed with iframe:

```html
<iframe src="/wp-content/uploads/bimei-kb-dashboard.html" 
        width="100%" 
        height="800px" 
        frameborder="0"
        style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
</iframe>
```

### Method 4: Plugin Development
**Best for**: Advanced customization, multiple sites
**Pros**: Professional integration, update management
**Cons**: Requires PHP development

#### Basic Plugin Structure:
```php
<?php
/**
 * Plugin Name: BIMei KB Dashboard
 * Description: Embeds BIMei Knowledge Dashboard
 * Version: 1.0.0
 */

class BIMeiKBDashboard {
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_shortcode('bimei_kb_dashboard', array($this, 'render_dashboard'));
    }
    
    public function enqueue_scripts() {
        wp_enqueue_script('bimei-dashboard', 
            plugin_dir_url(__FILE__) . 'assets/dashboard.js', 
            array(), '1.0.0', true);
    }
    
    public function render_dashboard($atts) {
        ob_start();
        include plugin_dir_path(__FILE__) . 'templates/dashboard.php';
        return ob_get_clean();
    }
}

new BIMeiKBDashboard();
?>
```

## WordPress Theme Compatibility

### Common Issues & Solutions

#### 1. CSS Conflicts
**Problem**: Theme styles override dashboard styles
**Solution**: All dashboard styles use `!important` and `bimei-kb-wp-` prefixes

#### 2. JavaScript Conflicts
**Problem**: Theme JS interferes with dashboard
**Solution**: Dashboard uses namespaced functions and event isolation

#### 3. Responsive Issues
**Problem**: Dashboard doesn't fit theme layout
**Solution**: Dashboard includes responsive breakpoints and flexible sizing

#### 4. Font Conflicts
**Problem**: Theme fonts override dashboard fonts
**Solution**: Dashboard specifies font-family with fallbacks

### Theme-Specific Notes

#### Themeco Pro/X Theme
- Use "Code" element in Cornerstone
- Set element to "HTML" output mode
- Disable theme's CSS optimization if conflicts occur

#### Elementor
- Use "HTML" widget
- Paste complete dashboard code
- Set widget width to 100%

#### Divi
- Use "Code" module
- Paste in "Content" tab
- Disable Divi's CSS minification if needed

#### Gutenberg/Block Editor
- Use "Custom HTML" block
- Paste complete code
- Preview to ensure proper rendering

## Performance Optimization

### Loading Speed
```html
<!-- Add to dashboard HTML head for faster loading -->
<link rel="preconnect" href="https://australia-southeast1-bimei-ai.cloudfunctions.net">
<link rel="dns-prefetch" href="//australia-southeast1-bimei-ai.cloudfunctions.net">
```

### Caching
- Dashboard works with WordPress caching plugins
- API responses are not cached (real-time data)
- Static assets can be cached indefinitely

### CDN Integration
```html
<!-- Host dashboard on CDN for better performance -->
<iframe src="https://cdn.yourdomain.com/bimei-kb-dashboard.html" 
        width="100%" 
        height="800px" 
        frameborder="0">
</iframe>
```

## Security Considerations

### Content Security Policy
If your site uses CSP, add:
```
script-src 'self' 'unsafe-inline' australia-southeast1-bimei-ai.cloudfunctions.net;
connect-src 'self' australia-southeast1-bimei-ai.cloudfunctions.net;
```

### HTTPS Requirements
- Dashboard requires HTTPS for API calls
- Ensure WordPress site uses SSL certificate
- Mixed content warnings will block functionality

## Customization Options

### Styling Customization
```css
/* Add to WordPress theme's style.css */
.bimei-kb-dashboard-wp {
    /* Override dashboard container styles */
    max-width: 1400px !important;
    background: #ffffff !important;
}

.bimei-kb-dashboard-wp .bimei-kb-wp-title {
    /* Customize title */
    color: #your-brand-color !important;
}
```

### Configuration Options
```javascript
// Add to dashboard script section
window.BIMeiKBDashboardWP.config = {
    apiEndpoint: 'your-custom-endpoint',
    theme: 'custom',
    modules: ['text', 'sources', 'evidence'] // Enable specific modules only
};
```

## Troubleshooting

### Common Issues

#### Dashboard Not Loading
1. Check browser console for errors
2. Verify HTTPS is enabled
3. Check for JavaScript conflicts
4. Ensure proper HTML structure

#### API Calls Failing
1. Verify API endpoint is accessible
2. Check CORS configuration
3. Confirm network connectivity
4. Review browser security settings

#### Styling Issues
1. Check for CSS conflicts in browser inspector
2. Verify `!important` declarations are working
3. Test with theme's default styles disabled
4. Check responsive breakpoints

#### Mobile Issues
1. Test viewport meta tag is present
2. Verify touch events work properly
3. Check responsive grid layout
4. Test on actual devices

### Debug Mode
Add to dashboard HTML for debugging:
```javascript
window.BIMEI_DEBUG = true;
```

This enables console logging for troubleshooting.

## Testing Checklist

### Pre-Launch Testing
- [ ] Desktop responsive design (1200px+)
- [ ] Tablet layout (768px-1023px)
- [ ] Mobile layout (<768px)
- [ ] All modules load correctly
- [ ] API calls work (or mock data displays)
- [ ] No JavaScript errors in console
- [ ] No CSS conflicts with theme
- [ ] Accessibility features work
- [ ] Loading states display properly
- [ ] Error handling works

### Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

### WordPress Testing
- [ ] Works with caching plugins
- [ ] Compatible with security plugins
- [ ] No conflicts with other plugins
- [ ] Proper display in theme
- [ ] Shortcode works (if implemented)

## Support

For integration issues:
1. Check browser console for errors
2. Test with default WordPress theme
3. Disable other plugins temporarily
4. Contact BIMei support with specific error messages

## Updates

When updating the dashboard:
1. Replace HTML file content
2. Clear WordPress caches
3. Test functionality
4. Update version number in comments