// embed-chunks.js
import "dotenv/config";
import neo4j from "neo4j-driver";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";

const BATCH = Number(process.env.EMBED_BATCH || 100);
const LIMIT = Number(process.env.EMBED_LIMIT || 0); // 0 = no limit
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-004";
const CREATE_VECTOR_INDEX = String(process.env.CREATE_VECTOR_INDEX || "false").toLowerCase() === "true";

if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  console.error("❌ Missing Neo4j env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD");
  process.exit(1);
}

if (!Number.isFinite(BATCH) || BATCH <= 0) {
  console.error("❌ EMBED_BATCH must be a positive number.");
  process.exit(1);
}

if (!Number.isFinite(LIMIT) || LIMIT < 0) {
  console.error("❌ EMBED_LIMIT must be 0 or a positive number.");
  process.exit(1);
}

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

const embeddings = new VertexAIEmbeddings({ model: EMBEDDING_MODEL });

async function ensureVectorIndex(session, dims) {
  if (!CREATE_VECTOR_INDEX) return;
  if (!dims || !Number.isFinite(dims)) return;

  try {
    await session.run(
      `
      CREATE VECTOR INDEX chunk_embedding IF NOT EXISTS
      FOR (ch:Chunk) ON (ch.embedding)
      OPTIONS {
        indexConfig: {
          \`vector.dimensions\`: $dims,
          \`vector.similarity_function\`: 'cosine'
        }
      }
      `,
      { dims: neo4j.int(dims) }
    );
    console.log(`🧠 Vector index ensured (dims=${dims})`);
  } catch (e) {
    // Non-fatal: Neo4j versions can differ on VECTOR INDEX syntax
    console.warn(`⚠️ Vector index create failed (non-fatal): ${e.message}`);
  }
}

async function main() {
  const session = driver.session();

  try {
    let processed = 0;
    let dims = null;

    while (true) {
      // Fetch a batch of chunks without embeddings
      const res = await session.run(
        `
        MATCH (ch:Chunk)
        WHERE ch.embedding IS NULL
          AND ch.text IS NOT NULL
          AND size(ch.text) > 0
        RETURN ch.id AS id, ch.text AS text
        LIMIT $batch
        `,
        { batch: neo4j.int(BATCH) } // ✅ force integer
      );

      if (res.records.length === 0) break;

      for (const rec of res.records) {
        const id = rec.get("id");
        const text = String(rec.get("text") || "").trim();
        if (!text) continue;

        // Get embedding vector
        const vec = await embeddings.embedQuery(text);

        if (!dims) {
          dims = Array.isArray(vec) ? vec.length : null;
          if (dims) await ensureVectorIndex(session, dims);
        }

        // Write embedding back to Neo4j
        await session.run(
          `
          MATCH (ch:Chunk {id:$id})
          SET ch.embedding = $vec,
              ch.embeddingModel = $model,
              ch.embeddingAt = datetime()
          `,
          { id, vec, model: EMBEDDING_MODEL }
        );

        processed++;
        if (processed % 50 === 0) console.log(`✅ Embedded ${processed} chunks...`);

        if (LIMIT > 0 && processed >= LIMIT) {
          console.log(`✅ Stopped at EMBED_LIMIT=${LIMIT}`);
          return;
        }
      }
    }

    console.log(`🎉 Done. Embedded ${processed} chunks.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
