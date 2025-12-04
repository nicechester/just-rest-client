/**
 * @fileoverview Main application controller.
 * This file orchestrates the UI, handles user interaction, and imports/connects
 * all specialized modules (storage, variables, scripting, request).
 */

// --- Module Imports ---

// Import all required functions and variables from specialized modules.
import { 
    loadVariableStore, 
    saveVariableStore, 
    getAllRequests, 
    saveRequest, 
    getAllScripts, 
    saveScript, 
    exportAllData,
    saveCollection,
    STORAGE_KEYS,
    DEFAULT_GROUP,
    getActiveGroups,
    setActiveGroup,
    getAllGroups,
    addGroupName
} from './storage.js';

import { 
    getVariableStore, 
    setVariable, 
    variableStore, // Need this initial export to set default variables
    loadInitialVariables, // Function to load variables from storage in variables.js
    getFlattenedVariables,
    setActiveGroupForScripts
} from './variable.js';

import { 
    executePostScript,
    executePreScript
} from './scripting.js';

import { 
    executeRequest
} from './request.js';

// --- Global Variable Management Initialization (Moved from original app.js section) ---

// Execute the variable module's initialization logic
loadInitialVariables(loadVariableStore, saveVariableStore);


// --- 5. APP.JS Logic (Controller & UI) ---

