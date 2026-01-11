const functions = require('@google-cloud/functions-framework');

// Register HTTP function
functions.http('bimei-chatbot', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Health check for GET requests
  if (req.method === 'GET') {
    res.json({ status: 'ok', message: 'BIMei Chatbot API is running', endpoints: ['POST with action: vertex-proxy or graph-query'] });
    return;
  }

  try {
    const { action } = req.body || {};
    
    if (action === 'vertex-proxy') {
      // Import and call Vertex AI Proxy
      const { SessionsClient } = require('@google-cloud/dialogflow-cx');
      const crypto = require('crypto');
      
      const client = new SessionsClient({
        apiEndpoint: 'global-dialogflow.googleapis.com',
      });
      
      // Simple vertex proxy implementation
      const userMessage = req.body?.messages?.[0]?.content || req.body?.text;
      const sessionId = req.body?.sessionId;
      
      if (!userMessage || !sessionId) {
        return res.status(400).json({ error: 'Missing message or sessionId' });
      }
      
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
          text: { text: userMessage },
          languageCode: languageCode,
        },
      });
      
      const responseText = dfResponse.queryResult?.responseMessages?.[0]?.text?.text?.[0] || 'No response';
      
      res.json({
        text: responseText,
        sessionId: sessionId,
        requestId: crypto.randomUUID()
      });
      
    } else if (action === 'graph-query') {
      // Simple graph query response
      res.json({ status: 'graph-query', message: 'Graph query functionality available' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use vertex-proxy or graph-query' });
    }
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: error.message });
  }
});