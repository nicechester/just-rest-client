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


// --- Global Initialization --
// Initialize global app container object for inline HTML event handlers
window.app = {};

// Use a simple data structure for the app state
const appState = {
    activeSidebarTab: 'variables',
    activeMainTab: 'request',
};

// Global object to hold DOM elements once they are queried in initializeApp
let DOMElements = {};

// --- UI Logic ---

/**
 * Switches the active tab in the sidebar (Variables, Requests, Scripts).
 * @param {string} tabName - The name of the tab to switch to ('variables', 'requests', 'scripts').
 */
function switchSidebarTab(tabName) {
    if (appState.activeSidebarTab === tabName) return;

    // 1. Update tab buttons
    DOMElements.sidebarTabsContainer.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
        button.classList.remove('text-white', 'bg-blue-500'); // Clean up existing active classes
        if (button.dataset.tab === tabName) {
            button.classList.add('active', 'text-white', 'bg-blue-500'); // Tailwind for active state
        }
    });

    // 2. Update content visibility
    DOMElements.sidebarContentContainer.querySelectorAll('.sidebar-content-tab').forEach(content => {
        content.classList.add('hidden');
        if (content.dataset.content === tabName) {
            content.classList.remove('hidden');
        }
    });

    appState.activeSidebarTab = tabName;
}

/**
 * Switches the active tab in the main area (Request or Response).
 * @param {string} tabName - The name of the tab to switch to ('request', 'response').
 */
function switchMainTab(tabName) {
    if (appState.activeMainTab === tabName) return;

    // 1. Update tab buttons
    DOMElements.mainTabsContainer.querySelectorAll('.main-tab-button').forEach(button => {
        button.classList.remove('active');
        button.classList.remove('text-white', 'bg-blue-500'); // Clean up existing active classes
        if (button.dataset.tab === tabName) {
            button.classList.add('active', 'text-white', 'bg-blue-500'); // Tailwind for active state
        }
    });

    // 2. Update content visibility
    DOMElements.mainContentContainer.querySelectorAll('.main-content-tab').forEach(content => {
        content.classList.add('hidden');
        if (content.dataset.content === tabName) {
            content.classList.remove('hidden');
        }
    });

    appState.activeMainTab = tabName;
}

/**
 * Sets the loading state on the UI elements.
 * @param {boolean} isLoading - Whether the application is currently loading/sending a request.
 */
function setLoadingState(isLoading) {
    if (DOMElements.sendButton) {
        DOMElements.sendButton.disabled = isLoading;
        DOMElements.sendButton.textContent = isLoading ? 'Sending...' : 'Send Request';
        if (isLoading) {
            DOMElements.sendButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            DOMElements.sendButton.classList.add('bg-gray-400');
        } else {
            DOMElements.sendButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
            DOMElements.sendButton.classList.remove('bg-gray-400');
        }
    }
}

/**
 * Updates the UI with the request results. This is passed to request.js as a callback.
 * @param {Response|Object} response - The native Fetch Response object (or mock error object).
 * @param {Object} responseData - The parsed response body data.
 * @param {string} scriptOutput - The log output from the post-request script.
 * @param {string} processedUrl - The final URL after variable substitution.
 * @param {number} duration - The request duration in milliseconds.
 */
