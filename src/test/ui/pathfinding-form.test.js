/**
 * Tests for the pathfinding form component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PathfindingFormComponent } from '../../ui/pathfinding-form.js';

describe('PathfindingFormComponent', () => {
  let formElement;
  let formComponent;
  let container;

  beforeEach(() => {
    // Create DOM structure
    container = document.createElement('div');
    container.innerHTML = `
      <form id="pathfindingForm">
        <input type="text" id="source" name="source" placeholder="Source node">
        <input type="text" id="target" name="target" placeholder="Target node">
        <button type="submit">Find Path</button>
        <button type="button" id="loadGraphBtn">Load Graph</button>
      </form>
      <div id="result"></div>
    `;
    document.body.appendChild(container);
    
    formElement = container.querySelector('#pathfindingForm');
    formComponent = new PathfindingFormComponent(formElement, {
      useEnhancedSearch: false, // Disable for testing
    });
  });

  afterEach(() => {
    if (formComponent) {
      formComponent.destroy();
    }
    document.body.removeChild(container);
  });

  describe('constructor', () => {
    it('should initialize with form element', () => {
      expect(formComponent.formElement).toBe(formElement);
      expect(formComponent.sourceInput).toBeTruthy();
      expect(formComponent.targetInput).toBeTruthy();
      expect(formComponent.submitButton).toBeTruthy();
    });

    it('should throw error for invalid form element', () => {
      expect(() => new PathfindingFormComponent(null)).toThrow();
      expect(() => new PathfindingFormComponent(document.createElement('div'))).toThrow();
    });

    it('should throw error when required inputs are missing', () => {
      const badForm = document.createElement('form');
      expect(() => new PathfindingFormComponent(badForm)).toThrow('Source and target input elements are required');
    });
  });

  describe('form data management', () => {
    it('should get form data correctly', () => {
      formComponent.sourceInput.value = 'wp_001';
      formComponent.targetInput.value = 'di_27_18_top';
      
      const data = formComponent.getFormData();
      expect(data).toEqual({
        source: 'wp_001',
        target: 'di_27_18_top',
      });
    });

    it('should set example data', () => {
      formComponent.setExample('source_node', 'target_node');
      
      expect(formComponent.sourceInput.value).toBe('source_node');
      expect(formComponent.targetInput.value).toBe('target_node');
    });

    it('should clear form', () => {
      formComponent.sourceInput.value = 'test';
      formComponent.targetInput.value = 'test';
      
      formComponent.clearForm();
      
      expect(formComponent.sourceInput.value).toBe('');
      expect(formComponent.targetInput.value).toBe('');
    });
  });

  describe('autocomplete data management', () => {
    it('should set autocomplete data', () => {
      const nodes = ['wp_001', 'di_27_18_top'];
      const nodeTypes = new Map([
        ['wp_001', 'waypoint'],
        ['di_27_18_top', 'di_box'],
      ]);

      formComponent.setAutocompleteData(nodes, nodeTypes);
      
      // Should not throw and should update internal state
      expect(formComponent.sourceAutocomplete).toBeTruthy();
      expect(formComponent.targetAutocomplete).toBeTruthy();
    });
  });

  describe('loading and result display', () => {
    it('should show loading state', () => {
      formComponent.showLoading('Loading...');
      
      const resultContainer = document.getElementById('result');
      expect(resultContainer.innerHTML).toContain('Loading...');
      expect(resultContainer.className).toContain('loading');
    });

    it('should show result with success type', () => {
      formComponent.showResult('<p>Success!</p>', 'success');
      
      const resultContainer = document.getElementById('result');
      expect(resultContainer.innerHTML).toContain('Success!');
      expect(resultContainer.className).toContain('success');
    });

    it('should show result with error type', () => {
      formComponent.showResult('<p>Error!</p>', 'error');
      
      const resultContainer = document.getElementById('result');
      expect(resultContainer.innerHTML).toContain('Error!');
      expect(resultContainer.className).toContain('error');
    });

    it('should clear results', () => {
      formComponent.showResult('<p>Test</p>', 'success');
      formComponent.clearResults();
      
      const resultContainer = document.getElementById('result');
      expect(resultContainer.innerHTML).toBe('');
      expect(resultContainer.className).toBe('');
    });
  });

  describe('graph loading state', () => {
    it('should set graph loaded state', () => {
      formComponent.setGraphLoaded(true);
      expect(formComponent.graphLoaded).toBe(true);
      expect(formComponent.submitButton.disabled).toBe(false);
    });

    it('should disable submit when graph not loaded', () => {
      formComponent.setGraphLoaded(false);
      expect(formComponent.graphLoaded).toBe(false);
      expect(formComponent.submitButton.disabled).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should emit pathfinding submit event', async () => {
      let eventDetail = null;
      formElement.addEventListener('pathfinding:submit', (e) => {
        eventDetail = e.detail;
      });

      formComponent.sourceInput.value = 'wp_001';
      formComponent.targetInput.value = 'di_27_18_top';
      formComponent.setGraphLoaded(true);

      // Simulate form submission
      const submitEvent = new Event('submit');
      formElement.dispatchEvent(submitEvent);

      expect(eventDetail).toEqual({
        source: 'wp_001',
        target: 'di_27_18_top',
      });
    });

    it('should emit load graph event', () => {
      let eventFired = false;
      formElement.addEventListener('pathfinding:load-graph', () => {
        eventFired = true;
      });

      const loadButton = formElement.querySelector('#loadGraphBtn');
      loadButton.click();

      expect(eventFired).toBe(true);
    });

    it('should validate form before submission', () => {
      let eventFired = false;
      formElement.addEventListener('pathfinding:submit', () => {
        eventFired = true;
      });

      formComponent.setGraphLoaded(true);
      // Leave inputs empty

      const submitEvent = new Event('submit');
      formElement.dispatchEvent(submitEvent);

      expect(eventFired).toBe(false); // Should not fire with empty inputs
    });
  });

  describe('keyboard shortcuts', () => {
    it('should handle Ctrl+Enter shortcut', () => {
      let eventFired = false;
      formElement.addEventListener('pathfinding:submit', () => {
        eventFired = true;
      });

      formComponent.sourceInput.value = 'wp_001';
      formComponent.targetInput.value = 'di_27_18_top';
      formComponent.setGraphLoaded(true);

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
      });
      document.dispatchEvent(keyEvent);

      expect(eventFired).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clean up properly', () => {
      const sourceAutocomplete = formComponent.sourceAutocomplete;
      const targetAutocomplete = formComponent.targetAutocomplete;

      formComponent.destroy();

      // Should clean up autocomplete components
      expect(formComponent.sourceAutocomplete).toBeNull();
      expect(formComponent.targetAutocomplete).toBeNull();
    });
  });
});
