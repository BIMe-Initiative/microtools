// generate_real_queue.js
import fs from "fs";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import "dotenv/config";

// ------------ CONFIG ------------
const INPUT_QUEUE =
  process.env.QUEUE_IN || (fs.existsSync("queue_classified.json") ? "queue_classified.json" : "queue.json");

const OUTPUT_REMAINING = process.env.QUEUE_OUT || "queue_remaining.json";
const OUTPUT_DONE = process.env.DONE_OUT || "queue_already_done.json";

const INTERNAL_DOMAIN = "bimexcellence.org";

// ------------ URL NORMALISER ------------
function normalizeUrl(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s) return "";

  if (s.startsWith("//")) s = "https:" + s;

  if (!/^https?:\/\//i.test(s) && /^[a-z0-9.-]+\.[a-z]{2,}(\/*|\/)/i.test(s)) {
    s = "https://" + s;
  }

  try {
    const u = new URL(s);

    if (u.hostname.toLowerCase().endsWith(INTERNAL_DOMAIN)) {
      u.protocol = "https:";
    }

    u.hash = "";
    u.search = "";

    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const pathname = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;

    return `https://${host}${pathname}`;
  } catch {
    s = s.split("#")[0].split("?")[0].trim();
    if (/^http:\/\//i.test(s)) s = s.replace(/^http:\/\//i, "https://");
    s = s.toLowerCase();
    if (s.endsWith("/") && !/^https:\/\/[^/]+\/$/.test(s)) s = s.slice(0, -1);
    return s;
  }
}

// Legacy field may be: null, single URL, or "url1, url2, url3"
function expandPossiblyCommaSeparated(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => normalizeUrl(s))
    .filter(Boolean);
}

function isObjectQueue(queue) {
  return Array.isArray(queue) && queue.length > 0 && typeof queue[0] === "object" && queue[0] !== null;
}

async function main() {
  console.log("🕵️ Auditing Neo4j progress...");

  // 1) Load input queue
  let queueRaw;
  try {
    queueRaw = JSON.parse(fs.readFileSync(INPUT_QUEUE, "utf-8"));
  } catch (e) {
    console.error(`❌ Could not read ${INPUT_QUEUE}: ${e.message}`);
    process.exit(1);
  }

  const objectQueue = isObjectQueue(queueRaw);

  const queueItems = objectQueue
    ? queueRaw.map((x) => ({
        ...x,
        url_canonical: x.url_canonical ? normalizeUrl(x.url_canonical) : normalizeUrl(x.url_original || x.url),
      }))
    : queueRaw.map((u) => ({
        url_original: u,
        url_canonical: normalizeUrl(u),
      }));

  const masterSet = new Set(queueItems.map((x) => x.url_canonical).filter(Boolean));
  console.log(`📦 Loaded ${queueItems.length} items from ${INPUT_QUEUE} (${masterSet.size} unique canonical URLs).`);

  // 2) Connect Neo4j
  const graph = await Neo4jGraph.initialize({
    url: process.env.NEO4J_URI,
    username: process.env.NEO4J_USERNAME,
    password: process.env.NEO4J_PASSWORD,
  });

  // 3) Pull all URL-like fields we might have from Content
  // We keep this broad because your earlier crawls used different field names.
  const rows = await graph.query(`
    MATCH (c:Content)
    RETURN
      c.url_canonical AS url_canonical,
      c.source_url AS source_url,
      c.sourceUri AS sourceUri,
      c.url_original AS url_original
  `);

  const finishedSet = new Set();

  for (const r of rows) {
    // canonical first
    const candidates = [];

    if (r.url_canonical) candidates.push(r.url_canonical);
    if (r.sourceUri) candidates.push(r.sourceUri);
    if (r.source_url) candidates.push(r.source_url);
    if (r.url_original) candidates.push(r.url_original);

    for (const cand of candidates) {
      for (const u of expandPossiblyCommaSeparated(cand)) {
        if (u) finishedSet.add(u);
      }
    }
  }

  console.log(`✅ Neo4j contains ${finishedSet.size} distinct completed canonical URLs (via canonical+legacy fields).`);

  await graph.close();

  // 4) Subtract done from master
  const remaining = [];
  const alreadyDone = [];

  for (const item of queueItems) {
    const key = item.url_canonical;
    if (!key) continue;

    if (finishedSet.has(key)) alreadyDone.push(item);
    else remaining.push(item);
  }

  // 5) Save outputs
  fs.writeFileSync(OUTPUT_REMAINING, JSON.stringify(remaining, null, 2));
  fs.writeFileSync(OUTPUT_DONE, JSON.stringify(alreadyDone, null, 2));

  console.log(`\n📊 Audit Results:`);
  console.log(`   Total Targets:   ${queueItems.length}`);
  console.log(`   Already Done:    ${alreadyDone.length}`);
  console.log(`   🚀 TO DO:        ${remaining.length}`);
  console.log(`\n💾 Saved remaining to '${OUTPUT_REMAINING}' and done list to '${OUTPUT_DONE}'.`);
  console.log(
    `👉 Tip: Point your crawler QUEUE_FILE at '${OUTPUT_REMAINING}' (it will preserve policy fields if present).`
  );
}

main().catch((err) => {
  console.error(`❌ Fatal error: ${err?.message || err}`);
  process.exitCode = 1;
});
