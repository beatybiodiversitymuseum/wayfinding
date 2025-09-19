/**
 * Map Visualization Component
 * 
 * Handles map rendering and path visualization using MapLibre GL and Deck.gl
 */

/**
 * Map visualization component
 */
export class MapVisualizationComponent {
  constructor(containerElement, options = {}) {
    if (!(containerElement instanceof HTMLElement)) {
      throw new Error('Container element must be an HTMLElement');
    }

    this.containerElement = containerElement;
    this.options = {
      defaultCenter: [-123.250617, 49.263428],
      defaultZoom: 20,
      defaultPitch: 45,
      defaultBearing: 0,
      mapStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      enableControls: true,
      enableFallback: true,
      ...options,
    };

    this.map = null;
    this.deckOverlay = null;
    this.graph = null;
    this.currentPath = null;
    this.layerVisibility = {
      waypoints: false,
      fixtures: true,
      walkingPaths: false,
      currentPath: true,
    };

    this._initializeComponent();
  }

  /**
   * Initialize the map component
   * @private
   */
  _initializeComponent() {
    this._checkDependencies();
    this._createMap();
    this._setupEventListeners();
  }

  /**
   * Check if required dependencies are available
   * @private
   */
  _checkDependencies() {
    this.hasMapLibre = typeof maplibregl !== 'undefined';
    this.hasDeckGL = typeof deck !== 'undefined';

    if (!this.hasMapLibre && this.options.enableFallback) {
      console.warn('MapLibre GL not available, using fallback visualization');
      this._createFallbackVisualization();
      return;
    }

    if (!this.hasMapLibre) {
      throw new Error('MapLibre GL is required for map visualization');
    }
  }

