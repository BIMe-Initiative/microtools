import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json
from pypdf import PdfReader

# Page Config
st.set_page_config(layout="wide")
st.title("🔗 BIMe Knowledge Graph Generator")

# 1. Setup API Key
try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key not found. Please set GOOGLE_API_KEY in Streamlit Secrets.")

# 2. Sidebar Input
with st.sidebar:
    st.header("Input Data")
    
    # Option A: Paste Text
    text_input = st.text_area("Option 1: Paste Text", height=150)
    
    st.write("--- OR ---")
    
    # Option B: Upload PDF
    uploaded_file = st.file_uploader("Option 2: Upload a PDF", type=["pdf"])
    
    generate_btn = st.button("Generate Graph", type="primary")

# 3. Main Logic
if generate_btn:
    # Determine source of text
    final_text = ""
    
    if uploaded_file is not None:
        with st.spinner("Reading PDF..."):
            try:
                reader = PdfReader(uploaded_file)
                for page in reader.pages:
                    final_text += page.extract_text() + "\n"
            except Exception as e:
                st.error(f"Error reading PDF: {e}")
    elif text_input:
        final_text = text_input
    
    # If we have text, send to Gemini
    if final_text:
        with st.spinner("Analyzing text and mapping connections..."):
            try:
                # Connect to Gemini 2.0 Flash
                model = genai.GenerativeModel('gemini-2.0-flash')
                
                # The Prompt
                prompt = f"""
                You are an expert Data Architect. Analyze the text below.
                Identify key concepts (Nodes) and how they relate (Edges).
                
                Rules:
                1. Limit to the top 20 most important nodes.
                2. Output STRICTLY valid JSON.
                3. Use this format:
                {{
                  "nodes": [ {{"id": "Exact Name", "label": "Exact Name", "color": "#FF6F61"}} ],
                  "edges": [ {{"source": "Exact Name", "target": "Exact Name", "label": "relationship_type"}} ]
                }}
                
                Text to analyze:
                {final_text[:50000]} 
                """
                # Note: We limit text to 50k chars to keep it fast, though Flash can handle more.
                
                response = model.generate_content(prompt)
                
                # Clean JSON
                clean_json = response.text.replace('```json', '').replace('```', '').strip()
                data = json.loads(clean_json)
                
                # Build Graph
                nodes = []
                edges = []
                existing_nodes = set()

                for n in data.get('nodes', []):
                    if n['id'] not in existing_nodes:
                        nodes.append(Node(id=n['id'], label=n['label'], size=20, color=n.get('color', '#FF6F61')))
                        existing_nodes.add(n['id'])
                
                for e in data.get('edges', []):
                    if e['source'] in existing_nodes and e['target'] in existing_nodes:
                        edges.append(Edge(source=e['source'], target=e['target'], label=e['label']))
                
                # Config
                config = Config(width=900, height=700, directed=True, physics=True, hierarchical=False, nodeHighlightBehavior=True, highlightColor="#F7A7A6")
                
                # Render
                st.success(f"Generated {len(nodes)} nodes and {len(edges)} connections from your content.")
                return_value = agraph(nodes=nodes, edges=edges, config=config)
                
            except Exception as e:
                st.error(f"An error occurred: {e}")
                
    else:
        st.warning("Please paste text or upload a PDF first!")
