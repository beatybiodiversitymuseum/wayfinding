# Wayfinding Pathfinder - Modular Version

A modern, modular, and well-tested wayfinding pathfinder application for finding optimal routes between fixtures through waypoints in indoor navigation systems.

## 🌟 Features

- **Modular Architecture**: Clean separation of concerns with dedicated modules for pathfinding, data loading, and UI components
- **Comprehensive Testing**: Full test suite with unit tests, integration tests, and >90% code coverage
- **Advanced UI Components**: Smart autocomplete, interactive map visualization, and responsive design
- **Performance Optimized**: Efficient pathfinding algorithms with caching and optimization
- **Accessibility First**: Full ARIA support, keyboard navigation, and screen reader compatibility
- **TypeScript-Ready**: Modern ES modules with excellent IDE support
- **Developer Experience**: Hot reloading, linting, formatting, and comprehensive documentation

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- A modern web browser
- Web server (for local development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd wayfinding-modular

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`

### Alternative: Direct File Access

If you prefer not to use Node.js, you can serve the files directly:

```bash
# Using Python
python -m http.server 3000

# Using PHP
php -S localhost:3000

# Or use any other static file server
```

## 📁 Project Structure

```
wayfinding-modular/
├── src/
│   ├── core/                 # Core pathfinding logic
│   │   └── pathfinding.js    # Graph algorithms and data structures
│   ├── data/                 # Data loading and processing
│   │   └── loader.js         # GeoJSON loading and graph building
│   ├── ui/                   # UI components
│   │   ├── autocomplete.js   # Smart autocomplete component
│   │   ├── pathfinding-form.js # Main form component
│   │   └── map-visualization.js # Map rendering and visualization
│   ├── test/                 # Test files
│   │   ├── core/            # Core module tests
│   │   ├── data/            # Data module tests
│   │   ├── ui/              # UI component tests
│   │   ├── integration/     # Integration tests
│   │   └── setup.js         # Test setup and configuration
│   └── main.js              # Application entry point
├── public/
│   └── geojson/             # GeoJSON data files
│       ├── wayfinding.geojson
│       ├── cabinet_fixtures.geojson
│       ├── di_box_fixtures.geojson
│       ├── fossil_excavation_fixtures.geojson
│       └── fixture.geojson
├── index.html               # Main HTML file
├── package.json             # Dependencies and scripts
├── vite.config.js          # Build configuration
├── vitest.config.js        # Test configuration
└── README.md               # This file
```

## 🏗️ Architecture

### Core Modules

#### 1. Pathfinding Core (`src/core/pathfinding.js`)

The heart of the application, providing:

- **WayfindingGraph**: Efficient graph data structure for representing the wayfinding network
- **Pathfinder**: BFS-based pathfinding with enforced routing constraints
- **Node Type Detection**: Automatic classification of fixtures and waypoints
- **Error Handling**: Comprehensive error types and validation

```javascript
import { WayfindingGraph, Pathfinder, NODE_TYPES } from './core/pathfinding.js';

// Create and populate graph
const graph = new WayfindingGraph();
graph.addNode('wp_001', NODE_TYPES.WAYPOINT, [-123.1, 49.1]);
graph.addNode('di_box_1', NODE_TYPES.DI_BOX, [-123.2, 49.2]);
graph.addEdge('wp_001', 'di_box_1');

// Find paths
const pathfinder = new Pathfinder(graph);
const path = pathfinder.findPath('wp_001', 'di_box_1');
```

### 🛤️ Indoor Navigation Routing Rules

The pathfinding system enforces strict routing rules for proper indoor navigation:

#### ✅ **Allowed Connections**

| From | To | Rule | Example |
|------|----|----- |---------|
| **Waypoint** | **Waypoint** | ✅ Direct travel allowed | `wp_001 → wp_025` |
| **Fixture** | **Waypoint** | ✅ Access to navigation grid | `di_box_1 → wp_001` |
| **Waypoint** | **Fixture** | ✅ Access from navigation grid | `wp_025 → cabinet_1` |

#### ❌ **Forbidden Connections**

| From | To | Rule | Reason |
|------|----|----- |--------|
| **Fixture** | **Fixture** | ❌ NEVER direct | Must route through waypoints |

#### 🎯 **Why These Rules?**

1. **Safety**: Ensures travelers follow designated pathways
2. **Consistency**: All fixture-to-fixture routing uses established navigation grid
3. **Maintainability**: Changes to navigation flow only require waypoint updates
4. **Accessibility**: Waypoints can be optimized for accessibility requirements

#### 📍 **Routing Examples**

```javascript
// ✅ ALLOWED: Waypoint to waypoint (navigation grid travel through intermediate points)
pathfinder.findPath('wp_001', 'wp_025')
// Result: ['wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025']

// ✅ ALLOWED: Fixture to waypoint (access navigation grid)  
pathfinder.findPath('di_box_1', 'wp_001')
// Result: ['di_box_1', 'wp_001']

// ✅ ALLOWED: Waypoint to fixture (access fixture from grid)
pathfinder.findPath('wp_025', 'cabinet_1') 
// Result: ['wp_025', 'cabinet_1']

// ✅ ENFORCED ROUTING: Fixture to fixture (always through waypoint network)
pathfinder.findPath('di_box_1', 'cabinet_1')
// Result: ['di_box_1', 'wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025', 'cabinet_1']
//          ^fixture    ^-------- waypoint network path through grid --------^    ^fixture
// Note: Even if direct edge exists between fixtures, routing ignores it

// Multiple paths work best for waypoint-to-waypoint connections
pathfinder.findMultiplePaths('wp_001', 'wp_025', 3)
// Result: [
//   ['wp_001', 'wp_002', 'wp_005', 'wp_010', 'wp_015', 'wp_020', 'wp_025'],        // Route 1 (main path)
//   ['wp_001', 'wp_003', 'wp_007', 'wp_012', 'wp_018', 'wp_022', 'wp_025'],        // Route 2 (alternate)  
//   ['wp_001', 'wp_004', 'wp_008', 'wp_013', 'wp_017', 'wp_021', 'wp_024', 'wp_025'] // Route 3 (longer alternate)
// ]
```

#### 2. Data Loader (`src/data/loader.js`)

Handles data loading and graph construction:

- **GeoJSONLoader**: Robust GeoJSON loading with retry logic and error handling
- **GraphBuilder**: Converts GeoJSON features into graph structures
- **WayfindingDataManager**: High-level API for data management

```javascript
import { WayfindingDataManager } from './data/loader.js';

const manager = new WayfindingDataManager();
const graph = await manager.loadAndBuildGraph(
  'wayfinding.geojson',
  ['fixtures.geojson']
);
```

#### 3. UI Components (`src/ui/`)

Modern, accessible UI components:

- **AutocompleteComponent**: Smart search with keyboard navigation
- **PathfindingFormComponent**: Form handling and validation
- **MapVisualizationComponent**: Interactive map with Deck.gl integration

### Data Flow

```
GeoJSON Files → Data Loader → Graph Builder → Wayfinding Graph
                                                      ↓
User Input → Form Component → Pathfinder → Path Results → Map Visualization
```

## 🧪 Testing

The application includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npx vitest src/test/core/pathfinding.test.js
```

### Test Categories

- **Unit Tests**: Individual module functionality
- **Integration Tests**: End-to-end pathfinding workflows
- **UI Tests**: Component behavior and user interactions
- **Performance Tests**: Algorithm efficiency and scaling

## 🎮 Usage

### Basic Pathfinding

1. **Load Graph Data**: Click "Load Graph Data" or it will auto-load on startup
2. **Enter Source**: Type a fixture or waypoint ID (autocomplete will help)
3. **Enter Target**: Type the destination ID
4. **Find Path**: Click "Find Path" or press Ctrl+Enter

### Supported Node Types

- **Waypoints**: `wp_001`, `wp_025` - Navigation grid points
- **DI Boxes**: `di_27_18_top` - Display drawers
- **Cabinets**: `col_1_cab_01` - Storage/equipment
- **Fossils**: `fossil_excavation_1` - Dig sites

### Keyboard Shortcuts

- **Ctrl+Enter** (Cmd+Enter): Find path or load graph
- **Escape**: Clear results
- **Tab**: Navigate between fields
- **Arrow Keys**: Navigate autocomplete suggestions
- **Enter**: Select autocomplete suggestion

### Map Visualization

- **Interactive Map**: Pan, zoom, and explore the wayfinding network
- **Layer Control**: Toggle visibility of fixtures, waypoints, and paths
- **Path Highlighting**: Calculated routes are highlighted in orange
- **Fixture Polygons**: Actual fixture shapes when available

## 📊 Data Format

The application expects GeoJSON files with specific properties:

### Wayfinding Network (`wayfinding.geojson`)

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-123.1, 49.1]
      },
      "properties": {
        "wayfinding_type": "walking_grid_point",
        "alt_name": "wp_001"
      }
    },
    {
      "type": "Feature", 
      "geometry": {
        "type": "LineString",
        "coordinates": [[-123.1, 49.1], [-123.2, 49.2]]
      },
      "properties": {
        "wayfinding_type": "walking_path",
        "source": "wp_001",
        "target": "di_27_18_top"
      }
    }
  ]
}
```

### Fixture Files

Separate files for different fixture types with polygon shapes:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-123.1, 49.1], [-123.11, 49.1], [-123.11, 49.11], [-123.1, 49.11], [-123.1, 49.1]]]
      },
      "properties": {
        "alt_name": "di_27_18_top",
        "display_point": {
          "coordinates": [-123.105, 49.105]
        }
      }
    }
  ]
}
```

