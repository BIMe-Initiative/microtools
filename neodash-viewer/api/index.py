from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from langchain_community.graphs import Neo4jGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain

app = Flask(__name__)
CORS(app)

# 1. Connect to Neo4j
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

        # 2. Setup the Chain with "return_intermediate_steps" to get the data
        chain = GraphCypherQAChain.from_llm(
            ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=os.environ.get("GOOGLE_API_KEY")),
            graph=graph,
            verbose=True,
            return_intermediate_steps=True, # This lets us see the Cypher query
            allow_dangerous_requests=True
        )

        # 3. Run the Question
        result = chain.invoke(question)
        
        answer_text = result["result"]
        generated_cypher = result["intermediate_steps"][0]["query"]
        
        # 4. Fetch the actual graph data for visualization
        # We run the generated Cypher again to get the nodes/edges
        raw_data = graph.query(generated_cypher)
        
        # 5. Format for Visualization (Simple Node/Edge list)
        viz_data = {"nodes": [], "edges": []}
        seen_nodes = set()
        
        # Basic parser to extract nodes/relationships from the result
        # (This handles simple returns like "MATCH (n)-[r]->(m) RETURN n,r,m")
        for record in raw_data:
            for key, value in record.items():
                # If it's a Node (has labels and id)
                if hasattr(value, 'id') and hasattr(value, 'labels'):
                    if value.id not in seen_nodes:
                        viz_data["nodes"].append({
                            "id": value.id,
                            "label": list(value.labels)[0] if value.labels else "Node",
                            "props": dict(value)
                        })
                        seen_nodes.add(value.id)
                # If it's a Relationship (has start/end nodes)
                elif hasattr(value, 'start_node') and hasattr(value, 'end_node'):
                     viz_data["edges"].append({
                        "from": value.start_node.id,
                        "to": value.end_node.id,
                        "label": value.type
                    })

        return jsonify({
            "answer": answer_text,
            "cypher": generated_cypher,
            "visual": viz_data
        })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)