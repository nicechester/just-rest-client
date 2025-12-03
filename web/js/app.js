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
    STORAGE_KEYS
} from './storage.js';

import { 
    getVariableStore, 
    setVariable, 
    variableStore, // Need this initial export to set default variables
    loadInitialVariables // Function to load variables from storage in variables.js
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
        postScriptId: ''
    },
    
    currentScript: {
        id: null,
        name: 'Untitled Script',
        code: ''
    },
    
    currentPreScript: {
        id: null,
        name: 'Untitled Pre-Script',
        code: ''
    },
    
    currentSidebarTab: 'variables',
    currentMainTab: 'request',
    
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
        const vars = getVariableStore();
        app.elements.variablesList.innerHTML = Object.entries(vars).map(([key, value]) => `
            <div class="flex justify-between items-center bg-gray-100 p-2 rounded-lg">
                <span class="font-mono text-xs text-gray-700">${key}</span>
                <span class="font-mono text-xs text-blue-600 truncate max-w-[60%]">${value}</span>
                <button data-delete-var="${key}" class="delete-var-btn text-red-500 hover:text-red-700 ml-2 text-xs">X</button>
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
                <div class="w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm flex justify-between items-center">
                    <button data-load-request="${r.id}" class="load-request-btn flex-1 text-left flex justify-between items-center">
                        <span>${r.title}</span>
                        <span class="text-xs font-mono text-gray-500">${r.method}</span>
                    </button>
                    <button data-delete-request="${r.id}" class="delete-request-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : '<p class="text-gray-500">No requests saved.</p>';

        // Render Scripts List and Select
        const scripts = getAllScripts();
        app.elements.scriptsList.innerHTML = scripts.length > 0
            ? scripts.map(s => `
                <div class="w-full p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition text-sm flex justify-between items-center">
                    <button data-load-script="${s.id}" class="load-script-btn flex-1 text-left">
                        <span>${s.name}</span>
                    </button>
                    <button data-delete-script="${s.id}" class="delete-script-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : '<p class="text-gray-500">No scripts saved.</p>';

        // Separate pre and post scripts
        const preScripts = scripts.filter(s => s.type === 'pre-request');
        const postScripts = scripts.filter(s => s.type !== 'pre-request');
        
        app.elements.preScriptSelect.innerHTML = '<option value="">-- No Pre-Script Selected --</option>' + 
            preScripts.map(s => `<option value="${s.id}" ${s.id === app.currentRequest.preScriptId ? 'selected' : ''}>${s.name}</option>`).join('');
        
        app.elements.postScriptSelect.innerHTML = '<option value="">-- No Post-Script Selected --</option>' + 
            postScripts.map(s => `<option value="${s.id}" ${s.id === app.currentRequest.postScriptId ? 'selected' : ''}>${s.name}</option>`).join('');

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
            let vars = getVariableStore();
            delete vars[key];
            saveVariableStore(vars);
            app.renderVariableStore();
        });
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
            preScriptId: app.elements.preScriptSelect.value,
            postScriptId: app.elements.postScriptSelect.value,
        };
        
        const savedReq = saveRequest(requestToSave);
        app.currentRequest.id = savedReq.id; 
        app.elements.requestTitleInput.value = savedReq.title;
        alert(`Request saved as: ${savedReq.title}`);
        app.renderCollections();
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
            postScriptId: ''
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
        };

        const savedScript = saveScript(scriptToSave);
        app.currentScript = savedScript; // Update entire current script object
        app.currentRequest.postScriptId = savedScript.id;
        
        alert(`Script saved as: ${savedScript.name}`);
        app.renderCollections();
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
        
        executeRequest(
            app.elements.urlInput.value,
            app.elements.methodSelect.value,
            rawHeaders,
            app.elements.bodyTextarea.value,
            preScriptId,
            postScriptId,
            app.displayResponse // Pass the UI function to the request module
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
                setVariable(key, value);
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
                type: 'pre-request'
            };

            const savedScript = saveScript(scriptToSave);
            app.currentPreScript = savedScript; // Update entire current pre-script object
            app.currentRequest.preScriptId = savedScript.id;
            
            alert(`Pre-request script saved as: ${savedScript.name}`);
            app.renderCollections();
        };

        // Event delegation for dynamically rendered delete and load buttons
        const variablesList = document.getElementById('variables-list');
        const requestsList = document.getElementById('requests-list');
        const scriptsList = document.getElementById('scripts-list');
        
        if (variablesList) {
            variablesList.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-var-btn')) {
                    const key = e.target.getAttribute('data-delete-var');
                    if (key) app.deleteVariable(key);
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
// Check if DOM is already loaded (common with ES modules/Vite)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', app.init);
} else {
    app.init();
}