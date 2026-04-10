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
  TAB_SESSIONS: 'restClient.tabSessions',
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
 * If a request with the same title and group exists, updates it.
 * Otherwise creates a new request.
 * @param {Object} requestObject - The request object to save.
 * @return {Object} The saved request object (with an ID).
 */
function saveRequest(requestObject) {
  const requests = getAllRequests();
  const group = requestObject.group || DEFAULT_GROUP;
  const title = requestObject.title || 'Untitled Request';
  
  // If ID is provided (e.g., during import), use it directly
  if (requestObject.id) {
    // Check if this ID already exists
    const existingIndex = requests.findIndex(r => r.id === requestObject.id);
    if (existingIndex !== -1) {
      // Update existing request with same ID
      requests[existingIndex] = requestObject;
    } else {
      // Add new request with provided ID
      requests.push(requestObject);
    }
  } else {
    // No ID provided - check if a request with same title in same group exists (deduplication for manual saves)
    const existingIndex = requests.findIndex(r => 
      r.title === title && (r.group || DEFAULT_GROUP) === group
    );

    if (existingIndex !== -1) {
      // Update existing request, preserve its ID
      requestObject.id = requests[existingIndex].id;
      requests[existingIndex] = requestObject;
    } else {
      // Create new request - generate a new ID
      requestObject.id = `req-${Date.now()}`;
      requests.push(requestObject);
    }
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
 * If a script with the same name and group exists, updates it.
 * Otherwise creates a new script.
 * @param {Object} scriptObject - The script object to save.
 * @return {Object} The saved script object (with an ID).
 */
function saveScript(scriptObject) {
  const scripts = getAllScripts();
  const group = scriptObject.group || DEFAULT_GROUP;
  const name = scriptObject.name || 'Untitled Script';
  
  // If ID is provided (e.g., during import), use it directly
  if (scriptObject.id) {
    // Check if this ID already exists
    const existingIndex = scripts.findIndex(s => s.id === scriptObject.id);
    if (existingIndex !== -1) {
      // Update existing script with same ID
      scripts[existingIndex] = scriptObject;
    } else {
      // Add new script with provided ID
      scripts.push(scriptObject);
    }
  } else {
    // No ID provided - check if a script with same name in same group exists (deduplication for manual saves)
    const existingIndex = scripts.findIndex(s => 
      s.name === name && (s.group || DEFAULT_GROUP) === group
    );

    if (existingIndex !== -1) {
      // Update existing script, preserve its ID
      scriptObject.id = scripts[existingIndex].id;
      scripts[existingIndex] = scriptObject;
    } else {
      // Create new script - generate a new ID
      scriptObject.id = `script-${Date.now()}`;
      scripts.push(scriptObject);
    }
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
 * Renames a group and updates all associated items.
 * @param {string} type - One of 'variables', 'requests', 'scripts'
 * @param {string} oldName - The current group name
 * @param {string} newName - The new group name
 * @return {boolean} True if successful, false otherwise
 */
function renameGroup(type, oldName, newName) {
  if (!oldName || !newName || oldName === newName) {
    return false;
  }

  // Prevent renaming the default 'global' group
  if (oldName === DEFAULT_GROUP) {
    return false;
  }

  // Check if new name already exists
  const groupNames = loadGroupNames();
  if (groupNames[type] && groupNames[type].includes(newName)) {
    return false;
  }

  // Update group name in the stored list
  if (groupNames[type]) {
    const index = groupNames[type].indexOf(oldName);
    if (index !== -1) {
      groupNames[type][index] = newName;
      groupNames[type].sort();
      saveGroupNames(groupNames);
    }
  }

  // Update all items in this group
  if (type === 'variables') {
    const varStore = loadVariableStore();
    if (varStore[oldName]) {
      varStore[newName] = varStore[oldName];
      delete varStore[oldName];
      saveVariableStore(varStore);
    }
  } else if (type === 'requests') {
    const allRequests = loadCollection(STORAGE_KEYS.REQUESTS);
    const updatedRequests = allRequests.map(r => {
      if (r.group === oldName) {
        return { ...r, group: newName };
      }
      return r;
    });
    saveCollection(STORAGE_KEYS.REQUESTS, updatedRequests);
  } else if (type === 'scripts') {
    const allScripts = loadCollection(STORAGE_KEYS.SCRIPTS);
    const updatedScripts = allScripts.map(s => {
      if (s.group === oldName) {
        return { ...s, group: newName };
      }
      return s;
    });
    saveCollection(STORAGE_KEYS.SCRIPTS, updatedScripts);
  }

  // Update active group if it was the renamed one
  const activeGroups = getActiveGroups();
  if (activeGroups[type] === oldName) {
    setActiveGroup(type, newName);
  }

  return true;
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
 * Saves the current tab sessions to localStorage.
 * @param {Array<Object>} tabs - Serializable tab state array
 * @param {string} activeTabId - The active tab id
 */
function saveTabSessions(tabs, activeTabId) {
  try {
    localStorage.setItem(STORAGE_KEYS.TAB_SESSIONS, JSON.stringify({ tabs, activeTabId }));
  } catch (error) {
    console.error('Error saving tab sessions:', error);
  }
}

/**
 * Loads saved tab sessions from localStorage.
 * @return {{ tabs: Array, activeTabId: string } | null}
 */
function loadTabSessions() {
  try {
    const json = localStorage.getItem(STORAGE_KEYS.TAB_SESSIONS);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error('Error loading tab sessions:', error);
    return null;
  }
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
  addGroupName,
  loadGroupNames,
  saveGroupNames,
  renameGroup,
  saveTabSessions,
  loadTabSessions
};