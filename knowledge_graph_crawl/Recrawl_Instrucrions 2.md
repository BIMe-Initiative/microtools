
# BIMei Graph Re-Crawl Instructions

**Goal:** Re-process the website to populate the Knowledge Graph with clean, verified data (Content, Constructs, ActionStatements) while avoiding "zombie" processes and duplicate work.

---

## 1. Prerequisites

Ensure you are in the project directory:
```bash
cd /Users/bilalsuccar/Documents/microtools/vertex-graph-builder

```

Ensure your `.env` file contains valid credentials:

* `NEO4J_URI` (Use `neo4j+s://...`)
* `NEO4J_USERNAME` / `NEO4J_PASSWORD`
* `GOOGLE_APPLICATION_CREDENTIALS` (or API Key)

---

## 2. Prepare the Queue

We must first identify exactly which URLs need to be processed by comparing your "Master List" against what is already safely in the database.

1. **Run the Generator Script:**
This script subtracts finished URLs (from Neo4j) from your master list (`queue_clean.json`) and creates a new target file.

```bash
node generate_real_queue.js

```


* **Input:** `queue_clean.json` (Your full list of ~700 URLs)
* **Output:** `queue_remaining.json` (The list of URLs to crawl)
* **Verification:** Look for the log output: `🚀 TO DO: [Number]`



---

## 3. Run the Crawler

Use the robust, batch-enabled crawler script. This version processes 20 URLs at a time, verifies every database write, and prevents "zombie" hangs.

1. **Execute the Script:**
```bash
node hybrid-crawler.js

```


* **Input:** Reads from `queue_remaining.json`.
* **Models:** Uses `gemini-2.5-pro` (for HTML/Internal PDFs) and `gemini-2.5-flash` (for External PDFs).
* **Logging:** Errors are saved to `crawler_errors.log`.


2. **Monitor Progress:**
* Watch the terminal for `✅ Finished` or `⚠️ No valid knowledge` messages.
* The script prints `--- 📦 Batch X ---` to show progress.



---

## 4. Post-Crawl Cleanup (Recommended)

To keep your database efficient and under the free-tier limits, remove temporary text chunks after the crawl finishes. (The crawler does this automatically per batch, but running it once at the end ensures 100% cleanliness).

1. **Run in Neo4j Browser:**
```cypher
MATCH (n:Chunk) DETACH DELETE n;

```



---

## 5. Verification

Once the crawl is complete, verify the health of your Knowledge Graph.

1. **Run in Neo4j Browser:**
```cypher
MATCH (n) 
RETURN labels(n) as Type, count(n) as Count 
ORDER BY Count DESC

```


* **Success Indicators:**
* `Construct`: > 1,000
* `ActionStatement`: > 1,000
* `Content`: Should match the number of valid URLs processed.
* `Chunk`: Should be 0 (if cleaned).


---

## Troubleshooting

* **Script Hangs?** Press `Ctrl + C` and restart. The script reads from `queue_remaining.json`, so you may need to re-run `node generate_real_queue.js` first to update the remaining list based on what was just finished.
* **"0 Updates" Error?** This means the LLM returned data, but Neo4j didn't save it. Check your database connection string or user permissions.
* **404 Errors?** These are skipped automatically and logged. You can safely ignore them.

```

```