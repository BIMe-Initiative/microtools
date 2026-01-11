# BIMei KB Dashboard - Deployment Configuration

## Google Cloud Function Deployment

### Prerequisites
```bash
# Install Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth login
gcloud config set project bimei-ai
```

### Environment Variables
Create `.env.yaml` file:
```yaml
NEO4J_URI: "neo4j+s://your-instance.databases.neo4j.io"
NEO4J_USER: "neo4j"
NEO4J_PASSWORD: "your-password"
GOOGLE_API_KEY: "your-vertex-ai-key"
VERTEX_PROXY_URL: "https://australia-southeast1-bimei-ai.cloudfunctions.net/bimei-chatbot"
GRAPH_QUERY_URL: "https://australia-southeast1-bimei-ai.cloudfunctions.net/graphQuery"
```

### Deploy API Function
```bash
# Deploy unified dashboard API
gcloud functions deploy dashboardApi \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file .env.yaml \
  --memory 512MB \
  --timeout 60s \
  --region australia-southeast1

# Get function URL
gcloud functions describe dashboardApi --region australia-southeast1 --format="value(httpsTrigger.url)"
```

### Update Dashboard Configuration
Update the API endpoint in `B_Dashboard_UI.html`:
```javascript
this.config = {
  apiEndpoint: 'https://australia-southeast1-bimei-ai.cloudfunctions.net/dashboardApi'
};
```

## WordPress Integration

### Method 1: Custom HTML Block (Recommended)
1. Copy entire `B_Dashboard_UI.html` content
2. Create new WordPress page/post
3. Add "Custom HTML" block
4. Paste dashboard HTML
5. Publish

### Method 2: Themeco Pro/Cornerstone
1. Create new page with Cornerstone
2. Add "Code" element
3. Paste dashboard HTML in content area
4. Configure responsive settings
5. Publish

### Method 3: File Upload + Embed
```bash
# Upload dashboard file to WordPress
wp-content/uploads/bimei-kb-dashboard.html

# Embed with iframe
<iframe src="/wp-content/uploads/bimei-kb-dashboard.html" 
        width="100%" 
        height="800px" 
        frameborder="0">
</iframe>
```

## Testing

### Local Testing
```bash
# Start local server
cd bimei-kb-dashboard
python3 -m http.server 8000

# Test in browser
open http://localhost:8000/B_Dashboard_UI.html
```

### API Testing
```bash
# Test unified API
curl -X POST https://your-function-url/dashboardApi \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is BIM?",
    "modules": ["text", "sources", "evidence", "path", "graph"]
  }'
```

### Mobile Testing
- Chrome DevTools responsive mode
- Test on actual devices
- Verify touch interactions
- Check loading performance

## Monitoring

### Cloud Function Logs
```bash
# View function logs
gcloud functions logs read dashboardApi --region australia-southeast1

# Real-time logs
gcloud functions logs tail dashboardApi --region australia-southeast1
```

### Performance Metrics
- Response time < 3 seconds
- Mobile load time < 2 seconds
- Error rate < 1%
- Uptime > 99.9%

## Security

### CORS Configuration
Already configured in function for WordPress integration:
```javascript
res.set('Access-Control-Allow-Origin', '*');
res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
```

### API Rate Limiting
Consider implementing rate limiting for production:
```javascript
// Add to function
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

## Troubleshooting

### Common Issues
1. **CORS Errors**: Verify function CORS headers
2. **API Timeouts**: Check Neo4j connection
3. **Module Failures**: Check individual API endpoints
4. **WordPress Conflicts**: Use CSS prefixes and !important

### Debug Mode
Add to dashboard HTML for debugging:
```javascript
// Enable debug logging
window.BIMEI_DEBUG = true;

// Add to dashboard constructor
if (window.BIMEI_DEBUG) {
  console.log('Dashboard initialized with config:', this.config);
}
```