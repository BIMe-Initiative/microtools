import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# --- PAGE CONFIG ---
st.set_page_config(layout="wide", page_title="BIMe Knowledge Base")

# --- CUSTOM CSS (Pastel & Clean) ---
st.markdown("""
<style>
    /* Clean up the top bar */
    .stAppHeader {display:none;}
    
    /* Elegant Dialog Text */
    div[data-testid="stMarkdownContainer"] p {
        font-family: 'Helvetica Neue', sans-serif;
        color: #333;
        line-height: 1.6;
    }
    
    /* Remove standard button borders for a cleaner look */
    button {
        border-radius: 8px !important;
    }
</style>
""", unsafe_allow_html=True)

st.title("💠 BIMe Interactive Knowledge Graph")

# --- 1. SETUP & STATE ---
if 'graph_data' not in st.session_state:
    st.session_state['graph_data'] = None
if 'lookup_map' not in st.session_state:
    st.session_state['lookup_map'] = {}
if 'focus_node' not in st.session_state:
    st.session_state['focus_node'] = None 

# Secure API Key Access
try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key missing. Please check Streamlit Secrets.")

# --- 2. SIDEBAR CONTROLS ---
with st.sidebar:
    st.header("🎛️ Viewer Settings")
    
    # Input Section
    uploaded_files = st.file_uploader("Upload Sources (PDF):", type=["pdf"], accept_multiple_files=True)
    
    st.divider()
    
    # "Human Readable" Physics Controls
    st.subheader("Layout")
    # We map "Spacing" to the physics 'springLength'
    spacing = st.slider("Node Spacing", min_value=100, max_value=500, value=250)
    
    st.divider()
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("Generate", type="primary"):
            st.session_state['trigger_gen'] = True
            st.session_state['focus_node'] = None
    with col2:
        if st.button("Clear"):
            st.session_state['graph_data'] = None
            st.session_state['lookup_map'] = {}
            st.rerun()
            
    if st.session_state['focus_node']:
        if st.button("🔙 Exit Focus Mode"):
            st.session_state['focus_node'] = None
            st.rerun()

# --- 3. ELEGANT POP-UP (DIALOG) ---
@st.dialog("Concept Details")
def show_node_details(node_id):
    info = st.session_state['lookup_map'].get(node_id, {})
    
    # 1. Header with Type Icon
    icon_map = {
        "Concept": "💡", "Standard": "📜", "Role": "👤", 
        "Process": "🔄", "Tool": "💻", "Organization": "🏢"
    }
    type_icon = icon_map.get(info.get('type'), '📄')
    
    # Layout: Icon Left, Title Right
    c1, c2 = st.columns([1, 5])
    with c1:
        st.markdown(f"<h1 style='text-align: center;'>{type_icon}</h1>", unsafe_allow_html=True)
    with c2:
        st.subheader(info.get('label', node_id))
        st.caption(f"Category: {info.get('type', 'General')} | Relevance: {info.get('importance', 5)}/10")

    st.markdown("---")
    
    # 2. Definition Content
    st.info(info.get('desc', 'No definition available.'))
    
    st.markdown("---")
    
    # 3. Action Buttons
    if st.button(f"🔭 Isolate '{info.get('label')}' Connections", use_container_width=True):
        st.session_state['focus_node'] = node_id
        st.rerun()

