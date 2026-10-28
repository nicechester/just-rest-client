/**
 * @fileoverview Manages the global variable store, ensuring it is initialized
 * from localStorage via the storage module.
 * Now supports grouped variables with a global scope.
 */

// The variableStore object holds grouped key/value pairs: { groupName: { key: value } }
let variableStore = {};

// Store reference to the save function
let saveVariableStoreFn = null;

// Current active group for variable operations (used by scripts)
let currentActiveGroup = 'global';

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
      'global': {
        'baseUrl': 'https://api.example.com',
        'userId': '1001'
      }
    };
  }
}

/**
 * Sets the active group for variable operations (used by scripts).
 * @param {string} groupName - The group name to set as active.
 */
function setActiveGroupForScripts(groupName) {
  currentActiveGroup = groupName;
}

/**
 * Updates or sets a variable in the current active group and persists the change.
 * This is used by scripts when they call setVar().
 * @param {string} key - The name of the variable.
 * @param {string} value - The value to assign to the variable.
 */
function setVariable(key, value) {
  // Ensure the active group exists
  if (!variableStore[currentActiveGroup]) {
    variableStore[currentActiveGroup] = {};
  }
  
  variableStore[currentActiveGroup][key] = String(value);

  // Persist the updated store to localStorage
  if (typeof saveVariableStoreFn === 'function') {
    saveVariableStoreFn(variableStore);
  }
}

/**
 * Returns the entire grouped variable store.
 * @return {Object} The current variable store object with structure { groupName: { key: value } }
 */
function getVariableStore() {
  return variableStore;
}

/**
 * Returns a flattened variable store for templating.
 * Includes variables from the global group AND the current active group.
 * Active group variables override global ones if there are conflicts.
 * @param {string} activeGroup - The currently active group (optional, defaults to currentActiveGroup)
 * @return {Object} Flat object with all accessible variables
 */
function getFlattenedVariables(activeGroup = currentActiveGroup) {
  const globalVars = variableStore['global'] || {};
  const activeVars = (activeGroup !== 'global' && variableStore[activeGroup]) ? variableStore[activeGroup] : {};
  
  // Merge: global variables + active group variables (active group takes precedence)
  return { ...globalVars, ...activeVars };
}

/**
 * Public interface for the variables module.
 */
export {
  variableStore, // Export the raw object for external read access (e.g., in request.js)
  setVariable,
  getVariableStore,
  getFlattenedVariables,
  setActiveGroupForScripts,
  loadInitialVariables // Export initialization function for app.js to call
};