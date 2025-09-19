/**
 * Test setup file
 * 
 * Configures the testing environment and provides global test utilities
 */

import '@testing-library/jest-dom';

// Mock fetch for testing
global.fetch = vi.fn();

// Mock MapLibre GL
global.maplibregl = {
  Map: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    addControl: vi.fn(),
    remove: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
    getZoom: vi.fn(() => 10),
    getBearing: vi.fn(() => 0),
    getPitch: vi.fn(() => 0),
  })),
  NavigationControl: vi.fn(),
  LngLatBounds: vi.fn().mockImplementation(() => ({
    extend: vi.fn().mockReturnThis(),
  })),
};

// Mock Deck.gl
global.deck = {
  MapboxOverlay: vi.fn().mockImplementation(() => ({
    setProps: vi.fn(),
  })),
  ScatterplotLayer: vi.fn(),
  PolygonLayer: vi.fn(),
  PathLayer: vi.fn(),
};

// Console warnings can be noisy in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  // Suppress specific warnings that are expected in tests
  if (args[0]?.includes?.('MapLibre GL not available')) {
    return;
  }
  originalWarn(...args);
};

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});
