/**
 * Main Application Entry Point
 * 
 * Coordinates all modules and handles the main application logic
 */

import { WayfindingDataManager } from './data/loader.js';
import { Pathfinder } from './core/pathfinding.js';
import { PathfindingFormComponent } from './ui/pathfinding-form.js';
import { MapVisualizationComponent } from './ui/map-visualization.js';

/**
 * Main application class
 */
class WayfindingApp {
  constructor() {
    this.dataManager = null;
    this.graph = null;
    this.pathfinder = null;
    this.formComponent = null;
    this.mapComponent = null;
    this.isInitialized = false;
    this.isGraphLoaded = false;

    this._initializeApp();
  }

  /**
   * Initialize the application
   * @private
   */
  async _initializeApp() {
    try {
      this._setupComponents();
      this._bindEvents();
      this._updateStatus('Application initialized. Click "Load Graph Data" to begin.', 'info');
      
      // Auto-load graph data
      await this._loadGraphData();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this._updateStatus(`Initialization failed: ${error.message}`, 'error');
    }
  }

  /**
   * Setup UI components
   * @private
   */
  _setupComponents() {
    // Initialize form component
    const formElement = document.getElementById('pathfindingForm');
    if (formElement) {
      this.formComponent = new PathfindingFormComponent(formElement);
    }

    // Initialize map component
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) {
      this.mapComponent = new MapVisualizationComponent(mapContainer, {
        enableFallback: true,
        enableControls: true,
      });
    }

    // Multi-point container is handled by the form component

