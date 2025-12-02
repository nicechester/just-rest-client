/**
 * @fileoverview Manages the global variable store, ensuring it is initialized
 * from localStorage via the storage module.
 */

// CRITICAL FIX: Explicitly import dependencies from other modules.
import { loadVariableStore, saveVariableStore } from './storage.js'; 

// Initialize the global variable store by loading from storage.
let variableStore = loadVariableStore();

// If nothing was loaded, initialize with defaults for user visibility
if (Object.keys(variableStore).length === 0) {
    variableStore = {
        'baseUrl': 'https://api.example.com',
        'userId': '1001'
    };
    saveVariableStore(variableStore); // Save defaults immediately
}

/**
 * Updates or sets a variable in the global store and persists the change.
 * @param {string} key - The name of the variable.
 * @param {string} value - The value to assign to the variable.
 */
function setVariable(key, value) {
  // Ensure the value is stringified for complex types if necessary, though 
  // typical API variables are usually strings.
  variableStore[key] = String(value);

  // Persist the updated store to localStorage
  saveVariableStore(variableStore);
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
  getVariableStore
};