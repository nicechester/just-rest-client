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
    STORAGE_KEYS
} from './storage.js';

import { 
    getVariableStore, 
    setVariable, 
    variableStore, // Need this initial export to set default variables
    loadInitialVariables // Function to load variables from storage in variables.js
} from './variable.js';

import { 
    executePostScript
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
        postScriptId: ''
    },
    
    currentScript: {
        id: null,
        name: 'Untitled Script',
        code: ''
    },
    
    currentSidebarTab: 'variables',
    currentMainTab: 'request', 

    elements: {
        // Request Inputs
        urlInput: document.getElementById('url-input'),
        methodSelect: document.getElementById('method-select'),
        headersContainer: document.getElementById('headers-container'),
        bodyTextarea: document.getElementById('body-textarea'),
        requestTitleInput: document.getElementById('request-title-input'),
        
        // Scripting
        scriptNameInput: document.getElementById('script-name-input'),
        postScriptSelect: document.getElementById('post-script-select'),
        postScriptEditor: document.getElementById('post-script-editor'),

        // UI Lists
        variablesList: document.getElementById('variables-list'),
        requestsList: document.getElementById('requests-list'),
        scriptsList: document.getElementById('scripts-list'),

        // Response Outputs
        responseStatus: document.getElementById('response-status'),
        responseTime: document.getElementById('response-time'),
        processedUrl: document.getElementById('processed-url'),
        responseBody: document.getElementById('response-body'),
        responseHeaders: document.getElementById('response-headers'),
        scriptOutput: document.getElementById('script-output'),
    },

    // --- UI Rendering ---

    renderVariableStore() {
        const vars = getVariableStore();
        app.elements.variablesList.innerHTML = Object.entries(vars).map(([key, value]) => `
            <div class="flex justify-between items-center bg-gray-100 p-2 rounded-lg">
                <span class="font-mono text-xs text-gray-700">${key}</span>
                <span class="font-mono text-xs text-blue-600 truncate max-w-[60%]">${value}</span>
                <button onclick="window.app.deleteVariable('${key}')" class="text-red-500 hover:text-red-700 ml-2 text-xs">X</button>
            </div>
        `).join('');
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
        // Render Requests List
        const requests = getAllRequests();
        app.elements.requestsList.innerHTML = requests.length > 0
            ? requests.map(r => `
                <button onclick="window.app.loadRequest('${r.id}')" 
                    class="w-full text-left p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm flex justify-between items-center">
                    <span>${r.title}</span>
                    <span class="text-xs font-mono text-gray-500">${r.method}</span>
                </button>
            `).join('')
            : '<p class="text-gray-500">No requests saved.</p>';

        // Render Scripts List and Select
        const scripts = getAllScripts();
        app.elements.scriptsList.innerHTML = scripts.length > 0
            ? scripts.map(s => `
                <button onclick="window.app.loadScriptToEditor('${s.id}')" 
                    class="w-full text-left p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition text-sm flex justify-between items-center">
                    <span>${s.name}</span>
                    <button onclick="event.stopPropagation(); window.app.deleteScript('${s.id}')" class="text-red-500 hover:text-red-700 ml-2 text-xs">X</button>
                </button>
            `).join('')
            : '<p class="text-gray-500">No scripts saved.</p>';

        app.elements.postScriptSelect.innerHTML = '<option value="">-- No Script Selected --</option>' + 
            scripts.map(s => `<option value="${s.id}" ${s.id === app.currentRequest.postScriptId ? 'selected' : ''}>${s.name}</option>`).join('');

        // Update script editor fields based on currentScript
        app.elements.postScriptEditor.value = app.currentScript.code;
        app.elements.scriptNameInput.value = app.currentScript.name;
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
            app.elements.urlInput.value = request.url;
            app.elements.methodSelect.value = request.method;
            app.elements.bodyTextarea.value = request.body;
            app.elements.requestTitleInput.value = request.title;
            app.elements.postScriptSelect.value = request.postScriptId || '';
            
            const scripts = getAllScripts();
            const script = scripts.find(s => s.id === request.postScriptId);
            if (script) {
                app.currentScript.name = script.name;
                app.currentScript.code = script.code;
            } else {
                app.currentScript = { id: null, name: 'Untitled Script', code: '' };
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
    
    deleteScript(id) {
         if (confirm('Are you sure you want to delete this script?')) {
            let scripts = getAllScripts().filter(s => s.id !== id);
            saveCollection(STORAGE_KEYS.SCRIPTS, scripts); // Assuming saveCollection is accessible or imported. Let's make sure it is from storage.js.
            app.renderCollections();
            if (app.currentRequest.postScriptId === id) {
                app.currentRequest.postScriptId = '';
                app.elements.postScriptSelect.value = '';
            }
        }
    },

    deleteVariable(key) {
        if (confirm(`Are you sure you want to delete variable '${key}'?`)) {
            let vars = getVariableStore();
            delete vars[key];
            saveVariableStore(vars);
            app.renderVariableStore();
        }
    },

    // --- Request/Header Logic ---

    updateHeader(index, field, value) {
        app.currentRequest.rawHeaders[index][field] = value;
        if (index === app.currentRequest.rawHeaders.length - 1 && (app.currentRequest.rawHeaders[index].key || app.currentRequest.rawHeaders[index].value)) {
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
            app.renderHeaders();
        }
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
            postScriptId: app.elements.postScriptSelect.value,
        };
        
        const savedReq = saveRequest(requestToSave);
        app.currentRequest.id = savedReq.id; 
        app.elements.requestTitleInput.value = savedReq.title;
        alert(`Request saved as: ${savedReq.title}`);
        app.renderCollections();
    },

    saveCurrentScript() {
        const scriptName = app.elements.scriptNameInput.value || 'Untitled Script';
        const scriptCode = app.elements.postScriptEditor.value;

        const scriptToSave = {
            id: app.currentScript.id, 
            name: scriptName,
            code: scriptCode,
        };

        const savedScript = saveScript(scriptToSave);
        app.currentScript.id = savedScript.id; 
        app.currentRequest.postScriptId = savedScript.id;
        
        alert(`Script saved as: ${savedScript.name}`);
        app.renderCollections();
    },
    
    // --- Send & Response Handlers ---

    handleSend() {
        const rawHeaders = app.currentRequest.rawHeaders.filter(h => h.key || h.value);
        const postScriptId = app.elements.postScriptSelect.value;
        
        app.elements.responseBody.textContent = 'Sending request...';
        app.elements.responseStatus.textContent = 'Status: Sending...';
        app.elements.scriptOutput.textContent = '';
        app.switchMainTab('response'); 
        
        executeRequest(
            app.elements.urlInput.value,
            app.elements.methodSelect.value,
            rawHeaders,
            app.elements.bodyTextarea.value,
            postScriptId,
            app.displayResponse // Pass the UI function to the request module
        );
    },

    displayResponse(response, responseData, scriptOutput, processedUrl, duration) {
        // 1. Status and Time
        const status = response.status || 'N/A';
        const statusText = response.statusText || 'N/A';
        const statusColor = status >= 200 && status < 300 ? 'text-green-500' : (status >= 400 ? 'text-red-500' : 'text-gray-500');
        
        app.elements.responseStatus.className = `font-bold ${statusColor}`;
        app.elements.responseStatus.textContent = `Status: ${status} ${statusText}`;
        app.elements.responseTime.textContent = `Time: ${duration}ms`;
        app.elements.processedUrl.textContent = `URL: ${processedUrl.substring(0, 50)}...`;

        // 2. Response Body
        try {
            const formattedBody = typeof responseData === 'object' 
                ? JSON.stringify(responseData, null, 2) 
                : String(responseData);
            app.elements.responseBody.textContent = formattedBody;
        } catch (e) {
            app.elements.responseBody.textContent = String(responseData);
        }

        // 3. Response Headers
        let headerText = '';
        if (response.headers) {
            response.headers.forEach((value, name) => {
                headerText += `${name}: ${value}\n`;
            });
        }
        app.elements.responseHeaders.textContent = headerText;

        // 4. Script Output
        app.elements.scriptOutput.textContent = scriptOutput;
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


        // Attach event listeners
        document.getElementById('send-btn').onclick = app.handleSend;
        document.getElementById('save-request-btn').onclick = app.saveCurrentRequest;
        document.getElementById('save-script-btn').onclick = app.saveCurrentScript;
        document.getElementById('add-header-btn').onclick = () => {
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
            app.renderHeaders();
        };
        document.getElementById('add-var-btn').onclick = () => {
            const key = document.getElementById('var-key-input').value.trim();
            const value = document.getElementById('var-value-input').value.trim();
            if (key) {
                setVariable(key, value);
                document.getElementById('var-key-input').value = '';
                document.getElementById('var-value-input').value = '';
            } else {
                alert('Variable key cannot be empty.');
            }
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

        // Export/Import listeners
        document.getElementById('export-btn').onclick = () => exportAllData(getVariableStore(), getAllRequests(), getAllScripts());
        document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();

        // Add a default variable if the store is empty
        if (Object.keys(variableStore).length === 0) {
            setVariable('baseUrl', 'https://jsonplaceholder.typicode.com');
            setVariable('token', 'initial_token_123');
        }
    }
};

// Expose app functions globally for inline HTML event handlers (e.g., onclick)
window.app = app;

// Start the application after the DOM is fully loaded
window.onload = app.init;