/**
 * Pathfinding Form Component
 * 
 * Handles the main pathfinding form UI and interactions
 */

import { AutocompleteComponent } from './autocomplete.js';

/**
 * Pathfinding form component
 */
export class PathfindingFormComponent {
  constructor(formElement, options = {}) {
    if (!(formElement instanceof HTMLFormElement)) {
      throw new Error('Form element must be an HTMLFormElement');
    }

    this.formElement = formElement;
    this.options = {
      enableKeyboardShortcuts: true,
      enableExamples: true,
      showLoadingIndicator: true,
      ...options,
    };

    this.sourceInput = null;
    this.targetInput = null;
    this.sourceAutocomplete = null;
    this.targetAutocomplete = null;
    this.submitButton = null;
    this.loadGraphButton = null;
    this.resultContainer = null;

    this.isLoading = false;
    this.graphLoaded = false;

    this._initializeComponent();
  }

  /**
   * Initialize the form component
   * @private
   */
  _initializeComponent() {
    this._findElements();
    this._setupAutocomplete();
    this._bindEventListeners();
    this._setupKeyboardShortcuts();
    
    if (this.options.enableExamples) {
      this._setupExamples();
    }
  }

  /**
   * Find required form elements
   * @private
   */
  _findElements() {
    this.sourceInput = this.formElement.querySelector('#source') || 
                      this.formElement.querySelector('input[name="source"]');
    this.targetInput = this.formElement.querySelector('#target') || 
                      this.formElement.querySelector('input[name="target"]');
    this.submitButton = this.formElement.querySelector('button[type="submit"]');
    this.loadGraphButton = this.formElement.querySelector('#loadGraphBtn');
    this.resultContainer = document.querySelector('#result');

    if (!this.sourceInput || !this.targetInput) {
      throw new Error('Source and target input elements are required');
    }
  }

  /**
   * Setup autocomplete for inputs
   * @private
   */
  _setupAutocomplete() {
    this.sourceAutocomplete = new AutocompleteComponent(this.sourceInput, {
      placeholder: 'e.g., di_27_18_top or wp_001',
      maxSuggestions: 50,
    });

    this.targetAutocomplete = new AutocompleteComponent(this.targetInput, {
      placeholder: 'e.g., fossil_excavation_1 or wp_025',
      maxSuggestions: 50,
    });
  }

