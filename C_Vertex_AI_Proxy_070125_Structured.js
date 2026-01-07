'use strict';

const functions = require('@google-cloud/functions-framework');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
const crypto = require('crypto');

const client = new SessionsClient({
  apiEndpoint: 'global-dialogflow.googleapis.com',
});

function log(severity, message, meta) {
  console.log(JSON.stringify({
    severity: severity || 'INFO',
    message: message || '',
    ts: new Date().toISOString(),
    ...meta
  }));
}

function extractUserMessage(body) {
  if (!body || typeof body !== 'object') return null;
  const messages = Array.isArray(body.messages) ? body.messages : null;
  const m0 = messages && messages[0] ? messages[0] : null;
  const content = m0 && typeof m0 === 'object' ? m0.content : null;
  if (typeof content === 'string' && content.trim()) return content.trim();
  if (typeof body.text === 'string' && body.text.trim()) return body.text.trim();
  return null;
}

function extractAiText(queryResult) {
  const msgs = queryResult && Array.isArray(queryResult.responseMessages) ? queryResult.responseMessages : [];
  if (!msgs.length) return "I understood you, but I don't have a text response.";

  const textParts = [];
  for (const m of msgs) {
    const t = m && m.text && Array.isArray(m.text.text) ? m.text.text : null;
    if (t && t.length) {
      for (const part of t) {
        if (typeof part === 'string' && part.trim()) textParts.push(part.trim());
      }
    }
  }

  if (textParts.length) {
    let joined = textParts.join('\n\n');
    if (joined.length > 6000) joined = joined.slice(0, 6000) + '…';
    return joined;
  }

  return "I understood you, but I don't have a text response.";
}

function tryParseEnvelope(text) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  if (!s) return null;

  // Check for Graph Tool raw JSON markers first
  const graphToolMatch = s.match(/GRAPH_TOOL_JSON_START\s*([\s\S]*?)\s*GRAPH_TOOL_JSON_END/);
  if (graphToolMatch && graphToolMatch[1]) {
    try {
      const toolResponse = JSON.parse(graphToolMatch[1].trim());
      if (toolResponse && typeof toolResponse === 'object') {
        return toolResponse; // Return raw Graph Tool response
      }
    } catch (_e) {}
  }

  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const obj = JSON.parse(s);
      if (obj && typeof obj === 'object') return obj;
    } catch (_e) {}
  }

  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) {
    const inner = fence[1].trim();
    if (inner.startsWith('{') && inner.endsWith('}')) {
      try {
        const obj = JSON.parse(inner);
        if (obj && typeof obj === 'object') return obj;
      } catch (_e) {}
    }
  }

  return null;
}

function extractUrlTitle(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Handle specific URL patterns with type indicators
    if (urlObj.hostname.includes('bimdictionary.com')) {
      // Extract from path like /en/model-uses-list/1
      const pathParts = pathname.split('/').filter(p => p && p !== 'en');
      if (pathParts.length > 0) {
        const title = pathParts[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return `[Dictionary] ${title}`;
      }
    }
    
    if (urlObj.hostname.includes('bimexcellence.org')) {
      // Check if it's a PDF first
      const isPdf = pathname.toLowerCase().includes('.pdf');
      
      // Extract meaningful part from BIMexcellence URLs
      const pathParts = pathname.split('/').filter(p => p);
      
      // Look for meaningful parts, skip generic folders
      const skipParts = ['wp-content', 'uploads', 'resources', 'thinkspace', 'projects'];
      const meaningfulParts = pathParts.filter(part => 
        !skipParts.includes(part.toLowerCase()) && 
        !part.match(/^\d+$/) && // Skip pure numbers
        !part.match(/^\d{4}$/) && // Skip years
        part.length > 2 // Skip very short parts
      );
      
      if (meaningfulParts.length > 0) {
        // Use the last meaningful part
        const lastMeaningful = meaningfulParts[meaningfulParts.length - 1];
        const title = lastMeaningful
          .replace(/-/g, ' ')
          .replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i, '') // Remove extensions
          .replace(/\b\w/g, l => l.toUpperCase())
          .replace(/\b(And|Or|The|A|An|In|On|At|To|For|Of|With|By)\b/g, w => w.toLowerCase());
        
        return isPdf ? `[PDF] ${title}` : `[Page] ${title}`;
      }
    }
    
    // Generic fallback - find the most meaningful part
    const pathParts = pathname.split('/').filter(p => p);
    const meaningfulParts = pathParts.filter(part => 
      !part.match(/^\d+$/) && // Skip pure numbers
      part.length > 2 && // Skip very short parts
      !['wp-content', 'uploads', 'content', 'assets'].includes(part.toLowerCase())
    );
    
    if (meaningfulParts.length > 0) {
      const lastMeaningful = meaningfulParts[meaningfulParts.length - 1];
      const isPdf = lastMeaningful.toLowerCase().includes('.pdf');
      const title = lastMeaningful
        .replace(/-/g, ' ')
        .replace(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i, '')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\b(And|Or|The|A|An|In|On|At|To|For|Of|With|By)\b/g, w => w.toLowerCase());
      
      return isPdf ? `[PDF] ${title}` : `[Page] ${title}`;
    }
    
    return url; // Fallback to full URL
  } catch (e) {
    return url;
  }
}

