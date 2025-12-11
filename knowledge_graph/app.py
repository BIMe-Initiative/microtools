import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# --- PAGE CONFIG ---
st.set_page_config(layout="wide", page_title="BIMe Knowledge Base")

st.title("💠 BIMe Interactive Knowledge Graph")

# --- 1. SETUP & STATE ---
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

# --- 2. SIDEBAR CONTROLS ---
with st.sidebar:
    st.header("🎛️ Graph Controls")
    
    # Input
    uploaded_files = st.file_uploader("Upload Sources (PDF):", type=["pdf"], accept_multiple_files=True)
    
    st.divider()
    
    # THE 3 SLIDERS
    st.subheader("Complexity Settings")
    max_concepts = st.slider("Key Concepts (Parents)", 5, 30, 15, help("How many main topics to find."))
    child_density = st.slider("Detail Level (Children)", 1, 5, 3, help("How many sub-nodes per concept."))
    
    st.subheader("Visual Layout")
    spacing = st.slider("Node Spacing", 100, 600, 300, help("Physical distance between nodes."))
    
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Generate Graph", type="primary"):
            st.session_state['trigger_gen'] = True
            st.session_state['selected_node_id'] = None
    with col2:
        if st.button("Clear"):
            st.session_state['graph_data'] = None
            st.session_state['lookup_map'] = {}
            st.rerun()

    # --- DESCRIPTION PANEL (IN SIDEBAR) ---
    st.divider()
    st.subheader("📖 Concept Details")
    
    # We use a placeholder to update this area dynamically
    details_area = st.empty()
    
    # Logic to display details if a node is selected
    if st.session_state['selected_node_id']:
        node_id = st.session_state['selected_node_id']
        info = st.session_state['lookup_map'].get(node_id, {})
        
        with details_area.container():
            st.markdown(f"### {info.get('label', node_id)}")
            st.caption(f"Type: {info.get('type', 'General')}")
            st.info(info.get('desc', 'No definition available.'))
    else:
        details_area.info("Click a node in the graph to see its definition here.")


# --- 3. PROCESSING ENGINE ---
if st.session_state.get('trigger_gen') and uploaded_files:
    full_text = ""
    with st.spinner("Reading documents..."):
        for pdf in uploaded_files:
            try:
                reader = PdfReader(pdf)
                for page in reader.pages:
                    full_text += page.extract_text() + "\n"
            except: pass

    if full_text:
        with st.spinner("Gemini is structuring the data..."):
            try:
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                # Prompt tuning: We explicitly ask for "Key Concepts" vs "Sub-Concepts"
                # based on the slider values.
                prompt = f"""
                Act as a Data Architect. Extract a Knowledge Graph from the text.
                
                GOAL: Create a structured hierarchy.
                1. Identify exactly {max_concepts} "Parent" concepts (Major topics).
                2. For each Parent, identify {child_density} "Child" concepts (Sub-topics).
                3. Total nodes should be roughly {max_concepts * (1 + child_density)}.
                
                ONTOLOGY TYPES: "Concept", "Standard", "Role", "Process".
                
                OUTPUT JSON:
                {{
                  "nodes": [ {{"id": "Name", "label": "Short Label", "type": "Concept", "desc": "Short definition"}} ],
                  "edges": [ {{"source": "Name", "target": "Name", "label": "verb"}} ]
                }}
                
                Text: {full_text[:90000]}
                """
                
                response = model.generate_content(prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                nodes = []
                edges = []
                lookup = {}
                existing = set()
                
                # --- SOLID BRAND COLORS ---
                # #8dc63f (Green), #5ec6c8 (Teal), #dfc024 (Yellow), #ed1f79 (Pink)
                # We map types to these colors.
                color_map = {
                    "Concept": "#8dc63f",  # Green
                    "Standard": "#5ec6c8", # Teal
                    "Process": "#dfc024",  # Yellow
                    "Role": "#ed1f79",     # Pink
                    "Tool": "#5ec6c8",     # Teal (Reuse)
                    "Organization": "#dfc024" # Yellow (Reuse)
                }

                for n in data.get('nodes', []):
                    if n['id'] not in existing:
                        # Fallback color is Green (#8dc63f)
                        node_color = color_map.get(n.get('type'), "#8dc63f")
                        
                        nodes.append(Node(
                            id=n['id'], 
                            label=n['label'], 
                            size=20,           # Standard size
                            shape="dot",       # ALWAYS DOT
                            color=node_color,
                            title="Click for details"
                        ))
                        
                        lookup[n['id']] = n
                        existing.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing and e['target'] in existing:
                        edges.append(Edge(
                            source=e['source'], 
                            target=e['target'], 
                            label=e['label'],
                            color="#d3d3d3" # Standard grey lines
                        ))
                
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                st.session_state['lookup_map'] = lookup
                
            except Exception as e:
                st.error(f"Error: {e}")

# --- 4. VISUALIZATION ---
if st.session_state['graph_data']:
    
    # Configuration (Linked to Spacing Slider)
    config = Config(
        width=1200, 
        height=750, 
        directed=True, 
        physics=True, 
        hierarchy=False,
        nodeHighlightBehavior=True, 
        highlightColor="#ed1f79", # Highlight in Pink
        collapsible=False,
        solver='forceAtlas2Based',
        forceAtlas2Based={
            "gravitationalConstant": -100,
            "centralGravity": 0.005,
            "springLength": spacing,       # <--- SLIDER CONTROL
            "springConstant": 0.05,
            "damping": 0.4
        }
    )

    # Render & Capture Click
    clicked_id = agraph(
        nodes=st.session_state['graph_data']['nodes'], 
        edges=st.session_state['graph_data']['edges'], 
        config=config
    )
    
    # Update State on Click (This triggers the sidebar update)
    if clicked_id:
        st.session_state['selected_node_id'] = clicked_id
        st.rerun() # Rerun to update the sidebar immediately
