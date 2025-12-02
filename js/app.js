/**
 * @fileoverview Main application entry point. Handles initialization,
 * module integration, UI state management, and event listeners.
 */

// --- Module Imports ---
// Import all necessary functions and variables from other modules.
import { executeRequest } from './request.js';
import { loadVariableStore, loadAllRequests, loadAllScripts } from './storage.js';
// We need to import the executePostScript function as it's required by request.js
import { executePostScript } from './scripting.js'; 
import { variableStore, setVariable, getVariableStore } from './variable.js';


// --- Global Initialization ---

// Initialize global app container object for inline HTML event handlers
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
    // Request Inputs
    requestUrlInput: document.getElementById('request-url'),
    requestMethodSelect: document.getElementById('request-method'),
    requestBodyTextarea: document.getElementById('request-body'),
    sendButton: document.getElementById('send-request-btn'),
    // Response Outputs
    responseStatus: document.getElementById('response-status'),
    responseTime: document.getElementById('response-time'),
    processedUrl: document.getElementById('processed-url'),
    responseBody: document.getElementById('response-body'),
    responseHeaders: document.getElementById('response-headers'),
    scriptOutput: document.getElementById('script-output'),
};


// --- UI Utility Functions ---

/**
 * Updates the response panel in the UI.
 * @param {Response | Object} response - The native Fetch Response object or a mock object on error.
 * @param {any} responseData - The parsed response body or error object.
 * @param {string} scriptLog - Log output from the post-request script.
 * @param {string} finalUrl - The fully processed URL used.
 * @param {number} duration - Request duration in ms.
 */
function displayResponse(response, responseData, scriptLog, finalUrl, duration) {
    // 1. Update Status Line
    DOMElements.responseStatus.textContent = `Status: ${response.status} ${response.statusText}`;
    DOMElements.responseTime.textContent = `Time: ${duration}ms`;
    DOMElements.processedUrl.textContent = `URL: ${finalUrl}`;

    // 2. Format and Display Response Body
    let formattedBody = '';
    if (typeof responseData === 'object' && responseData !== null) {
        try {
            formattedBody = JSON.stringify(responseData, null, 2);
        } catch (e) {
            formattedBody = String(responseData); 
        }
    } else {
        formattedBody = String(responseData);
    }
    DOMElements.responseBody.textContent = formattedBody;

    // 3. Display Headers
    let headerText = '';
    if (response.headers && typeof response.headers.forEach === 'function') {
        response.headers.forEach((value, key) => {
            headerText += `${key}: ${value}\n`;
        });
    } else if (response.status === 'N/A') {
        headerText = 'No headers available due to network failure.';
    }
    
    DOMElements.responseHeaders.textContent = headerText;

    // 4. Display Script Output
    DOMElements.scriptOutput.textContent = scriptLog;

    // Switch to the 'response' tab automatically
    const responseTabButton = document.querySelector('[data-tab="response"]');
    if (responseTabButton) {
        switchMainTab('response', responseTabButton);
    }
}

/**
 * Handles switching the active tab in the side panel (Variables/Scripts/Collections).
 */
function switchSidebarTab(tabName, clickedButton) {
    if (appState.activeSidebarTab === tabName) return;

    // Remove 'active' class from all sidebar tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add 'active' class to the clicked button
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    appState.activeSidebarTab = tabName;
    console.log(`Sidebar tab switched to: ${tabName}`);
    // NOTE: Content switching logic (hiding/showing divs) would go here.
}

/**
 * Handles switching the active tab in the main panel (Request/Response).
 */
function switchMainTab(tabName, clickedButton) {
    if (appState.activeMainTab === tabName) return;

    // Remove 'active' class from all main tab buttons
    document.querySelectorAll('.main-tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add 'active' class to the clicked button
    if (clickedButton) {
        clickedButton.classList.add('active');
    }

    appState.activeMainTab = tabName;
    console.log(`Main tab switched to: ${tabName}`);
    // NOTE: Content switching logic (hiding/showing divs) would go here.
}

// --- Main Request Handler ---

/**
 * Gathers input data and executes the HTTP request.
 */
async function handleSendRequest() {
    DOMElements.sendButton.disabled = true;
    DOMElements.sendButton.textContent = 'Sending...';

    const rawUrl = DOMElements.requestUrlInput.value;
    const method = DOMElements.requestMethodSelect.value;
    const rawBody = DOMElements.requestBodyTextarea.value;
    
    // Hardcoded Headers for testing the curl command's Accept header
    const rawHeaders = [
        { key: 'Accept', value: 'application/json' }
    ];
    const postScriptId = null; // No script running for now

    try {
        await executeRequest(
            rawUrl,
            method,
            rawHeaders,
            rawBody,
            postScriptId,
            displayResponse // CRITICAL FIX: Pass the UI update function
        );
    } catch (error) {
        console.error("Failed to execute request:", error);
        // Fallback error display
        displayResponse({status: 'N/A', statusText: 'Client Error'}, {error: error.message}, 'Client-side error during dispatch.', rawUrl, 0);
    } finally {
        DOMElements.sendButton.disabled = false;
        DOMElements.sendButton.textContent = 'Send Request';
    }
}

// --- Initialization ---

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

    // 3. Attach Event Listener for the main action
    if (DOMElements.sendButton) {
        DOMElements.sendButton.addEventListener('click', handleSendRequest);
    }

    // 4. Set initial active tabs visually
    const initialSidebarButton = DOMElements.sidebarTabsContainer.querySelector(`[data-tab="${appState.activeSidebarTab}"]`);
    if (initialSidebarButton) {
        initialSidebarButton.classList.add('active');
    }

    const initialMainButton = DOMElements.mainTabsContainer.querySelector(`[data-tab="${appState.activeMainTab}"]`);
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