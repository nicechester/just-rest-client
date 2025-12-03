/**
 * @fileoverview Manages the global variable store, ensuring it is initialized
 * from localStorage via the storage module.
 */

// The variableStore object holds the key/value pairs
let variableStore = {};

// Store reference to the save function
let saveVariableStoreFn = null;

/**
 * Initializes the variable store from storage.
 * @param {function} loadVariableStoreFn - Function to load store from persistence.
 * @param {function} saveVariableStoreFnArg - Function to save store to persistence.
 */
function loadInitialVariables(loadVariableStoreFn, saveVariableStoreFnArg) {
  // Store the save function for later use
  saveVariableStoreFn = saveVariableStoreFnArg;
  
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
 * @param {string} key - The name of the variable.
 * @param {string} value - The value to assign to the variable.
 */
function setVariable(key, value) {
  // Ensure the value is stringified for complex types if necessary, though 
  // typical API variables are usually strings.
  variableStore[key] = String(value);

  // Persist the updated store to localStorage
  if (typeof saveVariableStoreFn === 'function') {
    saveVariableStoreFn(variableStore);
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
  getVariableStore,
  loadInitialVariables // Export initialization function for app.js to call
};