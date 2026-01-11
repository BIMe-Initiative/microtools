/**
 * BIMei KB Dashboard - Module System
 * Flexible architecture for future module integration
 */

class DashboardModuleSystem {
  constructor() {
    this.modules = new Map();
    this.eventBus = new EventTarget();
    this.config = {
      apiEndpoints: {
        vertex: 'https://australia-southeast1-bimei-ai.cloudfunctions.net/bimei-chatbot',
        graph: '/graphQuery',
        neodash: '/ask'
      },
      modules: {
        text: { enabled: true, priority: 1 },
        sources: { enabled: true, priority: 2 },
        evidence: { enabled: true, priority: 3 },
        path: { enabled: true, priority: 4 },
        graph: { enabled: true, priority: 5 }
      }
    };
  }

  /**
   * Register a new module
   * @param {string} name - Module identifier
   * @param {Object} moduleInstance - Module implementation
   * @param {Object} options - Module configuration
   */
  registerModule(name, moduleInstance, options = {}) {
    const moduleConfig = {
      name,
      instance: moduleInstance,
      enabled: options.enabled !== false,
      priority: options.priority || 999,
      dependencies: options.dependencies || [],
      ...options
    };

    this.modules.set(name, moduleConfig);
    
    // Initialize module if dashboard is ready
    if (moduleInstance.init && typeof moduleInstance.init === 'function') {
      moduleInstance.dashboard = this;
      moduleInstance.init();
    }

    this.eventBus.dispatchEvent(new CustomEvent('module-registered', {
      detail: { name, config: moduleConfig }
    }));

    console.log(`Module registered: ${name}`);
    return moduleConfig;
  }

  /**
   * Unregister a module
   * @param {string} name - Module identifier
   */
  unregisterModule(name) {
    const module = this.modules.get(name);
    if (module && module.instance.destroy) {
      module.instance.destroy();
    }
    
    this.modules.delete(name);
    this.eventBus.dispatchEvent(new CustomEvent('module-unregistered', {
      detail: { name }
    }));
  }

  /**
   * Get module by name
   * @param {string} name - Module identifier
   * @returns {Object|null} Module configuration
   */
  getModule(name) {
    return this.modules.get(name) || null;
  }

