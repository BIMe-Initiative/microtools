import "dotenv/config";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatVertexAI } from "@langchain/google-vertexai";

async function main() {
  console.log("------------------------------------------------");
  console.log("🚀 Starting GraphRAG Connectivity Test...");
  console.log("------------------------------------------------");

  // 1. Check Vertex AI Connection
  try {
    console.log("📡 Testing Vertex AI (Gemini) connection...");
    const model = new ChatVertexAI({
      model: "gemini-2.5-pro",
      temperature: 0,
    });
    // Simple hello world to the LLM
    const res = await model.invoke("Hello, are you ready to build a graph?");
    console.log(`✅ Vertex AI Responded: "${res.content.slice(0, 50)}..."`);
  } catch (err) {
    console.error("❌ Vertex AI Connection Failed:", err.message);
    process.exit(1);
  }

  // 2. Check Neo4j Connection
  try {
    console.log("------------------------------------------------");
    console.log("🔗 Testing Neo4j Database connection...");
    
    const graph = await Neo4jGraph.initialize({
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USERNAME,
      password: process.env.NEO4J_PASSWORD,
    });
    
    // Refresh schema to prove we can talk to the DB
    await graph.refreshSchema();
    console.log("✅ Neo4j Connected Successfully!");
    console.log("   Current Schema:", graph.getSchema() || "(Empty Graph)");
    
    await graph.close();
  } catch (err) {
    console.error("❌ Neo4j Connection Failed:", err.message);
    process.exit(1);
  }

  console.log("------------------------------------------------");
  console.log("🎉 SYSTEM CHECK PASSED: Ready to ingest data.");
  console.log("------------------------------------------------");
}

main();