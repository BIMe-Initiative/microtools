/**
 * hybrid-crawler.js (regenerated)
 *
 * Supports BOTH queue formats:
 *  1) ["https://...","https://..."]  (string URLs)
 *  2) [{url_original,url_canonical,model,maxChunks,skip,category,attention,...}, ...] (policy objects)
 *
 * Internal (bimexcellence.org): deep extraction (gemini-2.5-pro by default)
 * External: light extraction (gemini-2.5-flash) + Resource nodes for outbound links
 *
 * Optional embeddings in Neo4j:
 *   EMBEDDINGS_ENABLED=true
 *   EMBEDDING_MODEL=text-embedding-004
 *   CREATE_VECTOR_INDEX=true
 */

import "dotenv/config";
import axios from "axios";
import fs from "fs";
import pdf from "pdf-parse/lib/pdf-parse.js";
import * as cheerio from "cheerio";
import neo4j from "neo4j-driver";
import crypto from "crypto";
import { ChatVertexAI, VertexAIEmbeddings } from "@langchain/google-vertexai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// ---------------- CONFIG ----------------
const QUEUE_FILE = process.env.QUEUE_FILE || "./queue_classified.json";
const LOG_FILE = process.env.LOG_FILE || "crawler_errors.log";
const CONCURRENCY = Number(process.env.CONCURRENCY || 8);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 60000);
const TEXT_CHUNK_SIZE = Number(process.env.TEXT_CHUNK_SIZE || 1400);

const INTERNAL_DOMAIN = (process.env.INTERNAL_DOMAIN || "bimexcellence.org").toLowerCase();

const MAX_EXTERNAL_PDF_CHUNKS = Number(process.env.MAX_EXTERNAL_PDF_CHUNKS || 12);
const MAX_INTERNAL_PDF_CHUNKS = Number(process.env.MAX_INTERNAL_PDF_CHUNKS || 60);

const EMBEDDINGS_ENABLED = String(process.env.EMBEDDINGS_ENABLED || "false").toLowerCase() === "true";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-004";
const CREATE_VECTOR_INDEX = String(process.env.CREATE_VECTOR_INDEX || "false").toLowerCase() === "true";

const STRICT_REL_WHITELIST = String(process.env.STRICT_REL_WHITELIST || "true").toLowerCase() === "true";
const VALIDATE_DOMAIN_RANGE = String(process.env.VALIDATE_DOMAIN_RANGE || "true").toLowerCase() === "true";

// --- SAFETY SETTINGS (as you prefer) ---
const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

// ---------------- INIT NEO4J ----------------
if (!process.env.NEO4J_URI || !process.env.NEO4J_USERNAME || !process.env.NEO4J_PASSWORD) {
  console.error("❌ Missing Neo4j env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD");
  process.exit(1);
}

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

// ---------------- INIT MODELS ----------------
const modelPro = new ChatVertexAI({
  model: "gemini-2.5-pro",
  temperature: 0,
  maxOutputTokens: 8192,
  safetySettings: SAFETY_SETTINGS,
});

const modelFlash = new ChatVertexAI({
  model: "gemini-2.5-flash",
  temperature: 0,
  maxOutputTokens: 4096,
  safetySettings: SAFETY_SETTINGS,
});

const embeddings = EMBEDDINGS_ENABLED ? new VertexAIEmbeddings({ model: EMBEDDING_MODEL }) : null;

// ---------------- HELPERS ----------------
function logError(line) {
  try {
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore
  }
}

function isInternalUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().endsWith(INTERNAL_DOMAIN);
  } catch {
    return false;
  }
}

