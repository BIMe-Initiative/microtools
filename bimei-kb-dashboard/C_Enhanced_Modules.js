/**
 * BIMei KB Dashboard - Enhanced Module Implementations
 * Advanced features for each dashboard module
 */

class EnhancedTextResponseModule extends BaseModule {
  constructor() {
    super('text');
    this.responseHistory = [];
  }

  onQueryComplete(detail) {
    super.onQueryComplete(detail);
    const textData = detail.results?.text;
    
    if (textData && !textData.error) {
      this.updateStatus('success');
      this.responseHistory.push({
        query: detail.query,
        response: textData,
        timestamp: new Date().toISOString()
      });
      
      const content = this.formatEnhancedTextResponse(textData, detail.query);
      this.updateContent(content);
    } else {
      this.updateStatus('error');
      this.showError(textData?.error || 'No response available');
    }
  }
  
  formatEnhancedTextResponse(data, query) {
    const content = data.content || 'No content available';
    const source = data.source || 'BIMei AI';
    const mode = data.mode || 'default';
    const wordCount = content.split(/\s+/).length;
    
    return `
      <div class="bimei-kb-text-response">
        <div class="bimei-kb-response-header">
          <div class="bimei-kb-response-meta">
            <span class="bimei-kb-meta-item">
              <strong>Source:</strong> ${this.escapeHtml(source)}
            </span>
            <span class="bimei-kb-meta-item">
              <strong>Mode:</strong> ${mode}
            </span>
            <span class="bimei-kb-meta-item">
              <strong>Words:</strong> ${wordCount}
            </span>
          </div>
          <div class="bimei-kb-response-actions">
            <button onclick="this.copyResponse('${this.escapeForJs(content)}')" class="bimei-kb-action-btn">
              📋 Copy
            </button>
            <button onclick="this.expandResponse()" class="bimei-kb-action-btn">
              🔍 Expand
            </button>
          </div>
        </div>
        <div class="bimei-kb-response-content">
          ${this.parseAdvancedMarkdown(content)}
        </div>
        <div class="bimei-kb-response-footer">
          <small>Query: "${this.escapeHtml(query)}"</small>
        </div>
      </div>
      
      <style>
        .bimei-kb-text-response {
          font-family: inherit;
        }
        .bimei-kb-response-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 8px;
        }
        .bimei-kb-response-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 12px;
          color: #718096;
        }
        .bimei-kb-meta-item {
          white-space: nowrap;
        }
        .bimei-kb-response-actions {
          display: flex;
          gap: 6px;
        }
        .bimei-kb-action-btn {
          font-size: 11px;
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bimei-kb-action-btn:hover {
          background: #e2e8f0;
        }
        .bimei-kb-response-content {
          line-height: 1.6;
          color: #2d3748;
        }
        .bimei-kb-response-footer {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px solid #f1f5f9;
          color: #a0aec0;
          font-size: 11px;
        }
        @media (max-width: 768px) {
          .bimei-kb-response-header {
            flex-direction: column;
            align-items: stretch;
          }
          .bimei-kb-response-actions {
            justify-content: flex-end;
          }
        }
      </style>
    `;
  }
  
