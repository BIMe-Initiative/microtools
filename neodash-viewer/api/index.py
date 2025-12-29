from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
from langchain_community.graphs import Neo4jGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain

app = Flask(__name__)
CORS(app)

graph = Neo4jGraph(
    url=os.environ.get("NEO4J_URI"),
    username=os.environ.get("NEO4J_USER"),
    password=os.environ.get("NEO4J_PASSWORD")
)

@app.route('/ask', methods=['POST'])
def ask_graph():
    try:
        data = request.json
        question = data.get('question')

        # 1. Ask the AI (Generate Cypher + Answer)
        chain = GraphCypherQAChain.from_llm(
            ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.environ.get("GOOGLE_API_KEY")),
            graph=graph,
            verbose=True,
            return_intermediate_steps=True,
            allow_dangerous_requests=True
        )

        result = chain.invoke(question)
        answer_text = result["result"]
        generated_cypher = result["intermediate_steps"][0]["query"]
        
        # 2. SMART VIZ: Rewrite the query to fetch ALL nodes/edges for the graph view
        # We replace "RETURN ..." with "RETURN *" to get the actual objects
        # e.g. "MATCH (n) RETURN n.name" becomes "MATCH (n) RETURN *"
        viz_query = re.sub(r"RETURN\s+.*", "RETURN * LIMIT 50", generated_cypher, flags=re.IGNORECASE | re.DOTALL)
        
        print(f"Original Cypher: {generated_cypher}")
        print(f"Visual Cypher:   {viz_query}")

        raw_data = graph.query(viz_query)
        
        # 3. Format for Frontend
        viz_data = {"nodes": [], "edges": []}
        seen_nodes = set()
        seen_edges = set()

        for record in raw_data:
            for key, value in record.items():
                # Process Nodes
                if hasattr(value, 'id') and hasattr(value, 'labels'):
                    if value.id not in seen_nodes:
                        viz_data["nodes"].append({
                            "id": value.id,
                            "label": list(value.labels)[0] if value.labels else "Node",
                            "title": str(dict(value)), # Tooltip
                            "value": dict(value).get('name', 'Node') # Caption
                        })
                        seen_nodes.add(value.id)
                
                # Process Relationships
                elif hasattr(value, 'start_node') and hasattr(value, 'end_node'):
                     if value.id not in seen_edges:
                        viz_data["edges"].append({
                            "from": value.start_node.id,
                            "to": value.end_node.id,
                            "label": value.type
                        })
                        seen_edges.add(value.id)

        return jsonify({
            "answer": answer_text,
            "cypher": generated_cypher,
            "visual": viz_data
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500