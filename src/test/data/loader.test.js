/**
 * Tests for the data loader module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  GeoJSONLoader, 
  GraphBuilder, 
  WayfindingDataManager, 
  DataLoadingError 
} from '../../data/loader.js';
import { WayfindingGraph, NODE_TYPES } from '../../core/pathfinding.js';

// Mock data
const mockWayfindingGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-123.1, 49.1]
      },
      properties: {
        wayfinding_type: 'walking_grid_point',
        alt_name: 'wp_001'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[-123.1, 49.1], [-123.2, 49.2]]
      },
      properties: {
        wayfinding_type: 'walking_path',
        source: 'wp_001',
        target: 'di_27_18_top'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-123.15, 49.15], [-123.16, 49.15], [-123.16, 49.16], [-123.15, 49.16], [-123.15, 49.15]]]
      },
      properties: {
        alt_name: 'col_1_cab_01',
        display_point: {
          coordinates: [-123.155, 49.155]
        }
      }
    }
  ]
};

const mockFixtureGeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[-123.2, 49.2], [-123.21, 49.2], [-123.21, 49.21], [-123.2, 49.21], [-123.2, 49.2]]]
      },
      properties: {
        alt_name: 'di_27_18_top'
      }
    }
  ]
};

describe('GeoJSONLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new GeoJSONLoader();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(loader.options.timeout).toBe(30000);
      expect(loader.options.retryAttempts).toBe(3);
      expect(loader.options.retryDelay).toBe(1000);
    });

    it('should accept custom options', () => {
      const customLoader = new GeoJSONLoader({
        timeout: 5000,
        retryAttempts: 1,
      });
      
      expect(customLoader.options.timeout).toBe(5000);
      expect(customLoader.options.retryAttempts).toBe(1);
      expect(customLoader.options.retryDelay).toBe(1000); // Default
    });
  });

  describe('loadGeoJSON', () => {
    it('should load valid GeoJSON successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWayfindingGeoJSON)
      });

      const result = await loader.loadGeoJSON('test.geojson');
      expect(result).toEqual(mockWayfindingGeoJSON);
      expect(fetch).toHaveBeenCalledWith('test.geojson', expect.any(Object));
    });

    it('should throw error for invalid URL', async () => {
      await expect(loader.loadGeoJSON('')).rejects.toThrow(DataLoadingError);
      await expect(loader.loadGeoJSON(null)).rejects.toThrow(DataLoadingError);
    });

    it('should throw error for HTTP errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(loader.loadGeoJSON('test.geojson')).rejects.toThrow(DataLoadingError);
    });

    it('should throw error for invalid GeoJSON', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'data' })
      });

      await expect(loader.loadGeoJSON('test.geojson')).rejects.toThrow(DataLoadingError);
    });

    it('should retry on failure', async () => {
      const loader = new GeoJSONLoader({ retryAttempts: 2, retryDelay: 10 });
      
      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWayfindingGeoJSON)
        });

      const result = await loader.loadGeoJSON('test.geojson');
      expect(result).toEqual(mockWayfindingGeoJSON);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const loader = new GeoJSONLoader({ retryAttempts: 2, retryDelay: 10 });
      
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(loader.loadGeoJSON('test.geojson')).rejects.toThrow(DataLoadingError);
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('loadMultipleGeoJSON', () => {
    it('should load multiple files successfully', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWayfindingGeoJSON)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFixtureGeoJSON)
        });

      const results = await loader.loadMultipleGeoJSON(['file1.geojson', 'file2.geojson']);
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockWayfindingGeoJSON);
      expect(results[1]).toEqual(mockFixtureGeoJSON);
    });

    it('should throw error for invalid input', async () => {
      await expect(loader.loadMultipleGeoJSON('not-an-array')).rejects.toThrow(DataLoadingError);
    });

    it('should handle partial failures', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWayfindingGeoJSON)
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(loader.loadMultipleGeoJSON(['file1.geojson', 'file2.geojson']))
        .rejects.toThrow(DataLoadingError);
    });
  });
});

describe('GraphBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new GraphBuilder();
  });

  describe('buildGraph', () => {
    it('should build graph from GeoJSON data', () => {
      const graph = builder.buildGraph(mockWayfindingGeoJSON);

      expect(graph).toBeInstanceOf(WayfindingGraph);
      expect(graph.hasNode('wp_001')).toBe(true);
      expect(graph.hasNode('di_27_18_top')).toBe(true);
      expect(graph.hasNode('col_1_cab_01')).toBe(true);
      
      expect(graph.getNodeType('wp_001')).toBe(NODE_TYPES.WAYPOINT);
      expect(graph.getNodeType('di_27_18_top')).toBe(NODE_TYPES.DI_BOX);
      expect(graph.getNodeType('col_1_cab_01')).toBe(NODE_TYPES.CABINET);
    });

    it('should handle walking paths', () => {
      const graph = builder.buildGraph(mockWayfindingGeoJSON);
      
      expect(graph.walkingPaths).toHaveLength(1);
      expect(graph.walkingPaths[0]).toMatchObject({
        source: 'wp_001',
        target: 'di_27_18_top',
        type: 'walking_path'
      });
    });

    it('should handle polygon features', () => {
      const graph = builder.buildGraph(mockWayfindingGeoJSON);
      
      expect(graph.fixturePolygons.has('col_1_cab_01')).toBe(true);
      expect(graph.getNodeCoordinates('col_1_cab_01')).toEqual([-123.155, 49.155]);
    });

    it('should process fixture data', () => {
      const graph = builder.buildGraph(mockWayfindingGeoJSON, [mockFixtureGeoJSON]);
      
      expect(graph.fixturePolygons.has('di_27_18_top')).toBe(true);
    });

    it('should handle empty data gracefully', () => {
      const emptyGeoJSON = { type: 'FeatureCollection', features: [] };
      const graph = builder.buildGraph(emptyGeoJSON);
      
      expect(graph.nodes.size).toBe(0);
      expect(graph.walkingPaths).toHaveLength(0);
    });

    it('should throw error for invalid data', () => {
      expect(() => builder.buildGraph(null)).toThrow(DataLoadingError);
      expect(() => builder.buildGraph({ invalid: 'data' })).toThrow(DataLoadingError);
    });
  });
});

describe('WayfindingDataManager', () => {
  let manager;

  beforeEach(() => {
    manager = new WayfindingDataManager();
    vi.clearAllMocks();
  });

  describe('loadAndBuildGraph', () => {
    it('should load and build graph successfully', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWayfindingGeoJSON)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFixtureGeoJSON)
        });

      const graph = await manager.loadAndBuildGraph(
        'wayfinding.geojson',
        ['fixture.geojson']
      );

      expect(graph).toBeInstanceOf(WayfindingGraph);
      expect(graph.hasNode('wp_001')).toBe(true);
      expect(graph.hasNode('di_27_18_top')).toBe(true);
    });

    it('should handle fixture loading failures gracefully', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockWayfindingGeoJSON)
        })
        .mockRejectedValueOnce(new Error('Fixture load failed'));

      // Should not throw, should continue with partial data
      const graph = await manager.loadAndBuildGraph(
        'wayfinding.geojson',
        ['fixture.geojson']
      );

      expect(graph).toBeInstanceOf(WayfindingGraph);
      expect(graph.hasNode('wp_001')).toBe(true);
    });

    it('should throw error for main data loading failure', async () => {
      global.fetch.mockRejectedValue(new Error('Main data load failed'));

      await expect(manager.loadAndBuildGraph('wayfinding.geojson'))
        .rejects.toThrow(DataLoadingError);
    });
  });

  describe('getDefaultFixtureUrls', () => {
    it('should return default fixture URLs', () => {
      const urls = WayfindingDataManager.getDefaultFixtureUrls();
      
      expect(urls).toHaveLength(4);
      expect(urls).toContain('./geojson/cabinet_fixtures.geojson');
      expect(urls).toContain('./geojson/di_box_fixtures.geojson');
      expect(urls).toContain('./geojson/fossil_excavation_fixtures.geojson');
      expect(urls).toContain('./geojson/fixture.geojson');
    });

    it('should handle custom base URL', () => {
      const urls = WayfindingDataManager.getDefaultFixtureUrls('/custom/path');
      
      expect(urls[0]).toContain('/custom/path/cabinet_fixtures.geojson');
    });

    it('should handle base URL with trailing slash', () => {
      const urls = WayfindingDataManager.getDefaultFixtureUrls('./geojson/');
      
      expect(urls[0]).toBe('./geojson/cabinet_fixtures.geojson');
    });
  });
});