  /**
   * Create the map instance
   * @private
   */
  _createMap() {
    if (!this.hasMapLibre) return;

    try {
      this.map = new maplibregl.Map({
        container: this.containerElement,
        style: this.options.mapStyle,
        center: this.options.defaultCenter,
        zoom: this.options.defaultZoom,
        pitch: this.options.defaultPitch,
        bearing: this.options.defaultBearing,
      });

      // Add deck.gl overlay if available
      if (this.hasDeckGL) {
        this.deckOverlay = new deck.MapboxOverlay({
          interleaved: true,
        });
        this.map.addControl(this.deckOverlay);
        
        // Set up event handlers after adding to map
        this.deckOverlay.setProps({
          getTooltip: this._getTooltip.bind(this),
          onClick: this._onClick.bind(this),
          onHover: this._onHover.bind(this),
          getCursor: this._getCursor.bind(this),
        });
      }

      // Add navigation controls
      if (this.options.enableControls) {
        this.map.addControl(new maplibregl.NavigationControl(), 'top-left');
      }

      this.map.on('load', () => {
        this._onMapLoad();
      });

      this.map.on('error', (e) => {
        console.error('Map error:', e);
        if (this.options.enableFallback) {
          this._createFallbackVisualization();
        }
      });

    } catch (error) {
      console.error('Error creating map:', error);
      if (this.options.enableFallback) {
        this._createFallbackVisualization();
      } else {
        throw error;
      }
    }
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupEventListeners() {
    if (this.map) {
      // Viewport debugging events (can be enabled for development)
      if (this.options.enableViewportLogging) {
        this.map.on('moveend', () => this._logViewport());
        this.map.on('zoomend', () => this._logViewport());
      }
    }
  }

  /**
   * Handle map load event
   * @private
   */
  _onMapLoad() {
    this._updateLayers();
    this._dispatchEvent('map:loaded');
  }

  /**
   * Set the graph data for visualization
   * @param {WayfindingGraph} graph - The wayfinding graph
   */
  setGraph(graph) {
    this.graph = graph;
    this._updateLayers();
  }

  /**
   * Set the current path for visualization
   * @param {Object} pathDetails - Path details object
   */
  setCurrentPath(pathDetails) {
    this.currentPath = pathDetails;
    this._updateLayers();
    
    if (pathDetails && this.map) {
      this._fitToPath(pathDetails);
    }
    
    if (!this.map && this.options.enableFallback) {
      this._updateFallbackVisualization();
    }
  }

  /**
   * Toggle layer visibility
   * @param {string} layerName - Name of the layer to toggle
   */
  toggleLayer(layerName) {
    if (layerName in this.layerVisibility) {
      this.layerVisibility[layerName] = !this.layerVisibility[layerName];
      this._updateLayers();
      
      this._dispatchEvent('layer:toggled', {
        layer: layerName,
        visible: this.layerVisibility[layerName],
      });
    }
  }

  /**
   * Reset map view to default
   */
  resetView() {
    if (this.map) {
      this.map.flyTo({
        center: this.options.defaultCenter,
        zoom: this.options.defaultZoom,
        pitch: this.options.defaultPitch,
        bearing: this.options.defaultBearing,
      });
    }
  }

  /**
   * Fit map to path bounds
   * @private
   */
  _fitToPath(pathDetails) {
    if (!pathDetails || !pathDetails.nodes || !this.map) return;

    const coordinates = pathDetails.nodes
      .filter(node => node.coordinates)
      .map(node => node.coordinates);

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      // Single point - center on it
      this.map.flyTo({
        center: coordinates[0],
        zoom: Math.max(this.options.defaultZoom, this.map.getZoom()),
      });
    } else {
      // Multiple points - fit bounds
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

      this.map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 22,
      });
    }
  }

  /**
   * Update deck.gl layers
   * @private
   */
  _updateLayers() {
    if (!this.deckOverlay || !this.graph) return;

    const layers = [];

    // Waypoints layer
    if (this.layerVisibility.waypoints) {
      layers.push(this._createWaypointsLayer());
    }

    // Fixtures layer
    if (this.layerVisibility.fixtures) {
      layers.push(...this._createFixturesLayers());
    }

    // Walking paths layer
    if (this.layerVisibility.walkingPaths) {
      layers.push(this._createWalkingPathsLayer());
    }

    // Current path layer
    if (this.layerVisibility.currentPath && this.currentPath) {
      layers.push(this._createCurrentPathLayer());
    }

    try {
      this.deckOverlay.setProps({ layers: layers.filter(Boolean) });
    } catch (error) {
      console.error('Error updating deck.gl layers:', error);
    }
  }

  /**
   * Create waypoints layer
   * @private
   */
  _createWaypointsLayer() {
    if (!this.hasDeckGL) return null;

    const waypointData = Array.from(this.graph.nodes)
      .filter(nodeId => this.graph.getNodeType(nodeId) === 'waypoint')
      .map(nodeId => ({
        position: this.graph.getNodeCoordinates(nodeId),
        name: nodeId,
        type: 'waypoint',
      }))
      .filter(item => item.position);

    return new deck.ScatterplotLayer({
      id: 'waypoints',
      data: waypointData,
      pickable: true,
      opacity: 0.8,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 1,
      radiusMaxPixels: 1,
      lineWidthMinPixels: 0.1,
      lineWidthMaxPixels: 1,
      getPosition: d => d.position,
      getRadius: d => 1,
      getFillColor: [30, 144, 255, 180], // Blue
      getLineColor: [0, 0, 139, 255], // Dark blue
    });
  }

  /**
   * Create fixtures layers (polygons and points)
   * @private
   */
  _createFixturesLayers() {
    if (!this.hasDeckGL) return [];

    const layers = [];
    const fixturePolygonData = [];
    const fixturePointData = [];

    // Process fixture nodes
    Array.from(this.graph.nodes)
      .filter(nodeId => this.graph.getNodeType(nodeId) !== 'waypoint')
      .forEach(nodeId => {
        const type = this.graph.getNodeType(nodeId);
        const color = this._getFixtureColor(type);

        // Check for polygon data
        const polygon = this.graph.fixturePolygons?.get(nodeId);
        if (polygon) {
          fixturePolygonData.push({
            polygon: polygon,
            name: nodeId,
            type: type,
            color: color,
          });
        } else {
          // Fallback to point
          const position = this.graph.getNodeCoordinates(nodeId);
          if (position) {
            fixturePointData.push({
              position: position,
              name: nodeId,
              type: type,
              color: color,
            });
          }
        }
      });

    // Add polygon layer
    console.log(`🔍 Fixture polygon data: ${fixturePolygonData.length} polygons`);
    if (fixturePolygonData.length > 0) {
      console.log('✅ Adding polygon layer with data:', fixturePolygonData.slice(0, 3));
      layers.push(new deck.PolygonLayer({
        id: 'fixture-polygons',
        data: fixturePolygonData,
        pickable: true,
        filled: true,
        stroked: true,
        lineWidthMinPixels: 1,
        lineWidthMaxPixels: 2,
        getPolygon: d => d.polygon,
        getFillColor: d => d.color,
        getLineColor: d => [
          d.color[0] * 0.7,
          d.color[1] * 0.7,
          d.color[2] * 0.7,
          200,
        ],
      }));
    }

    // Add point layer
    if (fixturePointData.length > 0) {
      layers.push(new deck.ScatterplotLayer({
        id: 'fixture-points',
        data: fixturePointData,
        pickable: true,
        opacity: 0.9,
        stroked: true,
        filled: true,
        radiusScale: 8,
        radiusMinPixels: 4,
        radiusMaxPixels: 12,
        lineWidthMinPixels: 2,
        getPosition: d => d.position,
        getRadius: d => 6,
        getFillColor: d => d.color,
        getLineColor: [0, 0, 0, 255],
      }));
    }

    return layers;
  }

  /**
   * Create walking paths layer
   * @private
   */
  _createWalkingPathsLayer() {
    if (!this.hasDeckGL || !this.graph.walkingPaths) return null;

    return new deck.PathLayer({
      id: 'walking-paths',
      data: this.graph.walkingPaths,
      pickable: false,
      widthScale: 1,
      widthMinPixels: 1,
      widthMaxPixels: 2,
      getPath: d => d.path,
      getWidth: d => 1,
      getColor: [200, 200, 200, 100], // Light gray
    });
  }

  /**
   * Create current path layer
   * @private
   */
  _createCurrentPathLayer() {
    if (!this.hasDeckGL || !this.currentPath) return null;

    const pathCoordinates = this.currentPath.nodes
      .filter(node => node.coordinates)
      .map(node => node.coordinates);

    if (pathCoordinates.length < 2) return null;

    return new deck.PathLayer({
      id: 'current-path',
      data: [{
        path: pathCoordinates,
        name: `Path: ${this.currentPath.path[0]} to ${this.currentPath.path[this.currentPath.path.length - 1]}`,
      }],
      pickable: true,
      widthScale: 4,
      widthMinPixels: 4,
      widthMaxPixels: 8,
      getPath: d => d.path,
      getWidth: d => 4,
      getColor: [255, 107, 53, 200], // Orange-red
    });
  }

  /**
   * Get color for fixture type
   * @private
   */
  _getFixtureColor(type) {
    const colors = {
      di_box: [255, 140, 0, 120], // Orange
      cabinet: [123, 31, 162, 120], // Purple
      fossil: [50, 205, 50, 120], // Green
    };
    return colors[type] || [128, 128, 128, 120]; // Gray
  }

  /**
   * Create fallback visualization
   * @private
   */
  _createFallbackVisualization() {
    this.containerElement.innerHTML = `
      <div class="fallback-visualization">
        <h3>🗺️ Route Visualization</h3>
        <div class="fallback-content">
          <div class="fallback-message">
            Map visualization requires MapLibre GL. Path data will be shown here when available.
          </div>
        </div>
      </div>
    `;

    // Apply styles
    const style = document.createElement('style');
    style.textContent = `
      .fallback-visualization {
        height: 100%;
        background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        position: relative;
      }
      .fallback-content {
        height: 400px;
        background: white;
        border-radius: 8px;
        position: relative;
        overflow: hidden;
        border: 2px solid #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .fallback-message {
        color: #666;
        font-size: 14px;
      }
      .fallback-path-info {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        border-left: 4px solid #ff6b35;
        text-align: left;
        margin: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update fallback visualization with path data
   * @private
   */
  _updateFallbackVisualization() {
    const content = this.containerElement.querySelector('.fallback-content');
    if (!content) return;

    if (this.currentPath && this.currentPath.nodes.length > 0) {
      content.innerHTML = `
        <div class="fallback-path-info">
          <h4>📍 Current Path</h4>
          <div><strong>From:</strong> ${this.currentPath.summary.start.id} (${this.currentPath.summary.start.type})</div>
          <div><strong>To:</strong> ${this.currentPath.summary.end.id} (${this.currentPath.summary.end.type})</div>
          <div><strong>Route Length:</strong> ${this.currentPath.path.length} nodes</div>
          <div><strong>Waypoints Used:</strong> ${this.currentPath.summary.waypointsUsed}</div>
          <div style="margin-top: 10px; font-size: 12px; color: #666;">
            <strong>Path:</strong><br>
            ${this.currentPath.path.join(' → ')}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="fallback-message">
          <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
          <div>Calculate a path to see route visualization</div>
          <div style="font-size: 12px; margin-top: 10px; color: #888;">
            ${this.graph ? `${this.graph.nodes.size} nodes loaded` : 'Loading graph data...'}
          </div>
        </div>
      `;
    }
  }

  /**
   * Log viewport information (for debugging)
   * @private
   */
  _logViewport() {
    if (this.map) {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing();
      const pitch = this.map.getPitch();

      console.log('Viewport:', {
        center: [center.lng, center.lat],
        zoom,
        bearing,
        pitch,
      });
    }
  }

  /**
   * Dispatch custom event
   * @private
   */
  _dispatchEvent(eventName, detail = {}) {
    this.containerElement.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Get tooltip content for hovered objects
   * @private
   */
  _getTooltip(info) {
    if (!info.object) return null;

    const { object, layer } = info;
    
    // Handle different layer types
    if (layer.id === 'waypoints') {
      return {
        html: `
          <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; max-width: 200px;">
            <div style="font-weight: bold; color: #1e90ff;">🔵 Waypoint</div>
            <div style="margin: 4px 0;"><strong>ID:</strong> ${object.name}</div>
            <div style="font-size: 10px; color: #ccc;">Click to copy ID</div>
          </div>
        `,
        style: {
          fontSize: '12px',
          zIndex: 1000
        }
      };
    }
    
    if (layer.id === 'fixture-polygons' || layer.id === 'fixture-points') {
      const typeColors = {
        di_box: '#ff8c00',
        cabinet: '#7b1fa2', 
        fossil: '#32cd32'
      };
      
      const typeIcons = {
        di_box: '🟠',
        cabinet: '🟣',
        fossil: '🟢'
      };
      
      const typeNames = {
        di_box: 'DI Box',
        cabinet: 'Cabinet',
        fossil: 'Fossil Excavation'
      };
      
      return {
        html: `
          <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; max-width: 200px;">
            <div style="font-weight: bold; color: ${typeColors[object.type] || '#666'};">
              ${typeIcons[object.type] || '📍'} ${typeNames[object.type] || object.type}
            </div>
            <div style="margin: 4px 0;"><strong>ID:</strong> ${object.name}</div>
            <div style="font-size: 10px; color: #ccc;">Click to copy ID</div>
          </div>
        `,
        style: {
          fontSize: '12px',
          zIndex: 1000
        }
      };
    }
    
    if (layer.id === 'current-path') {
      return {
        html: `
          <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px; max-width: 200px;">
            <div style="font-weight: bold; color: #ff6b35;">🔶 Current Path</div>
            <div style="margin: 4px 0;">${object.name}</div>
          </div>
        `,
        style: {
          fontSize: '12px',
          zIndex: 1000
        }
      };
    }
    
    return null;
  }

  /**
   * Handle click events on map objects
   * @private
   */
  _onClick(info) {
    if (!info.object) return;

    const { object, layer } = info;
    let nodeId = null;
    
    // Extract node ID from different layer types
    if (layer.id === 'waypoints' || layer.id === 'fixture-polygons' || layer.id === 'fixture-points') {
      nodeId = object.name;
    }
    
    if (nodeId) {
      // Copy ID to clipboard
      this._copyToClipboard(nodeId);
      
      // Show temporary feedback
      this._showClickFeedback(info.x, info.y, nodeId);
      
      // Dispatch custom event
      this._dispatchEvent('node:clicked', {
        nodeId: nodeId,
        nodeType: this.graph?.getNodeType(nodeId),
        coordinates: this.graph?.getNodeCoordinates(nodeId),
        clickPosition: { x: info.x, y: info.y }
      });
    }
  }

  /**
   * Handle hover events on map objects
   * @private
   */
  _onHover(info) {
    // The tooltip is handled by _getTooltip, but we can dispatch hover events here
    if (info.object) {
      const { object, layer } = info;
      let nodeId = null;
      
      if (layer.id === 'waypoints' || layer.id === 'fixture-polygons' || layer.id === 'fixture-points') {
        nodeId = object.name;
      }
      
      if (nodeId) {
        this._dispatchEvent('node:hovered', {
          nodeId: nodeId,
          nodeType: this.graph?.getNodeType(nodeId),
          coordinates: this.graph?.getNodeCoordinates(nodeId),
          hoverPosition: { x: info.x, y: info.y }
        });
      }
    }
  }

  /**
   * Get cursor style for hovered objects
   * @private
   */
  _getCursor(info) {
    if (info.object) {
      const { layer } = info;
      if (layer.id === 'waypoints' || layer.id === 'fixture-polygons' || layer.id === 'fixture-points') {
        return 'pointer';
      }
    }
    return 'grab';
  }

  /**
   * Copy text to clipboard
   * @private
   */
  async _copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      console.log(`Copied "${text}" to clipboard`);
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
      // Fallback: create temporary text area
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show visual feedback when clicking on a node
   * @private
   */
  _showClickFeedback(x, y, nodeId) {
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      z-index: 10000;
      pointer-events: none;
      transform: translate(-50%, -100%);
      animation: clickFeedback 1.5s ease-out forwards;
    `;
    feedback.textContent = `Copied: ${nodeId}`;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes clickFeedback {
        0% { opacity: 1; transform: translate(-50%, -100%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -120%) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      if (document.body.contains(feedback)) {
        document.body.removeChild(feedback);
      }
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }, 1500);
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    
    this.deckOverlay = null;
    this.graph = null;
    this.currentPath = null;
  }
}
