# Vertex Graph Builder

GraphRAG (Graph Retrieval-Augmented Generation) ingestion engine that crawls web content, extracts knowledge using Google Vertex AI, and populates a Neo4j knowledge graph.

**Part of**: [BIMei Microtools Collection](../)
**Stack**: Node.js, Google Vertex AI (Gemini), Neo4j, LangChain
**Status**: Active

---

## Overview

This tool automates the process of building knowledge graphs from web content. It crawls specified URLs, processes content using Google's Gemini AI models, extracts entities and relationships, and stores them in a Neo4j graph database.

### Key Features

- **Intelligent Web Crawling**: Hybrid crawler for scraping web pages and PDFs
- **AI-Powered Extraction**: Uses Google Vertex AI (Gemini 2.5 Pro) to extract entities and relationships
- **LangChain Integration**: Built on LangChain framework for robust LLM workflows
- **Neo4j Storage**: Stores knowledge graph in Neo4j for querying and visualization
- **Chunked Processing**: Handles large documents by splitting into manageable chunks
- **Embedding Generation**: Creates vector embeddings for semantic search
- **GCS Integration**: Supports reading content from Google Cloud Storage

---

## Architecture

```
┌─────────────────┐
│  Web Sources    │
│  PDFs, HTML     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Hybrid Crawler  │
│ (cheerio, pdf)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Text Splitter  │
│  (LangChain)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Vertex AI      │
│  (Gemini 2.5)   │
│  Entity Extract │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Neo4j Graph    │
│  Knowledge Base │
└─────────────────┘
```

---

## Use Cases

1. **Knowledge Base Construction**: Build searchable knowledge graphs from documentation
2. **Content Indexing**: Index large document collections for graph-based retrieval
3. **Relationship Mapping**: Discover and map relationships between concepts
4. **GraphRAG Applications**: Power retrieval-augmented generation with graph context
5. **BIM Knowledge Graphs**: Specifically designed for BIM-related content extraction

---

## Files

```
vertex-graph-builder/
├── index.js                 # Connectivity test and main entry point
├── hybrid-crawler.js        # Web and PDF content crawler
├── agent.js                 # AI agent for entity/relationship extraction
├── embed-chunks.js          # Text chunking and embedding generation
├── generate_real_queue.js   # Queue generator for batch processing
├── api/                     # API utilities (if present)
├── data/                    # Data storage directory
├── package.json            # Node.js dependencies
├── .env.example            # Environment variable template
└── README.md               # This file
```

---

## Quick Start

### Prerequisites

- **Node.js 20+** installed
- **Google Cloud Project** with Vertex AI enabled
- **Neo4j Database** (AuraDB or self-hosted)
- **Google Cloud credentials** configured

### Installation

1. **Navigate to the directory**
   ```bash
   cd vertex-graph-builder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your credentials:
   ```env
   NEO4J_URI=neo4j+s://your-instance-id.databases.neo4j.io
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your-neo4j-password-here
   GOOGLE_PROJECT_ID=your-gcp-project-id
   GOOGLE_LOCATION=us-central1
   ```

4. **Set up Google Cloud authentication**
   ```bash
   gcloud auth application-default login
   # or use service account key:
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

5. **Test connectivity**
   ```bash
   npm start
   # or
   node index.js
   ```

   Expected output:
   ```
   ------------------------------------------------
   🚀 Starting GraphRAG Connectivity Test...
   ------------------------------------------------
   📡 Testing Vertex AI (Gemini) connection...
   ✅ Vertex AI Responded: "Hello! Yes, I'm ready to help you build a graph..."
   ------------------------------------------------
   🔗 Testing Neo4j Database connection...
   ✅ Neo4j Connected Successfully!
   ------------------------------------------------
   🎉 SYSTEM CHECK PASSED: Ready to ingest data.
   ------------------------------------------------
   ```

---

## Usage

### Basic Workflow

1. **Generate URL queue** (for batch processing)
   ```bash
   node generate_real_queue.js
   ```

2. **Crawl content**
   ```bash
   node hybrid-crawler.js
   ```

3. **Extract and embed**
   ```bash
   node embed-chunks.js
   ```

4. **Run AI agent** (extract entities and relationships)
   ```bash
   node agent.js
   ```

### Crawler Configuration

Edit `hybrid-crawler.js` to configure:
- Start URLs
- Crawl depth
- File types to include/exclude
- Rate limiting

### Agent Configuration

The AI agent (`agent.js`) uses Vertex AI to:
- Extract named entities (people, places, concepts)
- Identify relationships between entities
- Classify entity types
- Generate structured graph data

---

## Components

### 1. index.js - Connectivity Test
**Purpose**: Verify all system connections before ingestion

**What it checks**:
- ✅ Vertex AI (Gemini) connectivity
- ✅ Neo4j database connectivity
- ✅ Environment variables are set

**Usage**:
```bash
node index.js
```

### 2. hybrid-crawler.js - Content Crawler
**Purpose**: Fetch and extract content from web pages and PDFs

**Features**:
- HTML parsing with Cheerio
- PDF text extraction
- Recursive link following
- Content cleaning and normalization
- Error handling and retry logic

**Supported formats**:
- HTML pages
- PDF documents
- Plain text

### 3. embed-chunks.js - Text Processing
**Purpose**: Split large documents and generate embeddings

**Features**:
- Text splitting with LangChain TextSplitters
- Chunk size optimization
- Vector embedding generation
- Metadata preservation

### 4. agent.js - AI Extraction Agent
**Purpose**: Extract entities and relationships using Gemini AI

