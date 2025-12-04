/**
 * @fileoverview Manages all data persistence operations using localStorage.
 * Includes methods for loading and saving variables, requests, and scripts.
 */

// --- Constants ---

const STORAGE_KEYS = {
  VARIABLES: 'restClient.variables',
  REQUESTS: 'restClient.requests',
  SCRIPTS: 'restClient.scripts',
  ACTIVE_GROUPS: 'restClient.activeGroups',
  GROUP_NAMES: 'restClient.groupNames', // Store all group names (including empty ones)
};

// Default group name
const DEFAULT_GROUP = 'global';

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
 * Now returns an object with variables grouped by group name.
 * @return {Object} The loaded variable store with structure { groupName: { varKey: varValue } }
 */
function loadVariableStore() {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEYS.VARIABLES);
    const data = jsonString ? JSON.parse(jsonString) : {};
    
    // Migrate old format (flat object) to new format (grouped)
    if (data && !data[DEFAULT_GROUP] && Object.keys(data).length > 0) {
      // Check if it's the old format (has variable keys directly)
      const hasNonGroupKeys = Object.keys(data).some(key => typeof data[key] !== 'object' || Array.isArray(data[key]));
      if (hasNonGroupKeys) {
        // Old format: migrate to new format
        const migratedData = { [DEFAULT_GROUP]: data };
        saveVariableStore(migratedData);
        return migratedData;
      }
    }
    
    // Ensure default group exists
    if (!data[DEFAULT_GROUP]) {
      data[DEFAULT_GROUP] = {};
    }
    
    return data;
  } catch (error) {
    console.error('Error loading variables. Returning empty store.', error);
    return { [DEFAULT_GROUP]: {} };
  }
}

// --- Request and Script Collection Management ---\

/**
 * Retrieves all saved request objects.
 * Ensures each request has a group field (defaults to DEFAULT_GROUP).
 * @return {Array<Object>} The list of saved requests.
 */
function getAllRequests() {
  const requests = loadCollection(STORAGE_KEYS.REQUESTS);
  return requests.map(r => ({
    ...r,
    group: r.group || DEFAULT_GROUP
  }));
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
 * Ensures each script has a group field (defaults to DEFAULT_GROUP).
 * @return {Array<Object>} The list of saved scripts.
 */
function getAllScripts() {
  const scripts = loadCollection(STORAGE_KEYS.SCRIPTS);
  return scripts.map(s => ({
    ...s,
    group: s.group || DEFAULT_GROUP
  }));
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
async function exportAllData(variableStore, requests, scripts) {
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
  
  try {
    // Check if we're running in Tauri
    if (window.__TAURI__) {
      // Use Tauri's save dialog
      const { save } = window.__TAURI__.dialog;
      const { writeTextFile } = window.__TAURI__.fs;
      
      // Show save dialog
      const filePath = await save({
        defaultPath: `rest-client-export-${Date.now()}.json`,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });
      
      if (filePath) {
        // Write the file
        await writeTextFile(filePath, jsonString);
        alert('Export completed successfully!');
      } else {
        console.log('Export cancelled by user');
      }
    } else {
      // Browser fallback (standard download)
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rest-client-export-${Date.now()}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('Export completed! Check your Downloads folder.');
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed: ' + error.message);
  }
}

// --- Group Management ---

/**
 * Gets all active groups for each collection type.
 * @return {Object} { variables: 'groupName', requests: 'groupName', scripts: 'groupName' }
 */
function getActiveGroups() {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEYS.ACTIVE_GROUPS);
    const defaults = { variables: DEFAULT_GROUP, requests: DEFAULT_GROUP, scripts: DEFAULT_GROUP };
    return jsonString ? { ...defaults, ...JSON.parse(jsonString) } : defaults;
  } catch (error) {
    console.error('Error loading active groups', error);
    return { variables: DEFAULT_GROUP, requests: DEFAULT_GROUP, scripts: DEFAULT_GROUP };
  }
}

/**
 * Sets the active group for a specific collection type.
 * @param {string} type - One of 'variables', 'requests', 'scripts'
 * @param {string} groupName - The group name to set as active
 */
function setActiveGroup(type, groupName) {
  try {
    const activeGroups = getActiveGroups();
    activeGroups[type] = groupName;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_GROUPS, JSON.stringify(activeGroups));
  } catch (error) {
    console.error('Error saving active group', error);
  }
}