function normalizeUrl(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s) return "";

  if (s.startsWith("//")) s = "https:" + s;

  // If it looks like a bare domain/path without scheme, attempt https
  if (!/^https?:\/\//i.test(s) && /^[a-z0-9.-]+\.[a-z]{2,}(\/*|\/)/i.test(s)) {
    s = "https://" + s;
  }

  try {
    const u = new URL(s);

    // force https for internal
    if (u.hostname.toLowerCase().endsWith(INTERNAL_DOMAIN)) {
      u.protocol = "https:";
    }

    u.hash = "";
    u.search = "";

    // Lowercase host + path to stabilise identity
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();

    // Remove trailing slash unless it's root
    const pathname = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

    return `https://${host}${pathname}`;
  } catch {
    // fallback simple cleanup
    s = s.split("#")[0].split("?")[0].trim();
    if (/^http:\/\//i.test(s)) s = s.replace(/^http:\/\//i, "https://");
    s = s.toLowerCase();
    if (s.endsWith("/") && !/^https:\/\/[^/]+\/$/.test(s)) s = s.slice(0, -1);
    return s;
  }
}

function hashUrl(url) {
  return crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 24);
}

function generateContentId(urlCanonical) {
  return `content_${hashUrl(urlCanonical)}`;
}

function generateChunkId(contentId, idx) {
  return `chunk_${contentId}_${idx}`;
}

function chunkText(text, chunkSize = TEXT_CHUNK_SIZE) {
  if (!text) return [];
  const clean = String(text).replace(/\u0000/g, "").trim();
  if (!clean) return [];
  const chunks = [];
  for (let i = 0; i < clean.length; i += chunkSize) {
    chunks.push(clean.slice(i, i + chunkSize));
  }
  return chunks;
}

function extractJsonObject(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}$/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

// ---------------- ONTOLOGY-LITE LABEL POLICY ----------------
const ALLOWED_LABELS = new Set([
  "Content",
  "Chunk",
  "Construct",
  "KnowledgeSet",
  "KnowledgeBlock",
  "KnowledgeFoundation",
  "KnowledgeTool",
  "KnowledgeWorkflow",
  "KnowledgeView",
  "ActionStatement",
  "InformationUse",
  "DictionaryItem",
  "DefinedRole",
  "LearningUnit",
  "AssessmentModule",
  "MeasurementDevice",
  "Actor",
  "Organisation",
  "Stakeholder",
  "Authority",
  "Role",
  "Process",
  "Activity",
  "Deliverable",
  "Rule",
  "Metric",
  "Ability",
  "Context",
  "Event",
  "Constraint",
  "Tool",
  "System",
  "Asset",
  "Resource",
]);

function safeLabel(type) {
  if (!type) return "Construct";
  const t = String(type).trim();
  return ALLOWED_LABELS.has(t) ? t : "Construct";
}

// ---------------- RELATION WHITELIST ----------------
const ALLOWED_REL_TYPES = new Set([
  // Canonical-ish + practical set
  "HAS_PART",
  "IS_PART_OF",
  "HAS_RESOURCE",
  "USES",
  "DEPENDS_ON",
  "CONSTRAINS",
  "PERFORMS",
  "PARTICIPATES_IN",
  "ACTS_AS",
  "MANAGES",
  "LEADS",
  "PRODUCES",
  "CONSUMES",
  "DELIVERS",
  "EXCHANGES",
  "PROVIDES",
  "DEFINES",
  "DOCUMENTS",
  "REPRESENTS",
  "REFERENCES",
  "CITES",
  "CONTAINS",
  "LINKS_TO",
  "ABOUT",
  "MEASURES",
  "EVALUATES",
  "VALIDATES",
  "VERIFIES",
  "ENABLES",
  "GOVERNS",
  "AUTHORISES",
  "SUBMITTED_TO",
  "SUBMITTED_BY",
  "APPROVED_BY",
  "REJECTED_BY",
  "ISSUED_FOR",
  "PUBLISHED_BY",
  "PUBLISHED_TO",
  "SPECIFIES_REQUIREMENT",
  "VALIDATES_AGAINST",
  "CONFORMS_TO",
  "MAPS_TO",
  "SAME_AS",
  "CLASSIFIES",
  "CLASSIFIED_AS",
  "ALIGNS_WITH",
  "DEFINES_PROPERTY",
  "GROUPS_PROPERTY",
  "CONSTRAINS_VALUE",
  "INSTANCE_OF",
  "TRANSITIONS_TO",
  "CURRENT_AT",
  // Specialised-ish
  "HAS_SECTION",
  "HAS_CHAPTER",
  "HAS_STEP",
  "DEFINES_TERM",
  "REPORTS_ON",
  "CLASSIFIES_AS",
  "REFERENCES_STANDARD",
  "MENTIONS",
  "USES_TOOL",
  "USES_INFORMATION",
  "USES_METHOD",
  "GOVERNS_PROCESS",
  "GOVERNS_SYSTEM",
  "AUTHORISES_ACTIVITY",
  "AUTHORISES_RELEASE",
  // Ingestion/chunking
  "HAS_CHUNK",
]);

