/**
 * @fileoverview Main application entry point. Handles initialization,
 * module integration, UI state management, and event listeners.
 */

// --- Module Imports ---
// Import all necessary functions and variables from other modules.
import { executeRequest } from './request.js';
import { loadVariableStore, loadAllRequests, loadAllScripts } from './storage.js';
import { executePostScript } from './scripting.js'; 
import { variableStore, setVariable, getVariableStore } from './variable.js';


// --- Global Initialization ---

// Initialize global app container object for inline HTML event handlers
// CRITICAL FIX: The functions exposed to the window must be defined before the 
// DOM is fully loaded and before initializeApp runs, so they are available
// immediately for inline onclick handlers.

// Define the global app object
window.app = {};

// Use a simple data structure for the app state
const appState = {
    activeSidebarTab: 'variables',
    activeMainTab: 'request',
};

// --- DOM Element References ---
const DOMElements = {
    // Tabs
    sidebarTabsContainer: document.querySelector('.col-span-1 > .flex'),
    mainTabsContainer: document.querySelector('.lg:col-span-2 > .flex'),
    // Content Areas
    sidebarContentContainer: document.getElementById('sidebar-content'),
    mainContentContainer: document.getElementById('main-content'),
    // Request Inputs
    requestUrlInput: document.getElementById('request-url'),
    requestMethodSelect: document.getElementById('request-method'),
    requestBodyTextarea: document.getElementById('request-body'),
    requestHeadersTextarea: document.getElementById('request-headers'),
    sendButton: document.getElementById('send-request-btn'),
    // Response Outputs
    responseStatus: document.getElementById('response-status'),
    responseTime: document.getElementById('response-time'),
    processedUrl: document.getElementById('processed-url'),
    responseBody: document.getElementById('response-body'),
    responseHeaders: document.getElementById('response-headers'),
    scriptOutput: document.getElementById('script-output'),
};

// --- Tab Switching Logic (Sidebar) ---

/**
 * Switches the active tab in the sidebar (Variables, History, Scripts).
 * @param {string} tabId - The ID of the tab to switch to ('variables', 'requests', 'scripts').
 */
