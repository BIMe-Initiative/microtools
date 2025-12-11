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
    /* Tab Styling */
    .stTabs [data-baseweb="tab-list"] { gap: 10px; }
    .stTabs [data-baseweb="tab"] { height: 50px; white-space: pre-wrap; background-color: #f0f2f6; border-radius: 4px 4px 0 0; gap: 1px; padding-top: 10px; padding-bottom: 10px; }
    .stTabs [aria-selected="true"] { background-color: #ffffff; border-top: 2px solid #ed1f79;}
</style>
""", unsafe_allow_html=True)

st.title("💠 BIMei Knowledge Ecosystem")

@st.cache_data
def load_data():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge_graph.json")
    if os.path.exists(path):
        with open(path, "r") as f: return json.load(f)
    return None

data = load_data()
if not data: st.stop()

# Separate Nodes by Role
ontology_nodes = [n for n in data['nodes'] if n.get('type') != 'Source']
library_nodes = [n for n in data['nodes'] if n.get('type') == 'Source']
all_edges_raw = data['edges'] # Keep raw dicts separate

# --- TABS ---
tab1, tab2 = st.tabs(["🧬 Ontology Explorer", "📚 Knowledge Library"])

# === TAB 1: ONTOLOGY ===
with tab1:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Structure Explorer")
        
        # FIX: Handle None values safely
        raw_cats = [str(n.get('type', 'Unknown')) for n in ontology_nodes]
        cats = sorted(list(set(raw_cats)))
        
        sel_cats = st.multiselect("Show Categories:", cats, default=cats)
        
        ont_search = st.text_input("Find Concept:", placeholder="e.g. Asset Management")
        ont_spacing = st.slider("Spread", 100, 500, 250, key="s1")

    with col2:
        # Filter Logic
        disp_nodes = []
        valid_ids = set()
        
        # 1. Build Nodes
        for n in ontology_nodes:
            n_type = str(n.get('type', 'Unknown'))
            n_label = str(n.get('label', n['id']))
            
            if n_type in sel_cats and ont_search.lower() in n_label.lower():
                disp_nodes.append(Node(id=n['id'], label=n_label, 
                                     size=n.get('size', 20), shape=n.get('shape', 'dot'), 
                                     color=n.get('color', '#888'), 
                                     title=n.get('desc', '')))
                valid_ids.add(n['id'])
        
        # 2. Build Edges (The FIX: Convert dict to Edge object)
        disp_edges = []
        for e in all_edges_raw:
            if e['source'] in valid_ids and e['target'] in valid_ids:
                disp_edges.append(Edge(source=e['source'], target=e['target'], 
                                     label=e.get('label', ''), color="#d3d3d3"))
        
        config = Config(width=900, height=600, directed=True, physics=True, 
                        solver='forceAtlas2Based', forceAtlas2Based={"springLength": ont_spacing})
        agraph(nodes=disp_nodes, edges=disp_edges, config=config)

# === TAB 2: LIBRARY ===
with tab2:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Content Navigator")
        view_mode = st.radio("Focus Mode:", ["By Topic", "By Publication"])
        
        focus_id = None
        
        if view_mode == "By Publication":
            # List all library files
            opts = sorted([str(n['id']) for n in library_nodes])
            sel = st.selectbox("Select Publication:", ["All"] + opts)
            if sel != "All": focus_id = sel
            
        else: # By Topic
            # List all ontology concepts that have at least one connection
            opts = sorted([str(n.get('label', n['id'])) for n in ontology_nodes])
            sel = st.selectbox("Select Topic:", ["All"] + opts)
            if sel != "All": 
                found = next((n['id'] for n in ontology_nodes if n.get('label') == sel), None)
                focus_id = found

        lib_spacing = st.slider("Spread", 100, 500, 250, key="s2")

    with col2:
        lib_disp_nodes = []
        lib_valid_ids = set()
        lib_disp_edges = []
        
        if focus_id:
            # 1. Add the Focus Node
            root = next((n for n in data['nodes'] if n['id'] == focus_id), None)
            if root:
                lib_disp_nodes.append(Node(id=root['id'], label=str(root.get('label', root['id'])), 
                                         size=30, shape=root.get('shape', 'dot'), 
                                         color=root.get('color', '#888'), borderWidth=3))
                lib_valid_ids.add(root['id'])
                
                # 2. Find Neighbors (1st Degree) and Collect Relevant Edge Dicts
                neighbor_ids = set()
                relevant_edge_dicts = []
                
                for e in all_edges_raw:
                    if e['source'] == focus_id:
                        neighbor_ids.add(e['target'])
                        relevant_edge_dicts.append(e)
                    elif e['target'] == focus_id:
                        neighbor_ids.add(e['source'])
                        relevant_edge_dicts.append(e)
                
                # 3. Add Neighbor Nodes
                for n in data['nodes']:
                    if n['id'] in neighbor_ids:
                        lib_disp_nodes.append(Node(id=n['id'], label=str(n.get('label', n['id'])), 
                                                 size=n.get('size', 20), shape=n.get('shape', 'dot'), 
                                                 color=n.get('color', '#888')))
                        lib_valid_ids.add(n['id'])
                
                # 4. Convert Edge Dicts to Objects (The FIX)
                for e in relevant_edge_dicts:
                    lib_disp_edges.append(Edge(source=e['source'], target=e['target'], 
                                             label=e.get('label', ''), color="#ccc"))

        else:
            # Show All Mode (Filtered to just Library + immediate links)
            for n in library_nodes:
                lib_disp_nodes.append(Node(id=n['id'], label=str(n.get('label', n['id'])), 
                                         size=n.get('size', 20), shape=n.get('shape', 'dot'), 
                                         color=n.get('color', '#888')))
                lib_valid_ids.add(n['id'])
            
            # Find connections and add targets
            for e in all_edges_raw:
                if e['source'] in lib_valid_ids or e['target'] in lib_valid_ids:
                    # Add edge object
                    lib_disp_edges.append(Edge(source=e['source'], target=e['target'], color="#d3d3d3"))
                    
                    # Ensure both ends are visible
                    for target_id in [e['source'], e['target']]:
                        if target_id not in lib_valid_ids:
                            tgt = next((x for x in data['nodes'] if x['id'] == target_id), None)
                            if tgt:
                                lib_disp_nodes.append(Node(id=tgt['id'], label=str(tgt.get('label', tgt['id'])), 
                                                         size=tgt.get('size', 20), shape=tgt.get('shape', 'dot'), 
                                                         color=tgt.get('color', '#888')))
                                lib_valid_ids.add(tgt['id'])

        config = Config(width=900, height=600, directed=True, physics=True, 
                        solver='forceAtlas2Based', forceAtlas2Based={"springLength": lib_spacing})
        agraph(nodes=lib_disp_nodes, edges=lib_disp_edges, config=config)
