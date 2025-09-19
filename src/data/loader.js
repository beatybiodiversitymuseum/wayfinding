/**
 * Data Loader Module
 * 
 * Handles loading and parsing of GeoJSON data files for the wayfinding system.
 */

import { WayfindingGraph, NODE_TYPES, determineNodeType, PathfindingError } from '../core/pathfinding.js';

/**
 * Data loading error types
 */
export class DataLoadingError extends Error {
  constructor(message, code = 'DATA_LOADING_ERROR', cause = null) {
    super(message);
    this.name = 'DataLoadingError';
    this.code = code;
    this.cause = cause;
  }
}

/**
 * GeoJSON data loader and parser
 */
export class GeoJSONLoader {
  constructor(options = {}) {
    this.options = {
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...options,
    };
  }

  /**
   * Load GeoJSON data from a URL with retry logic
   * @param {string} url - URL to load data from
   * @returns {Promise<Object>} Parsed GeoJSON data
   */
  async loadGeoJSON(url) {
    if (!url || typeof url !== 'string') {
      throw new DataLoadingError('URL must be a non-empty string', 'INVALID_URL');
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new DataLoadingError(
            `HTTP ${response.status}: ${response.statusText}`,
            'HTTP_ERROR'
          );
        }

        const data = await response.json();
        
        if (!this._isValidGeoJSON(data)) {
          throw new DataLoadingError(
            'Invalid GeoJSON format',
            'INVALID_GEOJSON'
          );
        }

        return data;

      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          lastError = new DataLoadingError(
            `Request timeout after ${this.options.timeout}ms`,
            'TIMEOUT',
            error
          );
        }

