/**
 * @fileoverview Handles the HTTP request execution, variable templating,
 * and integration with the post-request scripting module.
 */

// --- Module Imports ---
// Import necessary functions and variables from other modules.
import { variableStore } from './variable.js'; // Import the variable store object for templating
import { executePostScript, executePreScript } from './scripting.js'; // Import the script execution engine

// --- Core Templating Function ---

/**
 * Replaces all {{variableName}} tags in a string with the corresponding value
 * from the global variable store.
 * @param {string} templateString - The string containing template tags.
 * @return {string} The string with variables substituted.
 */
function applyTemplate(templateString) {
  if (!templateString) {
    return templateString;
  }
  
  return templateString.replace(/{{(.*?)}}/g, (match, variableName) => {
    const key = variableName.trim();
    const value = variableStore[key]; // Access the imported variableStore object
    // Return the value if it exists, otherwise return the original tag.
    return value !== undefined ? String(value) : match;
  });
}

// --- Main Request Execution Logic ---

/**
 * Executes the HTTP request based on the current UI state.
 * @param {string} rawUrl - The user-provided URL template.
 * @param {string} method - The HTTP method (GET, POST, etc.).
 * @param {Array<Object>} rawHeaders - Array of {key, value} header objects.
 * @param {string} rawBody - The request body template string.
 * @param {string} preScriptId - The ID of the script to run before the request.
 * @param {string} postScriptId - The ID of the script to run after the request.
 * @param {function} displayResponse - UI function to update the response panel.
 */
async function executeRequest(rawUrl, method, rawHeaders, rawBody, preScriptId, postScriptId, displayResponse) {
  const startTime = Date.now();

  // 0. Run pre-request script first
  let scriptOutput = '';
  if (preScriptId) {
    scriptOutput = executePreScript(preScriptId);
  }

  // 1. Apply templating (after pre-script has run and potentially updated variables)
  const processedUrl = applyTemplate(rawUrl);
  const processedBody = (method !== 'GET' && method !== 'HEAD') ? applyTemplate(rawBody) : null;
  
  const headers = {};
  rawHeaders.forEach(h => {
    if (h.key) {
      const processedValue = applyTemplate(h.value || '');
      headers[h.key.trim()] = processedValue;
    }
  });

  // Store request details for display
  const requestDetails = {
    method: method,
    processedUrl: processedUrl,
    headers: headers,
    body: processedBody
  };

  let responseData = null;
  let response = null;

  try {
    // 2. Execute Fetch
    response = await fetch(processedUrl, {
      method: method,
      headers: headers,
      body: processedBody,
    });

    // 3. Parse Response Body
    const contentType = response.headers.get('content-type');
    // Create a clone for the script/UI to read, as response body can only be read once
    const responseClone = response.clone(); 

    // Check if content type indicates JSON (handles application/json, application/ld+json, etc.)
    if (contentType && (contentType.includes('json') || contentType.includes('javascript'))) {
      responseData = await responseClone.json();
    } else {
      // Fallback for non-JSON content (e.g., HTML, XML, text)
      responseData = await responseClone.text();
    }
    
    // 4. Run post-request script
    const postScriptOutput = executePostScript(postScriptId, response, responseData);
    scriptOutput += postScriptOutput;

  } catch (error) {
    console.error('Request execution error:', error);
    scriptOutput += `[Execution Error] Network or Parsing failure: ${error.message}\n`;
    // Set a mock response object for display in case of network failure
    response = {
      status: 'N/A',
      statusText: 'Network Error',
      headers: new Headers(),
    };
    responseData = { error: error.message };
  }

  const duration = Date.now() - startTime;

  // 5. Display Results with request details
  // This function must be provided by app.js to update the UI
  if (typeof displayResponse === 'function') {
    displayResponse(requestDetails, response, responseData, scriptOutput, processedUrl, duration);
  } else {
    console.warn('UI function displayResponse not provided. Results logged to console:', 
                 { requestDetails, response, responseData, scriptOutput });
  }
}

/**
 * Public interface for the request module.
 */
export {
  executeRequest
};