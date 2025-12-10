import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
import google.generativeai as genai
import json

# Page Config
st.set_page_config(layout="wide")
st.title("🔗 BIMe Knowledge Graph Generator")

# 1. Setup API Key
# We grab the key from the "Secrets" vault in Streamlit Cloud
try:
    genai.configure(api_key=st.secrets["GOOGLE_API_KEY"])
except:
    st.error("API Key not found. Please set GOOGLE_API_KEY in Streamlit Secrets.")

# 2. Sidebar Input
with st.sidebar:
    st.header("Input Data")
    text_input = st.text_area("Paste text from a PDF, Post, or Page:", height=300)
    generate_btn = st.button("Generate Graph", type="primary")

# 3. Main Logic
if generate_btn and text_input:
    with st.spinner("Analyzing text and mapping connections..."):
        try:
            # Connect to Gemini
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # The Prompt for Gemini
            prompt = f"""
            You are an expert Data Architect. Analyze the text below.
            Identify key concepts (Nodes) and how they relate (Edges).
            
            Rules:
            1. Limit to the top 15 most important nodes.
            2. Output STRICTLY valid JSON.
            3. Use this format:
            {{
              "nodes": [ {{"id": "Exact Name", "label": "Exact Name", "color": "#FF6F61"}} ],
              "edges": [ {{"source": "Exact Name", "target": "Exact Name", "label": "relationship_type"}} ]
            }}
            
            Text to analyze:
            {text_input}
            """
            
            response = model.generate_content(prompt)
            
            # Clean the response (remove Markdown formatting if Gemini adds it)
            clean_json = response.text.replace('```json', '').replace('```', '').strip()
            data = json.loads(clean_json)
            
            # Prepare Graph Data
            nodes = []
            edges = []
            
            for n in data['nodes']:
                nodes.append(Node(id=n['id'], label=n['label'], size=20, color=n.get('color', '#FF6F61')))
            
            for e in data['edges']:
                edges.append(Edge(source=e['source'], target=e['target'], label=e['label']))
            
            # Configure the Physics of the Graph
            config = Config(width=900, 
                            height=700, 
                            directed=True, 
                            physics=True, 
                            hierarchical=False,
                            nodeHighlightBehavior=True, 
                            highlightColor="#F7A7A6")
            
            # Render
            st.success(f"Generated {len(nodes)} nodes and {len(edges)} connections.")
            return_value = agraph(nodes=nodes, edges=edges, config=config)
            
        except Exception as e:
            st.error(f"An error occurred: {e}")
            with st.expander("See technical details"):
                st.write(e)
                st.write("Raw output from Gemini:")
                st.write(response.text if 'response' in locals() else "No response")

elif generate_btn and not text_input:
    st.warning("Please paste some text first!")
