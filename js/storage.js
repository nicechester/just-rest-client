/**
 * @fileoverview Manages all data persistence operations using localStorage.
 * Includes methods for loading and saving variables, requests, and scripts.
 */

// --- Constants ---

const STORAGE_KEYS = {
  VARIABLES: 'restClient.variables',
  REQUESTS: 'restClient.requests',
  SCRIPTS: 'restClient.scripts',
};

// --- Variable Store Management ---

/**
 * Saves the current state of the global variable store to localStorage.
 * @param {Object} variableStore - The key-value map of global variables.
 */
function saveVariableStore(variableStore) {
  try {
    const jsonString = JSON.stringify(variableStore);
    localStorage.setItem(STORAGE_KEYS.VARIABLES, jsonString);
    // console.log('Variables saved successfully.');
  } catch (error) {
    console.error('Error saving variables:', error);
  }
}

/**
 * Loads the variable store from localStorage.
 * @return {Object} The loaded variable store, or an empty object if none is found.
 */
function loadVariableStore() {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEYS.VARIABLES);
    return jsonString ? JSON.parse(jsonString) : {};
  } catch (error) {
    console.error('Error loading variables. Returning empty store.', error);
    return {};
  }
}

// --- Request and Script Collection Management ---

/**
 * Helper function to load an array of objects from localStorage.
 * @param {string} key - The localStorage key (e.g., STORAGE_KEYS.REQUESTS).
 * @return {Array<Object>} The loaded array, or an empty array if not found.
 */
function loadCollection(key) {
  try {
    const jsonString = localStorage.getItem(key);
    return jsonString ? JSON.parse(jsonString) : [];
  } catch (error) {
    console.error(`Error loading collection for key ${key}. Returning empty array.`, error);
    return [];
  }
}

/**
 * Helper function to save an array of objects to localStorage.
 * @param {string} key - The localStorage key.
 * @param {Array<Object>} collection - The array to save.
 */
function saveCollection(key, collection) {
  try {
    const jsonString = JSON.stringify(collection);
    localStorage.setItem(key, jsonString);
    // console.log(`Collection for ${key} saved successfully.`);
  } catch (error) {
    console.error(`Error saving collection for key ${key}.`, error);
  }
}

// Mock data structures (will hold loaded data)
let allRequests = [];
let allScripts = [];


/** Loads all saved requests into the module's memory. */
function loadAllRequests() {
    allRequests = loadCollection(STORAGE_KEYS.REQUESTS);
    return allRequests;
}

/** Returns the list of all saved requests. */
function getAllRequests() {
    return allRequests;
}


/** Loads all saved scripts into the module's memory. */
function loadAllScripts() {
    allScripts = loadCollection(STORAGE_KEYS.SCRIPTS);
    return allScripts;
}

/** Returns the list of all saved scripts. */
function getAllScripts() {
    return allScripts;
}

/**
 * Saves a single script object (creates new or updates existing).
 * @param {Object} scriptObject - The script object to save. Must have an 'id'.
 * @return {Object} The saved script object.
 */
function saveScript(scriptObject) {
  let scripts = getAllScripts();
  const index = scripts.findIndex(s => s.id === scriptObject.id);

  if (index !== -1) {
    scripts[index] = scriptObject; // Update existing
  } else {
    scripts.push(scriptObject); // Add new
  }

  saveCollection(STORAGE_KEYS.SCRIPTS, scripts);
  return scriptObject;
}

// --- Export/Import API ---\

/**
 * Public interface for the storage module.
 */
export {
  saveVariableStore,
  loadVariableStore,
  loadAllRequests,
  getAllRequests,
  loadAllScripts,
  getAllScripts,
  saveScript,
  // exportAllData // Excluded for simplicity
};