# BIMei Microtools Collection

A collection of specialized tools and applications for Building Information Modelling (BIM) knowledge management, graph visualization, and adaptive maturity assessment. These tools support the BIM Excellence Initiative's mission to advance BIM practices through innovative technology.

**Organization**: [BIM Excellence Initiative](https://BIMexcellence.org)
**License**: Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

---

## Overview

This repository contains independent microtools designed for:
- Knowledge graph construction, querying, and visualization
- Interactive dashboards for knowledge base exploration
- Adaptive maturity assessment for BIM organizations
- Graph-based conversational AI interfaces
- Neo4j database integration and management

Each tool is designed to be modular, deployable independently, and focused on a specific use case.

---

## Tools & Applications

### Knowledge Graph & Database Tools

#### [vertex-graph-builder](vertex-graph-builder/)
**Purpose**: Build and populate Neo4j knowledge graphs from web content using Google Vertex AI
**Stack**: Node.js, Neo4j, Google Vertex AI
**Status**: Active

#### [knowledge_graph_streamlit_viewer](knowledge_graph_streamlit_viewer/)
**Purpose**: Interactive Streamlit application for visualizing and exploring Neo4j knowledge graphs
**Stack**: Python, Streamlit, Neo4j, streamlit-agraph
**Status**: Active

#### [neodash-viewer](neodash-viewer/)
**Purpose**: Embedded Neo4j graph visualization dashboard
**Stack**: HTML/JavaScript, Neo4j
**Status**: Active

---

### Dashboard & Query Interfaces

#### [bimei-kb-dashboard](bimei-kb-dashboard/)
**Purpose**: Comprehensive multi-module dashboard for querying the BIMei knowledge base with AI-powered responses
**Stack**: HTML/CSS/JavaScript, Node.js Cloud Functions, Neo4j, Google Vertex AI
**Live**: [Dashboard](https://storage.googleapis.com/bimei-kb-dashboard/index.html)
**Status**: Production (v1.0.5)
**Documentation**: Excellent - see [README](bimei-kb-dashboard/README.md)

---

### Conversational AI Chatbots

#### [bimei-vertex-cx-chatbot](bimei-vertex-cx-chatbot/)
**Purpose**: Intelligent conversational interface for BIMei knowledge base with WordPress integration
**Stack**: Node.js, Google Vertex AI, Neo4j
**Status**: Active

#### [vertex_cx_chatbot](vertex_cx_chatbot/)
**Purpose**: Alternative implementation of Vertex AI chatbot with graph query capabilities
**Stack**: Node.js, Google Vertex AI, Neo4j
**Status**: Active

---

### Assessment & Measurement Tools

#### [adaptive-maturity-assessment-amis](adaptive-maturity-assessment-amis/)
**Purpose**: Interactive web application for measuring organizational adaptive maturity in BIM contexts
**Stack**: React, Vite, Recharts
**Status**: Active (v1.0)
**Related**: [BIM Thinkspace Episode 28](https://BIMexcellence.org/measuring-adaptive-maturity)

#### [adaptive-maturity-map](adaptive-maturity-map/)
**Purpose**: Visualization and mapping tool for adaptive maturity assessment results
**Stack**: React, Vite
**Status**: Active

---

### Widget & Embedding Tools

#### [adaptive-maturity-matrix](adaptive-maturity-matrix/)
**Purpose**: Embeddable Adaptive Maturity Matrix widget for external websites
**Stack**: HTML/JavaScript/CSS
**Status**: Active

---

## Quick Start

### Prerequisites

Most tools require:
- **Node.js 20+** (for JavaScript/Node.js applications)
- **Python 3.8+** (for Python applications)
- **Google Cloud SDK** (for GCP-deployed services)
- **Neo4j Database** (AuraDB or self-hosted)
- **Google Cloud Project** with Vertex AI enabled

### General Setup Pattern

Each tool follows a similar setup pattern:

1. **Navigate to the tool directory**
   ```bash
   cd <tool-name>
   ```

2. **Copy environment template**
   ```bash
   cp .env.example .env
   # or for YAML configs:
   cp .env.example.yaml .env.yaml
   ```

3. **Configure credentials**
   - Add your Neo4j connection details
   - Add Google Cloud API keys
   - Configure service-specific variables

4. **Install dependencies**
   ```bash
   # Node.js projects
   npm install

   # Python projects
   pip install -r requirements.txt
   ```

5. **Run locally or deploy**
   - See individual tool READMEs for specific instructions

---

## Technology Stack

### Databases
- **Neo4j AuraDB** - Graph database for knowledge representation
- **Neo4j Graph Data Science** - Graph analytics and algorithms

### AI & Machine Learning
- **Google Vertex AI** - Gemini models for natural language processing
- **LangChain** - Framework for building LLM-powered applications
- **Google Generative AI** - Embedding and generation APIs

### Frontend Frameworks
- **React** - Interactive web applications
- **Streamlit** - Python-based data visualization apps
- **Vite** - Modern build tool for React applications
- **Tailwind CSS** - Utility-first CSS framework

### Backend & Cloud
- **Node.js** - Server-side JavaScript runtime
- **Google Cloud Functions** - Serverless compute (Gen2)
- **Google Cloud Run** - Container-based deployments
- **Google Cloud Storage** - Static file hosting

### Visualization
- **Recharts** - React charting library
- **vis-network** - Interactive graph visualization
- **streamlit-agraph** - Graph visualization for Streamlit

---

## Architecture Patterns

### Common Patterns Across Tools

1. **Environment-based Configuration**
   - All credentials stored in `.env` or `.env.yaml` files
   - Template files (`.env.example`) provided for reference
   - Never commit credentials to version control

2. **Neo4j Integration**
   - Consistent connection patterns using `neo4j` driver
   - Support for Neo4j AuraDB (neo4j+s:// protocol)
   - LangChain integration for graph querying

3. **Google Cloud Deployment**
   - Cloud Functions for serverless APIs
   - Cloud Run for containerized services
   - Cloud Storage for static hosting

4. **Modular Design**
   - Independent tools with focused responsibilities
   - Shared patterns and best practices
   - RESTful APIs for inter-service communication

---

## Security

### Credential Management
- All API keys and passwords stored in environment variables
- `.env` and `.env.yaml` files excluded from version control
- Service account keys never committed to repository
- See [SECURITY.md](SECURITY.md) for security policy

### Best Practices
- Use `.env.example` templates for setup
- Rotate credentials regularly
- Enable HTTPS for all production deployments
- Use Google Cloud IAM for access control
- Review [SECURITY.md](SECURITY.md) for reporting vulnerabilities

---

## Development

### Repository Structure

```text
microtools/
├── adaptive-maturity-assessment-amis/  # React assessment tool
├── adaptive-maturity-map/             # React visualization tool
├── adaptive-maturity-matrix/          # Embeddable widget
├── bimei-kb-dashboard/                # Production dashboard
├── bimei-vertex-cx-chatbot/           # Vertex chatbot v1
├── knowledge_graph_streamlit_viewer/  # Streamlit graph viewer
├── neodash-viewer/                    # Neo4j dashboard embed
├── vertex-graph-builder/              # Graph construction tool
├── vertex_cx_chatbot/                 # Vertex chatbot v2
├── _archived/                         # Archived experiments
├── SECURITY.md                        # Security policy
└── README.md                          # This file
```

### Contributing

This repository is maintained by the BIM Excellence Initiative team for educational and research purposes.

**For BIMei Team Members**:
1. Pull latest changes before starting work
2. Test all changes locally before deploying
3. Update version numbers in affected tools
4. Document changes in tool-specific READMEs
5. Commit with clear, descriptive messages

**For External Contributors**:
- This is a research/educational repository
- Feel free to fork and adapt for your own use
- Refer to LICENSE for usage terms
- Submit issues for bugs or questions

---

## Documentation

### Tool-Specific Documentation
Each tool directory contains its own README with:
- Detailed setup instructions
- Configuration examples
- API documentation (where applicable)
- Deployment guides
- Troubleshooting tips

### Highlighted Documentation
- [bimei-kb-dashboard/README.md](bimei-kb-dashboard/README.md) - Comprehensive dashboard documentation
- [bimei-kb-dashboard/DEPLOYMENT.md](bimei-kb-dashboard/DEPLOYMENT.md) - Detailed deployment guide
- [SECURITY.md](SECURITY.md) - Security policy and best practices

---

## Related Resources

### BIM Excellence Initiative
- **Website**: [https://BIMexcellence.org](https://BIMexcellence.org)
- **BIM Thinkspace Podcast**: Educational content on BIM practices
- **Knowledge Base**: Graph-based BIM knowledge repository

### Technologies
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Google Vertex AI](https://cloud.google.com/vertex-ai/docs)
- [LangChain Documentation](https://python.langchain.com/)
- [Streamlit Documentation](https://docs.streamlit.io/)
- [React Documentation](https://react.dev/)

---

## Support

**For Tool Issues**: See individual tool README files
**Security Vulnerabilities**: See [SECURITY.md](SECURITY.md)
**BIMei Project**: Contact BIM Excellence Initiative

---

## License

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)

This work is licensed under CC BY-NC-SA 4.0. See https://creativecommons.org/licenses/by-nc-sa/4.0/ for details.

---

## Acknowledgments

Built with:
- Google Cloud Platform (Vertex AI, Cloud Functions, Cloud Run)
- Neo4j Graph Database
- LangChain Framework
- React and Streamlit frameworks
- Open source libraries and tools

Developed by the BIM Excellence Initiative team to advance BIM knowledge management and organizational maturity assessment.
