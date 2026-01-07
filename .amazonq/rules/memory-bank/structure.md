# BIMei Chatbot - Project Structure

## Directory Organization

```
Chatbot_Active_Files/
├── .amazonq/rules/memory-bank/     # Documentation and rules
├── A_Chatbot_CustomUI_OLD.html     # Legacy UI implementation
├── B_Chatbot_CustomUI_251230.html  # Current custom web interface
├── C_Vertex_AI_Proxy_251230.js     # Vertex AI integration layer
├── D_GraphQuery_251230.js          # Neo4j graph database queries
├── E_VertexAI_DefaultPlaybook_251230.md    # Main assistant playbook
├── F_VertexAI_KnowledgeGraph_Handler_Playbook_251230.md  # Graph specialist playbook
└── G_Graph_Tool_251230.yaml        # Graph tool configuration
```

## Core Components and Relationships

### Frontend Layer
- **B_Chatbot_CustomUI_251230.html**: Main user interface providing the conversational experience
- **A_Chatbot_CustomUI_OLD.html**: Previous version maintained for reference and rollback capability

### Backend Integration Layer
- **C_Vertex_AI_Proxy_251230.js**: Handles communication with Google Cloud Vertex AI services
- **D_GraphQuery_251230.js**: Manages Neo4j database connections and graph query execution

### Configuration and Logic Layer
- **E_VertexAI_DefaultPlaybook_251230.md**: Primary assistant behavior and routing logic
- **F_VertexAI_KnowledgeGraph_Handler_Playbook_251230.md**: Specialized graph query handler
- **G_Graph_Tool_251230.yaml**: Tool configuration for graph operations

## Architectural Patterns

### Playbook-Driven Architecture
The system uses markdown-based playbooks to define assistant behavior, enabling:
- Clear separation of logic from implementation
- Easy modification of conversational flows
- Version-controlled behavior definitions

### Microservice Integration Pattern
- Vertex AI Proxy acts as a service layer for AI operations
- Graph Query component provides specialized database access
- Modular design allows independent scaling and maintenance

### Routing and Specialization Pattern
- Main assistant handles general queries and routing decisions
- Specialized handlers (Graph Specialist) manage complex domain-specific operations
- Clear trigger-based routing ensures appropriate handler selection

### Evidence-Based Response Pattern
- All responses include traceable evidence sources
- Structured output format with consistent evidence blocks
- Token-limited responses ensure performance and readability

## Component Interactions

1. **User Query Flow**: UI → Vertex AI Proxy → Playbook Logic → Response
2. **Graph Query Flow**: Playbook → Graph Tool → Neo4j Database → Structured Evidence
3. **Configuration Flow**: YAML Config → JavaScript Implementation → Runtime Behavior

This architecture supports scalable, maintainable, and evidence-based conversational AI for BIM domain expertise.