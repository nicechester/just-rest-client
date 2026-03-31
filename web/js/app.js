/**
 * @fileoverview Main application controller.
 * This file orchestrates the UI, handles user interaction, and imports/connects
 * all specialized modules (storage, variables, scripting, request).
 */

// --- Module Imports ---

// Import JSON Editor library
import { createJSONEditor } from 'vanilla-jsoneditor';

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
    addGroupName,
    loadGroupNames,
    saveGroupNames,
    renameGroup
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

// Script Combobox Class for type-ahead functionality
class ScriptCombobox {
    constructor(inputEl, dropdownEl, onSelect) {
        this.input = typeof inputEl === 'string' ? document.getElementById(inputEl) : inputEl;
        this.dropdown = typeof dropdownEl === 'string' ? document.getElementById(dropdownEl) : dropdownEl;
        this.onSelect = onSelect;
        this.allScripts = [];
        this.highlightedIndex = -1;
        
        this.init();
    }
    
    init() {
        if (!this.input || !this.dropdown) return;

        // Input events
        this.input.addEventListener('input', () => this.filterAndShow());
        this.input.addEventListener('focus', () => this.filterAndShow());
        this.input.addEventListener('blur', () => {
            // Delay to allow click on dropdown
            setTimeout(() => this.hide(), 200);
        });

        // Keyboard navigation
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Click outside to close
        this._docClickHandler = (e) => {
            if (!this.input.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.hide();
            }
        };
        document.addEventListener('click', this._docClickHandler);
    }
    
    setScripts(scripts) {
        this.allScripts = scripts;
    }
    