function safeRelType(t) {
  if (!t) return null;
  const r = String(t).trim().toUpperCase();
  if (ALLOWED_REL_TYPES.has(r)) return r;

  if (!STRICT_REL_WHITELIST) {
    if (/^[A-Z][A-Z0-9_]{1,80}$/.test(r)) return r;
  }
  return null;
}

// Coarse domain–range blocks (only blocks obvious nonsense; unknown rels allowed if not listed)
const REL_DOMAIN_RANGE = new Map([
  ["HAS_CHUNK", [["Content", "Chunk"]]],
  ["CONTAINS", [["Content", "*"]]],
  ["MENTIONS", [["Content", "*"]]],
  ["LINKS_TO", [["Content", "Resource"], ["Content", "Content"], ["Content", "Construct"]]],
  ["CITES", [["Content", "Content"]]],
  ["REFERENCES", [["Content", "Content"], ["Content", "Resource"]]],
]);

function domainRangeOk(relType, sourceLabels, targetLabels) {
  if (!VALIDATE_DOMAIN_RANGE) return true;
  const rules = REL_DOMAIN_RANGE.get(relType);
  if (!rules) return true;

  const src = sourceLabels?.[0] || null;
  const dst = targetLabels?.[0] || null;

  for (const [a, b] of rules) {
    const srcOk = a === "*" || a === src;
    const dstOk = b === "*" || b === dst;
    if (srcOk && dstOk) return true;
  }
  return false;
}

// ---------------- PROMPTS ----------------
function systemPromptInternal(contentId, meta = {}) {
  const metaLine = `META: ${JSON.stringify(meta)}`;

  return `
You are the BIMei Knowledge Graph Engineer.

You MUST follow the BIMei ontology principles:
- Prefer specialised relations as explicit edge types where meaningful.
- Only use relation types from the allowed set (canonical + specialised).
- Do not invent labels or relationships.
- Extract conservatively: only what is supported by text.

CONTENT_ID: "${contentId}"
${metaLine}

Return ONLY valid JSON with this shape:
{
  "nodes": [
    {
      "id": "localId1",
      "type": "Construct|ActionStatement|Content|Actor|Role|Process|Activity|Deliverable|Rule|Metric|Ability|Context|Tool|System|Resource|InformationUse|DictionaryItem|DefinedRole|LearningUnit|AssessmentModule|MeasurementDevice",
      "properties": {
        "name": "...",
        "description": "...",
        "granularity": "Atom|Cluster|Complex",
        "type": "optional sub-type",
        "language": "optional",
        "link": "optional"
      }
    }
  ],
  "relationships": [
    {
      "source": "localId1",
      "target": "localId2",
      "type": "CONTAINS|MENTIONS|DEFINES|DEFINES_TERM|DOCUMENTS|REPORTS_ON|CLASSIFIES|CLASSIFIES_AS|ALIGNS_WITH|REFERENCES|CITES|REFERENCES_STANDARD|LINKS_TO|ABOUT|USES|USES_TOOL|USES_INFORMATION|USES_METHOD|DEPENDS_ON|CONSTRAINS|PERFORMS|PARTICIPATES_IN|ACTS_AS|MANAGES|LEADS|PRODUCES|DELIVERS|MEASURES|EVALUATES|VALIDATES|VALIDATES_AGAINST|VERIFIES|GOVERNS|GOVERNS_PROCESS|GOVERNS_SYSTEM|AUTHORISES|AUTHORISES_ACTIVITY|AUTHORISES_RELEASE|MAPS_TO|SAME_AS|INSTANCE_OF|TRANSITIONS_TO|CURRENT_AT|HAS_PART|IS_PART_OF|HAS_RESOURCE|HAS_SECTION|HAS_CHAPTER|HAS_STEP",
      "properties": { }
    }
  ]
}

Rules:
- Use local IDs in nodes/relationships (the ingestion code will namespace them).
- ActionStatements MUST start with an imperative verb (e.g., "Define…", "Validate…", "Assess…").
- Prefer specialised relations when available (e.g., CITES over REFERENCES, HAS_SECTION over HAS_PART).
- Keep it conservative and minimal.
`.trim();
}