/**
 * Gets stored group names for a specific type.
 * @param {string} type - One of 'variables', 'requests', 'scripts'
 * @return {Object} Object with structure { variables: [], requests: [], scripts: [] }
 */
function loadGroupNames() {
  try {
    const jsonString = localStorage.getItem(STORAGE_KEYS.GROUP_NAMES);
    const data = jsonString ? JSON.parse(jsonString) : {};
    
    // Ensure all types exist with at least default group
    if (!data.variables) data.variables = [DEFAULT_GROUP];
    if (!data.requests) data.requests = [DEFAULT_GROUP];
    if (!data.scripts) data.scripts = [DEFAULT_GROUP];
    
    return data;
  } catch (error) {
    console.error('Error loading group names', error);
    return {
      variables: [DEFAULT_GROUP],
      requests: [DEFAULT_GROUP],
      scripts: [DEFAULT_GROUP]
    };
  }
}

/**
 * Saves group names for a specific type.
 * @param {Object} groupNames - Object with structure { variables: [], requests: [], scripts: [] }
 */
function saveGroupNames(groupNames) {
  try {
    localStorage.setItem(STORAGE_KEYS.GROUP_NAMES, JSON.stringify(groupNames));
  } catch (error) {
    console.error('Error saving group names', error);
  }
}

/**
 * Adds a group name to the stored list.
 * @param {string} type - One of 'variables', 'requests', 'scripts'
 * @param {string} groupName - The group name to add
 */
function addGroupName(type, groupName) {
  const groupNames = loadGroupNames();
  if (!groupNames[type].includes(groupName)) {
    groupNames[type].push(groupName);
    groupNames[type].sort();
    saveGroupNames(groupNames);
  }
}

/**
 * Gets all unique group names for a collection type.
 * @param {string} type - One of 'variables', 'requests', 'scripts'
 * @return {Array<string>} Array of unique group names
 */
function getAllGroups(type) {
  const groups = new Set([DEFAULT_GROUP]);
  
  // Load persisted group names (includes empty groups)
  const groupNames = loadGroupNames();
  if (groupNames[type]) {
    groupNames[type].forEach(g => groups.add(g));
  }
  
  // Also scan existing items (in case groups were created before this feature)
  if (type === 'variables') {
    const varStore = loadVariableStore();
    Object.keys(varStore).forEach(g => {
      groups.add(g);
      // Add to persisted list if not there
      if (!groupNames[type].includes(g)) {
        addGroupName(type, g);
      }
    });
  } else if (type === 'requests') {
    const requests = loadCollection(STORAGE_KEYS.REQUESTS);
    requests.forEach(r => {
      if (r.group) {
        groups.add(r.group);
        if (!groupNames[type].includes(r.group)) {
          addGroupName(type, r.group);
        }
      }
    });
  } else if (type === 'scripts') {
    const scripts = loadCollection(STORAGE_KEYS.SCRIPTS);
    scripts.forEach(s => {
      if (s.group) {
        groups.add(s.group);
        if (!groupNames[type].includes(s.group)) {
          addGroupName(type, s.group);
        }
      }
    });
  }
  
  return Array.from(groups).sort();
}

/**
 * Public interface for the storage module.
 */
export {
  STORAGE_KEYS,
  DEFAULT_GROUP,
  loadVariableStore,
  saveVariableStore,
  getAllRequests,
  saveRequest,
  getAllScripts,
  saveScript,
  exportAllData,
  saveCollection, // Export the helper function for import logic in app.js
  getActiveGroups,
  setActiveGroup,
  getAllGroups,
  addGroupName
};