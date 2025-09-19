/**
 * Pathfinding Core Module
 * 
 * Provides core pathfinding algorithms for indoor navigation with enforced routing rules.
 * 
 * ROUTING RULES:
 * 1. Fixtures (DI boxes, cabinets, fossils) MUST route through waypoints
 * 2. Direct waypoint-to-waypoint travel is allowed
 * 3. Direct fixture-to-fixture connections are IGNORED (even if they exist in graph)
 * 4. All fixture routing uses intermediary waypoints for navigation
 * 
 * BEHAVIOR:
 * - pathfinder.findPath('fixture1', 'fixture2') → finds path through waypoints
 * - Direct fixture edges in graph are ignored by routing constraints
 * - Only returns null if no waypoint path exists between fixtures
 * 
 * This design ensures proper indoor navigation flow where:
 * - Waypoints form the navigation grid/network
 * - Fixtures are endpoints that connect to the grid
 * - All navigation follows established pathways through the grid
 */

/**
 * Node types supported by the pathfinding system
 */
export const NODE_TYPES = {
  WAYPOINT: 'waypoint',
  DI_BOX: 'di_box',
  CABINET: 'cabinet',
  FOSSIL: 'fossil',
  UNKNOWN: 'unknown',
};

/**
 * Pathfinding error types
 */
export class PathfindingError extends Error {
  constructor(message, code = 'PATHFINDING_ERROR') {
    super(message);
    this.name = 'PathfindingError';
    this.code = code;
  }
}

/**
 * Graph class for managing the wayfinding network
 */
export class WayfindingGraph {
  constructor() {
    this.nodes = new Set();
    this.adjacencyList = new Map();
    this.nodeTypes = new Map();
    this.nodeCoordinates = new Map();
    this.walkingPaths = [];
    this.fixturePolygons = new Map();
  }

  /**
   * Add a node to the graph
   * @param {string} nodeId - The node identifier
   * @param {string} type - The node type (from NODE_TYPES)
   * @param {Array<number>} coordinates - [longitude, latitude]
   */
  addNode(nodeId, type = NODE_TYPES.UNKNOWN, coordinates = null) {
    if (typeof nodeId !== 'string' || nodeId.trim() === '') {
      throw new PathfindingError('Node ID must be a non-empty string', 'INVALID_NODE_ID');
    }

    this.nodes.add(nodeId);
    this.nodeTypes.set(nodeId, type);
    
    if (coordinates) {
      if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new PathfindingError('Coordinates must be an array of [longitude, latitude]', 'INVALID_COORDINATES');
      }
      this.nodeCoordinates.set(nodeId, coordinates);
    }

    if (!this.adjacencyList.has(nodeId)) {
      this.adjacencyList.set(nodeId, new Set());
    }
  }

  /**
   * Add an edge between two nodes
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {boolean} bidirectional - Whether the edge is bidirectional (default: true)
   */
  addEdge(sourceId, targetId, bidirectional = true) {
    if (!this.nodes.has(sourceId)) {
      throw new PathfindingError(`Source node '${sourceId}' not found in graph`, 'NODE_NOT_FOUND');
    }
    if (!this.nodes.has(targetId)) {
      throw new PathfindingError(`Target node '${targetId}' not found in graph`, 'NODE_NOT_FOUND');
    }

    this.adjacencyList.get(sourceId).add(targetId);
    
    if (bidirectional) {
      this.adjacencyList.get(targetId).add(sourceId);
    }
  }

  /**
   * Get node type
   * @param {string} nodeId - Node identifier
   * @returns {string} Node type
   */
  getNodeType(nodeId) {
    return this.nodeTypes.get(nodeId) || NODE_TYPES.UNKNOWN;
  }

  /**
   * Get node coordinates
   * @param {string} nodeId - Node identifier
   * @returns {Array<number>|null} Coordinates [longitude, latitude] or null
   */
  getNodeCoordinates(nodeId) {
    return this.nodeCoordinates.get(nodeId) || null;
  }

  /**
   * Get neighbors of a node
   * @param {string} nodeId - Node identifier
   * @returns {Array<string>} Array of neighbor node IDs
   */
  getNeighbors(nodeId) {
    const neighbors = this.adjacencyList.get(nodeId);
    return neighbors ? Array.from(neighbors) : [];
  }

  /**
   * Check if a node exists in the graph
   * @param {string} nodeId - Node identifier
   * @returns {boolean} True if node exists
   */
  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph statistics
   */
  getStatistics() {
    const typeCount = {};
    for (const type of this.nodeTypes.values()) {
      typeCount[type] = (typeCount[type] || 0) + 1;
    }

    return {
      totalNodes: this.nodes.size,
      nodeTypes: typeCount,
      totalEdges: Array.from(this.adjacencyList.values())
        .reduce((sum, neighbors) => sum + neighbors.size, 0) / 2, // Divide by 2 for bidirectional edges
      walkingPaths: this.walkingPaths.length,
      fixturePolygons: this.fixturePolygons.size,
    };
  }
}

