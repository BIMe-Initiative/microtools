const functions = require('@google-cloud/functions-framework');
const { ChatVertexAI } = require('@langchain/google-vertexai');
const { GraphCypherQAChain } = require('@langchain/community/chains/graph_qa/cypher');
const { Neo4jGraph } = require('@langchain/community/graphs/neo4j_graph');
const axios = require('axios');

// Environment variables
const VERTEX_PROXY_URL = process.env.VERTEX_PROXY_URL || 'https://australia-southeast1-bimei-ai.cloudfunctions.net/bimei-chatbot';
const GRAPH_QUERY_URL = process.env.GRAPH_QUERY_URL || 'https://australia-southeast1-bimei-ai.cloudfunctions.net/graphQuery';
const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Initialize Neo4j for NeoDash functionality
let graph = null;
if (NEO4J_URI && NEO4J_USER && NEO4J_PASSWORD) {
  graph = new Neo4jGraph({
    url: NEO4J_URI,
    username: NEO4J_USER,
    password: NEO4J_PASSWORD
  });
}

/**
 * Unified Dashboard API Handler
 */
functions.http('dashboardApi', async (req, res) => {
  // CORS headers - Allow dashboard domains
  const allowedOrigins = [
    'https://storage.googleapis.com',
    'https://bimexcellence.org',
    'https://www.bimexcellence.org',
    'http://localhost:3000',
    'http://localhost:8000'
  ];
  
  const origin = req.get('Origin');
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, modules = ['text', 'sources', 'evidence', 'path', 'graph'] } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = {};
    const sessionId = req.body.sessionId || generateSessionId();

    // Execute API calls in parallel for enabled modules
    const apiCalls = [];

    // Text Response & Sources (from Vertex Proxy)
    if (modules.includes('text') || modules.includes('sources')) {
      apiCalls.push(
        callVertexProxy(query, sessionId)
          .then(data => {
            if (modules.includes('text')) {
              results.text = extractTextResponse(data);
            }
            if (modules.includes('sources')) {
              results.sources = extractSources(data);
            }
          })
          .catch(error => {
            if (modules.includes('text')) results.text = { error: error.message };
            if (modules.includes('sources')) results.sources = { error: error.message };
          })
      );
    }

    // Evidence & Path (from Graph Query)
    if (modules.includes('evidence') || modules.includes('path')) {
      apiCalls.push(
        callGraphQuery(query)
          .then(data => {
            if (modules.includes('evidence')) {
              results.evidence = extractEvidence(data);
            }
            if (modules.includes('path')) {
              results.path = extractPath(data);
            }
          })
          .catch(error => {
            if (modules.includes('evidence')) results.evidence = { error: error.message };
            if (modules.includes('path')) results.path = { error: error.message };
          })
      );
    }

    // Interactive Graph (NeoDash functionality)
    if (modules.includes('graph')) {
      apiCalls.push(
        callNeoDash(query)
          .then(data => {
            results.graph = data;
          })
          .catch(error => {
            results.graph = { error: error.message };
          })
      );
    }

    // Wait for all API calls to complete
    await Promise.all(apiCalls);

    return res.status(200).json({
      query,
      sessionId,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Call Vertex AI Proxy
 */
async function callVertexProxy(query, sessionId) {
  const response = await axios.post(VERTEX_PROXY_URL, {
    action: 'vertex-proxy',
    sessionId,
    messages: [{ content: query }],
    expertMode: true
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

/**
 * Call Graph Query API
 */
async function callGraphQuery(query) {
  const response = await axios.post(GRAPH_QUERY_URL, {
    query
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000
  });

  return response.data;
}

/**
 * NeoDash functionality - LangChain-powered graph Q&A
 */
async function callNeoDash(query) {
  if (!graph || !GOOGLE_API_KEY) {
    throw new Error('NeoDash not configured - missing Neo4j or Google API credentials');
  }

  try {
    const model = new ChatVertexAI({
      model: 'gemini-2.5-flash',
      apiKey: GOOGLE_API_KEY,
      temperature: 0
    });

    const chain = GraphCypherQAChain.fromLLM({
      llm: model,
      graph: graph,
      verbose: false,
      returnIntermediateSteps: true,
      allowDangerousRequests: true
    });

    const result = await chain.invoke({ query });
    
    const answer = result.result || 'No answer generated';
    const cypher = result.intermediateSteps?.[0]?.query || '';

    // Execute the generated Cypher to get visualization data
    let visualData = { nodes: [], edges: [] };
    
    if (cypher) {
      try {
        // Modify query to return graph data
        const vizQuery = cypher.replace(/RETURN\s+.*$/i, 'RETURN * LIMIT 50');
        const vizResult = await graph.query(vizQuery);
        visualData = processVisualizationData(vizResult);
      } catch (vizError) {
        console.warn('Visualization query failed:', vizError.message);
      }
    }

    return {
      answer,
      cypher,
      visual: visualData
    };

  } catch (error) {
    throw new Error(`NeoDash query failed: ${error.message}`);
  }
}

/**
 * Process Neo4j result for visualization
 */
function processVisualizationData(result) {
  const nodes = [];
  const edges = [];
  const seenNodes = new Set();
  const seenEdges = new Set();

  result.forEach(record => {
    Object.values(record).forEach(entity => {
      // Process nodes
      if (entity && typeof entity === 'object' && entity.labels) {
        const nodeId = entity.elementId || entity.identity?.toString() || entity.id?.toString();
        if (nodeId && !seenNodes.has(nodeId)) {
          const props = entity.properties || {};
          const label = props.name || props.title || entity.labels[0] || 'Node';
          
          nodes.push({
            id: nodeId,
            label: label.length > 20 ? label.substring(0, 20) + '...' : label,
            group: entity.labels[0] || 'Generic',
            title: JSON.stringify(props)
          });
          seenNodes.add(nodeId);
        }
      }
      
      // Process relationships
      if (entity && typeof entity === 'object' && entity.type && entity.start && entity.end) {
        const relId = entity.elementId || entity.identity?.toString() || entity.id?.toString();
        if (relId && !seenEdges.has(relId)) {
          const startId = entity.start.elementId || entity.start.toString();
          const endId = entity.end.elementId || entity.end.toString();
          
          edges.push({
            from: startId,
            to: endId,
            label: entity.type
          });
          seenEdges.add(relId);
        }
      }
    });
  });

  return { nodes, edges };
}

/**
 * Extract text response from Vertex Proxy
 */
function extractTextResponse(data) {
  if (data.envelope && data.envelope.content_md) {
    return {
      content: data.envelope.content_md,
      mode: data.envelope.mode || 'default',
      source: data.envelope.meta?.source || 'BIMei AI'
    };
  }
  
  return {
    content: data.text || 'No response available',
    mode: 'default',
    source: 'BIMei AI'
  };
}

/**
 * Extract sources from Vertex Proxy
 */
function extractSources(data) {
  if (data.envelope && data.envelope.links && Array.isArray(data.envelope.links)) {
    return {
      links: data.envelope.links.slice(0, 5).map(link => ({
        url: typeof link === 'string' ? link : link.url,
        title: typeof link === 'object' ? link.title : link,
        type: getSourceType(typeof link === 'string' ? link : link.url)
      }))
    };
  }
  
  return { links: [] };
}

/**
 * Extract evidence from Graph Query
 */
function extractEvidence(data) {
  if (data.evidence) {
    return {
      score: data.evidence.score || 0,
      confidence: data.evidence.confidence || 'Unknown',
      metrics: data.evidence.metrics || {},
      tier: data.paths?.[0]?.tier || 'minimal'
    };
  }
  
  return null;
}

/**
 * Extract path visualization from Graph Query
 */
function extractPath(data) {
  if (data.graph_data && data.graph_data.nodes && data.graph_data.edges) {
    return {
      nodes: data.graph_data.nodes,
      edges: data.graph_data.edges,
      hops: data.graph_data.nodes.length - 1
    };
  }
  
  return null;
}

/**
 * Determine source type from URL
 */
function getSourceType(url) {
  if (!url) return 'unknown';
  
  if (url.includes('bimdictionary.com')) return 'dictionary';
  if (url.toLowerCase().includes('.pdf')) return 'pdf';
  if (url.includes('bimexcellence.org')) return 'page';
  
  return 'external';
}

/**
 * Generate session ID
 */
function generateSessionId() {
  return 'dash_' + Math.random().toString(36).substring(2, 15);
}

module.exports = { dashboardApi: functions.http('dashboardApi', async (req, res) => {
  // Implementation is above
}) };