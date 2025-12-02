/**
 * @fileoverview Main application entry point. Handles initialization,
 * module integration, UI state management, and event listeners.
 */

// --- Module Imports ---\
import { executeRequest } from './request.js';
import { loadVariableStore, loadAllRequests, loadAllScripts } from './storage.js';
import { executePostScript } from './scripting.js'; 
import { variableStore, setVariable, deleteVariable, getVariableStore, renderVariableUI } from './variable.js';


// --- Global Initialization ---\

// Initialize global app container object for inline HTML event handlers
window.app = {};

// Use a simple data structure for the app state
const appState = {
    activeSidebarTab: 'variables',
    activeMainTab: 'request',
    requestHeaders: [
        { id: 'h1', key: 'Content-Type', value: 'application/json', isFixed: true },
        { id: 'h2', key: 'Accept', value: 'application/json', isFixed: false },
        // More headers added dynamically by the user
    ],
    nextHeaderId: 3,
};

// --- DOM Element References ---\
const DOMElements = {
    // Tabs
    sidebarTabsContainer: document.querySelector('.col-span-1 > .flex'),
    mainTabsContainer: document.querySelector('.lg:col-span-2 > .flex'),
    // Sidebar Content
    variableList: document.getElementById('variable-list'),
    addVariableButton: document.getElementById('add-variable-btn'),
    // Request Inputs
    requestUrlInput: document.getElementById('request-url'),
    requestMethodSelect: document.getElementById('request-method'),
    requestBodyTextarea: document.getElementById('request-body'),
    postScriptIdInput: document.getElementById('post-script-id'),
    sendButton: document.getElementById('send-request-btn'),
    // Request Headers
    requestHeadersList: document.getElementById('request-headers-list'),
    addHeaderButton: document.getElementById('add-header-btn'),
    // Response Outputs
    responseViewer: document.getElementById('response-viewer'),
    requestComposer: document.getElementById('request-composer'),
    responseStatus: document.getElementById('response-status'),
    responseTime: document.getElementById('response-time'),
    processedUrl: document.getElementById('processed-url'),
    responseBody: document.getElementById('response-body'),
    responseHeaders: document.getElementById('response-headers'),
    scriptOutput: document.getElementById('script-output'),
};

// --- Tab Switching Logic ---\

/**
 * Switches the active tab in the sidebar (Variables/Requests/Scripts).
 * @param {string} tabName - The name of the tab to switch to.
 */
