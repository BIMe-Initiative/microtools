# Knowledge Graph Project Memory

## Project Overview
A Streamlit-based knowledge graph visualization tool that connects to Neo4j Aura database, featuring natural language query processing, professional UI design, and weighted relationship visualization.

## Current Architecture

### Core Files
- **app.py**: Main Streamlit application with professional UI, Neo4j connectivity, and natural language processing
- **neo4j_client.py**: Neo4j client wrapper with query methods and connection handling
- **requirements.txt**: Dependencies including neo4j, google-cloud-storage, streamlit-agraph, watchdog
- **.streamlit/secrets.toml**: Neo4j Aura connection credentials

### Database Configuration
- **Neo4j Aura Instance**: neo4j+s://4441767a.databases.neo4j.io
- **Node Types**: Content nodes with properties (title, name, description, category)
- **Relationship Weights**: Stored in GCS at bimei-kg-config/weights/weights-v1.json
- **Data Filtering**: Chunk nodes hidden from visualization

### UI Design Principles
- **Layout**: Professional horizontal input section inspired by UI_sample.html
- **Styling**: Roboto font, gradient header, structured property panels
- **Graph Controls**: Overlay controls for layout, physics, reset functionality
- **Node Details**: Right panel with property grid and expand functionality
- **Visual Feedback**: Status badges, dynamic Cypher display, loading states

## Key Features Implemented

### Natural Language Processing
- Pattern matching for common queries ("connection between X and Y")
- Automatic Cypher query generation
- Dynamic query display with syntax highlighting

### Graph Visualization
- **Library**: streamlit-agraph for interactive graph rendering
- **Node Sizing**: Based on relationship count (15-35 range)
- **Edge Weights**: Thickness based on relationship weights (2-6px range)
- **Physics**: Disabled by default for stable node positioning
- **Filtering**: Chunk nodes excluded from visualization

### Professional UI Elements
- Gradient header with project branding
- Horizontal input layout with query, limit, and run controls
- Overlay graph controls (layout, physics, reset)
- Structured node details panel with property grid
- Quick start buttons for common queries
- Dynamic Cypher code display

## Technical Decisions

### Performance Optimizations
- Node limit controls (5-100 range)
- Efficient Neo4j query patterns
- Cached relationship weights from GCS
- Selective property display (first 8 properties)

### User Experience
- Nodes stay positioned when dragged (physics disabled)
- Selected node highlighting with size increase
- Truncated text display with ellipsis for long content
- Responsive design with column layouts

### Data Integration
- Google Cloud Storage for relationship weights
- Neo4j Aura for graph database
- JSON-based weight configuration with 79+ relationship types

## Recent Updates
- **Complete UI Redesign**: Transformed from basic Streamlit to professional layout
- **Enhanced Node Details**: Property grid with badges and structured display
- **Dynamic Cypher Display**: Real-time query generation feedback
- **Improved Graph Controls**: Overlay controls with layout options
- **Visual Hierarchy**: Professional styling matching HTML sample design

## Configuration Files
- **Weights Config**: `/Users/bilalsuccar/Documents/microtools/common/BIMei_Ontology_Weights_v1_Backup_260103.json`
- **UI Reference**: `/Users/bilalsuccar/Documents/microtools/common/UI_sample.html`
- **Secrets**: `.streamlit/secrets.toml` with Neo4j credentials

## Next Potential Improvements
- Advanced query builder interface
- Export functionality for graph data
- Additional layout algorithms
- Enhanced filtering options
- Performance metrics dashboard

---
*Last Updated: January 2025*
*Update this file whenever significant changes are made to the project*