  parseAdvancedMarkdown(text) {
    return text
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-size: 0.9em;">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  escapeForJs(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

class EnhancedSourcesModule extends BaseModule {
  constructor() {
    super('sources');
    this.sourceTypes = {
      'dictionary': { icon: '📚', label: 'Dictionary', priority: 1 },
      'pdf': { icon: '📄', label: 'PDF Document', priority: 3 },
      'page': { icon: '🌐', label: 'Web Page', priority: 2 },
      'external': { icon: '🔗', label: 'External Link', priority: 4 }
    };
  }

  onQueryComplete(detail) {
    super.onQueryComplete(detail);
    const sourcesData = detail.results?.sources;
    
    if (sourcesData && !sourcesData.error && sourcesData.links?.length > 0) {
      this.updateStatus('success');
      const content = this.formatEnhancedSources(sourcesData.links);
      this.updateContent(content);
    } else if (sourcesData?.error) {
      this.updateStatus('error');
      this.showError(sourcesData.error);
    } else {
      this.updateStatus('success');
      this.updateContent('<div class="bimei-kb-no-data">No sources available for this query</div>');
    }
  }
  
  formatEnhancedSources(links) {
    // Sort by priority
    const sortedLinks = links.sort((a, b) => {
      const priorityA = this.sourceTypes[a.type]?.priority || 999;
      const priorityB = this.sourceTypes[b.type]?.priority || 999;
      return priorityA - priorityB;
    });
    
    const sourcesList = sortedLinks.map((link, index) => {
      const typeInfo = this.sourceTypes[link.type] || this.sourceTypes['external'];
      const title = link.title || this.extractTitleFromUrl(link.url);
      const domain = this.extractDomain(link.url);
      
      return `
        <div class="bimei-kb-source-item" data-type="${link.type}">
          <div class="bimei-kb-source-header">
            <span class="bimei-kb-source-icon">${typeInfo.icon}</span>
            <span class="bimei-kb-source-type">${typeInfo.label}</span>
            <span class="bimei-kb-source-index">#${index + 1}</span>
          </div>
          <div class="bimei-kb-source-content">
            <a href="${link.url}" target="_blank" class="bimei-kb-source-link" title="${this.escapeHtml(link.url)}">
              ${this.escapeHtml(title)}
            </a>
            <div class="bimei-kb-source-domain">${domain}</div>
          </div>
          <div class="bimei-kb-source-actions">
            <button onclick="this.copyUrl('${this.escapeForJs(link.url)}')" class="bimei-kb-source-action" title="Copy URL">
              📋
            </button>
            <button onclick="this.previewSource('${this.escapeForJs(link.url)}')" class="bimei-kb-source-action" title="Preview">
              👁️
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="bimei-kb-sources-container">
        <div class="bimei-kb-sources-summary">
          <span>${links.length} source${links.length !== 1 ? 's' : ''} found</span>
          <button onclick="this.exportSources()" class="bimei-kb-export-btn">Export List</button>
        </div>
        <div class="bimei-kb-sources-list">
          ${sourcesList}
        </div>
      </div>
      
      <style>
        .bimei-kb-sources-container {
          font-family: inherit;
        }
        .bimei-kb-sources-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 12px;
          color: #718096;
        }
        .bimei-kb-export-btn {
          font-size: 11px;
          padding: 4px 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 4px;
          cursor: pointer;
        }
        .bimei-kb-source-item {
          margin-bottom: 12px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #ffffff;
          transition: all 0.2s;
        }
        .bimei-kb-source-item:hover {
          border-color: #cbd5e0;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .bimei-kb-source-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .bimei-kb-source-icon {
          font-size: 14px;
        }
        .bimei-kb-source-type {
          font-size: 11px;
          color: #718096;
          text-transform: uppercase;
          font-weight: 600;
          flex: 1;
        }
        .bimei-kb-source-index {
          font-size: 10px;
          color: #a0aec0;
        }
        .bimei-kb-source-content {
          margin-bottom: 8px;
        }
        .bimei-kb-source-link {
          color: #3182ce;
          text-decoration: none;
          font-size: 14px;
          line-height: 1.4;
          display: block;
          margin-bottom: 4px;
        }
        .bimei-kb-source-link:hover {
          text-decoration: underline;
        }
        .bimei-kb-source-domain {
          font-size: 11px;
          color: #a0aec0;
        }
        .bimei-kb-source-actions {
          display: flex;
          gap: 4px;
          justify-content: flex-end;
        }
        .bimei-kb-source-action {
          font-size: 12px;
          padding: 4px 6px;
          border: none;
          background: #f7fafc;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .bimei-kb-source-action:hover {
          background: #edf2f7;
        }
        .bimei-kb-no-data {
          color: #718096;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }
      </style>
    `;
  }
  
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/').filter(s => s);
      
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        return lastSegment
          .replace(/\.(pdf|html|htm|php)$/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      return urlObj.hostname;
    } catch {
      return url;
    }
  }
  
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown domain';
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  escapeForJs(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
}

class EnhancedEvidenceModule extends BaseModule {
  constructor() {
    super('evidence');
    this.scoreHistory = [];
  }

  onQueryComplete(detail) {
    super.onQueryComplete(detail);
    const evidenceData = detail.results?.evidence;
    
    if (evidenceData && !evidenceData.error) {
      this.updateStatus('success');
      this.scoreHistory.push({
        query: detail.query,
        evidence: evidenceData,
        timestamp: new Date().toISOString()
      });
      
      const content = this.formatEnhancedEvidence(evidenceData);
      this.updateContent(content);
    } else if (evidenceData?.error) {
      this.updateStatus('error');
      this.showError(evidenceData.error);
    } else {
      this.updateStatus('success');
      this.updateContent('<div class="bimei-kb-no-data">No evidence metrics available</div>');
    }
  }
  
  formatEnhancedEvidence(data) {
    const score = data.score || 0;
    const confidence = data.confidence || 'Unknown';
    const tier = data.tier || 'minimal';
    const metrics = data.metrics || {};
    
    const tierColor = this.getTierColor(tier);
    const scoreGrade = this.getScoreGrade(score);
    const confidenceIcon = this.getConfidenceIcon(confidence);
    
    return `
      <div class="bimei-kb-evidence-container">
        <div class="bimei-kb-evidence-score-section">
          <div class="bimei-kb-score-display">
            <div class="bimei-kb-score-number" style="color: ${tierColor};">
              ${score.toFixed(1)}
            </div>
            <div class="bimei-kb-score-grade">
              ${scoreGrade}
            </div>
          </div>
          <div class="bimei-kb-confidence-display">
            <div class="bimei-kb-confidence-icon">${confidenceIcon}</div>
            <div class="bimei-kb-confidence-text">
              <div style="font-weight: 600; color: ${tierColor};">${confidence}</div>
              <div style="font-size: 11px; color: #718096;">Confidence</div>
            </div>
          </div>
        </div>
        
        <div class="bimei-kb-metrics-grid">
          <div class="bimei-kb-metric-item">
            <div class="bimei-kb-metric-value">${metrics.hops || 0}</div>
            <div class="bimei-kb-metric-label">Hops</div>
            <div class="bimei-kb-metric-bar">
              <div class="bimei-kb-metric-fill" style="width: ${Math.min(100, (metrics.hops || 0) * 10)}%;"></div>
            </div>
          </div>
          
          <div class="bimei-kb-metric-item">
            <div class="bimei-kb-metric-value">${(metrics.normalised || 0).toFixed(2)}</div>
            <div class="bimei-kb-metric-label">Normalised</div>
            <div class="bimei-kb-metric-bar">
              <div class="bimei-kb-metric-fill" style="width: ${(metrics.normalised || 0) * 100}%;"></div>
            </div>
          </div>
          
          <div class="bimei-kb-metric-item">
            <div class="bimei-kb-metric-value">${(metrics.raw || 0).toFixed(2)}</div>
            <div class="bimei-kb-metric-label">Raw Score</div>
            <div class="bimei-kb-metric-bar">
              <div class="bimei-kb-metric-fill" style="width: ${Math.min(100, (metrics.raw || 0) * 20)}%;"></div>
            </div>
          </div>
          
          <div class="bimei-kb-metric-item">
            <div class="bimei-kb-metric-value">${(metrics.decay || 0).toFixed(3)}</div>
            <div class="bimei-kb-metric-label">Decay Factor</div>
            <div class="bimei-kb-metric-bar">
              <div class="bimei-kb-metric-fill" style="width: ${(metrics.decay || 0) * 100}%;"></div>
            </div>
          </div>
        </div>
        
        <div class="bimei-kb-evidence-actions">
          <button onclick="this.showScoreBreakdown()" class="bimei-kb-evidence-btn">
            📊 Score Breakdown
          </button>
          <button onclick="this.compareScores()" class="bimei-kb-evidence-btn">
            📈 Compare History
          </button>
        </div>
      </div>
      
      <style>
        .bimei-kb-evidence-container {
          font-family: inherit;
        }
        .bimei-kb-evidence-score-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 16px;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
          border-radius: 12px;
        }
        .bimei-kb-score-display {
          text-align: center;
        }
        .bimei-kb-score-number {
          font-size: 42px;
          font-weight: 700;
          line-height: 1;
          margin-bottom: 4px;
        }
        .bimei-kb-score-grade {
          font-size: 12px;
          color: #718096;
          font-weight: 600;
        }
        .bimei-kb-confidence-display {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bimei-kb-confidence-icon {
          font-size: 24px;
        }
        .bimei-kb-confidence-text {
          text-align: left;
        }
        .bimei-kb-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .bimei-kb-metric-item {
          text-align: center;
        }
        .bimei-kb-metric-value {
          font-size: 18px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 4px;
        }
        .bimei-kb-metric-label {
          font-size: 11px;
          color: #718096;
          margin-bottom: 6px;
        }
        .bimei-kb-metric-bar {
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }
        .bimei-kb-metric-fill {
          height: 100%;
          background: linear-gradient(90deg, #4299e1, #3182ce);
          transition: width 0.3s ease;
        }
        .bimei-kb-evidence-actions {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .bimei-kb-evidence-btn {
          font-size: 11px;
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .bimei-kb-evidence-btn:hover {
          background: #f7fafc;
          border-color: #cbd5e0;
        }
        .bimei-kb-no-data {
          color: #718096;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }
        @media (max-width: 768px) {
          .bimei-kb-evidence-score-section {
            flex-direction: column;
            gap: 12px;
          }
          .bimei-kb-metrics-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      </style>
    `;
  }
  
  getTierColor(tier) {
    const colors = {
      'high': '#38a169',
      'medium': '#d69e2e', 
      'low': '#e53e3e',
      'minimal': '#718096'
    };
    return colors[tier] || '#718096';
  }
  
  getScoreGrade(score) {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    if (score >= 2) return 'Poor';
    return 'Very Poor';
  }
  
  getConfidenceIcon(confidence) {
    const icons = {
      'High': '🟢',
      'Medium': '🟡',
      'Low': '🔴',
      'Unknown': '⚪'
    };
    return icons[confidence] || '⚪';
  }
}

// Export enhanced modules
if (typeof window !== 'undefined') {
  window.EnhancedTextResponseModule = EnhancedTextResponseModule;
  window.EnhancedSourcesModule = EnhancedSourcesModule;
  window.EnhancedEvidenceModule = EnhancedEvidenceModule;
}