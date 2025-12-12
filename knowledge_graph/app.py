import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import os

st.set_page_config(layout="wide", page_title="BIMei Explorer")

# --- CSS ---
st.markdown("""
<style>
    .stAppHeader {display:none;}
    div[data-testid="stMarkdownContainer"] p {font-family: 'Helvetica Neue', sans-serif;}
</style>
""", unsafe_allow_html=True)

st.title("💠 BIMei Knowledge Ecosystem")

# --- DATA LOADER ---
@st.cache_data
def load_all_data():
    base = os.path.dirname(os.path.abspath(__file__))
    
    # Load Ontology
    onto_path = os.path.join(base, "ontology_graph.json")
    onto_data = {"nodes": [], "edges": []}
    if os.path.exists(onto_path):
        with open(onto_path, "r") as f: onto_data = json.load(f)
        
    # Load Library
    lib_path = os.path.join(base, "library_graph.json")
    lib_data = {"nodes": [], "edges": []}
    if os.path.exists(lib_path):
        with open(lib_path, "r") as f: lib_data = json.load(f)
        
    return onto_data, lib_data

onto_data, lib_data = load_all_data()

# Combine for lookup
all_nodes_dict = {}
for n in onto_data.get('nodes', []):
    if n.get('id'): all_nodes_dict[n['id']] = n
for n in lib_data.get('nodes', []):
    if n.get('id'): all_nodes_dict[n['id']] = n

# --- SESSION STATE FOR DIALOGS ---
if 'dialog_node_id' not in st.session_state:
    st.session_state['dialog_node_id'] = None

# --- POP-UP CARD LOGIC ---
@st.dialog("Concept Details")
def show_card():
    node_id = st.session_state['dialog_node_id']
    if not node_id: return

    node = all_nodes_dict.get(node_id)
    if not node: 
        st.error("Node data not found.")
        return

    # Header
    icon_map = {"Project": "🌟", "Topic": "💎", "Source": "📚", "Competency": "🔴", "ModelUse": "🟩"}
    icon = icon_map.get(node.get('type'), "🔹")
    
    c1, c2 = st.columns([1, 5])
    with c1: st.markdown(f"<h1>{icon}</h1>", unsafe_allow_html=True)
    with c2:
        st.subheader(node.get('label', node_id))
        st.caption(f"ID: {node.get('id')} | Type: {node.get('type')}")
    
    st.divider()
    st.write(node.get('desc', "No description provided."))
    
    # Simple "Close" check (Streamlit handles X automatically)

# --- HELPER: GET NEIGHBORS (Depth Logic) ---
def get_neighborhood(data_source, focus_id, depth=1):
    """Returns nodes and edges within 'depth' steps of focus_id"""
    active_ids = {focus_id}
    visited_edges = []
    
    # Iterate for 'depth' steps
    for _ in range(depth):
        next_step_ids = set()
        for e in data_source.get('edges', []):
            src = e.get('source')
            tgt = e.get('target')
            
            if src in active_ids or tgt in active_ids:
                if src and tgt:
                    # Add edge
                    if e not in visited_edges:
                        visited_edges.append(e)
                    # Add neighbors to next step
                    next_step_ids.add(src)
                    next_step_ids.add(tgt)
        
        active_ids.update(next_step_ids)
        
    # Return Node Objects and Edge Objects
    nodes_out = []
    for nid in active_ids:
        n = all_nodes_dict.get(nid)
        if n:
            is_focus = (nid == focus_id)
            nodes_out.append(Node(
                id=n['id'],
                label=str(n.get('label', n['id'])),
                size=30 if is_focus else 20,
                shape=n.get('shape', 'dot'),
                color=n.get('color', '#888'),
                borderWidth=3 if is_focus else 1
            ))
            
    edges_out = [Edge(source=e['source'], target=e['target'], color="#bfef45") for e in visited_edges]
    return nodes_out, edges_out


# --- TABS ---
tab1, tab2 = st.tabs(["🧬 Ontology Explorer", "📚 Knowledge Library"])

# === TAB 1: ONTOLOGY ===
with tab1:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Filters")
        
        # 1. Categories
        raw_cats = [str(n.get('type', 'Unknown')) for n in onto_data.get('nodes', [])]
        cats = sorted(list(set(raw_cats)))
        sel_cats = st.multiselect("Category", cats, default=cats)
        
        search = st.text_input("Search Ontology", "")
        
    with col2:
        # Build Ontology Graph
        disp_nodes = []
        valid_ids = set()
        
        for n in onto_data.get('nodes', []):
            n_type = str(n.get('type', 'Unknown'))
            n_label = str(n.get('label', n.get('id', '')))
            
            if n_type in sel_cats and search.lower() in n_label.lower():
                disp_nodes.append(Node(
                    id=n['id'], 
                    label=n_label, 
                    size=n.get('size', 20), 
                    shape=n.get('shape', 'dot'), 
                    color=n.get('color', '#888')
                ))
                valid_ids.add(n['id'])
        
        disp_edges = []
        for e in onto_data.get('edges', []):
            src = e.get('source')
            tgt = e.get('target')
            if src in valid_ids and tgt in valid_ids:
                disp_edges.append(Edge(source=src, target=tgt, color="#ddd"))

        config = Config(width=900, height=600, directed=True, physics=True, 
                        solver='forceAtlas2Based', forceAtlas2Based={"springLength": 200})
        
        clicked_ont = agraph(nodes=disp_nodes, edges=disp_edges, config=config)
        
        # Handle Click
        if clicked_ont:
            st.session_state['dialog_node_id'] = clicked_ont
            show_card()


# === TAB 2: LIBRARY ===
with tab2:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Navigator")
        mode = st.radio("Browse By:", ["Topic", "Publication"])
        
        selected_focus = None
        
        if mode == "Publication":
            # Create Mapping: Label -> ID
            pub_map = {n.get('label', n['id']): n['id'] for n in lib_data.get('nodes', []) if n.get('type') == 'Source'}
            sorted_names = sorted(pub_map.keys())
            
            sel_name = st.selectbox("Select Publication", ["None"] + sorted_names)
            if sel_name != "None":
                selected_focus = pub_map[sel_name]
            
        else: # By Topic
            # Find topics that actually have links
            linked_topics = set()
            for e in lib_data.get('edges', []):
                if e.get('target'): linked_topics.add(e['target'])
            
            # Create Mapping: Label -> ID for valid topics
            topic_map = {}
            for n in onto_data.get('nodes', []):
                if n['id'] in linked_topics:
                    topic_map[n.get('label', n['id'])] = n['id']
            
            sorted_topics = sorted(topic_map.keys())
            sel_topic = st.selectbox("Select Topic", ["None"] + sorted_topics)
            if sel_topic != "None":
                selected_focus = topic_map[sel_topic]
            
        # THE NEW SLIDER: DEPTH
        depth = st.slider("Connection Depth", 1, 3, 1, help("1=Direct Links, 2=Friends of Friends"))

    with col2:
        if selected_focus:
            # Use the Helper Function for Depth Logic
            l_nodes, l_edges = get_neighborhood(lib_data, selected_focus, depth=depth)
            
            config = Config(width=900, height=600, directed=True, physics=True, 
                            solver='forceAtlas2Based', forceAtlas2Based={"springLength": 250})
            
            clicked_lib = agraph(nodes=l_nodes, edges=l_edges, config=config)
            
            # Handle Click
            if clicked_lib:
                st.session_state['dialog_node_id'] = clicked_lib
                show_card()
            
        else:
            st.info("👈 Select a Publication or Topic to explore the connections.")
