/**
 * Tests for the autocomplete UI component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AutocompleteComponent } from '../../ui/autocomplete.js';

describe('AutocompleteComponent', () => {
  let inputElement;
  let autocomplete;
  let container;

  beforeEach(() => {
    // Create DOM elements
    container = document.createElement('div');
    inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.id = 'test-input';
    container.appendChild(inputElement);
    document.body.appendChild(container);

    // Create autocomplete instance
    autocomplete = new AutocompleteComponent(inputElement);
  });

  afterEach(() => {
    if (autocomplete) {
      autocomplete.destroy();
    }
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should initialize with input element', () => {
      expect(autocomplete.inputElement).toBe(inputElement);
      expect(autocomplete.nodes).toEqual([]);
      expect(autocomplete.isOpen).toBe(false);
    });

    it('should throw error for invalid input element', () => {
      expect(() => new AutocompleteComponent(null)).toThrow();
      expect(() => new AutocompleteComponent(document.createElement('div'))).toThrow();
    });

    it('should set up input attributes', () => {
      expect(inputElement.autocomplete).toBe('off');
      expect(inputElement.getAttribute('role')).toBe('combobox');
      expect(inputElement.getAttribute('aria-expanded')).toBe('false');
      expect(inputElement.getAttribute('aria-autocomplete')).toBe('list');
    });

    it('should create wrapper element', () => {
      const wrapper = inputElement.parentElement;
      expect(wrapper.className).toBe('autocomplete-wrapper');
      expect(wrapper.style.position).toBe('relative');
    });

    it('should apply custom options', () => {
      const customInput = document.createElement('input');
      container.appendChild(customInput);
      
      const customAutocomplete = new AutocompleteComponent(customInput, {
        placeholder: 'Custom placeholder',
        maxSuggestions: 10,
      });

      expect(customInput.placeholder).toBe('Custom placeholder');
      expect(customAutocomplete.options.maxSuggestions).toBe(10);
      
      customAutocomplete.destroy();
    });
  });

  describe('setNodes', () => {
    it('should set nodes and node types', () => {
      const nodes = ['wp_001', 'di_27_18_top', 'col_1_cab_01'];
      const nodeTypes = new Map([
        ['wp_001', 'waypoint'],
        ['di_27_18_top', 'di_box'],
        ['col_1_cab_01', 'cabinet'],
      ]);

      autocomplete.setNodes(nodes, nodeTypes);

      expect(autocomplete.nodes).toEqual(nodes.sort());
      expect(autocomplete.nodeTypes).toBe(nodeTypes);
    });

    it('should handle empty nodes array', () => {
      autocomplete.setNodes([]);
      expect(autocomplete.nodes).toEqual([]);
    });

    it('should handle invalid input gracefully', () => {
      autocomplete.setNodes(null);
      expect(autocomplete.nodes).toEqual([]);
      
      autocomplete.setNodes('not-an-array');
      expect(autocomplete.nodes).toEqual([]);
    });
  });

  describe('getValue and setValue', () => {
    it('should get and set input value', () => {
      autocomplete.setValue('test-value');
      expect(autocomplete.getValue()).toBe('test-value');
      expect(inputElement.value).toBe('test-value');
    });

    it('should trim whitespace when getting value', () => {
      inputElement.value = '  test-value  ';
      expect(autocomplete.getValue()).toBe('test-value');
    });

    it('should handle null/undefined values', () => {
      autocomplete.setValue(null);
      expect(autocomplete.getValue()).toBe('');
      
      autocomplete.setValue(undefined);
      expect(autocomplete.getValue()).toBe('');
    });
  });

  describe('clear', () => {
    it('should clear the input value', () => {
      autocomplete.setValue('test-value');
      autocomplete.clear();
      expect(autocomplete.getValue()).toBe('');
    });
  });

  describe('focus', () => {
    it('should focus the input element', () => {
      const focusSpy = vi.spyOn(inputElement, 'focus');
      autocomplete.focus();
      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('suggestions functionality', () => {
    beforeEach(() => {
      const nodes = ['wp_001', 'wp_002', 'di_27_18_top', 'col_1_cab_01', 'fossil_excavation_1'];
      const nodeTypes = new Map([
        ['wp_001', 'waypoint'],
        ['wp_002', 'waypoint'],
        ['di_27_18_top', 'di_box'],
        ['col_1_cab_01', 'cabinet'],
        ['fossil_excavation_1', 'fossil'],
      ]);
      autocomplete.setNodes(nodes, nodeTypes);
    });

    it('should show suggestions on input', async () => {
      // Simulate typing
      inputElement.value = 'wp';
      inputElement.dispatchEvent(new Event('input'));

      // Wait for suggestions to render
      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      expect(suggestions).toBeTruthy();
      expect(suggestions.children.length).toBe(2); // wp_001, wp_002
    });

    it('should filter suggestions based on query', async () => {
      inputElement.value = 'di_';
      inputElement.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      expect(suggestions.children.length).toBe(1);
      expect(suggestions.children[0].textContent).toContain('di_27_18_top');
    });

    it('should show no results message when no matches', async () => {
      inputElement.value = 'nonexistent';
      inputElement.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      expect(suggestions.textContent).toContain('No matches found');
    });

    it('should hide suggestions when input is too short', async () => {
      autocomplete.options.minQueryLength = 2;
      inputElement.value = 'w';
      inputElement.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      expect(suggestions).toBeNull();
    });

    it('should limit number of suggestions', async () => {
      autocomplete.options.maxSuggestions = 2;
      inputElement.value = ''; // This should match all nodes
      
      // Set a value that matches multiple nodes
      inputElement.value = 'w'; // matches wp_001, wp_002
      inputElement.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      expect(suggestions.children.length).toBeLessThanOrEqual(2);
    });
  });

  describe('keyboard navigation', () => {
    beforeEach(async () => {
      const nodes = ['wp_001', 'wp_002', 'wp_003'];
      autocomplete.setNodes(nodes);
      
      // Show suggestions
      inputElement.value = 'wp';
      inputElement.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should navigate with arrow keys', async () => {
      const suggestions = document.querySelector('.autocomplete-suggestions');
      const items = suggestions.children;

      // Arrow down
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      inputElement.dispatchEvent(downEvent);
      expect(items[0].classList.contains('autocomplete-active')).toBe(true);

      // Arrow down again
      inputElement.dispatchEvent(downEvent);
      expect(items[1].classList.contains('autocomplete-active')).toBe(true);

      // Arrow up
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      inputElement.dispatchEvent(upEvent);
      expect(items[0].classList.contains('autocomplete-active')).toBe(true);
    });

    it('should select suggestion with Enter key', async () => {
      // Navigate to first item
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      inputElement.dispatchEvent(downEvent);

      // Press Enter
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      inputElement.dispatchEvent(enterEvent);

      expect(autocomplete.getValue()).toBe('wp_001');
      expect(document.querySelector('.autocomplete-suggestions')).toBeNull();
    });

    it('should close suggestions with Escape key', async () => {
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      inputElement.dispatchEvent(escapeEvent);

      expect(document.querySelector('.autocomplete-suggestions')).toBeNull();
    });
  });

  describe('mouse interactions', () => {
    beforeEach(async () => {
      const nodes = ['wp_001', 'wp_002'];
      autocomplete.setNodes(nodes);
      
      inputElement.value = 'wp';
      inputElement.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    it('should select suggestion on click', async () => {
      const suggestions = document.querySelector('.autocomplete-suggestions');
      const firstItem = suggestions.children[0];

      firstItem.click();

      expect(autocomplete.getValue()).toBe('wp_001');
      expect(document.querySelector('.autocomplete-suggestions')).toBeNull();
    });

    it('should update focus on mouse enter', async () => {
      const suggestions = document.querySelector('.autocomplete-suggestions');
      const secondItem = suggestions.children[1];

      secondItem.dispatchEvent(new Event('mouseenter'));

      expect(secondItem.classList.contains('autocomplete-active')).toBe(true);
    });
  });

  describe('events', () => {
    it('should dispatch custom event on selection', async () => {
      const nodes = ['wp_001'];
      const nodeTypes = new Map([['wp_001', 'waypoint']]);
      autocomplete.setNodes(nodes, nodeTypes);

      let eventDetail = null;
      inputElement.addEventListener('autocomplete:select', (e) => {
        eventDetail = e.detail;
      });

      inputElement.value = 'wp';
      inputElement.dispatchEvent(new Event('input'));
      await new Promise(resolve => setTimeout(resolve, 0));

      const suggestions = document.querySelector('.autocomplete-suggestions');
      suggestions.children[0].click();

      expect(eventDetail).toEqual({
        nodeId: 'wp_001',
        nodeType: 'waypoint',
      });
    });
  });

  describe('destroy', () => {
    it('should clean up properly', () => {
      const wrapper = inputElement.parentElement;
      autocomplete.destroy();

      // Should unwrap input element
      expect(inputElement.parentElement).not.toBe(wrapper);
      expect(document.body.contains(wrapper)).toBe(false);
      
      // Should hide suggestions
      expect(document.querySelector('.autocomplete-suggestions')).toBeNull();
    });
  });
});
