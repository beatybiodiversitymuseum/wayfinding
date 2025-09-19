/**
 * Integration tests for the complete pathfinding flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WayfindingDataManager } from '../../data/loader.js';
import { Pathfinder } from '../../core/pathfinding.js';

// Mock GeoJSON data for integration testing
const mockIntegrationData = {
  wayfinding: {
    type: 'FeatureCollection',
    features: [
      // Waypoints
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-123.1, 49.1] },
        properties: { wayfinding_type: 'walking_grid_point', alt_name: 'wp_001' }
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-123.2, 49.2] },
        properties: { wayfinding_type: 'walking_grid_point', alt_name: 'wp_002' }
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-123.3, 49.3] },
        properties: { wayfinding_type: 'walking_grid_point', alt_name: 'wp_003' }
      },
      // Walking paths
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-123.1, 49.1], [-123.2, 49.2]] },
        properties: { wayfinding_type: 'walking_path', source: 'wp_001', target: 'wp_002' }
      },
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-123.2, 49.2], [-123.3, 49.3]] },
        properties: { wayfinding_type: 'walking_path', source: 'wp_002', target: 'wp_003' }
      },
      // Connection lines to fixtures
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-123.05, 49.05], [-123.1, 49.1]] },
        properties: { wayfinding_type: 'connection_line', source: 'di_27_18_top', target: 'wp_001' }
      },
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-123.3, 49.3], [-123.35, 49.35]] },
        properties: { wayfinding_type: 'connection_line', source: 'wp_003', target: 'fossil_excavation_1' }
      },
      // Fixture polygons
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-123.05, 49.05], [-123.06, 49.05], [-123.06, 49.06], [-123.05, 49.06], [-123.05, 49.05]]]
        },
        properties: {
          alt_name: 'di_27_18_top',
          display_point: { coordinates: [-123.055, 49.055] }
        }
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[[-123.35, 49.35], [-123.36, 49.35], [-123.36, 49.36], [-123.35, 49.36], [-123.35, 49.35]]]
        },
        properties: {
          alt_name: 'fossil_excavation_1',
          display_point: { coordinates: [-123.355, 49.355] }
        }
      }
    ]
  },
  fixtures: [
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[-123.25, 49.25], [-123.26, 49.25], [-123.26, 49.26], [-123.25, 49.26], [-123.25, 49.25]]]
          },
          properties: { alt_name: 'col_1_cab_01' }
        }
      ]
    }
  ]
};

describe('Pathfinding Integration', () => {
  let manager;
  let graph;
  let pathfinder;

  beforeEach(async () => {
    // Mock fetch to return our test data
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegrationData.wayfinding)
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockIntegrationData.fixtures[0])
      });

    // Load and build graph
    manager = new WayfindingDataManager();
    graph = await manager.loadAndBuildGraph(
      'wayfinding.geojson',
      ['fixtures.geojson']
    );
    pathfinder = new Pathfinder(graph);
  });

  describe('Complete pathfinding workflow', () => {
    it('should load data and build a complete graph', () => {
      // Verify graph structure
      expect(graph.nodes.size).toBe(6); // 3 waypoints + 3 fixtures
      expect(graph.getStatistics().nodeTypes).toMatchObject({
        waypoint: 3,
        di_box: 1,
        fossil: 1,
        cabinet: 1,
      });

      // Verify connections exist
      expect(graph.getNeighbors('wp_001')).toContain('wp_002');
      expect(graph.getNeighbors('wp_002')).toContain('wp_003');
      expect(graph.getNeighbors('di_27_18_top')).toContain('wp_001');
      expect(graph.getNeighbors('wp_003')).toContain('fossil_excavation_1');

      // Verify coordinates are loaded
      expect(graph.getNodeCoordinates('wp_001')).toEqual([-123.1, 49.1]);
      expect(graph.getNodeCoordinates('di_27_18_top')).toEqual([-123.055, 49.055]);

      // Verify polygon data
      expect(graph.fixturePolygons.has('di_27_18_top')).toBe(true);
      expect(graph.fixturePolygons.has('col_1_cab_01')).toBe(true);
    });

    it('should find paths between fixtures through waypoints', () => {
      const path = pathfinder.findPath('di_27_18_top', 'fossil_excavation_1');
      
      expect(path).toEqual(['di_27_18_top', 'wp_001', 'wp_002', 'wp_003', 'fossil_excavation_1']);
      
      const pathDetails = pathfinder.getPathDetails(path);
      expect(pathDetails.summary.waypointsUsed).toBe(3);
      expect(pathDetails.nodes).toHaveLength(5);
      expect(pathDetails.nodes[0].coordinates).toEqual([-123.055, 49.055]);
    });

    it('should handle waypoint-to-waypoint paths', () => {
      const path = pathfinder.findPath('wp_001', 'wp_003');
      expect(path).toEqual(['wp_001', 'wp_002', 'wp_003']);
    });

    it('should handle fixture-to-waypoint paths', () => {
      const path = pathfinder.findPath('di_27_18_top', 'wp_002');
      expect(path).toEqual(['di_27_18_top', 'wp_001', 'wp_002']);
    });

    it('should return null for disconnected nodes', () => {
      // col_1_cab_01 is not connected to the main network in our test data
      const path = pathfinder.findPath('di_27_18_top', 'col_1_cab_01');
      expect(path).toBeNull();
    });

    it('should provide detailed path information', () => {
      const path = pathfinder.findPath('di_27_18_top', 'wp_002');
      const details = pathfinder.getPathDetails(path);

      expect(details).toMatchObject({
        path: ['di_27_18_top', 'wp_001', 'wp_002'],
        length: 3,
        summary: {
          start: { id: 'di_27_18_top', type: 'di_box' },
          end: { id: 'wp_002', type: 'waypoint' },
          waypointsUsed: 2,
        },
      });

      // Verify all nodes have coordinates
      details.nodes.forEach(node => {
        expect(node.coordinates).toBeTruthy();
        expect(Array.isArray(node.coordinates)).toBe(true);
        expect(node.coordinates).toHaveLength(2);
      });
    });
  });

  describe('Error handling in integration', () => {
    it('should handle missing source node gracefully', () => {
      expect(() => {
        pathfinder.findPath('nonexistent_node', 'wp_001');
      }).toThrow('Source node \'nonexistent_node\' not found in graph');
    });

    it('should handle missing target node gracefully', () => {
      expect(() => {
        pathfinder.findPath('wp_001', 'nonexistent_node');
      }).toThrow('Target node \'nonexistent_node\' not found in graph');
    });

    it('should handle same source and target', () => {
      const path = pathfinder.findPath('wp_001', 'wp_001');
      expect(path).toEqual(['wp_001']);
    });
  });

  describe('Performance characteristics', () => {
    it('should complete pathfinding in reasonable time', () => {
      const startTime = performance.now();
      
      // Find multiple paths to test performance
      for (let i = 0; i < 10; i++) {
        pathfinder.findPath('di_27_18_top', 'fossil_excavation_1');
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 10 pathfinding operations in less than 100ms
      expect(totalTime).toBeLessThan(100);
    });

    it('should handle large graphs efficiently', () => {
      // Add more nodes to simulate larger graph
      for (let i = 10; i < 100; i++) {
        graph.addNode(`wp_${i.toString().padStart(3, '0')}`, 'waypoint', [-123 + i * 0.001, 49 + i * 0.001]);
        if (i > 10) {
          graph.addEdge(`wp_${(i-1).toString().padStart(3, '0')}`, `wp_${i.toString().padStart(3, '0')}`);
        }
      }
      
      // Connect to existing network
      graph.addEdge('wp_003', 'wp_010');

      const startTime = performance.now();
      const path = pathfinder.findPath('di_27_18_top', 'wp_099');
      const endTime = performance.now();

      expect(path).toBeTruthy();
      expect(path.length).toBeGreaterThan(90); // Long path through many waypoints
      expect(endTime - startTime).toBeLessThan(50); // Should still be fast
    });
  });

  describe('Data validation integration', () => {
    it('should validate node types correctly', () => {
      expect(graph.getNodeType('wp_001')).toBe('waypoint');
      expect(graph.getNodeType('di_27_18_top')).toBe('di_box');
      expect(graph.getNodeType('fossil_excavation_1')).toBe('fossil');
      expect(graph.getNodeType('col_1_cab_01')).toBe('cabinet');
    });

    it('should maintain coordinate precision', () => {
      const coords = graph.getNodeCoordinates('wp_001');
      expect(coords[0]).toBe(-123.1);
      expect(coords[1]).toBe(49.1);
    });

    it('should preserve polygon data integrity', () => {
      const polygon = graph.fixturePolygons.get('di_27_18_top');
      expect(polygon).toBeTruthy();
      expect(Array.isArray(polygon)).toBe(true);
      expect(polygon.length).toBeGreaterThan(2); // At least 3 points for a polygon
    });
  });
});
