from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
# Standard Neo4j Driver Import
from neo4j import GraphDatabase
from langchain_community.graphs import Neo4jGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain

app = Flask(__name__)
CORS(app)

# Environment Variables
URI = os.environ.get("NEO4J_URI")
USER = os.environ.get("NEO4J_USER")
PASSWORD = os.environ.get("NEO4J_PASSWORD")
GOOGLE_KEY = os.environ.get("GOOGLE_API_KEY")

# 1. LangChain Graph (For the AI reasoning)
graph = Neo4jGraph(url=URI, username=USER, password=PASSWORD)

@app.route('/ask', methods=['POST'])
def ask_graph():
    driver = None
    try:
        data = request.json
        question = data.get('question')

        # --- A. AI GENERATION PHASE ---
        chain = GraphCypherQAChain.from_llm(
            ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=GOOGLE_KEY),
            graph=graph,
            verbose=True,
            return_intermediate_steps=True,
            allow_dangerous_requests=True
        )

        result = chain.invoke(question)
        answer_text = result["result"]
        generated_cypher = result["intermediate_steps"][0]["query"]
        
        # --- B. VISUALIZATION PHASE (Direct Driver) ---
        # Rewrite query to ensure we get everything (RETURN *)
        viz_query = re.sub(r"RETURN\s+.*", "RETURN * LIMIT 50", generated_cypher, flags=re.IGNORECASE | re.DOTALL)
        
        viz_data = {"nodes": [], "edges": []}
        
        # Open a fresh, direct connection for just this part
        driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
        
        with driver.session() as session:
            result = session.run(viz_query)
            
            seen_nodes = set()
            seen_edges = set()

            for record in result:
                # We iterate over every column returned (n, r, m, etc.)
                for key, entity in record.items():
                    
                    # 1. Handle Nodes
                    if hasattr(entity, 'labels') and hasattr(entity, 'element_id'):
                        # Use element_id (Neo4j 5+) or fallback to id
                        node_id = getattr(entity, 'element_id', str(entity.id))
                        
                        if node_id not in seen_nodes:
                            # Try to find a good label for the bubble
                            props = dict(entity.items())
                            # Hierarchy of captions: name > title > id
                            caption = props.get('name') or props.get('title') or list(entity.labels)[0]
                            
                            viz_data["nodes"].append({
                                "id": node_id,
                                "label": str(caption), 
                                "group": list(entity.labels)[0],
                                "title": str(props) # Tooltip
                            })
                            seen_nodes.add(node_id)

                    # 2. Handle Relationships
                    elif hasattr(entity, 'start_node') and hasattr(entity, 'end_node'):
                        rel_id = getattr(entity, 'element_id', str(entity.id))
                        
                        if rel_id not in seen_edges:
                            # We need IDs of start/end nodes to draw the line
                            start_node = entity.start_node
                            end_node = entity.end_node
                            start_id = getattr(start_node, 'element_id', str(start_node.id))
                            end_id = getattr(end_node, 'element_id', str(end_node.id))

                            viz_data["edges"].append({
                                "from": start_id,
                                "to": end_id,
                                "label": entity.type
                            })
                            seen_edges.add(rel_id)
        
        # Close driver safely
        driver.close()

        return jsonify({
            "answer": answer_text,
            "cypher": generated_cypher,
            "visual": viz_data
        })

    except Exception as e:
        if driver: driver.close()
        print(f"Error: {str(e)}")
        # Return the error in JSON so the Frontend Debugger sees it
        return jsonify({"error": str(e), "answer": "Error processing request."}), 500

if __name__ == '__main__':
    app.run(debug=True)