function switchSidebarTab(tabName) {
    appState.activeSidebarTab = tabName;
    
    // Update button styling
    DOMElements.sidebarTabsContainer.querySelectorAll('.tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update content visibility
    document.querySelectorAll('#sidebar-content > div').forEach(content => {
        content.classList.toggle('hidden', content.dataset.content !== tabName);
    });
    
    // CRITICAL: Call the variable rendering function when the variables tab is opened
    if (tabName === 'variables') {
        renderVariableUI();
    }
}

/**
 * Switches the active tab in the main content area (Request/Response).
 * @param {string} tabName - The name of the tab to switch to.
 */
function switchMainTab(tabName) {
    appState.activeMainTab = tabName;
    
    // Update button styling
    DOMElements.mainTabsContainer.querySelectorAll('.main-tab-button').forEach(button => {
        button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update content visibility
    DOMElements.requestComposer.classList.toggle('hidden', tabName !== 'request');
    DOMElements.responseViewer.classList.toggle('hidden', tabName !== 'response');
}


// --- Request Header Management ---

/**
 * Creates the HTML structure for a single key-value header row.
 * @param {Object} header - The header object from appState.requestHeaders.
 * @returns {string} The HTML string for the header row.
 */
function createHeaderRow(header) {
    const isFixed = header.isFixed;
    return `
        <div class="flex space-x-2 header-row" data-header-id="${header.id}">
            <input type="text" value="${header.key}" placeholder="Header Key" 
                   class="w-1/3 p-2 border border-gray-300 rounded-lg text-sm header-key-input ${isFixed ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'focus:ring-blue-500 focus:border-blue-500'}" 
                   ${isFixed ? 'readonly' : ''}
                   onchange="window.app.handleHeaderChange(this, '${header.id}', 'key')"
                   oninput="window.app.handleHeaderChange(this, '${header.id}', 'key')">
            <input type="text" value="${header.value}" placeholder="Header Value" 
                   class="w-2/3 p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm header-value-input"
                   onchange="window.app.handleHeaderChange(this, '${header.id}', 'value')"
                   oninput="window.app.handleHeaderChange(this, '${header.id}', 'value')">
            <button class="remove-header-btn flex-shrink-0 text-gray-400 hover:text-red-500 transition duration-150 p-2 ${isFixed ? 'cursor-not-allowed' : ''}"
                    ${isFixed ? 'disabled' : ''}
                    onclick="window.app.deleteHeader('${header.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
        </div>
    `;
}

/**
 * Renders the request headers from appState into the DOM.
 */
function renderRequestHeaders() {
    if (!DOMElements.requestHeadersList) return;
    
    const html = appState.requestHeaders.map(createHeaderRow).join('');
    DOMElements.requestHeadersList.innerHTML = html;
}

/**
 * Adds a new, empty header to the list and re-renders the UI.
 */
function addHeader() {
    const newHeader = {
        id: `h${appState.nextHeaderId++}`,
        key: '',
        value: '',
        isFixed: false
    };
    appState.requestHeaders.push(newHeader);
    renderRequestHeaders();
}

/**
 * Deletes a header by ID and re-renders the UI.
 * @param {string} headerId - The ID of the header to delete.
 */
function deleteHeader(headerId) {
    const initialLength = appState.requestHeaders.length;
    appState.requestHeaders = appState.requestHeaders.filter(h => h.id !== headerId || h.isFixed);
    
    // Only re-render if something was actually deleted (and it wasn't a fixed header)
    if (appState.requestHeaders.length < initialLength) {
        renderRequestHeaders();
    }
}

/**
 * Handles the change event for header key or value input fields.
 * @param {HTMLElement} input - The input element that changed.
 * @param {string} headerId - The ID of the header being modified.
 * @param {'key'|'value'} field - Which field is being modified.
 */
function handleHeaderChange(input, headerId, field) {
    const header = appState.requestHeaders.find(h => h.id === headerId);
    if (header) {
        header[field] = input.value;
    }
}

/**
 * Reads all non-empty headers from the internal state for the request execution.
 * @returns {Array<Object>} List of {key, value} pairs.
 */
function getRequestHeaders() {
    return appState.requestHeaders
        .filter(h => h.key.trim() !== '')
        .map(h => ({ key: h.key.trim(), value: h.value.trim() }));
}


// --- Variable Editor Handlers ---

/**
 * Handles the change/blur event for a variable's key input.
 * This is where a key is renamed.
 * @param {HTMLElement} input - The input element that changed.
 * @param {string} oldKey - The original key of the variable.
 */
function handleVariableKeyChange(input, oldKey) {
    const newKey = input.value.trim();
    if (newKey === oldKey || newKey === '') {
        // If key is empty or unchanged, just make sure the UI reflects the old key if it was only whitespace
        if (newKey === '') {
            setVariable(oldKey, getVariableStore()[oldKey]); // Re-render to restore the old key
        }
        return;
    }
    
    const oldValue = getVariableStore()[oldKey] || '';
    setVariable(newKey, oldValue, oldKey);
}

/**
 * Handles the input event for a variable's value input.
 * @param {HTMLElement} input - The input element that changed.
 * @param {string} key - The key of the variable being modified.
 */
function handleVariableValueChange(input, key) {
    // Note: setVariable calls renderVariableUI, but we don't want to re-render 
    // on every single input event if possible, as it resets focus.
    // For now, we call setVariable which re-renders, simplifying the code.
    setVariable(key, input.value, key);
}

/**
 * Adds a new variable placeholder to the store and renders the UI.
 */
function addVariable() {
    let newKey = `newVar${Object.keys(variableStore).length + 1}`;
    // Ensure the key is unique
    while (variableStore.hasOwnProperty(newKey)) {
        newKey = `newVar${Math.floor(Math.random() * 1000)}`;
    }
    setVariable(newKey, ''); // Use setVariable to save and trigger UI render
    
    // Attempt to focus on the new key input field
    setTimeout(() => {
        const newRow = DOMElements.variableList.querySelector(`[data-variable-key="${newKey}"]`);
        if (newRow) {
            newRow.querySelector('.variable-key-input').focus();
        }
    }, 50); // Small delay to ensure render is complete
}


// --- Request Execution Logic ---\

/**
 * Gathers inputs and executes the HTTP request.
 */
async function handleSendRequest() {
    const rawUrl = DOMElements.requestUrlInput.value;
    const method = DOMElements.requestMethodSelect.value;
    const rawBody = DOMElements.requestBodyTextarea.value;
    const rawHeaders = getRequestHeaders(); // Get headers from the internal state
    const postScriptId = DOMElements.postScriptIdInput.value;
    
    // Disable button and change text while loading
    DOMElements.sendButton.disabled = true;
    DOMElements.sendButton.textContent = 'Sending...';

    // Call the execution module function
    await executeRequest(
        rawUrl,
        method,
        rawHeaders,
        rawBody,
        postScriptId,
        // Pass the globally imported functions as dependencies
        getVariableStore(),
        executePostScript, 
        displayResponse 
    );
    
    // Re-enable button
    DOMElements.sendButton.disabled = false;
    DOMElements.sendButton.textContent = 'Send Request';
}


// --- Response Display Logic ---\

/**
 * Updates the UI with the results of the executed request.
 * This function is passed to request.js for callback.
 * @param {Response|Object} response - The Fetch Response object or a mock error object.
 * @param {Object|string} responseData - The parsed response body.
 * @param {string} scriptOutput - Log from the post-request script execution.
 * @param {string} processedUrl - The URL after variable substitution.
 * @param {number} duration - The time taken for the request in milliseconds.
 */
function displayResponse(response, responseData, scriptOutput, processedUrl, duration) {
    
    // Switch to the response tab
    switchMainTab('response');

    // 1. Update overall details
    DOMElements.responseStatus.textContent = `Status: ${response.status || 'N/A'} ${response.statusText || ''}`;
    DOMElements.responseTime.textContent = `Time: ${duration !== undefined ? duration : '---'}ms`;
    DOMElements.processedUrl.textContent = `URL: ${processedUrl}`;

    // Update status color
    const statusClass = response.status >= 200 && response.status < 300 ? 'text-green-500' : 
                        response.status >= 400 ? 'text-red-500' : 
                        response.status >= 300 ? 'text-yellow-500' : 'text-gray-500';
    DOMElements.responseStatus.className = 'font-bold ' + statusClass;


    // 2. Update response body (pretty-print JSON if possible)
    let bodyContent;
    if (typeof responseData === 'object' && responseData !== null) {
        try {
            // Use 2-space indentation for readability
            bodyContent = JSON.stringify(responseData, null, 2);
        } catch (e) {
            bodyContent = String(responseData); // Fallback for objects that can't be stringified
        }
    } else {
        bodyContent = String(responseData);
    }
    DOMElements.responseBody.textContent = bodyContent;


    // 3. Update response headers
    let headersText = '';
    if (response.headers && typeof response.headers.entries === 'function') {
        for (const [key, value] of response.headers.entries()) {
            headersText += `${key}: ${value}\n`;
        }
    } else {
         headersText = 'N/A (Network Error or No Headers)';
    }
    DOMElements.responseHeaders.textContent = headersText;

    // 4. Update script output
    DOMElements.scriptOutput.textContent = scriptOutput || 'No script executed.';
}


// --- Initialization ---\

/**
 * Initializes the application: loads data, sets up UI state, and attaches listeners.
 */
function initializeApp() {
    console.log('App initializing...');

    // 1. Load initial data from storage
    loadVariableStore();
    loadAllRequests();
    loadAllScripts();
    
    // 2. Expose core functions globally for inline HTML usage
    window.app.switchSidebarTab = switchSidebarTab;
    window.app.switchMainTab = switchMainTab;
    window.app.addHeader = addHeader;
    window.app.deleteHeader = deleteHeader;
    window.app.handleHeaderChange = handleHeaderChange;
    window.app.addVariable = addVariable;
    window.app.deleteVariable = deleteVariable;
    window.app.handleVariableKeyChange = handleVariableKeyChange;
    window.app.handleVariableValueChange = handleVariableValueChange;

    // 3. Attach Event Listeners
    if (DOMElements.sendButton) {
        DOMElements.sendButton.addEventListener('click', handleSendRequest);
    }
    if (DOMElements.addHeaderButton) {
        DOMElements.addHeaderButton.addEventListener('click', addHeader);
    }
    if (DOMElements.addVariableButton) {
        DOMElements.addVariableButton.addEventListener('click', addVariable);
    }

    // 4. Set initial active tabs visually and render initial UI components
    const initialSidebarButton = DOMElements.sidebarTabsContainer.querySelector(`[data-tab="${appState.activeSidebarTab}"]`);
    if (initialSidebarButton) {
        initialSidebarButton.classList.add('active');
    }
    renderVariableUI(); // Render variables immediately
    
    const initialMainButton = DOMElements.mainTabsContainer.querySelector(`[data-tab="${appState.activeMainTab}"]`);
    if (initialMainButton) {
        initialMainButton.classList.add('active');
    }
    renderRequestHeaders(); // Render initial headers
    
    console.log('App initialized.');
}

// Run the initialization logic when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializeApp);

// Export any functions needed for debugging or testing, though the primary 
// interface is window.app.
export {
    switchSidebarTab,
    switchMainTab,
    displayResponse,
    initializeApp
};