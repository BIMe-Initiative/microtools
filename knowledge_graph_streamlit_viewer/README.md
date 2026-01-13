# Knowledge Graph Streamlit Viewer

Interactive Streamlit application for visualizing and exploring Neo4j knowledge graphs with URL parameter support and color-coded node visualization.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: Python, Streamlit, Neo4j, streamlit-agraph
**Status**: Active

---

## Overview

This tool provides an interactive web interface for visualizing knowledge graph paths and relationships from a Neo4j database. It accepts graph data via URL parameters and renders interactive visualizations using the streamlit-agraph library.

### Key Features

- **URL Parameter Support**: Accept graph paths via URL query parameters
- **Color-Coded Nodes**: Different colors for each node type (Construct, InformationUse, ActionStatement, DictionaryItem, etc.)
- **Interactive Graph Visualization**: Pan, zoom, and explore graph relationships
- **Neo4j Integration**: Direct connection to Neo4j AuraDB or self-hosted instances
- **Streamlit Framework**: Fast, responsive web interface

---

## Use Cases

1. **Knowledge Graph Exploration**: Visualize relationships between BIM concepts
2. **Path Visualization**: Display query results as interactive graph paths
3. **Embedding**: Can be embedded in other applications via iframe
4. **API Integration**: Accepts JSON-encoded graph data from external services

---

## Files

```
knowledge_graph_streamlit_viewer/
├── app.py                 # Main Streamlit application
├── app_api.py            # API-based graph viewer variant
├── app_original.py       # Original implementation with direct Neo4j queries
├── test_neo4j.py         # Neo4j connection testing utility
├── neo4j_client.py       # Neo4j database client
├── migrate_to_neo4j.py   # Migration utility
├── weights_integration.py # SEW (Semantic Evidence Weight) integration
├── requirements.txt      # Python dependencies
├── requirements_api.txt  # API variant dependencies
├── .env.example          # Environment variable template
└── README.md             # This file
```

---

## Quick Start

### Prerequisites

- **Python 3.8+** installed
- **Neo4j Database** (AuraDB or self-hosted)
- **Neo4j credentials** (URI, username, password)

### Installation

1. **Navigate to the directory**
   ```bash
   cd knowledge_graph_streamlit_viewer
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Neo4j credentials:
   ```env
   NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=your-neo4j-password-here
   ```

4. **Test Neo4j connection**
   ```bash
   python test_neo4j.py
   ```

5. **Run the Streamlit app**
   ```bash
   streamlit run app.py
   ```

6. **Open in browser**
   ```
   http://localhost:8501
   ```

---

## Usage

### URL Parameter Format

The app accepts graph data via the `paths` URL parameter:

```
http://localhost:8501/?paths=[ENCODED_JSON]
```

Where `[ENCODED_JSON]` is a URL-encoded JSON array containing graph path data.

### Example URL

```
http://localhost:8501/?paths=%5B%7B%22nodes%22%3A%5B%7B%22id%22%3A%22n1%22%2C%22label%22%3A%22BIM%22%2C%22type%22%3A%22DictionaryItem%22%7D%2C%7B%22id%22%3A%22n2%22%2C%22label%22%3A%22COBie%22%2C%22type%22%3A%22DictionaryItem%22%7D%5D%2C%22rels%22%3A%5B%7B%22type%22%3A%22RELATES_TO%22%7D%5D%7D%5D
```

### JSON Structure

```json
[
  {
    "nodes": [
      {
        "id": "node_1",
        "label": "Building Information Modelling",
        "type": "DictionaryItem"
      },
      {
        "id": "node_2",
        "label": "COBie",
        "type": "DictionaryItem"
      }
    ],
    "rels": [
      {
        "type": "RELATES_TO",
        "properties": {}
      }
    ]
  }
]
```

---

## Node Types & Colors

The viewer uses color-coding for different node types:

| Node Type | Color | Hex Code |
|-----------|-------|----------|
| Construct | Blue | #3498db |
| InformationUse | Red | #e74c3c |
| ActionStatement | Green | #2ecc71 |
| DictionaryItem | Orange | #f39c12 |
| Content | Purple | #9b59b6 |
| Deliverable | Dark Orange | #e67e22 |
| Resource | Teal | #1abc9c |
| Default | Gray | #95a5a6 |

---

## Application Variants

### 1. app.py (URL Parameter Viewer)
- Accepts graph data via URL parameters
- Best for embedding in other applications
- No direct database queries
- Lightweight and fast

### 2. app_api.py (API Integration)
- Similar to app.py with API enhancements
- Designed for REST API integration
- JSON-based data exchange

### 3. app_original.py (Direct Neo4j Queries)
- Full Neo4j integration with query capabilities
- Browse entire knowledge graph
- More heavyweight, requires database access
- Search and filter functionality

### 4. test_neo4j.py (Connection Testing)
- Verify Neo4j credentials
- Test database connectivity
- Debug connection issues

---

## Configuration

### Environment Variables

Create a `.env` file with:

```env
NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password-here
```

The application uses `os.getenv()` to read these values securely.

### Streamlit Configuration

Optional: Create `.streamlit/config.toml` for custom settings:

```toml
[server]
port = 8501
headless = true

