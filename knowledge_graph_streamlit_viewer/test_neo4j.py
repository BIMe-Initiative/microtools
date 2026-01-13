import streamlit as st
from streamlit_agraph import agraph, Node, Edge, Config
from neo4j import GraphDatabase
import os

st.set_page_config(layout="wide", page_title="BIMei Explorer")
st.title("💠 BIMei Knowledge Ecosystem")

# Direct Neo4j connection
@st.cache_resource
def get_driver():
    uri = os.getenv("NEO4J_URI", "neo4j+s://your-instance.databases.neo4j.io")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not password:
        raise ValueError("NEO4J_PASSWORD environment variable is required")

    return GraphDatabase.driver(uri, auth=(user, password))

driver = get_driver()

# Test connection
try:
    with driver.session() as session:
        result = session.run("RETURN 'Connection successful' as message")
        record = result.single()
        st.success(f"✅ {record['message']}")
except Exception as e:
    st.error(f"❌ Connection failed: {e}")
    st.stop()

# Simple query to show nodes
with driver.session() as session:
    result = session.run("MATCH (n) RETURN n LIMIT 10")
    nodes = []
    for record in result:
        node = record["n"]
        nodes.append({
            "id": node.element_id,
            "labels": list(node.labels),
            "properties": dict(node)
        })

st.subheader("Sample Nodes from Your Database:")
for node in nodes:
    st.write(f"**ID:** {node['id']}")
    st.write(f"**Labels:** {node['labels']}")
    st.write(f"**Properties:** {node['properties']}")
    st.divider()

if not nodes:
    st.warning("No nodes found in the database. Your Neo4j database might be empty.")