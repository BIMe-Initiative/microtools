import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# --- PAGE CONFIG ---
st.set_page_config(layout="wide", page_title="BIMe Knowledge Base")
st.title("💠 BIMe Interactive Knowledge Graph")

# --- 1. SETUP & STATE MANAGEMENT ---
# We initialize state variables to persist data across re-runs (clicks)
if 'graph_data' not in st.session_state:
    st.session_state['graph_data'] = None
if 'lookup_map' not in st.session_state:
    st.session_state['lookup_map'] = {}
if 'selected_node_id' not in st.session_state:
    st.session_state['selected_node_id'] = None

try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key missing. Please check Streamlit Secrets.")

# --- 2. SIDEBAR (The Control Center) ---
with st.sidebar:
    st.header("🎛️ Graph Controls")
    
    uploaded_files = st.file_uploader("Upload Sources (PDF):", type=["pdf"], accept_multiple_files=True)
    
    st.divider()
    
    # --- FORM START ---
    # This prevents the app from running until you click "Update Graph"
    with st.form("graph_settings_form"):
        st.subheader("Complexity Settings")
        # Slider 1: Parent Concepts
        max_concepts = st.slider("Key Concepts (Parents)", 5, 30, 15)
        # Slider 2: Children
        child_density = st.slider("Detail Level (Children)", 1, 5, 3)
        
        st.subheader("Visual Layout")
        # Slider 3: Spacing
        spacing = st.slider("Node Spacing", 100, 600, 300)
        
        # The Trigger Button
        submitted = st.form_submit_button("Generate / Update Graph", type="primary")
    # --- FORM END ---

    if st.button("Clear Data"):
        st.session_state['graph_data'] = None
        st.session_state['lookup_map'] = {}
        st.session_state['selected_node_id'] = None
        st.rerun()

    # --- DESCRIPTION PANEL ---
    st.divider()
    st.subheader("📖 Concept Details")
    
    details_area = st.empty()
    
    # Instant Lookup (No AI call here)
    if st.session_state['selected_node_id']:
        node_id = st.session_state['selected_node_id']
        info = st.session_state['lookup_map'].get(node_id, {})
        
        with details_area.container():
            st.markdown(f"### {info.get('label', node_id)}")
            st.caption(f"Type: {info.get('type', 'General')}")
            st.info(info.get('desc', 'No definition available.'))
    else:
        details_area.info("Click a node in the graph to see its definition here.")


# --- 3. THE AI GENERATION ENGINE (Only runs if Form Submitted) ---
if submitted and uploaded_files:
    full_text = ""
    with st.spinner("Reading documents..."):
        for pdf in uploaded_files:
            try:
                reader = PdfReader(pdf)
                for page in reader.pages:
                    full_text += page.extract_text() + "\n"
            except: pass

    if full_text:
        with st.spinner("Gemini is restructuring the Knowledge Graph..."):
            try:
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                prompt = f"""
                Act as a Data Architect. Extract a Knowledge Graph.
                
                STRUCTURE RULES:
                1. Identify exactly {max_concepts} "Parent" concepts (Major topics).
                2. For each Parent, identify {child_density} "Child" concepts.
                
                ONTOLOGY TYPES: "Concept", "Standard", "Role", "Process", "Tool", "Organization".
                
                OUTPUT JSON:
                {{
                  "nodes": [ {{"id": "Name", "label": "Short Label", "type": "Concept", "desc": "Short definition"}} ],
                  "edges": [ {{"source": "Name", "target": "Name", "label": "verb"}} ]
                }}
                
                Text sample: {full_text[:90000]}
                """
                
                response = model.generate_content(prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                nodes = []
                edges = []
                lookup = {}
                existing = set()
                
                # Colors: #8dc63f (Green), #5ec6c8 (Teal), #dfc024 (Yellow), #ed1f79 (Pink)
                color_map = {
                    "Concept": "#8dc63f", "Standard": "#5ec6c8", 
                    "Process": "#dfc024", "Role": "#ed1f79", 
                    "Tool": "#5ec6c8", "Organization": "#dfc024"
                }

                for n in data.get('nodes', []):
                    if n['id'] not in existing:
                        node_color = color_map.get(n.get('type'), "#8dc63f")
                        nodes.append(Node(
                            id=n['id'], label=n['label'], size=20, shape="dot",
                            color=node_color, title="Click to view details"
                        ))
                        lookup[n['id']] = n
                        existing.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing and e['target'] in existing:
                        edges.append(Edge(source=e['source'], target=e['target'], label=e['label'], color="#d3d3d3"))
                
                # SAVE TO STATE (This prevents re-running logic on click)
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                st.session_state['lookup_map'] = lookup
                st.session_state['selected_node_id'] = None # Reset selection on new graph
                
            except Exception as e:
                st.error(f"Error: {e}")


# --- 4. VISUALIZATION (Runs from Memory) ---
if st.session_state['graph_data']:
    
    # We define config here so it updates when the Spacing slider changes
    # But because spacing is in the FORM, it only updates on Submit (which is what you want)
    config = Config(
        width=1200, height=750, directed=True, physics=True, hierarchy=False,
        nodeHighlightBehavior=True, highlightColor="#ed1f79", collapsible=False,
        solver='forceAtlas2Based',
        forceAtlas2Based={
            "gravitationalConstant": -100, "centralGravity": 0.005,
            "springLength": spacing, "springConstant": 0.05, "damping": 0.4
        }
    )

    # Render Graph
    # The 'key' argument is vital! It stops Streamlit from seeing this widget as "new" every time.
    clicked_id = agraph(
        nodes=st.session_state['graph_data']['nodes'], 
        edges=st.session_state['graph_data']['edges'], 
        config=config
    )
    
    # Check if click happened
    if clicked_id and clicked_id != st.session_state['selected_node_id']:
        st.session_state['selected_node_id'] = clicked_id
        st.rerun() # Fast rerun just to update the sidebar
