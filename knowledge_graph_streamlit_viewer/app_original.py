import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
from neo4j import GraphDatabase
import random
import json

st.set_page_config(layout="wide", page_title="BIMei Knowledge Browser")

# --- Enhanced CSS ---
st.markdown("""
<style>
    .stAppHeader {display:none;}
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600&display=swap');
    
    /* Main header styling */
    .main-header {
        background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
        color: white;
        padding: 1rem 2rem;
        margin: -1rem -1rem 2rem -1rem;
        border-radius: 0;
    }
    
    /* Input section styling */
    .input-section {
        background: white;
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 1rem;
        border: 1px solid #e2e8f0;
    }
    
    /* Cypher display */
    .cypher-display {
        background: #1e293b;
        color: #10b981;
        padding: 1rem;
        border-radius: 6px;
        margin: 1rem 0;
        font-family: 'Courier New', monospace;
        border-left: 4px solid #10b981;
    }
    
    /* Graph container */
    .graph-container {
        position: relative;
        background: #f8fafc;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
    }
    
    /* Node details panel */
    .node-details {
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        border: 1px solid #e2e8f0;
        padding: 1.5rem;
        margin-top: 1rem;
    }
    
    /* Property grid */
    .property-grid {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 0.5rem;
        margin-top: 1rem;
    }
    
    .property-key {
        font-weight: 500;
        color: #64748b;
        font-size: 0.875rem;
    }
    
    .property-value {
        color: #1e293b;
        font-family: 'Roboto', sans-serif;
        font-size: 0.875rem;
    }
    
    /* Status badges */
    .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
        background: #dbeafe;
        color: #1e40af;
    }
    
    /* Metrics styling */
    .metric-container {
        background: #f1f5f9;
        padding: 1rem;
        border-radius: 6px;
        text-align: center;
        border: 1px solid #e2e8f0;
    }
</style>
""", unsafe_allow_html=True)

# Header
st.markdown("""
<div class="main-header">
    <h1 style="margin:0; font-size: 1.5rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
        🔍 BIMei Knowledge Browser
    </h1>
</div>
""", unsafe_allow_html=True)

# Neo4j connection and weights loading (same as before)
@st.cache_resource
def get_driver():
    uri = "neo4j+s://4441767a.databases.neo4j.io"
    user = "neo4j"
    password = "***REMOVED***"
    return GraphDatabase.driver(uri, auth=(user, password))

driver = get_driver()

@st.cache_data
def load_relationship_weights():
    try:
        with open('/Users/bilalsuccar/Documents/microtools/common/BIMei_Ontology_Weights_v1_Backup_260103.json', 'r') as f:
            weights_data = json.load(f)
            return weights_data['edge_types']
    except Exception as e:
        st.error(f"❌ Could not load weights: {e}")
        return {
            "IS_PART_OF": 0.9,
            "RELATES_TO": 0.7,
            "DEFINES": 0.8,
            "CONTAINS": 0.6
        }

weights = load_relationship_weights()