    // Initialize data manager
    this.dataManager = new WayfindingDataManager();
  }

  /**
   * Bind event listeners
   * @private
   */
  _bindEvents() {
    if (this.formComponent) {
      // Form submission
      this.formComponent.formElement.addEventListener('pathfinding:submit', (e) => {
        this._handlePathfindingRequest(e.detail);
      });

      // Load graph request
      this.formComponent.formElement.addEventListener('pathfinding:load-graph', () => {
        this._loadGraphData();
      });

      // Autocomplete selection
      this.formComponent.formElement.addEventListener('pathfinding:autocomplete-select', (e) => {
        this._handleAutocompleteSelect(e.detail);
      });

      // Waypoint route calculation
      this.formComponent.formElement.addEventListener('waypoint:route-calculated', (e) => {
        this._handleWaypointRouteCalculated(e.detail);
      });
    }

    // Map events
    if (this.mapComponent) {
      this.mapComponent.containerElement.addEventListener('map:loaded', () => {
        this._updateStatus('Map loaded successfully!', 'success');
      });

      this.mapComponent.containerElement.addEventListener('layer:toggled', (e) => {
        this._handleLayerToggle(e.detail);
      });
    }

    // Multi-point pathfinding events (handled by form component)
    if (this.formComponent) {
      this.formComponent.formElement.addEventListener('multipoint:route-calculated', (e) => {
        this._handleMultiPointRouteCalculated(e.detail);
      });

      this.formComponent.formElement.addEventListener('multipoint:updated', (e) => {
        this._handleMultiPointUpdated(e.detail);
      });
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this._handleKeyboardShortcuts(e);
    });

    // Setup example buttons
    this._setupExampleButtons();
  }

  /**
   * Load graph data
   * @private
   */
  async _loadGraphData() {
    if (this.isGraphLoaded) return;

    try {
      this._updateStatus('Loading wayfinding network...', 'info');
      this.formComponent?.showLoading('Loading wayfinding data...');

      // Load main wayfinding data and fixture data
      const wayfindingUrl = './public/geojson/wayfinding.geojson';
      const fixtureUrls = WayfindingDataManager.getDefaultFixtureUrls('./public/geojson');

      this.graph = await this.dataManager.loadAndBuildGraph(wayfindingUrl, fixtureUrls);
      this.pathfinder = new Pathfinder(this.graph);
      
      // Automatically test all fossil connectivity
      this._testFossilConnectivity();

      // Update UI components
      if (this.formComponent) {
        const nodes = Array.from(this.graph.nodes);
        this.formComponent.setAutocompleteData(nodes, this.graph.nodeTypes);
        this.formComponent.setPathfinder(this.pathfinder, this.graph);
        this.formComponent.setGraphLoaded(true);
      }

      if (this.mapComponent) {
        this.mapComponent.setGraph(this.graph);
      }

      // Show success message
      const stats = this.graph.getStatistics();
      this._showGraphLoadedResult(stats);
      this._updateStatus('Graph loaded successfully!', 'success', stats);

      this.isGraphLoaded = true;

    } catch (error) {
      console.error('Failed to load graph data:', error);
      this._updateStatus(`Failed to load graph: ${error.message}`, 'error');
      
      if (this.formComponent) {
        this.formComponent.showResult(`
          <h3>❌ Error Loading Graph</h3>
          <p>Failed to load wayfinding data: ${error.message}</p>
          <p>Please check that:</p>
          <ul>
            <li>The wayfinding.geojson file is accessible</li>
            <li>You're running this from a web server (not file://)</li>
            <li>All required GeoJSON files are present</li>
          </ul>
        `, 'error');
      }
    }
  }

  /**
   * Handle pathfinding request
   * @private
   */
  async _handlePathfindingRequest({ source, target }) {
    if (!this.isGraphLoaded || !this.pathfinder) {
      this.formComponent?.showResult(`
        <h3>⚠️ Graph Not Loaded</h3>
        <p>Please load the graph data first.</p>
      `, 'error');
      return;
    }

    try {
      this.formComponent?.showLoading(`Finding path from ${source} to ${target}...`);
      
      // Find the path
      const path = this.pathfinder.findPath(source, target);
      const pathDetails = this.pathfinder.getPathDetails(path);

      if (pathDetails) {
        // Update map visualization
        if (this.mapComponent) {
          this.mapComponent.setCurrentPath(pathDetails);
        }

        // Show result
        const resultHtml = this._formatPathResult(pathDetails);
        this.formComponent?.showResult(resultHtml, 'success');
        
        this._updateStatus(`Path found: ${pathDetails.length} nodes`, 'success');
      } else {
        this.formComponent?.showResult(`
          <h3>❌ No Path Found</h3>
          <p>Could not find a route from <strong>${source}</strong> to <strong>${target}</strong>.</p>
          <p>This might happen if:</p>
          <ul>
            <li>The fixtures are in disconnected parts of the network</li>
            <li>There are no waypoints connecting the fixtures</li>
            <li>The network structure has gaps</li>
          </ul>
        `, 'error');
        
        this._updateStatus('No path found', 'error');
      }

    } catch (error) {
      console.error('Pathfinding error:', error);
      this.formComponent?.showResult(`
        <h3>❌ Pathfinding Error</h3>
        <p><strong>Error:</strong> ${error.message}</p>
      `, 'error');
      
      this._updateStatus(`Pathfinding error: ${error.message}`, 'error');
    }
  }

  /**
   * Handle autocomplete selection
   * @private
   */
  _handleAutocompleteSelect({ field, nodeId, nodeType }) {
    console.log(`Selected ${nodeType} node: ${nodeId} for field: ${field}`);
  }

  /**
   * Handle layer toggle
   * @private
   */
  _handleLayerToggle({ layer, visible }) {
    console.log(`Layer ${layer} is now ${visible ? 'visible' : 'hidden'}`);
  }

  /**
   * Handle multi-point route calculated
   * @private
   */
  _handleMultiPointRouteCalculated({ points, segments, totalSegments }) {
    console.log(`Multi-point route calculated: ${points.length} points, ${totalSegments} segments`);
    
    // Update map with multi-point route visualization
    if (this.mapComponent) {
      // Create combined path for map display
      const allCoordinates = [];
      segments.forEach(segment => {
        const segmentCoords = segment.pathDetails.nodes
          .filter(node => node.coordinates)
          .map(node => node.coordinates);
        allCoordinates.push(...segmentCoords);
      });

      // Create a combined path details object for map display
      const combinedPathDetails = {
        path: segments.flatMap(s => s.path.slice(0, -1)).concat(segments[segments.length - 1]?.path || []),
        nodes: segments.flatMap(s => s.pathDetails.nodes.slice(0, -1)).concat(segments[segments.length - 1]?.pathDetails.nodes || []),
        length: segments.reduce((sum, s) => sum + s.path.length - 1, 1),
        summary: {
          start: { id: points[0].id, type: points[0].type },
          end: { id: points[points.length - 1].id, type: points[points.length - 1].type },
          waypointsUsed: segments.reduce((sum, s) => sum + s.pathDetails.summary.waypointsUsed, 0),
        },
      };

      this.mapComponent.setCurrentPath(combinedPathDetails);
    }

    this._updateStatus(`Multi-point route calculated: ${totalSegments} segments`, 'success');
  }

  /**
   * Handle waypoint route calculated
   * @private
   */
  _handleWaypointRouteCalculated({ routePoints, segments, totalSegments }) {
    console.log(`Waypoint route calculated: ${routePoints.length} points, ${totalSegments} segments`);
    
    // Update map with waypoint route visualization
    if (this.mapComponent) {
      // Create combined path for map display by joining all segments
      const allNodes = [];
      segments.forEach((segment, index) => {
        // Add all nodes from this segment, but avoid duplicating connection points
        const segmentNodes = segment.pathDetails.nodes;
        if (index === 0) {
          // First segment: add all nodes
          allNodes.push(...segmentNodes);
        } else {
          // Subsequent segments: skip first node (it's the same as last node of previous segment)
          allNodes.push(...segmentNodes.slice(1));
        }
      });

      // Create a combined path details object for map display
      const combinedPath = segments.flatMap((s, index) => 
        index === 0 ? s.path : s.path.slice(1)
      );

      const combinedPathDetails = {
        path: combinedPath,
        nodes: allNodes,
        length: combinedPath.length,
        summary: {
          start: { id: routePoints[0], type: segments[0].pathDetails.summary.start.type },
          end: { id: routePoints[routePoints.length - 1], type: segments[segments.length - 1].pathDetails.summary.end.type },
          waypointsUsed: segments.reduce((sum, s) => sum + s.pathDetails.summary.waypointsUsed, 0),
        },
      };

      this.mapComponent.setCurrentPath(combinedPathDetails);
    }

    this._updateStatus(`Waypoint route calculated: ${totalSegments} segments through ${routePoints.length} points`, 'success');
  }

  /**
   * Handle keyboard shortcuts
   * @private
   */
  _handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (this.isGraphLoaded) {
        const formData = this.formComponent?.getFormData();
        if (formData && formData.source && formData.target) {
          this._handlePathfindingRequest(formData);
        }
      } else {
        this._loadGraphData();
      }
    }

    // Escape to clear results
    if (e.key === 'Escape') {
      this.formComponent?.clearResults();
    }
  }

  /**
   * Setup example buttons
   * @private
   */
  _setupExampleButtons() {
    const examples = [
      { source: 'di_27_18_top', target: 'fossil_excavation_1', label: 'DI Box → Fossil' },
      { source: 'col_1_cab_01', target: 'di_05_01_top', label: 'Cabinet → DI Box' },
      { source: 'fossil_excavation_1', target: 'col_2_cab_15', label: 'Fossil → Cabinet' },
      { source: 'wp_001', target: 'wp_025', label: 'Waypoint → Waypoint' },
      { source: 'wp_010', target: 'di_27_18_top', label: 'Waypoint → DI Box' },
    ];

    examples.forEach(example => {
      const button = document.querySelector(`[data-source="${example.source}"][data-target="${example.target}"]`);
      if (button) {
        button.addEventListener('click', () => {
          this.formComponent?.setExample(example.source, example.target);
        });
      }
    });
  }

  /**
   * Show graph loaded result
   * @private
   */
  _showGraphLoadedResult(stats) {
    if (!this.formComponent) return;

    const fixtureCount = (stats.nodeTypes.di_box || 0) + 
                        (stats.nodeTypes.cabinet || 0) + 
                        (stats.nodeTypes.fossil || 0);

    this.formComponent.showResult(`
            <div class="ready-message">
        <strong>💡 Ready to use!</strong> Start typing in the input fields for autocomplete suggestions, or use the quick example buttons below.
      </div>
      <h3>✅ Walking Routes Loaded Successfully!</h3>

      <div class="node-types">
        <h4>Node Types Breakdown:</h4>
        <ul>
          <li>🔵 Waypoints: ${(stats.nodeTypes.waypoint || 0).toLocaleString()} (navigation grid points)</li>
          <li>🟠 DI Boxes: ${(stats.nodeTypes.di_box || 0).toLocaleString()} (display drawers)</li>
          <li>🟣 Cabinets: ${(stats.nodeTypes.cabinet || 0).toLocaleString()} (storage/equipment)</li>
          <li>🟢 Fossil Excavations: ${(stats.nodeTypes.fossil || 0).toLocaleString()} (dig sites)</li>
        </ul>
      </div>

    `, 'success');
  }

  /**
   * Format path result for display
   * @private
   */
  _formatPathResult(pathDetails) {
    const { nodes, summary, path } = pathDetails;
    
    let html = `
      <h3>✅ Path Found!</h3>
      <div class="path-summary">
        <p><strong>Route Length:</strong> ${path.length} nodes</p>
        <p><strong>Waypoints Used:</strong> ${summary.waypointsUsed}</p>
        <p><strong>From:</strong> ${summary.start.id} (${summary.start.type})</p>
        <p><strong>To:</strong> ${summary.end.id} (${summary.end.type})</p>
      </div>
      
      <h4>Full Path:</h4>
      <div class="path-nodes">
    `;
    
    nodes.forEach((node, index) => {
      html += `<span class="path-node ${node.type}">${node.id}</span>`;
      if (index < nodes.length - 1) {
        html += ' → ';
      }
    });
    
    html += `</div>`;
    
    // Show coordinates if available
    html += `<h4>Node Details:</h4><div class="node-details">`;
    nodes.forEach(node => {
      html += `
        <div class="node-detail">
          <strong>${node.id}</strong> (${node.type})
          ${node.coordinates ? 
            `<div class="coordinates">Coordinates: [${node.coordinates[0].toFixed(6)}, ${node.coordinates[1].toFixed(6)}]</div>` : 
            '<div class="no-coordinates">No coordinates available</div>'
          }
        </div>
      `;
    });
    html += `</div>`;
    
    // Add GeoJSON export section
    html += `
      <h4>📄 Export as GeoJSON:</h4>
      <div class="export-actions">
        <button onclick="app.copyPathGeoJSON()" class="export-button">📋 Copy GeoJSON</button>
        <button onclick="app.downloadPathGeoJSON()" class="export-button">💾 Download GeoJSON</button>
      </div>
      <details class="geojson-details">
        <summary>📝 View GeoJSON Code</summary>
        <pre class="geojson-code">${JSON.stringify(this._generatePathGeoJSON(pathDetails), null, 2)}</pre>
      </details>
    `;
    
    return html;
  }

  /**
   * Generate GeoJSON from path details
   * @private
   */
  _generatePathGeoJSON(pathDetails) {
    if (!pathDetails) return null;

    const features = [];
    const { nodes, path } = pathDetails;

    // Create LineString feature for the path
    const pathCoordinates = nodes
      .filter(node => node.coordinates)
      .map(node => node.coordinates);

    if (pathCoordinates.length > 1) {
      features.push({
        type: "Feature",
        properties: {
          name: `Path: ${path[0]} to ${path[path.length - 1]}`,
          description: `Route from ${path[0]} to ${path[path.length - 1]} via waypoints`,
          path_type: "fixture_to_fixture",
          nodes: path,
          stroke: "#ff6b35",
          "stroke-width": 4,
          "stroke-opacity": 0.8
        },
        geometry: {
          type: "LineString",
          coordinates: pathCoordinates
        }
      });
    }

    // Create Point features for each node
    nodes.forEach((node, index) => {
      if (!node.coordinates) return;

      const markerColors = {
        di_box: "#ff8c00",
        cabinet: "#7b1fa2",
        fossil: "#32cd32",
        waypoint: "#1e90ff",
      };

      const markerSymbols = {
        di_box: "industrial",
        cabinet: "warehouse",
        fossil: "monument",
        waypoint: "circle",
      };

      features.push({
        type: "Feature",
        properties: {
          name: node.id,
          type: node.type,
          "marker-color": markerColors[node.type] || "#666666",
          "marker-size": node.type === 'waypoint' ? 'small' : 'medium',
          "marker-symbol": markerSymbols[node.type] || "circle",
          order: index + 1
        },
        geometry: {
          type: "Point",
          coordinates: node.coordinates
        }
      });
    });

    return {
      type: "FeatureCollection",
      features: features
    };
  }

  /**
   * Copy path GeoJSON to clipboard
   */
  async copyPathGeoJSON() {
    const pathDetails = this.mapComponent?.currentPath;
    if (!pathDetails) {
      alert('No path data available to copy');
      return;
    }

    const geojson = this._generatePathGeoJSON(pathDetails);
    const geojsonString = JSON.stringify(geojson, null, 2);

    try {
      await navigator.clipboard.writeText(geojsonString);
      this._showTemporaryMessage('✅ GeoJSON copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback: select the text
      const preElement = document.querySelector('.geojson-code');
      if (preElement) {
        const range = document.createRange();
        range.selectNodeContents(preElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        alert('GeoJSON selected. Press Ctrl+C (or Cmd+C) to copy.');
      }
    }
  }

  /**
   * Download path GeoJSON as file
   */
  downloadPathGeoJSON() {
    const pathDetails = this.mapComponent?.currentPath;
    if (!pathDetails) {
      alert('No path data available to download');
      return;
    }

    const geojson = this._generatePathGeoJSON(pathDetails);
    const geojsonString = JSON.stringify(geojson, null, 2);
    
    const blob = new Blob([geojsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `path_${pathDetails.path[0]}_to_${pathDetails.path[pathDetails.path.length - 1]}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this._showTemporaryMessage('✅ GeoJSON file downloaded!');
  }

  /**
   * Update status display
   * @private
   */
  _updateStatus(message, type = 'info', dataInfo = null) {
    const statusText = document.getElementById('statusText');
    if (statusText) {
      let statusHTML = message;
      
      if (dataInfo) {
        const fixtureCount = (dataInfo.nodeTypes?.di_box || 0) + 
                           (dataInfo.nodeTypes?.cabinet || 0) + 
                           (dataInfo.nodeTypes?.fossil || 0);
        statusHTML += `<br><small>📊 Data: ${dataInfo.totalNodes} nodes, ${fixtureCount} fixtures, ${dataInfo.nodeTypes?.waypoint || 0} waypoints</small>`;
      }
      
      statusText.innerHTML = statusHTML;
      statusText.className = `status-${type}`;
    }
  }

  /**
   * Show temporary message
   * @private
   */
  _showTemporaryMessage(message, duration = 2000) {
    const messageEl = document.createElement('div');
    messageEl.className = 'temporary-message';
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      z-index: 10000;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl);
      }
    }, duration);
  }

  /**
   * Toggle map layer visibility
   */
  toggleLayer(layerName) {
    console.log(`🔍 Toggling layer: ${layerName}`);
    if (this.mapComponent) {
      this.mapComponent.toggleLayer(layerName);
    }
  }

  /**
   * Reset map view
   */
  resetMapView() {
    if (this.mapComponent) {
      this.mapComponent.resetView();
    }
  }

  /**
   * Get application statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isGraphLoaded: this.isGraphLoaded,
      graphStats: this.graph ? this.graph.getStatistics() : null,
    };
  }

  /**
   * Test all fossil connectivity automatically
   * @private
   */
  _testFossilConnectivity() {
    console.log('🧪 TESTING ALL FOSSIL CONNECTIVITY');
    
    const allNodes = Array.from(this.graph.nodes);
    const fossilNodes = allNodes.filter(nodeId => nodeId.startsWith('fossil_excavation_'));
    
    console.log(`Found ${fossilNodes.length} fossil nodes:`, fossilNodes);
    
    let totalTests = 0;
    let successfulPaths = 0;
    const failedPaths = [];
    
    for (let i = 0; i < fossilNodes.length; i++) {
      for (let j = 0; j < fossilNodes.length; j++) {
        if (i !== j) {
          const from = fossilNodes[i];
          const to = fossilNodes[j];
          totalTests++;
          
          const path = this.pathfinder.findPath(from, to, { maxDepth: 2000 }); // Increase search depth
          if (path) {
            successfulPaths++;
            console.log(`✅ ${from} → ${to}: ${path.join(' → ')}`);
          } else {
            failedPaths.push(`${from} → ${to}`);
            console.log(`❌ ${from} → ${to}: NO PATH`);
          }
        }
      }
    }
    
    console.log(`🧪 FOSSIL CONNECTIVITY TEST RESULTS:`);
    console.log(`Total tests: ${totalTests}`);
    console.log(`Successful paths: ${successfulPaths}`);
    console.log(`Failed paths: ${failedPaths.length}`);
    console.log(`Success rate: ${(successfulPaths/totalTests*100).toFixed(1)}%`);
    
    if (failedPaths.length > 0) {
      console.log(`❌ FAILED PATHS:`, failedPaths);
    }
    
    // Test individual fossil connectivity to waypoints
    console.log('🧪 TESTING FOSSIL-TO-WAYPOINT CONNECTIVITY');
    const waypointNodes = allNodes.filter(nodeId => nodeId.startsWith('wp_')).slice(0, 5); // Test first 5 waypoints
    
    fossilNodes.forEach(fossil => {
      const connectedWaypoints = [];
      waypointNodes.forEach(waypoint => {
        const path = this.pathfinder.findPath(fossil, waypoint);
        if (path) {
          connectedWaypoints.push(waypoint);
        }
      });
      console.log(`${fossil} connects to waypoints: ${connectedWaypoints.join(', ') || 'NONE'}`);
    });
  }

  /**
   * Destroy the application
   */
  destroy() {
    if (this.formComponent) {
      this.formComponent.destroy();
    }
    if (this.mapComponent) {
      this.mapComponent.destroy();
    }
  }
}

// Initialize the application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new WayfindingApp();
  // Export for global access after initialization
  window.app = app;
});

export default WayfindingApp;
