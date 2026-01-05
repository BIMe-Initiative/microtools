from neo4j import GraphDatabase
import streamlit as st

class Neo4jClient:
    def __init__(self, uri, user, password):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
    
    def close(self):
        self.driver.close()
    
    def get_ontology_data(self, categories=None, search=""):
        query = """
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 100
        """
        
        with self.driver.session() as session:
            result = session.run(query)
            
            nodes = {}
            edges = []
            
            for record in result:
                node = record["n"]
                if node:
                    nodes[node.element_id] = {
                        "id": node.element_id,
                        "label": node.get("name", node.get("label", node.element_id)),
                        "type": list(node.labels)[0] if node.labels else "Unknown",
                        "desc": node.get("description", node.get("desc", "")),
                        "size": 20,
                        "shape": "dot",
                        "color": "#888"
                    }
                
                rel = record["r"]
                target = record["m"]
                if rel and target:
                    edges.append({
                        "source": node.element_id,
                        "target": target.element_id,
                        "label": rel.type
                    })
            
            return {"nodes": list(nodes.values()), "edges": edges}
    
    def get_library_data(self, focus_id=None, use_case="Everything"):
        if not focus_id:
            return {"nodes": [], "edges": []}
        
        query = """
        MATCH (focus)-[r]-(connected)
        WHERE elementId(focus) = $focus_id
        RETURN focus, r, connected
        LIMIT 50
        """
        
        with self.driver.session() as session:
            result = session.run(query, focus_id=focus_id)
            
            nodes = {}
            edges = []
            
            for record in result:
                for node_key in ["focus", "connected"]:
                    node = record[node_key]
                    if node and node.element_id not in nodes:
                        nodes[node.element_id] = {
                            "id": node.element_id,
                            "label": node.get("name", node.get("label", node.element_id)),
                            "type": list(node.labels)[0] if node.labels else "Unknown",
                            "desc": node.get("description", node.get("desc", "")),
                            "size": 30 if node.element_id == focus_id else 20,
                            "shape": "dot",
                            "color": "#888"
                        }
                
                rel = record["r"]
                if rel:
                    edges.append({
                        "source": record["focus"].element_id,
                        "target": record["connected"].element_id,
                        "label": rel.type
                    })
            
            return {"nodes": list(nodes.values()), "edges": edges}
    
    def get_all_categories(self):
        query = "MATCH (n) RETURN DISTINCT labels(n) as labels LIMIT 20"
        with self.driver.session() as session:
            result = session.run(query)
            categories = []
            for record in result:
                labels = record["labels"]
                if labels:
                    categories.extend(labels)
            return list(set(categories))
    
    def get_publications(self):
        query = "MATCH (n) RETURN elementId(n) as id, coalesce(n.name, n.label, elementId(n)) as label LIMIT 20"
        with self.driver.session() as session:
            result = session.run(query)
            return [(record["id"], record["label"]) for record in result]
    
    def get_topics(self):
        query = "MATCH (n) RETURN elementId(n) as id, coalesce(n.name, n.label, elementId(n)) as label LIMIT 20"
        with self.driver.session() as session:
            result = session.run(query)
            return [(record["id"], record["label"]) for record in result]

@st.cache_resource
def get_neo4j_client():
    # Try to get from secrets, with fallbacks
    try:
        uri = st.secrets["NEO4J_URI"]
        user = st.secrets["NEO4J_USERNAME"] 
        password = st.secrets["NEO4J_PASSWORD"]
        st.write(f"Connecting to: {uri}")  # Debug info
        return Neo4jClient(uri, user, password)
    except Exception as e:
        st.error(f"Failed to connect to Neo4j: {e}")
        st.error("Check your secrets configuration")
        st.stop()