# Helper functions (same as before)
def convert_natural_to_cypher(natural_text):
    text = natural_text.lower()
    
    if "connection between" in text or "relationship between" in text or "path between" in text:
        if "between" in text:
            after_between = text.split("between")[-1].strip()
            if " and " in after_between:
                term1, term2 = after_between.split(" and ", 1)
                term1 = term1.strip().strip("'\"")
                term2 = term2.strip().strip("'\"")
                
                return f"""
                MATCH (a), (b)
                WHERE (toLower(a.title) CONTAINS '{term1}' OR toLower(a.name) CONTAINS '{term1}') 
                AND (toLower(b.title) CONTAINS '{term2}' OR toLower(b.name) CONTAINS '{term2}')
                WITH a, b
                CALL apoc.algo.dijkstra(a, b, '', 'weight', 1.0) YIELD path, weight
                RETURN path ORDER BY weight DESC LIMIT 1
                """
    
    if "all content" in text or "show content" in text:
        return "MATCH (n)-[r]-(m) WHERE NOT 'Chunk' IN labels(n) AND NOT 'Chunk' IN labels(m) RETURN n, r, m"
    
    elif "relationships" in text or "connections" in text:
        return "MATCH (n)-[r]-(m) WHERE NOT 'Chunk' IN labels(n) AND NOT 'Chunk' IN labels(m) RETURN n, r, m"
    
    elif "categories" in text or "types" in text:
        return "MATCH (n) WHERE NOT 'Chunk' IN labels(n) RETURN DISTINCT labels(n) as category, count(n) as count ORDER BY count DESC"
    
    elif "random" in text or "sample" in text:
        return "MATCH (n)-[r]-(m) WHERE NOT 'Chunk' IN labels(n) AND NOT 'Chunk' IN labels(m) RETURN n, r, m ORDER BY rand() LIMIT 20"
    
    search_terms = [word for word in text.split() if len(word) > 2 and word not in ['show', 'me', 'the', 'all', 'content', 'with', 'about']]
    if search_terms:
        term = search_terms[0]
        return f"""
        MATCH (n)-[r]-(m) 
        WHERE NOT 'Chunk' IN labels(n) AND NOT 'Chunk' IN labels(m)
        AND (toLower(n.title) CONTAINS '{term}' OR toLower(n.name) CONTAINS '{term}' 
             OR toLower(m.title) CONTAINS '{term}' OR toLower(m.name) CONTAINS '{term}')
        RETURN n, r, m
        """
    
    return "MATCH (n)-[r]-(m) WHERE NOT 'Chunk' IN labels(n) AND NOT 'Chunk' IN labels(m) RETURN n, r, m LIMIT 20"

def get_node_color(labels):
    colors = {
        'Content': '#3498db',
        'Topic': '#e74c3c', 
        'Person': '#2ecc71',
        'Organization': '#f39c12',
        'Concept': '#9b59b6'
    }
    if labels:
        return colors.get(labels[0], '#95a5a6')
    return '#95a5a6'

def run_cypher_query(query, limit=50):
    try:
        with driver.session() as session:
            result = session.run(f"{query} LIMIT {limit}")
            
            nodes = {}
            edges = []
            
            for record in result:
                for key, value in record.items():
                    if hasattr(value, 'labels'):
                        node_id = value.element_id
                        if node_id not in nodes:
                            title = value.get('title') or value.get('name') or value.get('label') or value.get('description') or list(value.labels)[0] if value.labels else f"Node {node_id[-8:]}"
                            nodes[node_id] = {
                                'id': node_id,
                                'label': title[:40] + "..." if len(title) > 40 else title,
                                'full_label': title,
                                'labels': list(value.labels),
                                'properties': dict(value),
                                'size': 25,
                                'color': get_node_color(list(value.labels))
                            }
                    
                    elif hasattr(value, 'type'):
                        start_node = value.start_node
                        end_node = value.end_node
                        
                        for node in [start_node, end_node]:
                            node_id = node.element_id
                            if node_id not in nodes:
                                title = node.get('title') or node.get('name') or node.get('label') or node.get('description') or (list(node.labels)[0] if node.labels else f"Node {node_id[-8:]}")
                                nodes[node_id] = {
                                    'id': node_id,
                                    'label': title[:40] + "..." if len(title) > 40 else title,
                                    'full_label': title,
                                    'labels': list(node.labels),
                                    'properties': dict(node),
                                    'size': 25,
                                    'color': get_node_color(list(node.labels))
                                }
                        
                        edges.append({
                            'source': start_node.element_id,
                            'target': end_node.element_id,
                            'label': value.type,
                            'properties': dict(value)
                        })
                    
                    elif hasattr(value, '__iter__') and not isinstance(value, str):
                        try:
                            for item in value:
                                if hasattr(item, 'labels'):
                                    node_id = item.element_id
                                    if node_id not in nodes:
                                        title = item.get('title') or item.get('name') or item.get('label') or item.get('description') or (list(item.labels)[0] if item.labels else f"Node {node_id[-8:]}")
                                        nodes[node_id] = {
                                            'id': node_id,
                                            'label': title[:40] + "..." if len(title) > 40 else title,
                                            'full_label': title,
                                            'labels': list(item.labels),
                                            'properties': dict(item),
                                            'size': 25,
                                            'color': get_node_color(list(item.labels))
                                        }
                                elif hasattr(item, 'type'):
                                    start_node = item.start_node
                                    end_node = item.end_node
                                    
                                    for node in [start_node, end_node]:
                                        node_id = node.element_id
                                        if node_id not in nodes:
                                            title = node.get('title') or node.get('name') or node.get('label') or node.get('description') or (list(node.labels)[0] if node.labels else f"Node {node_id[-8:]}")
                                            nodes[node_id] = {
                                                'id': node_id,
                                                'label': title[:40] + "..." if len(title) > 40 else title,
                                                'full_label': title,
                                                'labels': list(node.labels),
                                                'properties': dict(node),
                                                'size': 25,
                                                'color': get_node_color(list(node.labels))
                                            }
                                    
                                    edges.append({
                                        'source': start_node.element_id,
                                        'target': end_node.element_id,
                                        'label': item.type,
                                        'properties': dict(item)
                                    })
                        except:
                            pass
            
            return {'nodes': list(nodes.values()), 'edges': edges}, None
            
    except Exception as e:
        return None, str(e)

