/**
 * Tests for the map visualization component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MapVisualizationComponent } from '../../ui/map-visualization.js';
import { WayfindingGraph, NODE_TYPES } from '../../core/pathfinding.js';

describe('MapVisualizationComponent', () => {
  let container;
  let mapComponent;
  let mockGraph;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.id = 'mapContainer';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create mock graph
    mockGraph = new WayfindingGraph();
    mockGraph.addNode('wp_001', NODE_TYPES.WAYPOINT, [-123.1, 49.1]);
    mockGraph.addNode('di_27_18_top', NODE_TYPES.DI_BOX, [-123.2, 49.2]);
    mockGraph.addEdge('wp_001', 'di_27_18_top');

    // Initialize component
    mapComponent = new MapVisualizationComponent(container, {
      enableFallback: true,
      enableControls: false, // Disable for testing
    });
  });

  afterEach(() => {
    if (mapComponent) {
      mapComponent.destroy();
    }
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should initialize with container element', () => {
      expect(mapComponent.containerElement).toBe(container);
      expect(mapComponent.graph).toBeNull();
      expect(mapComponent.currentPath).toBeNull();
    });

    it('should throw error for invalid container', () => {
      expect(() => new MapVisualizationComponent(null)).toThrow();
      expect(() => new MapVisualizationComponent('not-an-element')).toThrow();
    });

    it('should apply custom options', () => {
      const customContainer = document.createElement('div');
      document.body.appendChild(customContainer);
      
      const customComponent = new MapVisualizationComponent(customContainer, {
        enableFallback: false,
        enableControls: true,
      });

      expect(customComponent.options.enableFallback).toBe(false);
      expect(customComponent.options.enableControls).toBe(true);
      
      customComponent.destroy();
      document.body.removeChild(customContainer);
    });
  });

  describe('graph management', () => {
    it('should set graph data', () => {
      mapComponent.setGraph(mockGraph);
      
      expect(mapComponent.graph).toBe(mockGraph);
    });

    it('should handle null graph gracefully', () => {
      expect(() => mapComponent.setGraph(null)).not.toThrow();
      expect(mapComponent.graph).toBeNull();
    });

    it('should update visualization when graph is set', () => {
      const updateSpy = vi.spyOn(mapComponent, '_updateVisualization');
      mapComponent.setGraph(mockGraph);
      
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('path visualization', () => {
    beforeEach(() => {
      mapComponent.setGraph(mockGraph);
    });

    it('should set current path', () => {
      const pathDetails = {
        path: ['wp_001', 'di_27_18_top'],
        nodes: [
          { id: 'wp_001', type: NODE_TYPES.WAYPOINT, coordinates: [-123.1, 49.1] },
          { id: 'di_27_18_top', type: NODE_TYPES.DI_BOX, coordinates: [-123.2, 49.2] },
        ],
        length: 2,
        summary: {
          start: { id: 'wp_001', type: NODE_TYPES.WAYPOINT },
          end: { id: 'di_27_18_top', type: NODE_TYPES.DI_BOX },
          waypointsUsed: 1,
        },
      };

      mapComponent.setCurrentPath(pathDetails);
      
      expect(mapComponent.currentPath).toBe(pathDetails);
    });

    it('should clear current path', () => {
      const pathDetails = {
        path: ['wp_001', 'di_27_18_top'],
        nodes: [
          { id: 'wp_001', type: NODE_TYPES.WAYPOINT, coordinates: [-123.1, 49.1] },
          { id: 'di_27_18_top', type: NODE_TYPES.DI_BOX, coordinates: [-123.2, 49.2] },
        ],
      };

      mapComponent.setCurrentPath(pathDetails);
      mapComponent.clearPath();
      
      expect(mapComponent.currentPath).toBeNull();
    });
  });

  describe('layer management', () => {
    beforeEach(() => {
      mapComponent.setGraph(mockGraph);
    });

    it('should toggle layer visibility', () => {
      const initialState = mapComponent.layerVisibility.waypoints;
      mapComponent.toggleLayer('waypoints');
      
      expect(mapComponent.layerVisibility.waypoints).toBe(!initialState);
    });

    it('should handle invalid layer names gracefully', () => {
      expect(() => mapComponent.toggleLayer('invalid_layer')).not.toThrow();
    });

    it('should emit layer toggle event', () => {
      let eventDetail = null;
      container.addEventListener('layer:toggled', (e) => {
        eventDetail = e.detail;
      });

      mapComponent.toggleLayer('waypoints');

      expect(eventDetail).toEqual({
        layer: 'waypoints',
        visible: expect.any(Boolean),
      });
    });
  });

  describe('view management', () => {
    it('should reset view to initial state', () => {
      mapComponent.setGraph(mockGraph);
      mapComponent.resetView();
      
      // Should not throw and should reset to default bounds
      expect(mapComponent.currentBounds).toBeTruthy();
    });

    it('should fit bounds to graph data', () => {
      mapComponent.setGraph(mockGraph);
      mapComponent.fitToGraph();
      
      // Should calculate bounds from graph coordinates
      expect(mapComponent.currentBounds).toBeTruthy();
    });
  });

  describe('fallback mode', () => {
    it('should enable fallback when WebGL is not available', () => {
      // Mock WebGL not available
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = vi.fn(() => null);

      const fallbackContainer = document.createElement('div');
      document.body.appendChild(fallbackContainer);
      
      const fallbackComponent = new MapVisualizationComponent(fallbackContainer, {
        enableFallback: true,
      });

      expect(fallbackComponent.useFallback).toBe(true);
      
      fallbackComponent.destroy();
      document.body.removeChild(fallbackContainer);
      
      // Restore original method
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('should render text-based visualization in fallback mode', () => {
      mapComponent.useFallback = true;
      mapComponent.setGraph(mockGraph);
      
      // Should create text-based visualization
      const textViz = container.querySelector('.text-visualization');
      expect(textViz).toBeTruthy();
    });
  });

  describe('statistics', () => {
    it('should return visualization statistics', () => {
      mapComponent.setGraph(mockGraph);
      
      const stats = mapComponent.getStatistics();
      
      expect(stats).toMatchObject({
        hasGraph: true,
        hasPath: false,
        layerVisibility: expect.any(Object),
        useFallback: expect.any(Boolean),
      });
    });

    it('should include path statistics when path is set', () => {
      const pathDetails = {
        path: ['wp_001', 'di_27_18_top'],
        nodes: [
          { id: 'wp_001', type: NODE_TYPES.WAYPOINT, coordinates: [-123.1, 49.1] },
          { id: 'di_27_18_top', type: NODE_TYPES.DI_BOX, coordinates: [-123.2, 49.2] },
        ],
      };

      mapComponent.setGraph(mockGraph);
      mapComponent.setCurrentPath(pathDetails);
      
      const stats = mapComponent.getStatistics();
      
      expect(stats.hasPath).toBe(true);
      expect(stats.pathLength).toBe(2);
    });
  });

  describe('event handling', () => {
    it('should emit map loaded event', () => {
      let eventFired = false;
      container.addEventListener('map:loaded', () => {
        eventFired = true;
      });

      mapComponent.setGraph(mockGraph);
      
      // Simulate map load completion
      mapComponent._onMapLoaded();
      
      expect(eventFired).toBe(true);
    });

    it('should handle resize events', () => {
      mapComponent.setGraph(mockGraph);
      
      // Simulate window resize
      const resizeEvent = new Event('resize');
      window.dispatchEvent(resizeEvent);
      
      // Should not throw
      expect(mapComponent.containerElement).toBeTruthy();
    });
  });

  describe('destroy', () => {
    it('should clean up properly', () => {
      mapComponent.setGraph(mockGraph);
      mapComponent.destroy();
      
      // Should clean up map instance and event listeners
      expect(mapComponent.map).toBeNull();
      expect(mapComponent.deckOverlay).toBeNull();
    });

    it('should remove all event listeners', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      
      mapComponent.destroy();
      
      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