/**
 * Pathfinder class for finding routes between nodes
 */
export class Pathfinder {
  constructor(graph) {
    if (!(graph instanceof WayfindingGraph)) {
      throw new PathfindingError('Graph must be an instance of WayfindingGraph', 'INVALID_GRAPH');
    }
    this.graph = graph;
  }

  /**
   * Find path between two nodes using BFS with enforced routing constraints
   * 
   * ROUTING BEHAVIOR:
   * - Fixture-to-Fixture: MUST go through waypoints (never direct)
   * - Waypoint-to-Waypoint: Direct connections allowed
   * - Fixture-to-Waypoint: Direct connections allowed
   * - Waypoint-to-Fixture: Direct connections allowed
   * 
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {Object} options - Pathfinding options
   * @param {boolean} options.allowDirectFixtureConnections - Ignored for fixtures (always false)
   * @param {number} options.maxDepth - Maximum search depth (default: 1000)
   * @param {Set} options.excludeNodes - Nodes to exclude from path (for multiple path finding)
   * @returns {Array<string>|null} Path as array of node IDs, or null if no path exists
   */
  findPath(sourceId, targetId, options = {}) {
    const {
      allowDirectFixtureConnections = false,
      maxDepth = 1000,
      excludeNodes = new Set(),
    } = options;

    // Validate inputs
    if (!this.graph.hasNode(sourceId)) {
      throw new PathfindingError(`Source node '${sourceId}' not found in graph`, 'NODE_NOT_FOUND');
    }
    if (!this.graph.hasNode(targetId)) {
      throw new PathfindingError(`Target node '${targetId}' not found in graph`, 'NODE_NOT_FOUND');
    }

    if (sourceId === targetId) {
      return [sourceId];
    }

    const sourceType = this.graph.getNodeType(sourceId);
    const targetType = this.graph.getNodeType(targetId);

    // BFS with path tracking
    const queue = [[sourceId]];
    const visited = new Set([sourceId]);
    let iterations = 0;

    while (queue.length > 0 && iterations < maxDepth) {
      iterations++;
      const currentPath = queue.shift();
      const currentNode = currentPath[currentPath.length - 1];
      const currentNodeType = this.graph.getNodeType(currentNode);

      // Explore neighbors
      for (const neighbor of this.graph.getNeighbors(currentNode)) {
        if (visited.has(neighbor) || excludeNodes.has(neighbor)) continue;

        const neighborType = this.graph.getNodeType(neighbor);
        
        // Apply routing constraints FIRST (before checking target)
        if (!this._canVisitNeighbor(currentNodeType, neighborType, allowDirectFixtureConnections)) {
          continue; // Skip this neighbor if routing constraints forbid it
        }

        const newPath = [...currentPath, neighbor];

        // Check if we found the target (after routing constraints are satisfied)
        if (neighbor === targetId) {
          return newPath;
        }

        visited.add(neighbor);
        queue.push(newPath);
      }
    }

    return null; // No path found
  }

  /**
   * Get detailed path information
   * @param {Array<string>} path - Array of node IDs
   * @returns {Object|null} Detailed path information
   */
  getPathDetails(path) {
    if (!path || !Array.isArray(path) || path.length === 0) {
      return null;
    }

    const nodes = path.map(nodeId => ({
      id: nodeId,
      type: this.graph.getNodeType(nodeId),
      coordinates: this.graph.getNodeCoordinates(nodeId),
    }));

    const waypointsUsed = path.filter(nodeId => 
      this.graph.getNodeType(nodeId) === NODE_TYPES.WAYPOINT
    ).length;

    return {
      path,
      length: path.length,
      nodes,
      summary: {
        start: {
          id: path[0],
          type: this.graph.getNodeType(path[0]),
        },
        end: {
          id: path[path.length - 1],
          type: this.graph.getNodeType(path[path.length - 1]),
        },
        waypointsUsed,
      },
    };
  }

