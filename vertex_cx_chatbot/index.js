const functions = require('@google-cloud/functions-framework');

// Import handlers
const { graphQuery } = require('./D_GraphQuery_260106_fixed');

// Register graphQuery function
functions.http('graphQuery', graphQuery);

// Load the structured proxy (it self-registers as 'vertexProxy')
require('./C_Vertex_AI_Proxy_070125_Structured');

console.log('BIMei Chatbot functions registered successfully');
// Functions available: graphQuery, vertexProxy
