/**
 * Autocomplete UI Component
 * 
 * Provides intelligent autocomplete functionality for node selection
 */

/**
 * Autocomplete component for node selection
 */
export class AutocompleteComponent {
  constructor(inputElement, options = {}) {
    if (!(inputElement instanceof HTMLInputElement)) {
      throw new Error('Input element must be an HTMLInputElement');
    }

    this.inputElement = inputElement;
    this.options = {
      maxSuggestions: 50,
      minQueryLength: 1,
      placeholder: 'Start typing to search...',
      highlightMatches: true,
      showNodeTypes: true,
      caseSensitive: false,
      ...options,
    };

    this.nodes = [];
    this.nodeTypes = new Map();
    this.isOpen = false;
    this.currentFocus = -1;
    this.suggestionsList = null;

    this._initializeComponent();
  }

  /**
   * Initialize the autocomplete component
   * @private
   */
  _initializeComponent() {
    // Set up input element
    this.inputElement.autocomplete = 'off';
    this.inputElement.setAttribute('role', 'combobox');
    this.inputElement.setAttribute('aria-expanded', 'false');
    this.inputElement.setAttribute('aria-autocomplete', 'list');
    
    if (this.options.placeholder) {
      this.inputElement.placeholder = this.options.placeholder;
    }

    // Create wrapper for positioning
    this._createWrapper();

    // Bind event listeners
    this._bindEventListeners();
  }

  /**
   * Create wrapper element for positioning
   * @private
   */
  _createWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'autocomplete-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';
    wrapper.style.width = '100%';

    // Wrap the input element
    this.inputElement.parentNode.insertBefore(wrapper, this.inputElement);
    wrapper.appendChild(this.inputElement);

