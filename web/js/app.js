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
    saveGroupNames
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
        preScriptIds: [], // Changed from single ID to array
        postScriptIds: [], // Changed from single ID to array
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
    
    // JSON Editor instances
    jsonEditor: null, // For response viewer (read-only)
    requestBodyEditor: null, // For request body (editable)
    
    // Helper methods for request body
    getRequestBody() {
        if (app.requestBodyEditor) {
            try {
                const content = app.requestBodyEditor.get();
                // Handle both JSON and text modes
                if (content.json !== undefined) {
                    return JSON.stringify(content.json);
                }
                return content.text || '';
            } catch (e) {
                return '';
            }
        }
        return '';
    },
    
    setRequestBody(bodyContent) {
        if (app.requestBodyEditor) {
            try {
                // Try to parse as JSON first
                if (bodyContent && bodyContent.trim()) {
                    const parsed = JSON.parse(bodyContent);
                    app.requestBodyEditor.set({ json: parsed });
                } else {
                    app.requestBodyEditor.set({ text: bodyContent || '' });
                }
            } catch (e) {
                // Not valid JSON, set as text
                app.requestBodyEditor.set({ text: bodyContent || '' });
            }
        }
    },
    
    toggleResponseFullscreen() {
        const wrapper = document.getElementById('response-body-wrapper');
        const button = document.getElementById('response-fullscreen-btn');
        const icon = button.querySelector('.fullscreen-icon');
        const container = document.getElementById('json-editor-container');
        
        if (wrapper.classList.contains('fullscreen')) {
            // Exit fullscreen
            wrapper.classList.remove('fullscreen');
            icon.textContent = '⛶';
            button.title = 'Toggle Fullscreen';
            
            // Force editor container to recalculate size
            setTimeout(() => {
                if (container) {
                    container.style.height = localStorage.getItem('editor-height-json-editor-container') || '400px';
                }
                // Trigger window resize event to let editor adjust
                window.dispatchEvent(new Event('resize'));
            }, 100);
        } else {
            // Enter fullscreen
            wrapper.classList.add('fullscreen');
            icon.textContent = '✕';
            button.title = 'Exit Fullscreen (Esc)';
            
            // Force editor to fill fullscreen
            setTimeout(() => {
                // Trigger window resize event to let editor adjust
                window.dispatchEvent(new Event('resize'));
            }, 100);
            
            // Add escape key listener
            const escapeHandler = (e) => {
                if (e.key === 'Escape' && wrapper.classList.contains('fullscreen')) {
                    app.toggleResponseFullscreen();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
        }
    },
    
    initResizeHandles() {
        const handles = document.querySelectorAll('.resize-handle');
        
        handles.forEach(handle => {
            let isResizing = false;
            let startY = 0;
            let startHeight = 0;
            let targetElement = null;
            let codeMirrorElement = null;
            
            handle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                
                const targetId = handle.dataset.target;
                targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    // Check if this is a CodeMirror editor (textarea with CodeMirror wrapper)
                    const cmWrapper = targetElement.nextElementSibling;
                    if (cmWrapper && cmWrapper.classList.contains('CodeMirror')) {
                        codeMirrorElement = cmWrapper;
                        startHeight = codeMirrorElement.offsetHeight;
                    } else {
                        codeMirrorElement = null;
                        startHeight = targetElement.offsetHeight;
                    }
                    
                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                }
                
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isResizing || !targetElement) return;
                
                const deltaY = e.clientY - startY;
                const newHeight = Math.max(150, startHeight + deltaY); // Min height 150px
                
                // Resize CodeMirror wrapper if it exists, otherwise resize target element
                if (codeMirrorElement) {
                    codeMirrorElement.style.height = `${newHeight}px`;
                    
                    // Refresh CodeMirror
                    const targetId = targetElement.id;
                    if (targetId === 'pre-script-editor' && app.codeMirrorEditors.preScript) {
                        app.codeMirrorEditors.preScript.setSize(null, newHeight);
                    } else if (targetId === 'post-script-editor' && app.codeMirrorEditors.postScript) {
                        app.codeMirrorEditors.postScript.setSize(null, newHeight);
                    }
                } else {
                    targetElement.style.height = `${newHeight}px`;
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    
                    // Save height to localStorage
                    if (targetElement) {
                        const targetId = targetElement.id;
                        const actualHeight = codeMirrorElement ? 
                            codeMirrorElement.style.height : 
                            targetElement.style.height;
                        localStorage.setItem(`editor-height-${targetId}`, actualHeight);
                    }
                }
            });
        });
        
        // Restore saved heights
        const editors = ['request-body-editor', 'pre-script-editor', 'post-script-editor', 'json-editor-container'];
        editors.forEach(editorId => {
            const savedHeight = localStorage.getItem(`editor-height-${editorId}`);
            const element = document.getElementById(editorId);
            if (savedHeight && element) {
                // Check if this is a CodeMirror editor
                const cmWrapper = element.nextElementSibling;
                if (cmWrapper && cmWrapper.classList.contains('CodeMirror')) {
                    cmWrapper.style.height = savedHeight;
                    // Update CodeMirror size
                    if (editorId === 'pre-script-editor' && app.codeMirrorEditors.preScript) {
                        app.codeMirrorEditors.preScript.setSize(null, parseInt(savedHeight));
                    } else if (editorId === 'post-script-editor' && app.codeMirrorEditors.postScript) {
                        app.codeMirrorEditors.postScript.setSize(null, parseInt(savedHeight));
                    }
                } else {
                    element.style.height = savedHeight;
                }
            }
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
        // Set URL
        if (parsed.url) {
            app.elements.urlInput.value = parsed.url;
        }
        
        // Set method
        if (parsed.method) {
            app.elements.methodSelect.value = parsed.method;
        }
        
        // Set headers
        if (parsed.headers && parsed.headers.length > 0) {
            app.currentRequest.rawHeaders = [...parsed.headers, { key: '', value: '' }];
            app.renderHeaders();
        }
        
        // Set body
        if (parsed.body) {
            app.setRequestBody(parsed.body);
        }
        
        // Clear request ID, title, group, and scripts (this is a new request)
        app.currentRequest.id = null;
        app.currentRequest.group = app.activeGroups.requests; // Set to current active group
        app.currentRequest.preScriptIds = [];
        app.currentRequest.postScriptIds = [];
        app.elements.requestTitleInput.value = 'Imported from cURL';
        app.elements.preScriptSelect.value = '';
        app.elements.postScriptSelect.value = '';
        
        app.renderPreScriptsList();
        app.renderPostScriptsList();
        
        // Switch to Request Builder tab if not already there
        app.switchMainTab('request');
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
        // Request Inputs
        urlInput: document.getElementById('url-input'),
        methodSelect: document.getElementById('method-select'),
        headersContainer: document.getElementById('headers-container'),
        requestTitleInput: document.getElementById('request-title-input'),
        
        // Scripting
        preScriptSelect: document.getElementById('pre-script-select'),
        postScriptSelect: document.getElementById('post-script-select'),
        preScriptsList: document.getElementById('pre-scripts-list'),
        postScriptsList: document.getElementById('post-scripts-list'),
        scriptSearchInput: document.getElementById('script-search-input'),

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
        container.addEventListener('dragend', () => {
            const newOrder = Array.from(container.querySelectorAll('.script-item'))
                .map(item => item.getAttribute('data-script-id'));
            
            if (type === 'pre') {
                app.currentRequest.preScriptIds = newOrder;
                app.renderPreScriptsList();
            } else {
                app.currentRequest.postScriptIds = newOrder;
                app.renderPostScriptsList();
            }
        });
        
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

    setupGroupMenus() {
        // Setup dropdown toggles for each section
        const menuConfigs = [
            { menuBtn: 'var-group-menu-btn', menu: 'var-group-menu', deleteBtn: 'delete-var-group-btn', type: 'variables' },
            { menuBtn: 'request-group-menu-btn', menu: 'request-group-menu', deleteBtn: 'delete-request-group-btn', type: 'requests' },
            { menuBtn: 'script-group-menu-btn', menu: 'script-group-menu', deleteBtn: 'delete-script-group-btn', type: 'scripts' }
        ];
        
        menuConfigs.forEach(config => {
            const menuBtn = document.getElementById(config.menuBtn);
            const menu = document.getElementById(config.menu);
            const deleteBtn = document.getElementById(config.deleteBtn);
            
            if (!menuBtn || !menu || !deleteBtn) return;
            
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
            
            // Delete group action
            deleteBtn.onclick = () => {
                menu.classList.add('hidden');
                app.deleteGroup(config.type);
            };
        });
        
        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            menuConfigs.forEach(config => {
                const menu = document.getElementById(config.menu);
                const menuBtn = document.getElementById(config.menuBtn);
                if (menu && menuBtn && !menuBtn.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        });
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

    renderCollections(scriptSearchTerm = '') {
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
                <div class="w-full p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition text-sm flex justify-between items-center">
                    <button data-load-script="${s.id}" class="load-script-btn flex-1 text-left">
                        <span>${s.name}</span>
                    </button>
                    <button data-delete-script="${s.id}" class="delete-script-btn text-red-500 hover:text-red-700 ml-2 text-xs px-2">X</button>
                </div>
            `).join('')
            : (scriptSearchTerm 
                ? '<p class="text-gray-500 text-xs">No scripts match your search.</p>'
                : '<p class="text-gray-500 text-xs">No scripts in this group.</p>');

        // Use ALL scripts for both pre and post dropdowns (not filtered by group)
        app.elements.preScriptSelect.innerHTML = '<option value="">-- Select a Pre-Script to Add --</option>' + 
            allScripts.map(s => `<option value="${s.id}">${s.name} (${s.group})</option>`).join('');
        
        app.elements.postScriptSelect.innerHTML = '<option value="">-- Select a Post-Script to Add --</option>' + 
            allScripts.map(s => `<option value="${s.id}">${s.name} (${s.group})</option>`).join('');
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
            // Migrate old format if needed
            const preScriptIds = request.preScriptIds || (request.preScriptId ? [request.preScriptId] : []);
            const postScriptIds = request.postScriptIds || (request.postScriptId ? [request.postScriptId] : []);
            
            app.currentRequest = {
                ...request, 
                rawHeaders: request.rawHeaders || [{ key: '', value: '' }],
                preScriptIds: preScriptIds,
                postScriptIds: postScriptIds
            };
            
            app.elements.urlInput.value = request.url;
            app.elements.methodSelect.value = request.method;
            app.setRequestBody(request.body);
            app.elements.requestTitleInput.value = request.title;

            app.renderHeaders();
            app.renderPreScriptsList();
            app.renderPostScriptsList();
            app.renderCollections(); 
            app.switchMainTab('request'); 
        }
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
        
        const requestToSave = {
            id: app.currentRequest.id,
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
        app.elements.requestTitleInput.value = savedReq.title;
        
        // Show appropriate message
        if (existingRequest) {
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
        // Clear the form for a new request
        app.currentRequest = {
            id: null,
            title: 'New Request',
            url: '',
            method: 'GET',
            rawHeaders: [{ key: '', value: '' }],
            body: '',
            preScriptIds: [],
            postScriptIds: [],
            group: app.activeGroups.requests  // Use active group
        };
        
        app.elements.requestTitleInput.value = 'New Request';
        app.elements.urlInput.value = '';
        app.elements.methodSelect.value = 'GET';
        app.setRequestBody('');
        app.elements.preScriptSelect.value = '';
        app.elements.postScriptSelect.value = '';
        
        app.renderHeaders();
        app.renderPreScriptsList();
        app.renderPostScriptsList();
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
        
        alert(`Script saved as: ${savedScript.name} (Group: ${savedScript.group})`);
        app.renderCollections();
        app.renderGroupSelectors();
    },
    
    // --- Send & Response Handlers ---

    handleSend() {
        const rawHeaders = app.currentRequest.rawHeaders.filter(h => h.key || h.value);
        const preScriptIds = app.currentRequest.preScriptIds || [];
        const postScriptIds = app.currentRequest.postScriptIds || [];
        
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
            app.getRequestBody(),
            preScriptIds,
            postScriptIds,
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

        // 4. Response Body with JSON Editor
        if (app.jsonEditor) {
            // Update JSON editor with response data
            try {
                app.jsonEditor.set({
                    json: typeof responseData === 'string' ? JSON.parse(responseData) : responseData
                });
            } catch (e) {
                // If not valid JSON, show as text
                app.jsonEditor.set({
                    text: String(responseData)
                });
            }
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
    
    // --- Initialization ---

    init() {
        console.log('App initializing...');
        
        // Run migration for old data format
        app.migrateOldRequests();
        
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

        // Note: Script editors removed from request builder
        // Scripts are now edited in the Scripts tab via modal/dialog

        // Attach event listeners
        document.getElementById('send-btn').onclick = app.handleSend;
        
        // Sidebar Import split button
        const sidebarImportMainBtn = document.getElementById('sidebar-import-main-btn');
        const sidebarImportDropdownBtn = document.getElementById('sidebar-import-dropdown-btn');
        const sidebarImportDropdownMenu = document.getElementById('sidebar-import-dropdown-menu');
        
        // Main button action - Import JSON (default)
        sidebarImportMainBtn.onclick = () => {
            document.getElementById('import-file').click();
        };
        
        // Dropdown arrow toggles menu
        sidebarImportDropdownBtn.onclick = (e) => {
            e.stopPropagation();
            sidebarImportDropdownMenu.classList.toggle('hidden');
        };
        
        // Close sidebar dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const splitButtonContainer = sidebarImportMainBtn.parentElement.parentElement;
            if (!splitButtonContainer.contains(e.target)) {
                sidebarImportDropdownMenu.classList.add('hidden');
            }
        });
        
        // Sidebar Import menu item
        document.getElementById('import-postman-btn').onclick = () => {
            sidebarImportDropdownMenu.classList.add('hidden');
            document.getElementById('import-postman-file').click();
        };
        
        // Request builder Import cURL button (simple, no dropdown)
        document.getElementById('import-curl-btn').onclick = app.showImportCurlDialog;
        
        document.getElementById('curl-btn').onclick = app.showCurlDialog;
        document.getElementById('new-request-btn').onclick = app.newRequest;
        document.getElementById('save-request-btn').onclick = app.saveAsNewRequest;
        
        // Script add buttons
        document.getElementById('add-pre-script-btn').onclick = () => {
            const selectedId = app.elements.preScriptSelect.value;
            if (selectedId && !app.currentRequest.preScriptIds.includes(selectedId)) {
                app.currentRequest.preScriptIds.push(selectedId);
                app.renderPreScriptsList();
                app.elements.preScriptSelect.value = ''; // Reset selector
            } else if (!selectedId) {
                alert('Please select a script to add');
            } else {
                alert('This script is already added');
            }
        };
        
        document.getElementById('add-post-script-btn').onclick = () => {
            const selectedId = app.elements.postScriptSelect.value;
            if (selectedId && !app.currentRequest.postScriptIds.includes(selectedId)) {
                app.currentRequest.postScriptIds.push(selectedId);
                app.renderPostScriptsList();
                app.elements.postScriptSelect.value = ''; // Reset selector
            } else if (!selectedId) {
                alert('Please select a script to add');
            } else {
                alert('This script is already added');
            }
        };
        
        // Initialize JSON Editor for response (read-only)
        const jsonEditorContainer = document.getElementById('json-editor-container');
        if (jsonEditorContainer) {
            app.jsonEditor = createJSONEditor({
                target: jsonEditorContainer,
                props: {
                    mode: 'tree',
                    mainMenuBar: true,
                    navigationBar: true,
                    statusBar: true,
                    readOnly: true
                }
            });
        }
        
        // Initialize JSON Editor for request body (editable)
        const requestBodyContainer = document.getElementById('request-body-editor');
        if (requestBodyContainer) {
            app.requestBodyEditor = createJSONEditor({
                target: requestBodyContainer,
                props: {
                    mode: 'text',
                    mainMenuBar: true,
                    navigationBar: false,
                    statusBar: true,
                    readOnly: false
                }
            });
            
            // Set initial empty object
            app.requestBodyEditor.set({ text: '' });
        }
        
        // Initialize resize handles for all editors
        app.initResizeHandles();
        
        // Initialize fullscreen button
        document.getElementById('response-fullscreen-btn').onclick = app.toggleResponseFullscreen;
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
        
        // Script search handler
        app.elements.scriptSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            app.renderCollections(searchTerm);
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