from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
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

# LangChain Graph
graph = Neo4jGraph(url=URI, username=USER, password=PASSWORD)

@app.route('/ask', methods=['POST'])
def ask_graph():
    driver = None
    try:
        data = request.json
        question = data.get('question')

        # 1. Generate Answer & Cypher
        chain = GraphCypherQAChain.from_llm(
            ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GOOGLE_KEY),
            graph=graph,
            verbose=True,
            return_intermediate_steps=True,
            allow_dangerous_requests=True
        )
        result = chain.invoke(question)
        answer_text = result["result"]
        generated_cypher = result["intermediate_steps"][0]["query"]
        
        # 2. Determine Visualization Strategy
        # If query is aggregating (counting), use Safe Mode. Otherwise, try Smart Mode.
        is_aggregation = any(x in generated_cypher.upper() for x in ["COUNT(", "SUM(", "AVG(", "MAX(", "MIN("])
        
        viz_query = ""
        if is_aggregation:
            # Safe Mode: Just get a nice sample of the graph
            viz_query = "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 25"
        else:
            # Smart Mode: Inject "RETURN *" to get the actual objects from the AI's query
            # We strip the original RETURN and replace it with RETURN *
            viz_query = re.sub(r"RETURN\s+.*", "RETURN * LIMIT 50", generated_cypher, flags=re.IGNORECASE | re.DOTALL)

        # 3. Fetch Visual Data
        viz_data = {"nodes": [], "edges": []}
        driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
        
        try:
            with driver.session() as session:
                result_viz = session.run(viz_query)
                
                seen_nodes = set()
                seen_edges = set()

                for record in result_viz:
                    for key, entity in record.items():
                        
                        # Nodes
                        if hasattr(entity, 'labels') and hasattr(entity, 'element_id'):
                            node_id = getattr(entity, 'element_id', str(entity.id))
                            if node_id not in seen_nodes:
                                props = dict(entity)
                                # Smart Caption: Name > Title > Label
                                caption = props.get('name') or props.get('title') or list(entity.labels)[0]
                                group = list(entity.labels)[0] if entity.labels else "Generic"
                                
                                viz_data["nodes"].append({
                                    "id": node_id,
                                    "label": str(caption)[:20] + "..." if len(str(caption)) > 20 else str(caption),
                                    "group": group,
                                    "title": str(props) # Tooltip
                                })
                                seen_nodes.add(node_id)

                        # Relationships
                        elif hasattr(entity, 'start_node') and hasattr(entity, 'end_node'):
                            rel_id = getattr(entity, 'element_id', str(entity.id))
                            if rel_id not in seen_edges:
                                start = getattr(entity.start_node, 'element_id', str(entity.start_node.id))
                                end = getattr(entity.end_node, 'element_id', str(entity.end_node.id))
                                
                                viz_data["edges"].append({
                                    "from": start,
                                    "to": end,
                                    "label": entity.type
                                })
                                seen_edges.add(rel_id)
        except Exception as e:
            print(f"Visual Fetch Failed: {e}")
            # If Smart Mode fails, we don't crash, we just return the text answer
            pass
            
        driver.close()

        return jsonify({
            "answer": answer_text,
            "visual": viz_data
        })

    except Exception as e:
        if driver: driver.close()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)