/**
 * NeoDash Adapter - Integrates LangChain-powered graph Q&A
 * Converts Flask NeoDash functionality to Node.js
 */

const { ChatVertexAI } = require('@langchain/google-vertexai');
const { GraphCypherQAChain } = require('@langchain/community/chains/graph_qa/cypher');
const { Neo4jGraph } = require('@langchain/community/graphs/neo4j_graph');

class NeoDashAdapter {
  constructor(config = {}) {
    this.config = {
      neo4jUri: config.neo4jUri || process.env.NEO4J_URI,
      neo4jUser: config.neo4jUser || process.env.NEO4J_USER,
      neo4jPassword: config.neo4jPassword || process.env.NEO4J_PASSWORD,
      googleApiKey: config.googleApiKey || process.env.GOOGLE_API_KEY,
      model: config.model || 'gemini-2.5-flash',
      ...config
    };
    
    this.graph = null;
    this.llm = null;
    this.chain = null;
    this.initialized = false;
  }

  /**
   * Initialize NeoDash adapter
   */
  async initialize() {
    try {
      // Initialize Neo4j connection
      this.graph = await Neo4jGraph.initialize({
        url: this.config.neo4jUri,
        username: this.config.neo4jUser,
        password: this.config.neo4jPassword
      });

      // Initialize Vertex AI model
      this.llm = new ChatVertexAI({
        model: this.config.model,
        apiKey: this.config.googleApiKey,
        temperature: 0,
        maxOutputTokens: 4096
      });

      // Initialize GraphCypher chain
      this.chain = GraphCypherQAChain.fromLLM({
        llm: this.llm,
        graph: this.graph,
        verbose: false,
        returnIntermediateSteps: true,
        allowDangerousRequests: true
      });

      this.initialized = true;
      console.log('NeoDash adapter initialized successfully');
      
    } catch (error) {
      console.error('NeoDash adapter initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process natural language query
   * @param {string} question - Natural language question
   * @returns {Object} Query result with answer and visualization data
   */
  async ask(question) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Generate answer and Cypher query
      const result = await this.chain.invoke({ query: question });
      
      const answer = result.result || 'No answer generated';
      const generatedCypher = result.intermediateSteps?.[0]?.query || '';
      
      // Determine visualization strategy
      const isAggregation = this.isAggregationQuery(generatedCypher);
      
      let visualData = { nodes: [], edges: [] };
      
      if (isAggregation) {
        // Safe mode: Get sample graph data
        visualData = await this.getSampleGraph();
      } else {
        // Smart mode: Use generated query for visualization
        visualData = await this.getVisualizationData(generatedCypher);
      }

      return {
        answer,
        cypher: generatedCypher,
        visual: visualData,
        isAggregation,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('NeoDash query failed:', error);
      throw new Error(`Query processing failed: ${error.message}`);
    }
  }

  /**
   * Check if query is aggregation-based
   * @param {string} cypher - Generated Cypher query
   * @returns {boolean} True if aggregation query
   */
  isAggregationQuery(cypher) {
    const aggregationKeywords = ['COUNT(', 'SUM(', 'AVG(', 'MAX(', 'MIN('];
    return aggregationKeywords.some(keyword => 
      cypher.toUpperCase().includes(keyword)
    );
  }

  /**
   * Get sample graph data for aggregation queries
   * @returns {Object} Sample visualization data
   */
  async getSampleGraph() {
    try {
      const sampleQuery = `
        MATCH (n)-[r]->(m) 
        WHERE NOT n:Chunk AND NOT m:Chunk
        RETURN n, r, m 
        LIMIT 25
      `;
      
      const result = await this.graph.query(sampleQuery);
      return this.processVisualizationResult(result);
      
    } catch (error) {
      console.warn('Sample graph query failed:', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Get visualization data from generated Cypher
   * @param {string} cypher - Generated Cypher query
   * @returns {Object} Visualization data
   */
  async getVisualizationData(cypher) {
    try {
      // Modify query to return graph objects
      const vizQuery = cypher.replace(
        /RETURN\s+.*$/i, 
        'RETURN * LIMIT 50'
      );
      
      const result = await this.graph.query(vizQuery);
      return this.processVisualizationResult(result);
      
    } catch (error) {
      console.warn('Visualization query failed, falling back to sample:', error);
      return await this.getSampleGraph();
    }
  }

  /**
   * Process Neo4j query result for visualization
   * @param {Array} result - Neo4j query result
   * @returns {Object} Processed visualization data
   */
  processVisualizationResult(result) {
    const nodes = [];
    const edges = [];
    const seenNodes = new Set();
    const seenEdges = new Set();

    result.forEach(record => {
      Object.values(record).forEach(entity => {
        // Process nodes
        if (this.isNode(entity)) {
          const nodeData = this.processNode(entity);
          if (nodeData && !seenNodes.has(nodeData.id)) {
            nodes.push(nodeData);
            seenNodes.add(nodeData.id);
          }
        }
        
        // Process relationships
        if (this.isRelationship(entity)) {
          const edgeData = this.processRelationship(entity);
          if (edgeData && !seenEdges.has(edgeData.id)) {
            edges.push(edgeData);
            seenEdges.add(edgeData.id);
          }
        }
      });
    });

    return { nodes, edges };
  }

  /**
   * Check if entity is a Neo4j node
   * @param {Object} entity - Entity to check
   * @returns {boolean} True if node
   */
  isNode(entity) {
    return entity && 
           typeof entity === 'object' && 
           (entity.labels || entity.elementId || entity.identity);
  }

  /**
   * Check if entity is a Neo4j relationship
   * @param {Object} entity - Entity to check
   * @returns {boolean} True if relationship
   */
  isRelationship(entity) {
    return entity && 
           typeof entity === 'object' && 
           entity.type && 
           (entity.start || entity.startNodeElementId) && 
           (entity.end || entity.endNodeElementId);
  }

  /**
   * Process Neo4j node for visualization
   * @param {Object} node - Neo4j node
   * @returns {Object} Processed node data
   */
  processNode(node) {
    try {
      const nodeId = node.elementId || 
                     node.identity?.toString() || 
                     node.id?.toString();
      
      if (!nodeId) return null;

      const props = node.properties || {};
      const labels = node.labels || [];
      
      // Smart caption selection
      const caption = props.name || 
                     props.title || 
                     props.label || 
                     labels[0] || 
                     'Node';
      
      const group = labels[0] || 'Generic';
      
      return {
        id: nodeId,
        label: caption.length > 30 ? caption.substring(0, 30) + '...' : caption,
        group,
        title: this.formatNodeTooltip(props, labels),
        size: this.getNodeSize(group),
        color: this.getNodeColor(group)
      };
      
    } catch (error) {
      console.warn('Node processing failed:', error);
      return null;
    }
  }

  /**
   * Process Neo4j relationship for visualization
   * @param {Object} rel - Neo4j relationship
   * @returns {Object} Processed edge data
   */
  processRelationship(rel) {
    try {
      const relId = rel.elementId || 
                    rel.identity?.toString() || 
                    rel.id?.toString();
      
      if (!relId) return null;

      const startId = rel.startNodeElementId || 
                      rel.start?.elementId || 
                      rel.start?.toString();
      
      const endId = rel.endNodeElementId || 
                    rel.end?.elementId || 
                    rel.end?.toString();
      
      if (!startId || !endId) return null;

      return {
        id: relId,
        from: startId,
        to: endId,
        label: rel.type || 'RELATED',
        title: this.formatRelationshipTooltip(rel)
      };
      
    } catch (error) {
      console.warn('Relationship processing failed:', error);
      return null;
    }
  }

  /**
   * Format node tooltip
   * @param {Object} props - Node properties
   * @param {Array} labels - Node labels
   * @returns {string} Formatted tooltip
   */
  formatNodeTooltip(props, labels) {
    const lines = [];
    
    if (labels.length) {
      lines.push(`Type: ${labels.join(', ')}`);
    }
    
    Object.entries(props).slice(0, 5).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length < 100) {
        lines.push(`${key}: ${value}`);
      }
    });
    
    return lines.join('\n');
  }

  /**
   * Format relationship tooltip
   * @param {Object} rel - Relationship object
   * @returns {string} Formatted tooltip
   */
  formatRelationshipTooltip(rel) {
    const props = rel.properties || {};
    const lines = [`Type: ${rel.type}`];
    
    Object.entries(props).slice(0, 3).forEach(([key, value]) => {
      lines.push(`${key}: ${value}`);
    });
    
    return lines.join('\n');
  }

  /**
   * Get node size based on type
   * @param {string} group - Node group/type
   * @returns {number} Node size
   */
  getNodeSize(group) {
    const sizeMap = {
      'Construct': 30,
      'InformationUse': 28,
      'ActionStatement': 26,
      'DictionaryItem': 24,
      'Content': 20,
      'Resource': 18
    };
    
    return sizeMap[group] || 22;
  }

  /**
   * Get node color based on type
   * @param {string} group - Node group/type
   * @returns {string} Node color
   */
  getNodeColor(group) {
    const colorMap = {
      'Construct': '#3498db',
      'InformationUse': '#e74c3c',
      'ActionStatement': '#2ecc71',
      'DictionaryItem': '#f39c12',
      'Content': '#9b59b6',
      'Deliverable': '#e67e22',
      'Resource': '#1abc9c'
    };
    
    return colorMap[group] || '#95a5a6';
  }

  /**
   * Close connections
   */
  async close() {
    if (this.graph) {
      await this.graph.close();
    }
    this.initialized = false;
  }

  /**
   * Health check
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return { status: 'not_initialized' };
      }

      // Test Neo4j connection
      await this.graph.query('RETURN 1 as test');
      
      return { 
        status: 'healthy',
        neo4j: 'connected',
        model: this.config.model
      };
      
    } catch (error) {
      return { 
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = NeoDashAdapter;