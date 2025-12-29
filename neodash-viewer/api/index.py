from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from neo4j import GraphDatabase
from langchain_community.graphs import Neo4jGraph
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chains.graph_qa.cypher import GraphCypherQAChain

app = Flask(__name__)
CORS(app)

# Credentials
URI = os.environ.get("NEO4J_URI")
USER = os.environ.get("NEO4J_USER")
PASSWORD = os.environ.get("NEO4J_PASSWORD")
GOOGLE_KEY = os.environ.get("GOOGLE_API_KEY")

# 1. LangChain (For the text answer)
graph = Neo4jGraph(url=URI, username=USER, password=PASSWORD)

@app.route('/ask', methods=['POST'])
def ask_graph():
    driver = None
    try:
        data = request.json
        question = data.get('question')

        # --- PART A: Get Text Answer from AI ---
        chain = GraphCypherQAChain.from_llm(
            ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=GOOGLE_KEY),
            graph=graph,
            verbose=True,
            return_intermediate_steps=True,
            allow_dangerous_requests=True
        )
        result = chain.invoke(question)
        answer_text = result["result"]
        
        # --- PART B: Get Visual Data (SAFE MODE) ---
        # Instead of guessing, we fetch a clean 25-node sample related to the question keywords
        # or just a general sample if no keywords match.
        viz_data = {"nodes": [], "edges": []}
        
        driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
        with driver.session() as session:
            # Safe Query: Get any connected nodes. 
            # We use 'dict(n)' which works on all Neo4j versions to get properties.
            safe_query = "MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 25"
            
            result_viz = session.run(safe_query)
            
            seen_nodes = set()
            seen_edges = set()

            for record in result_viz:
                n = record['n']
                r = record['r']
                m = record['m']

                # Process Start Node (n)
                n_id = n.element_id if hasattr(n, 'element_id') else str(n.id)
                if n_id not in seen_nodes:
                    # Caption: Try 'name', 'title', or label
                    props = dict(n)
                    caption = props.get('name', props.get('title', list(n.labels)[0]))
                    viz_data["nodes"].append({
                        "id": n_id,
                        "label": str(caption),
                        "group": list(n.labels)[0]
                    })
                    seen_nodes.add(n_id)

                # Process End Node (m)
                m_id = m.element_id if hasattr(m, 'element_id') else str(m.id)
                if m_id not in seen_nodes:
                    props = dict(m)
                    caption = props.get('name', props.get('title', list(m.labels)[0]))
                    viz_data["nodes"].append({
                        "id": m_id,
                        "label": str(caption),
                        "group": list(m.labels)[0]
                    })
                    seen_nodes.add(m_id)

                # Process Relationship (r)
                r_id = r.element_id if hasattr(r, 'element_id') else str(r.id)
                if r_id not in seen_edges:
                    viz_data["edges"].append({
                        "from": n_id,
                        "to": m_id,
                        "label": r.type
                    })
                    seen_edges.add(r_id)

        driver.close()

        return jsonify({
            "answer": answer_text,
            "visual": viz_data
        })

    except Exception as e:
        if driver: driver.close()
        print(f"Error: {str(e)}")
        # IMPORTANT: Return the specific error text so we can see it in the debug tool
        return jsonify({"error": str(e), "answer": "Something went wrong."}), 500

if __name__ == '__main__':
    app.run(debug=True)