# --- 4. PROCESSING ENGINE ---
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
        with st.spinner("Structuring Knowledge Ontology..."):
            try:
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                # Prompt optimized for correct Ontology & Metrics
                prompt = f"""
                You are a Senior Data Architect. Create a Knowledge Graph from the text.
                
                1. ONTOLOGY (Classify every node):
                   - "Concept" (Abstract ideas)
                   - "Standard" (ISO, protocols)
                   - "Role" (People, titles)
                   - "Process" (Actions, workflows)
                   - "Tool" (Software, hardware)
                   - "Organization" (Companies, bodies)

                2. METRICS:
                   - "importance": 1 (Low) to 10 (High)
                   - "strength": 1 (Weak) to 5 (Strong)

                3. OUTPUT: JSON ONLY.
                {{
                  "nodes": [ {{"id": "Name", "label": "Short Name", "type": "Concept", "importance": 8, "desc": "One sentence definition."}} ],
                  "edges": [ {{"source": "Name", "target": "Name", "label": "verb", "strength": 3}} ]
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
                
                # --- PASTEL PALETTE (70% Opacity) ---
                # Format: rgba(r, g, b, 0.7)
                ontology_style = {
                    "Concept":      {"shape": "dot",      "color": "rgba(255, 111, 97, 0.7)"},   # Coral
                    "Standard":     {"shape": "square",   "color": "rgba(136, 176, 75, 0.7)"},   # Green
                    "Role":         {"shape": "triangle", "color": "rgba(239, 192, 80, 0.7)"},   # Yellow
                    "Process":      {"shape": "diamond",  "color": "rgba(107, 91, 149, 0.7)"},   # Purple
                    "Tool":         {"shape": "hexagon",  "color": "rgba(146, 168, 209, 0.7)"},  # Blue
                    "Organization": {"shape": "star",     "color": "rgba(214, 80, 118, 0.7)"}    # Pink
                }

                for n in data.get('nodes', []):
                    if n['id'] not in existing:
                        style = ontology_style.get(n.get('type'), {"shape": "dot", "color": "rgba(200,200,200,0.7)"})
                        
                        # Size calculation (Base 20 + Importance)
                        # We limit the max size to prevent "giant distracting bubbles"
                        size = 20 + (n.get('importance', 5) * 2)
                        
                        nodes.append(Node(
                            id=n['id'], 
                            label=n['label'], 
                            size=size,
                            shape=style["shape"],
                            color=style["color"],
                            borderWidth=0,        # <--- NO BORDER
                            borderWidthSelected=2,# Slight border only when selected
                            title=n.get('desc')   # Tooltip
                        ))
                        
                        lookup[n['id']] = n
                        existing.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing and e['target'] in existing:
                        edges.append(Edge(
                            source=e['source'], 
                            target=e['target'], 
                            label=e['label'],
                            width=e.get('strength', 1), # Width based on strength
                            color="rgba(180,180,180,0.5)" # Organic light grey lines
                        ))
                
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                st.session_state['lookup_map'] = lookup
                
            except Exception as e:
                st.error(f"Error: {e}")

# --- 5. VISUALIZATION LOGIC ---
if st.session_state['graph_data']:
    
    # Filter for Focus Mode
    if st.session_state['focus_node']:
        target = st.session_state['focus_node']
        subset_nodes = []
        subset_edges = []
        allowed_ids = {target}
        
        # 1. Find neighbors
        for e in st.session_state['graph_data']['edges']:
            if e.source == target:
                allowed_ids.add(e.target)
                subset_edges.append(e)
            elif e.target == target:
                allowed_ids.add(e.source)
                subset_edges.append(e)
        
        # 2. Add nodes
        for n in st.session_state['graph_data']['nodes']:
            if n.id in allowed_ids:
                subset_nodes.append(n)
        
        current_nodes = subset_nodes
        current_edges = subset_edges
        st.info(f"🔭 Focused on: {target}")
    else:
        current_nodes = st.session_state['graph_data']['nodes']
        current_edges = st.session_state['graph_data']['edges']

    # --- CONFIGURATION (The "Organic" Physics) ---
    config = Config(
        width=1200, 
        height=750, 
        directed=True, 
        physics=True, 
        hierarchy=False,
        nodeHighlightBehavior=True, 
        highlightColor="#F7A7A6",
        collapsible=False,
        
        # ORGANIC PHYSICS SETTINGS
        # We use 'forceAtlas2Based' which creates that nice organic web look
        solver='forceAtlas2Based',
        forceAtlas2Based={
            "gravitationalConstant": -100, # Repulsion
            "centralGravity": 0.005,
            "springLength": spacing,       # <--- CONNECTED TO SLIDER
            "springConstant": 0.05,
            "damping": 0.4
        },
        # Smooth Curved Lines
        edges={
            "smooth": {"type": "continuous", "roundness": 0.5} 
        }
    )

    # Render
    clicked_id = agraph(nodes=current_nodes, edges=current_edges, config=config)
    
    # Handle Click -> Trigger Elegant Dialog
    if clicked_id:
        show_node_details(clicked_id)