  /**
   * Get all enabled modules sorted by priority
   * @returns {Array} Sorted module configurations
   */
  getEnabledModules() {
    return Array.from(this.modules.values())
      .filter(module => module.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Broadcast event to all modules
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  broadcast(eventType, data = {}) {
    this.eventBus.dispatchEvent(new CustomEvent(eventType, {
      detail: data
    }));
  }

  /**
   * Update module configuration
   * @param {string} name - Module identifier
   * @param {Object} updates - Configuration updates
   */
  updateModuleConfig(name, updates) {
    const module = this.modules.get(name);
    if (module) {
      Object.assign(module, updates);
      this.broadcast('module-config-updated', { name, config: module });
    }
  }

  /**
   * Enable/disable module
   * @param {string} name - Module identifier
   * @param {boolean} enabled - Enable state
   */
  setModuleEnabled(name, enabled) {
    this.updateModuleConfig(name, { enabled });
  }

  /**
   * Check if module dependencies are satisfied
   * @param {string} name - Module identifier
   * @returns {boolean} Dependencies satisfied
   */
  checkDependencies(name) {
    const module = this.modules.get(name);
    if (!module || !module.dependencies.length) return true;

    return module.dependencies.every(dep => {
      const depModule = this.modules.get(dep);
      return depModule && depModule.enabled;
    });
  }

  /**
   * Get module execution order based on dependencies
   * @returns {Array} Ordered module names
   */
  getExecutionOrder() {
    const modules = this.getEnabledModules();
    const ordered = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (moduleName) => {
      if (visiting.has(moduleName)) {
        throw new Error(`Circular dependency detected: ${moduleName}`);
      }
      if (visited.has(moduleName)) return;

      visiting.add(moduleName);
      
      const module = this.modules.get(moduleName);
      if (module && module.dependencies) {
        module.dependencies.forEach(dep => visit(dep));
      }
      
      visiting.delete(moduleName);
      visited.add(moduleName);
      ordered.push(moduleName);
    };

    modules.forEach(module => visit(module.name));
    return ordered;
  }
}

/**
 * Base Module Interface
 * All modules should extend this class or implement these methods
 */
class BaseModule {
  constructor(name) {
    this.name = name;
    this.dashboard = null;
    this.state = {
      loading: false,
      data: null,
      error: null,
      initialized: false
    };
  }

  /**
   * Initialize module - called when registered
   */
  init() {
    if (this.dashboard) {
      this.setupEventListeners();
      this.state.initialized = true;
      console.log(`Module ${this.name} initialized`);
    }
  }

  /**
   * Setup event listeners for dashboard events
   */
  setupEventListeners() {
    if (!this.dashboard) return;

    this.dashboard.eventBus.addEventListener('query-start', (e) => this.onQueryStart(e.detail));
    this.dashboard.eventBus.addEventListener('query-complete', (e) => this.onQueryComplete(e.detail));
    this.dashboard.eventBus.addEventListener('query-error', (e) => this.onQueryError(e.detail));
    this.dashboard.eventBus.addEventListener('module-config-updated', (e) => this.onConfigUpdated(e.detail));
  }

  /**
   * Handle query start event
   * @param {Object} detail - Event detail
   */
  onQueryStart(detail) {
    this.setState({ loading: true, error: null });
    this.updateUI('loading');
  }

  /**
   * Handle query completion event
   * @param {Object} detail - Event detail
   */
  onQueryComplete(detail) {
    this.setState({ loading: false });
    // Override in subclasses
  }

  /**
   * Handle query error event
   * @param {Object} detail - Event detail
   */
  onQueryError(detail) {
    this.setState({ loading: false, error: detail.error });
    this.updateUI('error');
  }

  /**
   * Handle configuration update event
   * @param {Object} detail - Event detail
   */
  onConfigUpdated(detail) {
    if (detail.name === this.name) {
      this.onConfigChange(detail.config);
    }
  }

  /**
   * Handle module configuration change
   * @param {Object} config - New configuration
   */
  onConfigChange(config) {
    // Override in subclasses
  }

  /**
   * Update module state
   * @param {Object} updates - State updates
   */
  setState(updates) {
    Object.assign(this.state, updates);
    this.onStateChange();
  }

  /**
   * Handle state change
   */
  onStateChange() {
    // Override in subclasses
  }

  /**
   * Update module UI
   * @param {string} status - UI status (loading, success, error, idle)
   */
  updateUI(status) {
    if (this.dashboard && this.dashboard.updateModuleStatus) {
      this.dashboard.updateModuleStatus(this.name, status);
    }
  }

  /**
   * Update module content
   * @param {string|HTMLElement} content - Content to display
   */
  updateContent(content) {
    if (this.dashboard && this.dashboard.updateModuleContent) {
      this.dashboard.updateModuleContent(this.name, content);
    }
  }

  /**
   * Cleanup module resources
   */
  destroy() {
    this.state.initialized = false;
    console.log(`Module ${this.name} destroyed`);
  }

  /**
   * Get module configuration
   * @returns {Object} Module configuration
   */
  getConfig() {
    return this.dashboard ? this.dashboard.getModule(this.name) : null;
  }

  /**
   * Check if module is enabled
   * @returns {boolean} Enabled state
   */
  isEnabled() {
    const config = this.getConfig();
    return config ? config.enabled : false;
  }
}

/**
 * Module Integration Helpers
 */
class ModuleIntegration {
  /**
   * Create WordPress plugin integration
   * @param {string} hookName - WordPress hook name
   * @param {Function} callback - Callback function
   */
  static wordPressHook(hookName, callback) {
    if (typeof window.wp !== 'undefined' && window.wp.hooks) {
      window.wp.hooks.addAction(hookName, 'bimei-kb-dashboard', callback);
    }
  }

  /**
   * Create iframe integration
   * @param {string} src - Iframe source URL
   * @param {Object} options - Iframe options
   * @returns {HTMLIFrameElement} Iframe element
   */
  static createIframe(src, options = {}) {
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = options.width || '100%';
    iframe.style.height = options.height || '400px';
    iframe.style.border = options.border || 'none';
    iframe.style.borderRadius = options.borderRadius || '8px';
    
    // Setup postMessage communication
    if (options.onMessage) {
      window.addEventListener('message', (event) => {
        if (event.source === iframe.contentWindow) {
          options.onMessage(event.data);
        }
      });
    }

    return iframe;
  }

  /**
   * Create API integration
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise} API response
   */
  static async apiCall(endpoint, options = {}) {
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(endpoint, config);
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    }
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DashboardModuleSystem, BaseModule, ModuleIntegration };
} else {
  window.DashboardModuleSystem = DashboardModuleSystem;
  window.BaseModule = BaseModule;
  window.ModuleIntegration = ModuleIntegration;
}