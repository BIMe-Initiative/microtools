import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import os

st.set_page_config(layout="wide", page_title="BIMei Explorer")

# --- CSS (Restoring Cards & Clean UI) ---
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

# Combine for lookup purposes
all_nodes_dict = {n['id']: n for n in onto_data['nodes']}
all_nodes_dict.update({n['id']: n for n in lib_data['nodes']})

# --- POP-UP CARD LOGIC ---
@st.dialog("Details")
def show_card(node_id):
    node = all_nodes_dict.get(node_id)
    if not node: return

    # Header
    icon_map = {"Project": "🌟", "Topic": "💎", "Source": "📚", "Competency": "🔴", "ModelUse": "🟩"}
    icon = icon_map.get(node.get('type'), "🔹")
    
    c1, c2 = st.columns([1, 5])
    with c1: st.markdown(f"<h1>{icon}</h1>", unsafe_allow_html=True)
    with c2:
        st.subheader(node.get('label', node_id))
        st.caption(f"ID: {node['id']} | Type: {node.get('type')}")
    
    st.divider()
    st.write(node.get('desc', "No description provided."))

# --- TABS ---
tab1, tab2 = st.tabs(["🧬 Ontology Explorer", "📚 Knowledge Library"])

# === TAB 1: ONTOLOGY ===
with tab1:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Filters")
        # Extract Categories
        cats = sorted(list(set([n.get('type', 'Unknown') for n in onto_data['nodes']])))
        sel_cats = st.multiselect("Category", cats, default=cats)
        search = st.text_input("Search Ontology", "")
        spacing = st.slider("Spacing", 100, 500, 300, key="s1")

    with col2:
        # Build Graph
        disp_nodes = []
        valid_ids = set()
        
        for n in onto_data['nodes']:
            if n.get('type') in sel_cats and search.lower() in n.get('label', '').lower():
                disp_nodes.append(Node(id=n['id'], label=n.get('label', n['id']), 
                                     size=n.get('size', 20), shape=n.get('shape', 'dot'), 
                                     color=n.get('color', '#888')))
                valid_ids.add(n['id'])
        
        disp_edges = []
        for e in onto_data['edges']:
            if e['source'] in valid_ids and e['target'] in valid_ids:
                disp_edges.append(Edge(source=e['source'], target=e['target'], color="#ddd"))

        config = Config(width=900, height=600, directed=True, physics=True, 
                        solver='forceAtlas2Based', forceAtlas2Based={"springLength": spacing})
        
        clicked = agraph(nodes=disp_nodes, edges=disp_edges, config=config)
        if clicked: show_card(clicked)

# === TAB 2: LIBRARY ===
with tab2:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Navigator")
        mode = st.radio("Browse By:", ["Topic", "Publication"])
        
        selected_focus = None
        
        if mode == "Publication":
            pubs = sorted([n['id'] for n in lib_data['nodes']])
            sel = st.selectbox("Select Publication", ["None"] + pubs)
            if sel != "None": selected_focus = sel
            
        else: # By Topic
            # Find topics that actually have links
            linked_topics = set([e['target'] for e in lib_data['edges']])
            # Filter ontology nodes that are in that set
            valid_topics = [n['id'] for n in onto_data['nodes'] if n['id'] in linked_topics]
            sel = st.selectbox("Select Topic", ["None"] + sorted(valid_topics))
            if sel != "None": selected_focus = sel
            
        l_spacing = st.slider("Spacing", 100, 500, 300, key="s2")

    with col2:
        if selected_focus:
            l_nodes = []
            l_edges = []
            ids_to_show = set()
            ids_to_show.add(selected_focus)
            
            # Find Neighbors in Library Data
            # (Library Edges are Source -> Topic)
            for e in lib_data['edges']:
                if e['source'] == selected_focus or e['target'] == selected_focus:
                    ids_to_show.add(e['source'])
                    ids_to_show.add(e['target'])
                    l_edges.append(Edge(source=e['source'], target=e['target'], color="#bfef45"))
            
            # Retrieve Node Data
            for nid in ids_to_show:
                n = all_nodes_dict.get(nid)
                if n:
                    # Highlight the focus node
                    size = 30 if nid == selected_focus else n.get('size', 20)
                    l_nodes.append(Node(id=n['id'], label=n.get('label', n['id']), 
                                      size=size, shape=n.get('shape', 'dot'), 
                                      color=n.get('color', '#888')))
            
            config = Config(width=900, height=600, directed=True, physics=True, 
                            solver='forceAtlas2Based', forceAtlas2Based={"springLength": l_spacing})
            
            clicked_lib = agraph(nodes=l_nodes, edges=l_edges, config=config)
            if clicked_lib: show_card(clicked_lib)
            
        else:
            st.info("👈 Select a Publication or Topic to explore the connections.")