const app = {
    currentRequest: {
        id: null,
        title: 'New Request',
        url: '',
        method: 'GET',
        rawHeaders: [{ key: '', value: '' }],
        body: '',
        preScriptId: '',
        postScriptId: '',
        group: DEFAULT_GROUP
    },
    
    currentScript: {
        id: null,
        name: 'Untitled Script',
        code: '',
        group: DEFAULT_GROUP
    },
    
    currentPreScript: {
        id: null,
        name: 'Untitled Pre-Script',
        code: '',
        group: DEFAULT_GROUP
    },
    
    currentSidebarTab: 'variables',
    currentMainTab: 'request',
    
    // Active groups for each collection type
    activeGroups: {
        variables: DEFAULT_GROUP,
        requests: DEFAULT_GROUP,
        scripts: DEFAULT_GROUP
    },
    
    // CodeMirror editor instances
    codeMirrorEditors: {
        preScript: null,
        postScript: null
    },
    
    // Custom confirm dialog
    confirmDialog: {
        show(message, onConfirm) {
            const dialog = document.getElementById('confirm-dialog');
            const messageEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');
            
            messageEl.textContent = message;
            dialog.classList.remove('hidden');
            
            // Remove old listeners
            const newOkBtn = okBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Add new listeners
            newOkBtn.onclick = () => {
                dialog.classList.add('hidden');
                onConfirm();
            };
            
            newCancelBtn.onclick = () => {
                dialog.classList.add('hidden');
            };
        }
    },
    
    // Custom input dialog
    inputDialog: {
        show(title, message, placeholder, onConfirm) {
            const dialog = document.getElementById('input-dialog');
            const titleEl = document.getElementById('input-dialog-title');
            const messageEl = document.getElementById('input-dialog-message');
            const inputEl = document.getElementById('input-dialog-input');
            const okBtn = document.getElementById('input-dialog-ok');
            const cancelBtn = document.getElementById('input-dialog-cancel');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.placeholder = placeholder || '';
            inputEl.value = '';
            dialog.classList.remove('hidden');
            
            // Focus on input
            setTimeout(() => inputEl.focus(), 100);
            
            // Remove old listeners
            const newOkBtn = okBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Handle Enter key in input
            const newInputEl = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInputEl, inputEl);
            
            const handleSubmit = () => {
                const value = newInputEl.value.trim();
                dialog.classList.add('hidden');
                if (value) {
                    onConfirm(value);
                }
            };
            
            newInputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    dialog.classList.add('hidden');
                }
            };
            
            // Add new listeners
            newOkBtn.onclick = handleSubmit;
            
            newCancelBtn.onclick = () => {
                dialog.classList.add('hidden');
            };
        }
    },
    
    // Generate cURL command
    generateCurlCommand() {
        const url = app.elements.urlInput.value || '';
        const method = app.elements.methodSelect.value;
        const headers = app.currentRequest.rawHeaders.filter(h => h.key);
        const body = app.elements.bodyTextarea.value;
        
        // Apply variable templating
        const processedUrl = app.applyTemplateToString(url);
        const processedBody = body ? app.applyTemplateToString(body) : '';
        
        let curlCommand = `curl -X ${method}`;
        
        // Add URL
        curlCommand += ` '${processedUrl}'`;
        
        // Add headers
        headers.forEach(header => {
            const key = app.applyTemplateToString(header.key);
            const value = app.applyTemplateToString(header.value);
            curlCommand += ` \\\n  -H '${key}: ${value}'`;
        });
        
        // Add body
        if (processedBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            // Escape single quotes in body
            const escapedBody = processedBody.replace(/'/g, "'\\''");
            curlCommand += ` \\\n  -d '${escapedBody}'`;
        }
        
        return curlCommand;
    },
    
    applyTemplateToString(str) {
        if (!str) return str;
        const vars = getFlattenedVariables(app.activeGroups.variables);
        return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            return vars[varName] !== undefined ? vars[varName] : match;
        });
    },
    
    showCurlDialog() {
        const dialog = document.getElementById('curl-dialog');
        const commandEl = document.getElementById('curl-command');
        const copyBtn = document.getElementById('curl-copy');
        const closeBtn = document.getElementById('curl-close');
        
        const curlCommand = app.generateCurlCommand();
        commandEl.textContent = curlCommand;
        dialog.classList.remove('hidden');
        
        // Remove old listeners
        const newCopyBtn = copyBtn.cloneNode(true);
        const newCloseBtn = closeBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        // Add new listeners
        newCopyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(curlCommand);
                newCopyBtn.textContent = 'Copied!';
                newCopyBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                newCopyBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                setTimeout(() => {
                    newCopyBtn.textContent = 'Copy to Clipboard';
                    newCopyBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                    newCopyBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
                }, 2000);
            } catch (error) {
                alert('Failed to copy to clipboard');
            }
        };
        
        newCloseBtn.onclick = () => {
            dialog.classList.add('hidden');
        };
    },

    elements: {
        // Request Inputs
        urlInput: document.getElementById('url-input'),
        methodSelect: document.getElementById('method-select'),
        headersContainer: document.getElementById('headers-container'),
        bodyTextarea: document.getElementById('body-textarea'),
        requestTitleInput: document.getElementById('request-title-input'),
        
        // Scripting
        scriptNameInput: document.getElementById('script-name-input'),
        preScriptNameInput: document.getElementById('pre-script-name-input'),
        preScriptSelect: document.getElementById('pre-script-select'),
        preScriptEditor: document.getElementById('pre-script-editor'),
        postScriptSelect: document.getElementById('post-script-select'),
        postScriptEditor: document.getElementById('post-script-editor'),

        // UI Lists
        variablesList: document.getElementById('variables-list'),
        requestsList: document.getElementById('requests-list'),
        scriptsList: document.getElementById('scripts-list'),

        // Response Outputs
        responseStatus: document.getElementById('response-status'),
        responseTime: document.getElementById('response-time'),
    },

    // --- UI Rendering ---

    renderVariableStore() {
        const varStore = getVariableStore();
        const activeGroup = app.activeGroups.variables;
        const vars = varStore[activeGroup] || {};
        
        app.elements.variablesList.innerHTML = Object.entries(vars).length > 0
            ? Object.entries(vars).map(([key, value]) => `
                <div class="variable-item bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition" data-var-key="${key}">
                    <div class="variable-display flex justify-between items-center cursor-pointer">
                        <span class="font-mono text-xs text-gray-700 font-semibold">${key}</span>
                        <span class="font-mono text-xs text-blue-600 truncate flex-1 mx-2">${value}</span>
                        <button data-delete-var="${key}" class="delete-var-btn text-red-500 hover:text-red-700 ml-2 text-xs">X</button>
            </div>
                    <div class="variable-edit hidden mt-2">
                        <div class="flex space-x-2">
                            <input type="text" class="edit-var-key flex-1 p-2 border rounded-lg text-xs font-mono" value="${key}" placeholder="Key">
                            <input type="text" class="edit-var-value flex-1 p-2 border rounded-lg text-xs font-mono" value="${value}" placeholder="Value">
                        </div>
                        <div class="flex space-x-2 mt-2">
                            <button class="save-var-btn flex-1 bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600 transition">Save</button>
                            <button class="cancel-var-btn flex-1 bg-gray-400 text-white px-3 py-1 rounded text-xs hover:bg-gray-500 transition">Cancel</button>
                        </div>
                    </div>
                </div>
            `).join('')
            : '<p class="text-gray-500 text-xs">No variables in this group.</p>';
    },
    
    editVariable(key) {
        const item = document.querySelector(`.variable-item[data-var-key="${key}"]`);
        if (item) {
            item.querySelector('.variable-display').classList.add('hidden');
            item.querySelector('.variable-edit').classList.remove('hidden');
            // Focus on value input
            item.querySelector('.edit-var-value').focus();
        }
    },
    
    saveEditedVariable(key) {
        const item = document.querySelector(`.variable-item[data-var-key="${key}"]`);
        if (!item) return;
        
        const newKey = item.querySelector('.edit-var-key').value.trim();
        const newValue = item.querySelector('.edit-var-value').value.trim();
        
        if (!newKey) {
            alert('Variable key cannot be empty');
            return;
        }
        
        const activeGroup = app.activeGroups.variables;
        const varStore = getVariableStore();
        
        // If key changed, delete old and add new
        if (newKey !== key) {
            delete varStore[activeGroup][key];
        }
        
        varStore[activeGroup][newKey] = newValue;
        saveVariableStore(varStore);
        
        app.renderVariableStore();
    },
    
    cancelEditVariable(key) {
        const item = document.querySelector(`.variable-item[data-var-key="${key}"]`);
        if (item) {
            item.querySelector('.variable-display').classList.remove('hidden');
            item.querySelector('.variable-edit').classList.add('hidden');
        }
    },
    
    // --- Group Management ---
    
    renderGroupSelectors() {
        // Render Variables Group Selector
        const varGroups = getAllGroups('variables');
        const varSelect = document.getElementById('variables-group-select');
        console.log('Variable groups:', varGroups, 'Active:', app.activeGroups.variables);
        varSelect.innerHTML = varGroups.map(g => 
            `<option value="${g}" ${g === app.activeGroups.variables ? 'selected' : ''}>${g}</option>`
        ).join('');
        
        // Render Requests Group Selector
        const reqGroups = getAllGroups('requests');
        const reqSelect = document.getElementById('requests-group-select');
        console.log('Request groups:', reqGroups, 'Active:', app.activeGroups.requests);
        reqSelect.innerHTML = reqGroups.map(g => 
            `<option value="${g}" ${g === app.activeGroups.requests ? 'selected' : ''}>${g}</option>`
        ).join('');
        
        // Render Scripts Group Selector
        const scriptGroups = getAllGroups('scripts');
        const scriptSelect = document.getElementById('scripts-group-select');
        console.log('Script groups:', scriptGroups, 'Active:', app.activeGroups.scripts);
        scriptSelect.innerHTML = scriptGroups.map(g => 
            `<option value="${g}" ${g === app.activeGroups.scripts ? 'selected' : ''}>${g}</option>`
        ).join('');
    },
    
    switchGroup(type, groupName) {
        console.log(`Switching ${type} group to: ${groupName}`);
        app.activeGroups[type] = groupName;
        setActiveGroup(type, groupName);
        
        if (type === 'variables') {
            app.renderVariableStore();
        } else if (type === 'requests') {
            app.renderCollections();
        } else if (type === 'scripts') {
            app.renderCollections();
        }
        
        console.log(`Active groups after switch:`, app.activeGroups);
    },
    
    createNewGroup(type) {
        console.log('createNewGroup called with type:', type);
        
        // Use custom input dialog instead of native prompt
        app.inputDialog.show(
            'Create New Group',
            `Enter a name for the new ${type} group:`,
            'e.g., production, staging, testing',
            (groupName) => {
                console.log('User entered group name:', groupName);
                
                const trimmedName = groupName.trim();
                
                // Check if group already exists (before switching)
                const existingGroups = getAllGroups(type);
                console.log('Existing groups before creation:', existingGroups);
                
                if (existingGroups.includes(trimmedName)) {
                    alert('Group already exists!');
                    return;
                }
                
                // Create the group by adding an empty entry
                if (type === 'variables') {
                    const varStore = getVariableStore();
                    varStore[trimmedName] = {};
                    saveVariableStore(varStore);
                    console.log('Created variable group:', trimmedName);
                }
                
                // Persist the group name (so it survives even if empty)
                addGroupName(type, trimmedName);
                console.log('Persisted group name:', trimmedName);
                
                // Switch to the new group
                app.switchGroup(type, trimmedName);
                
                // Render selectors to show the new group
                app.renderGroupSelectors();
                
                console.log('Group created and switched successfully');
                console.log('Groups after creation:', getAllGroups(type));
            }
        );
    },

    renderHeaders() {
        const container = app.elements.headersContainer;
        container.innerHTML = '';
        app.currentRequest.rawHeaders.forEach((h, index) => {
            const div = document.createElement('div');
            div.className = 'flex space-x-2';
            div.innerHTML = `
                <input type="text" value="${h.key}" placeholder="Key" oninput="window.app.updateHeader(${index}, 'key', this.value)" 
                    class="w-1/3 p-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500">
                <input type="text" value="${h.value}" placeholder="Value" oninput="window.app.updateHeader(${index}, 'value', this.value)" 
                    class="flex-1 p-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500">
                <button onclick="window.app.removeHeader(${index})" 
                    class="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition text-sm">Remove</button>
            `;
            container.appendChild(div);
        });
    },

    renderCollections() {
        // Render Requests List (filtered by active group)
        const allRequests = getAllRequests();
        const activeRequestGroup = app.activeGroups.requests;
        const requests = allRequests.filter(r => r.group === activeRequestGroup);
        
        app.elements.requestsList.innerHTML = requests.length > 0
            ? requests.map(r => `
                <div class="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm flex justify-between items-center">
                    <button data-load-request="${r.id}" class="load-request-btn flex-1 text-left flex justify-between items-center">
                        <span>${r.title}</span>
                        <span class="text-xs font-mono text-gray-500">${r.method}</span>
                    </button>
                    <button data-delete-request="${r.id}" class="delete-request-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : '<p class="text-gray-500 text-xs">No requests in this group.</p>';

        // Render Scripts List and Select (filtered by active group)
        const allScripts = getAllScripts();
        const activeScriptGroup = app.activeGroups.scripts;
        const scripts = allScripts.filter(s => s.group === activeScriptGroup);
        
        app.elements.scriptsList.innerHTML = scripts.length > 0
            ? scripts.map(s => `
                <div class="w-full p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition text-sm flex justify-between items-center">
                    <button data-load-script="${s.id}" class="load-script-btn flex-1 text-left">
                        <span>${s.name}</span>
                    </button>
                    <button data-delete-script="${s.id}" class="delete-script-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : '<p class="text-gray-500 text-xs">No scripts in this group.</p>';

        // Separate pre and post scripts - use ALL scripts for dropdowns (not filtered by group)
        const preScripts = allScripts.filter(s => s.type === 'pre-request');
        const postScripts = allScripts.filter(s => s.type !== 'pre-request');
        
        app.elements.preScriptSelect.innerHTML = '<option value="">-- No Pre-Script Selected --</option>' + 
            preScripts.map(s => `<option value="${s.id}" ${s.id === app.currentRequest.preScriptId ? 'selected' : ''}>${s.name} (${s.group})</option>`).join('');
        
        app.elements.postScriptSelect.innerHTML = '<option value="">-- No Post-Script Selected --</option>' + 
            postScripts.map(s => `<option value="${s.id}" ${s.id === app.currentRequest.postScriptId ? 'selected' : ''}>${s.name} (${s.group})</option>`).join('');

        // Update script editor fields based on currentScript
        if (app.codeMirrorEditors.postScript) {
            app.codeMirrorEditors.postScript.setValue(app.currentScript.code || '');
        } else {
            app.elements.postScriptEditor.value = app.currentScript.code;
        }
        app.elements.scriptNameInput.value = app.currentScript.name;
        
        if (app.codeMirrorEditors.preScript) {
            app.codeMirrorEditors.preScript.setValue(app.currentPreScript.code || '');
        } else {
            app.elements.preScriptEditor.value = app.currentPreScript.code;
        }
        app.elements.preScriptNameInput.value = app.currentPreScript.name;
    },
    
    // --- Tab Switching Logic (same as original) ---

    switchSidebarTab(tabName) {
        app.currentSidebarTab = tabName;

        // 1. Update Buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active', 'bg-blue-600', 'text-white');
            button.classList.add('text-gray-600', 'hover:bg-gray-100');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active', 'bg-blue-600', 'text-white');
                button.classList.remove('text-gray-600', 'hover:bg-gray-100');
            }
        });

        // 2. Update Panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            if (panel.getAttribute('data-panel') === tabName) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });
        
        // 3. Refresh content when switching to variables tab
        if (tabName === 'variables') {
            app.renderVariableStore();
        }
    },
    
    switchMainTab(tabName) {
        app.currentMainTab = tabName;

        // 1. Update Buttons
        document.querySelectorAll('.main-tab-button').forEach(button => {
            button.classList.remove('active', 'bg-blue-600', 'text-white');
            button.classList.add('text-gray-600', 'hover:bg-gray-100');
            if (button.getAttribute('data-main-tab') === tabName) {
                button.classList.add('active', 'bg-blue-600', 'text-white');
                button.classList.remove('text-gray-600', 'hover:bg-gray-100');
            }
        });

        // 2. Update Panels
        document.querySelectorAll('.main-panel').forEach(panel => {
            if (panel.getAttribute('data-panel') === tabName) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });
    },

    // --- UI Actions (Exposed to global scope for event handlers) ---

    loadRequest(id) {
        const request = getAllRequests().find(r => r.id === id);
        if (request) {
            app.currentRequest = {
                ...request, 
                rawHeaders: request.rawHeaders || [{ key: '', value: '' }]
            };
            app.currentScript.id = request.postScriptId;
            app.currentPreScript.id = request.preScriptId;
            app.elements.urlInput.value = request.url;
            app.elements.methodSelect.value = request.method;
            app.elements.bodyTextarea.value = request.body;
            app.elements.requestTitleInput.value = request.title;
            app.elements.postScriptSelect.value = request.postScriptId || '';
            app.elements.preScriptSelect.value = request.preScriptId || '';
            
            const scripts = getAllScripts();
            const postScript = scripts.find(s => s.id === request.postScriptId);
            if (postScript) {
                app.currentScript.name = postScript.name;
                app.currentScript.code = postScript.code;
            } else {
                app.currentScript = { id: null, name: 'Untitled Script', code: '' };
            }
            
            const preScript = scripts.find(s => s.id === request.preScriptId);
            if (preScript) {
                app.currentPreScript.name = preScript.name;
                app.currentPreScript.code = preScript.code;
            } else {
                app.currentPreScript = { id: null, name: 'Untitled Pre-Script', code: '' };
            }

            app.renderHeaders();
            app.renderCollections(); 
            app.switchMainTab('request'); 
        }
    },

    loadScriptToEditor(id) {
        const script = getAllScripts().find(s => s.id === id);
        if (script) {
            app.currentScript = script;
            app.elements.postScriptEditor.value = script.code;
            app.elements.scriptNameInput.value = script.name;
            app.currentRequest.postScriptId = script.id; 
            app.elements.postScriptSelect.value = script.id;
        }
    },
    
    deleteRequest(id) {
        app.confirmDialog.show('Are you sure you want to delete this request?', () => {
            let requests = getAllRequests().filter(r => r.id !== id);
            saveCollection(STORAGE_KEYS.REQUESTS, requests);
            app.renderCollections();
            if (app.currentRequest.id === id) {
                app.currentRequest.id = null;
            }
        });
    },

    deleteScript(id) {
        app.confirmDialog.show('Are you sure you want to delete this script?', () => {
            let scripts = getAllScripts().filter(s => s.id !== id);
            saveCollection(STORAGE_KEYS.SCRIPTS, scripts);
            app.renderCollections();
            if (app.currentRequest.postScriptId === id) {
                app.currentRequest.postScriptId = '';
                app.elements.postScriptSelect.value = '';
            }
            if (app.currentRequest.preScriptId === id) {
                app.currentRequest.preScriptId = '';
                app.elements.preScriptSelect.value = '';
            }
        });
    },

    deleteVariable(key) {
        app.confirmDialog.show(`Are you sure you want to delete variable '${key}'?`, () => {
            const varStore = getVariableStore();
            const activeGroup = app.activeGroups.variables;
            delete varStore[activeGroup][key];
            saveVariableStore(varStore);
            app.renderVariableStore();
        });
    },

    // --- Request/Header Logic ---

    updateHeader(index, field, value) {
        app.currentRequest.rawHeaders[index][field] = value;
        // Only add a new row if we're on the last row and both fields have some content
        if (index === app.currentRequest.rawHeaders.length - 1 && 
            app.currentRequest.rawHeaders[index].key && 
            app.currentRequest.rawHeaders[index].value) {
            // Add new empty row
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
            // Instead of re-rendering everything, just append the new row
            app.addHeaderRow(app.currentRequest.rawHeaders.length - 1);
        }
    },
    
    addHeaderRow(index) {
        const container = app.elements.headersContainer;
        const h = app.currentRequest.rawHeaders[index];
        const div = document.createElement('div');
        div.className = 'flex space-x-2';
        div.innerHTML = `
            <input type="text" value="${h.key}" placeholder="Key" oninput="window.app.updateHeader(${index}, 'key', this.value)" 
                class="w-1/3 p-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500">
            <input type="text" value="${h.value}" placeholder="Value" oninput="window.app.updateHeader(${index}, 'value', this.value)" 
                class="flex-1 p-2 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500">
            <button onclick="window.app.removeHeader(${index})" 
                class="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition text-sm">Remove</button>
        `;
        container.appendChild(div);
    },

    removeHeader(index) {
        app.currentRequest.rawHeaders.splice(index, 1);
        if (app.currentRequest.rawHeaders.length === 0) {
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
        }
        app.renderHeaders();
    },

    // --- Save Handlers ---

    saveCurrentRequest() {
        const title = app.elements.requestTitleInput.value || 'Untitled Request';
        
        const requestToSave = {
            id: app.currentRequest.id,
            title: title,
            url: app.elements.urlInput.value,
            method: app.elements.methodSelect.value,
            rawHeaders: app.currentRequest.rawHeaders.filter(h => h.key), 
            body: app.elements.bodyTextarea.value,
            preScriptId: app.elements.preScriptSelect.value,
            postScriptId: app.elements.postScriptSelect.value,
            group: app.activeGroups.requests  // Save to active group
        };
        
        const savedReq = saveRequest(requestToSave);
        app.currentRequest.id = savedReq.id; 
        app.currentRequest.group = savedReq.group;
        app.elements.requestTitleInput.value = savedReq.title;
        alert(`Request saved as: ${savedReq.title} (Group: ${savedReq.group})`);
        app.renderCollections();
        app.renderGroupSelectors();
    },
    
    saveAsNewRequest() {
        // Force create a new request by clearing the ID
        app.currentRequest.id = null;
        app.saveCurrentRequest();
    },
    
    newRequest() {
        // Clear the form for a new request
        app.currentRequest = {
            id: null,
            title: 'New Request',
            url: '',
            method: 'GET',
            rawHeaders: [{ key: '', value: '' }],
            body: '',
            preScriptId: '',
            postScriptId: '',
            group: app.activeGroups.requests  // Use active group
        };
        
        app.elements.requestTitleInput.value = 'New Request';
        app.elements.urlInput.value = '';
        app.elements.methodSelect.value = 'GET';
        app.elements.bodyTextarea.value = '';
        app.elements.preScriptSelect.value = '';
        app.elements.postScriptSelect.value = '';
        
        app.renderHeaders();
        app.switchMainTab('request');
    },

    saveCurrentScript() {
        const scriptName = app.elements.scriptNameInput.value || 'Untitled Script';
        const scriptCode = app.codeMirrorEditors.postScript 
            ? app.codeMirrorEditors.postScript.getValue() 
            : app.elements.postScriptEditor.value;

        const scriptToSave = {
            id: app.currentScript.id, 
            name: scriptName,
            code: scriptCode,
            group: app.activeGroups.scripts  // Save to active group
        };

        const savedScript = saveScript(scriptToSave);
        app.currentScript = savedScript; // Update entire current script object
        app.currentRequest.postScriptId = savedScript.id;
        
        alert(`Script saved as: ${savedScript.name} (Group: ${savedScript.group})`);
        app.renderCollections();
        app.renderGroupSelectors();
    },
    
    // --- Send & Response Handlers ---

    handleSend() {
        const rawHeaders = app.currentRequest.rawHeaders.filter(h => h.key || h.value);
        const preScriptId = app.elements.preScriptSelect.value;
        const postScriptId = app.elements.postScriptSelect.value;
        
        const responseBodyCode = document.getElementById('response-body-code');
        if (responseBodyCode) responseBodyCode.textContent = 'Sending request...';
        
        app.elements.responseStatus.textContent = 'Status: Sending...';
        document.getElementById('script-output').textContent = '';
        app.switchMainTab('result'); 
        
        // Set active group for scripts before execution
        setActiveGroupForScripts(app.activeGroups.variables);
        
        executeRequest(
            app.elements.urlInput.value,
            app.elements.methodSelect.value,
            rawHeaders,
            app.elements.bodyTextarea.value,
            preScriptId,
            postScriptId,
            app.displayResponse, // Pass the UI function to the request module
            app.activeGroups.variables // Pass active variable group for templating
        );
    },

    displayResponse(requestDetails, response, responseData, scriptOutput, processedUrl, duration) {
        // 1. Status and Time
        const status = response.status || 'N/A';
        const statusText = response.statusText || 'N/A';
        const statusColor = status >= 200 && status < 300 ? 'text-green-500' : (status >= 400 ? 'text-red-500' : 'text-gray-500');
        
        app.elements.responseStatus.className = `font-bold ${statusColor}`;
        app.elements.responseStatus.textContent = `Status: ${status} ${statusText}`;
        app.elements.responseTime.textContent = `Time: ${duration}ms`;

        // 2. Request Summary
        document.getElementById('request-line').textContent = 
            `${requestDetails.method} ${requestDetails.processedUrl} HTTP/1.1`;
        
        let requestHeadersText = '';
        Object.entries(requestDetails.headers).forEach(([key, value]) => {
            requestHeadersText += `${key}: ${value}\n`;
        });
        document.getElementById('request-headers').textContent = requestHeadersText || 'No headers';
        
        // Request Body
        const requestBodySection = document.getElementById('request-body-section');
        if (requestDetails.body) {
            requestBodySection.classList.remove('hidden');
            const requestBodyCode = document.getElementById('request-body-code');
            
            try {
                const bodyJson = JSON.parse(requestDetails.body);
                const formattedJson = JSON.stringify(bodyJson, null, 2);
                requestBodyCode.textContent = formattedJson;
                requestBodyCode.className = 'language-json';
                Prism.highlightElement(requestBodyCode);
            } catch (e) {
                // Not JSON, display as plain text
                requestBodyCode.textContent = requestDetails.body;
                requestBodyCode.className = 'language-markup';
                Prism.highlightElement(requestBodyCode);
            }
        } else {
            requestBodySection.classList.add('hidden');
        }

        // 3. Response Headers
        let responseHeaderText = '';
        if (response.headers) {
            response.headers.forEach((value, name) => {
                responseHeaderText += `${name}: ${value}\n`;
            });
        }
        document.getElementById('response-headers').textContent = responseHeaderText || 'No headers';

        // 4. Response Body with Syntax Highlighting
        const responseBodyCode = document.getElementById('response-body-code');
        
        if (typeof responseData === 'object' && responseData !== null) {
            const formattedJson = JSON.stringify(responseData, null, 2);
            responseBodyCode.textContent = formattedJson;
            responseBodyCode.className = 'language-json';
            Prism.highlightElement(responseBodyCode);
        } else {
            responseBodyCode.textContent = String(responseData);
            responseBodyCode.className = 'language-markup';
            Prism.highlightElement(responseBodyCode);
        }

        // 5. Script Output
        document.getElementById('script-output').textContent = scriptOutput || 'No script output';
        app.renderVariableStore();
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.variables) {
                    // Update the variable store via the specialized function
                    Object.assign(variableStore, importedData.variables);
                    saveVariableStore(variableStore);
                }
                if (importedData.requests) {
                    // Assuming saveCollection is available globally or imported
                    // We must assume it is imported from storage.js
                    saveCollection(STORAGE_KEYS.REQUESTS, importedData.requests);
                }
                if (importedData.scripts) {
                    saveCollection(STORAGE_KEYS.SCRIPTS, importedData.scripts);
                }
                alert('Data successfully imported!');
                app.init(); 
            } catch (error) {
                alert('Error importing data: Invalid JSON file.');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    },

    // --- Initialization ---

    init() {
        console.log('App initializing...');
        
        // Load active groups from storage
        const savedActiveGroups = getActiveGroups();
        app.activeGroups = savedActiveGroups;
        console.log('Active groups loaded:', app.activeGroups);
        
        // Render group selectors first
        app.renderGroupSelectors();
        
        // Load and render initial state
        app.renderVariableStore();
        app.renderHeaders();
        app.renderCollections();
        
        // Initialize default URL
        if (!app.elements.urlInput.value && variableStore.baseUrl) {
            app.elements.urlInput.value = '{{baseUrl}}';
        }
        
        // Set initial tab states
        app.switchSidebarTab('variables');
        app.switchMainTab('request');
        
        console.log('Checking for group buttons...');
        console.log('new-var-group-btn exists:', !!document.getElementById('new-var-group-btn'));
        console.log('new-request-group-btn exists:', !!document.getElementById('new-request-group-btn'));
        console.log('new-script-group-btn exists:', !!document.getElementById('new-script-group-btn'));

        // Initialize CodeMirror editors
        app.codeMirrorEditors.preScript = CodeMirror.fromTextArea(
            app.elements.preScriptEditor,
            {
                mode: 'javascript',
                theme: 'dracula',
                lineNumbers: true,
                matchBrackets: true,
                autoCloseBrackets: true,
                styleActiveLine: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true
            }
        );

        app.codeMirrorEditors.postScript = CodeMirror.fromTextArea(
            app.elements.postScriptEditor,
            {
                mode: 'javascript',
                theme: 'dracula',
                lineNumbers: true,
                matchBrackets: true,
                autoCloseBrackets: true,
                styleActiveLine: true,
                indentUnit: 2,
                tabSize: 2,
                lineWrapping: true
            }
        );

        // Attach event listeners
        document.getElementById('send-btn').onclick = app.handleSend;
        document.getElementById('curl-btn').onclick = app.showCurlDialog;
        document.getElementById('new-request-btn').onclick = app.newRequest;
        document.getElementById('save-request-btn').onclick = app.saveAsNewRequest;
        document.getElementById('save-script-btn').onclick = app.saveCurrentScript;
        document.getElementById('add-header-btn').onclick = () => {
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
            app.renderHeaders();
        };
        document.getElementById('add-var-btn').onclick = () => {
            const key = document.getElementById('var-key-input').value.trim();
            const value = document.getElementById('var-value-input').value.trim();
            if (key) {
                const activeGroup = app.activeGroups.variables;
                const varStore = getVariableStore();
                
                if (!varStore[activeGroup]) {
                    varStore[activeGroup] = {};
                }
                
                varStore[activeGroup][key] = value;
                saveVariableStore(varStore);
                
                document.getElementById('var-key-input').value = '';
                document.getElementById('var-value-input').value = '';
                app.renderVariableStore(); // Re-render the variables list
            } else {
                alert('Variable key cannot be empty.');
            }
        };
        document.getElementById('pre-script-select').onchange = (e) => {
            const selectedId = e.target.value;
            app.currentRequest.preScriptId = selectedId;
            
            const scripts = getAllScripts();
            const script = scripts.find(s => s.id === selectedId);
            if (script) {
                app.currentPreScript = script;
            } else {
                app.currentPreScript = { id: null, name: 'Untitled Pre-Script', code: '' };
            }
            app.renderCollections();
        };
        
        document.getElementById('post-script-select').onchange = (e) => {
            const selectedId = e.target.value;
            app.currentRequest.postScriptId = selectedId;
            
            const scripts = getAllScripts();
            const script = scripts.find(s => s.id === selectedId);
            if (script) {
                app.currentScript = script;
            } else {
                app.currentScript = { id: null, name: 'Untitled Script', code: '' };
            }
            app.renderCollections();
        };
        
        document.getElementById('save-pre-script-btn').onclick = () => {
            const scriptName = app.elements.preScriptNameInput.value || 'Untitled Pre-Script';
            const scriptCode = app.codeMirrorEditors.preScript 
                ? app.codeMirrorEditors.preScript.getValue() 
                : app.elements.preScriptEditor.value;

            const scriptToSave = {
                id: app.currentPreScript.id,
                name: scriptName,
                code: scriptCode,
                type: 'pre-request',
                group: app.activeGroups.scripts  // Save to active group
            };

            const savedScript = saveScript(scriptToSave);
            app.currentPreScript = savedScript; // Update entire current pre-script object
            app.currentRequest.preScriptId = savedScript.id;
            
            alert(`Pre-request script saved as: ${savedScript.name} (Group: ${savedScript.group})`);
            app.renderCollections();
            app.renderGroupSelectors();
        };

        // Event delegation for dynamically rendered delete and load buttons
        const variablesList = document.getElementById('variables-list');
        const requestsList = document.getElementById('requests-list');
        const scriptsList = document.getElementById('scripts-list');
        
        if (variablesList) {
            variablesList.addEventListener('click', (e) => {
                // Delete button
                if (e.target.classList.contains('delete-var-btn')) {
                    const key = e.target.getAttribute('data-delete-var');
                    if (key) app.deleteVariable(key);
                    return;
                }
                
                // Save button
                if (e.target.classList.contains('save-var-btn')) {
                    const item = e.target.closest('.variable-item');
                    const key = item.getAttribute('data-var-key');
                    if (key) app.saveEditedVariable(key);
                    return;
                }
                
                // Cancel button
                if (e.target.classList.contains('cancel-var-btn')) {
                    const item = e.target.closest('.variable-item');
                    const key = item.getAttribute('data-var-key');
                    if (key) app.cancelEditVariable(key);
                    return;
                }
                
                // Click on variable display to edit
                const display = e.target.closest('.variable-display');
                if (display && !e.target.classList.contains('delete-var-btn')) {
                    const item = display.closest('.variable-item');
                    const key = item.getAttribute('data-var-key');
                    if (key) app.editVariable(key);
                }
            });
        }

        if (requestsList) {
            requestsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-request-btn')) {
                    const id = e.target.getAttribute('data-delete-request');
                    if (id) app.deleteRequest(id);
                } else if (e.target.classList.contains('load-request-btn') || e.target.closest('.load-request-btn')) {
                    const btn = e.target.classList.contains('load-request-btn') ? e.target : e.target.closest('.load-request-btn');
                    const id = btn.getAttribute('data-load-request');
                    if (id) app.loadRequest(id);
                }
            });
        }

        if (scriptsList) {
            scriptsList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-script-btn')) {
                    const id = e.target.getAttribute('data-delete-script');
                    if (id) app.deleteScript(id);
                } else if (e.target.classList.contains('load-script-btn') || e.target.closest('.load-script-btn')) {
                    const btn = e.target.classList.contains('load-script-btn') ? e.target : e.target.closest('.load-script-btn');
                    const id = btn.getAttribute('data-load-script');
                    if (id) app.loadScriptToEditor(id);
                }
            });
        }

        // Export/Import listeners
        document.getElementById('export-btn').onclick = () => exportAllData(getVariableStore(), getAllRequests(), getAllScripts());
        document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();

        // Group selector change handlers
        document.getElementById('variables-group-select').onchange = (e) => {
            app.switchGroup('variables', e.target.value);
        };
        
        document.getElementById('requests-group-select').onchange = (e) => {
            app.switchGroup('requests', e.target.value);
        };
        
        document.getElementById('scripts-group-select').onchange = (e) => {
            app.switchGroup('scripts', e.target.value);
        };
        
        // Create new group button handlers
        const newVarGroupBtn = document.getElementById('new-var-group-btn');
        const newRequestGroupBtn = document.getElementById('new-request-group-btn');
        const newScriptGroupBtn = document.getElementById('new-script-group-btn');
        
        if (newVarGroupBtn) {
            newVarGroupBtn.onclick = () => {
                app.createNewGroup('variables');
            };
        } else {
            console.error('new-var-group-btn not found');
        }
        
        if (newRequestGroupBtn) {
            newRequestGroupBtn.onclick = () => {
                app.createNewGroup('requests');
            };
        } else {
            console.error('new-request-group-btn not found');
        }
        
        if (newScriptGroupBtn) {
            newScriptGroupBtn.onclick = () => {
                app.createNewGroup('scripts');
            };
        } else {
            console.error('new-script-group-btn not found');
        }

        // Add default variables if the store is empty
        const varStore = getVariableStore();
        if (!varStore[DEFAULT_GROUP] || Object.keys(varStore[DEFAULT_GROUP]).length === 0) {
            varStore[DEFAULT_GROUP] = {
                baseUrl: 'https://jsonplaceholder.typicode.com',
                token: 'initial_token_123'
            };
            saveVariableStore(varStore);
        }
    }
};

// Expose app functions globally for inline HTML event handlers (e.g., onclick)
window.app = app;

// Start the application after the DOM is fully loaded
// Check if DOM is already loaded (common with ES modules/Vite)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
} else {
    app.init();
}