    this.wrapper = wrapper;
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
      if (this.inputElement.value.length >= this.options.minQueryLength) {
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
   * Set the available nodes for autocomplete
   * @param {Array<string>} nodes - Array of node IDs
   * @param {Map<string, string>} nodeTypes - Map of node types
   */
  setNodes(nodes, nodeTypes = new Map()) {
    this.nodes = Array.isArray(nodes) ? [...nodes].sort() : [];
    this.nodeTypes = nodeTypes;
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
   * Handle input changes
   * @private
   */
  _handleInput(e) {
    const query = e.target.value.trim();
    
    if (query.length < this.options.minQueryLength) {
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
    const suggestions = this._getSuggestions(query);
    
    if (suggestions.length === 0) {
      this._showNoResults();
      return;
    }

    this._renderSuggestions(suggestions);
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
   * Get filtered suggestions based on query
   * @private
   */
  _getSuggestions(query) {
    if (!query) return [];

    const searchQuery = this.options.caseSensitive ? query : query.toLowerCase();
    const suggestions = [];

    for (const nodeId of this.nodes) {
      const searchTarget = this.options.caseSensitive ? nodeId : nodeId.toLowerCase();
      
      if (searchTarget.includes(searchQuery)) {
        const nodeType = this.nodeTypes.get(nodeId) || 'unknown';
        suggestions.push({
          id: nodeId,
          type: nodeType,
          matchIndex: searchTarget.indexOf(searchQuery),
        });

        if (suggestions.length >= this.options.maxSuggestions) {
          break;
        }
      }
    }

    // Sort by match position (exact matches first, then by position)
    return suggestions.sort((a, b) => {
      if (a.matchIndex !== b.matchIndex) {
        return a.matchIndex - b.matchIndex;
      }
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * Render suggestions list
   * @private
   */
  _renderSuggestions(suggestions) {
    this._hideSuggestions();

    const list = document.createElement('div');
    list.className = 'autocomplete-suggestions';
    list.setAttribute('role', 'listbox');
    
    // Apply styles
    Object.assign(list.style, {
      position: 'absolute',
      top: '100%',
      left: '0',
      right: '0',
      maxHeight: '200px',
      overflowY: 'auto',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderTop: 'none',
      borderRadius: '0 0 4px 4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: '1000',
    });

    suggestions.forEach((suggestion, index) => {
      const item = this._createSuggestionItem(suggestion, index);
      list.appendChild(item);
    });

    this.wrapper.appendChild(list);
    this.suggestionsList = list;
  }

  /**
   * Create a suggestion item element
   * @private
   */
  _createSuggestionItem(suggestion, index) {
    const item = document.createElement('div');
    item.className = 'autocomplete-item';
    item.setAttribute('role', 'option');
    item.setAttribute('data-node-id', suggestion.id);
    
    // Apply styles
    Object.assign(item.style, {
      padding: '10px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #eee',
      fontSize: '14px',
    });

    // Create content
    let content = suggestion.id;
    
    if (this.options.highlightMatches) {
      const query = this.inputElement.value.trim();
      const queryLower = this.options.caseSensitive ? query : query.toLowerCase();
      const idLower = this.options.caseSensitive ? suggestion.id : suggestion.id.toLowerCase();
      const matchIndex = idLower.indexOf(queryLower);
      
      if (matchIndex >= 0) {
        const beforeMatch = suggestion.id.substring(0, matchIndex);
        const match = suggestion.id.substring(matchIndex, matchIndex + query.length);
        const afterMatch = suggestion.id.substring(matchIndex + query.length);
        
        content = `${beforeMatch}<strong>${match}</strong>${afterMatch}`;
      }
    }

    item.innerHTML = content;

    // Add type badge if enabled
    if (this.options.showNodeTypes && suggestion.type !== 'unknown') {
      const typeBadge = document.createElement('span');
      typeBadge.className = 'node-type-badge';
      typeBadge.textContent = suggestion.type.replace('_', ' ');
      
      Object.assign(typeBadge.style, {
        marginLeft: '8px',
        fontSize: '12px',
        color: this._getTypeColor(suggestion.type),
        fontStyle: 'italic',
      });
      
      item.appendChild(typeBadge);
    }

    // Event listeners
    item.addEventListener('click', () => {
      this._selectSuggestion(item);
    });

    item.addEventListener('mouseenter', () => {
      this.currentFocus = index;
      this._updateFocus();
    });

    return item;
  }

  /**
   * Show no results message
   * @private
   */
  _showNoResults() {
    this._hideSuggestions();

    const list = document.createElement('div');
    list.className = 'autocomplete-suggestions';
    
    Object.assign(list.style, {
      position: 'absolute',
      top: '100%',
      left: '0',
      right: '0',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderTop: 'none',
      borderRadius: '0 0 4px 4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: '1000',
      padding: '10px 12px',
      fontSize: '14px',
      color: '#666',
      fontStyle: 'italic',
    });

    list.textContent = 'No matches found';
    
    this.wrapper.appendChild(list);
    this.suggestionsList = list;
    this.isOpen = true;
  }

  /**
   * Select a suggestion
   * @private
   */
  _selectSuggestion(item) {
    const nodeId = item.getAttribute('data-node-id');
    this.setValue(nodeId);
    
    // Dispatch custom event
    this.inputElement.dispatchEvent(new CustomEvent('autocomplete:select', {
      detail: {
        nodeId,
        nodeType: this.nodeTypes.get(nodeId),
      },
    }));
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
      const listId = `autocomplete-list-${Date.now()}`;
      this.suggestionsList.id = listId;
      this.inputElement.setAttribute('aria-owns', listId);
    } else {
      this.inputElement.removeAttribute('aria-owns');
    }
  }

  /**
   * Get color for node type
   * @private
   */
  _getTypeColor(type) {
    const colors = {
      waypoint: '#1565c0',
      di_box: '#ef6c00',
      cabinet: '#7b1fa2',
      fossil: '#2e7d32',
    };
    return colors[type] || '#666';
  }

  /**
   * Destroy the component
   */
  destroy() {
    this._hideSuggestions();
    
    // Remove event listeners
    this.inputElement.removeEventListener('input', this._handleInput);
    this.inputElement.removeEventListener('keydown', this._handleKeydown);
    
    // Unwrap the input element
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.insertBefore(this.inputElement, this.wrapper);
      this.wrapper.remove();
    }
  }
}
