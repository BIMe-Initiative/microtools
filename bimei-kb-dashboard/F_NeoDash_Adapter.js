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
      console.log('Initializing NeoDash adapter with config:', {
        neo4jUri: this.config.neo4jUri ? '***' : 'MISSING',
        neo4jUser: this.config.neo4jUser || 'MISSING',
        model: this.config.model
      });

      // Validate required config
      if (!this.config.neo4jUri || !this.config.neo4jUser || !this.config.neo4jPassword) {
        throw new Error('Missing required Neo4j connection details. Check NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables.');
      }

      // Initialize Neo4j connection
      this.graph = await Neo4jGraph.initialize({
        url: this.config.neo4jUri,
        username: this.config.neo4jUser,
        password: this.config.neo4jPassword
      });

      // Refresh schema so LangChain knows the graph structure
      await this.graph.refreshSchema();
      console.log('Neo4j schema refreshed successfully');
      console.log('Schema:', this.graph.schema);

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
        verbose: true,
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
      console.log('Processing question:', question);
      const result = await this.chain.invoke({ query: question });

      const answer = result.result || 'No answer generated';
      const rawCypher = result.intermediateSteps?.[0]?.query || '';
      const generatedCypher = this.cleanCypher(rawCypher);

      console.log('LangChain result:', {
        answer: answer.substring(0, 200),
        rawCypher: rawCypher.substring(0, 500),
        generatedCypher: generatedCypher.substring(0, 500)
      });

      // Determine visualization strategy
      const isAggregation = this.isAggregationQuery(generatedCypher);
      console.log('Query type:', isAggregation ? 'aggregation' : 'graph');

      let visualData = { nodes: [], edges: [] };

      if (isAggregation) {
        // Safe mode: Get sample graph data
        console.log('Using sample graph for aggregation query');
        visualData = await this.getSampleGraph();
      } else {
        // Smart mode: Use generated query for visualization
        console.log('Getting visualization data from generated query');
        visualData = await this.getVisualizationData(generatedCypher);
      }

      console.log('Final visual data:', {
        nodeCount: visualData.nodes.length,
        edgeCount: visualData.edges.length
      });

      // If LangChain couldn't generate an answer, create one from the visual data
      let finalAnswer = answer;
      if (answer === "I don't know the answer." && visualData.edges.length > 0) {
        // Generate answer from edges - sort alphabetically
        const edgeDescriptions = visualData.edges
          .map(edge => {
            const fromNode = visualData.nodes.find(n => n.id === edge.from);
            const toNode = visualData.nodes.find(n => n.id === edge.to);
            const relationLabel = edge.label || 'RELATED';
            return {
              text: `${fromNode?.label || 'Node'} <span style="font-family: 'Courier New', monospace; background: #ffffff; padding: 2px 4px; border-radius: 4px; font-size: 0.85em; color: #475569;">${relationLabel}</span> ${toNode?.label || 'Node'}`,
              sortKey: `${fromNode?.label}-${relationLabel}-${toNode?.label}`
            };
          })
          .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
          .map(item => item.text);

        finalAnswer = edgeDescriptions.join('<br style="line-height: 1.2;">');
        console.log('Generated answer from visual data:', finalAnswer.substring(0, 200));
      }

      return {
        answer: finalAnswer,
        cypher: visualData.modifiedQuery || generatedCypher,
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
   * Clean Cypher query by removing markdown code fences and extra whitespace
   * @param {string} cypher - Raw Cypher query
   * @returns {string} Cleaned Cypher query
   */
  cleanCypher(cypher) {
    if (!cypher) return '';

    return cypher
      .replace(/^```cypher\s*/i, '')  // Remove opening code fence
      .replace(/^cypher\s*/i, '')     // Remove 'cypher' prefix
      .replace(/```\s*$/, '')         // Remove closing code fence
      .trim();
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
      // Extract nodes from the original query to find relationships
      let vizQuery = cypher.trim();

      // Fix the RETURN clause to include nodes and relationships for visualization
      // LangChain often generates queries like "RETURN type(r) AS relationshipType"
      // We need "RETURN n1, n2, type(r) AS relationshipType, r" to visualize
      if (vizQuery.match(/MATCH\s+\((\w+)\)\s*-\[(\w+)\]-\s*\((\w+)\)/i)) {
        const match = vizQuery.match(/MATCH\s+\((\w+)\)\s*-\[(\w+)\]-\s*\((\w+)\)/i);
        const [, node1Var, relVar, node2Var] = match;

        // Replace the RETURN clause to include nodes and relationship
        vizQuery = vizQuery.replace(
          /RETURN\s+.+$/i,
          `RETURN ${node1Var}, ${node2Var}, type(${relVar}) AS relationshipType, ${relVar}`
        );
        console.log('Modified query to include nodes:', vizQuery);
      }

      // If the query doesn't have a LIMIT, add one to prevent overwhelming results
      if (!vizQuery.match(/LIMIT\s+\d+/i)) {
        vizQuery = vizQuery + ' LIMIT 50';
      }

      console.log('Running visualization query:', vizQuery);
      const result = await this.graph.query(vizQuery);

      // Process initial results
      const processed = this.processVisualizationResult(result);

      // If we have nodes but no edges, try to find relationships using node names
      if (processed.nodes.length >= 2 && processed.edges.length === 0) {
        console.log('No edges found, querying for relationships using node names...');

        // Extract unique node names
        const nodeNames = [...new Set(processed.nodes.map(n => n.label).filter(Boolean))];
        console.log('Searching for relationships between:', nodeNames);

        // Query for Construct nodes (which have the canonical relationships)
        const relationshipQuery = `
          UNWIND $nodeNames as name1
          UNWIND $nodeNames as name2
          WITH name1, name2
          WHERE name1 <> name2
          MATCH (n1:Construct) WHERE n1.name = name1
          MATCH (n2:Construct) WHERE n2.name = name2
          MATCH path = (n1)-[r]-(n2)
          RETURN n1, n2, type(r) as relationshipType, r
          LIMIT 50
        `;

        const relResult = await this.graph.query(relationshipQuery, { nodeNames });
        console.log('Relationship query returned:', relResult?.length || 0, 'records');

        if (relResult && relResult.length > 0) {
          const relData = this.processVisualizationResult(relResult);

          // Replace Generic nodes with Construct nodes that have relationships
          if (relData.nodes.length > 0) {
            // Remove Generic nodes with same names as Construct nodes
            const constructNames = new Set(relData.nodes.map(n => n.label));
            processed.nodes = processed.nodes.filter(n => !constructNames.has(n.label));

            // Add Construct nodes
            processed.nodes.push(...relData.nodes);
          }

          // Add edges
          processed.edges.push(...relData.edges);
          console.log(`Added ${relData.nodes.length} Construct nodes and ${relData.edges.length} edges from relationship query`);
        }
      }

      // Enhance with shared parent nodes (NEW - Phase 2)
      if (processed.nodes.length >= 2) {
        try {
          // Extract node properties to find common parents
          const nodes = processed.nodes.slice(0, 5);
          console.log('Looking for shared parents among nodes:', nodes.map(n => ({ id: n.id, label: n.label, group: n.group })));

          // Use elementId if available, otherwise try to extract numeric ID
          const nodeIdentifiers = nodes.map(n => {
            // If ID is elementId format, extract the numeric part
            if (typeof n.id === 'string' && n.id.includes(':')) {
              const parts = n.id.split(':');
              return parts[parts.length - 1];
            }
            return n.id;
          });

          const sharedParentQuery = `
            UNWIND $nodeIds as nodeIdStr
            MATCH (n)
            WHERE (id(n) = toInteger(nodeIdStr) OR elementId(n) = nodeIdStr)
            MATCH (parent)-[r]->(n)
            WHERE NOT parent:Chunk
            WITH parent, collect(DISTINCT n) as children, collect(DISTINCT type(r)) as relTypes
            WHERE size(children) >= 2
            RETURN parent, children, relTypes
            LIMIT 10
          `;

          console.log('Shared parent query with node identifiers:', nodeIdentifiers);
          const parentResult = await this.graph.query(sharedParentQuery, { nodeIds: nodeIdentifiers });
          console.log('Shared parent query returned:', parentResult?.length || 0, 'records');

          if (parentResult && parentResult.length > 0) {
            const parentData = this.processVisualizationResult(parentResult);

            // Merge parent nodes and edges
            const nodeMap = new Map(processed.nodes.map(n => [n.id, n]));
            parentData.nodes.forEach(pn => {
              if (!nodeMap.has(pn.id)) {
                processed.nodes.push(pn);
              }
            });
            processed.edges.push(...parentData.edges);

            console.log(`Added ${parentData.nodes.length} parent nodes, ${parentData.edges.length} parent edges`);
          } else {
            console.log('No shared parents found');
          }
        } catch (parentError) {
          console.warn('Shared parent query failed:', parentError);
        }
      }

      // If we got nodes and edges, return them with the modified query
      if (processed.nodes.length > 0) {
        console.log(`Visualization successful: ${processed.nodes.length} nodes, ${processed.edges.length} edges`);
        processed.modifiedQuery = vizQuery;
        return processed;
      }

      // If no graph data was returned, try to modify the query
      console.log('No graph objects in result, trying to modify RETURN clause');
      const modifiedQuery = cypher.replace(
        /RETURN\s+.*$/i,
        'RETURN * LIMIT 50'
      );

      const retryResult = await this.graph.query(modifiedQuery);
      const retryProcessed = this.processVisualizationResult(retryResult);

      if (retryProcessed.nodes.length > 0) {
        console.log(`Modified query successful: ${retryProcessed.nodes.length} nodes, ${retryProcessed.edges.length} edges`);
        return retryProcessed;
      }

      // Still no results, fall back to sample
      console.log('No visualization data found, using sample graph');
      return await this.getSampleGraph();

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

    console.log(`Processing ${result.length} result records`);

    result.forEach((record, idx) => {
      console.log(`Record ${idx}:`, Object.keys(record));

      // Special handling for n1-r-n2 pattern (common in relationship queries)
      if (record.n1 && record.n2 && record.relationshipType) {
        const node1 = this.processNode(record.n1);
        const node2 = this.processNode(record.n2);

        if (node1 && !seenNodes.has(node1.id)) {
          nodes.push(node1);
          seenNodes.add(node1.id);
        }

        if (node2 && !seenNodes.has(node2.id)) {
          nodes.push(node2);
          seenNodes.add(node2.id);
        }

        // Create edge from n1 to n2
        if (node1 && node2) {
          const edgeId = `${node1.id}-${record.relationshipType}-${node2.id}`;
          if (!seenEdges.has(edgeId)) {
            edges.push({
              id: edgeId,
              from: node1.id,
              to: node2.id,
              label: record.relationshipType || 'RELATED',
              title: `Type: ${record.relationshipType}`
            });
            seenEdges.add(edgeId);
          }
        }

        return; // Skip generic processing for this record
      }

      // Generic processing for all entities in the record
      Object.entries(record).forEach(([key, entity]) => {
        // Skip non-object values (like strings, numbers, etc.)
        if (!entity || typeof entity !== 'object') {
          return;
        }

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

    console.log(`Processed: ${nodes.length} nodes, ${edges.length} edges`);
    return { nodes, edges };
  }

  /**
   * Check if entity is a Neo4j node
   * @param {Object} entity - Entity to check
   * @returns {boolean} True if node
   */
  isNode(entity) {
    if (!entity || typeof entity !== 'object') return false;

    // Check for standard Neo4j node properties
    if (entity.labels || entity.elementId || entity.identity) {
      return true;
    }

    // LangChain may return plain objects - check for typical node properties
    // Nodes usually have properties like 'name', 'title', 'id', etc.
    const nodeKeys = Object.keys(entity);
    const hasNodeProperties = nodeKeys.some(key =>
      ['name', 'title', 'label', 'id', 'content_id'].includes(key)
    );

    return hasNodeProperties && nodeKeys.length > 0;
  }

  /**
   * Check if entity is a Neo4j relationship
   * @param {Object} entity - Entity to check
   * @returns {boolean} True if relationship
   */
  isRelationship(entity) {
    if (!entity || typeof entity !== 'object') return false;

    // Check for standard Neo4j relationship properties
    if (entity.type && (entity.start || entity.startNodeElementId) && (entity.end || entity.endNodeElementId)) {
      return true;
    }

    // LangChain may return empty objects for relationships
    // Skip empty objects
    return false;
  }

  /**
   * Process Neo4j node for visualization
   * @param {Object} node - Neo4j node
   * @returns {Object} Processed node data
   */
  processNode(node) {
    try {
      // Handle both Neo4j objects and plain JavaScript objects from LangChain
      const nodeId = node.elementId ||
                     node.identity?.toString() ||
                     node.id?.toString() ||
                     node.content_id?.toString() ||
                     JSON.stringify(node);  // Fallback: use stringified object as ID

      if (!nodeId) return null;

      // Properties might be nested or at root level
      const props = node.properties || node;
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
        title: this.formatNodeTooltip(props),
        size: this.getNodeSize(group),
        color: this.getNodeColor(group),
        granularity: props.granularity,  // Pass granularity to frontend
        properties: props  // Pass all properties for expandable tooltip
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
  formatNodeTooltip(props) {
    const lines = [];

    // Show name (or title/label as fallback)
    const name = props.name || props.title || props.label;
    if (name) {
      lines.push(name);
    }

    // Show granularity if available
    if (props.granularity) {
      lines.push(`Granularity: ${props.granularity}`);
    }

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