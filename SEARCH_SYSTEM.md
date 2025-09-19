# Enhanced Search System for Wayfinding

This document describes the new modular search system that has been added to the wayfinding project, featuring Fuse.js integration for fuzzy search capabilities.

## Overview

The enhanced search system provides:

- **Modular Design**: Easy to swap between different search providers (Fuse.js, simple string search, etc.)
- **GeoJSON Integration**: Automatically loads and processes data from GeoJSON files
- **Fuzzy Search**: Intelligent matching using Fuse.js with configurable thresholds
- **Alternative Names**: Supports searching by alternative names, nicknames, and variations
- **Highlighting**: Visual highlighting of matching text in search results
- **Full Control**: You have complete control over which fields are included from GeoJSON

## Architecture

### Core Components

1. **SearchInterface** (`src/search/search-interface.js`)
   - Abstract base class for all search providers
   - Defines the contract that all search implementations must follow

2. **FuseSearchProvider** (`src/search/fuse-search-provider.js`)
   - Implements fuzzy search using Fuse.js
   - Supports weighted field searching, match highlighting, and configurable thresholds

3. **GeoJSONDataLoader** (`src/search/geojson-data-loader.js`)
   - Loads and processes GeoJSON files for search
   - Extracts searchable fields with full control over field mapping

4. **EnhancedAutocompleteComponent** (`src/ui/enhanced-autocomplete.js`)
   - Drop-in replacement for the original autocomplete
   - Integrates with the search system and provides rich UI

## Usage

### Basic Integration

The search system is already integrated into the main wayfinding application. To use it:

```javascript
import { EnhancedAutocompleteComponent } from './src/ui/enhanced-autocomplete.js';

const autocomplete = new EnhancedAutocompleteComponent(inputElement, {
  searchProvider: 'fuse',
  dataUrls: [
    './public/geojson/cabinet_fixtures.geojson',
    './public/geojson/di_box_fixtures.geojson',
    './public/geojson/fossil_excavation_fixtures.geojson'
  ],
  searchConfig: {
    threshold: 0.4,        // Lower = more strict matching
    maxResults: 50,        // Maximum number of results
    minQueryLength: 2,     // Minimum characters before searching
  }
});
```

### Configuration Options

#### Search Configuration
```javascript
{
  threshold: 0.4,          // Fuse.js threshold (0.0 = exact, 1.0 = match anything)
  distance: 100,           // Maximum distance for fuzzy matching
  maxResults: 50,          // Maximum number of results to return
  minQueryLength: 2,       // Minimum query length before searching
  includeScore: true,      // Include match scores in results
  includeMatches: true,    // Include match highlighting data
}
```

#### Field Weights (Fuse.js)
The system searches these fields with different weights:
- `alt_name`: 0.6 (highest priority - alternative names)
- `id`: 0.4 (fixture IDs)
- `name`: 0.3 (official names)
- `alternativeNames`: 0.6 (array of alternative names)
- `type`: 0.2 (fixture type)
- `category`: 0.2 (fixture category)

### GeoJSON Field Mapping

You have full control over which fields are extracted from your GeoJSON files:

```javascript
const dataLoader = new GeoJSONDataLoader({
  idField: 'id',              // Primary identifier field
  nameField: 'name',          // Main name field
  altNameField: 'alt_name',   // Alternative name field
  categoryField: 'category',  // Category/type field
  includeProperties: true,    // Include all properties
  includeGeometry: false,     // Include geometry data
  
  // Custom field extractors
  fieldExtractors: {
    customField: (feature, props) => {
      return props.some_custom_field;
    }
  }
});
```

### Switching Search Providers

To use a different search provider or fall back to simple search:

```javascript
// Use Fuse.js (default)
const autocomplete = new EnhancedAutocompleteComponent(input, {
  searchProvider: 'fuse'
});

// Use simple string search (fallback)
const autocomplete = new EnhancedAutocompleteComponent(input, {
  searchProvider: 'simple'
});
```

### Creating Custom Search Providers

Implement the `SearchInterface`:

```javascript
import { SearchInterface } from './src/search/search-interface.js';

class MyCustomSearchProvider extends SearchInterface {
  async initialize(data, options = {}) {
    // Initialize your search system
  }

  search(query, options = {}) {
    // Return array of results with format:
    // [{ item: originalItem, score: 0.95, matches: [...] }]
  }

  updateData(data) {
    // Update searchable data
  }
  
  // ... implement other required methods
}
```

## Demo

A demo page is available at `search-demo.html` that shows the search system in action with the actual GeoJSON data from your wayfinding project.

## Current Integration

The search system is integrated into the main wayfinding application:

1. **Pathfinding Form**: The Source and Target ID inputs now use the enhanced search
2. **GeoJSON Data**: Automatically loads from cabinet, DI box, and fossil excavation files
3. **Fallback**: Falls back to the original autocomplete if Fuse.js is unavailable
4. **Configurable**: Can be disabled by setting `useEnhancedSearch: false` in form options

## Search Examples

The system supports various search patterns:

- **Exact matches**: "col_1_cab_01"
- **Partial matches**: "cabinet 01", "cab 01"
- **Alternative names**: "main cabinet" (matches "col_1_cab_01")
- **Fuzzy matches**: "cainet" (matches "cabinet")
- **Type-based**: "DI box", "fossil", "excavation"
- **Descriptive**: "fossil dig", "storage cabinet"

## Benefits

1. **User-Friendly**: Users can search using natural language and descriptions
2. **Error-Tolerant**: Fuzzy matching handles typos and variations
3. **Fast**: Efficient indexing and searching with Fuse.js
4. **Extensible**: Easy to add new search providers or modify behavior
5. **Maintainable**: Clean separation of concerns with modular architecture
6. **Accessible**: Proper ARIA attributes and keyboard navigation

## Dependencies

- **Fuse.js 7.0.0**: Added to package.json and loaded via CDN
- **Modern Browser**: Uses ES6 modules and modern JavaScript features

The system gracefully degrades to simple string search if Fuse.js is not available.
