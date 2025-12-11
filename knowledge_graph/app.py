import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import json
import os

st.set_page_config(layout="wide", page_title="BIMei KB")

# --- CUSTOM CSS ---
st.markdown("""
<style>
    .stAppHeader {display:none;}
    div[data-testid="stMarkdownContainer"] p {font-family: 'Helvetica Neue', sans-serif;}
</style>
""", unsafe_allow_html=True)

st.title("💠 BIMei Knowledge Base")

@st.cache_data
def load_graph_data():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, "knowledge_graph.json")
    if os.path.exists(json_path):
        with open(json_path, "r") as f: return json.load(f)
    return None

master_data = load_graph_data()

# --- SIDEBAR ---
with st.sidebar:
    st.header("🎛️ Filters")
    if not master_data: st.stop()
    
    # Filter by the Short Type (stored in 'type')
    all_types = sorted(list(set([n.get('type', 'Unknown') for n in master_data['nodes']])))
    selected_types = st.multiselect("Category:", all_types, default=all_types)
    spacing = st.slider("Spacing", 100, 600, 300)
    search_query = st.text_input("Search:")

# --- PROCESSING ---
display_nodes = []
display_edges = []
valid_ids = set()

for n in master_data['nodes']:
    display_label = n.get('label', n['id'])
    
    if search_query.lower() in display_label.lower() and n.get('type') in selected_types:
        display_nodes.append(Node(
            id=n['id'],
            label=display_label,
            size=n.get('size', 20),
            shape=n.get('shape', 'dot'),
            color=n.get('color', '#888'),
            title=n.get('desc', 'No definition'),
            borderWidth=1
        ))
        valid_ids.add(n['id'])

for e in master_data['edges']:
    if e['source'] in valid_ids and e['target'] in valid_ids:
        display_edges.append(Edge(source=e['source'], target=e['target'], color="#d3d3d3"))

# --- POP-UP DIALOG ---
@st.dialog("Concept Details")
def show_details(node_id):
    node = next((i for i in master_data['nodes'] if i["id"] == node_id), None)
    if node:
        # Icon Mapping
        icon_map = {
            "Topic": "💎", "Project": "🌟", "Hierarchy": "🔺", 
            "Tool": "🛠️", "Website": "💻", "Publication": "📄", 
            "Contributor": "👤", "Supporter": "❤️", "Source": "📚",
            "ModelUse": "🟩", "Competency": "🔴"
        }
        icon = icon_map.get(node.get('type'), "🔹")
        
        c1, c2 = st.columns([1, 5])
        with c1: st.markdown(f"<h1>{icon}</h1>", unsafe_allow_html=True)
        with c2:
            st.subheader(node.get('label', node_id))
            # CHANGED: "UID" -> "Code"
            if node.get('code'):
                st.caption(f"**Code:** {node.get('code')} | **Category:** {node.get('category_full', node.get('type'))}")
            else:
                st.caption(f"**Category:** {node.get('category_full', node.get('type'))}")

        st.markdown("---")
        st.write("**Description:**")
        st.info(node.get('desc', "Not provided"))
        
        if node.get('parent'):
            st.write(f"**Parent Concept:** {node.get('parent')}")

config = Config(width=1200, height=800, directed=True, physics=True, 
                solver='forceAtlas2Based', forceAtlas2Based={"springLength": spacing})

clicked_id = agraph(nodes=display_nodes, edges=display_edges, config=config)
if clicked_id: show_details(clicked_id)
