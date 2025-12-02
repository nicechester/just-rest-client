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
    console.log('Variables saved successfully.');
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
    console.error(`Error loading collection '${key}'. Returning empty array.`, error);
    return [];
  }
}

/**
 * Helper function to save an array of objects to localStorage.
 * @param {string} key - The localStorage key (e.g., STORAGE_KEYS.REQUESTS).
 * @param {Array<Object>} collection - The array of objects to save.
 */
function saveCollection(key, collection) {
  try {
    const jsonString = JSON.stringify(collection);
    localStorage.setItem(key, jsonString);
  } catch (error) {
    console.error(`Error saving collection '${key}':`, error);
  }
}

// --- Request API ---

/**
 * Loads all saved requests.
 */
function loadAllRequests() {
  return loadCollection(STORAGE_KEYS.REQUESTS);
}

// Placeholder: Needs to be fully implemented later.
function saveRequest(requestObject) {
  const requests = loadAllRequests();
  const index = requests.findIndex(r => r.id === requestObject.id);

  if (index !== -1) {
    requests[index] = requestObject; // Update existing
  } else {
    requests.push(requestObject); // Add new
  }

  saveCollection(STORAGE_KEYS.REQUESTS, requests);
  return requestObject;
}

// --- Script API ---

/**
 * Loads all saved scripts.
 */
function loadAllScripts() {
  return loadCollection(STORAGE_KEYS.SCRIPTS);
}

/**
 * Returns all saved scripts. Used by scripting.js.
 */
function getAllScripts() {
    return loadAllScripts();
}

// Placeholder: Needs to be fully implemented later.
function saveScript(scriptObject) {
  const scripts = loadAllScripts();
  const index = scripts.findIndex(s => s.id === scriptObject.id);

  if (index !== -1) {
    scripts[index] = scriptObject; // Update existing
  } else {
    scripts.push(scriptObject); // Add new
  }

  saveCollection(STORAGE_KEYS.SCRIPTS, scripts);
  return scriptObject;
}

// --- Export/Import API ---

/**
 * Creates a downloadable JSON file containing all client data (variables, requests, scripts).
 * @param {Object} variableStore - The current variable store.
 * @param {Array<Object>} requests - The list of all saved requests.
 * @param {Array<Object>} scripts - The list of all saved scripts.
 */
function exportAllData(variableStore, requests, scripts) {
  const exportData = {
    metadata: {
      version: '1.0',
      exportedAt: new Date().toISOString(),
    },
    variables: variableStore,
    requests: requests,
    scripts: scripts,
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  
  // Create a temporary link element to trigger the download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rest-client-export-${Date.now()}.json`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Export initiated.');
}

/**
 * Public interface for the storage module.
 */
export {
  saveVariableStore,
  loadVariableStore,
  loadAllRequests,
  saveRequest,
  loadAllScripts,
  saveScript,
  getAllScripts, // CRITICAL FIX: Exported for scripting.js
  exportAllData
};