# Initialize session state
if 'current_data' not in st.session_state:
    st.session_state.current_data = {'nodes': [], 'edges': []}
if 'selected_node' not in st.session_state:
    st.session_state.selected_node = None
if 'show_cypher' not in st.session_state:
    st.session_state.show_cypher = False

# Input Section - Horizontal Layout
st.markdown('<div class="input-section">', unsafe_allow_html=True)

col1, col2, col3 = st.columns([4, 1, 1])

with col1:
    natural_query = st.text_input(
        "Ask in plain English:",
        placeholder="e.g., 'Show me the connection between Adaptive Capacity and Process Maturity'",
        key="natural_input"
    )

with col2:
    limit = st.number_input("Limit", min_value=5, max_value=100, value=10, step=5)

with col3:
    st.write("")  # Spacing
    run_query = st.button("▶️ Run Query", type="primary", use_container_width=True)

st.markdown('</div>', unsafe_allow_html=True)

# Process query
if run_query and natural_query.strip():
    cypher_query = convert_natural_to_cypher(natural_query)
    st.session_state.show_cypher = True
    
    # Show generated Cypher
    st.markdown(f"""
    <div class="cypher-display">
        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.5rem;">Generated Cypher ></div>
        <code>{cypher_query}</code>
    </div>
    """, unsafe_allow_html=True)
    
    # Run query
    with st.spinner("Running query..."):
        data, error = run_cypher_query(cypher_query, limit)
        if error:
            st.error(f"Query error: {error}")
        else:
            st.session_state.current_data = data
            st.success(f"✅ Found {len(data['nodes'])} nodes and {len(data['edges'])} relationships")

# Main content area
col1, col2 = st.columns([3, 1])

with col1:
    # Graph controls overlay
    with st.container():
        subcol1, subcol2, subcol3, subcol4 = st.columns([1, 1, 1, 1])
        with subcol1:
            layout_type = st.selectbox("Layout", ["Compact", "Normal", "Spread Out"], index=1, key="layout")
        with subcol2:
            physics_enabled = st.checkbox("Physics", value=False)
        with subcol3:
            if st.button("🔄 Reset"):
                st.rerun()
        with subcol4:
            st.write("")  # Spacing
    
    # Graph visualization
    if st.session_state.current_data['nodes']:
        node_distance = {"Compact": 100, "Normal": 200, "Spread Out": 350}[layout_type]
        
        vis_nodes = []
        for node in st.session_state.current_data['nodes']:
            if 'Chunk' in node['labels']:
                continue
            
            node_size = node['size']
            if st.session_state.selected_node and node['id'] == st.session_state.selected_node['id']:
                node_size = int(node['size'] * 1.3)
                
            vis_nodes.append(Node(
                id=node['id'],
                label=node['label'],
                title=node['full_label'],
                size=node_size,
                color=node['color']
            ))
        
        vis_edges = []
        for edge in st.session_state.current_data['edges']:
            source_node = next((n for n in st.session_state.current_data['nodes'] if n['id'] == edge['source']), None)
            target_node = next((n for n in st.session_state.current_data['nodes'] if n['id'] == edge['target']), None)
            
            if (source_node and 'Chunk' in source_node['labels']) or (target_node and 'Chunk' in target_node['labels']):
                continue
            
            rel_type = edge['label']
            weight = weights.get(rel_type, 0.5)
            line_width = max(2, int(weight * 6))
            
            vis_edges.append(Edge(
                source=edge['source'],
                target=edge['target'],
                label=f"{edge['label']} ({weight:.1f})",
                width=line_width
            ))
        
        config = Config(
            width=800,
            height=500,
            directed=True,
            physics=physics_enabled,
            hierarchical=False,
            nodeHighlightBehavior=True,
            highlightColor="#f37f73",
            collapsible=False,
            node={'font': {'size': 17, 'face': 'Roboto', 'strokeWidth': 2}},
            edge={'font': {'size': 12, 'face': 'Roboto', 'strokeWidth': 0}, 'length': node_distance},
            interaction={'dragNodes': True, 'dragView': True, 'zoomView': True}
        )
        
        selected = agraph(nodes=vis_nodes, edges=vis_edges, config=config)
        
        if selected:
            selected_node_data = next((node for node in st.session_state.current_data['nodes'] if node['id'] == selected), None)
            if selected_node_data:
                st.session_state.selected_node = selected_node_data
    
    else:
        st.info("👆 Enter a query and press Run to visualize the graph")