  /**
   * Bind event listeners
   * @private
   */
  _bindEventListeners() {
    // Form submission
    this.formElement.addEventListener('submit', (e) => {
      e.preventDefault();
      this._handleSubmit();
    });

    // Load graph button
    if (this.loadGraphButton) {
      this.loadGraphButton.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleLoadGraph();
      });
    }

    // Autocomplete selection events
    this.sourceInput.addEventListener('autocomplete:select', (e) => {
      this._handleAutocompleteSelect('source', e.detail);
    });

    this.targetInput.addEventListener('autocomplete:select', (e) => {
      this._handleAutocompleteSelect('target', e.detail);
    });
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  _setupKeyboardShortcuts() {
    if (!this.options.enableKeyboardShortcuts) return;

    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Enter to submit or load graph
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (this.graphLoaded) {
          this._handleSubmit();
        } else {
          this._handleLoadGraph();
        }
      }

      // Escape to clear results
      if (e.key === 'Escape') {
        this.clearResults();
      }

      // Tab navigation enhancement
      if (e.key === 'Tab' && !e.shiftKey) {
        if (document.activeElement === this.sourceInput && !this.targetInput.value.trim()) {
          e.preventDefault();
          this.targetInput.focus();
        }
      }
    });
  }

  /**
   * Setup example buttons
   * @private
   */
  _setupExamples() {
    const exampleButtons = document.querySelectorAll('.example-button');
    exampleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const source = button.getAttribute('data-source');
        const target = button.getAttribute('data-target');
        
        if (source && target) {
          this.setExample(source, target);
        }
      });
    });
  }

  /**
   * Set autocomplete data
   * @param {Array<string>} nodes - Array of node IDs
   * @param {Map<string, string>} nodeTypes - Map of node types
   */
  setAutocompleteData(nodes, nodeTypes) {
    this.sourceAutocomplete.setNodes(nodes, nodeTypes);
    this.targetAutocomplete.setNodes(nodes, nodeTypes);
  }

  /**
   * Set example values
   * @param {string} source - Source node ID
   * @param {string} target - Target node ID
   */
  setExample(source, target) {
    this.sourceAutocomplete.setValue(source);
    this.targetAutocomplete.setValue(target);
  }

  /**
   * Get form data
   * @returns {Object} Form data
   */
  getFormData() {
    return {
      source: this.sourceAutocomplete.getValue(),
      target: this.targetAutocomplete.getValue(),
    };
  }

  /**
   * Validate form data
   * @returns {Object} Validation result
   */
  validateForm() {
    const data = this.getFormData();
    const errors = [];

    if (!data.source) {
      errors.push({
        field: 'source',
        message: 'Source is required',
        element: this.sourceInput,
      });
    }

    if (!data.target) {
      errors.push({
        field: 'target',
        message: 'Target is required',
        element: this.targetInput,
      });
    }

    if (data.source && data.target && data.source === data.target) {
      errors.push({
        field: 'both',
        message: 'Source and target cannot be the same',
        element: this.targetInput,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      data,
    };
  }

  /**
   * Show loading state
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    if (!this.options.showLoadingIndicator) return;

    this.isLoading = true;
    this._updateButtonStates();

    if (this.resultContainer) {
      this.resultContainer.className = 'result loading';
      this.resultContainer.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <div class="loading-message">${message}</div>
        </div>
      `;
    }
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.isLoading = false;
    this._updateButtonStates();
  }

  /**
   * Show result
   * @param {string} content - HTML content to show
   * @param {string} type - Result type (success, error, info)
   */
  showResult(content, type = 'info') {
    this.hideLoading();

    if (this.resultContainer) {
      this.resultContainer.className = `result ${type}`;
      this.resultContainer.innerHTML = content;
    }

    // Dispatch event
    this.formElement.dispatchEvent(new CustomEvent('pathfinding:result', {
      detail: { content, type },
    }));
  }

  /**
   * Clear results
   */
  clearResults() {
    if (this.resultContainer) {
      this.resultContainer.className = 'result';
      this.resultContainer.innerHTML = '';
    }
  }

  /**
   * Set graph loaded state
   * @param {boolean} loaded - Whether graph is loaded
   */
  setGraphLoaded(loaded) {
    this.graphLoaded = loaded;
    this._updateButtonStates();
  }

  /**
   * Handle form submission
   * @private
   */
  _handleSubmit() {
    const validation = this.validateForm();

    if (!validation.isValid) {
      this._showValidationErrors(validation.errors);
      return;
    }

    if (!this.graphLoaded) {
      this.showResult(`
        <h3>⚠️ Graph Not Loaded</h3>
        <p>Please load the graph data first by clicking "Load Graph Data".</p>
      `, 'error');
      return;
    }

    // Dispatch submit event
    this.formElement.dispatchEvent(new CustomEvent('pathfinding:submit', {
      detail: validation.data,
    }));
  }

  /**
   * Handle load graph action
   * @private
   */
  _handleLoadGraph() {
    this.formElement.dispatchEvent(new CustomEvent('pathfinding:load-graph'));
  }

  /**
   * Handle autocomplete selection
   * @private
   */
  _handleAutocompleteSelect(field, detail) {
    this.formElement.dispatchEvent(new CustomEvent('pathfinding:autocomplete-select', {
      detail: { field, ...detail },
    }));
  }

  /**
   * Show validation errors
   * @private
   */
  _showValidationErrors(errors) {
    const firstError = errors[0];
    
    let errorHtml = '<h3>⚠️ Validation Error</h3>';
    errorHtml += '<ul>';
    errors.forEach(error => {
      errorHtml += `<li>${error.message}</li>`;
    });
    errorHtml += '</ul>';

    this.showResult(errorHtml, 'error');

    // Focus first error field
    if (firstError && firstError.element) {
      firstError.element.focus();
    }
  }

  /**
   * Update button states based on loading and graph status
   * @private
   */
  _updateButtonStates() {
    if (this.submitButton) {
      this.submitButton.disabled = this.isLoading || !this.graphLoaded;
      this.submitButton.textContent = this.isLoading ? 'Finding Path...' : 'Find Path';
    }

    if (this.loadGraphButton) {
      this.loadGraphButton.disabled = this.isLoading;
      this.loadGraphButton.textContent = this.isLoading ? 'Loading...' : 'Load Graph Data';
    }
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.sourceAutocomplete) {
      this.sourceAutocomplete.destroy();
    }
    if (this.targetAutocomplete) {
      this.targetAutocomplete.destroy();
    }
    
    // Remove event listeners would go here if we stored references
  }
}

/**
 * Utility function to create example buttons
 * @param {Array<Object>} examples - Array of example objects with source, target, and label
 * @param {HTMLElement} container - Container element to append buttons to
 */
export function createExampleButtons(examples, container) {
  examples.forEach(example => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'example-button';
    button.textContent = example.label;
    button.setAttribute('data-source', example.source);
    button.setAttribute('data-target', example.target);
    button.setAttribute('aria-label', 
      `Set source to ${example.source} and target to ${example.target}`);
    
    container.appendChild(button);
  });
}
