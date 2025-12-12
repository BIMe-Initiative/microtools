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
    onto_path = os.path.join(base, "ontology_graph.json")
    lib_path = os.path.join(base, "library_graph.json")
    
    onto_data = {"nodes": [], "edges": []}
    if os.path.exists(onto_path):
        with open(onto_path, "r") as f: onto_data = json.load(f)
        
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

# --- HELPER: EDGE STYLING ---
def get_edge_style(label):
    label = str(label).upper()
    if "DEFINES" in label: return "#ed1f79" 
    if "INCLUDES" in label: return "#4363d8" 
    if "EXTENDS" in label: return "#f58231" 
    return "#cccccc" 

# --- POP-UP (DIALOG) ---
@st.dialog("Details")
def show_card(node_id):
    node = all_nodes_dict.get(node_id)
    if not node: 
        st.error("Data not found")
        return

    icon_map = {"Project": "🌟", "Topic": "💎", "Source": "📚", "Competency": "🔴", "ModelUse": "🟩"}
    icon = icon_map.get(node.get('type'), "🔹")
    
    c1, c2 = st.columns([1, 5])
    with c1: st.markdown(f"<h1>{icon}</h1>", unsafe_allow_html=True)
    with c2:
        st.subheader(node.get('label', node_id))
        st.caption(f"ID: {node.get('id')} | Type: {node.get('type')}")
    
    st.divider()
    st.write(node.get('desc', "No description provided."))

# Initialize Session State for Click Tracking
if 'last_clicked' not in st.session_state:
    st.session_state['last_clicked'] = None

# --- UI ---
tab1, tab2 = st.tabs(["🧬 Ontology Explorer", "📚 Knowledge Library"])

# === TAB 1: STRUCTURE ===
with tab1:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Structure")
        cats = sorted(list(set([str(n.get('type')) for n in onto_data.get('nodes', [])])))
        sel_cats = st.multiselect("Category", cats, default=cats)
        search = st.text_input("Search", "")
        spacing = st.slider("Node Spacing", 100, 500, 250, key="s1")

    with col2:
        disp_nodes = []
        valid_ids = set()
        for n in onto_data.get('nodes', []):
            if str(n.get('type')) in sel_cats and search.lower() in str(n.get('label', '')).lower():
                disp_nodes.append(Node(id=n['id'], label=n.get('label', n['id']), 
                                     size=n.get('size', 20), shape=n.get('shape', 'dot'), 
                                     color=n.get('color', '#888')))
                valid_ids.add(n['id'])
        
        disp_edges = []
        for e in onto_data.get('edges', []):
            if e.get('source') in valid_ids and e.get('target') in valid_ids:
                color = get_edge_style(e.get('label', ''))
                disp_edges.append(Edge(source=e['source'], target=e['target'], 
                                     label=e.get('label'), color=color))

        config = Config(width=900, height=600, directed=True, physics=True, 
                        solver='forceAtlas2Based', forceAtlas2Based={"springLength": spacing})
        
        clicked_ont = agraph(nodes=disp_nodes, edges=disp_edges, config=config)
        
        # CRASH FIX: Only open if the ID CHANGED
        if clicked_ont and clicked_ont != st.session_state['last_clicked']:
            st.session_state['last_clicked'] = clicked_ont
            show_card(clicked_ont)

# === TAB 2: LIBRARY ===
with tab2:
    col1, col2 = st.columns([1, 3])
    with col1:
        st.subheader("Navigator")
        
        use_case = st.selectbox("I want to see:", 
                                ["Everything", "Origins (Where concepts are Defined)", "Coverage (What discusses what)"])
        
        mode = st.radio("Focus:", ["Topic", "Publication"])
        
        selected_focus = None
        if mode == "Publication":
            pubs = sorted([str(n['id']) for n in lib_data.get('nodes', [])])
            sel = st.selectbox("Select File", ["None"] + pubs)
            if sel != "None": selected_focus = sel
        else:
            linked = set([e['target'] for e in lib_data.get('edges', []) if e.get('target')])
            topics = [n for n in onto_data.get('nodes', []) if n['id'] in linked]
            # MAP LABEL TO ID FOR DROPDOWN
            topic_map = {n.get('label', n['id']): n['id'] for n in topics}
            sel = st.selectbox("Select Topic", ["None"] + sorted(topic_map.keys()))
            if sel != "None": selected_focus = topic_map[sel]
            
        # RESTORED SLIDER
        l_spacing = st.slider("Node Spacing", 100, 500, 250, key="s2")

    with col2:
        if selected_focus:
            l_nodes = []
            l_edges = []
            ids_to_show = {selected_focus}
            
            for e in lib_data.get('edges', []):
                label = str(e.get('label', '')).upper()
                
                if use_case == "Origins (Where concepts are Defined)" and "DEFINES" not in label: continue
                if use_case == "Coverage (What discusses what)" and "DISCUSSES" not in label: continue
                
                src = e.get('source')
                tgt = e.get('target')
                
                if src == selected_focus or tgt == selected_focus:
                    if src and tgt:
                        ids_to_show.add(src)
                        ids_to_show.add(tgt)
                        edge_color = get_edge_style(label)
                        l_edges.append(Edge(source=src, target=tgt, label=label, color=edge_color))

            for nid in ids_to_show:
                n = all_nodes_dict.get(nid)
                if n:
                    size = 30 if nid == selected_focus else 20
                    l_nodes.append(Node(id=n['id'], label=n.get('label', n['id']), 
                                      size=size, shape=n.get('shape', 'dot'), 
                                      color=n.get('color', '#888')))
            
            config = Config(width=900, height=600, directed=True, physics=True, 
                            solver='forceAtlas2Based', forceAtlas2Based={"springLength": l_spacing})
            
            clicked_lib = agraph(nodes=l_nodes, edges=l_edges, config=config)
            
            # CRASH FIX: Only open if the ID CHANGED
            if clicked_lib and clicked_lib != st.session_state['last_clicked']:
                st.session_state['last_clicked'] = clicked_lib
                show_card(clicked_lib)
        else:
            st.info("👈 Select a Focus to see the network.")
            st.markdown("""
            **Legend:**
            - <span style='color:#ed1f79'><b>Red Line</b></span>: DEFINES (Origin)
            - <span style='color:#4363d8'><b>Blue Line</b></span>: INCLUDES (Structure)
            - <span style='color:#cccccc'><b>Grey Line</b></span>: DISCUSSES (Coverage)
            """, unsafe_allow_html=True)
