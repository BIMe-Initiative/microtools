import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# Page Config
st.set_page_config(layout="wide", page_title="BIMe Smart Graph")
st.title("🧠 BIMe Interactive Knowledge Base")

# --- 1. SETUP & MEMORY ---
if 'graph_data' not in st.session_state:
    st.session_state['graph_data'] = None
if 'lookup_map' not in st.session_state:
    st.session_state['lookup_map'] = {} # Stores descriptions for quick access

try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key missing. Check Streamlit Secrets.")

# --- 2. SIDEBAR (CONTROLS & DETAILS) ---
with st.sidebar:
    # A. The Detail View (Shows UP TOP when you click a node)
    st.header("🔍 Node Details")
    
    # We use a placeholder so we can update this area dynamically
    details_placeholder = st.empty()
    
    st.write("---")
    st.header("🗂️ Data Input")
    
    uploaded_files = st.file_uploader(
        "Upload PDF documents:", 
        type=["pdf"], 
        accept_multiple_files=True
    )
    
    node_limit = st.slider("Complexity", 10, 50, 25)
    
    if st.button("Generate Smart Graph", type="primary"):
        # Trigger the generation logic below
        st.session_state['trigger_gen'] = True
    else:
        st.session_state['trigger_gen'] = False

    if st.button("Clear Data"):
        st.session_state['graph_data'] = None
        st.session_state['lookup_map'] = {}
        st.rerun()

# --- 3. PROCESSING ENGINE ---
if st.session_state.get('trigger_gen') and uploaded_files:
    full_text = ""
    with st.spinner(f"Reading {len(uploaded_files)} files..."):
        for pdf_file in uploaded_files:
            try:
                reader = PdfReader(pdf_file)
                for page in reader.pages:
                    full_text += page.extract_text() + "\n"
            except:
                pass

    if full_text:
        with st.spinner("Gemini is extracting definitions and structure..."):
            try:
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                # UPDATED PROMPT: Asking for 'type' and 'description'
                prompt = f"""
                Analyze the text and extract a Knowledge Graph.
                
                Rules:
                1. Identify top {node_limit} concepts.
                2. For each node, determine its TYPE (Concept, Organization, Standard, Person, or Tool).
                3. For each node, write a 1-sentence DEFINITION based on the text.
                4. Output STRICT JSON format.
                
                Format:
                {{
                  "nodes": [ 
                    {{
                        "id": "Name", 
                        "label": "Name", 
                        "type": "Concept", 
                        "description": "Definition goes here..."
                    }} 
                  ],
                  "edges": [ {{"source": "Name", "target": "Name", "label": "verb"}} ]
                }}
                
                Text: {full_text[:80000]}
                """
                
                response = model.generate_content(prompt)
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                nodes = []
                edges = []
                lookup = {} # Fast dictionary to find descriptions
                existing = set()
                
                # Color Palette for Types
                type_colors = {
                    "Concept": "#FF6F61",      # Coral Red
                    "Organization": "#6B5B95", # Purple
                    "Standard": "#88B04B",     # Green
                    "Person": "#F7CAC9",       # Pink
                    "Tool": "#92A8D1",         # Blue
                    "Other": "#955251"
                }

                for n in data.get('nodes', []):
                    if n['id'] not in existing:
                        # Pick color based on type
                        node_color = type_colors.get(n.get('type', 'Other'), "#955251")
                        
                        nodes.append(Node(
                            id=n['id'], 
                            label=n['label'], 
                            size=25, 
                            color=node_color,
                            # We store the description in the 'title' field which shows on hover
                            title=n.get('description', '') 
                        ))
                        
                        # Store details in our lookup map
                        lookup[n['id']] = {
                            "desc": n.get('description', 'No definition found.'),
                            "type": n.get('type', 'General')
                        }
                        
                        existing.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing and e['target'] in existing:
                        edges.append(Edge(source=e['source'], target=e['target'], label=e['label']))
                
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                st.session_state['lookup_map'] = lookup
                
            except Exception as e:
                st.error(f"Error: {e}")

# --- 4. VISUALIZATION & INTERACTION ---
if st.session_state['graph_data']:
    
    # Draw the graph and CAPTURE the clicked node ID
    # agraph returns the 'id' of the node you click
    clicked_node_id = agraph(
        nodes=st.session_state['graph_data']['nodes'], 
        edges=st.session_state['graph_data']['edges'], 
        config=Config(
            width=1000, 
            height=700, 
            directed=True, 
            physics=True, 
            nodeHighlightBehavior=True, 
            highlightColor="#F7A7A6"
        )
    )
    
    # --- 5. HANDLE THE CLICK ---
    # If the user clicked something, look it up in our map
    if clicked_node_id and clicked_node_id in st.session_state['lookup_map']:
        info = st.session_state['lookup_map'][clicked_node_id]
        
        # Display nicely in the sidebar
        with details_placeholder.container():
            st.info(f"**Selected:** {clicked_node_id}")
            st.write(f"**Type:** {info['type']}")
            st.write(f"**Definition:** {info['desc']}")
            
    elif not clicked_node_id:
        details_placeholder.info("👈 Click a node to see its definition.")