function systemPromptExternal(contentId) {
  return `
You are extracting LIGHT metadata from an external resource.
CONTENT_ID: "${contentId}"

Return ONLY valid JSON:
{
  "nodes": [
    { "id": "${contentId}", "type": "Content", "properties": { "name": "...", "description": "...", "granularity": "Complex", "link": "..." } },
    { "id": "keyConcept1", "type": "Construct", "properties": { "name": "...", "description": "...", "granularity": "Atom" } }
  ],
  "relationships": [
    { "source": "${contentId}", "target": "keyConcept1", "type": "MENTIONS", "properties": {} }
  ]
}

Rules:
- Do NOT attempt deep ontology population.
- Extract at most 3 concept nodes.
- No made-up processes/actors.
`.trim();
}

// ---------------- FETCHING ----------------
async function fetchContent(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: TIMEOUT_MS,
      headers: { "User-Agent": "BIMei-Bot/3.0" },
      maxRedirects: 5,
    });

    const contentType = response.headers["content-type"] || "";
    const buffer = Buffer.from(response.data);

    if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
      return { type: "pdf", buffer, url };
    }

    if (contentType.includes("image") || url.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
      return { type: "image", buffer, url };
    }

    const html = buffer.toString("utf-8");
    const $ = cheerio.load(html);

    // Remove obvious noise
    $("script, style, nav, footer, header, aside, .sidebar, .menu, .nav, .footer, .header").remove();

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "";

    const cleanText = $("body").text().replace(/\s+/g, " ").trim();

    const links = [];
    $("a[href]").each((_, a) => {
      const href = $(a).attr("href");
      if (!href) return;
      try {
        const abs = new URL(href, url).href;
        links.push(abs);
      } catch {
        // ignore
      }
    });

    return {
      type: "html",
      url,
      title,
      text: cleanText,
      links: Array.from(new Set(links)).slice(0, 250),
    };
  } catch (e) {
    console.warn(`⚠️ Fetch Error (${url}): ${e.message}`);
    logError(`FETCH_FAIL ${url} :: ${e.message}`);
    return null;
  }
}

// ---------------- NEO4J WRITES ----------------
async function upsertContentBase(contentId, urlOriginal, urlCanonical, patch = {}) {
  const session = driver.session();
  try {
    await session.run(
      `
      MERGE (c:Content {id: $id})
      ON CREATE SET
        c.created_at = datetime(),
        c.url_original = $urlOriginal,
        c.url_canonical = $urlCanonical,
        c.source_url = $urlCanonical
      SET
        c.updated_at = datetime(),
        c.url_original = $urlOriginal,
        c.url_canonical = $urlCanonical,
        c.source_url = $urlCanonical,
        c += $patch
      `,
      { id: contentId, urlOriginal, urlCanonical, patch }
    );
  } finally {
    await session.close();
  }
}

