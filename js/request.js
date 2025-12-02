/**
 * @fileoverview Handles the HTTP request execution, variable templating,
 * and integration with the post-request scripting module.
 *
 * NOTE: Assumes access to variableStore and executePostScript functions
 * are passed or imported by the application context.
 */

// Placeholder: Assume these imports are available in the app context
// import { variableStore } from './variables.js'; 
// import { executePostScript } from './scripting.js'; 

// --- Core Templating Function ---

/**
 * Replaces all {{variableName}} tags in a string with the corresponding value
 * from the global variable store.
 * @param {string} templateString - The string containing template tags.
 * @param {Object} store - The current variable store.
 * @return {string} The string with variables substituted.
 */
function applyTemplate(templateString, store) {
  const variableStore = store || {};

  if (!templateString) {
    return templateString;
  }
  
  return templateString.replace(/{{(.*?)}}/g, (match, variableName) => {
    const key = variableName.trim();
    const value = variableStore[key];
    // Return the value if it exists, otherwise return the original tag
    return value !== undefined ? String(value) : match;
  });
}

// --- Main Request Execution Logic ---

/**
 * Executes the HTTP request based on the current UI state.
 * @param {string} rawUrl - The user-provided URL template.
 * @param {string} method - The HTTP method (GET, POST, etc.).
 * @param {Array<Object>} rawHeaders - Array of {key, value} objects for request headers.
 * @param {string} rawBody - The raw request body content.
 * @param {string} postScriptId - The ID of the script to run after the request.
 * @param {Object} variableStore - The current global variable store.
 * @param {function} executePostScript - Function to run the post-request script.
 * @param {function} displayResponse - Function to update the main UI with results.
 */
async function executeRequest(
    rawUrl, 
    method, 
    rawHeaders, 
    rawBody, 
    postScriptId, 
    variableStore, 
    executePostScript, 
    displayResponse
) {
  let response;
  let responseData = {};
  let scriptOutput = '';
  let processedUrl = rawUrl;
  const startTime = performance.now();

  try {
    // 1. Template URL and Body
    processedUrl = applyTemplate(rawUrl, variableStore);
    const processedBody = applyTemplate(rawBody, variableStore);

    // 2. Template Headers and construct Fetch Headers object
    const headers = new Headers();
    rawHeaders.forEach(header => {
        const key = applyTemplate(header.key, variableStore);
        const value = applyTemplate(header.value, variableStore);
        if (key && value) {
            headers.set(key, value);
        }
    });

    // 3. Build the request options
    const fetchOptions = {
      method: method,
      headers: headers,
    };

    // Add body for methods that allow it
    if (['POST', 'PUT', 'PATCH'].includes(method) && processedBody) {
      fetchOptions.body = processedBody;
    }
    
    // 4. Execute the request
    response = await fetch(processedUrl, fetchOptions);
    const duration = Math.round(performance.now() - startTime);

    // 5. Parse the response body
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
      headers: new Headers(),
    };
    const errorData = { 
      error: 'Load failed', 
      message: `Client could not connect to server. This is typically due to a network firewall, an inaccessible domain (like a private corporate network), or a CORS policy block.`,
      details: error.message
    };
    scriptOutput += `[Execution Error] Network or Parsing failure: ${error.message}\n`;

    // 8. Display Error Results
    displayResponse(errorResponse, errorData, scriptOutput, rawUrl, duration);
  }
}

/**
 * Public interface for the request module.
 */
export {
  applyTemplate,
  executeRequest
};