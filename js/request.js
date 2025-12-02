/**
 * @fileoverview Handles the HTTP request execution, variable templating,
 * and integration with the post-request scripting module.
 *
 * NOTE: Assumes access to variableStore (from variables.js) and
 * executePostScript (from scripting.js).
 */

// Placeholder: Assume these imports are available in the app context
// The actual variableStore is imported via the main app.js module graph
// and is available in the shared scope.

// --- Core Templating Function ---

/**
 * Replaces all {{variableName}} tags in a string with the corresponding value
 * from the global variable store.
 * @param {string} templateString - The string containing template tags.
 * @param {Object} variableStore - The key-value map of global variables.
 * @return {string} The string with variables substituted.
 */
function applyTemplate(templateString, variableStore) {
  // Use a temporary mock variableStore if the actual one isn't loaded yet
  const store = variableStore || {};

  if (!templateString) {
    return templateString;
  }
  
  return templateString.replace(/{{(.*?)}}/g, (match, variableName) => {
    const key = variableName.trim();
    const value = store[key];
    // Return the value if it exists, otherwise return the original tag
    return value !== undefined ? String(value) : match;
  });
}

// --- Main Request Execution Logic ---

/**
 * Executes the HTTP request based on the current UI state.
 * @param {string} rawUrl - The user-provided URL template.
 * @param {string} method - The HTTP method (GET, POST, etc.).
 * @param {Array<Object>} rawHeaders - Array of { key, value } pairs for headers.
 * @param {string} rawBody - The raw request body text.
 * @param {string} postScriptId - The ID of the script to run after the request.
 * @param {Function} displayResponse - UI callback function to display results.
 */
export async function executeRequest(rawUrl, method, rawHeaders, rawBody, postScriptId, displayResponse) {
  let response;
  let responseData;
  let scriptOutput = '';
  const startTime = performance.now();
  const variableStore = window.app.getVariableStore ? window.app.getVariableStore() : {}; // Access store from global helper
  let processedUrl = rawUrl;

  try {
    // 1. Process URL and Body templates
    processedUrl = applyTemplate(rawUrl, variableStore);
    const processedBody = applyTemplate(rawBody, variableStore);

    // 2. Process headers
    const headers = new Headers();
    
    // FIX: Add defensive check to ensure rawHeaders is an array
    if (Array.isArray(rawHeaders)) { 
        rawHeaders.forEach(header => {
            // Apply templating to headers as well
            const key = applyTemplate(header.key, variableStore);
            const value = applyTemplate(header.value, variableStore);
            if (key && value) {
                headers.set(key, value);
            }
        });
    }

    // 3. Construct the fetch options
    const fetchOptions = {
      method: method,
      headers: headers,
    };

    // Add body for methods that typically include one
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      fetchOptions.body = processedBody;
    }
    
    // 4. Execute the fetch request
    const controller = new AbortController();
    fetchOptions.signal = controller.signal;
    
    // Simple 10-second timeout
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    response = await fetch(processedUrl, fetchOptions);
    clearTimeout(timeoutId);
    
    const duration = Math.round(performance.now() - startTime);

    // 5. Process response data
    const contentType = response.headers.get('content-type');
    // Create a clone for the script/UI to read, as response body can only be read once
    const responseClone = response.clone(); 

    if (contentType && contentType.includes('application/json')) {
      responseData = await responseClone.json();
    } else {
      // Fallback for non-JSON content (e.g., HTML, XML, text)
      responseData = await responseClone.text();
    }
    
    // 6. Run post-request script
    if (typeof executePostScript === 'function') {
      scriptOutput = executePostScript(postScriptId, response, responseData);
    } else {
      scriptOutput += '[Error] Scripting engine is unavailable.\n';
    }
    
    // 7. Display Results
    displayResponse(response, responseData, scriptOutput, processedUrl, duration);

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error('Request execution error:', error);
    
    // Construct a friendly, client-side error object
    const errorResponse = {
      status: 'N/A',
      statusText: 'Network Error',
      headers: {}, // Use a simple object for mock headers
    };
    const errorData = { 
      error: 'Load failed', 
      message: `Client could not connect to server. This is typically due to a network firewall, an inaccessible domain (like a private corporate network), or a CORS policy block.`,
      details: error.message
    };
    scriptOutput += `[Execution Error] Network or Parsing failure: ${error.message}\n`;

    // 8. Display Error Results
    // The previous error was likely caused by this block being reached before 
    // the headers parsing error was fully resolved. This call is now correctly 
    // protected by the try-catch block.
    if (typeof displayResponse === 'function') {
        displayResponse(errorResponse, errorData, scriptOutput, rawUrl, duration);
    } else {
        console.error('UI function displayResponse is missing in catch block.');
    }
  }
}

/**
 * Public interface for the request module.
 */
export {
  applyTemplate,
  executeRequest
};