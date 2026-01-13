# BIMei Knowledge Dashboard

A modular, responsive dashboard for accessing the BIMei knowledge base through multiple specialized interfaces. Built with a clean, modern UI and deployed on Google Cloud Platform.

**Current Version**: v1.0.5
**Live Dashboard**: https://storage.googleapis.com/bimei-kb-dashboard/index.html
**API Endpoint**: https://dashboardapi-jilezw5qqq-ts.a.run.app

---

## Overview

The BIMei Knowledge Dashboard provides an integrated interface for querying the BIMei knowledge graph and receiving comprehensive, multi-faceted responses including text answers, source citations, knowledge paths, and interactive graph visualizations.

### Key Features

- **Unified API Backend**: Single Cloud Function (`dashboardApi`) coordinating multiple data sources
- **Modular Frontend**: Independent modules with event-driven communication
- **Neo4j Integration**: LangChain-powered graph Q&A via NeoDash adapter
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **Smart Filtering**: Modules hide automatically when no relevant data is available

---

## Architecture

### Technology Stack

- **Frontend**: Pure HTML/CSS/JavaScript with Tailwind CSS
- **Backend**: Node.js 20 Cloud Functions (Gen2)
- **Database**: Neo4j AuraDB (neo4j+s://4441767a.databases.neo4j.io)
- **LLM Integration**: Google Vertex AI (Gemini 2.5 Flash)
- **Graph Framework**: LangChain with Neo4jGraph
- **Hosting**: Google Cloud Storage (static files) + Cloud Functions (API)

### System Components

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (B_Dashboard_UI.html)                         │
│  ├─ Response Module        (Text answer + sources)      │
│  ├─ Sources Module         (Clickable resource links)   │
│  ├─ Evidence Module        (SEW scores - auto-hide)     │
│  ├─ Knowledge Path Module  (Graph path visualization)   │
│  └─ Interactive Graph      (vis-network visualization)  │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTPS
┌─────────────────────────────────────────────────────────┐
│  Cloud Function: dashboardApi (index.js)                │
│  ├─ Vertex Proxy Integration (Text + Sources)           │
│  ├─ NeoDash Adapter (Graph Q&A + Visualization)         │
│  └─ GraphQuery Integration (Knowledge Paths)            │
└─────────────────────────────────────────────────────────┘
                            ↓
         ┌──────────────────┴──────────────────┐
         ↓                                     ↓
┌──────────────────┐                  ┌──────────────────┐
│  Neo4j AuraDB    │                  │  Vertex AI       │
│  Knowledge Graph │                  │  Gemini 2.5      │
└──────────────────┘                  └──────────────────┘
```

---

## Dashboard Modules

### 1. Response Module
- Displays AI-generated text responses from the knowledge base
- Automatically strips "Evidence:" sections from output
- Source metadata (mode, word count)
- Copy-to-clipboard functionality
- Word wrapping for long URLs

**Auto-hide**: Never (always visible with query results)

### 2. Sources Module
- Clickable links to knowledge base resources
- Categorized by type (Dictionary, PDF, Page)
- Type icons and labels
- Hover effects and smooth transitions
- Strips `[Dictionary]`, `[Page]`, `[PDF]` prefixes from titles

**Auto-hide**: When no sources available

### 3. Evidence Module
- Semantic Evidence Weight (SEW) scores
- Confidence indicators
- Metric visualizations (hops, normalized score, raw score)

**Auto-hide**: When score = 0 or tier = "minimal"

### 4. Knowledge Path Module
- Visual path representation from query to answer
- Color-coded nodes by type
- Relationship labels between nodes
- Expandable view (currently disabled)

**Auto-hide**: When no path data available

### 5. Interactive Graph Module
- Graph Answer (relationship triplets)
- Cypher query display with copy functionality
- vis-network interactive visualization
- Node properties on hover

**Auto-hide**: When no edges exist (edges.length === 0)

---

## Files & Structure

### Core Files
```
bimei-kb-dashboard/
├── B_Dashboard_UI.html         # Main frontend (deployed to GCS)
├── index.js                    # Cloud Function entry point
├── F_NeoDash_Adapter.js        # LangChain + Neo4j integration
├── package.json                # Node.js dependencies
├── package-lock.json           # Dependency lock file
├── .env.yaml                   # Environment variables (not in git)
├── deploy-dashboard.sh         # GCS deployment script
├── README.md                   # This file
└── DEPLOYMENT.md               # Detailed deployment guide
```

### Environment Configuration (.env.yaml)
```yaml
NEO4J_URI: "neo4j+s://4441767a.databases.neo4j.io"
NEO4J_USER: "neo4j"
NEO4J_PASSWORD: "your-password-here"
GOOGLE_API_KEY: "your-google-api-key"
GOOGLE_GENAI_API_KEY: "your-google-api-key"
VERTEX_PROXY_URL: "https://bimei-chatbot-jilezw5qqq-ts.a.run.app"
GRAPH_QUERY_URL: "https://graphquery-jilezw5qqq-uc.a.run.app"
```

---

## Quick Start

### Prerequisites
- Google Cloud SDK installed and authenticated
- Node.js 20+ installed locally (for testing)
- Access to BIMei project on GCP (`bimei-ai`)

### Local Development
```bash
# Start a local server
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/B_Dashboard_UI.html
```

### Deploy Frontend
```bash
# Upload to GCS
gsutil cp B_Dashboard_UI.html gs://bimei-kb-dashboard/index.html

# Disable caching for immediate updates
gsutil setmeta -h "Cache-Control:no-cache, max-age=0" gs://bimei-kb-dashboard/index.html
```

### Deploy Backend
```bash
# Deploy Cloud Function
gcloud functions deploy dashboardApi \
  --gen2 \
  --runtime=nodejs20 \
  --region=australia-southeast1 \
  --source=. \
  --entry-point=dashboardApi \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URI="neo4j+s://4441767a.databases.neo4j.io",NEO4J_USER="neo4j",NEO4J_PASSWORD="your-password",GOOGLE_API_KEY="your-key"
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

---

## Development Guidelines

### Version Numbering
- Increment by 0.1 for each deployment with user-visible changes
- Current: v1.0.5
- Update version in `<span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">v1.0.X</span>`

### Making Changes
1. Edit `B_Dashboard_UI.html` locally
2. Test with local server
3. Update version number
4. Deploy to GCS
5. Test live dashboard
6. Commit changes to git

### CSS Conventions
- Use Tailwind utility classes where possible
- Custom styles in `<style>` section at top of file
- Module spacing: `pb-4` (1rem) via `.section-gap` class
- BIMei brand color: `#f37f73` (coral)

### Module Development
All modules extend `BaseModule` class and implement:
- `getModuleName()` - Returns module identifier
- `onQueryComplete(detail)` - Handles query results
- Auto-hide logic when no data available

---

## API Usage

### Request Format
```bash
curl -X POST https://dashboardapi-jilezw5qqq-ts.a.run.app \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is BIM?",
    "modules": ["text", "sources", "evidence", "path", "graph"]
  }'
```

### Response Format
```json
{
  "query": "What is BIM?",
  "sessionId": "dash_xxxxx",
  "results": {
    "text": {
      "content": "Building Information Modelling...",
      "mode": "expert",
      "source": "BIMei Knowledge Base"
    },
    "sources": {
      "links": [
        {
          "url": "https://...",
          "title": "Building Information Modelling",
          "type": "dictionary"
        }
      ]
    },
    "evidence": {
      "score": 0.85,
      "confidence": "High",
      "tier": "strong",
      "metrics": { "hops": 2, "normalised": 0.85, "raw": 3.2 }
    },
    "path": {
      "nodes": [...],
      "edges": [...],
      "hops": 2
    },
    "graph": {
      "answer": "BIM is...",
      "cypher": "MATCH (d:DictionaryItem {name: \"BIM\"})...",
      "visual": {
        "nodes": [...],
        "edges": [...]
      }
    }
  },
  "timestamp": "2026-01-13T03:42:59.484Z"
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Dashboard shows "No graph data available"
**Solution**: Check if Neo4j password is correct in Cloud Function environment variables

**Issue**: Text module works but other modules are empty
**Solution**: This is normal for definition queries - modules auto-hide when no data

**Issue**: CORS errors in browser console
**Solution**: Verify Cloud Function has proper CORS headers (already configured)

**Issue**: "The client is unauthorized" error
**Solution**: Update Neo4j password in Cloud Function environment variables

### Debug Mode
Open browser console (F12) to see module logs:
```javascript
// Each module logs its data
console.log('TextModule: Text data:', textData);
console.log('GraphModule: Graph data:', graphData);
```

### Testing Queries
- **Definition**: "What is BIM?" - Tests text and sources modules
- **Relationship**: "What is the relationship between BIM and COBie?" - Tests all modules
- **Complex**: "How does process maturity relate to adaptive capacity?" - Tests graph visualizations

---

## Performance

- **Page Load**: < 2 seconds
- **Query Response**: 10-15 seconds (depends on Neo4j query complexity)
- **API Timeout**: 60 seconds (Cloud Function limit)
- **Frontend Size**: ~56 KB (single HTML file)

---

## Security

- **Authentication**: Public dashboard (unauthenticated access)
- **CORS**: Configured for storage.googleapis.com origin
- **Credentials**: Stored in Cloud Function environment variables (not exposed)
- **HTTPS**: Required for all API calls
- **Rate Limiting**: None currently (consider implementing for production)

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari 14+, Chrome Mobile 90+)

---

## Change Log

### v1.0.5 (Current)
- Response pane full width (12 columns)
- Evidence pane full width (12 columns)
- Stripped [Dictionary], [Page], [PDF] prefixes from source titles
- Reduced module spacing to 1rem

### v1.0.4
- Strip "Evidence:" section from text responses
- Fix text overflow with word-wrap
- Auto-hide Evidence module when score = 0 or tier = minimal
- Auto-hide Interactive Graph when no edges

### v1.0.3
- Added 1.5rem padding to Interactive Graph module
- Removed Knowledge Path expand button
- Removed query details footer from text response

### v1.0.2
- Fixed Cypher copy button with proper event listener
- Added debugging logs for Knowledge Path and Graph modules

### v1.0.1
- Initial production deployment

---

## Contributing

For BIMei team members:

1. **Before Making Changes**
   - Pull latest code from repository
   - Test changes locally first
   - Document any breaking changes

2. **Making Changes**
   - Edit files locally
   - Test thoroughly
   - Update version number
   - Update this README if architecture changes

3. **Deployment**
   - Deploy backend first (if changed)
   - Deploy frontend second
   - Verify in production
   - Document deployment in git commit

---

## Support

**Dashboard URL**: https://storage.googleapis.com/bimei-kb-dashboard/index.html
**Issues**: Contact BIMei development team
**Documentation**: This README and [DEPLOYMENT.md](DEPLOYMENT.md)

---

## License

Proprietary - BIM Excellence Initiative © 2026