**Features**:
- Entity extraction (DictionaryItem, Construct, ActionStatement, etc.)
- Relationship detection (RELATES_TO, PART_OF, ENABLES, etc.)
- Confidence scoring
- Structured output for Neo4j ingestion

### 5. generate_real_queue.js - Queue Generator
**Purpose**: Create processing queues for batch operations

**Features**:
- URL list generation
- Priority ordering
- Duplicate detection
- Queue persistence

---

## Configuration

### Environment Variables

Required variables in `.env`:

```env
# Neo4j Configuration
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password-here

# Google Cloud Configuration
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_LOCATION=us-central1  # or your preferred region

# Optional: Google Cloud Storage
GCS_BUCKET=your-bucket-name
```

### Google Cloud Setup

1. **Enable Vertex AI API**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

2. **Set default project**
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **Authenticate**
   ```bash
   gcloud auth application-default login
   ```

---

## Deployment

### Local Development
```bash
npm install
node index.js  # Test connectivity
node hybrid-crawler.js  # Run crawler
```

### Google Cloud Functions
```bash
gcloud functions deploy graphBuilder \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=main \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URI="${NEO4J_URI}",NEO4J_USERNAME="${NEO4J_USERNAME}",NEO4J_PASSWORD="${NEO4J_PASSWORD}"
```

### Google Cloud Run
```bash
# Create Dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "hybrid-crawler.js"]
```

Deploy:
```bash
gcloud run deploy vertex-graph-builder \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NEO4J_URI="${NEO4J_URI}",NEO4J_USERNAME="${NEO4J_USERNAME}",NEO4J_PASSWORD="${NEO4J_PASSWORD}"
```

### Scheduled Execution (Cloud Scheduler)
```bash
# Create Cloud Scheduler job to run crawler daily
gcloud scheduler jobs create http graph-builder-daily \
  --schedule="0 2 * * *" \
  --uri="https://your-cloud-function-url" \
  --http-method=POST
```

---

## Graph Schema

### Node Types
- **DictionaryItem**: BIM terms and definitions
- **Construct**: Abstract concepts and frameworks
- **ActionStatement**: Actionable processes or activities
- **InformationUse**: Information usage patterns
- **Content**: Content resources (pages, documents)
- **Deliverable**: Project deliverables
- **Resource**: External resources

### Relationship Types
- **RELATES_TO**: General relationship
- **PART_OF**: Hierarchical containment
- **ENABLES**: Enabling relationship
- **REQUIRES**: Dependency relationship
- **DEFINES**: Definition relationship
- **IMPLEMENTS**: Implementation relationship

---

## Troubleshooting

### Issue: "Vertex AI Connection Failed"
**Solutions**:
- Verify `GOOGLE_PROJECT_ID` is correct
- Check Vertex AI API is enabled
- Ensure authentication is configured:
  ```bash
  gcloud auth application-default login
  ```
- Verify you have Vertex AI permissions

### Issue: "Neo4j Connection Failed"
**Solutions**:
- Check `NEO4J_URI` format (should start with `neo4j+s://` for AuraDB)
- Verify `NEO4J_PASSWORD` is correct
- Ensure database is running
- Test connection: `node index.js`

### Issue: Crawler errors or hangs
**Solutions**:
- Check target URLs are accessible
- Verify rate limiting settings
- Review `crawler_errors.log`
- Reduce concurrent requests

### Issue: Out of memory errors
**Solutions**:
- Reduce chunk size in text splitter
- Process fewer URLs per batch
- Increase Node.js memory:
  ```bash
  node --max-old-space-size=4096 hybrid-crawler.js
  ```

---

## Performance

- **Crawl Speed**: ~10-20 pages/minute (depending on content size)
- **AI Processing**: ~5-10 seconds per chunk (Gemini 2.5 Pro)
- **Memory Usage**: ~500MB-2GB depending on document size
- **Neo4j Ingestion**: ~100-500 nodes/minute

---

## Dependencies

```json
{
  "@google-cloud/storage": "^7.18.0",
  "@langchain/community": "^0.3.58",
  "@langchain/core": "^1.1.12",
  "@langchain/google-vertexai": "^0.1.8",
  "@langchain/textsplitters": "^1.0.1",
  "axios": "^1.13.2",
  "cheerio": "^1.1.2",
  "dotenv": "^16.6.1",
  "langchain": "^1.2.3",
  "neo4j-driver": "^5.28.2",
  "pdf-parse": "^1.1.4",
  "stream-json": "^1.9.1"
}
```

---

## Best Practices

### For Large-Scale Ingestion
1. Start with small URL sets for testing
2. Monitor Neo4j memory usage
3. Use Cloud Storage for intermediate results
4. Implement checkpointing for resumable jobs
5. Set up error logging and monitoring

### For Quality Results
1. Curate source URLs carefully
2. Review extracted entities periodically
3. Fine-tune prompts in `agent.js` for your domain
4. Validate graph structure with Cypher queries
5. Use Neo4j indexes for performance

---

## Related Tools

- [bimei-kb-dashboard](../bimei-kb-dashboard/) - Query the built knowledge graph
- [knowledge_graph_streamlit_viewer](../knowledge_graph_streamlit_viewer/) - Visualize graph paths
- [vertex_cx_chatbot](../vertex_cx_chatbot/) - Chat interface powered by this graph

---

## Support

**Issues**: Create an issue in the GitHub repository
**Google Cloud**: [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
**Neo4j**: [Neo4j Documentation](https://neo4j.com/docs/)
**LangChain**: [LangChain JS Documentation](https://js.langchain.com/)

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

Part of the BIMei Microtools Collection. Licensed under CC BY-NC-SA 4.0.
