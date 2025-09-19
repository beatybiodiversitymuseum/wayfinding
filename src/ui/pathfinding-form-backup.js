/**
 * Pathfinding Form Component
 * 
 * Handles the main pathfinding form UI and interactions
 */

import { AutocompleteComponent } from './autocomplete.js';
import { EnhancedAutocompleteComponent } from './enhanced-autocomplete.js';

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
      useEnhancedSearch: true, // Enable the new Fuse.js search
      searchConfig: {
        threshold: 0.4,
        maxResults: 50,
        minQueryLength: 2,
      },
      ...options,
    };

    this.sourceInput = null;
    this.targetInput = null;
    this.sourceAutocomplete = null;
    this.targetAutocomplete = null;
    this.submitButton = null;
    this.loadGraphButton = null;
    this.resultContainer = null;

    // Intermediate waypoints functionality
    this.intermediateWaypoints = []; // Array of {id, type, coordinates, autocomplete, input}
    this.waypointsContainer = null;
    this.addWaypointButton = null;
    this.pathfinder = null;
    this.graph = null;

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
    this._setupWaypointControls();
    
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
    
    // Find waypoint elements
    this.waypointsContainer = document.querySelector('#waypointsContainer');
    this.addWaypointButton = document.querySelector('#addWaypointBtn');

    if (!this.sourceInput || !this.targetInput) {
      throw new Error('Source and target input elements are required');
    }
  }

  /**
   * Setup autocomplete for inputs
   * @private
   */
  _setupAutocomplete() {
    if (this.options.useEnhancedSearch) {
      // Use the new enhanced autocomplete with Fuse.js search
      const fixtureUrls = [
        './public/geojson/cabinet_fixtures.geojson',
        './public/geojson/di_box_fixtures.geojson',
        './public/geojson/fossil_excavation_fixtures.geojson'
      ];

      this.sourceAutocomplete = new EnhancedAutocompleteComponent(this.sourceInput, {
        placeholder: 'cabinet, fossil, DI box 27...',
        searchProvider: 'fuse',
        searchConfig: this.options.searchConfig,
        dataUrls: fixtureUrls,
        dataLoaderPreset: 'wayfinding',
        showScores: false,
        highlightMatches: true,
      });

      this.targetAutocomplete = new EnhancedAutocompleteComponent(this.targetInput, {
        placeholder: 'cabinet 01, waypoint...',
        searchProvider: 'fuse',
        searchConfig: this.options.searchConfig,
        dataUrls: fixtureUrls,
        dataLoaderPreset: 'wayfinding',
        showScores: false,
        highlightMatches: true,
      });
    } else {
      // Fallback to original autocomplete
      this.sourceAutocomplete = new AutocompleteComponent(this.sourceInput, {
        placeholder: 'e.g., di_27_18_top or wp_001',
        maxSuggestions: 50,
      });

      this.targetAutocomplete = new AutocompleteComponent(this.targetInput, {
        placeholder: 'e.g., fossil_excavation_1 or wp_025',
        maxSuggestions: 50,
      });
    }
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

    // Autocomplete selection events (support both old and new autocomplete)
    this.sourceInput.addEventListener('autocomplete:select', (e) => {
      this._handleAutocompleteSelect('source', e.detail);
    });
    this.sourceInput.addEventListener('enhanced-autocomplete:select', (e) => {
      this._handleAutocompleteSelect('source', e.detail);
    });

    this.targetInput.addEventListener('autocomplete:select', (e) => {
      this._handleAutocompleteSelect('target', e.detail);
    });
    this.targetInput.addEventListener('enhanced-autocomplete:select', (e) => {
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
    if (this.options.useEnhancedSearch) {
      // Enhanced autocomplete loads data from GeoJSON files automatically
      // But we can add waypoint data if needed
      const waypointData = nodes.map(nodeId => ({
        id: nodeId,
        name: nodeId,
        type: nodeTypes.get(nodeId) || 'waypoint',
        category: 'navigation'
      }));
      
      if (this.sourceAutocomplete.setData) {
        this.sourceAutocomplete.setData([...this.sourceAutocomplete.searchData, ...waypointData]);
      }
      if (this.targetAutocomplete.setData) {
        this.targetAutocomplete.setData([...this.targetAutocomplete.searchData, ...waypointData]);
      }
    } else {
      // Original autocomplete
      this.sourceAutocomplete.setNodes(nodes, nodeTypes);
      this.targetAutocomplete.setNodes(nodes, nodeTypes);
    }
    
    // Update intermediate waypoint autocompletes
    this._updateWaypointAutocompletes(nodes, nodeTypes);
  }

  /**
   * Update autocompletes for all intermediate waypoint inputs
   * @private
   */
  _updateWaypointAutocompletes(nodes, nodeTypes) {
    this.intermediateWaypoints.forEach((waypoint, index) => {
      if (waypoint.autocomplete) {
        waypoint.autocomplete.setNodes(nodes, nodeTypes);
      }
    });
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
    const validWaypoints = this.intermediateWaypoints.filter(w => w.id).map(w => w.id);
    
    return {
      source: this.sourceAutocomplete.getValue(),
      target: this.targetAutocomplete.getValue(),
      waypoints: validWaypoints,
      hasWaypoints: validWaypoints.length > 0,
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
   * Setup waypoint controls
   * @private
   */
  _setupWaypointControls() {
    if (this.addWaypointButton) {
      this.addWaypointButton.addEventListener('click', () => {
        this._addIntermediateWaypoint();
      });
    }
  }

  /**
   * Set pathfinder for waypoint functionality
   * @param {Pathfinder} pathfinder - Pathfinder instance
   * @param {WayfindingGraph} graph - Graph instance
   */
  setPathfinder(pathfinder, graph) {
    this.pathfinder = pathfinder;
    this.graph = graph;
  }

  /**
   * Add intermediate waypoint between source and target
   */
  _addIntermediateWaypoint() {
    if (this.intermediateWaypoints.length >= 8) return; // Max 8 intermediate waypoints
    
    const waypointIndex = this.intermediateWaypoints.length;
    const waypointData = {
      id: null,
      type: null,
      coordinates: null,
      autocomplete: null,
      input: null,
    };
    
    this.intermediateWaypoints.push(waypointData);
    this._updateWaypointsDisplay();
    
    // Setup autocomplete after DOM is updated
    setTimeout(() => {
      this._setupWaypointAutocomplete(waypointIndex);
    }, 0);
  }

  /**
   * Update waypoints display
   * @private
   */
  _updateWaypointsDisplay() {
    if (!this.waypointsContainer) return;
    
    let html = '';
    
    this.intermediateWaypoints.forEach((waypoint, index) => {
      const isSet = waypoint.id !== null;
      const displayName = isSet ? `${waypoint.id} (${waypoint.type})` : 'Not set';
      
      html += `
        <div class="form-group waypoint-item" data-index="${index}">
          <div class="waypoint-header">
            <label for="waypoint-${index}">
              <span class="waypoint-number">${index + 1}</span>
              Via Waypoint ${index + 1}:
            </label>
            <button type="button" class="btn-remove-waypoint" data-index="${index}" title="Remove this waypoint">×</button>
          </div>
          <div class="autocomplete" role="combobox" aria-expanded="false" aria-haspopup="listbox">
            <input 
              type="text" 
              id="waypoint-${index}" 
              class="waypoint-input"
              placeholder="e.g., wp_010 or intermediate fixture..."
              value="${isSet ? waypoint.id : ''}"
              autocomplete="off"
              aria-autocomplete="list"
              role="textbox"
            >
          </div>
          <div class="waypoint-status ${isSet ? 'set' : 'unset'}">
            ${isSet ? '✅ ' + displayName : '⭕ Search or type waypoint ID'}
          </div>
        </div>
      `;
    });
    
    this.waypointsContainer.innerHTML = html;
    
    // Bind remove button events
    this.waypointsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-waypoint')) {
        const index = parseInt(e.target.dataset.index);
        this._removeIntermediateWaypoint(index);
      }
    });
  }

  /**
   * Setup autocomplete for a specific waypoint input
   * @private
   */
  _setupWaypointAutocomplete(waypointIndex) {
    const input = this.waypointsContainer?.querySelector(`#waypoint-${waypointIndex}`);
    if (!input) return;
    
    const autocomplete = new AutocompleteComponent(input, {
      placeholder: `Search for waypoint ${waypointIndex + 1}...`,
      minQueryLength: 2,
      maxSuggestions: 20,
    });
    
    // Set nodes if graph is available
    if (this.graph) {
      const nodes = Array.from(this.graph.nodes);
      autocomplete.setNodes(nodes, this.graph.nodeTypes);
    }
    
    // Store references
    this.intermediateWaypoints[waypointIndex].autocomplete = autocomplete;
    this.intermediateWaypoints[waypointIndex].input = input;
    
    // Handle selection
    input.addEventListener('autocomplete:select', (e) => {
      this._setIntermediateWaypoint(waypointIndex, e.detail.nodeId, e.detail.nodeType);
    });
    
    // Handle manual input
    input.addEventListener('blur', () => {
      const value = input.value.trim();
      if (value && this.graph?.hasNode(value)) {
        const nodeType = this.graph.getNodeType(value);
        this._setIntermediateWaypoint(waypointIndex, value, nodeType);
      }
    });
  }

  /**
   * Set a specific intermediate waypoint
   * @private
   */
  _setIntermediateWaypoint(waypointIndex, nodeId, nodeType) {
    if (waypointIndex >= 0 && waypointIndex < this.intermediateWaypoints.length) {
      const coordinates = this.graph?.getNodeCoordinates(nodeId) || null;
      
      this.intermediateWaypoints[waypointIndex] = {
        ...this.intermediateWaypoints[waypointIndex],
        id: nodeId,
        type: nodeType,
        coordinates,
      };
      
      this._updateWaypointsDisplay();
      this._setupWaypointAutocomplete(waypointIndex); // Re-setup autocomplete
      
      // Emit event
      this._emitEvent('waypoint:updated', {
        waypointIndex,
        nodeId,
        nodeType,
        totalWaypoints: this.intermediateWaypoints.filter(w => w.id).length,
      });
    }
  }

  /**
   * Remove an intermediate waypoint
   * @private
   */
  _removeIntermediateWaypoint(waypointIndex) {
    if (waypointIndex >= 0 && waypointIndex < this.intermediateWaypoints.length) {
      // Clean up autocomplete
      if (this.intermediateWaypoints[waypointIndex].autocomplete) {
        this.intermediateWaypoints[waypointIndex].autocomplete.destroy();
      }
      
      this.intermediateWaypoints.splice(waypointIndex, 1);
      this._updateWaypointsDisplay();
      
      // Re-setup autocompletes for remaining waypoints
      this.intermediateWaypoints.forEach((waypoint, index) => {
        this._setupWaypointAutocomplete(index);
      });
    }
  }

  /**
   * Handle form submission with intermediate waypoints
   * @private
   */
  _handleSubmitWithWaypoints(formData) {
    if (!formData.hasWaypoints) {
      // Regular single-point pathfinding
      this._emitEvent('pathfinding:submit', {
        source: formData.source,
        target: formData.target,
      });
      return;
    }

    // Multi-segment pathfinding with intermediate waypoints
    this._calculateWaypointRoute(formData);
  }

  /**
   * Calculate route with intermediate waypoints using point-to-point calls
   * @private
   */
  async _calculateWaypointRoute(formData) {
    if (!this.pathfinder) {
      this.showResult('<h3>⚠️ Pathfinder not available</h3><p>Please load the graph data first.</p>', 'error');
      return;
    }

    try {
      // Build complete route: source → waypoint1 → waypoint2 → ... → target
      const routePoints = [formData.source, ...formData.waypoints, formData.target];
      const segments = [];
      
      this.showLoading('Calculating route with waypoints...');
      
      // Calculate each segment individually (point-to-point)
      for (let i = 0; i < routePoints.length - 1; i++) {
        const fromPoint = routePoints[i];
        const toPoint = routePoints[i + 1];
        
        this.showLoading(`Calculating segment ${i + 1}/${routePoints.length - 1}: ${fromPoint} → ${toPoint}`);
        
        // Individual point-to-point pathfinding call
        const path = this.pathfinder.findPath(fromPoint, toPoint);
        const pathDetails = this.pathfinder.getPathDetails(path);
        
        if (!pathDetails) {
          throw new Error(`No path found between ${fromPoint} and ${toPoint}`);
        }
        
        segments.push({
          from: fromPoint,
          to: toPoint,
          path,
          pathDetails,
          segmentIndex: i,
        });
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this._displayWaypointResults(routePoints, segments);
      
      // Emit event for map visualization
      this._emitEvent('waypoint:route-calculated', {
        routePoints,
        segments,
        totalSegments: segments.length,
      });
      
    } catch (error) {
      console.error('Waypoint route calculation failed:', error);
      this.showResult(`
        <h3>❌ Waypoint Route Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
      `, 'error');
    }
  }

  /**
   * Display waypoint route results
   * @private
   */
  _displayWaypointResults(routePoints, segments) {
    const totalNodes = segments.reduce((sum, segment) => sum + segment.path.length - 1, 1);
    const totalWaypoints = segments.reduce((sum, segment) => sum + segment.pathDetails.summary.waypointsUsed, 0);
    
    let html = `
      <h3>✅ Route with Waypoints Calculated!</h3>
      <div class="path-summary">
        <p><strong>Route Points:</strong> ${routePoints.length} (${routePoints.length - 2} intermediate)</p>
        <p><strong>Route Segments:</strong> ${segments.length}</p>
        <p><strong>Total Path Nodes:</strong> ${totalNodes}</p>
        <p><strong>Waypoints Used:</strong> ${totalWaypoints}</p>
        <p><strong>From:</strong> ${routePoints[0]}</p>
        <p><strong>Via:</strong> ${routePoints.slice(1, -1).join(', ') || 'None'}</p>
        <p><strong>To:</strong> ${routePoints[routePoints.length - 1]}</p>
      </div>
      
      <h4>🛤️ Route Segments:</h4>
      <div class="path-nodes">
    `;
    
    segments.forEach((segment, index) => {
      const pathString = segment.path.join(' → ');
      html += `
        <div class="route-segment">
          <div class="segment-header">
            <strong>Segment ${index + 1}:</strong> 
            <span class="path-node">${segment.from}</span> → 
            <span class="path-node">${segment.to}</span>
            <small>(${segment.path.length} nodes, ${segment.pathDetails.summary.waypointsUsed} waypoints)</small>
          </div>
          <div class="segment-path">
            ${pathString}
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    
    // Add export options
    html += `
      <h4>📄 Export Options:</h4>
      <div class="export-actions">
        <button onclick="app.exportWaypointGeoJSON()" class="export-button">📋 Copy GeoJSON</button>
        <button onclick="app.copyPathGeoJSON()" class="export-button">📋 Copy Simple GeoJSON</button>
        <button onclick="app.downloadPathGeoJSON()" class="export-button">💾 Download GeoJSON</button>
      </div>
    `;
    
    this.showResult(html, 'success');
  }

  /**
   * Emit custom event
   * @private
   */
  _emitEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { 
      detail,
      bubbles: true 
    });
    this.formElement.dispatchEvent(event);
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
    
    // Clean up intermediate waypoint autocompletes
    this.intermediateWaypoints.forEach(waypoint => {
      if (waypoint.autocomplete) {
        waypoint.autocomplete.destroy();
      }
    });
    this.intermediateWaypoints = [];
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
  _setupMultiPointAutocomplete(pointIndex) {
    const input = this.multiPointContainer?.querySelector(`#multipoint-${pointIndex}`);
    if (!input) return;
    
    const autocomplete = new AutocompleteComponent(input, {
      placeholder: `Search for point ${pointIndex + 1}...`,
      minQueryLength: 2,
      maxSuggestions: 20,
    });
    
    // Set nodes if graph is available
    if (this.graph) {
      const nodes = Array.from(this.graph.nodes);
      autocomplete.setNodes(nodes, this.graph.nodeTypes);
    }
    
    // Store references
    this.multiPoints[pointIndex].autocomplete = autocomplete;
    this.multiPoints[pointIndex].input = input;
    
    // Handle selection
    input.addEventListener('autocomplete:select', (e) => {
      this._setMultiPoint(pointIndex, e.detail.nodeId, e.detail.nodeType);
    });
    
    // Handle manual input
    input.addEventListener('blur', () => {
      const value = input.value.trim();
      if (value && this.graph?.hasNode(value)) {
        const nodeType = this.graph.getNodeType(value);
        this._setMultiPoint(pointIndex, value, nodeType);
      }
    });
  }

  /**
   * Set a specific multi-point
   * @private
   */
  _setMultiPoint(pointIndex, nodeId, nodeType) {
    if (pointIndex >= 0 && pointIndex < this.multiPoints.length) {
      const coordinates = this.graph?.getNodeCoordinates(nodeId) || null;
      
      this.multiPoints[pointIndex] = {
        ...this.multiPoints[pointIndex],
        id: nodeId,
        type: nodeType,
        coordinates,
      };
      
      this._updateMultiPointsList();
      this._setupMultiPointAutocomplete(pointIndex); // Re-setup autocomplete
      this._updateMultiPointButtons();
      
      // Emit event
      this._emitEvent('multipoint:updated', {
        pointIndex,
        nodeId,
        nodeType,
        totalPoints: this.multiPoints.filter(p => p.id).length,
      });
    }
  }

  /**
   * Remove a multi-point
   * @private
   */
  _removeMultiPoint(pointIndex) {
    if (pointIndex >= 0 && pointIndex < this.multiPoints.length) {
      // Clean up autocomplete
      if (this.multiPoints[pointIndex].autocomplete) {
        this.multiPoints[pointIndex].autocomplete.destroy();
      }
      
      this.multiPoints.splice(pointIndex, 1);
      this._updateMultiPointsList();
      
      // Re-setup autocompletes for remaining points
      this.multiPoints.forEach((point, index) => {
        this._setupMultiPointAutocomplete(index);
      });
      
      this._updateMultiPointButtons();
    }
  }

  /**
   * Clear all multi-points
   * @private
   */
  _clearMultiPoints() {
    this.multiPoints.forEach(point => {
      if (point.autocomplete) {
        point.autocomplete.destroy();
      }
    });
    this.multiPoints = [];
    this._updateMultiPointsList();
    this._updateMultiPointButtons();
  }

  /**
   * Calculate multi-point route using individual point-to-point calls
   * @private
   */
  async _calculateMultiPointRoute() {
    const validPoints = this.multiPoints.filter(p => p.id);
    
    if (validPoints.length < 2) {
      this.showResult('<h3>⚠️ Need at least 2 points</h3><p>Add more waypoints or fixtures to calculate a route.</p>', 'error');
      return;
    }
    
    if (!this.pathfinder) {
      this.showResult('<h3>⚠️ Pathfinder not available</h3><p>Please load the graph data first.</p>', 'error');
      return;
    }
    
    try {
      const segments = [];
      const totalSegments = validPoints.length - 1;
      
      // Calculate each segment individually (point-to-point)
      for (let i = 0; i < totalSegments; i++) {
        const fromPoint = validPoints[i];
        const toPoint = validPoints[i + 1];
        
        this.showLoading(`Calculating segment ${i + 1}/${totalSegments}: ${fromPoint.id} → ${toPoint.id}`);
        
        // Individual point-to-point pathfinding call
        const path = this.pathfinder.findPath(fromPoint.id, toPoint.id);
        const pathDetails = this.pathfinder.getPathDetails(path);
        
        if (!pathDetails) {
          throw new Error(`No path found between ${fromPoint.id} and ${toPoint.id}`);
        }
        
        segments.push({
          fromPoint,
          toPoint,
          path,
          pathDetails,
          segmentIndex: i,
        });
        
        // Small delay to show progress
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this._displayMultiPointResults(validPoints, segments);
      
      // Emit event for map visualization
      this._emitEvent('multipoint:route-calculated', {
        points: validPoints,
        segments,
        totalSegments: segments.length,
      });
      
    } catch (error) {
      console.error('Multi-point route calculation failed:', error);
      this.showResult(`
        <h3>❌ Multi-Point Route Failed</h3>
        <p><strong>Error:</strong> ${error.message}</p>
      `, 'error');
    }
  }

  /**
   * Display multi-point route results using existing result styling
   * @private
   */
  _displayMultiPointResults(points, segments) {
    const totalNodes = segments.reduce((sum, segment) => sum + segment.path.length - 1, 1);
    const totalWaypoints = segments.reduce((sum, segment) => sum + segment.pathDetails.summary.waypointsUsed, 0);
    
    let html = `
      <h3>✅ Multi-Point Route Calculated!</h3>
      <div class="path-summary">
        <p><strong>Total Points:</strong> ${points.length}</p>
        <p><strong>Route Segments:</strong> ${segments.length}</p>
        <p><strong>Total Path Nodes:</strong> ${totalNodes}</p>
        <p><strong>Waypoints Used:</strong> ${totalWaypoints}</p>
        <p><strong>From:</strong> ${points[0].id} (${points[0].type})</p>
        <p><strong>To:</strong> ${points[points.length - 1].id} (${points[points.length - 1].type})</p>
      </div>
      
      <h4>🛤️ Route Segments:</h4>
      <div class="path-nodes">
    `;
    
    segments.forEach((segment, index) => {
      const pathString = segment.path.join(' → ');
      html += `
        <div class="route-segment">
          <div class="segment-header">
            <strong>Segment ${index + 1}:</strong> 
            <span class="path-node ${segment.fromPoint.type}">${segment.fromPoint.id}</span> → 
            <span class="path-node ${segment.toPoint.type}">${segment.toPoint.id}</span>
            <small>(${segment.path.length} nodes, ${segment.pathDetails.summary.waypointsUsed} waypoints)</small>
          </div>
          <div class="segment-path">
            <code>${pathString}</code>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
    
    // Add export options
    html += `
      <h4>📄 Export Options:</h4>
      <div class="export-actions">
        <button onclick="app.exportMultiPointGeoJSON()" class="export-button">📋 Copy GeoJSON</button>
        <button onclick="app.exportMultiPointCSV()" class="export-button">📊 Export CSV</button>
        <button onclick="app.exportMultiPointInstructions()" class="export-button">📝 Text Instructions</button>
      </div>
    `;
    
    this.showResult(html, 'success');
  }

  /**
   * Bind multi-point event listeners
   * @private
   */
  _bindMultiPointEvents() {
    if (!this.multiPointContainer) return;
    
    this.multiPointContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-add-point')) {
        this._addEmptyPoint();
      } else if (e.target.classList.contains('btn-calculate-multi')) {
        this._calculateMultiPointRoute();
      } else if (e.target.classList.contains('btn-clear-multi')) {
        this._clearMultiPoints();
      } else if (e.target.classList.contains('btn-remove-point')) {
        const index = parseInt(e.target.dataset.index);
        this._removeMultiPoint(index);
      }
    });
  }

  /**
   * Update multi-point button states
   * @private
   */
  _updateMultiPointButtons() {
    const calculateButton = this.multiPointContainer?.querySelector('.btn-calculate-multi');
    const validPoints = this.multiPoints.filter(p => p.id);
    
    if (calculateButton) {
      calculateButton.disabled = validPoints.length < 2 || !this.pathfinder;
      calculateButton.textContent = `📍 Calculate Route (${validPoints.length} points)`;
    }
  }

  /**
   * Update mode toggle button
   * @private
   */
  _updateModeButton() {
    if (this.toggleModeButton) {
      this.toggleModeButton.textContent = this.multiPointMode ? 
        '🔄 Switch to Single Route' : 
        '🔄 Switch to Multi-Point';
      this.toggleModeButton.title = this.multiPointMode ?
        'Switch back to simple point-to-point routing' :
        'Switch to multi-point route planning';
    }
  }

  /**
   * Emit custom event
   * @private
   */
  _emitEvent(eventName, detail) {
    const event = new CustomEvent(eventName, { 
      detail,
      bubbles: true 
    });
    this.formElement.dispatchEvent(event);
  }

  /**
   * Get current multi-point data
   */
  getMultiPointData() {
    return {
      mode: this.multiPointMode,
      points: this.multiPoints.filter(p => p.id),
      totalPoints: this.multiPoints.length,
    };
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
    
    // Clean up intermediate waypoint autocompletes
    this.intermediateWaypoints.forEach(waypoint => {
      if (waypoint.autocomplete) {
        waypoint.autocomplete.destroy();
      }
    });
    this.intermediateWaypoints = [];
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
