# BIMei Chatbot - Development Guidelines

## Code Quality Standards

### JavaScript Style and Formatting
- **Strict Mode**: All JavaScript files begin with `'use strict';` declaration
- **Semicolons**: Consistent use of semicolons to terminate statements
- **String Literals**: Prefer single quotes for string literals (`'use strict'` vs `"use strict"`)
- **Indentation**: 2-space indentation throughout codebase
- **Line Length**: Reasonable line lengths with logical breaks for readability

### Variable and Function Naming
- **camelCase**: Standard JavaScript camelCase for variables and functions (`userMessage`, `extractUserMessage`)
- **UPPER_CASE**: Environment variables and constants (`NEO4J_URI`, `WEIGHTS_TTL_SECONDS`)
- **Descriptive Names**: Clear, descriptive function names that indicate purpose
  - `extractUserMessage()` - clearly indicates extraction of user message
  - `normaliseEnvelope()` - indicates normalization of envelope structure
  - `buildEvidenceHtml()` - indicates HTML evidence construction

### Error Handling Patterns
- **Try-Catch Blocks**: Comprehensive error handling with structured logging
- **Graceful Degradation**: Fallback mechanisms when primary operations fail
- **Safe Defaults**: Functions return safe default values when inputs are invalid
- **Error Propagation**: Structured error information passed through response objects

## Architectural Patterns

### Configuration Management
- **Environment Variables**: External configuration via environment variables
- **Default Values**: Fallback defaults using logical OR operators
  ```javascript
  const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';
  const LANGUAGE_CODE = process.env.LANGUAGE_CODE || 'en';
  ```

### Caching Strategy
- **Warm Instance Cache**: In-memory caching for Cloud Functions/Run reuse
- **TTL-Based Expiration**: Time-based cache invalidation with configurable TTL
- **Cache Validation**: Cache freshness checks before serving cached data
- **Fail-Open Pattern**: Serve stale cache data when refresh fails

### Response Structure Patterns
- **Envelope Pattern**: Structured response format with consistent fields
  ```javascript
  const envelope = {
    version: 'bimei-envelope-v1',
    mode: 'default' | 'expert',
    content_md: 'markdown content',
    evidence_html: 'structured evidence',
    meta: { /* metadata */ }
  };
  ```

### Data Processing Patterns
- **Safe Type Conversion**: Defensive programming with type checking
  ```javascript
  function safeStr(v) {
    return typeof v === 'string' ? v : '';
  }
  ```
- **Array Safety**: Consistent array validation before processing
- **Null/Undefined Handling**: Explicit checks for null/undefined values

## API Integration Standards

### Google Cloud Services Integration
- **Service Client Initialization**: Proper client configuration with endpoints
- **Authentication**: Environment-based authentication without hardcoded credentials
- **Request/Response Handling**: Structured request processing with correlation IDs
- **CORS Configuration**: Comprehensive CORS headers for cross-origin requests

### Database Query Patterns
- **Parameterized Queries**: All database queries use parameterized inputs
- **Query Optimization**: Multi-tier query strategy (filtered → fallback)
- **Result Processing**: Consistent result mapping and validation
- **Connection Management**: Proper connection lifecycle management with cleanup

## Logging and Monitoring

### Structured Logging
- **JSON Format**: All logs output as structured JSON for Cloud Logging
- **Severity Levels**: Consistent use of DEBUG, INFO, WARNING, ERROR levels
- **Request Correlation**: Request IDs for tracing across service calls
- **Safe Content**: Sensitive data redaction and content truncation

### Performance Monitoring
- **Timing Metrics**: Request duration tracking with start/end timestamps
- **Resource Usage**: Memory and processing time considerations
- **Rate Limiting**: Token limits and response size constraints

## Security Practices

### Input Validation
- **Sanitization**: HTML escaping for all user-generated content
- **Type Validation**: Strict type checking for all inputs
- **Length Limits**: Maximum length constraints on user inputs
- **Injection Prevention**: Parameterized queries prevent injection attacks

### Data Protection
- **Credential Management**: Environment variables for sensitive configuration
- **Content Redaction**: Automatic truncation of long content in logs
- **Session Management**: Secure session ID handling and validation

## Testing and Quality Assurance

### Code Reliability Patterns
- **Defensive Programming**: Null checks and type validation throughout
- **Fallback Mechanisms**: Multiple fallback strategies for critical operations
- **Data Validation**: Input validation at service boundaries
- **Error Recovery**: Graceful handling of service failures

### Documentation Standards
- **Inline Comments**: Meaningful comments explaining complex logic
- **Function Documentation**: Clear parameter and return value descriptions
- **Configuration Documentation**: Environment variable documentation
- **API Documentation**: Request/response format specifications

## File Organization and Versioning

### File Naming Convention
- **Date Stamping**: Files include creation date in YYMMDD format
- **Component Prefixing**: Alphabetical prefixes for logical ordering (A_, B_, C_)
- **Legacy Preservation**: Previous versions retained with `_OLD` suffix
- **Descriptive Names**: Clear indication of component purpose in filename

### Version Management
- **Synchronized Updates**: All related components use consistent date stamps
- **Backward Compatibility**: Maintain compatibility during version transitions
- **Configuration Alignment**: Ensure all components reference current versions

This development approach prioritizes reliability, maintainability, and security while supporting the specialized requirements of AI-powered conversational interfaces and graph database operations.