function switchSidebarTab(tabId) {
    if (appState.activeSidebarTab === tabId) return;

    // 1. Update internal state
    appState.activeSidebarTab = tabId;

    // 2. Update button active state
    DOMElements.sidebarTabsContainer.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        }
    });

    // 3. Update content visibility
    DOMElements.sidebarContentContainer.querySelectorAll('.tab-content').forEach(content => {
        if (content.dataset.tab === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    
    // Trigger render logic specific to the tab if needed (e.g., render requests list)
    // Placeholder for future implementation
    console.log(`Switched sidebar tab to: ${tabId}`);
}

// --- Tab Switching Logic (Main Panel) ---

/**
 * Switches the active tab in the main panel (Request, Response, History).
 * @param {string} tabId - The ID of the tab to switch to ('request', 'response', 'history').
 */
function switchMainTab(tabId) {
    if (appState.activeMainTab === tabId) return;

    // 1. Update internal state
    appState.activeMainTab = tabId;

    // 2. Update button active state
    DOMElements.mainTabsContainer.querySelectorAll('.main-tab-button').forEach(button => {
        button.classList.remove('active');
        if (button.dataset.tab === tabId) {
            button.classList.add('active');
        }
    });

    // 3. Update content visibility
    DOMElements.mainContentContainer.querySelectorAll('.main-tab-content').forEach(content => {
        if (content.dataset.tab === tabId) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
    
    // Placeholder for future implementation (e.g., load specific request history)
    console.log(`Switched main tab to: ${tabId}`);
}


// --- Request and Response Logic ---

/**
 * Handles the main "Send Request" button click.
 */
async function handleSendRequest() {
    const rawUrl = DOMElements.requestUrlInput.value;
    const method = DOMElements.requestMethodSelect.value;
    const rawBody = DOMElements.requestBodyTextarea.value;
    const rawHeadersText = DOMElements.requestHeadersTextarea.value;
    
    // Parse headers from the textarea (simple key: value per line)
    const rawHeaders = rawHeadersText.split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .map(line => {
            const parts = line.split(':').map(p => p.trim());
            return { key: parts[0], value: parts.slice(1).join(':').trim() };
        });

    // Dummy Post-Script ID for now, as UI to select is not built
    const postScriptId = 'script-1'; 
    
    // Disable button and change text
    DOMElements.sendButton.disabled = true;
    DOMElements.sendButton.textContent = 'Sending...';

    // Execute the request (imported from request.js)
    // executeRequest will call displayResponse internally
    await executeRequest(rawUrl, method, rawHeaders, rawBody, postScriptId, displayResponse);
    
    // Re-enable button
    DOMElements.sendButton.disabled = false;
    DOMElements.sendButton.textContent = 'Send Request';
}


/**
 * Updates the UI with the request response details.
 * This function is passed to and called by executeRequest in request.js.
 * @param {Response|Object} response - The Fetch Response object or a mock error object.
 * @param {Object|string} responseData - The parsed response body (JSON object or plain text).
 * @param {string} scriptOutput - Log output from the post-request script.
 * @param {string} processedUrl - The URL after variable templating.
 * @param {number} duration - The total duration of the request in ms.
 */
function displayResponse(response, responseData, scriptOutput, processedUrl, duration) {
    // 1. Switch to Response tab
    switchMainTab('response');
    
    // 2. Update Status and Info
    DOMElements.responseStatus.textContent = `Status: ${response.status || 'N/A'} ${response.statusText || ''}`;
    DOMElements.responseTime.textContent = `Time: ${duration !== undefined ? duration : '---'}ms`;
    DOMElements.processedUrl.textContent = `URL: ${processedUrl || 'N/A'}`;
    
    // 3. Update Body
    let bodyContent = '';
    if (typeof responseData === 'object' && responseData !== null) {
        // Pretty-print JSON
        try {
            bodyContent = JSON.stringify(responseData, null, 2);
        } catch (e) {
            bodyContent = String(responseData); // Fallback
        }
    } else {
        bodyContent = String(responseData);
    }
    DOMElements.responseBody.textContent = bodyContent;
    
    // 4. Update Headers
    let headerContent = '';
    if (response.headers && typeof response.headers.forEach === 'function') {
        response.headers.forEach((value, key) => {
            headerContent += `${key}: ${value}\n`;
        });
    } else if (response.headers) {
        // Handle mock Headers object
        for (const [key, value] of Object.entries(response.headers)) {
            headerContent += `${key}: ${value}\n`;
        }
    }
    DOMElements.responseHeaders.textContent = headerContent;
    
    // 5. Update Script Output
    DOMElements.scriptOutput.textContent = scriptOutput || 'No script log.';
}


// --- Expose core functions globally for inline HTML usage ---
// This must be done at the top level of the module so it is available 
// immediately upon script execution, preventing the TypeError on inline HTML onclick events.
window.app.switchSidebarTab = switchSidebarTab;
window.app.switchMainTab = switchMainTab;

/**
 * Initializes the application: loads data, sets up UI state, and attaches listeners.
 */
function initializeApp() {
    console.log('App initializing...');

    // 1. Load initial data from storage
    // The functions are available because they are imported from storage.js and variable.js
    loadVariableStore();
    loadAllRequests();
    loadAllScripts();
    
    // 2. Attach Event Listener for the main action
    if (DOMElements.sendButton) {
        DOMElements.sendButton.addEventListener('click', handleSendRequest);
    }

    // 3. Set initial active tabs visually
    const initialSidebarButton = DOMElements.sidebarTabsContainer.querySelector(`[data-tab=\"${appState.activeSidebarTab}\"]`);
    if (initialSidebarButton) {
        initialSidebarButton.classList.add('active');
    }

    const initialMainButton = DOMElements.mainTabsContainer.querySelector(`[data-tab=\"${appState.activeMainTab}\"]`);
    if (initialMainButton) {
        initialMainButton.classList.add('active');
    }
    
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