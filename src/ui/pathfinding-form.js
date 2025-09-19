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
    // Common configuration for all autocomplete components
    this.commonAutocompleteConfig = {
      enhanced: {
        dataUrls: [
          './public/geojson/wayfinding.geojson',  // Waypoints (wp_001, wp_002, etc.)
          './public/geojson/cabinet_fixtures.geojson',
          './public/geojson/di_box_fixtures.geojson',
          './public/geojson/fossil_excavation_fixtures.geojson'
        ],
        searchProvider: 'fuse',
        searchConfig: this.options.searchConfig,
        dataLoaderPreset: 'wayfinding',
        showScores: false,
        highlightMatches: true,
      },
      basic: {
        minQueryLength: 2,
        maxSuggestions: 10,
      }
    };

    if (this.options.useEnhancedSearch) {
      this.sourceAutocomplete = new EnhancedAutocompleteComponent(this.sourceInput, {
        placeholder: 'cabinet, fossil, DI box 27, wp_001...',
        ...this.commonAutocompleteConfig.enhanced
      });

      this.targetAutocomplete = new EnhancedAutocompleteComponent(this.targetInput, {
        placeholder: 'cabinet 01, waypoint, wp_002...',
        ...this.commonAutocompleteConfig.enhanced
      });
    } else {
      this.sourceAutocomplete = new AutocompleteComponent(this.sourceInput, {
        placeholder: 'Enter source fixture or waypoint ID...',
        ...this.commonAutocompleteConfig.basic
      });

      this.targetAutocomplete = new AutocompleteComponent(this.targetInput, {
        placeholder: 'Enter target fixture or waypoint ID...',
        ...this.commonAutocompleteConfig.basic
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
      this._handleFormSubmission();
    });

    // Load graph button
    if (this.loadGraphButton) {
      this.loadGraphButton.addEventListener('click', (e) => {
        e.preventDefault();
        this._emitEvent('pathfinding:load-graph', {});
      });
    }

    // Autocomplete selections
    this.sourceInput.addEventListener('autocomplete:select', (e) => {
      this._emitEvent('pathfinding:autocomplete-select', {
        field: 'source',
        nodeId: e.detail.nodeId,
        nodeType: e.detail.nodeType,
      });
    });

    this.targetInput.addEventListener('autocomplete:select', (e) => {
      this._emitEvent('pathfinding:autocomplete-select', {
        field: 'target',
        nodeId: e.detail.nodeId,
        nodeType: e.detail.nodeType,
      });
    });
  }

  /**
   * Handle form submission
   * @private
   */
  _handleFormSubmission() {
    const formData = this.getFormData();
    const validation = this.validateForm();

    if (!validation.isValid) {
      this.showValidationErrors(validation.errors);
      return;
    }

    // Handle submission with or without waypoints
    this._handleSubmitWithWaypoints(formData);
  }

  /**
   * Setup keyboard shortcuts
   * @private
   */
  _setupKeyboardShortcuts() {
    if (!this.options.enableKeyboardShortcuts) return;

    // Handle Ctrl+Enter for form submission
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        
        if (this.graphLoaded) {
          this._handleFormSubmission();
        } else {
          this._emitEvent('pathfinding:load-graph', {});
        }
      }
    });
  }

  /**
   * Setup examples
   * @private
   */
  _setupExamples() {
    // Examples are handled by the main app
  }

  /**
   * Set autocomplete data for inputs
   * @param {Array<string>} nodes - Array of node IDs
   * @param {Map<string, string>} nodeTypes - Map of node types
   */
  setAutocompleteData(nodes, nodeTypes) {
    if (this.options.useEnhancedSearch) {
      // Enhanced autocomplete loads data from GeoJSON files automatically
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
        if (this.options.useEnhancedSearch) {
          // Enhanced autocomplete loads data from GeoJSON files automatically
          const waypointData = nodes.map(nodeId => ({
            id: nodeId,
            name: nodeId,
            type: nodeTypes.get(nodeId) || 'waypoint',
            category: 'navigation'
          }));
          
          if (waypoint.autocomplete.setData) {
            waypoint.autocomplete.setData([...waypoint.autocomplete.searchData, ...waypointData]);
          }
        } else {
          // Original autocomplete
          waypoint.autocomplete.setNodes(nodes, nodeTypes);
        }
      }
    });
  }

  /**
   * Get form data including intermediate waypoints
   * @returns {Object} Form data with source, target, and waypoints
   */
  getFormData() {
    const validWaypoints = this.intermediateWaypoints.filter(w => w.id).map(w => w.id);
    
    console.log('Form data:', {
      source: this.sourceAutocomplete.getValue(),
      target: this.targetAutocomplete.getValue(),
      waypoints: validWaypoints,
      intermediateWaypoints: this.intermediateWaypoints,
    });
    
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
        message: 'Source fixture or waypoint is required',
      });
    }

    if (!data.target) {
      errors.push({
        field: 'target',
        message: 'Target fixture or waypoint is required',
      });
    }

    // Allow source and target to be the same (circular routes are valid)
    // But validate that consecutive waypoints are different
    const validWaypoints = this.intermediateWaypoints.filter(w => w.id).map(w => w.id);
    
    // Check for consecutive duplicate waypoints
    for (let i = 0; i < validWaypoints.length - 1; i++) {
      if (validWaypoints[i] === validWaypoints[i + 1]) {
        errors.push({
          field: `waypoint-${i + 1}`,
          message: `Waypoint ${i + 2} cannot be the same as waypoint ${i + 1}`,
        });
      }
    }
    
    // Check if first waypoint is same as source
    if (validWaypoints.length > 0 && validWaypoints[0] === data.source) {
      errors.push({
        field: 'waypoint-0',
        message: 'First waypoint cannot be the same as source',
      });
    }
    
    // Check if last waypoint is same as target
    if (validWaypoints.length > 0 && validWaypoints[validWaypoints.length - 1] === data.target) {
      errors.push({
        field: `waypoint-${validWaypoints.length - 1}`,
        message: 'Last waypoint cannot be the same as target',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Show validation errors
   * @param {Array} errors - Array of validation errors
   */
  showValidationErrors(errors) {
    const errorMessages = errors.map(error => `<li>${error.message}</li>`).join('');
    this.showResult(`
      <h3>⚠️ Form Validation Errors</h3>
      <ul>${errorMessages}</ul>
    `, 'error');
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
   * Clear form inputs
   */
  clearForm() {
    this.sourceAutocomplete.clear();
    this.targetAutocomplete.clear();
    this.clearResults();
    
    // Clear intermediate waypoints
    this.intermediateWaypoints.forEach(waypoint => {
      if (waypoint.autocomplete) {
        waypoint.autocomplete.clear();
      }
    });
  }

  /**
   * Show loading state
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    if (!this.resultContainer) return;

    this.resultContainer.innerHTML = `
      <div class="loading">
        <div class="loading-spinner">⏳</div>
        <div class="loading-message">${message}</div>
      </div>
    `;
    this.resultContainer.className = 'loading';
    this.isLoading = true;
    this._updateLoadingState();
  }

  /**
   * Show result
   * @param {string} html - Result HTML
   * @param {string} type - Result type (success, error, info)
   */
  showResult(html, type = 'info') {
    if (!this.resultContainer) return;

    this.resultContainer.innerHTML = html;
    this.resultContainer.className = type;
    this.isLoading = false;
    this._updateLoadingState();
  }

  /**
   * Clear results
   */
  clearResults() {
    if (!this.resultContainer) return;

    this.resultContainer.innerHTML = '';
    this.resultContainer.className = '';
    this.isLoading = false;
    this._updateLoadingState();
  }

  /**
   * Set graph loaded state
   * @param {boolean} loaded - Whether graph is loaded
   */
  setGraphLoaded(loaded) {
    this.graphLoaded = loaded;
    if (this.submitButton) {
      this.submitButton.disabled = !loaded;
    }
  }

  /**
   * Update loading state UI
   * @private
   */
  _updateLoadingState() {
    if (this.submitButton) {
      this.submitButton.disabled = this.isLoading || !this.graphLoaded;
      this.submitButton.textContent = this.isLoading ? 'Calculating...' : '🔍 Find Path';
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
    }, 100); // Longer delay to ensure DOM is ready
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

              Via Waypoint ${index + 1}:
            </label>
          </div>
          <div class="waypoint-input-container" style="display: flex; align-items: center; gap: 10px;">
            <div class="autocomplete" role="combobox" aria-expanded="false" aria-haspopup="listbox" style="flex: 1;">
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
            <button type="button" class="btn-remove-waypoint" data-index="${index}" title="Remove this waypoint" style="background: #dc3545; color: white; border: none; width: 32px; height: 32px; min-width: 32px; min-height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; font-weight: bold; flex-shrink: 0; display: flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box; padding: 0;">×</button>
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
   * Setup autocomplete for a specific waypoint input using the SAME enhanced autocomplete
   * @private
   */
  _setupWaypointAutocomplete(waypointIndex) {
    console.log(`Setting up autocomplete for waypoint ${waypointIndex}`);
    const input = this.waypointsContainer?.querySelector(`#waypoint-${waypointIndex}`);
    if (!input) {
      console.log(`Input not found for waypoint ${waypointIndex}`);
      return;
    }
    console.log(`Found input for waypoint ${waypointIndex}:`, input);
    
    let autocomplete;
    
    if (this.options.useEnhancedSearch) {
      // Use IDENTICAL configuration to source/target autocomplete
      autocomplete = new EnhancedAutocompleteComponent(input, {
        placeholder: `Search waypoint ${waypointIndex + 1}: cabinet, fossil, DI box, wp_...`,
        ...this.commonAutocompleteConfig.enhanced
      });
    } else {
      // Use IDENTICAL configuration to source/target autocomplete
      autocomplete = new AutocompleteComponent(input, {
        placeholder: `Search for waypoint ${waypointIndex + 1}...`,
        ...this.commonAutocompleteConfig.basic
      });
      
      // Set nodes if graph is available
      if (this.graph) {
        const nodes = Array.from(this.graph.nodes);
        autocomplete.setNodes(nodes, this.graph.nodeTypes);
      }
    }
    
    // Store references
    this.intermediateWaypoints[waypointIndex].autocomplete = autocomplete;
    this.intermediateWaypoints[waypointIndex].input = input;
    
    // Handle selection - works for both regular and enhanced autocomplete
    input.addEventListener('autocomplete:select', (e) => {
      console.log(`Waypoint ${waypointIndex} autocomplete selected:`, e.detail);
      // Enhanced autocomplete might use different property names
      const nodeId = e.detail.nodeId || e.detail.id || e.detail.value;
      const nodeType = e.detail.nodeType || e.detail.type || (this.graph?.getNodeType(nodeId));
      this._setIntermediateWaypoint(waypointIndex, nodeId, nodeType);
    });

    // Handle enhanced autocomplete selection event
    input.addEventListener('enhanced-autocomplete:select', (e) => {
      console.log(`Waypoint ${waypointIndex} enhanced autocomplete selected:`, e.detail);
      const nodeId = e.detail.id || e.detail.nodeId || e.detail.value;
      const nodeType = e.detail.type || e.detail.nodeType || (this.graph?.getNodeType(nodeId));
      this._setIntermediateWaypoint(waypointIndex, nodeId, nodeType);
    });
    
    // Handle manual input on blur with more aggressive detection
    input.addEventListener('blur', () => {
      // Wait a bit for autocomplete to potentially set the value
      setTimeout(() => {
        const value = input.value.trim();
        console.log(`Waypoint ${waypointIndex} blur input (delayed):`, value);
        if (value && this.graph?.hasNode(value)) {
          const nodeType = this.graph.getNodeType(value);
          console.log(`Valid node found: ${value} (${nodeType})`);
          this._setIntermediateWaypoint(waypointIndex, value, nodeType);
        } else if (value) {
          console.log(`Invalid node: ${value} not found in graph`);
          // Try to auto-validate anyway in case the user typed correctly
          this._validateWaypoint(waypointIndex);
        }
      }, 100);
    });

    // Handle Enter key for immediate setting
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = input.value.trim();
        console.log(`Waypoint ${waypointIndex} Enter key:`, value);
        if (value && this.graph?.hasNode(value)) {
          const nodeType = this.graph.getNodeType(value);
          console.log(`Valid node found: ${value} (${nodeType})`);
          this._setIntermediateWaypoint(waypointIndex, value, nodeType);
        } else {
          // Try validation
          this._validateWaypoint(waypointIndex);
        }
      }
    });

    // Handle input changes for real-time validation
    input.addEventListener('input', () => {
      // Debounce the input validation
      clearTimeout(input._validationTimeout);
      input._validationTimeout = setTimeout(() => {
        const value = input.value.trim();
        if (value && this.graph?.hasNode(value)) {
          const nodeType = this.graph.getNodeType(value);
          console.log(`Auto-detected valid node: ${value} (${nodeType})`);
          this._setIntermediateWaypoint(waypointIndex, value, nodeType);
        }
      }, 500);
    });
  }

  /**
   * Manually validate waypoint input
   * @private
   */
  _validateWaypoint(waypointIndex) {
    const input = this.waypointsContainer?.querySelector(`#waypoint-${waypointIndex}`);
    if (!input) return;
    
    const value = input.value.trim();
    console.log(`Manually validating waypoint ${waypointIndex}:`, value);
    
    if (value && this.graph?.hasNode(value)) {
      const nodeType = this.graph.getNodeType(value);
      console.log(`Manual validation successful: ${value} (${nodeType})`);
      this._setIntermediateWaypoint(waypointIndex, value, nodeType);
    } else {
      console.log(`Manual validation failed: ${value} not found in graph`);
      console.log('Available nodes sample:', Array.from(this.graph.nodes).slice(0, 10));
    }
  }

  /**
   * Set a specific intermediate waypoint
   * @private
   */
  _setIntermediateWaypoint(waypointIndex, nodeId, nodeType) {
    console.log(`Setting waypoint ${waypointIndex}:`, { nodeId, nodeType });
    
    if (waypointIndex >= 0 && waypointIndex < this.intermediateWaypoints.length) {
      const coordinates = this.graph?.getNodeCoordinates(nodeId) || null;
      
      this.intermediateWaypoints[waypointIndex] = {
        ...this.intermediateWaypoints[waypointIndex],
        id: nodeId,
        type: nodeType,
        coordinates,
      };
      
      console.log(`Waypoint ${waypointIndex} set to:`, this.intermediateWaypoints[waypointIndex]);
      
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
    console.log('Handling submit with waypoints:', formData);
    
    if (!formData.hasWaypoints) {
      console.log('No waypoints detected, using regular pathfinding');
      // Regular single-point pathfinding
      this._emitEvent('pathfinding:submit', {
        source: formData.source,
        target: formData.target,
      });
      return;
    }

    console.log('Waypoints detected, calculating waypoint route');
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
        
        // Individual point-to-point pathfinding call with increased depth
        console.log(`Trying to find path: ${fromPoint} → ${toPoint}`);
        const path = this.pathfinder.findPath(fromPoint, toPoint, { maxDepth: 2000 });
        console.log(`Path result:`, path);
        const pathDetails = this.pathfinder.getPathDetails(path);
        console.log(`Path details:`, pathDetails);
        
        if (!pathDetails) {
          console.error(`Failed to find path between ${fromPoint} and ${toPoint}`);
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