async function upsertChunk(contentId, idx, text, embeddingVec) {
  const session = driver.session();
  const chunkId = generateChunkId(contentId, idx);

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
        MERGE (ch:Chunk {id:$chunkId})
        ON CREATE SET
          ch.content_id = $contentId,
          ch.idx = $idx,
          ch.text = $text,
          ch.created_at = datetime()
        ON MATCH SET
          ch.text = $text,
          ch.updated_at = datetime()
        `,
        { chunkId, contentId, idx, text }
      );

      if (embeddingVec && Array.isArray(embeddingVec)) {
        await tx.run(
          `
          MATCH (ch:Chunk {id:$chunkId})
          SET ch.embedding = $emb
          `,
          { chunkId, emb: embeddingVec }
        );
      }

      await tx.run(
        `
        MATCH (c:Content {id:$contentId}), (ch:Chunk {id:$chunkId})
        MERGE (c)-[:HAS_CHUNK]->(ch)
        `,
        { contentId, chunkId }
      );
    });
  } finally {
    await session.close();
  }
}

async function ensureVectorIndex(dimensions) {
  if (!CREATE_VECTOR_INDEX) return;
  if (!dimensions || typeof dimensions !== "number") return;

  const session = driver.session();
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
      { dims: dimensions }
    );
    console.log(`   🧠 Vector index ensured (dims=${dimensions})`);
  } catch (e) {
    console.warn(`   ⚠️ Could not create vector index automatically: ${e.message}`);
    logError(`VECTOR_INDEX_FAIL dims=${dimensions} :: ${e.message}`);
  } finally {
    await session.close();
  }
}

// ---------------- INGEST EXTRACTED JSON ----------------
function namespaceId(contentId, rawId) {
  if (!rawId) return null;
  const clean = String(rawId).trim();
  if (!clean) return null;
  if (clean === contentId) return contentId;
  return `${contentId}__${clean.replace(/\s+/g, "_")}`;
}

async function ingestExtraction(contentId, urlCanonical, extraction) {
  const nodes = Array.isArray(extraction?.nodes) ? extraction.nodes : [];
  const rels = Array.isArray(extraction?.relationships) ? extraction.relationships : [];

  const preparedNodes = [];
  const localToGlobal = new Map();

  for (const node of nodes) {
    if (!node?.id || !node?.type) continue;

    const label = safeLabel(node.type);
    const globalId = label === "Content" ? contentId : namespaceId(contentId, node.id);
    if (!globalId) continue;

    const props = node.properties || {};

    preparedNodes.push({
      id: globalId,
      label,
      props: {
        name: props.name || "Unknown",
        description: props.description || "",
        granularity: props.granularity || "Atom",
        type: props.type || null,
        language: props.language || null,
        link: props.link || null,
        original_type: ALLOWED_LABELS.has(String(node.type).trim()) ? null : String(node.type),
        content_id: contentId,
      },
    });

    localToGlobal.set(String(node.id), globalId);
    localToGlobal.set(String(contentId), contentId);
  }

  const preparedRels = [];
  for (const r of rels) {
    if (!r?.source || !r?.target || !r?.type) continue;

    const relType = safeRelType(r.type);
    if (!relType) continue;

    const srcGlobal =
      r.source === contentId ? contentId : (localToGlobal.get(String(r.source)) || namespaceId(contentId, r.source));

    const dstGlobal =
      r.target === contentId ? contentId : (localToGlobal.get(String(r.target)) || namespaceId(contentId, r.target));

    if (!srcGlobal || !dstGlobal) continue;

    preparedRels.push({
      source: srcGlobal,
      target: dstGlobal,
      type: relType,
      props: r.properties || {},
    });
  }

  const session = driver.session();
  try {
    await session.executeWrite(async (tx) => {
      // Ensure Content exists
      await tx.run(
        `
        MERGE (c:Content {id:$id})
        SET c.url_canonical = $url, c.source_url = $url, c.updated_at = datetime()
        `,
        { id: contentId, url: urlCanonical }
      );

      // Nodes
      for (const n of preparedNodes) {
        await tx.run(
          `
          MERGE (x:${n.label} {id:$id})
          ON CREATE SET x.created_at = datetime()
          SET x.updated_at = datetime(),
              x.content_id = $contentId,
              x.name = coalesce(x.name, $name),
              x.description = coalesce(x.description, $description),
              x.granularity = coalesce(x.granularity, $granularity),
              x.type = coalesce(x.type, $type),
              x.language = coalesce(x.language, $language),
              x.link = coalesce(x.link, $link),
              x.original_type = coalesce(x.original_type, $originalType)
          `,
          {
            id: n.id,
            contentId,
            name: n.props.name,
            description: n.props.description,
            granularity: n.props.granularity,
            type: n.props.type,
            language: n.props.language,
            link: n.props.link,
            originalType: n.props.original_type,
          }
        );
      }

      // Relationships (optional coarse domain-range check)
      for (const r of preparedRels) {
        const srcRes = await tx.run(`MATCH (a {id:$id}) RETURN labels(a) AS labels LIMIT 1`, { id: r.source });
        const dstRes = await tx.run(`MATCH (b {id:$id}) RETURN labels(b) AS labels LIMIT 1`, { id: r.target });
        const srcLabels = srcRes.records?.[0]?.get("labels") || [];
        const dstLabels = dstRes.records?.[0]?.get("labels") || [];

        if (!domainRangeOk(r.type, srcLabels, dstLabels)) {
          logError(`DOMAIN_RANGE_BLOCK ${r.type} ${r.source} -> ${r.target}`);
          continue;
        }

        await tx.run(
          `
          MATCH (a {id:$source}), (b {id:$target})
          MERGE (a)-[rel:${r.type}]->(b)
          SET rel += $props
          `,
          { source: r.source, target: r.target, props: r.props }
        );
      }
    });

    return true;
  } catch (e) {
    logError(`INGEST_FAIL ${urlCanonical} :: ${e.message}`);
    return false;
  } finally {
    await session.close();
  }
}

// ---------------- LINK LIGHT-INGEST ----------------
async function upsertExternalResources(contentId, links) {
  if (!Array.isArray(links) || links.length === 0) return;

  const cleaned = links
    .map((l) => normalizeUrl(l))
    .filter((l) => /^https:\/\//.test(l));

  const external = cleaned.filter((l) => !isInternalUrl(l));
  const picked = external.slice(0, 40);
  if (picked.length === 0) return;

  const session = driver.session();
  try {
    await session.executeWrite(async (tx) => {
      for (const u of picked) {
        const rid = `res_${hashUrl(u)}`;
        await tx.run(
          `
          MERGE (r:Resource {id:$rid})
          ON CREATE SET r.url = $url, r.created_at = datetime()
          SET r.updated_at = datetime(), r.url = $url
          `,
          { rid, url: u }
        );

        await tx.run(
          `
          MATCH (c:Content {id:$cid}), (r:Resource {id:$rid})
          MERGE (c)-[:LINKS_TO]->(r)
          `,
          { cid: contentId, rid }
        );
      }
    });
  } finally {
    await session.close();
  }
}

// ---------------- LLM EXTRACTION ----------------
async function runExtraction(modelToUse, systemPrompt, contentId, sourceUrl, chunkTextInput) {
  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`SOURCE: ${sourceUrl}\n\nCONTENT_ID: ${contentId}\n\nTEXT:\n${chunkTextInput}`),
  ];

  try {
    const result = await modelToUse
      .bind({ response_mime_type: "application/json" })
      .invoke(messages);

    return extractJsonObject(result.content);
  } catch (e) {
    logError(`LLM_FAIL ${sourceUrl} :: ${e.message}`);
    return null;
  }
}

// ---------------- PROCESSING ----------------
async function processUrl(item) {
  const urlOriginal = item?.url_original || item?.url || item?.url_canonical || item;
  const urlCanonical = item?.url_canonical || normalizeUrl(urlOriginal);
  if (!urlCanonical) return;

  const contentId = generateContentId(urlCanonical);
  const internal = Boolean(item?.is_internal ?? isInternalUrl(urlCanonical));
  const category = item?.category || (internal ? "general" : "external");
  const attention = item?.attention || (internal ? "medium" : "low");
  const plannedModel = (item?.model === "flash" || item?.model === "pro") ? item.model : (internal ? "pro" : "flash");

  console.log(`\n▶️ Processing: ${urlCanonical}`);

  await upsertContentBase(contentId, urlOriginal, urlCanonical, {
    crawl_status: "started",
    crawl_started_at: new Date().toISOString(),
    is_internal: internal,
    category,
    attention,
    model_plan: plannedModel,
    max_chunks_plan: Number.isFinite(item?.maxChunks) ? item.maxChunks : null,
  });

  const fetched = await fetchContent(urlCanonical);
  if (!fetched) {
    await upsertContentBase(contentId, urlOriginal, urlCanonical, {
      crawl_status: "fetch_failed",
      crawl_finished_at: new Date().toISOString(),
    });
    return;
  }

  // External outbound links (from HTML pages) as Resource nodes
  if (fetched.type === "html" && fetched.links?.length) {
    await upsertExternalResources(contentId, fetched.links);
  }

  // Images: store minimal and stop
  if (fetched.type === "image") {
    await upsertContentBase(contentId, urlOriginal, urlCanonical, {
      crawl_status: "processed_image_only",
      crawl_finished_at: new Date().toISOString(),
    });
    return;
  }

  let title = fetched.title || "";
  let rawText = "";

  if (fetched.type === "pdf") {
    try {
      const data = await pdf(fetched.buffer);
      rawText = data.text || "";
    } catch (e) {
      logError(`PDF_PARSE_FAIL ${urlCanonical} :: ${e.message}`);
      await upsertContentBase(contentId, urlOriginal, urlCanonical, {
        crawl_status: "pdf_parse_failed",
        crawl_finished_at: new Date().toISOString(),
      });
      return;
    }
  } else if (fetched.type === "html") {
    rawText = fetched.text || "";
  }

  const chunks = chunkText(rawText);
  const pdfCap = internal ? MAX_INTERNAL_PDF_CHUNKS : MAX_EXTERNAL_PDF_CHUNKS;
  const defaultLimit = fetched.type === "pdf" ? Math.min(chunks.length, pdfCap) : chunks.length;

  // apply queue policy maxChunks if present
  const policyMax = Number.isFinite(item?.maxChunks) ? item.maxChunks : defaultLimit;
  const finalLimit = Math.max(0, Math.min(defaultLimit, policyMax));

  await upsertContentBase(contentId, urlOriginal, urlCanonical, {
    title,
    text_length: rawText.length,
    chunks_total: chunks.length,
    chunks_planned: finalLimit,
    content_type: fetched.type,
  });

  // Determine model from policy
  const modelToUse = plannedModel === "flash" ? modelFlash : modelPro;
  const sysPrompt = internal
    ? systemPromptInternal(contentId, { category, attention, url: urlCanonical })
    : systemPromptExternal(contentId);

  // Embedding dims discovery + vector index (optional)
  let embeddingDims = null;
  if (EMBEDDINGS_ENABLED && embeddings && finalLimit > 0) {
    try {
      const v = await embeddings.embedQuery(chunks[0] || "test");
      embeddingDims = Array.isArray(v) ? v.length : null;
      if (embeddingDims) await ensureVectorIndex(embeddingDims);
    } catch (e) {
      logError(`EMBED_INIT_FAIL ${urlCanonical} :: ${e.message}`);
    }
  }

  let extractedEdges = 0;
  let extractedNodes = 0;
  let chunksSaved = 0;

  for (let i = 0; i < finalLimit; i++) {
    const t = chunks[i] || "";
    if (!t.trim()) continue;

    // Optional embedding
    let vec = null;
    if (EMBEDDINGS_ENABLED && embeddings) {
      try {
        vec = await embeddings.embedQuery(t);
      } catch (e) {
        logError(`EMBED_FAIL ${urlCanonical} idx=${i} :: ${e.message}`);
      }
    }

    await upsertChunk(contentId, i, t, vec);
    chunksSaved++;

    // LLM extraction
    const extraction = await runExtraction(modelToUse, sysPrompt, contentId, urlCanonical, t);
    if (!extraction) continue;

    const ok = await ingestExtraction(contentId, urlCanonical, extraction);
    if (ok) {
      extractedNodes += Array.isArray(extraction.nodes) ? extraction.nodes.length : 0;
      extractedEdges += Array.isArray(extraction.relationships) ? extraction.relationships.length : 0;
    }
  }

  const status = extractedEdges > 0 || extractedNodes > 0 ? "extracted" : "processed_no_knowledge";

  await upsertContentBase(contentId, urlOriginal, urlCanonical, {
    crawl_status: status,
    crawl_finished_at: new Date().toISOString(),
    chunks_saved: chunksSaved,
    extracted_nodes_raw: extractedNodes,
    extracted_rels_raw: extractedEdges,
    model_used: plannedModel === "flash" ? "gemini-2.5-flash" : "gemini-2.5-pro",
    embeddings_enabled: EMBEDDINGS_ENABLED,
    embedding_model: EMBEDDINGS_ENABLED ? EMBEDDING_MODEL : null,
  });

  console.log(
    `   ✅ Done | status=${status} | chunks=${chunksSaved} | rawNodes=${extractedNodes} | rawRels=${extractedEdges}`
  );
}

// ---------------- LOAD QUEUE (supports strings or objects) ----------------
function loadQueue(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("Queue file must be a JSON array");

  const items = raw
    .map((item) => {
      // 1) string URLs
      if (typeof item === "string") {
        const url_original = item;
        const url_canonical = normalizeUrl(item);
        if (!url_canonical) return null;
        const is_internal = isInternalUrl(url_canonical);
        return {
          url_original,
          url_canonical,
          is_internal,
          content_kind: url_canonical.endsWith(".pdf") ? "pdf" : "html",
          attention: is_internal ? "medium" : "low",
          category: is_internal ? "general" : "external",
          model: is_internal ? "pro" : "flash",
          maxChunks: 999,
          skip: false,
          reason: "string_queue",
        };
      }

      // 2) policy objects
      if (item && typeof item === "object") {
        const url_original = item.url_original || item.url || item.url_canonical;
        const url_canonical = normalizeUrl(item.url_canonical || item.url_original || item.url);
        if (!url_canonical) return null;

        const is_internal = typeof item.is_internal === "boolean" ? item.is_internal : isInternalUrl(url_canonical);

        const model = item.model === "flash" || item.model === "pro" ? item.model : (is_internal ? "pro" : "flash");
        const maxChunks = Number.isFinite(item.maxChunks) ? item.maxChunks : 999;

        return {
          ...item,
          url_original,
          url_canonical,
          is_internal,
          model,
          maxChunks,
          skip: Boolean(item.skip),
        };
      }

      return null;
    })
    .filter(Boolean);

  return items;
}

// ---------------- MAIN ----------------
async function main() {
  console.log("🚀 Starting Hybrid Crawler");
  console.log(`   Queue: ${QUEUE_FILE}`);
  console.log(`   Concurrency: ${CONCURRENCY}`);
  console.log(`   Embeddings: ${EMBEDDINGS_ENABLED ? `ON (${EMBEDDING_MODEL})` : "OFF"}`);
  console.log(`   Strict rel whitelist: ${STRICT_REL_WHITELIST}`);
  console.log(`   Domain-range validation: ${VALIDATE_DOMAIN_RANGE}`);

  let QUEUE_ITEMS = [];
  try {
    QUEUE_ITEMS = loadQueue(QUEUE_FILE);
  } catch (e) {
    console.error(`❌ Could not load queue: ${e.message}`);
    process.exit(1);
  }

  console.log(`✅ Loaded ${QUEUE_ITEMS.length} queue items.`);
  console.log("🔎 Queue sample:", QUEUE_ITEMS[0]);

  // Process in batches
  for (let i = 0; i < QUEUE_ITEMS.length; i += CONCURRENCY) {
    const batch = QUEUE_ITEMS.slice(i, i + CONCURRENCY);
    console.log(`\n--- 📦 Batch ${Math.floor(i / CONCURRENCY) + 1} (${i + 1} - ${Math.min(i + CONCURRENCY, QUEUE_ITEMS.length)}) ---`);

    await Promise.all(
      batch.map(async (item) => {
        try {
          if (item.skip) {
            console.log(`⏭️ Skipping: ${item.url_canonical} (${item.reason || "skip"})`);
            return;
          }
          await processUrl(item);
        } catch (e) {
          logError(`URL_FAIL ${item?.url_canonical || item} :: ${e.message}`);
        }
      })
    );

    // Gentle cooldown (avoid rate limits)
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log("\n🎉 All Done!");
  await driver.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  logError(`FATAL :: ${e.message}`);
  driver.close().catch(() => {});
});