# Node Details Panel
with col2:
    if st.session_state.selected_node:
        node = st.session_state.selected_node
        
        st.markdown(f"""
        <div class="node-details">
            <h3 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1.25rem; font-weight: 600;">
                {node['full_label']}
            </h3>
            <div class="status-badge">
                :{', '.join(node['labels'])}
            </div>
            
            <div class="property-grid">
                <div class="property-key">ID:</div>
                <div class="property-value" style="font-family: monospace;">{node['id'][-12:]}</div>
        """, unsafe_allow_html=True)
        
        # Display properties
        props = node['properties']
        for key, value in list(props.items())[:8]:  # Limit to first 8 properties
            if key in ['title', 'name', 'description']:
                st.markdown(f"""
                <div class="property-key">{key.title()}:</div>
                <div class="property-value"><strong>{str(value)[:100]}{'...' if len(str(value)) > 100 else ''}</strong></div>
                """, unsafe_allow_html=True)
            elif key in ['link', 'source_url']:
                st.markdown(f"""
                <div class="property-key">{key.title()}:</div>
                <div class="property-value"><a href="{value}" target="_blank">🔗 Link</a></div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="property-key">{key}:</div>
                <div class="property-value">{str(value)[:50]}{'...' if len(str(value)) > 50 else ''}</div>
                """, unsafe_allow_html=True)
        
        st.markdown('</div></div>', unsafe_allow_html=True)
        
        # Expand button
        if st.button("🔍 Expand Node", use_container_width=True):
            expand_query = f"MATCH (n)-[r]-(m) WHERE elementId(n) = '{node['id']}' RETURN n, r, m"
            with st.spinner("Expanding node..."):
                data, error = run_cypher_query(expand_query, 50)
                if not error:
                    st.session_state.current_data = data
                    st.rerun()
    
    else:
        st.markdown("""
        <div class="node-details">
            <h3 style="margin: 0 0 1rem 0; color: #64748b; font-size: 1rem;">Node Details</h3>
            <p style="color: #64748b; font-style: italic; text-align: center; margin-top: 2rem;">
                Select a node in the graph to view its properties
            </p>
        </div>
        """, unsafe_allow_html=True)

# Quick start buttons at bottom
st.markdown("---")
st.markdown("**Quick Start:**")
col1, col2, col3, col4 = st.columns(4)
with col1:
    if st.button("🏠 All Content", use_container_width=True):
        st.session_state.natural_input = "show all content"
        st.rerun()
with col2:
    if st.button("🔗 Relationships", use_container_width=True):
        st.session_state.natural_input = "show relationships"
        st.rerun()
with col3:
    if st.button("📊 Random Sample", use_container_width=True):
        st.session_state.natural_input = "show random content"
        st.rerun()
with col4:
    if st.button("🏷️ Categories", use_container_width=True):
        st.session_state.natural_input = "show categories"
        st.rerun()