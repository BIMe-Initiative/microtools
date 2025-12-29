import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_community.graphs import Neo4jGraph
from langchain.chains import GraphCypherQAChain
from langchain_google_genai import ChatGoogleGenerativeAI # <--- CHANGED

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["https://bimexcellence.org", "http://localhost:8000"]}})

@app.route('/', methods=['GET'])
def health_check():
    return "Graph AI (Gemini Edition) is running!", 200

@app.route('/ask', methods=['POST'])
def ask_graph():
    # 1. Get Secrets
    google_api_key = os.environ.get("GOOGLE_API_KEY") # <--- CHANGED
    neo4j_uri = os.environ.get("NEO4J_URI")
    neo4j_user = os.environ.get("NEO4J_USER")
    neo4j_password = os.environ.get("NEO4J_PASSWORD")

    if not google_api_key or not neo4j_password:
        return jsonify({"error": "Server misconfigured: Missing secrets"}), 500

    data = request.json
    question = data.get('question')
    
    if not question:
        return jsonify({"error": "No question provided"}), 400

    try:
        # 2. Connect to Neo4j
        graph = Neo4jGraph(url=neo4j_uri, username=neo4j_user, password=neo4j_password)
        
        # 3. Setup Gemini 2.5 Flash
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=google_api_key,
            temperature=0
        )
        
        # 4. Run Chain
        chain = GraphCypherQAChain.from_llm(
            llm=llm,
            graph=graph, 
            verbose=True,
            allow_dangerous_requests=True
        )
        
        response = chain.run(question)
        return jsonify({"answer": response})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500