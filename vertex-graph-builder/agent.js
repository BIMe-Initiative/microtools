import "dotenv/config";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
import { PromptTemplate } from "@langchain/core/prompts";

async function main() {
  console.log("🤖 Waking up BIMei Graph Agent (Logic Mode)...");

  const graph = await Neo4jGraph.initialize({
    url: process.env.NEO4J_URI,
    username: process.env.NEO4J_USERNAME,
    password: process.env.NEO4J_PASSWORD,
  });

  const model = new ChatVertexAI({
    model: "gemini-2.5-pro", 
    temperature: 0,
    maxOutputTokens: 2048,
  });

  // --- THE LOGICAL CHEAT SHEET ---
  const template = `
    Task: Generate a Cypher statement to query the graph based on strict logic.
    
    Ontology:
    1. Nodes: 'Construct' (Concepts), 'ActionStatement' (Skills), 'Content'.
    2. Relationships: 
       - (:Construct)-[:IS_COMPOSED_OF]->(:Construct)  (Components)
       - (:Construct)-[:EXPRESSED_AS]->(:Construct)    (Expressions: Ability, Activity, Outcome)
       - (:Content)-[:CONTAINS]->(:ActionStatement)

    CYPHER RULES:
    1. **NO 'ILIKE'**: Use toLower(n.name) CONTAINS toLower('value').
    2. **NO 'UNION'**: Single MATCH queries only.
    3. **QUALITY FILTER**: When listing 'ActionStatement' nodes, ensure they are meaningful. 
       - Rule: name must be at least 3 words long (size(split(n.name, " ")) >= 3).
    
    Query Strategies:
    - "Components of X": MATCH (p:Construct)-[:IS_COMPOSED_OF]->(child) WHERE toLower(p.name) CONTAINS toLower($name) RETURN child.name
    - "List Action Statements": MATCH (a:ActionStatement) WHERE size(split(a.name, " ")) >= 3 RETURN a.name LIMIT 5

    Schema:
    {schema}

    Question: {question}
    Cypher Query:
  `;

  const prompt = PromptTemplate.fromTemplate(template);

  const chain = GraphCypherQAChain.fromLLM({
    llm: model,
    graph: graph,
    cypherPrompt: prompt,
    verbose: true, 
    returnDirect: false, 
    topK: 50,
  });

  const questions = [
    
    "What are the components of Competency?" 
    
  ];

  for (const q of questions) {
      console.log(`\n──────────────────────────────────────────`);
      console.log(`🤔 Asking: "${q}"`);
      try {
          const response = await chain.invoke({ query: q });
          console.log(`💡 Answer: ${response.result}`);
      } catch (error) {
          console.error("❌ Error:", error.message);
      }
  }

  await graph.close();
}

main();