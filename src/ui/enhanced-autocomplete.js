/**
 * Enhanced Autocomplete Component with Search Integration
 * 
 * Extends the basic autocomplete with pluggable search providers
 */

import { createSearchProvider } from '../search/fuse-search-provider.js';
import { GeoJSONDataLoader } from '../search/geojson-data-loader.js';

/**
 * Enhanced autocomplete component with search integration
 */
export class EnhancedAutocompleteComponent {
  constructor(inputElement, options = {}) {
    if (!(inputElement instanceof HTMLInputElement)) {
      throw new Error('Input element must be an HTMLInputElement');
    }

    this.inputElement = inputElement;
    this.options = {
      // Search options
      searchProvider: 'fuse', // 'fuse' or 'simple'
      searchConfig: {
        threshold: 0.4,
        maxResults: 50,
        minQueryLength: 2,
      },
      
      // Data loading options
      dataUrls: [],
      dataLoaderPreset: 'wayfinding',
      
      // UI options
      placeholder: 'Start typing to search...',
      highlightMatches: true,
      showNodeTypes: true,
      showScores: false, // For debugging
      
      // Behavior options
      caseSensitive: false,
      autoSelectFirst: false,
      clearOnSelect: false,
      
      ...options,
    };

    // Component state
    this.searchProvider = null;
    this.dataLoader = null;
    this.searchData = [];
    this.isOpen = false;
    this.currentFocus = -1;
    this.suggestionsList = null;
    this.isInitialized = false;

    this._initializeComponent();
  }

  /**
   * Initialize the enhanced autocomplete component
   * @private
   */
  async _initializeComponent() {
    try {
      // Set up input element
      this._setupInputElement();
      
      // Create wrapper for positioning
      this._createWrapper();
      
      // Initialize search provider
      await this._initializeSearchProvider();
      
      // Initialize data loader
      this._initializeDataLoader();
      
      // Load initial data if URLs provided
      if (this.options.dataUrls.length > 0) {
        await this.loadData(this.options.dataUrls);
      }
      
      // Bind event listeners
      this._bindEventListeners();
      
      this.isInitialized = true;
      
      // Dispatch ready event
      this.inputElement.dispatchEvent(new CustomEvent('enhanced-autocomplete:ready', {
        detail: { component: this }
      }));
      
    } catch (error) {
      console.error('Failed to initialize enhanced autocomplete:', error);
      this.inputElement.dispatchEvent(new CustomEvent('enhanced-autocomplete:error', {
        detail: { error: error.message }
      }));
    }
  }

  /**
   * Set up the input element
   * @private
   */
  _setupInputElement() {
    this.inputElement.autocomplete = 'off';
    this.inputElement.setAttribute('role', 'combobox');
    this.inputElement.setAttribute('aria-expanded', 'false');
    this.inputElement.setAttribute('aria-autocomplete', 'list');
    
    if (this.options.placeholder) {
      this.inputElement.placeholder = this.options.placeholder;
    }
  }

  /**
   * Create wrapper element for positioning
   * @private
   */
  _createWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'enhanced-autocomplete-wrapper';
    wrapper.style.cssText = 'position: relative; display: inline-block; width: 100%;';

    // Wrap the input element
    this.inputElement.parentNode.insertBefore(wrapper, this.inputElement);
    wrapper.appendChild(this.inputElement);

