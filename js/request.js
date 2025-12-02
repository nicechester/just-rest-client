/**
 * @fileoverview Handles the HTTP request execution, variable templating,
 * and integration with the post-request scripting module.
 *
 * NOTE: Assumes access to variableStore (from variables.js) and
 * executePostScript (from scripting.js).
 */

// Placeholder: Assume these imports are available in the app context
// import { variableStore } from './variables.js'; 
// import { executePostScript } from './scripting.js'; 

// --- Core Templating Function ---

/**
 * Replaces all {{variableName}} tags in a string with the corresponding value
 * from the global variable store.
 * @param {string} templateString - The string containing template tags.
 * @return {string} The string with variables substituted.
 */
function applyTemplate(templateString) {
  // Use a temporary mock variableStore if the actual one isn't loaded yet
  const store = typeof variableStore !== 'undefined' ? variableStore : {};

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
 * @param {Array<Object>} rawHeaders - Array of {key: string, value: string} objects.
 * @param {string} rawBody - The request body content (for POST/PUT).
 * @param {string | null} postScriptId - ID of the script to run after the request.
 * @param {function} displayResponse - Function from app.js to update the UI.
 */
async function executeRequest(rawUrl, method, rawHeaders, rawBody, postScriptId, displayResponse) {
  
  const startTime = performance.now();
  let response;
  let responseData = null;
  let scriptOutput = '';

  try {
    // 1. Template Processing
    const processedUrl = applyTemplate(rawUrl);
    
    // 2. Prepare Headers (Crucial update for CORS and Headers)
    const headers = new Headers();
    
    // Add the headers from the UI (currently hardcoded in app.js for testing)
    rawHeaders.forEach(header => {
      headers.append(header.key, applyTemplate(header.value));
    });

    // 3. Prepare Fetch Options
    const options = {
      method: method,
      headers: headers,
    };

    // Add body only if method supports it
    if (rawBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = applyTemplate(rawBody);
      // Automatically set Content-Type for JSON body if not explicitly set
      if (!headers.has('Content-Type') && options.body.trim().startsWith('{')) {
          headers.append('Content-Type', 'application/json');
      }
    }
    
    // 4. Execute Fetch Request
    response = await fetch(processedUrl, options);
    const duration = Math.round(performance.now() - startTime);

    // 5. Process Response
    const contentType = response.headers.get('Content-Type');
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