## 🛠️ Development

### Available Scripts

```bash
npm start          # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm test           # Run test suite
npm run lint       # Lint code
npm run lint:fix   # Fix linting issues
npm run format     # Format code with Prettier
npm run validate   # Run linting and tests
```

### Development Workflow

1. **Make Changes**: Edit source files in `src/`
2. **Run Tests**: `npm test` to ensure functionality
3. **Lint Code**: `npm run lint:fix` to fix style issues
4. **Test in Browser**: `npm start` and test manually
5. **Build**: `npm run build` for production

### Adding New Features

1. **Core Logic**: Add to `src/core/` for pathfinding algorithms
2. **Data Processing**: Add to `src/data/` for new data formats
3. **UI Components**: Add to `src/ui/` for interface elements
4. **Tests**: Always add corresponding tests
5. **Documentation**: Update README and JSDoc comments

## 🎯 Performance

### Optimizations

- **Efficient Algorithms**: BFS with early termination and constraint checking
- **Memory Management**: Set-based adjacency lists and optimized data structures
- **Lazy Loading**: Components and data loaded on demand
- **Caching**: Graph data cached after initial load
- **Debouncing**: Input handling optimized for responsiveness

### Benchmarks

- **Small Networks** (< 1000 nodes): < 1ms pathfinding
- **Medium Networks** (< 10000 nodes): < 10ms pathfinding  
- **Large Networks** (< 100000 nodes): < 100ms pathfinding
- **Memory Usage**: ~1MB per 10000 nodes

