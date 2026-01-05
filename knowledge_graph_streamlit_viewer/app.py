import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import urllib.parse

st.set_page_config(layout="wide", page_title="BIMei Graph Viewer")

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

# Get URL parameters
query_params = st.query_params

st.write("URL Parameters:", dict(query_params))

if 'paths' in query_params:
    try:
        # Decode the paths parameter
        paths_encoded = query_params['paths']
        st.write("Encoded paths:", paths_encoded[:100] + "...")
        
        paths_decoded = urllib.parse.unquote(paths_encoded)
        st.write("Decoded paths:", paths_decoded[:200] + "...")
        
        paths_data = json.loads(paths_decoded)
        st.write("Parsed data:", paths_data)
        
        # Extract first path
        if paths_data and len(paths_data) > 0:
            path = paths_data[0]
            nodes = path.get('nodes', [])
            rels = path.get('rels', [])
            
            if len(nodes) >= 2:
                # Create graph
                vis_nodes = []
                vis_edges = []
                
                for i, node in enumerate(nodes):
                    vis_nodes.append(Node(
                        id=node.get('id', f'node_{i}'),
                        label=node.get('label', f'Node {i}'),
                        size=25,
                        color=get_node_color(node.get('type', 'Unknown'))
                    ))
                
                for i in range(len(nodes) - 1):
                    vis_edges.append(Edge(
                        source=nodes[i].get('id', f'node_{i}'),
                        target=nodes[i+1].get('id', f'node_{i+1}'),
                        label=rels[i] if i < len(rels) else 'CONNECTED'
                    ))
                
                config = Config(
                    width=600,
                    height=400,
                    directed=True,
                    physics=True,
                    nodeHighlightBehavior=True,
                    highlightColor="#f37f73"
                )
                
                agraph(nodes=vis_nodes, edges=vis_edges, config=config)
                st.success(f"Graph with {len(nodes)} nodes displayed!")
            else:
                st.warning("Not enough nodes to create graph")
        else:
            st.warning("No path data found")
            
    except Exception as e:
        st.error(f"Error: {e}")
        st.write("Raw query params:", query_params)
else:
    st.title("🔍 BIMei Graph Viewer")
    st.info("Add ?paths=... to URL to display graph")
    st.write("Current URL params:", dict(query_params))