/**
 * Fuse.js Search Provider
 * 
 * Implements fuzzy search using Fuse.js library
 */

import { SearchInterface } from './search-interface.js';

/**
 * Fuse.js search provider for fuzzy searching
 */
export class FuseSearchProvider extends SearchInterface {
  constructor() {
    super();
    this.fuse = null;
    this.data = [];
    this.config = {
      // Fuse.js options
      keys: [
        { name: 'id', weight: 0.5 },
        { name: 'alt_name', weight: 0.7 },
        { name: 'name', weight: 0.4 },
        { name: 'alternativeNames', weight: 0.8 },
        { name: 'type', weight: 0.3 },
        { name: 'category', weight: 0.3 },
        { name: 'nodeType', weight: 0.2 }
      ],
      threshold: 0.6, // More lenient matching for better results
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1, // Allow single character matches
      ignoreLocation: true, // Don't care about position in string
      ignoreFieldNorm: false,
      
      // Custom options
      maxResults: 50,
      minQueryLength: 1
    };
  }

  async initialize(data, options = {}) {
    // Check if Fuse.js is available
    if (typeof window !== 'undefined' && !window.Fuse) {
      throw new Error('Fuse.js is not loaded. Please include Fuse.js library.');
    }
    
    this.config = { ...this.config, ...options };
    this.data = data || [];
    
    // Create Fuse instance
    const fuseOptions = { ...this.config };
    delete fuseOptions.maxResults;
    delete fuseOptions.minQueryLength;
    
    this.fuse = new window.Fuse(this.data, fuseOptions);
    
    return this;
  }

  search(query, options = {}) {
    if (!this.fuse || !query || query.length < this.config.minQueryLength) {
      return [];
    }

    const searchOptions = { ...this.config, ...options };
    const results = this.fuse.search(query, {
      limit: searchOptions.maxResults * 2 // Get more results for deduplication
    });

    // Transform and deduplicate Fuse results
    const seenIds = new Set();
    const uniqueResults = [];

    for (const result of results) {
      const itemId = result.item.id;
      if (!seenIds.has(itemId)) {
        seenIds.add(itemId);
        uniqueResults.push({
          item: result.item,
          score: 1 - result.score, // Convert Fuse score (lower is better) to our format (higher is better)
          matches: result.matches || [],
          originalScore: result.score,
          refIndex: result.refIndex
        });

        // Stop when we have enough unique results
        if (uniqueResults.length >= searchOptions.maxResults) {
          break;
        }
      }
    }

    return uniqueResults;
  }

  updateData(data) {
    this.data = data || [];
    if (this.fuse) {
      this.fuse.setCollection(this.data);
    }
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
    
    // Recreate Fuse instance with new config
    if (this.fuse && this.data.length > 0) {
      const fuseOptions = { ...this.config };
      delete fuseOptions.maxResults;
      delete fuseOptions.minQueryLength;
      
      this.fuse = new window.Fuse(this.data, fuseOptions);
    }
  }

  /**
   * Get the best matching text for display
   * @param {Object} result - Search result from Fuse
   * @returns {string} Best matching text
   */
  getBestMatch(result) {
    if (!result.matches || result.matches.length === 0) {
      return result.item.id || result.item.name || String(result.item);
    }

    // Find the best match based on score and weight
    let bestMatch = result.matches[0];
    
    for (const match of result.matches) {
      // Prefer matches in alt_name or alternativeNames
      if ((match.key === 'alt_name' || match.key === 'alternativeNames') && match.value) {
        bestMatch = match;
        break;
      }
      
      // Otherwise prefer matches with better scores
      if (match.score && (!bestMatch.score || match.score < bestMatch.score)) {
        bestMatch = match;
      }
    }

    return bestMatch.value || result.item.id || result.item.name || String(result.item);
  }

  /**
   * Highlight matches in text
   * @param {string} text - Original text
   * @param {Array} indices - Match indices from Fuse
   * @returns {string} HTML with highlighted matches
   */
  highlightMatches(text, indices) {
    if (!indices || indices.length === 0) {
      return text;
    }

    let result = '';
    let lastIndex = 0;

    for (const [start, end] of indices) {
      result += text.slice(lastIndex, start);
      result += `<mark class="search-highlight">${text.slice(start, end + 1)}</mark>`;
      lastIndex = end + 1;
    }
    
    result += text.slice(lastIndex);
    return result;
  }

  destroy() {
    this.fuse = null;
    this.data = [];
  }
}

/**
 * Factory function to create appropriate search provider
 * @param {string} type - Search provider type ('fuse' or 'simple')
 * @returns {Promise<SearchInterface>} Search provider instance
 */
export async function createSearchProvider(type = 'fuse') {
  switch (type.toLowerCase()) {
    case 'fuse':
      try {
        return new FuseSearchProvider();
      } catch (error) {
        console.warn('Fuse.js not available, falling back to simple search:', error.message);
        // Fallback to simple search
        const { SimpleSearchProvider } = await import('./search-interface.js');
        return new SimpleSearchProvider();
      }
    
    case 'simple':
    default:
      const { SimpleSearchProvider } = await import('./search-interface.js');
      return new SimpleSearchProvider();
  }
}
