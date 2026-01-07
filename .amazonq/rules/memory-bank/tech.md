# BIMei Chatbot - Technology Stack

## Programming Languages and Versions

### Primary Languages
- **JavaScript (ES6+)**: Core backend logic and API integration
- **HTML5**: Frontend user interface with modern web standards
- **Markdown**: Configuration and playbook definitions
- **YAML**: Tool configuration and structured data

### Language-Specific Features Used
- **JavaScript**: Async/await patterns, modern module syntax, API integration
- **HTML**: Custom CSS styling, responsive design, interactive elements
- **Markdown**: Structured documentation with embedded logic definitions

## Technology Stack

### Cloud Services
- **Google Cloud Vertex AI**: Primary AI/ML service for natural language processing
- **Neo4j Database**: Graph database for knowledge relationships and path queries

### Frontend Technologies
- **Vanilla HTML/CSS/JavaScript**: Lightweight, dependency-free frontend
- **Responsive Web Design**: Mobile-friendly interface
- **Custom CSS Framework**: BIMei-specific styling and branding

### Backend Integration
- **RESTful API Integration**: Vertex AI service communication
- **Graph Database Connectivity**: Neo4j Cypher query execution
- **Proxy Pattern Implementation**: Service abstraction layer

## Build Systems and Dependencies

### Development Environment
- **No Build System Required**: Direct file execution and deployment
- **Version Control**: Git-based with date-stamped file naming (YYMMDD format)
- **Configuration Management**: YAML and Markdown-based configuration

### External Dependencies
- **Google Cloud SDK**: For Vertex AI authentication and API access
- **Neo4j Driver**: JavaScript driver for graph database connectivity
- **Web Browser**: Modern browser with ES6+ support for frontend

### Deployment Requirements
- **Web Server**: Static file serving capability
- **HTTPS Support**: Required for secure API communications
- **Cloud Access**: Network connectivity to Google Cloud and Neo4j services

## Development Commands and Workflows

### Local Development
```bash
# No build process required - direct file editing
# Serve files via local web server for testing
python -m http.server 8000  # or equivalent static server
```

### Configuration Updates
```bash
# Edit playbook files directly
vim E_VertexAI_DefaultPlaybook_251230.md
vim F_VertexAI_KnowledgeGraph_Handler_Playbook_251230.md

# Update tool configuration
vim G_Graph_Tool_251230.yaml
```

### Version Management
- **File Naming Convention**: `ComponentName_YYMMDD.extension`
- **Legacy Preservation**: Previous versions kept with `_OLD` suffix
- **Configuration Sync**: Ensure all components use consistent date stamps

## Performance Considerations
- **Token Limits**: Strict response size limits (120-150 words default, 300 words expert)
- **Caching Strategy**: Client-side caching for repeated queries
- **Lazy Loading**: On-demand component initialization
- **Error Handling**: Graceful degradation with fallback responses

This technology stack prioritizes simplicity, maintainability, and direct integration with cloud AI services while avoiding complex build processes or heavy framework dependencies.