    this.wrapper = wrapper;
  }

  /**
   * Initialize the search provider
   * @private
   */
  async _initializeSearchProvider() {
    this.searchProvider = await createSearchProvider(this.options.searchProvider);
    await this.searchProvider.initialize([], this.options.searchConfig);
  }

  /**
   * Initialize the data loader
   * @private
   */
  _initializeDataLoader() {
    this.dataLoader = GeoJSONDataLoader.createPreset(this.options.dataLoaderPreset);
  }

  /**
   * Load data from URLs
   * @param {Array<string>} urls - Array of GeoJSON URLs
   */
  async loadData(urls) {
    try {
      this.searchData = await this.dataLoader.loadFromUrls(urls);
      this.searchProvider.updateData(this.searchData);
      
      this.inputElement.dispatchEvent(new CustomEvent('enhanced-autocomplete:data-loaded', {
        detail: { 
          count: this.searchData.length,
          data: this.searchData 
        }
      }));
      
    } catch (error) {
      console.error('Failed to load search data:', error);
      this.inputElement.dispatchEvent(new CustomEvent('enhanced-autocomplete:data-error', {
        detail: { error: error.message }
      }));
    }
  }

  /**
   * Set search data directly
   * @param {Array} data - Search data
   */
  setData(data) {
    this.searchData = data || [];
    if (this.searchProvider) {
      this.searchProvider.updateData(this.searchData);
    }
  }

  /**
   * Bind event listeners
   * @private
   */
  _bindEventListeners() {
    // Input event for real-time search
    this.inputElement.addEventListener('input', (e) => {
      this._handleInput(e);
    });

    // Keydown for navigation
    this.inputElement.addEventListener('keydown', (e) => {
      this._handleKeydown(e);
    });

    // Focus and blur events
    this.inputElement.addEventListener('focus', () => {
      if (this.inputElement.value.length >= this.options.searchConfig.minQueryLength) {
        this._showSuggestions();
      }
    });

    this.inputElement.addEventListener('blur', (e) => {
      // Delay hiding to allow for suggestion clicks
      setTimeout(() => {
        this._hideSuggestions();
      }, 150);
    });

    // Global click handler to close suggestions
    document.addEventListener('click', (e) => {
      if (!this.wrapper.contains(e.target)) {
        this._hideSuggestions();
      }
    });
  }

  /**
   * Handle input changes
   * @private
   */
  _handleInput(e) {
    const query = e.target.value.trim();
    
    if (query.length < this.options.searchConfig.minQueryLength) {
      this._hideSuggestions();
      return;
    }

    this._showSuggestions(query);
  }

  /**
   * Handle keyboard navigation
   * @private
   */
  _handleKeydown(e) {
    if (!this.isOpen || !this.suggestionsList) return;

    const items = this.suggestionsList.querySelectorAll('.autocomplete-item');
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.currentFocus = Math.min(this.currentFocus + 1, items.length - 1);
        this._updateFocus(items);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        this.currentFocus = Math.max(this.currentFocus - 1, -1);
        this._updateFocus(items);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (this.currentFocus >= 0 && items[this.currentFocus]) {
          this._selectSuggestion(items[this.currentFocus]);
        } else if (this.options.autoSelectFirst && items.length > 0) {
          this._selectSuggestion(items[0]);
        }
        break;
        
      case 'Escape':
        this._hideSuggestions();
        break;
    }
  }

  /**
   * Show suggestions based on query
   * @private
   */
  _showSuggestions(query = '') {
    if (!this.searchProvider || !query) {
      this._showNoResults();
      return;
    }

    const results = this.searchProvider.search(query, this.options.searchConfig);
    
    if (results.length === 0) {
      this._showNoResults();
      return;
    }

    this._renderSuggestions(results, query);
    this._setAriaAttributes(true);
    this.isOpen = true;
  }

  /**
   * Hide suggestions
   * @private
   */
  _hideSuggestions() {
    if (this.suggestionsList) {
      this.suggestionsList.remove();
      this.suggestionsList = null;
    }
    
    this._setAriaAttributes(false);
    this.isOpen = false;
    this.currentFocus = -1;
  }

  /**
   * Render suggestions list
   * @private
   */
  _renderSuggestions(results, query) {
    console.log('🎨 Rendering suggestions:', results.length, 'results for query:', query);
    
    this._hideSuggestions();

    const list = document.createElement('div');
    list.className = 'enhanced-autocomplete-suggestions';
    list.setAttribute('role', 'listbox');
    
    // Apply styles
    this._applySuggestionStyles(list);

    results.forEach((result, index) => {
      const item = this._createSuggestionItem(result, query, index);
      list.appendChild(item);
      console.log(`  📝 Added item ${index + 1}:`, result.item.id);
    });

    this.wrapper.appendChild(list);
    this.suggestionsList = list;
    
    console.log('✅ Suggestions list appended to wrapper, total items:', list.children.length);
  }

  /**
   * Apply styles to suggestion list
   * @private
   */
  _applySuggestionStyles(list) {
    list.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 300px;
      overflow-y: auto;
      background-color: white;
      border: 1px solid #ddd;
      border-top: none;
      border-radius: 0 0 5px 5px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
    `;
  }

  /**
   * Create a suggestion item element
   * @private
   */
  _createSuggestionItem(result, query, index) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-item-id', result.item.id);
    
    // Apply styles
    item.style.cssText = `
      padding: 12px 15px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 14px;
      line-height: 1.4;
    `;

    // Always prefer the human-readable name over the ID
    let displayText = result.item.name || result.item.alt_name || result.item.id || 'Unknown ID';
    let matchedField = 'name';
    
    // If we have matches, try to use the best human-readable match
    if (result.matches && result.matches.length > 0) {
      // Prioritize name and alternativeNames matches over ID matches
      const nameMatch = result.matches.find(m => m.key === 'name' && m.value);
      const altNameMatch = result.matches.find(m => m.key === 'alternativeNames' && m.value);
      const idMatch = result.matches.find(m => m.key === 'alt_name' && m.value);
      
      if (nameMatch) {
        displayText = nameMatch.value;
        matchedField = 'name';
      } else if (altNameMatch) {
        displayText = altNameMatch.value;
        matchedField = 'alternativeNames';
      } else if (idMatch) {
        displayText = idMatch.value;
        matchedField = 'alt_name';
      }
    }
    
    // Always ensure we show a human-readable name, not just an ID
    if (displayText === result.item.id && result.item.name) {
      displayText = result.item.name;
    }

    // Create content with highlighting
    let content = displayText;
    if (this.options.highlightMatches && result.matches) {
      const matchForField = result.matches.find(m => m.key === matchedField);
      if (matchForField && matchForField.indices && this.searchProvider.highlightMatches) {
        try {
          content = this.searchProvider.highlightMatches(displayText, matchForField.indices);
        } catch (error) {
          console.warn('Highlighting failed:', error);
          content = displayText; // Fallback to plain text
        }
      }
    }

    // Main content
    const mainDiv = document.createElement('div');
    mainDiv.innerHTML = content;
    mainDiv.style.fontWeight = '500';
    item.appendChild(mainDiv);

    // Secondary info
    const secondaryDiv = document.createElement('div');
    secondaryDiv.style.cssText = 'font-size: 12px; color: #666; margin-top: 2px;';
    
    const parts = [];
    
    // Always show the ID if it's different from the display text
    if (result.item.id && result.item.id !== displayText) {
      parts.push(`ID: ${result.item.id}`);
    }
    
    // Show type/category info
    if (result.item.type && result.item.type !== 'fixture') {
      parts.push(`Type: ${result.item.type}`);
    }
    if (result.item.category) {
      parts.push(`Category: ${result.item.category}`);
    }
    
    // Show alternative name if we're displaying the main name
    if (displayText === result.item.name && result.item.alt_name && result.item.alt_name !== result.item.name) {
      parts.push(`Alt: ${result.item.alt_name}`);
    }
    
    if (this.options.showScores) {
      parts.push(`Score: ${result.score.toFixed(3)}`);
    }
    
    // Only show secondary info if we have any
    if (parts.length > 0) {
      secondaryDiv.textContent = parts.join(' | ');
      item.appendChild(secondaryDiv);
    }

    // Event listeners
    item.addEventListener('click', () => {
      this._selectSuggestion(item);
    });

    item.addEventListener('mouseenter', () => {
      this.currentFocus = index;
      this._updateFocus();
    });

    // Store result data
    item._resultData = result;

    return item;
  }

  /**
   * Show no results message
   * @private
   */
  _showNoResults() {
    this._hideSuggestions();

    const list = document.createElement('div');
    list.className = 'enhanced-autocomplete-suggestions';
    this._applySuggestionStyles(list);
    
    list.innerHTML = `
      <div style="padding: 12px 15px; font-size: 14px; color: #666; font-style: italic;">
        No matches found
      </div>
    `;
    
    this.wrapper.appendChild(list);
    this.suggestionsList = list;
    this.isOpen = true;
  }

  /**
   * Select a suggestion
   * @private
   */
  _selectSuggestion(item) {
    const itemId = item.getAttribute('data-item-id');
    const resultData = item._resultData;
    
    this.setValue(itemId);
    
    // Dispatch custom event
    this.inputElement.dispatchEvent(new CustomEvent('enhanced-autocomplete:select', {
      detail: {
        id: itemId,
        result: resultData,
        item: resultData?.item
      },
    }));

    if (this.options.clearOnSelect) {
      this.clear();
    }
  }

  /**
   * Update focus styling
   * @private
   */
  _updateFocus(items = null) {
    if (!items) {
      items = this.suggestionsList?.querySelectorAll('.autocomplete-item') || [];
    }

    items.forEach((item, index) => {
      if (index === this.currentFocus) {
        item.style.backgroundColor = '#e3f2fd';
        item.setAttribute('aria-selected', 'true');
      } else {
        item.style.backgroundColor = '';
        item.setAttribute('aria-selected', 'false');
      }
    });
  }

  /**
   * Set ARIA attributes
   * @private
   */
  _setAriaAttributes(expanded) {
    this.inputElement.setAttribute('aria-expanded', expanded.toString());
    
    if (expanded && this.suggestionsList) {
      const listId = `enhanced-autocomplete-list-${Date.now()}`;
      this.suggestionsList.id = listId;
      this.inputElement.setAttribute('aria-owns', listId);
    } else {
      this.inputElement.removeAttribute('aria-owns');
    }
  }

  /**
   * Get the current input value
   * @returns {string} Current input value
   */
  getValue() {
    return this.inputElement.value.trim();
  }

  /**
   * Set the input value
   * @param {string} value - Value to set
   */
  setValue(value) {
    this.inputElement.value = value || '';
    this._hideSuggestions();
  }

  /**
   * Clear the input
   */
  clear() {
    this.setValue('');
  }

  /**
   * Focus the input element
   */
  focus() {
    this.inputElement.focus();
  }

  /**
   * Update search configuration
   * @param {Object} config - New search configuration
   */
  updateSearchConfig(config) {
    this.options.searchConfig = { ...this.options.searchConfig, ...config };
    if (this.searchProvider) {
      this.searchProvider.updateConfig(this.options.searchConfig);
    }
  }

  /**
   * Get search statistics
   * @returns {Object} Search statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      dataCount: this.searchData.length,
      searchProvider: this.options.searchProvider,
      isOpen: this.isOpen
    };
  }

  /**
   * Destroy the component
   */
  destroy() {
    this._hideSuggestions();
    
    if (this.searchProvider) {
      this.searchProvider.destroy();
    }
    
    // Unwrap the input element
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.insertBefore(this.inputElement, this.wrapper);
      this.wrapper.remove();
    }
  }
}