    filterAndShow() {
        const searchTerm = this.input.value.toLowerCase().trim();
        const filtered = searchTerm 
            ? this.allScripts.filter(s => 
                s.name.toLowerCase().includes(searchTerm) || 
                s.group.toLowerCase().includes(searchTerm)
              )
            : this.allScripts;
        
        this.renderDropdown(filtered);
        if (filtered.length > 0 || searchTerm) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    renderDropdown(scripts) {
        this.highlightedIndex = -1;
        
        if (scripts.length === 0) {
            this.dropdown.innerHTML = '<div class="script-combobox-empty">No scripts found</div>';
            return;
        }
        
        this.dropdown.innerHTML = scripts.map((s, index) => `
            <div class="script-combobox-option" data-script-id="${s.id}" data-index="${index}">
                <span class="script-name">${s.name}</span>
                <span class="script-group">(${s.group})</span>
            </div>
        `).join('');
        
        // Add click handlers
        this.dropdown.querySelectorAll('.script-combobox-option').forEach((option) => {
            option.addEventListener('click', (e) => {
                const scriptId = option.getAttribute('data-script-id');
                const script = this.allScripts.find(s => s.id === scriptId);
                if (script) {
                    this.selectScript(script);
                }
            });
            
            option.addEventListener('mouseenter', (e) => {
                this.highlightedIndex = parseInt(option.getAttribute('data-index'));
                this.updateHighlight();
            });
        });
    }
    
    handleKeydown(e) {
        const options = this.dropdown.querySelectorAll('.script-combobox-option');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (options.length > 0) {
                this.highlightedIndex = Math.min(this.highlightedIndex + 1, options.length - 1);
                this.updateHighlight();
                this.scrollToHighlighted();
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (options.length > 0) {
                this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
                this.updateHighlight();
                this.scrollToHighlighted();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.highlightedIndex >= 0 && options[this.highlightedIndex]) {
                const scriptId = options[this.highlightedIndex].getAttribute('data-script-id');
                const script = this.allScripts.find(s => s.id === scriptId);
                if (script) {
                    this.selectScript(script);
                }
            }
        } else if (e.key === 'Escape') {
            this.hide();
            this.input.blur();
        }
    }
    
    updateHighlight() {
        const options = this.dropdown.querySelectorAll('.script-combobox-option');
        options.forEach((opt, idx) => {
            if (idx === this.highlightedIndex) {
                opt.classList.add('highlighted');
            } else {
                opt.classList.remove('highlighted');
            }
        });
    }
    
    scrollToHighlighted() {
        const options = this.dropdown.querySelectorAll('.script-combobox-option');
        if (options[this.highlightedIndex]) {
            options[this.highlightedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    selectScript(script) {
        if (this.onSelect) {
            this.onSelect(script);
        }
        this.input.value = '';
        this.hide();
        this.input.blur();
    }
    
    show() {
        this.dropdown.classList.remove('hidden');
    }
    
    hide() {
        this.dropdown.classList.add('hidden');
        this.highlightedIndex = -1;
    }
    
    clear() {
        this.input.value = '';
        this.hide();
    }

    destroy() {
        if (this._docClickHandler) {
            document.removeEventListener('click', this._docClickHandler);
            this._docClickHandler = null;
        }
    }
}

const app = {
    // --- Multi-tab state ---
    tabs: [],          // array of tab objects
    activeTabId: null, // id of the currently active tab

    _tabCounter: 0,

    _newTabData() {
        return {
            id: `tab-${++app._tabCounter}`,
            request: {
                id: null,
                title: 'New Request',
                url: '',
                method: 'GET',
                rawHeaders: [{ key: '', value: '' }],
                body: '',
                preScriptIds: [],
                postScriptIds: [],
                group: DEFAULT_GROUP,
                originalTitle: null
            },
            result: null,          // null = no result yet
            jsonEditor: null,      // per-tab JSON editor instance
            requestBodyEditor: null // per-tab request body editor
        };
    },

    // Convenience getter for the active tab object
    get activeTab() {
        return app.tabs.find(t => t.id === app.activeTabId) || null;
    },

    // Convenience getter/setter that proxies to activeTab.request
    get currentRequest() {
        return app.activeTab ? app.activeTab.request : {};
    },
    set currentRequest(val) {
        if (app.activeTab) app.activeTab.request = val;
    },

    currentScript: {
        id: null,
        name: 'Untitled Script',
        code: '',
        group: DEFAULT_GROUP
    },

    currentSidebarTab: 'variables',

    // Active groups for each collection type
    activeGroups: {
        variables: DEFAULT_GROUP,
        requests: DEFAULT_GROUP,
        scripts: DEFAULT_GROUP
    },

    // CodeMirror editor instances (legacy — kept for script editor dialog)
    codeMirrorEditors: {
        preScript: null,
        postScript: null
    },

    // Legacy aliases — now per-tab, but kept so existing code paths don't break
    get jsonEditor() { return app.activeTab ? app.activeTab.jsonEditor : null; },
    set jsonEditor(v) { if (app.activeTab) app.activeTab.jsonEditor = v; },
    get requestBodyEditor() { return app.activeTab ? app.activeTab.requestBodyEditor : null; },
    set requestBodyEditor(v) { if (app.activeTab) app.activeTab.requestBodyEditor = v; },
    
    // Helper methods for request body
    getRequestBody(tab) {
        const t = tab || app.activeTab;
        if (!t) return '';
        const panelEl = document.getElementById(`tab-panel-${t.id}`);
        const textarea = panelEl && panelEl.querySelector('#request-body-editor');
        return textarea ? textarea.value : '';
    },

    setRequestBody(bodyContent, tab) {
        const t = tab || app.activeTab;
        if (!t) return;
        const panelEl = document.getElementById(`tab-panel-${t.id}`);
        const textarea = panelEl && panelEl.querySelector('#request-body-editor');
        if (textarea) textarea.value = bodyContent || '';
    },
    
    toggleResponseFullscreen() {
        const tabId = app.activeTabId;
        const wrapper = document.querySelector(`#tab-panel-${tabId} #response-body-wrapper`);
        const button = document.querySelector(`#tab-panel-${tabId} #response-fullscreen-btn`);
        if (!wrapper || !button) return;
        const icon = button.querySelector('.fullscreen-icon');
        const container = wrapper.querySelector('#json-editor-container');

        if (wrapper.classList.contains('fullscreen')) {
            wrapper.classList.remove('fullscreen');
            icon.textContent = '⛶';
            button.title = 'Toggle Fullscreen';
            setTimeout(() => {
                if (container) container.style.height = localStorage.getItem('editor-height-json-editor-container') || '400px';
                window.dispatchEvent(new Event('resize'));
            }, 100);
        } else {
            wrapper.classList.add('fullscreen');
            icon.textContent = '✕';
            button.title = 'Exit Fullscreen (Esc)';
            setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && wrapper.classList.contains('fullscreen')) {
                    app.toggleResponseFullscreen();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }
    },
    
    initResizeHandles(panelEl) {
        const handles = panelEl.querySelectorAll('.resize-handle');
        handles.forEach(handle => {
            let isResizing = false;
            let startY = 0;
            let startHeight = 0;
            let targetElement = null;

            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                const targetId = handle.dataset.target;
                targetElement = panelEl.querySelector(`#${targetId}`);
                if (targetElement) {
                    startHeight = targetElement.offsetHeight;
                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                }
                e.preventDefault();
            });

            if (!panelEl._resizeCleanups) panelEl._resizeCleanups = [];

            const onMove = (e) => {
                if (!isResizing || !targetElement) return;
                const newHeight = Math.max(50, startHeight + (e.clientY - startY));
                targetElement.style.height = `${newHeight}px`;
            };
            const onUp = () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (targetElement) {
                        localStorage.setItem(`editor-height-${targetElement.id}`, targetElement.style.height);
                    }
                }
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            panelEl._resizeCleanups.push(onMove, onUp);
        });

        // Restore saved heights
        ['request-body-editor', 'json-editor-container'].forEach(editorId => {
            const savedHeight = localStorage.getItem(`editor-height-${editorId}`);
            const element = panelEl.querySelector(`#${editorId}`);
            const maxH = editorId === 'json-editor-container' ? 400 : 200;
            if (savedHeight && element) element.style.height = Math.min(parseInt(savedHeight), maxH) + 'px';
        });
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
        show(title, message, placeholder, onConfirm, initialValue) {
            const dialog = document.getElementById('input-dialog');
            const titleEl = document.getElementById('input-dialog-title');
            const messageEl = document.getElementById('input-dialog-message');
            const inputEl = document.getElementById('input-dialog-input');
            const okBtn = document.getElementById('input-dialog-ok');
            const cancelBtn = document.getElementById('input-dialog-cancel');

            titleEl.textContent = title;
            messageEl.textContent = message;
            inputEl.placeholder = placeholder || '';
            inputEl.value = initialValue || '';
            dialog.classList.remove('hidden');

            const handleSubmit = () => {
                const value = inputEl.value.trim();
                dialog.classList.add('hidden');
                if (value) {
                    onConfirm(value);
                }
            };

            // Reassign handlers directly (replaces any previous handlers)
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    dialog.classList.add('hidden');
                }
            };

            okBtn.onclick = handleSubmit;

            cancelBtn.onclick = () => {
                dialog.classList.add('hidden');
            };

            // Focus and select after DOM is ready
            setTimeout(() => {
                inputEl.focus();
                inputEl.select();
            }, 100);
        }
    },
    
    // About dialog (also serves as splash screen)
    showAbout() {
        const dialog = document.getElementById('about-dialog');
        if (dialog) {
            dialog.classList.remove('hidden');
        }
    },
    
    hideAbout() {
        const dialog = document.getElementById('about-dialog');
        if (dialog) {
            dialog.classList.add('hidden');
        }
    },
    
    // Generate cURL command
    generateCurlCommand() {
        const url = app.elements.urlInput.value || '';
        const method = app.elements.methodSelect.value;
        const headers = app.currentRequest.rawHeaders.filter(h => h.key);
        const body = app.getRequestBody();
        
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
    
    /**
     * Parse and import a Postman collection
     * @param {object} postmanCollection - The Postman collection JSON object
     * @returns {object} Import summary {variablesImported, requestsImported, scriptsImported}
     */
    /**
     * Transforms Postman script syntax to Just REST Client syntax.
     * @param {string} code - The original Postman script code
     * @return {string} Transformed script code
     */
    transformPostmanScript(code) {
        if (!code) return code;
        
        let transformed = code;
        
        // 1. Replace pm.response.json() with responseData
        transformed = transformed.replace(/pm\.response\.json\(\)/g, 'responseData');
        
        // 2. Replace pm.environment.set and pm.collectionVariables.set with setVar
        transformed = transformed.replace(/pm\.(environment|collectionVariables|variables)\.set\(/g, 'setVar(');
        
        // 3. Replace pm.environment.get and pm.collectionVariables.get with getVar
        transformed = transformed.replace(/pm\.(environment|collectionVariables|variables)\.get\(/g, 'getVar(');
        
        // 4. Transform pm.sendRequest callback pattern to await http
        // Pattern: pm.sendRequest(url, function(err, response) { ... })
        // Replace with: const response = await http(url); // Manual: Convert callback body
        const sendRequestPattern = /pm\.sendRequest\(\s*([^,]+),\s*function\s*\(\s*(?:err\s*,\s*)?response\s*\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\s*\)/gs;
        
        transformed = transformed.replace(sendRequestPattern, (match, url, callbackBody) => {
            // Transform the callback body
            let transformedBody = callbackBody;
            
            // Replace response.json() with response.data (already parsed in Just REST Client)
            transformedBody = transformedBody.replace(/response\.json\(\)/g, 'response.data');
            
            // Replace pm.environment.set in callback body
            transformedBody = transformedBody.replace(/pm\.(environment|collectionVariables|variables)\.set\(/g, 'setVar(');
            
            // Build the transformed code
            return `const response = await http(${url});${transformedBody}`;
        });
        
        // 5. Add helpful comment if pm.sendRequest is still present (complex cases)
        if (transformed.includes('pm.sendRequest')) {
            transformed = '// Note: pm.sendRequest requires manual conversion to: await http(url, options)\n' + transformed;
        }
        
        // 6. Replace console.log with log (optional, for consistency)
        transformed = transformed.replace(/console\.log\(/g, 'log(');
        
        return transformed;
    },

    importPostmanCollection(postmanCollection) {
        const groupName = postmanCollection.info?.name || 'Imported Collection';
        const summary = {
            groupName: groupName,
            variablesImported: 0,
            requestsImported: 0,
            scriptsImported: 0
        };
        
        // 1. Import Variables
        if (postmanCollection.variable && postmanCollection.variable.length > 0) {
            const varStore = getVariableStore();
            if (!varStore[groupName]) {
                varStore[groupName] = {};
            }
            
            postmanCollection.variable.forEach(pmVar => {
                if (pmVar.key) {
                    varStore[groupName][pmVar.key] = pmVar.value || '';
                    summary.variablesImported++;
                }
            });
            
            saveVariableStore(varStore);
            addGroupName('variables', groupName);
        }
        
        // 2. Import Requests (recursive for folders)
        // Use counter to ensure unique IDs even when Date.now() is the same
        let importCounter = 0;
        const importItems = (items, folder = '') => {
            items.forEach(item => {
                if (item.item) {
                    // This is a folder, recurse into it
                    const folderName = folder ? `${folder} / ${item.name}` : item.name;
                    importItems(item.item, folderName);
                } else if (item.request) {
                    // This is a request
                    const request = item.request;
                    const requestName = folder ? `${folder} / ${item.name}` : item.name;
                    
                    // Build URL from Postman format
                    let url = '';
                    if (typeof request.url === 'string') {
                        url = request.url;
                    } else if (request.url && request.url.raw) {
                        url = request.url.raw;
                    } else if (request.url) {
                        // Build from parts
                        const protocol = request.url.protocol || 'https';
                        const host = Array.isArray(request.url.host) ? request.url.host.join('.') : request.url.host;
                        const path = Array.isArray(request.url.path) ? '/' + request.url.path.join('/') : '';
                        const query = Array.isArray(request.url.query) ? 
                            '?' + request.url.query.map(q => `${q.key}=${q.value}`).join('&') : '';
                        url = `${protocol}://${host}${path}${query}`;
                    }
                    
                    // Extract headers
                    const headers = [];
                    if (request.header && Array.isArray(request.header)) {
                        request.header.forEach(h => {
                            if (h.key && !h.disabled) {
                                headers.push({ key: h.key, value: h.value || '' });
                            }
                        });
                    }
                    
                    // Extract body
                    let body = '';
                    if (request.body) {
                        if (request.body.mode === 'raw' && request.body.raw) {
                            body = request.body.raw;
                        } else if (request.body.mode === 'urlencoded' && request.body.urlencoded) {
                            // Convert form data to JSON
                            const formData = {};
                            request.body.urlencoded.forEach(item => {
                                if (!item.disabled) {
                                    formData[item.key] = item.value;
                                }
                            });
                            body = JSON.stringify(formData, null, 2);
                        }
                        // Note: formdata mode with file uploads is not supported
                    }
                    
                    // Handle pre-request scripts
                    const preScriptIds = [];
                    const preRequestEvent = item.event?.find(e => e.listen === 'prerequest');
                    if (preRequestEvent && preRequestEvent.script && preRequestEvent.script.exec) {
                        const preScriptCode = Array.isArray(preRequestEvent.script.exec) ? 
                            preRequestEvent.script.exec.join('\n') : preRequestEvent.script.exec;
                        
                        if (preScriptCode.trim()) {
                            importCounter++;
                            // Transform Postman script syntax to Just REST Client syntax
                            const transformedCode = app.transformPostmanScript(preScriptCode);
                            const preScript = {
                                id: `script-${Date.now()}-${importCounter}`,
                                name: `${requestName} - Pre`,
                                code: transformedCode,
                                type: 'pre-request',
                                group: groupName
                            };
                            const savedPreScript = saveScript(preScript);
                            preScriptIds.push(savedPreScript.id);
                            summary.scriptsImported++;
                        }
                    }
                    
                    // Handle test/post-request scripts
                    const postScriptIds = [];
                    const testEvent = item.event?.find(e => e.listen === 'test');
                    if (testEvent && testEvent.script && testEvent.script.exec) {
                        const testScriptCode = Array.isArray(testEvent.script.exec) ? 
                            testEvent.script.exec.join('\n') : testEvent.script.exec;
                        
                        if (testScriptCode.trim()) {
                            importCounter++;
                            // Transform Postman script syntax to Just REST Client syntax
                            const transformedCode = app.transformPostmanScript(testScriptCode);
                            const postScript = {
                                id: `script-${Date.now()}-${importCounter}`,
                                name: `${requestName} - Post`,
                                code: transformedCode,
                                group: groupName
                            };
                            const savedPostScript = saveScript(postScript);
                            postScriptIds.push(savedPostScript.id);
                            summary.scriptsImported++;
                        }
                    }
                    
                    // Save the request
                    // Generate unique ID for import to prevent deduplication
                    importCounter++;
                    const requestToSave = {
                        id: `req-${Date.now()}-${importCounter}`,
                        title: requestName,
                        url: url,
                        method: request.method || 'GET',
                        rawHeaders: headers.length > 0 ? [...headers, { key: '', value: '' }] : [{ key: '', value: '' }],
                        body: body,
                        preScriptIds: preScriptIds,
                        postScriptIds: postScriptIds,
                        group: groupName
                    };
                    
                    saveRequest(requestToSave);
                    summary.requestsImported++;
                }
            });
        };
        
        if (postmanCollection.item && Array.isArray(postmanCollection.item)) {
            importItems(postmanCollection.item);
        }
        
        // Persist the group name
        addGroupName('requests', groupName);
        addGroupName('scripts', groupName);
        
        return summary;
    },
    
    /**
     * Import Postman environment as variables
     */
    importPostmanEnvironment(postmanEnv) {
        const groupName = postmanEnv.name || 'Imported Environment';
        const varStore = getVariableStore();
        
        if (!varStore[groupName]) {
            varStore[groupName] = {};
        }
        
        let variablesImported = 0;
        if (postmanEnv.values && Array.isArray(postmanEnv.values)) {
            postmanEnv.values.forEach(item => {
                if (item.key && item.enabled !== false) {
                    varStore[groupName][item.key] = item.value || '';
                    variablesImported++;
                }
            });
        }
        
        saveVariableStore(varStore);
        addGroupName('variables', groupName);
        
        return {
            groupName: groupName,
            variablesImported: variablesImported
        };
    },
    
    /**
     * Handle Postman collection or environment import from file
     */
    async handlePostmanImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const fileContent = await file.text();
            const postmanData = JSON.parse(fileContent);
            
            // Check if it's an environment file
            if (postmanData._postman_variable_scope === 'environment' || 
                (postmanData.values && Array.isArray(postmanData.values) && !postmanData.item)) {
                
                const summary = app.importPostmanEnvironment(postmanData);
                
                // Switch to the new group FIRST
                app.switchGroup('variables', summary.groupName);
                
                // Then refresh UI (this will show the correct selected group)
                app.renderGroupSelectors();
                app.renderVariableStore();
                
                // Show summary
                alert(`✓ Postman Environment imported!\n\nGroup: ${summary.groupName}\nVariables: ${summary.variablesImported}`);
                
            } 
            // Check if it's a collection file
            else if (postmanData.info && postmanData.info.schema && 
                postmanData.info.schema.includes('getpostman.com')) {
                
                const summary = app.importPostmanCollection(postmanData);
                
                // Switch to the new group FIRST
                app.switchGroup('variables', summary.groupName);
                app.switchGroup('requests', summary.groupName);
                app.switchGroup('scripts', summary.groupName);
                
                // Then refresh UI (this will show the correct selected groups)
                app.renderGroupSelectors();
                app.renderVariableStore();
                app.renderCollections();
                
                // Show summary
                alert(`✓ Postman Collection imported!\n\nGroup: ${summary.groupName}\nVariables: ${summary.variablesImported}\nRequests: ${summary.requestsImported}\nScripts: ${summary.scriptsImported}`);
            }
            else {
                alert('Invalid Postman file format. Please select a valid Postman Collection or Environment JSON file.');
                return;
            }
            
        } catch (error) {
            alert('Failed to import Postman file: ' + error.message);
            console.error('Import error:', error);
        }
        
        // Reset file input
        event.target.value = '';
    },
    
    /**
     * Parse a cURL command and extract request details
     * @param {string} curlCommand - The cURL command to parse
     * @returns {object} Parsed request details {url, method, headers, body}
     */
    parseCurlCommand(curlCommand) {
        const result = {
            url: '',
            method: 'GET',
            headers: [],
            body: ''
        };
        
        if (!curlCommand || typeof curlCommand !== 'string') {
            return result;
        }
        
        // Remove 'curl' at the start and normalize whitespace
        let cmd = curlCommand.trim();
        if (cmd.startsWith('curl')) {
            cmd = cmd.substring(4).trim();
        }
        
        // Replace line continuations (backslash newline) with space
        cmd = cmd.replace(/\\\s*\n\s*/g, ' ');
        
        // Extract method (-X or --request)
        const methodMatch = cmd.match(/(?:-X|--request)\s+([A-Z]+)/);
        if (methodMatch) {
            result.method = methodMatch[1];
        }
        
        // Extract headers (-H or --header)
        // Use matchAll to get all matches without modifying the string
        const headerRegex = /(?:-H|--header)\s+(['"])(.*?)\1/g;
        const headerMatches = [...cmd.matchAll(headerRegex)];
        headerMatches.forEach(match => {
            const headerValue = match[2];
            const colonIndex = headerValue.indexOf(':');
            if (colonIndex > 0) {
                const key = headerValue.substring(0, colonIndex).trim();
                const value = headerValue.substring(colonIndex + 1).trim();
                result.headers.push({ key, value });
            }
        });
        
        // Extract body data (-d, --data, --data-raw, --data-binary)
        const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/;
        const dataMatch = cmd.match(dataRegex);
        if (dataMatch) {
            result.body = dataMatch[2];
            // If no method was explicitly specified but data is present, default to POST (curl behavior)
            if (result.method === 'GET') {
                result.method = 'POST';
            }
        }
        
        // Extract URL (remaining quoted or unquoted string)
        // Try quoted URL first
        const quotedUrlMatch = cmd.match(/(['"])(https?:\/\/[^\1]*?)\1/);
        if (quotedUrlMatch) {
            result.url = quotedUrlMatch[2];
        } else {
            // Try unquoted URL
            const unquotedUrlMatch = cmd.match(/(https?:\/\/\S+)/);
            if (unquotedUrlMatch) {
                result.url = unquotedUrlMatch[1];
            }
        }
        
        return result;
    },
    
    /**
     * Show the import cURL dialog
     */
    showImportCurlDialog() {
        const dialog = document.getElementById('import-curl-dialog');
        const input = document.getElementById('import-curl-input');
        const parseBtn = document.getElementById('import-curl-parse');
        const cancelBtn = document.getElementById('import-curl-cancel');
        
        input.value = '';
        dialog.classList.remove('hidden');
        input.focus();
        
        // Remove old listeners
        const newParseBtn = parseBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        parseBtn.parentNode.replaceChild(newParseBtn, parseBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // Add new listeners
        newParseBtn.onclick = () => {
            const curlCommand = input.value.trim();
            if (!curlCommand) {
                alert('Please paste a cURL command');
                return;
            }
            
            try {
                const parsed = app.parseCurlCommand(curlCommand);
                app.populateRequestFromParsedCurl(parsed);
                dialog.classList.add('hidden');
            } catch (error) {
                alert('Failed to parse cURL command: ' + error.message);
            }
        };
        
        newCancelBtn.onclick = () => {
            dialog.classList.add('hidden');
        };
        
        // Allow Escape key to close
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                dialog.classList.add('hidden');
            }
        };
    },
    
    /**
     * Populate the request form with parsed cURL data
     * @param {object} parsed - Parsed cURL data
     */
    populateRequestFromParsedCurl(parsed) {
        if (!app.activeTab) app.createTab();
        const tab = app.activeTab;
        const panelEl = document.getElementById(`tab-panel-${tab.id}`);

        if (parsed.url) { panelEl.querySelector('#url-input').value = parsed.url; tab.request.url = parsed.url; }
        if (parsed.method) { panelEl.querySelector('#method-select').value = parsed.method; tab.request.method = parsed.method; }
        if (parsed.headers && parsed.headers.length > 0) {
            tab.request.rawHeaders = [...parsed.headers, { key: '', value: '' }];
            app.renderHeaders();
        }
        if (parsed.body) app.setRequestBody(parsed.body);

        tab.request.id = null;
        tab.request.title = 'Imported from cURL';
        tab.request.group = app.activeGroups.requests;
        tab.request.preScriptIds = [];
        tab.request.postScriptIds = [];
        tab.request.originalTitle = null;
        panelEl.querySelector('#request-title-input').value = 'Imported from cURL';
        app.renderPreScriptsList();
        app.renderPostScriptsList();
        app.renderTabBar();
    },
    
    applyTemplateToString(str) {
        if (!str) return str;
        const vars = getFlattenedVariables(app.activeGroups.variables);
        return str.replace(/\{\{(.*?)\}\}/g, (match, varName) => {
            const key = varName.trim();
            return vars[key] !== undefined ? vars[key] : match;
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
        // These are now resolved dynamically from the active tab panel
        get urlInput() { return app._activeEl('url-input'); },
        get methodSelect() { return app._activeEl('method-select'); },
        get headersContainer() { return app._activeEl('headers-container'); },
        get requestTitleInput() { return app._activeEl('request-title-input'); },
        get preScriptInput() { return app._activeEl('pre-script-input'); },
        get postScriptInput() { return app._activeEl('post-script-input'); },
        get preScriptDropdown() { return app._activeEl('pre-script-dropdown'); },
        get postScriptDropdown() { return app._activeEl('post-script-dropdown'); },
        get preScriptsList() { return app._activeEl('pre-scripts-list'); },
        get postScriptsList() { return app._activeEl('post-scripts-list'); },
        get responseStatus() { return app._activeEl('response-status'); },
        get responseTime() { return app._activeEl('response-time'); },
        // Sidebar elements are global (not per-tab)
        variableSearchInput: document.getElementById('variable-search-input'),
        requestSearchInput: document.getElementById('request-search-input'),
        scriptSearchInput: document.getElementById('script-search-input'),
        variablesList: document.getElementById('variables-list'),
        requestsList: document.getElementById('requests-list'),
        scriptsList: document.getElementById('scripts-list'),
    },

    // Helper: find an element within the active tab panel
    _activeEl(id) {
        if (!app.activeTabId) return document.getElementById(id);
        const panel = document.getElementById(`tab-panel-${app.activeTabId}`);
        return panel ? panel.querySelector(`#${id}`) : document.getElementById(id);
    },

    // --- Tab Management ---

    _tabLabel(tab) {
        const method = tab.request.method || 'GET';
        const title = tab.request.title && tab.request.title !== 'New Request'
            ? tab.request.title
            : (tab.request.url ? tab.request.url.replace(/^https?:\/\//, '').substring(0, 30) : 'New Request');
        return { method, title };
    },

    renderTabBar() {
        const bar = document.getElementById('request-tab-bar');
        const addBtn = document.getElementById('new-tab-btn');

        // Remove old tab elements (keep the + button)
        bar.querySelectorAll('.request-tab').forEach(el => el.remove());

        app.tabs.forEach(tab => {
            const { method, title } = app._tabLabel(tab);
            const el = document.createElement('div');
            el.className = 'request-tab' + (tab.id === app.activeTabId ? ' active' : '');
            el.dataset.tabId = tab.id;
            el.innerHTML = `
                <span class="tab-method">${method}</span>
                <span class="tab-label" title="${title}">${title}</span>
                <span class="tab-close" data-close-tab="${tab.id}">×</span>
            `;
            el.addEventListener('click', (e) => {
                if (e.target.dataset.closeTab) {
                    app.closeTab(e.target.dataset.closeTab);
                } else {
                    app.switchTab(tab.id);
                }
            });
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                app._showTabContextMenu(tab.id, e);
            });
            bar.insertBefore(el, addBtn);
        });
    },

    _buildTabPanelHTML(tabId) {
        return `
        <div id="tab-panel-${tabId}" class="tab-panel-container" style="display:none">
            <div class="tab-panel-scroll bg-white p-6 space-y-4">
                <!-- Save Request -->
                <div class="flex space-x-2 pb-4 border-b">
                    <input type="text" id="request-title-input" placeholder="Request Title" class="flex-1 p-3 border rounded-lg text-sm focus:ring-green-500 focus:border-green-500">
                    <button class="save-request-btn bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition text-sm min-w-[80px]">Save</button>
                </div>
                <div class="space-y-2">
                    <div class="flex space-x-2">
                        <select id="method-select" class="w-32 p-3 border rounded-lg bg-gray-100 text-sm font-semibold focus:ring-blue-500 focus:border-blue-500">
                            <option>GET</option><option>POST</option><option>PUT</option>
                            <option>DELETE</option><option>PATCH</option><option>HEAD</option>
                        </select>
                        <textarea id="url-input" placeholder="Enter URL (e.g., {{baseUrl}}/users)" rows="2"
                            class="flex-1 p-3 border rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-y font-mono"></textarea>
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button class="import-curl-btn bg-green-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm">Import cURL</button>
                        <button class="curl-btn bg-gray-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm">cURL</button>
                        <button class="send-btn bg-blue-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-blue-700 transition text-sm">Send</button>
                    </div>
                </div>
                <!-- Headers -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-600 mb-2">Headers</h3>
                    <div id="headers-container" class="space-y-2"></div>
                    <button class="add-header-btn mt-2 text-sm text-blue-600 hover:text-blue-800 transition">+ Add Header</button>
                </div>
                <!-- Body -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-600 mb-2">Body (POST/PUT/PATCH)</h3>
                    <textarea id="request-body-editor" rows="3" class="w-full p-2 border rounded-lg text-sm font-mono focus:ring-blue-500 focus:border-blue-500 resize-y" style="overflow-y:auto" placeholder="Request body (JSON, form-encoded, GraphQL, etc.)"></textarea>
                </div>
                <!-- Pre-Request Scripts -->
                <div class="border-t pt-4 space-y-2">
                    <h3 class="font-medium text-gray-600">Pre-Request Scripts</h3>
                    <div class="script-combobox-wrapper">
                        <input type="text" id="pre-script-input" class="script-combobox-input w-full p-2 border rounded-lg text-sm" placeholder="Type to search and add scripts..." autocomplete="off">
                        <div id="pre-script-dropdown" class="script-combobox-dropdown hidden"></div>
                    </div>
                    <div id="pre-scripts-list" class="space-y-1 min-h-[40px] p-2 border rounded-lg bg-gray-50">
                        <p class="text-gray-400 text-xs italic">No pre-request scripts selected</p>
                    </div>
                </div>
                <!-- Post-Request Scripts -->
                <div class="border-t pt-4 space-y-2">
                    <h3 class="font-medium text-gray-600">Post-Request Scripts</h3>
                    <div class="script-combobox-wrapper">
                        <input type="text" id="post-script-input" class="script-combobox-input w-full p-2 border rounded-lg text-sm" placeholder="Type to search and add scripts..." autocomplete="off">
                        <div id="post-script-dropdown" class="script-combobox-dropdown hidden"></div>
                    </div>
                    <div id="post-scripts-list" class="space-y-1 min-h-[40px] p-2 border rounded-lg bg-gray-50">
                        <p class="text-gray-400 text-xs italic">No post-request scripts selected</p>
                    </div>
                </div>
                <!-- Result section -->
                <div class="border-t pt-4">
                <h2 class="text-lg font-semibold text-gray-700 flex justify-between items-center">
                    Result
                    <div class="text-sm font-normal space-x-3">
                        <span id="response-status" class="font-bold text-gray-500">Status: ---</span>
                        <span id="response-time" class="text-gray-500">Time: ---ms</span>
                    </div>
                </h2>
                <!-- Response Body (top) -->
                <div class="border-t pt-4">
                    <div id="response-body-wrapper">
                        <div class="flex items-center justify-between mb-2">
                            <p class="text-sm font-medium text-gray-600">Response Body</p>
                            <button id="response-fullscreen-btn" class="px-3 py-1 text-xs bg-gray-600 text-white hover:bg-gray-700 rounded transition">
                                <span class="fullscreen-icon">⛶</span>
                            </button>
                        </div>
                        <div class="resizable-editor-container">
                            <div id="json-editor-container" class="rounded border border-gray-300" style="height:300px"></div>
                            <div class="resize-handle" data-target="json-editor-container"></div>
                        </div>
                    </div>
                </div>
                <!-- Request Details -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-600 mb-2 flex items-center">
                        <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold mr-2">REQUEST</span>
                        Request Details
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg space-y-3">
                        <div><p class="text-xs text-gray-500 mb-1">Request Line</p>
                            <pre id="request-line" class="bg-gray-800 text-cyan-400 p-2 rounded text-sm font-mono whitespace-pre-wrap"></pre></div>
                        <div><p class="text-xs text-gray-500 mb-1">Request Headers</p>
                            <pre id="request-headers" class="bg-gray-100 text-gray-700 p-3 rounded code-output text-xs whitespace-pre-wrap"></pre></div>
                        <div id="request-body-section" class="hidden">
                            <p class="text-xs text-gray-500 mb-1">Request Body</p>
                            <div class="bg-gray-800 p-3 rounded overflow-auto max-h-96">
                                <pre class="language-json m-0"><code id="request-body-code" class="language-json"></code></pre>
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Response Details -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-600 mb-2 flex items-center">
                        <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold mr-2">RESPONSE</span>
                        Response Details
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <p class="text-xs text-gray-500 mb-1">Response Headers</p>
                        <pre id="response-headers" class="bg-gray-100 text-gray-700 p-3 rounded code-output text-xs whitespace-pre-wrap"></pre>
                    </div>
                </div>
                <!-- Script Output -->
                <div class="border-t pt-4">
                    <h3 class="font-medium text-gray-600 mb-2">Script Output</h3>
                    <pre id="script-output" class="bg-yellow-100 text-yellow-800 p-3 rounded-lg code-output text-xs whitespace-pre-wrap"></pre>
                </div>
                </div>
            </div>
        </div>`;
    },

    createTab(requestData) {
        const tab = app._newTabData();
        if (requestData) tab.request = { ...requestData, originalTitle: requestData.title };

        app.tabs.push(tab);

        // Build DOM
        const panels = document.getElementById('request-tab-panels');
        panels.insertAdjacentHTML('beforeend', app._buildTabPanelHTML(tab.id));

        const panelEl = document.getElementById(`tab-panel-${tab.id}`);

        // Init request body as plain textarea (no JSON editor)
        tab.requestBodyEditor = null;
        const bodyTextarea = panelEl.querySelector('#request-body-editor');
        if (requestData && requestData.body) bodyTextarea.value = requestData.body;

        const jsonContainer = panelEl.querySelector('#json-editor-container');
        tab.jsonEditor = createJSONEditor({
            target: jsonContainer,
            props: { mode: 'tree', mainMenuBar: true, navigationBar: true, statusBar: true, readOnly: true }
        });

        // Init resize handles
        app.initResizeHandles(panelEl);

        // Wire up per-panel buttons
        app._wireTabPanel(panelEl, tab);

        // Init script comboboxes for this tab
        app._initTabScriptComboboxes(tab, panelEl);

        app.switchTab(tab.id);
        return tab;
    },

    _wireTabPanel(panelEl, tab) {
        panelEl.querySelector('.send-btn').onclick = app.handleSend;
        panelEl.querySelector('.save-request-btn').onclick = app.saveAsNewRequest;
        panelEl.querySelector('.import-curl-btn').onclick = app.showImportCurlDialog;
        panelEl.querySelector('.curl-btn').onclick = app.showCurlDialog;
        panelEl.querySelector('.add-header-btn').onclick = () => {
            app.currentRequest.rawHeaders.push({ key: '', value: '' });
            app.renderHeaders();
        };
        panelEl.querySelector('#response-fullscreen-btn').onclick = app.toggleResponseFullscreen;

        // URL input: update tab label live
        panelEl.querySelector('#url-input').addEventListener('input', (e) => {
            if (app.activeTab && app.activeTab.id === tab.id) {
                app.activeTab.request.url = e.target.value;
                app.renderTabBar();
            }
        });
        panelEl.querySelector('#method-select').addEventListener('change', (e) => {
            if (app.activeTab && app.activeTab.id === tab.id) {
                app.activeTab.request.method = e.target.value;
                app.renderTabBar();
            }
        });
        panelEl.querySelector('#request-title-input').addEventListener('input', (e) => {
            if (app.activeTab && app.activeTab.id === tab.id) {
                app.activeTab.request.title = e.target.value;
                app.renderTabBar();
            }
        });
    },

    _initTabScriptComboboxes(tab, panelEl) {
        tab.preScriptCombobox = new ScriptCombobox(
            panelEl.querySelector('#pre-script-input'),
            panelEl.querySelector('#pre-script-dropdown'),
            (script) => {
                if (!tab.request.preScriptIds.includes(script.id)) {
                    tab.request.preScriptIds.push(script.id);
                    if (app.activeTabId === tab.id) app.renderPreScriptsList();
                }
            }
        );
        tab.postScriptCombobox = new ScriptCombobox(
            panelEl.querySelector('#post-script-input'),
            panelEl.querySelector('#post-script-dropdown'),
            (script) => {
                if (!tab.request.postScriptIds.includes(script.id)) {
                    tab.request.postScriptIds.push(script.id);
                    if (app.activeTabId === tab.id) app.renderPostScriptsList();
                }
            }
        );
        // Feed scripts
        const allScripts = getAllScripts();
        const filtered = allScripts.filter(s =>
            s.group === app.activeGroups.scripts || s.group === DEFAULT_GROUP
        );
        tab.preScriptCombobox.setScripts(filtered);
        tab.postScriptCombobox.setScripts(filtered);
    },

    switchTab(tabId) {
        app.activeTabId = tabId;

        // Show/hide panels
        document.querySelectorAll('#request-tab-panels > .tab-panel-container').forEach(el => {
            el.style.display = el.id === `tab-panel-${tabId}` ? 'flex' : 'none';
            if (el.style.display === 'flex') el.style.flexDirection = 'column';
        });

        app.renderTabBar();

        // Populate form fields from tab state
        const tab = app.activeTab;
        if (!tab) return;
        const panelEl = document.getElementById(`tab-panel-${tabId}`);
        if (!panelEl) return;

        panelEl.querySelector('#url-input').value = tab.request.url || '';
        panelEl.querySelector('#method-select').value = tab.request.method || 'GET';
        panelEl.querySelector('#request-title-input').value = tab.request.title || 'New Request';
        app.renderHeaders();
        app.renderPreScriptsList();
        app.renderPostScriptsList();

        // Restore result if any
        if (tab.result) app._restoreResult(tab, panelEl);
    },

    _restoreResult(tab, panelEl) {
        const r = tab.result;
        if (!r) return;
        const status = r.status || 'N/A';
        const statusText = r.statusText || '';
        const statusColor = status >= 200 && status < 300 ? 'text-green-500' : (status >= 400 ? 'text-red-500' : 'text-gray-500');
        const statusEl = panelEl.querySelector('#response-status');
        if (statusEl) { statusEl.className = `font-bold ${statusColor}`; statusEl.textContent = `Status: ${status} ${statusText}`; }
        const timeEl = panelEl.querySelector('#response-time');
        if (timeEl) timeEl.textContent = `Time: ${r.duration}ms`;
        const lineEl = panelEl.querySelector('#request-line');
        if (lineEl) lineEl.textContent = r.requestLine || '';
        const reqHEl = panelEl.querySelector('#request-headers');
        if (reqHEl) reqHEl.textContent = r.requestHeaders || '';
        const resHEl = panelEl.querySelector('#response-headers');
        if (resHEl) resHEl.textContent = r.responseHeaders || '';
        const scriptEl = panelEl.querySelector('#script-output');
        if (scriptEl) scriptEl.textContent = r.scriptOutput || 'No script output';
        if (tab.jsonEditor && r.responseData !== undefined) {
            try {
                tab.jsonEditor.set({ json: typeof r.responseData === 'string' ? JSON.parse(r.responseData) : r.responseData });
            } catch (e) {
                tab.jsonEditor.set({ text: typeof r.responseData === 'string' ? r.responseData : JSON.stringify(r.responseData, null, 2) });
            }
        }
    },

    _showTabContextMenu(tabId, event) {
        app._hideTabContextMenu();
        const menu = app._tabContextMenu;
        const tabIndex = app.tabs.findIndex(t => t.id === tabId);

        const items = [
            { label: 'Close', action: () => app.closeTab(tabId) },
            { label: 'Close Others', action: () => {
                app.tabs.filter(t => t.id !== tabId).map(t => t.id).forEach(id => app.closeTab(id));
            }},
            { separator: true },
            { label: 'Close to the Right', action: () => {
                app.tabs.slice(tabIndex + 1).map(t => t.id).forEach(id => app.closeTab(id));
            }, disabled: tabIndex >= app.tabs.length - 1 },
            { separator: true },
            { label: 'Close All', action: () => {
                [...app.tabs].map(t => t.id).forEach(id => app.closeTab(id));
            }},
        ];

        menu.innerHTML = items.map((item, i) => {
            if (item.separator) return `<div class="context-menu-separator"></div>`;
            const disabledAttr = item.disabled ? ' disabled style="opacity:0.4;cursor:default;"' : '';
            return `<button data-action="${i}"${disabledAttr}>${item.label}</button>`;
        }).join('');

        const menuWidth = 160;
        const menuHeight = 130;
        let x = event.clientX;
        let y = event.clientY;
        if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 4;
        if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 4;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('visible');

        menu.querySelectorAll('button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                app._hideTabContextMenu();
                items[parseInt(btn.dataset.action)].action();
            });
        });
    },

    _hideTabContextMenu() {
        if (app._tabContextMenu) {
            app._tabContextMenu.classList.remove('visible');
            app._tabContextMenu.innerHTML = '';
        }
    },

    closeTab(tabId) {
        const idx = app.tabs.findIndex(t => t.id === tabId);
        if (idx === -1) return;
        const tab = app.tabs[idx];

        // Destroy response JSON editor
        if (tab.jsonEditor) try { tab.jsonEditor.destroy(); } catch(e) {}

        // Cleanup ScriptCombobox listeners
        if (tab.preScriptCombobox) tab.preScriptCombobox.destroy();
        if (tab.postScriptCombobox) tab.postScriptCombobox.destroy();

        // Cleanup resize handle listeners
        const panelEl = document.getElementById(`tab-panel-${tabId}`);
        if (panelEl) {
            if (panelEl._resizeCleanups) {
                panelEl._resizeCleanups.forEach(fn => {
                    document.removeEventListener('mousemove', fn);
                    document.removeEventListener('mouseup', fn);
                });
            }
            panelEl.remove();
        }

        app.tabs.splice(idx, 1);

        if (app.tabs.length === 0) {
            app.createTab(); // always keep at least one tab
        } else {
            const nextTab = app.tabs[Math.min(idx, app.tabs.length - 1)];
            app.switchTab(nextTab.id);
        }
    },

    _isTabBlank(tab) {
        return !tab.request.url && !tab.result &&
               tab.request.title === 'New Request' &&
               tab.request.preScriptIds.length === 0 &&
               tab.request.postScriptIds.length === 0;
    },

    // --- UI Rendering ---

    renderVariableStore(searchTerm = '') {
        const varStore = getVariableStore();
        const activeGroup = app.activeGroups.variables;
        let vars = varStore[activeGroup] || {};
        
        // Apply search filter if search term provided
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            vars = Object.fromEntries(
                Object.entries(vars).filter(([key, value]) => 
                    key.toLowerCase().includes(searchLower) || 
                    String(value).toLowerCase().includes(searchLower)
                )
            );
        }
        
        app.elements.variablesList.innerHTML = Object.entries(vars).length > 0
            ? Object.entries(vars).map(([key, value]) => `
                <div class="variable-item bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition cursor-move" data-var-key="${key}" draggable="true">
                    <div class="variable-display flex justify-between items-center">
                        <span class="drag-handle text-gray-400 mr-2 select-none">⋮⋮</span>
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
            : (searchTerm 
                ? '<p class="text-gray-500 text-xs">No variables match your search.</p>'
                : '<p class="text-gray-500 text-xs">No variables in this group.</p>');
        
        // Attach drag handlers for variables list
        if (Object.entries(vars).length > 0) {
            app.attachSidebarDragHandlers('variables');
        }
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
    
    // --- Script List Rendering ---
    
    renderPreScriptsList() {
        const scripts = getAllScripts();
        const selectedIds = app.currentRequest.preScriptIds || [];
        
        if (selectedIds.length === 0) {
            app.elements.preScriptsList.innerHTML = '<p class="text-gray-400 text-xs italic">No pre-request scripts selected</p>';
            return;
        }
        
        app.elements.preScriptsList.innerHTML = selectedIds.map((id, index) => {
            const script = scripts.find(s => s.id === id);
            if (!script) return '';
            return `
                <div class="script-item flex items-center justify-between bg-white p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-move" 
                     data-script-id="${id}" data-index="${index}" draggable="true">
                    <div class="flex items-center gap-2 flex-1">
                        <span class="text-gray-400">⋮⋮</span>
                        <span class="text-xs font-mono text-gray-500">${index + 1}.</span>
                        <span class="text-sm font-medium">${script.name}</span>
                        <span class="text-xs text-gray-500">(${script.group})</span>
                    </div>
                    <button class="remove-pre-script text-red-500 hover:text-red-700 text-sm px-2 py-1" 
                            data-script-id="${id}" title="Remove script">✕</button>
                </div>
            `;
        }).join('');
        
        // Attach drag-and-drop handlers
        app.attachScriptDragHandlers('pre');
    },
    
    renderPostScriptsList() {
        const scripts = getAllScripts();
        const selectedIds = app.currentRequest.postScriptIds || [];
        
        if (selectedIds.length === 0) {
            app.elements.postScriptsList.innerHTML = '<p class="text-gray-400 text-xs italic">No post-request scripts selected</p>';
            return;
        }
        
        app.elements.postScriptsList.innerHTML = selectedIds.map((id, index) => {
            const script = scripts.find(s => s.id === id);
            if (!script) return '';
            return `
                <div class="script-item flex items-center justify-between bg-white p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-move" 
                     data-script-id="${id}" data-index="${index}" draggable="true">
                    <div class="flex items-center gap-2 flex-1">
                        <span class="text-gray-400">⋮⋮</span>
                        <span class="text-xs font-mono text-gray-500">${index + 1}.</span>
                        <span class="text-sm font-medium">${script.name}</span>
                        <span class="text-xs text-gray-500">(${script.group})</span>
                    </div>
                    <button class="remove-post-script text-red-500 hover:text-red-700 text-sm px-2 py-1" 
                            data-script-id="${id}" title="Remove script">✕</button>
                </div>
            `;
        }).join('');
        
        // Attach drag-and-drop handlers
        app.attachScriptDragHandlers('post');
    },
    
    attachScriptDragHandlers(type) {
        const container = type === 'pre' ? app.elements.preScriptsList : app.elements.postScriptsList;
        const items = container.querySelectorAll('.script-item');
        
        let draggedItem = null;
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('opacity-50');
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggedItem);
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            });
        });

        // Update array order after drag
        if (container._dragEndHandler) {
            container.removeEventListener('dragend', container._dragEndHandler);
        }
        container._dragEndHandler = () => {
            const newOrder = Array.from(container.querySelectorAll('.script-item'))
                .map(item => item.getAttribute('data-script-id'));
            if (type === 'pre') {
                app.currentRequest.preScriptIds = newOrder;
                app.renderPreScriptsList();
            } else {
                app.currentRequest.postScriptIds = newOrder;
                app.renderPostScriptsList();
            }
        };
        container.addEventListener('dragend', container._dragEndHandler);
        
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.script-item:not(.opacity-50)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
        // Attach remove handlers
        const removeButtons = container.querySelectorAll(type === 'pre' ? '.remove-pre-script' : '.remove-post-script');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scriptId = btn.getAttribute('data-script-id');
                app.removeScript(type, scriptId);
            });
        });
    },
    
    removeScript(type, scriptId) {
        if (type === 'pre') {
            app.currentRequest.preScriptIds = app.currentRequest.preScriptIds.filter(id => id !== scriptId);
            app.renderPreScriptsList();
        } else {
            app.currentRequest.postScriptIds = app.currentRequest.postScriptIds.filter(id => id !== scriptId);
            app.renderPostScriptsList();
        }
    },
    
    // --- Sidebar Drag-and-Drop ---
    
    /**
     * Attaches drag-and-drop reordering handlers to sidebar list items.
     * @param {string} listType - One of 'requests', 'scripts', 'variables'
     */
    attachSidebarDragHandlers(listType) {
        const containerMap = {
            requests: app.elements.requestsList,
            scripts: app.elements.scriptsList,
            variables: app.elements.variablesList
        };
        const container = containerMap[listType];
        if (!container) return;
        
        const itemSelector = listType === 'variables' ? '.variable-item' : '.sidebar-list-item';
        const items = container.querySelectorAll(itemSelector);
        
        let draggedItem = null;
        
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('opacity-50');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
                // Save the new order when drag ends
                if (draggedItem) {
                    app.saveSidebarListOrder(listType, itemSelector);
                }
                draggedItem = null;
            });
            
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (!draggedItem || draggedItem === item) return;
                
                const afterElement = app.getSidebarDragAfterElement(container, e.clientY, itemSelector);
                if (afterElement == null) {
                    container.appendChild(draggedItem);
                } else {
                    container.insertBefore(draggedItem, afterElement);
                }
            });
        });
    },
    
    /**
     * Helper function to determine insertion position during drag.
     */
    getSidebarDragAfterElement(container, y, itemSelector) {
        const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.opacity-50)`)];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },
    
    /**
     * Saves the new order of sidebar list items after drag-and-drop.
     */
    saveSidebarListOrder(listType, itemSelector) {
        const containerMap = {
            requests: app.elements.requestsList,
            scripts: app.elements.scriptsList,
            variables: app.elements.variablesList
        };
        const container = containerMap[listType];
        if (!container) return;
        
        const items = container.querySelectorAll(itemSelector);
        
        if (listType === 'requests') {
            const newOrder = Array.from(items).map(item => 
                item.querySelector('[data-load-request]')?.getAttribute('data-load-request')
            ).filter(Boolean);
            
            // Reorder the requests array
            const allRequests = getAllRequests();
            const activeGroup = app.activeGroups.requests;
            
            // Get requests not in active group (preserve their position)
            const otherRequests = allRequests.filter(r => r.group !== activeGroup);
            
            // Reorder active group requests based on newOrder
            const reorderedActiveRequests = newOrder.map(id => 
                allRequests.find(r => r.id === id)
            ).filter(Boolean);
            
            // Combine: other groups + reordered active group
            const reorderedRequests = [...otherRequests, ...reorderedActiveRequests];
            saveCollection(STORAGE_KEYS.REQUESTS, reorderedRequests);
            
        } else if (listType === 'scripts') {
            const newOrder = Array.from(items).map(item => 
                item.querySelector('[data-load-script]')?.getAttribute('data-load-script')
            ).filter(Boolean);
            
            // Reorder the scripts array
            const allScripts = getAllScripts();
            const activeGroup = app.activeGroups.scripts;
            
            // Get scripts not in active group (preserve their position)
            const otherScripts = allScripts.filter(s => s.group !== activeGroup);
            
            // Reorder active group scripts based on newOrder
            const reorderedActiveScripts = newOrder.map(id => 
                allScripts.find(s => s.id === id)
            ).filter(Boolean);
            
            // Combine: other groups + reordered active group
            const reorderedScripts = [...otherScripts, ...reorderedActiveScripts];
            saveCollection(STORAGE_KEYS.SCRIPTS, reorderedScripts);
            
        } else if (listType === 'variables') {
            const newOrder = Array.from(items).map(item => 
                item.getAttribute('data-var-key')
            ).filter(Boolean);
            
            // Reorder variables in the active group
            const varStore = getVariableStore();
            const activeGroup = app.activeGroups.variables;
            const currentVars = varStore[activeGroup] || {};
            
            // Create new object with reordered keys
            const reorderedVars = {};
            newOrder.forEach(key => {
                if (currentVars.hasOwnProperty(key)) {
                    reorderedVars[key] = currentVars[key];
                }
            });
            
            varStore[activeGroup] = reorderedVars;
            saveVariableStore(varStore);
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
        varSelect.value = app.activeGroups.variables;

        // Render Requests Group Selector
        const reqGroups = getAllGroups('requests');
        const reqSelect = document.getElementById('requests-group-select');
        console.log('Request groups:', reqGroups, 'Active:', app.activeGroups.requests);
        reqSelect.innerHTML = reqGroups.map(g =>
            `<option value="${g}" ${g === app.activeGroups.requests ? 'selected' : ''}>${g}</option>`
        ).join('');
        reqSelect.value = app.activeGroups.requests;

        // Render Scripts Group Selector
        const scriptGroups = getAllGroups('scripts');
        const scriptSelect = document.getElementById('scripts-group-select');
        console.log('Script groups:', scriptGroups, 'Active:', app.activeGroups.scripts);
        scriptSelect.innerHTML = scriptGroups.map(g =>
            `<option value="${g}" ${g === app.activeGroups.scripts ? 'selected' : ''}>${g}</option>`
        ).join('');
        scriptSelect.value = app.activeGroups.scripts;
    },

    renderTabTitles() {
        // Update tab buttons to show active group names
        const tabs = [
            { type: 'variables', selector: '[data-tab="variables"]' },
            { type: 'requests', selector: '[data-tab="requests"]' },
            { type: 'scripts', selector: '[data-tab="scripts"]' }
        ];

        tabs.forEach(tab => {
            const button = document.querySelector(tab.selector);
            if (button) {
                const groupNameEl = button.querySelector('.tab-group-name');
                if (groupNameEl) {
                    groupNameEl.textContent = app.activeGroups[tab.type];
                }
            }
        });
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
        
        // Update tab titles to show new active group
        app.renderTabTitles();
        
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

    setupGroupMenus() {
        // Setup dropdown toggles for each section
        const menuConfigs = [
            { menuBtn: 'var-group-menu-btn', menu: 'var-group-menu', renameBtn: 'rename-var-group-btn', deleteBtn: 'delete-var-group-btn', type: 'variables' },
            { menuBtn: 'request-group-menu-btn', menu: 'request-group-menu', renameBtn: 'rename-request-group-btn', deleteBtn: 'delete-request-group-btn', type: 'requests' },
            { menuBtn: 'script-group-menu-btn', menu: 'script-group-menu', renameBtn: 'rename-script-group-btn', deleteBtn: 'delete-script-group-btn', type: 'scripts' }
        ];

        menuConfigs.forEach(config => {
            const menuBtn = document.getElementById(config.menuBtn);
            const menu = document.getElementById(config.menu);
            const renameBtn = document.getElementById(config.renameBtn);
            const deleteBtn = document.getElementById(config.deleteBtn);

            if (!menuBtn || !menu || !renameBtn || !deleteBtn) return;

            // Toggle dropdown menu
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                // Close all other menus
                menuConfigs.forEach(c => {
                    const otherMenu = document.getElementById(c.menu);
                    if (otherMenu && c.menu !== config.menu) {
                        otherMenu.classList.add('hidden');
                    }
                });
                // Toggle current menu
                menu.classList.toggle('hidden');
            };

            // Rename group action
            renameBtn.onclick = () => {
                menu.classList.add('hidden');
                app.renameGroupUI(config.type);
            };

            // Delete group action
            deleteBtn.onclick = () => {
                menu.classList.add('hidden');
                app.deleteGroup(config.type);
            };
        });

        // Close dropdowns when clicking outside
        if (!app._groupMenusInitialized) {
            document.addEventListener('click', (e) => {
                menuConfigs.forEach(config => {
                    const menu = document.getElementById(config.menu);
                    const menuBtn = document.getElementById(config.menuBtn);
                    if (menu && menuBtn && !menuBtn.contains(e.target) && !menu.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            });
            app._groupMenusInitialized = true;
        }
    },

    deleteGroup(type) {
        const currentGroup = app.activeGroups[type];
        
        // Prevent deleting the default 'global' group
        if (currentGroup === DEFAULT_GROUP) {
            alert(`Cannot delete the default '${DEFAULT_GROUP}' group.`);
            return;
        }
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete the '${currentGroup}' group? This will delete all ${type} in this group.`)) {
            return;
        }
        
        // Delete the group and all its items
        if (type === 'variables') {
            const varStore = getVariableStore();
            delete varStore[currentGroup];
            saveVariableStore(varStore);
        } else if (type === 'requests') {
            const allRequests = getAllRequests();
            const filteredRequests = allRequests.filter(r => r.group !== currentGroup);
            saveCollection(STORAGE_KEYS.REQUESTS, filteredRequests);
        } else if (type === 'scripts') {
            const allScripts = getAllScripts();
            const filteredScripts = allScripts.filter(s => (s.group || DEFAULT_GROUP) !== currentGroup);
            saveCollection(STORAGE_KEYS.SCRIPTS, filteredScripts);
        }
        
        // Remove group from the persisted group names list
        const groupNames = loadGroupNames();
        if (groupNames[type]) {
            groupNames[type] = groupNames[type].filter(g => g !== currentGroup);
            saveGroupNames(groupNames);
        }
        
        // Switch to default group
        app.activeGroups[type] = DEFAULT_GROUP;
        setActiveGroup(type, DEFAULT_GROUP);
        
        // Refresh UI - update dropdowns and lists
        app.renderGroupSelectors();
        if (type === 'variables') {
            app.renderVariableStore();
        } else if (type === 'requests' || type === 'scripts') {
            // renderCollections() handles both requests and scripts lists
            app.renderCollections();
        }
        
        console.log(`Group '${currentGroup}' deleted successfully`);
    },

    renameGroupUI(type) {
        const currentGroup = app.activeGroups[type];

        // Prevent renaming the default 'global' group
        if (currentGroup === DEFAULT_GROUP) {
            alert(`Cannot rename the default '${DEFAULT_GROUP}' group.`);
            return;
        }

        // Use custom input dialog to get new name (pre-fill with current name)
        app.inputDialog.show(
            'Rename Group',
            `Enter a new name for the '${currentGroup}' group:`,
            currentGroup,
            (newName) => {
                const trimmedName = newName.trim();

                // Validate new name
                if (!trimmedName) {
                    alert('Group name cannot be empty.');
                    return;
                }

                if (trimmedName === currentGroup) {
                    // No change, just return
                    return;
                }

                // Check if new name already exists
                const existingGroups = getAllGroups(type);
                if (existingGroups.includes(trimmedName)) {
                    alert('A group with that name already exists.');
                    return;
                }

                // Attempt to rename the group
                const success = renameGroup(type, currentGroup, trimmedName);

                if (success) {
                    // Update the active group reference in app state
                    app.activeGroups[type] = trimmedName;

                    // Refresh UI
                    app.renderGroupSelectors();
                    app.renderTabTitles();

                    if (type === 'variables') {
                        app.renderVariableStore();
                    } else if (type === 'requests' || type === 'scripts') {
                        app.renderCollections();
                    }

                    console.log(`Group renamed from '${currentGroup}' to '${trimmedName}'`);
                } else {
                    alert('Failed to rename group. Please try again.');
                }
            },
            currentGroup
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

    renderCollections(requestSearchTerm = '', scriptSearchTerm = '') {
        // Render Requests List (filtered by active group)
        const allRequests = getAllRequests();
        const activeRequestGroup = app.activeGroups.requests;
        let requests = allRequests.filter(r => r.group === activeRequestGroup);
        
        // Apply search filter if search term provided
        if (requestSearchTerm) {
            const searchLower = requestSearchTerm.toLowerCase();
            requests = requests.filter(r => 
                r.title.toLowerCase().includes(searchLower) ||
                r.url.toLowerCase().includes(searchLower) ||
                r.method.toLowerCase().includes(searchLower)
            );
        }
        
        app.elements.requestsList.innerHTML = requests.length > 0
            ? requests.map(r => `
                <div class="sidebar-list-item w-full p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition text-sm flex justify-between items-center cursor-move" draggable="true">
                    <span class="drag-handle text-gray-400 mr-2 select-none">⋮⋮</span>
                    <button data-load-request="${r.id}" class="load-request-btn flex-1 text-left flex justify-between items-center">
                        <span>${r.title}</span>
                        <span class="text-xs font-mono text-gray-500">${r.method}</span>
                    </button>
                    <button data-delete-request="${r.id}" class="delete-request-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : (requestSearchTerm 
                ? '<p class="text-gray-500 text-xs">No requests match your search.</p>'
                : '<p class="text-gray-500 text-xs">No requests in this group.</p>');
        
        // Attach drag handlers for requests list
        if (requests.length > 0) {
            app.attachSidebarDragHandlers('requests');
        }

        // Render Scripts List and Select (filtered by active group and search term)
        const allScripts = getAllScripts();
        const activeScriptGroup = app.activeGroups.scripts;
        let scripts = allScripts.filter(s => s.group === activeScriptGroup);
        
        // Apply search filter if search term provided
        if (scriptSearchTerm) {
            const searchLower = scriptSearchTerm.toLowerCase();
            scripts = scripts.filter(s => s.name.toLowerCase().includes(searchLower));
        }
        
        app.elements.scriptsList.innerHTML = scripts.length > 0
            ? scripts.map(s => `
                <div class="sidebar-list-item w-full p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition text-sm flex justify-between items-center cursor-move" draggable="true">
                    <span class="drag-handle text-gray-400 mr-2 select-none">⋮⋮</span>
                    <button data-load-script="${s.id}" class="load-script-btn flex-1 text-left">
                        <span>${s.name}</span>
                    </button>
                    <button data-delete-script="${s.id}" class="delete-script-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : (scriptSearchTerm 
                ? '<p class="text-gray-500 text-xs">No scripts match your search.</p>'
                : '<p class="text-gray-500 text-xs">No scripts in this group.</p>');
        
        // Attach drag handlers for scripts list
        if (scripts.length > 0) {
            app.attachSidebarDragHandlers('scripts');
        }

        // Update script comboboxes in all tabs
        app.tabs.forEach(tab => {
            const filtered = allScripts.filter(s =>
                s.group === activeScriptGroup || s.group === DEFAULT_GROUP
            );
            if (tab.preScriptCombobox) tab.preScriptCombobox.setScripts(filtered);
            if (tab.postScriptCombobox) tab.postScriptCombobox.setScripts(filtered);
        });
    },
    
    // --- Tab Switching Logic (same as original) ---

    switchSidebarTab(tabName) {
        app.currentSidebarTab = tabName;
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active', 'bg-blue-600', 'text-white');
            button.classList.add('text-gray-600', 'hover:bg-gray-100');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active', 'bg-blue-600', 'text-white');
                button.classList.remove('text-gray-600', 'hover:bg-gray-100');
            }
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            if (panel.getAttribute('data-panel') === tabName) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        });
        if (tabName === 'variables') app.renderVariableStore();
    },

    // No-op: kept for any legacy calls (result is now always visible in the bottom half)
    switchMainTab(_tabName) {},

    // --- UI Actions (Exposed to global scope for event handlers) ---

    loadRequest(id) {
        const request = getAllRequests().find(r => r.id === id);
        if (!request) return;

        // Check if already open in a tab
        const existing = app.tabs.find(t => t.request.id === id);
        if (existing) {
            app.switchTab(existing.id);
            return;
        }

        const preScriptIds = request.preScriptIds || (request.preScriptId ? [request.preScriptId] : []);
        const postScriptIds = request.postScriptIds || (request.postScriptId ? [request.postScriptId] : []);
        const reqData = {
            ...request,
            rawHeaders: request.rawHeaders || [{ key: '', value: '' }],
            preScriptIds,
            postScriptIds,
            originalTitle: request.title
        };

        // Reuse current tab if blank, otherwise open new tab
        if (app.activeTab && app._isTabBlank(app.activeTab)) {
            app.activeTab.request = reqData;
            const panelEl = document.getElementById(`tab-panel-${app.activeTabId}`);
            if (panelEl) {
                panelEl.querySelector('#url-input').value = reqData.url;
                panelEl.querySelector('#method-select').value = reqData.method;
                panelEl.querySelector('#request-title-input').value = reqData.title;
                app.setRequestBody(reqData.body);
            }
            app.renderHeaders();
            app.renderPreScriptsList();
            app.renderPostScriptsList();
            app.renderTabBar();
        } else {
            const tab = app.createTab(reqData);
            const panelEl = document.getElementById(`tab-panel-${tab.id}`);
            if (panelEl) {
                panelEl.querySelector('#url-input').value = reqData.url;
                panelEl.querySelector('#method-select').value = reqData.method;
                panelEl.querySelector('#request-title-input').value = reqData.title;
                app.setRequestBody(reqData.body, tab);
            }
            app.renderHeaders();
            app.renderPreScriptsList();
            app.renderPostScriptsList();
        }
        app.renderCollections();
    },

    loadScriptToEditor(id) {
        const script = getAllScripts().find(s => s.id === id);
        if (script) {
            app.currentScript = script;
            // Note: Script editors removed from request builder, scripts are now managed via Scripts tab
        }
    },
    
    /**
     * Show script editor dialog
     */
    showScriptEditorDialog(scriptId = null) {
        const dialog = document.getElementById('script-editor-dialog');
        const nameInput = document.getElementById('script-editor-name');
        const codeTextarea = document.getElementById('script-editor-code');
        const saveBtn = document.getElementById('script-editor-save');
        const cancelBtn = document.getElementById('script-editor-cancel');
        const docsBtn = document.getElementById('view-scripting-docs-btn');
        
        let currentScriptId = scriptId;
        
        // Load script if editing existing one
        if (scriptId) {
            const script = getAllScripts().find(s => s.id === scriptId);
            if (script) {
                nameInput.value = script.name || '';
                codeTextarea.value = script.code || '';
            }
        } else {
            // Clear for new script
            nameInput.value = '';
            codeTextarea.value = '';
        }
        
        dialog.classList.remove('hidden');
        nameInput.focus();
        
        // Remove old listeners
        const newSaveBtn = saveBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        const newDocsBtn = docsBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        docsBtn.parentNode.replaceChild(newDocsBtn, docsBtn);
        
        // Documentation button
        newDocsBtn.onclick = () => {
            app.openScriptingDocs();
        };
        
        // Save button
        newSaveBtn.onclick = () => {
            const name = nameInput.value.trim() || 'Untitled Script';
            const code = codeTextarea.value;
            
            const scriptToSave = {
                id: currentScriptId,
                name: name,
                code: code,
                group: app.activeGroups.scripts
            };
            
            const savedScript = saveScript(scriptToSave);
            
            dialog.classList.add('hidden');
            app.renderCollections();
            app.renderGroupSelectors();
            
            alert(`✓ Script saved: ${savedScript.name}`);
        };
        
        // Cancel button
        newCancelBtn.onclick = () => {
            dialog.classList.add('hidden');
        };
        
        // Allow clicking backdrop to close
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                dialog.classList.add('hidden');
            }
        };
    },
    
    /**
     * Open scripting documentation
     */
    async openScriptingDocs() {
        const docUrl = 'https://github.com/nicechester/just-rest-client/blob/main/SCRIPTING.md';
        
        // Check if running in Tauri - open in new window
        if (window.__TAURI__) {
            try {
                const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                
                // Create a new window with the documentation
                new WebviewWindow('scriptingDocs', {
                    url: docUrl,
                    title: 'Scripting Documentation',
                    width: 1200,
                    height: 800,
                    center: true,
                    resizable: true
                });
                
                console.log('Opened scripting docs in new window');
            } catch (err) {
                console.error('Error opening documentation window:', err);
                // Fallback: show URL in alert
                alert(`Please visit the scripting documentation at:\n\n${docUrl}`);
            }
        } else {
            // In web browser, open in new tab
            window.open('SCRIPTING.md', '_blank');
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
            
            // Remove from current request's script arrays
            app.currentRequest.postScriptIds = app.currentRequest.postScriptIds.filter(sid => sid !== id);
            app.currentRequest.preScriptIds = app.currentRequest.preScriptIds.filter(sid => sid !== id);
            app.renderPreScriptsList();
            app.renderPostScriptsList();
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
        const group = app.activeGroups.requests;
        
        // Check if this request already exists
        const allRequests = getAllRequests();
        const existingRequest = allRequests.find(r => 
            r.title === title && (r.group || 'global') === group
        );
        
        // If title changed from the originally loaded request, create a new request (don't pass ID)
        // This allows duplicating by changing the title
        const titleChanged = app.currentRequest.id && 
                           app.currentRequest.originalTitle && 
                           app.currentRequest.originalTitle !== title;
        
        const requestToSave = {
            id: titleChanged ? null : app.currentRequest.id, // Don't pass ID if title changed
            title: title,
            url: app.elements.urlInput.value,
            method: app.elements.methodSelect.value,
            rawHeaders: app.currentRequest.rawHeaders.filter(h => h.key), 
            body: app.getRequestBody(),
            preScriptIds: app.currentRequest.preScriptIds || [],
            postScriptIds: app.currentRequest.postScriptIds || [],
            group: group
        };
        
        const savedReq = saveRequest(requestToSave);
        app.currentRequest.id = savedReq.id; 
        app.currentRequest.group = savedReq.group;
        app.currentRequest.originalTitle = savedReq.title; // Track original title for future saves
        app.elements.requestTitleInput.value = savedReq.title;
        
        // Show appropriate message
        if (titleChanged) {
            alert(`✓ New request created: ${savedReq.title} (Group: ${savedReq.group})`);
        } else if (existingRequest) {
            alert(`✓ Request updated: ${savedReq.title} (Group: ${savedReq.group})`);
        } else {
            alert(`✓ Request saved: ${savedReq.title} (Group: ${savedReq.group})`);
        }
        
        app.renderCollections();
        app.renderGroupSelectors();
    },
    
    saveAsNewRequest() {
        // This is now just an alias for saveCurrentRequest
        // The storage layer handles deduplication by title+group
        app.saveCurrentRequest();
    },
    
    newRequest() {
        app.createTab();
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
        
        alert(`Script saved as: ${savedScript.name} (Group: ${savedScript.group})`);
        app.renderCollections();
        app.renderGroupSelectors();
    },
    
    // --- Send & Response Handlers ---

    handleSend() {
        const tab = app.activeTab;
        if (!tab) return;
        const rawHeaders = (tab.request.rawHeaders || []).filter(h => h.key || h.value);
        const preScriptIds = tab.request.preScriptIds || [];
        const postScriptIds = tab.request.postScriptIds || [];

        const panelEl = document.getElementById(`tab-panel-${tab.id}`);
        if (!panelEl) { console.error('[handleSend] panelEl not found for tab', tab.id); return; }
        const statusEl = panelEl.querySelector('#response-status');
        if (statusEl) statusEl.textContent = 'Status: Sending...';
        const scriptEl = panelEl.querySelector('#script-output');
        if (scriptEl) scriptEl.textContent = '';

        const urlEl = panelEl.querySelector('#url-input');
        const methodEl = panelEl.querySelector('#method-select');
        if (!urlEl || !methodEl) { console.error('[handleSend] url/method element not found'); return; }

        setActiveGroupForScripts(app.activeGroups.variables);

        executeRequest(
            urlEl.value,
            methodEl.value,
            rawHeaders,
            app.getRequestBody(tab),
            preScriptIds,
            postScriptIds,
            app.displayResponse,
            app.activeGroups.variables
        );
    },


    displayResponse(requestDetails, response, responseData, scriptOutput, processedUrl, duration) {
        const tab = app.activeTab;
        if (!tab) return;
        const panelEl = document.getElementById(`tab-panel-${tab.id}`);
        if (!panelEl) return;

        const status = response.status || 'N/A';
        const statusText = response.statusText || 'N/A';
        const statusColor = status >= 200 && status < 300 ? 'text-green-500' : (status >= 400 ? 'text-red-500' : 'text-gray-500');

        panelEl.querySelector('#response-status').className = `font-bold ${statusColor}`;
        panelEl.querySelector('#response-status').textContent = `Status: ${status} ${statusText}`;
        panelEl.querySelector('#response-time').textContent = `Time: ${duration}ms`;

        panelEl.querySelector('#request-line').textContent =
            `${requestDetails.method} ${requestDetails.processedUrl} HTTP/1.1`;

        let requestHeadersText = '';
        Object.entries(requestDetails.headers).forEach(([key, value]) => {
            requestHeadersText += `${key}: ${value}\n`;
        });
        panelEl.querySelector('#request-headers').textContent = requestHeadersText || 'No headers';

        const requestBodySection = panelEl.querySelector('#request-body-section');
        if (requestDetails.body) {
            requestBodySection.classList.remove('hidden');
            const requestBodyCode = panelEl.querySelector('#request-body-code');
            try {
                requestBodyCode.textContent = JSON.stringify(JSON.parse(requestDetails.body), null, 2);
                requestBodyCode.className = 'language-json';
            } catch (e) {
                requestBodyCode.textContent = requestDetails.body;
                requestBodyCode.className = 'language-markup';
            }
            Prism.highlightElement(requestBodyCode);
        } else {
            requestBodySection.classList.add('hidden');
        }

        let responseHeaderText = '';
        if (response.headers) {
            response.headers.forEach((value, name) => { responseHeaderText += `${name}: ${value}\n`; });
        }
        panelEl.querySelector('#response-headers').textContent = responseHeaderText || 'No headers';

        if (tab.jsonEditor) {
            try {
                tab.jsonEditor.set({ json: typeof responseData === 'string' ? JSON.parse(responseData) : responseData });
            } catch (e) {
                tab.jsonEditor.set({ text: typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2) });
            }
        }

        panelEl.querySelector('#script-output').textContent = scriptOutput || 'No script output';

        // Scroll to response body
        const resultEl = panelEl.querySelector('#response-body-wrapper');
        if (resultEl) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Persist result in tab state for restore on tab switch
        tab.result = {
            status, statusText, duration,
            requestLine: `${requestDetails.method} ${requestDetails.processedUrl} HTTP/1.1`,
            requestHeaders: requestHeadersText,
            responseHeaders: responseHeaderText,
            responseData,
            scriptOutput
        };

        app.renderVariableStore();
    },

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Migrate old format if needed
                if (importedData.requests) {
                    importedData.requests = importedData.requests.map(req => {
                        const migrated = { ...req };
                        if (req.preScriptId !== undefined && !req.preScriptIds) {
                            migrated.preScriptIds = req.preScriptId ? [req.preScriptId] : [];
                            delete migrated.preScriptId;
                        }
                        if (req.postScriptId !== undefined && !req.postScriptIds) {
                            migrated.postScriptIds = req.postScriptId ? [req.postScriptId] : [];
                            delete migrated.postScriptId;
                        }
                        return migrated;
                    });
                }
                
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

    // --- Migration ---
    
    migrateOldRequests() {
        const requests = getAllRequests();
        let migrated = false;
        
        requests.forEach(req => {
            if (req.preScriptId !== undefined && !req.preScriptIds) {
                req.preScriptIds = req.preScriptId ? [req.preScriptId] : [];
                delete req.preScriptId;
                migrated = true;
            }
            if (req.postScriptId !== undefined && !req.postScriptIds) {
                req.postScriptIds = req.postScriptId ? [req.postScriptId] : [];
                delete req.postScriptId;
                migrated = true;
            }
        });
        
        if (migrated) {
            saveCollection(STORAGE_KEYS.REQUESTS, requests);
            console.log('[Migration] Migrated old requests to new script array format');
        }
    },
    
    // --- Vertical Resizer ---

    initVerticalResizer() {
        if (app._verticalResizerInitialized) return;
        app._verticalResizerInitialized = true;

        const handle = document.getElementById('vertical-resize-handle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const container = document.getElementById('main-layout');
        
        if (!handle || !sidebar || !mainContent || !container) return;
        
        let isResizing = false;
        let startX = 0;
        let startWidth = 0;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            handle.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const containerWidth = container.offsetWidth;
            const deltaX = e.clientX - startX;
            const newWidth = startWidth + deltaX;
            
            // Set min/max width constraints (20% to 60% of container)
            const minWidth = containerWidth * 0.2;
            const maxWidth = containerWidth * 0.6;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebar.style.width = `${newWidth}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                handle.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                
                // Save width preference to localStorage
                const sidebarWidth = sidebar.offsetWidth;
                localStorage.setItem('jrc-sidebar-width', sidebarWidth);
            }
        });
        
        // Restore saved width on load
        const savedWidth = localStorage.getItem('jrc-sidebar-width');
        if (savedWidth) {
            sidebar.style.width = `${savedWidth}px`;
        }
    },

    // --- Initialization ---

    init() {
        console.log('App initializing...');

        // Run migration for old data format
        app.migrateOldRequests();

        // Load active groups from storage
        const savedActiveGroups = getActiveGroups();
        app.activeGroups = savedActiveGroups;
        console.log('Active groups loaded:', app.activeGroups);

        // Initialize tab context menu
        const ctxMenu = document.createElement('div');
        ctxMenu.id = 'tab-context-menu';
        document.body.appendChild(ctxMenu);
        app._tabContextMenu = ctxMenu;

        // NOTE: These three document listeners are intentionally permanent (app lifetime).
        // They are registered once at init and do not need cleanup.
        document.addEventListener('click', (e) => {
            if (app._tabContextMenu && !app._tabContextMenu.contains(e.target)) {
                app._hideTabContextMenu();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') app._hideTabContextMenu();
        });

        // Render group selectors first
        app.renderGroupSelectors();

        // Update tab titles with active group names
        app.renderTabTitles();

        // Initialize first tab before rendering anything that needs tab elements
        app.createTab();

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

        // + button
        document.getElementById('new-tab-btn').onclick = () => app.createTab();
        // Sidebar Import split button
        const sidebarImportMainBtn = document.getElementById('sidebar-import-main-btn');
        const sidebarImportDropdownBtn = document.getElementById('sidebar-import-dropdown-btn');
        const sidebarImportDropdownMenu = document.getElementById('sidebar-import-dropdown-menu');
        sidebarImportMainBtn.onclick = () => document.getElementById('import-file').click();
        sidebarImportDropdownBtn.onclick = (e) => {
            e.stopPropagation();
            sidebarImportDropdownMenu.classList.toggle('hidden');
        };
        document.addEventListener('click', (e) => {
            const splitButtonContainer = sidebarImportMainBtn.parentElement.parentElement;
            if (!splitButtonContainer.contains(e.target)) sidebarImportDropdownMenu.classList.add('hidden');
        });
        document.getElementById('import-postman-btn').onclick = () => {
            sidebarImportDropdownMenu.classList.add('hidden');
            document.getElementById('import-postman-file').click();
        };

        document.getElementById('add-var-btn').onclick = () => {
            const key = document.getElementById('var-key-input').value.trim();
            const value = document.getElementById('var-value-input').value.trim();
            if (key) {
                const activeGroup = app.activeGroups.variables;
                const varStore = getVariableStore();
                if (!varStore[activeGroup]) varStore[activeGroup] = {};
                varStore[activeGroup][key] = value;
                saveVariableStore(varStore);
                document.getElementById('var-key-input').value = '';
                document.getElementById('var-value-input').value = '';
                app.renderVariableStore();
            } else {
                alert('Variable key cannot be empty.');
            }
        };
        
        // Variable search handler
        app.elements.variableSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            app.renderVariableStore(searchTerm);
        });
        
        // Request search handler
        app.elements.requestSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            const scriptSearchTerm = app.elements.scriptSearchInput.value;
            app.renderCollections(searchTerm, scriptSearchTerm);
        });
        
        // Script search handler
        app.elements.scriptSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            const requestSearchTerm = app.elements.requestSearchInput.value;
            app.renderCollections(requestSearchTerm, searchTerm);
        });
        // Note: Pre/post script selectors are now just for adding to the list, no longer for editing

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
                    if (id) app.showScriptEditorDialog(id);
                }
            });
        }
        
        // Add New Script button
        document.getElementById('add-script-btn').onclick = () => {
            app.showScriptEditorDialog();
        };

        // Export/Import listeners
        document.getElementById('export-btn').onclick = () => exportAllData(getVariableStore(), getAllRequests(), getAllScripts());
        // Import button is now a dropdown with handlers defined above

        // About dialog listeners - icon click to show About
        document.getElementById('app-icon').onclick = () => app.showAbout();
        document.getElementById('about-close').onclick = () => app.hideAbout();
        document.getElementById('github-link-btn').onclick = async () => {
            const url = 'https://github.com/nicechester/just-rest-client';
            if (window.__TAURI__) {
                try {
                    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
                    
                    // Create a new window with GitHub
                    new WebviewWindow('githubRepo', {
                        url: url,
                        title: 'Just REST Client - GitHub',
                        width: 1200,
                        height: 800,
                        center: true,
                        resizable: true
                    });
                    
                    console.log('Opened GitHub in new window');
                } catch (err) {
                    console.error('Error opening GitHub window:', err);
                    alert(`Please visit the GitHub repository at:\n\n${url}`);
                }
            } else {
                window.open(url, '_blank');
            }
        };

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
        
        // Setup split button dropdowns for group actions
        app.setupGroupMenus();

        // Add default variables if the store is empty
        const varStore = getVariableStore();
        if (!varStore[DEFAULT_GROUP] || Object.keys(varStore[DEFAULT_GROUP]).length === 0) {
            varStore[DEFAULT_GROUP] = {
                baseUrl: 'https://jsonplaceholder.typicode.com',
                token: 'initial_token_123'
            };
            saveVariableStore(varStore);
        }
        
        // Initialize vertical resizer for split panes
        app.initVerticalResizer();
        
        // Show About dialog as splash screen on first load
        // Use different key for Tauri vs web to track separately
        const storageKey = window.__TAURI__ ? 'hasSeenAboutTauri' : 'hasSeenAbout';
        const hasSeenAbout = localStorage.getItem(storageKey);
        console.log(`Splash screen check - Key: ${storageKey}, Seen: ${hasSeenAbout}, Tauri: ${!!window.__TAURI__}`);
        if (!hasSeenAbout) {
            setTimeout(() => {
                console.log('Showing splash screen...');
                app.showAbout();
            }, 300); // Small delay for smooth appearance
            localStorage.setItem(storageKey, 'true');
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