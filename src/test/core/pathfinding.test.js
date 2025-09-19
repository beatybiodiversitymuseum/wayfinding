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

    it('should route fixture-to-fixture through waypoints only', () => {
      // Add fixture connected to waypoint network
      graph.addNode('fixture3', NODE_TYPES.FOSSIL);
      graph.addEdge('fixture3', 'wp1'); // Connect fixture to waypoint network
      graph.addEdge('fixture1', 'fixture3'); // Direct connection exists but should be ignored

      // Should find path through waypoints, ignoring direct fixture connection
      let path = pathfinder.findPath('fixture1', 'fixture3');
      expect(path).toEqual(['fixture1', 'wp1', 'fixture3']); // Routes through waypoint

      // Should still route through waypoints even when flag is enabled
      path = pathfinder.findPath('fixture1', 'fixture3', { allowDirectFixtureConnections: true });
      expect(path).toEqual(['fixture1', 'wp1', 'fixture3']); // Still routes through waypoint
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
    describe('point-to-point (waypoint-to-waypoint) multiple paths', () => {
      beforeEach(() => {
        // Create graph with multiple possible paths between two waypoints
        // Multiple paths are only supported for point-to-point connections
        graph.addNode('wp_001', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_010', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_002', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_003', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_004', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_005', NODE_TYPES.WAYPOINT);

        // Create multiple alternative routes between wp_001 and wp_010
        // Route 1: wp_001 -> wp_002 -> wp_010
        graph.addEdge('wp_001', 'wp_002');
        graph.addEdge('wp_002', 'wp_010');

        // Route 2: wp_001 -> wp_003 -> wp_010  
        graph.addEdge('wp_001', 'wp_003');
        graph.addEdge('wp_003', 'wp_010');

        // Route 3: wp_001 -> wp_004 -> wp_005 -> wp_010
        graph.addEdge('wp_001', 'wp_004');
        graph.addEdge('wp_004', 'wp_005');
        graph.addEdge('wp_005', 'wp_010');
      });

      it('should find multiple alternative paths between two waypoints', () => {
        const paths = pathfinder.findMultiplePaths('wp_001', 'wp_010', 3);
        
        // Should find all 3 alternative routes
        expect(paths).toHaveLength(3);
        
        // Each path should be different
        const pathStrings = paths.map(p => p.join('->'));
        expect(new Set(pathStrings).size).toBe(3);
        
        // Verify the expected paths
        expect(pathStrings).toContain('wp_001->wp_002->wp_010');
        expect(pathStrings).toContain('wp_001->wp_003->wp_010');
        expect(pathStrings).toContain('wp_001->wp_004->wp_005->wp_010');
      });

      it('should limit number of paths returned when requested', () => {
        const paths = pathfinder.findMultiplePaths('wp_001', 'wp_010', 2);
        expect(paths.length).toBeLessThanOrEqual(2);
        
        // Should still return valid paths
        paths.forEach(path => {
          expect(path[0]).toBe('wp_001');
          expect(path[path.length - 1]).toBe('wp_010');
        });
      });

      it('should return single path when no intermediate nodes to exclude', () => {
        // Create a direct connection with no intermediate nodes to exclude
        const directGraph = new WayfindingGraph();
        directGraph.addNode('wp_direct_1', NODE_TYPES.WAYPOINT);
        directGraph.addNode('wp_direct_2', NODE_TYPES.WAYPOINT);
        directGraph.addEdge('wp_direct_1', 'wp_direct_2');
        
        const directPathfinder = new Pathfinder(directGraph);
        const paths = directPathfinder.findMultiplePaths('wp_direct_1', 'wp_direct_2', 3);
        
        // Should find the same path multiple times since no intermediate nodes to exclude
        expect(paths.length).toBeGreaterThan(0);
        // All paths should be the same direct connection
        paths.forEach(path => {
          expect(path).toEqual(['wp_direct_1', 'wp_direct_2']);
        });
      });
    });

    describe('fixture-to-fixture paths behavior', () => {
      beforeEach(() => {
        // Add waypoints
        graph.addNode('wp_001', NODE_TYPES.WAYPOINT);
        graph.addNode('wp_002', NODE_TYPES.WAYPOINT);
        
        // Add fixtures
        graph.addNode('di_box_1', NODE_TYPES.DI_BOX);
        graph.addNode('cabinet_1', NODE_TYPES.CABINET);
        
        // Connect fixtures to waypoints
        graph.addEdge('di_box_1', 'wp_001');
        graph.addEdge('wp_002', 'cabinet_1');
        graph.addEdge('wp_001', 'wp_002');
      });

      it('should find path through waypoints for fixture-to-fixture connections', () => {
        const paths = pathfinder.findMultiplePaths('di_box_1', 'cabinet_1', 3);
        
        // Should find at least one path through waypoints
        expect(paths.length).toBeGreaterThan(0);
        
        // Verify the first path goes through waypoints
        expect(paths[0]).toEqual(['di_box_1', 'wp_001', 'wp_002', 'cabinet_1']);
      });

      it('should route fixture-to-fixture through waypoints (ignoring direct connections)', () => {
        // Add fixture connected to waypoint network AND direct connection
        graph.addNode('fossil_1', NODE_TYPES.FOSSIL);
        graph.addEdge('wp_002', 'fossil_1'); // Connect to waypoint network
        graph.addEdge('di_box_1', 'fossil_1'); // Direct connection exists but should be ignored
        
        const paths = pathfinder.findMultiplePaths('di_box_1', 'fossil_1', 5);
        
        // Should find path through waypoints, ignoring direct fixture connection
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0]).toEqual(['di_box_1', 'wp_001', 'wp_002', 'fossil_1']);
      });

      it('should enforce waypoint routing even with allowDirectFixtureConnections flag', () => {
        // Add fixture connected to waypoint network AND direct connection
        graph.addNode('fossil_1', NODE_TYPES.FOSSIL);
        graph.addEdge('wp_002', 'fossil_1'); // Connect to waypoint network
        graph.addEdge('di_box_1', 'fossil_1'); // Direct connection
        
        const paths = pathfinder.findMultiplePaths('di_box_1', 'fossil_1', 3, { allowDirectFixtureConnections: true });
        
        // Should STILL route through waypoints (flag is ignored for fixtures)
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0]).toEqual(['di_box_1', 'wp_001', 'wp_002', 'fossil_1']);
      });

      it('should find fixture paths when connected through waypoints', () => {
        // Connect fossil to the waypoint network
        graph.addNode('fossil_1', NODE_TYPES.FOSSIL);
        graph.addEdge('wp_002', 'fossil_1'); // Connect to waypoint network
        
        const paths = pathfinder.findMultiplePaths('di_box_1', 'fossil_1', 3);
        
        // Should find path through waypoint network
        expect(paths.length).toBeGreaterThan(0);
        expect(paths[0]).toEqual(['di_box_1', 'wp_001', 'wp_002', 'fossil_1']);
      });
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
