import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import os

# --- PAGE CONFIG ---
st.set_page_config(layout="wide", page_title="BIMe Knowledge Base")
st.title("💠 BIMe Interactive Knowledge Base")

# --- CUSTOM CSS ---
st.markdown("""
<style>
    .stAppHeader {display:none;}
    div[data-testid="stMarkdownContainer"] p {font-family: 'Helvetica Neue', sans-serif;}
</style>
""", unsafe_allow_html=True)

# --- 1. LOAD DATA ---
@st.cache_data
def load_graph_data():
    """Loads the pre-built JSON file."""
    if os.path.exists("knowledge_graph.json"):
        with open("knowledge_graph.json", "r") as f:
            return json.load(f)
    return None

master_data = load_graph_data()

# --- 2. STATE MANAGEMENT ---
if 'selected_node' not in st.session_state:
    st.session_state['selected_node'] = None

# --- 3. SIDEBAR CONTROLS ---
with st.sidebar:
    st.header("🎛️ Knowledge Filters")
    
    if not master_data:
        st.error("No 'knowledge_graph.json' found!")
        st.stop()
        
    # Stats
    total_nodes = len(master_data.get('nodes', []))
    st.caption(f"Loaded {total_nodes} Concepts from Knowledge Base")
    
    st.divider()
    
    # FILTER: By Type
    # Extract all unique types found in the data
    all_types = sorted(list(set([n.get('type', 'Unknown') for n in master_data['nodes']])))
    
    selected_types = st.multiselect(
        "Filter by Category:",
        all_types,
        default=all_types # Select all by default
    )
    
    st.divider()
    
    # PHYSICS: Spacing
    spacing = st.slider("Node Spacing", 100, 600, 300)
    
    # SEARCH
    search_query = st.text_input("🔍 Search for a concept:")

# --- 4. DATA FILTERING LOGIC ---
display_nodes = []
display_edges = []
valid_ids = set()

# A. Filter Nodes based on Sidebar selection
for n in master_data['nodes']:
    node_type = n.get('type', 'Unknown')
    
    # Search Logic
    is_search_match = True
    if search_query:
        is_search_match = search_query.lower() in n.get('label', '').lower()
    
    if node_type in selected_types and is_search_match:
        # Create Node Object
        display_nodes.append(Node(
            id=n['id'],
            label=n.get('label', n['id']),
            size=n.get('size', 20),
            shape=n.get('shape', 'dot'),
            color=n.get('color', '#888'),
            title=n.get('desc', 'No definition'), # Tooltip
            borderWidth=1,
            borderWidthSelected=3
        ))
        valid_ids.add(n['id'])

# B. Filter Edges (Only show if both ends exist)
for e in master_data['edges']:
    if e['source'] in valid_ids and e['target'] in valid_ids:
        display_edges.append(Edge(
            source=e['source'],
            target=e['target'],
            label=e.get('label', ''),
            color="#d3d3d3"
        ))

# --- 5. ELEGANT DIALOG (POP-UP) ---
@st.dialog("Concept Details")
def show_details(node_id):
    # Find node data
    node_info = next((item for item in master_data['nodes'] if item["id"] == node_id), None)
    
    if node_info:
        # Header
        c1, c2 = st.columns([1, 5])
        with c1:
            # Simple icon mapping
            icon = "📄"
            if node_info.get('type') == 'Project': icon = "🌟"
            elif node_info.get('type') == 'ModelUse': icon = "🟩"
            elif node_info.get('type') == 'Competency': icon = "🔴"
            st.markdown(f"<h1>{icon}</h1>", unsafe_allow_html=True)
            
        with c2:
            st.subheader(node_info.get('label', node_id))
            st.caption(f"Category: {node_info.get('type', 'General')}")
            
        st.markdown("---")
        st.info(node_info.get('desc', "No detailed definition available in the source documents."))
        
        if node_info.get('source'):
            st.caption(f"📚 Source: {node_info.get('source')}")

# --- 6. RENDER GRAPH ---
config = Config(
    width=1200, height=800, 
    directed=True, physics=True, hierarchy=False,
    nodeHighlightBehavior=True, highlightColor="#ed1f79", collapsible=False,
    solver='forceAtlas2Based',
    forceAtlas2Based={
        "gravitationalConstant": -100, "centralGravity": 0.005,
        "springLength": spacing, "springConstant": 0.05, "damping": 0.4
    }
)

clicked_id = agraph(nodes=display_nodes, edges=display_edges, config=config)

if clicked_id:
    show_details(clicked_id)
