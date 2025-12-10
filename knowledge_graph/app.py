import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# --- PAGE CONFIG ---
st.set_page_config(layout="wide", page_title="BIMe Knowledge Base")

# Custom CSS to make the "Bubble" look elegant
st.markdown("""
<style>
    /* Make the top header cleaner */
    .stAppHeader {display:none;}
    /* Custom styling for the details dialog */
    div[data-testid="stMarkdownContainer"] p {font-size: 1.1rem;}
</style>
""", unsafe_allow_html=True)

st.title("💠 BIMe Interactive Knowledge Graph")

# --- 1. SETUP & STATE ---
if 'graph_data' not in st.session_state:
    st.session_state['graph_data'] = None
if 'lookup_map' not in st.session_state:
    st.session_state['lookup_map'] = {}
if 'focus_node' not in st.session_state:
    st.session_state['focus_node'] = None  # For isolation mode

try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key missing. Check Streamlit Secrets.")

# --- 2. SIDEBAR CONTROLS ---
with st.sidebar:
    st.header("🎛️ Graph Controls")
    
    uploaded_files = st.file_uploader("Upload Sources (PDF):", type=["pdf"], accept_multiple_files=True)
    
    # Physics Controls
    st.subheader("Physics Settings")
    grav = st.slider("Gravity", -1000, -5000, -2500)
    
    st.divider()
    
    if st.button("Generate New Graph", type="primary"):
        st.session_state['trigger_gen'] = True
        st.session_state['focus_node'] = None # Reset isolation
    
    if st.button("Reset View (Show All)"):
        st.session_state['focus_node'] = None
        st.rerun()

# --- 3. DIALOG FUNCTION (The "Elegant Bubble") ---
@st.dialog("Details & Actions")
def show_node_details(node_id):
    info = st.session_state['lookup_map'].get(node_id, {})
    
    # Header with Icon
    col1, col2 = st.columns([1, 4])
    with col1:
        # Display a large emoji/icon based on type
        icon_map = {"Concept": "💡", "Standard": "📜", "Role": "👤", "Process": "🔄", "Tool": "💻", "Organization": "🏢"}
        st.markdown(f"# {icon_map.get(info.get('type'), '📄')}")
    with col2:
        st.subheader(info.get('label', node_id))
        st.caption(f"Type: {info.get('type', 'General')} | Importance: {info.get('importance', 5)}/10")

    st.markdown("---")
    st.markdown(f"### {info.get('desc', 'No definition available.')}")
    st.markdown("---")
    
    # The "Isolation" Feature
    if st.button(f"🔭 Isolate '{info.get('label')}' & Connections"):
        st.session_state['focus_node'] = node_id
        st.rerun()

# --- 4. DATA PROCESSING ---
if st.session_state.get('trigger_gen') and uploaded_files:
    full_text = ""
    with st.spinner("Processing Documents..."):
        for pdf in uploaded_files:
            try:
                reader = PdfReader(pdf)
                for page in reader.pages:
                    full_text += page.extract_text() + "\n"
            except: pass

    if full_text:
        with st.spinner("AI Architect is structuring the ontology..."):
            try:
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                prompt = f"""
                Act as a Senior BIM Ontologist. Extract a Knowledge Graph from the text.
                
                1. ONTOLOGY (Classify nodes strictly):
                   - "Concept" (Theoretical ideas, terms)
                   - "Standard" (ISO, PAS, Guidelines)
                   - "Role" (Job titles, Stakeholders)
                   - "Process" (Workflows, Actions)
                   - "Tool" (Software, Hardware)
                   - "Organization" (Companies, Institutes)

                2. METRICS:
                   - Node "importance": 1 to 30 (Frequency/Relevance)
                   - Edge "strength": 1 to 5 (Connection strength)

                3. OUTPUT: JSON ONLY.
                {{
                  "nodes": [ {{"id": "UniqueName", "label": "Short Label", "type": "Concept", "importance": 10, "desc": "Definition"}} ],
                  "edges": [ {{"source": "ID", "target": "ID", "label": "verb", "strength": 3}} ]
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
                
                # --- SHAPE & COLOR MAPPING ---
                # Squares, Triangles, Diamonds, Hexagons (Octagon proxy), Dots
                ontology_style = {
                    "Concept":      {"shape": "dot",      "color": "#FF6F61"}, # Circle (Coral)
                    "Standard":     {"shape": "square",   "color": "#88B04B"}, # Square (Green)
                    "Role":         {"shape": "triangle", "color": "#EFC050"}, # Triangle (Yellow)
                    "Process":      {"shape": "diamond",  "color": "#6B5B95"}, # Diamond (Purple)
                    "Tool":         {"shape": "hexagon",  "color": "#92A8D1"}, # Hexagon (Blue)
                    "Organization": {"shape": "star",     "color": "#D65076"}  # Star (Pink)
                }

                for n in data.get('nodes', []):
                    if n['id'] not in existing:
                        style = ontology_style.get(n.get('type'), {"shape": "dot", "color": "#999"})
                        
                        # Scale size (Base 15 + Importance)
                        size = 15 + (n.get('importance', 5) * 1.5)
                        
                        nodes.append(Node(
                            id=n['id'], 
                            label=n['label'], 
                            size=size,
                            shape=style["shape"],
                            color=style["color"],
                            title="Click for details" # Hover text
                        ))
                        
                        lookup[n['id']] = n
                        existing.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing and e['target'] in existing:
                        # Width based on strength
                        width = e.get('strength', 1) * 1.5
                        edges.append(Edge(
                            source=e['source'], 
                            target=e['target'], 
                            label=e['label'],
                            width=width,
                            color="#d3d3d3" # Light grey organic lines
                        ))
                
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                st.session_state['lookup_map'] = lookup
                
            except Exception as e:
                st.error(f"Error: {e}")

# --- 5. VISUALIZATION LOGIC (WITH ISOLATION) ---
if st.session_state['graph_data']:
    
    # A. Determine which nodes to show (All vs Isolated)
    display_nodes = []
    display_edges = []
    
    if st.session_state['focus_node']:
        # Isolation Mode: Find neighbors
        target = st.session_state['focus_node']
        neighbor_ids = set()
        neighbor_ids.add(target)
        
        # 1. Find Edges connected to target
        for e in st.session_state['graph_data']['edges']:
            if e.source == target or e.target == target:
                display_edges.append(e)
                neighbor_ids.add(e.source)
                neighbor_ids.add(e.target)
        
        # 2. Filter Nodes
        for n in st.session_state['graph_data']['nodes']:
            if n.id in neighbor_ids:
                display_nodes.append(n)
                
        st.info(f"🔭 Focused on: {target} (Double-click disabled in focus mode)")
        
    else:
        # Show All
        display_nodes = st.session_state['graph_data']['nodes']
        display_edges = st.session_state['graph_data']['edges']

    # B. Configuration
    config = Config(
        width=1200, 
        height=700, 
        directed=True, 
        physics=True, 
        hierarchy=False,
        # Interaction settings
        nodeHighlightBehavior=True, 
        highlightColor="#F7A7A6",
        collapsible=False,
        # Physics settings for "Organic" feel
        graphviz_layout=False,
        solver='forceAtlas2Based', # Good for organic clustering
        gravity=grav,
        smooth={'enabled': True, 'type': 'continuous', 'roundness': 0.5} # Curved lines
    )

    # C. Render
    clicked_id = agraph(nodes=display_nodes, edges=display_edges, config=config)
    
    # D. Handle Click -> Open Dialog
    if clicked_id:
        show_node_details(clicked_id)