        if (attempt < this.options.retryAttempts) {
          console.warn(`Attempt ${attempt} failed, retrying in ${this.options.retryDelay}ms...`, error.message);
          await this._delay(this.options.retryDelay);
        }
      }
    }

    throw new DataLoadingError(
      `Failed to load data after ${this.options.retryAttempts} attempts: ${lastError.message}`,
      'MAX_RETRIES_EXCEEDED',
      lastError
    );
  }

  /**
   * Load multiple GeoJSON files in parallel
   * @param {Array<string>} urls - Array of URLs to load
   * @returns {Promise<Array<Object>>} Array of parsed GeoJSON data
   */
  async loadMultipleGeoJSON(urls) {
    if (!Array.isArray(urls)) {
      throw new DataLoadingError('URLs must be an array', 'INVALID_URLS');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const data = await this.loadGeoJSON(url);
        results.push(data);
      } catch (error) {
        console.warn(`Failed to load fixture file ${url}:`, error.message);
        errors.push({ url, error: error.message });
        // Continue with other files
      }
    }

    if (results.length === 0 && errors.length > 0) {
      throw new DataLoadingError(
        `All fixture files failed to load: ${errors.map(e => e.error).join(', ')}`,
        'ALL_FILES_FAILED'
      );
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} of ${urls.length} fixture files failed to load`);
    }

    return results;
  }

  /**
   * Validate GeoJSON structure
   * @private
   */
  _isValidGeoJSON(data) {
    return (
      data &&
      typeof data === 'object' &&
      data.type === 'FeatureCollection' &&
      Array.isArray(data.features)
    );
  }

  /**
   * Delay utility for retry logic
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Graph builder for converting GeoJSON data into a WayfindingGraph
 */
export class GraphBuilder {
  constructor(options = {}) {
    this.options = {
      strictValidation: true,
      logWarnings: true,
      ...options,
    };
  }

  /**
   * Build a WayfindingGraph from GeoJSON data
   * @param {Object} geojsonData - The main wayfinding GeoJSON data
   * @param {Array<Object>} fixtureData - Array of fixture GeoJSON data (optional)
   * @returns {WayfindingGraph} Constructed graph
   */
  buildGraph(geojsonData, fixtureData = []) {
    const graph = new WayfindingGraph();
    const walkingPaths = [];

    try {
      // First pass: Process points (waypoints and fixture points)
      this._processPoints(geojsonData, graph);

      // Second pass: Process lines (edges and walking paths)
      this._processLines(geojsonData, graph, walkingPaths);

      // Third pass: Process polygons from main data
      this._processPolygons(geojsonData, graph);

      // Fourth pass: Process fixture data
      console.log(`🔍 Processing ${fixtureData.length} fixture files...`);
      for (const fixtureGeoJSON of fixtureData) {
        console.log(`🔍 Processing fixture file with ${fixtureGeoJSON.features?.length || 0} features`);
        this._processFixtureData(fixtureGeoJSON, graph);
      }
      console.log(`🔍 After fixture processing: ${graph.fixturePolygons.size} polygons loaded`);

      // Store walking paths for visualization
      graph.walkingPaths = walkingPaths;

      return graph;

    } catch (error) {
      throw new DataLoadingError(
        `Failed to build graph: ${error.message}`,
        'GRAPH_BUILDING_ERROR',
        error
      );
    }
  }

  /**
   * Process point features (waypoints and fixture points)
   * @private
   */
  _processPoints(geojsonData, graph) {
    for (const feature of geojsonData.features) {
      if (feature.geometry.type !== 'Point') continue;

      const properties = feature.properties || {};
      const wayfindingType = properties.wayfinding_type;
      const altName = properties.alt_name;

      if (wayfindingType === 'walking_grid_point' && altName) {
        // Waypoint node
        graph.addNode(
          altName,
          NODE_TYPES.WAYPOINT,
          feature.geometry.coordinates
        );
      } else if (altName) {
        // Other point features (fixtures)
        const nodeType = determineNodeType(altName);
        graph.addNode(
          altName,
          nodeType,
          feature.geometry.coordinates
        );
      }
    }
  }

  /**
   * Process line features (edges and walking paths)
   * @private
   */
  _processLines(geojsonData, graph, walkingPaths) {
    for (const feature of geojsonData.features) {
      if (feature.geometry.type !== 'LineString') continue;

      const properties = feature.properties || {};
      const wayfindingType = properties.wayfinding_type;
      const source = properties.source;
      const target = properties.target;

      if ((wayfindingType === 'walking_path' || wayfindingType === 'connection_line') && source && target) {
        // Ensure nodes exist
        if (!graph.hasNode(source)) {
          const sourceType = determineNodeType(source);
          graph.addNode(source, sourceType);
        }
        if (!graph.hasNode(target)) {
          const targetType = determineNodeType(target);
          graph.addNode(target, targetType);
        }

        // Add edge
        graph.addEdge(source, target, true);

        // Store walking path for visualization
        if (wayfindingType === 'walking_path' && feature.geometry.coordinates) {
          walkingPaths.push({
            path: feature.geometry.coordinates,
            source: source,
            target: target,
            type: 'walking_path',
          });
        }
      }
    }
  }

  /**
   * Process polygon features
   * @private
   */
  _processPolygons(geojsonData, graph) {
    for (const feature of geojsonData.features) {
      if (feature.geometry.type !== 'Polygon') continue;

      const properties = feature.properties || {};
      const altName = properties.alt_name;

      if (altName && graph.hasNode(altName)) {
        // Store polygon data for fixtures
        graph.fixturePolygons.set(altName, feature.geometry.coordinates[0]);

        // Use display_point for polygon features if no coordinates yet
        if (!graph.getNodeCoordinates(altName)) {
          const displayPoint = properties.display_point;
          if (displayPoint && displayPoint.coordinates) {
            graph.nodeCoordinates.set(altName, displayPoint.coordinates);
          }
        }
      } else if (altName) {
        // Add new polygon node
        const nodeType = determineNodeType(altName);
        const displayPoint = properties.display_point;
        const coordinates = displayPoint && displayPoint.coordinates 
          ? displayPoint.coordinates 
          : null;

        graph.addNode(altName, nodeType, coordinates);
        graph.fixturePolygons.set(altName, feature.geometry.coordinates[0]);
      }
    }
  }

  /**
   * Process fixture data from separate files
   * @private
   */
  _processFixtureData(fixtureGeoJSON, graph) {
    let polygonCount = 0;
    let pointCount = 0;
    let skippedCount = 0;
    
    for (const feature of fixtureGeoJSON.features) {
      const properties = feature.properties || {};
      const altName = properties.alt_name;

      if (!altName) {
        skippedCount++;
        continue;
      }

      if (feature.geometry.type === 'Polygon') {
        // Store polygon data
        graph.fixturePolygons.set(altName, feature.geometry.coordinates[0]);
        polygonCount++;

        // Add node if it doesn't exist
        if (!graph.hasNode(altName)) {
          const nodeType = determineNodeType(altName);
          const displayPoint = properties.display_point;
          const coordinates = displayPoint && displayPoint.coordinates 
            ? displayPoint.coordinates 
            : null;

          graph.addNode(altName, nodeType, coordinates);
        }
      } else if (feature.geometry.type === 'Point') {
        pointCount++;
        // Add or update point coordinates
        if (graph.hasNode(altName)) {
          graph.nodeCoordinates.set(altName, feature.geometry.coordinates);
        } else {
          const nodeType = determineNodeType(altName);
          graph.addNode(altName, nodeType, feature.geometry.coordinates);
        }
      }
    }
    console.log(`🔍 Fixture file processed: ${polygonCount} polygons, ${pointCount} points, ${skippedCount} skipped`);
  }
}

/**
 * High-level data manager that combines loading and graph building
 */
export class WayfindingDataManager {
  constructor(options = {}) {
    this.loader = new GeoJSONLoader(options.loader);
    this.builder = new GraphBuilder(options.builder);
  }

  /**
   * Load wayfinding data and build graph
   * @param {string} wayfindingUrl - URL to the main wayfinding GeoJSON file
   * @param {Array<string>} fixtureUrls - URLs to fixture GeoJSON files
   * @returns {Promise<WayfindingGraph>} Constructed graph
   */
  async loadAndBuildGraph(wayfindingUrl, fixtureUrls = []) {
    try {
      // Load main wayfinding data
      const wayfindingData = await this.loader.loadGeoJSON(wayfindingUrl);

      // Load fixture data in parallel
      let fixtureData = [];
      if (fixtureUrls.length > 0) {
        fixtureData = await this.loader.loadMultipleGeoJSON(fixtureUrls);
      }

      // Build graph
      const graph = this.builder.buildGraph(wayfindingData, fixtureData);

      return graph;

    } catch (error) {
      throw new DataLoadingError(
        `Failed to load and build wayfinding data: ${error.message}`,
        'LOAD_AND_BUILD_ERROR',
        error
      );
    }
  }

  /**
   * Get default fixture file URLs
   * @param {string} baseUrl - Base URL for the geojson directory
   * @returns {Array<string>} Array of fixture file URLs
   */
  static getDefaultFixtureUrls(baseUrl = './geojson') {
    const baseUrlClean = baseUrl.replace(/\/$/, '');
    return [
      `${baseUrlClean}/cabinet_fixtures.geojson`,
      `${baseUrlClean}/di_box_fixtures.geojson`,
      `${baseUrlClean}/fossil_excavation_fixtures.geojson`,
    ];
  }
}