function displayResponse(response, responseData, scriptOutput, processedUrl, duration) {
    setLoadingState(false);

    // Get formatted response body
    let bodyText;
    if (typeof responseData === 'object' && responseData !== null) {
        bodyText = JSON.stringify(responseData, null, 2);
    } else {
        bodyText = String(responseData);
    }

    // Get formatted headers
    let headersText = '';
    if (response.headers && typeof response.headers.entries === 'function') {
        for (const [key, value] of response.headers.entries()) {
            headersText += `${key}: ${value}\n`;
        }
    } else {
         headersText = 'N/A';
    }


    // Update DOM elements
    DOMElements.responseStatus.textContent = `Status: ${response.status || response.statusText}`;
    
    // Set status color
    let statusClass = 'text-gray-500';
    if (response.status >= 200 && response.status < 300) {
        statusClass = 'text-green-500';
    } else if (response.status >= 400 || response.statusText === 'Network Error') {
        statusClass = 'text-red-500';
    } else if (response.status >= 300) {
        statusClass = 'text-yellow-600';
    }
    DOMElements.responseStatus.className = `font-bold ${statusClass}`;

    DOMElements.responseTime.textContent = `Time: ${duration}ms`;
    DOMElements.processedUrl.textContent = `URL: ${processedUrl}`;
    
    DOMElements.responseBody.textContent = bodyText;
    DOMElements.responseHeaders.textContent = headersText;
    DOMElements.scriptOutput.textContent = scriptOutput;

    // Switch to the response tab
    switchMainTab('response');
}

// --- Event Handlers ---

/**
 * Handles the click event for the "Send Request" button.
 */
async function handleSendRequest() {
    setLoadingState(true);

    let rawHeaders = {};
    try {
        if (DOMElements.requestHeadersTextarea.value.trim()) {
            rawHeaders = JSON.parse(DOMElements.requestHeadersTextarea.value.trim());
        }
    } catch (e) {
        // Use console.error instead of alert per instructions
        console.error('Invalid JSON in Headers field.', e);
        setLoadingState(false);
        return;
    }

    // Execute the request, providing displayResponse and executePostScript as callbacks
    // For now, we use a mock script ID. Actual implementation would link to a saved script.
    const mockPostScriptId = 'default-script-id'; 

    executeRequest(
        DOMElements.requestUrlInput.value,
        DOMElements.requestMethodSelect.value,
        rawHeaders, 
        DOMElements.requestBodyTextarea.value,
        mockPostScriptId,
        displayResponse, // Function to update UI after request
        executePostScript // Function to run user script after response
    );
}


// --- Initialization ---

/**
 * Initializes the application: loads data, sets up UI state, and attaches listeners.
 */
function initializeApp() {
    console.log('App initializing...');

    // CRITICAL FIX: Define DOMElements inside initializeApp (or after DOMContentLoaded)
    // to prevent the SyntaxError from trying to query non-existent elements.
    DOMElements = {
        // Tabs
        sidebarTabsContainer: document.querySelector('.col-span-1 > .flex'),
        mainTabsContainer: document.querySelector('.lg\\:col-span-2 > .flex'), // Note: Escaped colon for safety
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
    
    // Check if the DOM elements were found before proceeding
    if (!DOMElements.mainTabsContainer) {
        console.error('Could not find mainTabsContainer. Check HTML structure and selectors.');
        return;
    }

    // 1. Load initial data from storage
    loadVariableStore();
    loadAllRequests();
    loadAllScripts();
    
    // 2. Attach Event Listener for the main action
    if (DOMElements.sendButton) {
        DOMElements.sendButton.addEventListener('click', handleSendRequest);
    }

    // 3. Set initial active tabs visually and apply initial active classes
    const initialSidebarButton = DOMElements.sidebarTabsContainer.querySelector(`[data-tab="${appState.activeSidebarTab}"]`);
    if (initialSidebarButton) {
        initialSidebarButton.classList.add('active', 'text-white', 'bg-blue-500');
    }

    const initialMainButton = DOMElements.mainTabsContainer.querySelector(`[data-tab="${appState.activeMainTab}"]`);
    if (initialMainButton) {
        initialMainButton.classList.add('active', 'text-white', 'bg-blue-500');
    }
    
    console.log('App initialized.');
}

// CRITICAL FIX: Expose core functions globally immediately upon module evaluation
// to prevent the "is not a function" error on inline HTML onclick events.
// The functions are defined above, so this works now.
window.app.switchSidebarTab = switchSidebarTab;
window.app.switchMainTab = switchMainTab;


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