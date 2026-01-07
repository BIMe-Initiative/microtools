const { Neo4jGraph } = require("@langchain/community/graphs/neo4j_graph");
const { ChatVertexAI } = require("@langchain/google-vertexai");
const { GraphCypherQAChain } = require("@langchain/community/chains/graph_qa/cypher");
const { PromptTemplate } = require("@langchain/core/prompts");

// --- CONFIGURATION ---
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;

exports.graphQuery = async (req, res) => {
  // 1. CORS Headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const question = req.body.query || req.query.query;
  
  if (!question) {
    res.status(400).send({ error: "Missing 'query' parameter." });
    return;
  }

  let graph = null;

  try {
    console.log(`🔍 Received Query: "${question}"`);

    // 2. Initialize Graph
    graph = await Neo4jGraph.initialize({
      url: NEO4J_URI,
      username: NEO4J_USERNAME,
      password: NEO4J_PASSWORD,
    });

    const model = new ChatVertexAI({
      model: "gemini-2.5-pro",
      temperature: 0,
    });

    // 3. Strict Prompt
    const template = `
      Task: Generate a Cypher statement to query the graph.
      
      Ontology:
      - Nodes: Construct (Concepts), ActionStatement (Skills), Content (Source).
      - Relationships: 
         (:Construct)-[:IS_COMPOSED_OF]->(:Construct)
         (:Construct)-[:EXPRESSED_AS]->(:Construct)
         (:Content)-[:CONTAINS]->(:ActionStatement)

      CYPHER RULES:
      1. Do NOT use markdown formatting (no \`\`\` code blocks). Just output the raw query.
      2. NO 'ILIKE'. Use toLower(n.name) CONTAINS toLower('value').
      3. NO 'UNION'. Single MATCH queries only.
      
      Schema:
      {schema}

      Question: {question}
      Cypher Query:
    `;

    const prompt = PromptTemplate.fromTemplate(template);

    // 4. Run Chain
    const chain = GraphCypherQAChain.fromLLM({
      llm: model,
      graph: graph,
      cypherPrompt: prompt,
      verbose: true,
      returnDirect: false, // We want the plain text answer
      topK: 50,
    });

    // 5. Execute
    // Note: We don't need to manually strip markdown here because strict prompts usually fix it,
    // but if it persists, we can intercept the intermediate step. 
    // For now, the prompt instruction "Do NOT use markdown" is usually sufficient for Gemini.
    const response = await chain.invoke({ query: question });
    
    // 6. Cleanup & Send
    await graph.close();

    res.status(200).send({ 
      answer: response.result,
      source: "BIMei Knowledge Graph"
    });

  } catch (error) {
    console.error("❌ API Error:", error);
    if (graph) await graph.close(); // Ensure connection closes on error
    res.status(500).send({ 
      error: "Internal Server Error", 
      details: error.message 
    });
  }
};