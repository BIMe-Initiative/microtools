import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import urllib.parse

st.set_page_config(layout="wide", page_title="BIMei Graph Viewer")

# Hide Streamlit UI elements for API mode
st.markdown("""
<style>
    .stAppHeader {display:none;}
    .stToolbar {display:none;}
    .stDecoration {display:none;}
    .stStatusWidget {display:none;}
    
    /* Minimal styling for embedded mode */
    .main > div {
        padding-top: 0rem;
        padding-bottom: 0rem;
    }
    
    .graph-container {
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        padding: 10px;
    }
</style>
""", unsafe_allow_html=True)

def get_node_color(node_type):
    colors = {
        'Construct': '#3498db',
        'InformationUse': '#e74c3c', 
        'ActionStatement': '#2ecc71',
        'DictionaryItem': '#f39c12',
        'Content': '#9b59b6',
        'Deliverable': '#e67e22',
        'Resource': '#1abc9c'
    }
    return colors.get(node_type, '#95a5a6')

def parse_path_data():
    """Parse path data from URL parameters"""
    query_params = st.query_params
    
    st.write("Debug - Query params:", dict(query_params))
    
    if 'paths' in query_params:
        try:
            # Decode URL-encoded JSON
            paths_json = urllib.parse.unquote(query_params['paths'])
            st.write("Debug - Decoded JSON:", paths_json[:200] + "...")
            paths_data = json.loads(paths_json)
            st.write("Debug - Parsed data:", paths_data)
            return paths_data
        except Exception as e:
            st.error(f"Error parsing path data: {e}")
            return None
    
    return None

def create_graph_from_paths(paths_data):
    """Convert path data to graph nodes and edges"""
    if not paths_data or not isinstance(paths_data, list):
        return {'nodes': [], 'edges': []}
    
    # Take only the top path for visualization
    top_path = paths_data[0] if paths_data else None
    if not top_path:
        return {'nodes': [], 'edges': []}
    
    nodes_dict = {}
    edges = []
    
    # Extract nodes from path
    path_nodes = top_path.get('nodes', [])
    path_rels = top_path.get('rels', [])
    
    # Create nodes
    for i, node in enumerate(path_nodes):
        node_id = node.get('id', f"node_{i}")
        node_type = node.get('type', 'Unknown')
        node_label = node.get('label', f"Node {i}")
        
        nodes_dict[node_id] = {
            'id': node_id,
            'label': node_label[:30] + "..." if len(node_label) > 30 else node_label,
            'type': node_type,
            'color': get_node_color(node_type),
            'size': 25
        }
    
    # Create edges between consecutive nodes
    for i in range(len(path_nodes) - 1):
        source_id = path_nodes[i].get('id', f"node_{i}")
        target_id = path_nodes[i + 1].get('id', f"node_{i+1}")
        rel_type = path_rels[i] if i < len(path_rels) else 'CONNECTED_TO'
        
        edges.append({
            'source': source_id,
            'target': target_id,
            'label': rel_type,
            'type': rel_type
        })
    
    return {
        'nodes': list(nodes_dict.values()),
        'edges': edges
    }

# Main app logic
def main():
    # Check if we're in API mode (have path data)
    paths_data = parse_path_data()
    
    if paths_data:
        # API mode - show only the graph
        graph_data = create_graph_from_paths(paths_data)
        
        if graph_data['nodes']:
            # Create visualization nodes and edges
            vis_nodes = [
                Node(
                    id=node['id'],
                    label=node['label'],
                    size=node['size'],
                    color=node['color']
                ) for node in graph_data['nodes']
            ]
            
            vis_edges = [
                Edge(
                    source=edge['source'],
                    target=edge['target'],
                    label=edge['label']
                ) for edge in graph_data['edges']
            ]
            
            # Graph configuration for embedded mode
            config = Config(
                width=600,
                height=400,
                directed=True,
                physics=True,
                hierarchical=False,
                nodeHighlightBehavior=True,
                highlightColor="#f37f73",
                node={'font': {'size': 14}},
                edge={'font': {'size': 12}},
                interaction={'dragNodes': True, 'dragView': True, 'zoomView': True}
            )
            
            # Render the graph
            agraph(nodes=vis_nodes, edges=vis_edges, config=config)
            
            # Show path info
            st.caption(f"Showing top path: {len(graph_data['nodes'])} nodes, {len(graph_data['edges'])} relationships")
        else:
            st.info("No graph data to display")
    else:
        # Standalone mode - show instructions
        st.title("🔍 BIMei Graph Viewer API")
        st.info("This is the API endpoint for graph visualization. Pass path data via URL parameters.")
        st.code("?paths=" + urllib.parse.quote('{"paths":[{"nodes":[...],"rels":[...]}]}'))

if __name__ == "__main__":
    main()