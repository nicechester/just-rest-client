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

// --- Request and Script Collection Management Helper ---

/**
 * Helper function to load an array of objects from localStorage.
 * @param {string} key - The localStorage key (e.g., STORAGE_KEYS.REQUESTS).
 * @return {Array<Object>} The loaded array, or an empty array if not found.
 */
function loadCollection(key) {
  try {
    const jsonString = localStorage.getItem(key);
    const data = jsonString ? JSON.parse(jsonString) : [];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error loading collection for key: ${key}`, error);
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
    console.log(`Collection for key ${key} saved.`);
  } catch (error) {
    console.error(`Error saving collection for key: ${key}`, error);
  }
}


// --- Variable Store Management ---\

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

// --- Request and Script Collection Management ---\

/**
 * Retrieves all saved request objects.
 * @return {Array<Object>} The list of saved requests.
 */
function getAllRequests() {
  return loadCollection(STORAGE_KEYS.REQUESTS);
}

/**
 * Saves or updates a single request object.
 * @param {Object} requestObject - The request object to save.
 * @return {Object} The saved request object (with an ID).
 */
function saveRequest(requestObject) {
  const requests = getAllRequests();
  if (!requestObject.id) {
    requestObject.id = `req-${Date.now()}`;
  }

  const index = requests.findIndex(r => r.id === requestObject.id);

  if (index !== -1) {
    requests[index] = requestObject; // Update existing
  } else {
    requests.push(requestObject); // Add new
  }

  saveCollection(STORAGE_KEYS.REQUESTS, requests);
  return requestObject;
}

/**
 * Retrieves all saved script objects.
 * @return {Array<Object>} The list of saved scripts.
 */
function getAllScripts() {
  return loadCollection(STORAGE_KEYS.SCRIPTS);
}

/**
 * Saves or updates a single script object.
 * @param {Object} scriptObject - The script object to save.
 * @return {Object} The saved script object (with an ID).
 */
function saveScript(scriptObject) {
  const scripts = getAllScripts();
  if (!scriptObject.id) {
    scriptObject.id = `script-${Date.now()}`;
  }

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
  STORAGE_KEYS,
  loadVariableStore,
  saveVariableStore,
  getAllRequests,
  saveRequest,
  getAllScripts,
  saveScript,
  exportAllData,
  saveCollection // Export the helper function for import logic in app.js
};