function processResponse(aiText, mode, requestId, sessionId) {
  log('DEBUG', 'AI Response Analysis', {
    requestId,
    aiTextLength: aiText.length,
    startsWithJson: aiText.trim().startsWith('{'),
    hasOntNode: aiText.includes('<span class="ont-node"'),
    relationshipMatch: aiText.match(/\*([A-Za-z_]+)\*/),
    firstChars: aiText.slice(0, 100),
    hasGraphData: aiText.includes('BIMei Knowledge Graph'),
    hasEvidence: aiText.includes('Evidence:'),
    responseSource: aiText.includes('BIMei Knowledge Graph') ? 'GRAPH' : 'DATA_STORE'
  });
  
  const maybeEnvelope = tryParseEnvelope(aiText);
  
  // Extract URLs from response text for Data Store sources with better titles
  const urlMatches = aiText.match(/https?:\/\/[^\s<>"']+/g) || [];
  const sourceUrls = urlMatches.slice(0, 3).map(url => ({
    url: url,
    title: extractUrlTitle(url)
  }));
  
  // Sort sources by type: Dictionary, Page, PDF
  sourceUrls.sort((a, b) => {
    const getTypeOrder = (title) => {
      if (title.startsWith('[Dictionary]')) return 1;
      if (title.startsWith('[Page]')) return 2;
      if (title.startsWith('[PDF]')) return 3;
      return 4;
    };
    return getTypeOrder(a.title) - getTypeOrder(b.title);
  });
  
  log('DEBUG', 'URL Extraction', {
    requestId,
    urlMatches: urlMatches.length,
    sourceUrls: sourceUrls,
    hasEvidence: aiText.includes('Evidence:'),
    detectedSource: aiText.includes('BIMei Knowledge Graph') ? 'GRAPH_TOOL_USED' : 'DATA_STORE_USED',
    aiTextSample: aiText.slice(0, 200)
  });
  
  // If we got Graph Tool raw response, convert to envelope format
  if (maybeEnvelope && maybeEnvelope.status === 'PATH_FOUND' && maybeEnvelope.graph_data) {
    return {
      version: 'bimei-envelope-v1',
      mode,
      requestId,
      sessionId,
      content_md: maybeEnvelope.answer || 'Graph relationship found.',
      evidence_html: maybeEnvelope.evidence_html || '',
      links: [],
      meta: { used_graph: true, source: 'BIMei Knowledge Graph' },
      graph_data: maybeEnvelope.graph_data,
      evidence: maybeEnvelope.evidence || {
        score: 10,
        confidence: 'High',
        semantic_type: 'Semantic Evidence',
        metrics: { hops: 1, raw: 1.0, normalised: 1, decay: 0.2 }
      }
    };
  }
  
  // If we got structured JSON envelope, use it directly
  if (maybeEnvelope && maybeEnvelope.graph_data && maybeEnvelope.evidence) {
    return {
      version: 'bimei-envelope-v1',
      mode,
      requestId,
      sessionId,
      content_md: maybeEnvelope.content_md || '',
      evidence_html: maybeEnvelope.evidence_html || '',
      links: maybeEnvelope.links || sourceUrls,
      meta: maybeEnvelope.meta || {},
      graph_data: maybeEnvelope.graph_data,
      evidence: maybeEnvelope.evidence
    };
  }

  // Fallback: Extract structured data from HTML-embedded responses
  if (aiText.includes('<span class="ont-node"')) {
    const nodeMatches = aiText.match(/<span class="ont-node"[^>]*data-type="([^"]+)"[^>]*data-id="([^"]+)"[^>]*>([^<]+)<\/span>/g);
    
    if (nodeMatches && nodeMatches.length > 1) {
      const seenIds = new Set();
      const nodes = nodeMatches.map(match => {
        const typeMatch = match.match(/data-type="([^"]+)"/);
        const idMatch = match.match(/data-id="([^"]+)"/);
        const labelMatch = match.match(/>([^<]+)<\/span>/);
        const id = idMatch ? idMatch[1] : '';
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          return {
            id: id,
            type: typeMatch ? typeMatch[1] : '',
            label: labelMatch ? labelMatch[1] : ''
          };
        }
        return null;
      }).filter(Boolean);

      const edges = [];
      // Try to extract actual relationship types from content or use generic fallback
      const relationshipMatch = aiText.match(/\*([A-Za-z_]+)\*/); // Look for *MEASURES*, *measures*, etc.
      let canonicalRelation = relationshipMatch ? relationshipMatch[1].toUpperCase() : 'CONNECTS_TO';
      
      // Map common relationship words to canonical types
      const relationMap = {
        'MEASURES': 'MEASURES',
        'CONTAINS': 'CONTAINS', 
        'LINKS_TO': 'LINKS_TO',
        'MENTIONS': 'MENTIONS',
        'PART_OF': 'PART_OF'
      };
      canonicalRelation = relationMap[canonicalRelation] || canonicalRelation;
      
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          source: nodes[i].id,
          relation: canonicalRelation,
          target: nodes[i + 1].id
        });
      }

      // Clean content_md by removing ALL evidence HTML
      let cleanContent = aiText
        .replace(/<div class="bimei-evidence-block">[\s\S]*?<\/div>/g, '')
        .replace(/Evidence:[\s\S]*$/i, '')
        .replace(/<section class="ont-evidence">[\s\S]*?<\/section>/g, '')
        .replace(/<details class="sew-details">[\s\S]*?<\/details>/g, '')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      return {
        version: 'bimei-envelope-v1',
        mode,
        requestId,
        sessionId,
        content_md: cleanContent,
        evidence_html: '',
        links: [],
        meta: { used_graph: true, source: 'BIMei Knowledge Graph' },
        graph_data: { nodes, edges },
        evidence: {
          score: 10.0,
          confidence: 'High',
          semantic_type: 'Semantic Evidence',
          metrics: {
            hops: nodes.length - 1,
            raw: 1.149,
            normalised: 1,
            decay: 0.247
          }
        }
      };
    }
  }

  // Default envelope for non-graph responses
  return {
    version: 'bimei-envelope-v1',
    mode,
    requestId,
    sessionId,
    content_md: aiText,
    evidence_html: '',
    links: sourceUrls, // Include extracted URLs with titles for Data Store responses
    meta: { source: sourceUrls.length > 0 ? 'BIMei Knowledge Base' : '' }
  };
}

