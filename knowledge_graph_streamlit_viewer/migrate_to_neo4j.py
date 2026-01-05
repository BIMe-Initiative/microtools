#!/usr/bin/env python3
"""
Migration script to import JSON graph data into Neo4j
Run this once to migrate your existing data from JSON files to Neo4j
"""

import json
import os
from neo4j import GraphDatabase

def load_json_data():
    """Load data from JSON files"""
    base = os.path.dirname(os.path.abspath(__file__))
    
    onto_data = {"nodes": [], "edges": []}
    onto_path = os.path.join(base, "ontology_graph.json")
    if os.path.exists(onto_path):
        with open(onto_path, "r") as f:
            onto_data = json.load(f)
    
    lib_data = {"nodes": [], "edges": []}
    lib_path = os.path.join(base, "library_graph.json")
    if os.path.exists(lib_path):
        with open(lib_path, "r") as f:
            lib_data = json.load(f)
    
    return onto_data, lib_data

def migrate_to_neo4j(uri, user, password):
    """Migrate JSON data to Neo4j"""
    driver = GraphDatabase.driver(uri, auth=(user, password))
    
    try:
        onto_data, lib_data = load_json_data()
        
        with driver.session() as session:
            # Clear existing data
            print("Clearing existing data...")
            session.run("MATCH (n) DETACH DELETE n")
            
            # Create nodes from ontology data
            print("Creating ontology nodes...")
            for node in onto_data.get("nodes", []):
                session.run("""
                    CREATE (n {
                        id: $id,
                        label: $label,
                        type: $type,
                        desc: $desc,
                        size: $size,
                        shape: $shape,
                        color: $color
                    })
                """, 
                id=node.get("id"),
                label=node.get("label", node.get("id")),
                type=node.get("type", "Unknown"),
                desc=node.get("desc", ""),
                size=node.get("size", 20),
                shape=node.get("shape", "dot"),
                color=node.get("color", "#888")
                )
            
            # Create nodes from library data
            print("Creating library nodes...")
            for node in lib_data.get("nodes", []):
                # Check if node already exists
                result = session.run("MATCH (n {id: $id}) RETURN n", id=node.get("id"))
                if not result.single():
                    session.run("""
                        CREATE (n {
                            id: $id,
                            label: $label,
                            type: $type,
                            desc: $desc,
                            size: $size,
                            shape: $shape,
                            color: $color
                        })
                    """, 
                    id=node.get("id"),
                    label=node.get("label", node.get("id")),
                    type=node.get("type", "Unknown"),
                    desc=node.get("desc", ""),
                    size=node.get("size", 20),
                    shape=node.get("shape", "dot"),
                    color=node.get("color", "#888")
                    )
            
            # Create relationships from ontology data
            print("Creating ontology relationships...")
            for edge in onto_data.get("edges", []):
                rel_type = edge.get("label", "RELATED").replace(" ", "_").upper()
                session.run(f"""
                    MATCH (a {{id: $source}}), (b {{id: $target}})
                    CREATE (a)-[:{rel_type}]->(b)
                """, source=edge.get("source"), target=edge.get("target"))
            
            # Create relationships from library data
            print("Creating library relationships...")
            for edge in lib_data.get("edges", []):
                rel_type = edge.get("label", "RELATED").replace(" ", "_").upper()
                session.run(f"""
                    MATCH (a {{id: $source}}), (b {{id: $target}})
                    CREATE (a)-[:{rel_type}]->(b)
                """, source=edge.get("source"), target=edge.get("target"))
            
            print("Migration completed successfully!")
            
            # Print summary
            node_count = session.run("MATCH (n) RETURN count(n) as count").single()["count"]
            rel_count = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()["count"]
            print(f"Created {node_count} nodes and {rel_count} relationships")
            
    finally:
        driver.close()

if __name__ == "__main__":
    # Configuration - update these values
    NEO4J_URI = "bolt://localhost:7687"
    NEO4J_USER = "neo4j"
    NEO4J_PASSWORD = "password"  # Change this to your Neo4j password
    
    print("Starting migration from JSON to Neo4j...")
    print(f"Connecting to {NEO4J_URI} as {NEO4J_USER}")
    
    try:
        migrate_to_neo4j(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)
    except Exception as e:
        print(f"Migration failed: {e}")
        print("Make sure Neo4j is running and credentials are correct")