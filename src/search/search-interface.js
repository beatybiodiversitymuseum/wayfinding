/**
 * Search Interface
 * 
 * Abstract interface for search providers that can be swapped out
 */

/**
 * Abstract search interface that all search providers must implement
 */
export class SearchInterface {
  /**
   * Initialize the search provider with data
   * @param {Array} data - Array of searchable items
   * @param {Object} options - Search configuration options
   */
  async initialize(data, options = {}) {
    throw new Error('initialize method must be implemented by search provider');
  }

  /**
   * Perform a search query
   * @param {string} query - Search query string
   * @param {Object} options - Search options (limit, threshold, etc.)
   * @returns {Array} Array of search results
   */
  search(query, options = {}) {
    throw new Error('search method must be implemented by search provider');
  }

  /**
   * Update the searchable data
   * @param {Array} data - New data to search
   */
  updateData(data) {
    throw new Error('updateData method must be implemented by search provider');
  }

  /**
   * Get the current configuration
   * @returns {Object} Current search configuration
   */
  getConfig() {
    throw new Error('getConfig method must be implemented by search provider');
  }

  /**
   * Update search configuration
   * @param {Object} config - New configuration options
   */
  updateConfig(config) {
    throw new Error('updateConfig method must be implemented by search provider');
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Default implementation - override if needed
  }
}

/**
 * Simple string-based search provider (fallback implementation)
 */
export class SimpleSearchProvider extends SearchInterface {
  constructor() {
    super();
    this.data = [];
    this.config = {
      caseSensitive: false,
      maxResults: 50,
      minQueryLength: 1
    };
  }

  async initialize(data, options = {}) {
    this.data = data || [];
    this.config = { ...this.config, ...options };
    return this;
  }

  search(query, options = {}) {
    if (!query || query.length < this.config.minQueryLength) {
      return [];
    }

    const searchOptions = { ...this.config, ...options };
    const searchQuery = searchOptions.caseSensitive ? query : query.toLowerCase();
    const results = [];

    for (const item of this.data) {
      const searchText = this._getSearchableText(item);
      const searchTarget = searchOptions.caseSensitive ? searchText : searchText.toLowerCase();
      
      if (searchTarget.includes(searchQuery)) {
        results.push({
          item,
          score: this._calculateScore(searchQuery, searchTarget),
          matches: [{
            key: 'searchText',
            value: searchText,
            indices: [[searchTarget.indexOf(searchQuery), searchTarget.indexOf(searchQuery) + searchQuery.length]]
          }]
        });

        if (results.length >= searchOptions.maxResults) {
          break;
        }
      }
    }

    // Sort by score (higher is better)
    return results.sort((a, b) => b.score - a.score);
  }

  updateData(data) {
    this.data = data || [];
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Extract searchable text from an item
   * @private
   */
  _getSearchableText(item) {
    if (typeof item === 'string') {
      return item;
    }
    
    if (item.id) {
      return item.id;
    }
    
    if (item.name) {
      return item.name;
    }
    
    return String(item);
  }

  /**
   * Calculate search score (0-1, higher is better)
   * @private
   */
  _calculateScore(query, target) {
    const index = target.indexOf(query);
    if (index === 0) {
      return 1.0; // Exact match at start
    } else if (index > 0) {
      return 0.8 - (index / target.length) * 0.3; // Match position affects score
    }
    return 0.5; // Default score
  }
}