[theme]
primaryColor = "#f37f73"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#262730"
font = "sans serif"
```

---

## Deployment

### Local Development
```bash
streamlit run app.py
```

### Streamlit Cloud
1. Push code to GitHub repository
2. Connect Streamlit Cloud to your repo
3. Add environment variables in Streamlit Cloud dashboard
4. Deploy

### Docker
```dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

Build and run:
```bash
docker build -t streamlit-graph-viewer .
docker run -p 8501:8501 --env-file .env streamlit-graph-viewer
```

### Google Cloud Run
```bash
gcloud run deploy streamlit-graph-viewer \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URI="neo4j+s://your-instance.databases.neo4j.io",NEO4J_USER="neo4j",NEO4J_PASSWORD="your-password"
```

---

## Integration Examples

### Embedding in HTML

```html
<iframe
  src="http://localhost:8501/?paths=%5B...%5D"
  width="100%"
  height="600px"
  frameborder="0">
</iframe>
```

### Python URL Generation

```python
import json
import urllib.parse

graph_data = [{
    "nodes": [
        {"id": "n1", "label": "BIM", "type": "DictionaryItem"},
        {"id": "n2", "label": "COBie", "type": "DictionaryItem"}
    ],
    "rels": [
        {"type": "RELATES_TO"}
    ]
}]

encoded = urllib.parse.quote(json.dumps(graph_data))
url = f"http://localhost:8501/?paths={encoded}"
print(url)
```

### JavaScript URL Generation

```javascript
const graphData = [{
  nodes: [
    {id: "n1", label: "BIM", type: "DictionaryItem"},
    {id: "n2", label: "COBie", type: "DictionaryItem"}
  ],
  rels: [{type: "RELATES_TO"}]
}];

const encoded = encodeURIComponent(JSON.stringify(graphData));
const url = `http://localhost:8501/?paths=${encoded}`;
```

---

## Troubleshooting

### Issue: "Connection to Neo4j failed"
**Solution**:
- Verify NEO4J_URI is correct (include `neo4j+s://` for AuraDB)
- Check NEO4J_PASSWORD is accurate
- Ensure database is running and accessible
- Test with `python test_neo4j.py`

### Issue: "No graph data available"
**Solution**:
- Check URL parameter is properly encoded
- Verify JSON structure matches expected format
- Use browser console to inspect query parameters

### Issue: Graph not rendering
**Solution**:
- Ensure nodes array has at least 2 nodes
- Verify each node has `id`, `label`, and `type` fields
- Check browser console for JavaScript errors

### Issue: Streamlit app won't start
**Solution**:
- Verify Python version (3.8+)
- Reinstall dependencies: `pip install -r requirements.txt`
- Check port 8501 is not in use
- Try different port: `streamlit run app.py --server.port=8502`

---

## Development

### Testing Changes Locally

1. Edit `app.py` or other Python files
2. Streamlit auto-reloads on file save
3. Refresh browser to see changes

### Adding New Node Types

Edit the `get_node_color()` function in `app.py`:

```python
def get_node_color(node_type):
    colors = {
        'Construct': '#3498db',
        'YourNewType': '#yourcolor',  # Add here
        # ... existing types
    }
    return colors.get(node_type, '#95a5a6')
```

---

## Dependencies

```
streamlit>=1.28.0
streamlit-agraph>=0.0.45
neo4j>=5.0.0           # For app_original.py
python-dotenv>=1.0.0   # For environment variables
```

---

## Performance

- **Load Time**: < 1 second for simple graphs (< 10 nodes)
- **Graph Rendering**: Instant for < 50 nodes, may slow with > 100 nodes
- **Memory Usage**: Lightweight (< 100MB for typical use)

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Related Tools

- [bimei-kb-dashboard](../bimei-kb-dashboard/) - Comprehensive knowledge base dashboard
- [vertex-graph-builder](../vertex-graph-builder/) - Tool for building the knowledge graph
- [neodash-viewer](../neodash-viewer/) - Alternative Neo4j visualization

---

## Support

**Issues**: Create an issue in the GitHub repository
**Documentation**: This README
**Neo4j Help**: [Neo4j Documentation](https://neo4j.com/docs/)
**Streamlit Help**: [Streamlit Documentation](https://docs.streamlit.io/)

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.
