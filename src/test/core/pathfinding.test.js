/**
 * Tests for the pathfinding core module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  WayfindingGraph, 
  Pathfinder, 
  NODE_TYPES, 
  PathfindingError, 
  determineNodeType 
} from '../../core/pathfinding.js';

describe('WayfindingGraph', () => {
  let graph;

  beforeEach(() => {
    graph = new WayfindingGraph();
  });

  describe('constructor', () => {
    it('should initialize empty graph', () => {
      expect(graph.nodes.size).toBe(0);
      expect(graph.adjacencyList.size).toBe(0);
      expect(graph.nodeTypes.size).toBe(0);
      expect(graph.nodeCoordinates.size).toBe(0);
      expect(graph.walkingPaths).toEqual([]);
      expect(graph.fixturePolygons.size).toBe(0);
    });
  });

  describe('addNode', () => {
    it('should add a node with valid parameters', () => {
      graph.addNode('test_node', NODE_TYPES.WAYPOINT, [-123.25, 49.26]);
      
      expect(graph.nodes.has('test_node')).toBe(true);
      expect(graph.nodeTypes.get('test_node')).toBe(NODE_TYPES.WAYPOINT);
      expect(graph.nodeCoordinates.get('test_node')).toEqual([-123.25, 49.26]);
      expect(graph.adjacencyList.has('test_node')).toBe(true);
    });

    it('should add a node without coordinates', () => {
      graph.addNode('test_node', NODE_TYPES.DI_BOX);
      
      expect(graph.nodes.has('test_node')).toBe(true);
      expect(graph.nodeTypes.get('test_node')).toBe(NODE_TYPES.DI_BOX);
      expect(graph.nodeCoordinates.get('test_node')).toBeUndefined();
    });

    it('should throw error for invalid node ID', () => {
      expect(() => graph.addNode('')).toThrow(PathfindingError);
      expect(() => graph.addNode(null)).toThrow(PathfindingError);
      expect(() => graph.addNode(123)).toThrow(PathfindingError);
    });

    it('should throw error for invalid coordinates', () => {
      expect(() => graph.addNode('test', NODE_TYPES.WAYPOINT, [123])).toThrow(PathfindingError);
      expect(() => graph.addNode('test', NODE_TYPES.WAYPOINT, 'invalid')).toThrow(PathfindingError);
    });

    it('should use default type if not specified', () => {
      graph.addNode('test_node');
      expect(graph.nodeTypes.get('test_node')).toBe(NODE_TYPES.UNKNOWN);
    });
  });

  describe('addEdge', () => {
    beforeEach(() => {
      graph.addNode('node1');
      graph.addNode('node2');
    });

    it('should add bidirectional edge by default', () => {
      graph.addEdge('node1', 'node2');
      
      expect(graph.adjacencyList.get('node1').has('node2')).toBe(true);
      expect(graph.adjacencyList.get('node2').has('node1')).toBe(true);
    });

    it('should add unidirectional edge when specified', () => {
      graph.addEdge('node1', 'node2', false);
      
      expect(graph.adjacencyList.get('node1').has('node2')).toBe(true);
      expect(graph.adjacencyList.get('node2').has('node1')).toBe(false);
    });

    it('should throw error for non-existent nodes', () => {
      expect(() => graph.addEdge('nonexistent', 'node1')).toThrow(PathfindingError);
      expect(() => graph.addEdge('node1', 'nonexistent')).toThrow(PathfindingError);
    });
  });

  describe('getNeighbors', () => {
    beforeEach(() => {
      graph.addNode('node1');
      graph.addNode('node2');
      graph.addNode('node3');
      graph.addEdge('node1', 'node2');
      graph.addEdge('node1', 'node3');
    });

    it('should return array of neighbors', () => {
      const neighbors = graph.getNeighbors('node1');
      expect(neighbors).toHaveLength(2);
      expect(neighbors).toContain('node2');
      expect(neighbors).toContain('node3');
    });

    it('should return empty array for node with no neighbors', () => {
      graph.addNode('isolated');
      expect(graph.getNeighbors('isolated')).toEqual([]);
    });

    it('should return empty array for non-existent node', () => {
      expect(graph.getNeighbors('nonexistent')).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('should return correct statistics for empty graph', () => {
      const stats = graph.getStatistics();
      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.nodeTypes).toEqual({});
    });

    it('should return correct statistics for populated graph', () => {
      graph.addNode('wp1', NODE_TYPES.WAYPOINT);
      graph.addNode('wp2', NODE_TYPES.WAYPOINT);
      graph.addNode('di1', NODE_TYPES.DI_BOX);
      graph.addEdge('wp1', 'wp2');
      graph.addEdge('wp1', 'di1');

      const stats = graph.getStatistics();
      expect(stats.totalNodes).toBe(3);
      expect(stats.totalEdges).toBe(2);
      expect(stats.nodeTypes).toEqual({
        [NODE_TYPES.WAYPOINT]: 2,
        [NODE_TYPES.DI_BOX]: 1,
      });
    });
  });
});

describe('Pathfinder', () => {
  let graph;
  let pathfinder;

  beforeEach(() => {
    graph = new WayfindingGraph();
    pathfinder = new Pathfinder(graph);
  });

  describe('constructor', () => {
    it('should initialize with valid graph', () => {
      expect(pathfinder.graph).toBe(graph);
    });

    it('should throw error for invalid graph', () => {
      expect(() => new Pathfinder({})).toThrow(PathfindingError);
      expect(() => new Pathfinder(null)).toThrow(PathfindingError);
    });
  });

  describe('findPath', () => {
    beforeEach(() => {
      // Create a simple test graph:
      // fixture1 -> wp1 -> wp2 -> fixture2
      graph.addNode('fixture1', NODE_TYPES.DI_BOX);
      graph.addNode('wp1', NODE_TYPES.WAYPOINT);
      graph.addNode('wp2', NODE_TYPES.WAYPOINT);
      graph.addNode('fixture2', NODE_TYPES.CABINET);
      
      graph.addEdge('fixture1', 'wp1');
      graph.addEdge('wp1', 'wp2');
      graph.addEdge('wp2', 'fixture2');
    });

    it('should find path between fixtures through waypoints', () => {
      const path = pathfinder.findPath('fixture1', 'fixture2');
      expect(path).toEqual(['fixture1', 'wp1', 'wp2', 'fixture2']);
    });

    it('should return single node path for same source and target', () => {
      const path = pathfinder.findPath('fixture1', 'fixture1');
      expect(path).toEqual(['fixture1']);
    });

    it('should return null when no path exists', () => {
      graph.addNode('isolated', NODE_TYPES.FOSSIL);
      const path = pathfinder.findPath('fixture1', 'isolated');
      expect(path).toBeNull();
    });

    it('should throw error for non-existent nodes', () => {
      expect(() => pathfinder.findPath('nonexistent', 'fixture1')).toThrow(PathfindingError);
      expect(() => pathfinder.findPath('fixture1', 'nonexistent')).toThrow(PathfindingError);
    });

    it('should respect maxDepth option', () => {
      // Create a long chain that exceeds maxDepth
      for (let i = 0; i < 10; i++) {
        graph.addNode(`wp${i + 10}`, NODE_TYPES.WAYPOINT);
        if (i > 0) {
          graph.addEdge(`wp${i + 9}`, `wp${i + 10}`);
        }
      }
      graph.addEdge('wp2', 'wp10');
      graph.addNode('distant', NODE_TYPES.FOSSIL);
      graph.addEdge('wp19', 'distant');

      const path = pathfinder.findPath('fixture1', 'distant', { maxDepth: 5 });
      expect(path).toBeNull();
    });

    it('should allow direct fixture connections when enabled', () => {
      graph.addNode('fixture3', NODE_TYPES.FOSSIL);
      graph.addEdge('fixture1', 'fixture3');

      // Should not find direct path by default
      let path = pathfinder.findPath('fixture1', 'fixture3');
      expect(path).toBeNull();

      // Should find direct path when enabled
      path = pathfinder.findPath('fixture1', 'fixture3', { allowDirectFixtureConnections: true });
      expect(path).toEqual(['fixture1', 'fixture3']);
    });
  });

  describe('getPathDetails', () => {
    beforeEach(() => {
      graph.addNode('start', NODE_TYPES.DI_BOX, [-123.1, 49.1]);
      graph.addNode('wp1', NODE_TYPES.WAYPOINT, [-123.2, 49.2]);
      graph.addNode('end', NODE_TYPES.CABINET, [-123.3, 49.3]);
    });

    it('should return detailed path information', () => {
      const path = ['start', 'wp1', 'end'];
      const details = pathfinder.getPathDetails(path);

      expect(details).toMatchObject({
        path,
        length: 3,
        summary: {
          start: { id: 'start', type: NODE_TYPES.DI_BOX },
          end: { id: 'end', type: NODE_TYPES.CABINET },
          waypointsUsed: 1,
        },
      });

      expect(details.nodes).toHaveLength(3);
      expect(details.nodes[0]).toMatchObject({
        id: 'start',
        type: NODE_TYPES.DI_BOX,
        coordinates: [-123.1, 49.1],
      });
    });

    it('should return null for invalid path', () => {
      expect(pathfinder.getPathDetails(null)).toBeNull();
      expect(pathfinder.getPathDetails([])).toBeNull();
      expect(pathfinder.getPathDetails('invalid')).toBeNull();
    });
  });

  describe('findMultiplePaths', () => {
    beforeEach(() => {
      // Create graph with multiple possible paths
      graph.addNode('start', NODE_TYPES.DI_BOX);
      graph.addNode('end', NODE_TYPES.CABINET);
      graph.addNode('wp1', NODE_TYPES.WAYPOINT);
      graph.addNode('wp2', NODE_TYPES.WAYPOINT);
      graph.addNode('wp3', NODE_TYPES.WAYPOINT);

      // Path 1: start -> wp1 -> end
      graph.addEdge('start', 'wp1');
      graph.addEdge('wp1', 'end');

      // Path 2: start -> wp2 -> end
      graph.addEdge('start', 'wp2');
      graph.addEdge('wp2', 'end');

      // Path 3: start -> wp3 -> end
      graph.addEdge('start', 'wp3');
      graph.addEdge('wp3', 'end');
    });

    it('should find multiple paths', () => {
      const paths = pathfinder.findMultiplePaths('start', 'end', 3);
      expect(paths).toHaveLength(3);
      
      // Each path should be different
      const pathStrings = paths.map(p => p.join('->'));
      expect(new Set(pathStrings).size).toBe(3);
    });

    it('should limit number of paths returned', () => {
      const paths = pathfinder.findMultiplePaths('start', 'end', 2);
      expect(paths.length).toBeLessThanOrEqual(2);
    });
  });
});

describe('determineNodeType', () => {
  it('should determine waypoint type', () => {
    expect(determineNodeType('wp_001')).toBe(NODE_TYPES.WAYPOINT);
    expect(determineNodeType('WP_025')).toBe(NODE_TYPES.WAYPOINT);
  });

  it('should determine DI box type', () => {
    expect(determineNodeType('di_27_18_top')).toBe(NODE_TYPES.DI_BOX);
    expect(determineNodeType('DI_05_01_bottom')).toBe(NODE_TYPES.DI_BOX);
  });

  it('should determine cabinet type', () => {
    expect(determineNodeType('col_1_cab_01')).toBe(NODE_TYPES.CABINET);
    expect(determineNodeType('COL_2_CAB_15')).toBe(NODE_TYPES.CABINET);
  });

  it('should determine fossil type', () => {
    expect(determineNodeType('fossil_excavation_1')).toBe(NODE_TYPES.FOSSIL);
    expect(determineNodeType('FOSSIL_SITE_2')).toBe(NODE_TYPES.FOSSIL);
  });

  it('should return unknown for unrecognized patterns', () => {
    expect(determineNodeType('random_node')).toBe(NODE_TYPES.UNKNOWN);
    expect(determineNodeType('')).toBe(NODE_TYPES.UNKNOWN);
    expect(determineNodeType(null)).toBe(NODE_TYPES.UNKNOWN);
    expect(determineNodeType(undefined)).toBe(NODE_TYPES.UNKNOWN);
  });
});
