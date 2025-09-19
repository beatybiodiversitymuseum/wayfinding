/**
 * GeoJSON Data Loader for Search
 * 
 * Loads and processes GeoJSON data for search functionality
 */

/**
 * Loads and processes GeoJSON data for search
 */
export class GeoJSONDataLoader {
  constructor(options = {}) {
    this.options = {
      // Field mappings for different data sources
      idField: 'id',
      nameField: 'name',
      altNameField: 'alt_name',
      categoryField: 'category',
      typeField: 'type',
      
      // Processing options
      includeProperties: true,
      includeGeometry: false,
      
      // Custom field extractors
      fieldExtractors: {},
      
      ...options
    };
  }

  /**
   * Load data from multiple GeoJSON sources
   * @param {Array<string>} urls - Array of GeoJSON URLs
   * @returns {Promise<Array>} Processed search data
   */
  async loadFromUrls(urls) {
    const allData = [];
    const seenIds = new Set();
    
    for (const url of urls) {
      try {
        const data = await this.loadFromUrl(url);
        
        // Deduplicate based on ID
        for (const item of data) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            allData.push(item);
          } else {
            console.log(`🔄 Skipping duplicate item: ${item.id}`);
          }
        }
      } catch (error) {
        console.warn(`Failed to load GeoJSON from ${url}:`, error.message);
      }
    }
    
    console.log(`📊 Loaded ${allData.length} unique items (deduplicated from ${urls.length} files)`);
    return allData;
  }

  /**
   * Load data from a single GeoJSON URL
   * @param {string} url - GeoJSON URL
   * @returns {Promise<Array>} Processed search data
   */
  async loadFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const geojson = await response.json();
    return this.processGeoJSON(geojson);
  }

  /**
   * Process GeoJSON data into searchable format
   * @param {Object} geojson - GeoJSON FeatureCollection
   * @returns {Array} Processed search data
   */
  processGeoJSON(geojson) {
    if (!geojson || geojson.type !== 'FeatureCollection' || !geojson.features) {
      throw new Error('Invalid GeoJSON FeatureCollection');
    }

    return geojson.features.map((feature, index) => {
      const searchItem = this._processFeature(feature, index);
      return searchItem;
    }).filter(item => item !== null);
  }

  /**
   * Process a single GeoJSON feature
   * @param {Object} feature - GeoJSON feature
   * @param {number} index - Feature index
   * @returns {Object|null} Processed search item
   * @private
   */
  _processFeature(feature, index) {
    if (!feature || !feature.properties) {
      return null;
    }

    const props = feature.properties;
    const searchItem = {
      // Core identifiers
      id: this._extractField(feature, props, this.options.idField) || 
          feature.id || 
          `feature_${index}`,
      
      // Names and searchable text
      name: this._extractField(feature, props, this.options.nameField),
      alt_name: this._extractField(feature, props, this.options.altNameField),
      
      // Classification
      type: this._extractField(feature, props, this.options.typeField) || 'feature',
      category: this._extractField(feature, props, this.options.categoryField),
      
      // Additional searchable fields
      alternativeNames: this._extractAlternativeNames(feature, props),
      
      // Original data references
      originalFeature: feature,
      featureIndex: index
    };

    // Include additional properties if requested
    if (this.options.includeProperties) {
      searchItem.properties = { ...props };
    }

    // Include geometry if requested
    if (this.options.includeGeometry && feature.geometry) {
      searchItem.geometry = feature.geometry;
      
      // Extract display point if available
      if (props.display_point) {
        searchItem.displayPoint = props.display_point;
      }
    }

    // Apply custom field extractors
    for (const [fieldName, extractor] of Object.entries(this.options.fieldExtractors)) {
      if (typeof extractor === 'function') {
        try {
          searchItem[fieldName] = extractor(feature, props, searchItem);
        } catch (error) {
          console.warn(`Custom field extractor for '${fieldName}' failed:`, error.message);
        }
      }
    }

    return searchItem;
  }

  /**
   * Extract a field value using various strategies
   * @param {Object} feature - GeoJSON feature
   * @param {Object} props - Feature properties
   * @param {string} fieldName - Field name to extract
   * @returns {*} Field value
   * @private
   */
  _extractField(feature, props, fieldName) {
    if (!fieldName) return null;

    // Direct property access
    if (props[fieldName] !== undefined) {
      return props[fieldName];
    }

    // Feature-level access
    if (feature[fieldName] !== undefined) {
      return feature[fieldName];
    }

    // Case-insensitive search
    const lowerFieldName = fieldName.toLowerCase();
    for (const [key, value] of Object.entries(props)) {
      if (key.toLowerCase() === lowerFieldName) {
        return value;
      }
    }

    return null;
  }

  /**
   * Extract alternative names for enhanced search
   * @param {Object} feature - GeoJSON feature
   * @param {Object} props - Feature properties
   * @returns {Array<string>} Alternative names
   * @private
   */
  _extractAlternativeNames(feature, props) {
    const alternatives = [];
    
    // Common alternative name fields
    const altFields = [
      'alternative_names', 'alt_names', 'aliases', 'alternate_names',
      'short_name', 'display_name', 'common_name', 'nickname'
    ];

    for (const field of altFields) {
      const value = this._extractField(feature, props, field);
      if (value) {
        if (Array.isArray(value)) {
          alternatives.push(...value.filter(v => typeof v === 'string'));
        } else if (typeof value === 'string') {
          alternatives.push(value);
        }
      }
    }

    // Generate alternatives from the main name and alt_name
    const name = props.name;
    const altName = props.alt_name;
    
    if (name && altName && name !== altName) {
      // Add variations
      alternatives.push(name, altName);
      
      // Add space-separated parts
      if (name.includes(' ')) {
        alternatives.push(...name.split(' ').filter(part => part.length > 2));
      }
      if (altName.includes('_')) {
        alternatives.push(...altName.split('_').filter(part => part.length > 2));
      }
    }

    // Remove duplicates and empty strings
    return [...new Set(alternatives.filter(alt => alt && alt.trim()))];
  }

  /**
   * Create a data loader with predefined configurations
   * @param {string} preset - Preset configuration name
   * @returns {GeoJSONDataLoader} Configured data loader
   */
  static createPreset(preset) {
    const presets = {
      // IMDF (Indoor Mapping Data Format) configuration
      imdf: {
        idField: 'id',
        nameField: 'name',
        altNameField: 'alt_name',
        categoryField: 'category',
        typeField: 'feature_type',
        includeGeometry: true,
        fieldExtractors: {
          level_id: (feature, props) => props.level_id,
          anchor_id: (feature, props) => props.anchor_id
        }
      },

      // Wayfinding-specific configuration
      wayfinding: {
        idField: 'alt_name', // Use alt_name as the primary ID for searching
        nameField: 'name', 
        altNameField: 'alt_name',
        categoryField: 'category',
        typeField: 'feature_type', // Use feature_type instead of type
        includeGeometry: true,
        fieldExtractors: {
          nodeType: (feature, props) => {
            // Determine node type from various sources
            if (props.feature_type) return props.feature_type;
            if (props.type) return props.type;
            if (props.category) return props.category;
            return 'unknown';
          },
          // Add the UUID as a searchable field
          uuid: (feature, props) => feature.id,
          // Add alternative names based on the name structure
          alternativeNames: (feature, props) => {
            const alts = [];
            if (props.alt_name) alts.push(props.alt_name);
            if (props.name) {
              alts.push(props.name);
              // Extract parts from name like "Column 1, Cabinet 01"
              const parts = props.name.split(/[,\s]+/).filter(p => p.length > 2);
              alts.push(...parts);
            }
            return alts;
          }
        }
      },

      // Simple configuration for basic GeoJSON
      simple: {
        idField: 'id',
        nameField: 'name',
        includeProperties: false,
        includeGeometry: false
      }
    };

    const config = presets[preset] || presets.simple;
    return new GeoJSONDataLoader(config);
  }
}
