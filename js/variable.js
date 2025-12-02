/**
 * @fileoverview Manages the global variable store, ensuring it is initialized
 * from localStorage via the storage module and handles UI rendering.
 */

// CRITICAL FIX: Explicitly import dependencies from other modules.
import { loadVariableStore, saveVariableStore } from './storage.js'; 

// Initialize the global variable store by loading from storage.
let variableStore = loadVariableStore();
const VARIABLE_LIST_ELEMENT = document.getElementById('variable-list');

// If nothing was loaded, initialize with defaults for user visibility
if (Object.keys(variableStore).length === 0) {
    variableStore = {
        'baseUrl': 'https://api.example.com',
        'userId': '1001'
    };
    // Save defaults immediately only if UI is available, otherwise app.js will handle
    // For now, let's keep the logic simple: if load fails, use defaults.
}

/**
 * Creates the HTML structure for a single key-value variable row.
 * @param {string} key - The variable key (name).
 * @param {string} value - The variable value.
 * @param {boolean} isNew - If true, key input is focused and selected.
 * @returns {string} The HTML string for the variable row.
 */
function createVariableRow(key, value) {
    // Generate a unique ID for the variable row for easier management
    const varId = `var-${key.replace(/[^a-zA-Z0-9]/g, '-')}-${Math.random().toString(36).substring(2, 9)}`;

    return `
        <div class="flex space-x-2 variable-row" data-variable-key="${key}" id="${varId}">
            <input type="text" value="${key}" placeholder="Key (e.g., apiKey)" 
                   class="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm variable-key-input" 
                   onchange="window.app.handleVariableKeyChange(this, '${key}')"
                   onblur="window.app.handleVariableKeyChange(this, '${key}')">
            <input type="text" value="${value}" placeholder="Value" 
                   class="w-2/3 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm variable-value-input"
                   oninput="window.app.handleVariableValueChange(this, '${key}')">
            <button class="remove-variable-btn flex-shrink-0 text-gray-400 hover:text-red-500 transition duration-150 p-2"
                    onclick="window.app.deleteVariable('${key}')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
    `;
}

/**
 * Renders the entire variable store into the UI element.
 */
function renderVariableUI() {
    if (!VARIABLE_LIST_ELEMENT) {
        console.warn('Variable list element not found. Cannot render UI.');
        return;
    }

    // Sort keys alphabetically for stable display
    const keys = Object.keys(variableStore).sort();
    
    // Generate all HTML rows
    const html = keys.map(key => createVariableRow(key, variableStore[key])).join('');
    
    // Inject into the DOM
    VARIABLE_LIST_ELEMENT.innerHTML = html;
}

/**
 * Updates or sets a variable in the global store and persists the change.
 * This function also triggers a UI re-render.
 * @param {string} key - The name of the variable.
 * @param {string} value - The value to assign to the variable.
 * @param {string} oldKey - The original key if a key is being renamed.
 */
function setVariable(key, value, oldKey = null) {
  // If renaming, delete the old key first
  if (oldKey && oldKey !== key) {
      delete variableStore[oldKey];
  }

  // Set the new or updated value
  variableStore[key] = String(value);

  // Persist the updated store to localStorage
  saveVariableStore(variableStore);
  
  // Re-render the UI to reflect changes (e.g., sorting, new key focus)
  renderVariableUI(); 
}

/**
 * Deletes a variable from the global store and persists the change.
 * @param {string} key - The name of the variable to delete.
 */
function deleteVariable(key) {
    if (variableStore.hasOwnProperty(key)) {
        delete variableStore[key];
        saveVariableStore(variableStore);
        renderVariableUI();
    }
}

/**
 * Returns the entire variable store.
 * @return {Object} The current variable store object.
 */
function getVariableStore() {
  return variableStore;
}

/**
 * Public interface for the variables module.
 */
export {
  variableStore, // Export the raw object for external read access (e.g., in request.js)
  setVariable,
  deleteVariable,
  getVariableStore,
  renderVariableUI // Export the render function for app.js to call
};