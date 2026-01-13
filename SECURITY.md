# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in this project, please report it responsibly:

**Email**: [Contact through GitHub Issues](https://github.com/BIMe-Initiative/microtools/issues)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fixes (if any)

We will respond to security reports within 48 hours and work to address confirmed vulnerabilities promptly.

---

## Supported Versions

The current version in the `main` branch is supported. See README for version information.

---

## Security Best Practices

This repository contains example code for educational and research purposes. When deploying these tools:

### Credential Management
- **NEVER** commit credentials, API keys, or secrets to version control
- Always use environment variables for sensitive configuration
- See `.env.example` files in each project directory for required variables
- Use Google Cloud Secret Manager or similar services for production deployments

### Required Environment Variables
Each project requires specific environment variables. Check the `.env.example` files:
- `bimei-kb-dashboard/.env.example.yaml` - Dashboard application
- `vertex_cx_chatbot/.env.example.yaml` - Chatbot service
- `vertex-graph-builder/.env.example` - Graph builder service
- `knowledge_graph_streamlit_viewer/.env.example` - Streamlit viewer

### Service Account Keys
- **NEVER** commit service account JSON key files
- Use Workload Identity or Application Default Credentials when possible
- Rotate service account keys regularly
- Limit service account permissions to minimum required

### Neo4j Database
- Use strong, unique passwords for database access
- Enable TLS/SSL for all database connections (`neo4j+s://` protocol)
- Restrict network access to authorized IPs only
- Regularly update Neo4j to the latest stable version

### Google Cloud APIs
- Restrict API keys to specific APIs and IP addresses
- Enable API key rotation policies
- Monitor API usage for unusual patterns
- Use Cloud Monitoring for security alerts

### Deployment Security
- Always deploy with authentication enabled for production
- Use HTTPS for all endpoints
- Implement rate limiting to prevent abuse
- Enable Cloud Armor or similar DDoS protection for public endpoints

---

## Known Security Considerations

1. **Example Code**: This repository contains example implementations for educational purposes. Additional security hardening is required for production use.

2. **Authentication**: Some examples use `--allow-unauthenticated` for Cloud Functions. This is for demonstration only - always require authentication in production.

3. **Data Validation**: Implement input validation and sanitization when handling user-provided data, especially for Cypher queries.

4. **Dependency Management**: Regularly update dependencies to patch known vulnerabilities:
   ```bash
   npm audit fix
   pip install --upgrade -r requirements.txt
   ```

---

## License

This project uses a proprietary license. See [LICENSE](LICENSE) for details.

---

**Last Updated**: January 2026