functions.http('vertexProxy', async (req, res) => {
  const start = Date.now();

  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Content-Type', 'application/json; charset=utf-8');

  const requestId = crypto.randomUUID();

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userMessage = extractUserMessage(req.body);
    if (!userMessage) {
      return res.status(400).json({ error: 'No message provided' });
    }

    const sessionId = req.body && typeof req.body.sessionId === 'string' ? req.body.sessionId : null;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId from client' });
    }

    const expertMode = !!(req.body && (req.body.expertMode === true || req.body.expertMode === 'true'));
    const mode = expertMode ? 'expert' : 'default';

    const msgNoPrefix = userMessage.replace(/^\s*x:\s*/i, '').trim();
    
    // Force definition questions to use Data Store by removing x: prefix
    const isDefinitionQuery = /^(define|what is|what's|explain|describe|tell me about)\b/i.test(msgNoPrefix);
    const userMessageForCx = (expertMode && !isDefinitionQuery) ? `x: ${msgNoPrefix}` : msgNoPrefix;
    
    log('DEBUG', 'Query Routing', {
      requestId,
      originalQuery: userMessage,
      isDefinitionQuery,
      expertMode,
      finalQuery: userMessageForCx,
      forcedDataStore: isDefinitionQuery && expertMode
    });

    const projectId = process.env.PROJECT_ID || 'bimei-ai';
    const location = process.env.CX_LOCATION || 'global';
    const agentId = process.env.AGENT_ID || 'c2608896-0bd0-492e-a87b-83476edbe3ef';
    const environmentId = process.env.CX_ENVIRONMENT || 'draft';
    const languageCode = process.env.LANGUAGE_CODE || 'en';

    const sessionPath = client.projectLocationAgentEnvironmentSessionPath(
      projectId, location, agentId, environmentId, sessionId
    );

    const [dfResponse] = await client.detectIntent({
      session: sessionPath,
      queryInput: {
        text: { text: userMessageForCx },
        languageCode: languageCode,
      },
    });

    const aiText = extractAiText(dfResponse.queryResult);
    const envelope = processResponse(aiText, mode, requestId, sessionId);

    log('INFO', 'Response processed', {
      requestId,
      responseType: envelope.graph_data && envelope.evidence ? 'structured' : 'legacy',
      hasGraphData: !!envelope.graph_data,
      hasEvidence: !!envelope.evidence,
      latencyMs: Date.now() - start
    });

    return res.status(200).json({
      text: envelope.content_md || '',
      envelope,
      sessionId: sessionId,
      requestId: requestId,
      mode,
    });

  } catch (error) {
    log('ERROR', 'vertexProxy failed', {
      requestId,
      errorMessage: error && error.message ? error.message : String(error),
    });

    return res.status(500).json({
      error: 'Failed to connect to AI',
      details: error && error.message ? error.message : String(error),
      requestId: requestId,
    });
  }
});