  /**
   * Find multiple alternative paths between source and target
   * 
   * NOTE: Multiple paths work best for waypoint-to-waypoint connections where
   * alternative routes exist. Fixture-to-fixture paths are limited since they
   * must route through waypoints, reducing alternative path options.
   * 
   * @param {string} sourceId - Source node ID
   * @param {string} targetId - Target node ID
   * @param {number} maxPaths - Maximum number of paths to find (default: 3)
   * @param {Object} options - Pathfinding options (passed to findPath)
   * @returns {Array<Array<string>>} Array of paths, may be fewer than maxPaths
   */
  findMultiplePaths(sourceId, targetId, maxPaths = 3, options = {}) {
    const paths = [];
    const visited = new Set();

    for (let i = 0; i < maxPaths; i++) {
      const path = this.findPath(sourceId, targetId, {
        ...options,
        excludeNodes: visited,
      });

      if (!path) break;

      paths.push(path);
      
      // Mark intermediate nodes as visited to find alternative paths
      for (let j = 1; j < path.length - 1; j++) {
        visited.add(path[j]);
      }
    }

    return paths;
  }

  /**
   * Check if we can visit a neighbor based on enforced routing constraints
   * 
   * INDOOR NAVIGATION ROUTING RULES:
   * ✅ Waypoint → Waypoint: Direct travel allowed (navigation grid connections)
   * ✅ Fixture → Waypoint: Direct connection allowed (fixture access points)
   * ✅ Waypoint → Fixture: Direct connection allowed (fixture access points)  
   * ❌ Fixture → Fixture: NEVER direct (must route through waypoint intermediaries)
   * 
   * This enforces proper indoor navigation where all fixture-to-fixture routing
   * must go through the established waypoint network, ensuring travelers follow
   * designated pathways rather than cutting directly between fixtures.
   * 
   * @private
   * @param {string} currentType - Type of current node
   * @param {string} neighborType - Type of neighbor node
   * @param {boolean} allowDirectFixtureConnections - Ignored for fixtures (always false)
   * @returns {boolean} True if the connection is allowed
   */
  _canVisitNeighbor(currentType, neighborType, allowDirectFixtureConnections) {
    // ✅ Allow waypoint-to-waypoint connections (navigation grid)
    if (currentType === NODE_TYPES.WAYPOINT && neighborType === NODE_TYPES.WAYPOINT) {
      return true;
    }

    // ✅ Allow fixture-to-waypoint connections (fixture access to grid)
    if (this._isFixtureType(currentType) && neighborType === NODE_TYPES.WAYPOINT) {
      return true;
    }

    // ✅ Allow waypoint-to-fixture connections (grid access to fixture)
    if (currentType === NODE_TYPES.WAYPOINT && this._isFixtureType(neighborType)) {
      return true;
    }

    // ❌ NEVER allow direct fixture-to-fixture connections
    // This is the core rule: fixtures must route through waypoints
    if (this._isFixtureType(currentType) && this._isFixtureType(neighborType)) {
      return false; // Force routing through waypoint intermediaries
    }

    // Handle unknown node types with the allowDirectFixtureConnections flag
    if (currentType === NODE_TYPES.UNKNOWN || neighborType === NODE_TYPES.UNKNOWN) {
      return allowDirectFixtureConnections;
    }

    return false;
  }

  /**
   * Check if a node type is a fixture type (non-waypoint)
   * @private
   */
  _isFixtureType(nodeType) {
    return nodeType === NODE_TYPES.DI_BOX || 
           nodeType === NODE_TYPES.CABINET || 
           nodeType === NODE_TYPES.FOSSIL;
  }
}

/**
 * Utility function to determine node type from node ID
 * @param {string} nodeId - Node identifier
 * @returns {string} Node type
 */
export function determineNodeType(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') {
    return NODE_TYPES.UNKNOWN;
  }

  const id = nodeId.toLowerCase();
  
  if (id.startsWith('wp_')) {
    return NODE_TYPES.WAYPOINT;
  } else if (id.startsWith('di_')) {
    return NODE_TYPES.DI_BOX;
  } else if (id.startsWith('col_') && id.includes('cab_')) {
    return NODE_TYPES.CABINET;
  } else if (id.startsWith('fossil_')) {
    return NODE_TYPES.FOSSIL;
  }
  
  return NODE_TYPES.UNKNOWN;
}