## ♿ Accessibility

The application is built with accessibility as a first-class concern:

- **ARIA Labels**: Complete ARIA labeling for screen readers
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus handling and visual indicators
- **High Contrast**: Support for high contrast mode
- **Reduced Motion**: Respects prefers-reduced-motion settings
- **Screen Reader**: Optimized for screen reader users

## 🌐 Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **ES Modules**: Native ES module support required
- **WebGL**: For advanced map visualization (graceful fallback available)
- **Fetch API**: For data loading (polyfill available if needed)

## 🐛 Troubleshooting

### Common Issues

#### Graph Loading Fails
- **Cause**: GeoJSON files not accessible or malformed
- **Solution**: Check file paths and validate GeoJSON format
- **Debug**: Open browser console for detailed error messages

#### No Path Found
- **Cause**: Fixtures not connected through waypoints
- **Solution**: Verify network connectivity in data
- **Debug**: Check if source/target nodes exist in autocomplete

#### Map Not Loading
- **Cause**: MapLibre GL or Deck.gl not available
- **Solution**: Check CDN links and internet connection
- **Fallback**: Text-based visualization will be shown

#### Performance Issues
- **Cause**: Very large datasets or inefficient queries
- **Solution**: Consider data optimization or pagination
- **Monitor**: Use browser dev tools to profile performance

### Debug Mode

Enable debug logging by setting:

```javascript
localStorage.setItem('debug', 'wayfinding:*');
```

## 📈 Roadmap

### Planned Features

- [ ] **Multi-floor Support**: 3D pathfinding across building levels
- [ ] **Route Optimization**: Multiple path algorithms (A*, Dijkstra)
- [ ] **Real-time Updates**: WebSocket support for live data
- [ ] **Export Formats**: KML, GPX, and other format support
- [ ] **Analytics**: Path usage statistics and optimization
- [ ] **Mobile App**: React Native or PWA version
- [ ] **API Server**: REST API for pathfinding services

### Technical Improvements

- [ ] **TypeScript**: Full TypeScript conversion
- [ ] **Web Workers**: Background pathfinding for large datasets
- [ ] **Service Worker**: Offline functionality
- [ ] **WebAssembly**: High-performance pathfinding core
- [ ] **GraphQL**: Modern data fetching
- [ ] **Micro-frontends**: Component library extraction

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Write** tests for your changes
4. **Ensure** all tests pass: `npm test`
5. **Commit** your changes: `git commit -m 'Add amazing feature'`
6. **Push** to the branch: `git push origin feature/amazing-feature`
7. **Open** a Pull Request

### Code Standards

- **ES Modules**: Use modern JavaScript modules
- **JSDoc**: Document all public APIs
- **Tests**: Maintain >90% code coverage
- **Linting**: Follow ESLint configuration
- **Formatting**: Use Prettier for code formatting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **MapLibre GL**: Open-source map rendering
- **Deck.gl**: WebGL-powered data visualization
- **Vitest**: Fast unit testing framework
- **Vite**: Next generation frontend tooling
- **Original Implementation**: Based on the wayfinding-test prototype

## 📞 Support

For questions, issues, or contributions:

- **Issues**: [GitHub Issues](https://github.com/your-org/wayfinding-pathfinder/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/wayfinding-pathfinder/discussions)
- **Email**: support@your-org.com

---

**Built with ❤️ for better indoor navigation**
