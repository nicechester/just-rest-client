/**
 * @fileoverview Manages the global variable store, ensuring it is initialized
 * from localStorage via the storage module.
 */

// The variableStore object holds the key/value pairs
let variableStore = {};

/**
 * Initializes the variable store from storage.
 * @param {function} loadVariableStoreFn - Function to load store from persistence.
 * @param {function} saveVariableStoreFn - Function to save store to persistence.
 */
function loadInitialVariables(loadVariableStoreFn) {
  if (typeof loadVariableStoreFn === 'function') {
    variableStore = loadVariableStoreFn();
  } else {
    // Default variables if storage module is not available (for fallback)
    variableStore = {
      'baseUrl': 'https://api.example.com',
      'userId': '1001'
    };
  }
}

/**
 * Updates or sets a variable in the global store and persists the change.
 * NOTE: Assumes saveVariableStoreFn is available when called from the main app.
 * @param {string} key - The name of the variable.
 * @param {string} value - The value to assign to the variable.
 */
function setVariable(key, value) {
  // We assume the saveVariableStore function is passed/available globally
  // by the main application controller (app.js)
  
  // Ensure the value is stringified for complex types if necessary, though 
  // typical API variables are usually strings.
  variableStore[key] = String(value);

  // Persist the updated store to localStorage. This function MUST be imported and called by app.js.
  // We rely on app.js to call saveVariableStore(variableStore);
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
  getVariableStore,
  loadInitialVariables // Export initialization function for app.js to call
};