import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# Page Config
st.set_page_config(layout="wide", page_title="BIMe Graph")
st.title("🔗 BIMe Interactive Knowledge Graph")

# --- 1. SETUP & MEMORY ---
# We use Session State to keep the graph on screen after you click things
if 'graph_data' not in st.session_state:
    st.session_state['graph_data'] = None

try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key missing. Check Streamlit Secrets.")

# --- 2. SIDEBAR (CONTROLS) ---
with st.sidebar:
    st.header("🗂️ Data Sources")
    
    # Allow Multiple Files
    uploaded_files = st.file_uploader(
        "Upload PDF documents:", 
        type=["pdf"], 
        accept_multiple_files=True
    )
    
    st.write("---")
    # Let user control complexity
    node_limit = st.slider("Max Complexity (Nodes)", min_value=10, max_value=60, value=30)
    
    generate_btn = st.button("Generate / Update Graph", type="primary")
    
    if st.button("Clear Graph"):
        st.session_state['graph_data'] = None
        st.rerun()

# --- 3. PROCESSING ENGINE ---
if generate_btn:
    full_text = ""
    
    # A. Process PDFs
    if uploaded_files:
        with st.spinner(f"Reading {len(uploaded_files)} files..."):
            for pdf_file in uploaded_files:
                try:
                    reader = PdfReader(pdf_file)
                    for page in reader.pages:
                        full_text += page.extract_text() + "\n"
                except Exception as e:
                    st.error(f"Error reading {pdf_file.name}: {e}")
    
    # B. Send to Gemini
    if full_text:
        with st.spinner("Gemini is mapping the connections..."):
            try:
                # Use the powerful 2.0 Flash model
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                prompt = f"""
                You are a Knowledge Graph Architect. Analyze the provided text and extract a structured graph.
                
                GOAL: Create a hierarchical view of the concepts.
                
                Rules:
                1. Identify up to {node_limit} key concepts (Nodes).
                2. Identify relationships (Edges) with clear verbs (e.g., "contains", "requires", "defines").
                3. STRICTLY output valid JSON.
                4. Format:
                {{
                  "nodes": [ {{"id": "Concept Name", "label": "Concept Name", "group": "CategoryName"}} ],
                  "edges": [ {{"source": "Concept Name", "target": "Concept Name", "label": "relationship"}} ]
                }}
                
                Text to analyze:
                {full_text[:80000]}
                """
                
                response = model.generate_content(prompt)
                
                # Clean JSON
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                # --- C. BUILD GRAPH STRUCTURE ---
                nodes = []
                edges = []
                existing_ids = set()
                
                # Colors for different types of nodes (Visual Depth)
                colors = ["#FF6F61", "#6B5B95", "#88B04B", "#F7CAC9", "#92A8D1"]
                
                for i, n in enumerate(data.get('nodes', [])):
                    if n['id'] not in existing_ids:
                        # Assign color based on group if available, or random
                        nodes.append(Node(
                            id=n['id'], 
                            label=n['label'], 
                            size=25, 
                            color="#FF6F61" # You can make this dynamic later
                        ))
                        existing_ids.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing_ids and e['target'] in existing_ids:
                        edges.append(Edge(
                            source=e['source'], 
                            target=e['target'], 
                            label=e['label']
                        ))
                
                # Save to Memory (Session State)
                st.session_state['graph_data'] = {'nodes': nodes, 'edges': edges}
                
            except Exception as e:
                st.error(f"Analysis Failed: {e}")
                
    else:
        st.warning("Please upload at least one PDF.")

# --- 4. VISUALIZATION (READS FROM MEMORY) ---
if st.session_state['graph_data']:
    data = st.session_state['graph_data']
    
    st.success(f"Visualizing {len(data['nodes'])} nodes from your documents.")
    
    # Physics Config - "hierarchical: True" helps show depth if the data supports it
    config = Config(
        width=1000, 
        height=800, 
        directed=True, 
        physics=True, 
        hierarchical=False, # Set to True if you want a strict Tree view
        nodeHighlightBehavior=True, 
        highlightColor="#F7A7A6"
    )
    
    # Render the graph
    # We ignore the return value to prevent re-running loops
    agraph(nodes=data['nodes'], edges=data['edges'], config=config)
    
else:
    st.info("Upload files and click Generate to see the network.")
