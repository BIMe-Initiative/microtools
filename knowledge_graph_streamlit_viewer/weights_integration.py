# Add this to your app.py after the driver initialization

import json

# Load relationship weights
@st.cache_data
def load_relationship_weights():
    """Load relationship weights from JSON file"""
    try:
        # Option 1: If you download the file locally
        with open('weights-v1.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        # Option 2: Use Google Cloud Storage (requires: pip install google-cloud-storage)
        try:
            from google.cloud import storage
            client = storage.Client()
            bucket = client.bucket('bucket')
            blob = bucket.blob('path/weights-v1.json')
            weights_data = json.loads(blob.download_as_text())
            return weights_data
        except:
            # Fallback: default weights
            return {
                "IS_PART_OF": 1.0,
                "RELATES_TO": 0.8,
                "DEFINES": 0.9,
                "CONTAINS": 0.7
            }

# Update the shortestPath query to use weighted paths
def convert_natural_to_cypher_with_weights(natural_text):
    """Convert natural language to Cypher query with weighted relationships"""
    text = natural_text.lower()
    
    if "connection between" in text or "relationship between" in text:
        if "between" in text:
            after_between = text.split("between")[-1].strip()
            after_between = after_between.split(",")[0].strip()
            if " and " in after_between:
                term1, term2 = after_between.split(" and ", 1)
                term1 = term1.strip()
                term2 = term2.strip()
                
                # Use weighted shortest path
                return f"""
                MATCH (a), (b)
                WHERE (toLower(a.title) CONTAINS '{term1}' OR toLower(a.name) CONTAINS '{term1}') 
                AND (toLower(b.title) CONTAINS '{term2}' OR toLower(b.name) CONTAINS '{term2}')
                CALL apoc.algo.dijkstra(a, b, 'RELATES_TO|IS_PART_OF|DEFINES', 'weight') YIELD path
                RETURN path
                """
    
    # ... rest of your existing logic
    return "MATCH (n:Content)-[r]-(m) RETURN n, r, m"

# Update edge visualization to show weights
def create_weighted_edges(edges, weights):
    """Create edges with visual weight representation"""
    vis_edges = []
    for edge in edges:
        # Skip edges connected to chunk nodes
        source_node = next((n for n in st.session_state.current_data['nodes'] if n['id'] == edge['source']), None)
        target_node = next((n for n in st.session_state.current_data['nodes'] if n['id'] == edge['target']), None)
        
        if (source_node and 'Chunk' in source_node['labels']) or (target_node and 'Chunk' in target_node['labels']):
            continue
        
        # Get weight for this relationship type
        rel_type = edge['label']
        weight = weights.get(rel_type, 0.5)
        
        # Visual representation: higher weight = thicker line, darker color
        line_width = max(1, int(weight * 5))  # Scale weight to line width
        opacity = max(0.3, weight)  # Scale weight to opacity
        
        vis_edges.append(Edge(
            source=edge['source'],
            target=edge['target'],
            label=f"{edge['label']} ({weight:.1f})",  # Show weight in label
            width=line_width,
            color=f"rgba(100, 100, 100, {opacity})"
        ))
    
    return vis_edges